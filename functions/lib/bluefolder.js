/**
 * BlueFolder API client for Cloudflare Workers / Pages Functions.
 *
 * Idempotent on email — a returning lead reuses the existing customer
 * (looked up by externalId = lowercased email) and only adds a new
 * service request. New leads create the customer first, then the SR.
 *
 * STRICTLY ADDITIVE. This module never updates or deletes anything in
 * BlueFolder. Only `customerAdd` and `serviceRequestAdd` are called.
 *
 * Required env bindings (Pages → Settings → Environment Variables):
 *   BLUEFOLDER_API_TOKEN              required
 *   BLUEFOLDER_BASE_URL               default https://app.bluefolder.com/api/2.0
 *   BLUEFOLDER_WO_TYPE                default "Web Lead"
 *   BLUEFOLDER_PRIORITY               default "Low"
 *   BLUEFOLDER_SERVICE_MANAGER_ID     optional
 *
 * Why XML-as-strings instead of a parser library? Workers bundle weight
 * matters and the BlueFolder response shape is small + tightly defined.
 * Tag/attribute extraction via regex is acceptable here — it would not be
 * for arbitrary XML, but it is for this API.
 */

export class BlueFolderError extends Error {
  constructor(message, { code, body } = {}) {
    super(message);
    this.name = 'BlueFolderError';
    this.code = code;
    this.body = body;
  }
}

/**
 * Create or look-up a customer and always create a fresh service request.
 *
 * @param {object} env  Cloudflare Pages env bindings
 * @param {object} lead Form payload — at minimum { name, email }
 * @returns {Promise<{customerId: string, serviceRequestId: string, reused: boolean}>}
 */
export async function createLead(env, lead) {
  const baseUrl = (env.BLUEFOLDER_BASE_URL || 'https://app.bluefolder.com/api/2.0')
    .replace(/\/+$/, '');
  const token = env.BLUEFOLDER_API_TOKEN;
  if (!token) {
    throw new BlueFolderError('BLUEFOLDER_API_TOKEN missing from env');
  }

  const name  = String(lead?.name  || '').trim();
  const email = String(lead?.email || '').trim();
  if (!name || !isValidEmail(email)) {
    throw new BlueFolderError(`invalid lead payload: name='${name}' email='${email}'`);
  }

  const externalId = email.toLowerCase();
  const [firstName, lastName] = splitName(name);
  const ctx = { baseUrl, token };

  // Lookup-or-create customer
  let customerId = await getCustomerIdByExternalId(ctx, externalId);
  const reused = customerId !== null;

  if (!reused) {
    customerId = await addCustomer(ctx, {
      externalId,
      customerName: name,
      customerType: 'Web Lead',
      description:  'Auto-created from wabashsystems.com contact form',
      firstName,
      lastName,
      email,
      phone: String(lead.phone || ''),
    });
  }

  // Always add a new service request — every inquiry gets its own record
  const business = String(lead.business || '').trim();
  const service  = String(lead.service  || '').trim();

  const shortDesc = truncate(
    `Web lead: ${name}${business ? ' / ' + business : ''}${service ? ' — ' + service : ''}`,
    100,
  );

  const detailed = buildDetailedDescription(lead);

  const serviceRequestId = await addServiceRequest(ctx, {
    customerId,
    description:         shortDesc,
    detailedDescription: detailed,
    priority:            env.BLUEFOLDER_PRIORITY || 'Low',
    status:              'New',
    type:                env.BLUEFOLDER_WO_TYPE || 'Web Lead',
    sourceName:          'wabashsystems.com web form',
    serviceManagerId:    env.BLUEFOLDER_SERVICE_MANAGER_ID || '',
  });

  return { customerId, serviceRequestId, reused };
}

// ── BlueFolder API operations ────────────────────────────────────────────────

/**
 * Look up a customer by externalId. Returns customerId or null.
 *
 * BlueFolder returns status='fail' when the externalId doesn't exist.
 * We deliberately treat any 'fail' here as "not found" so we fall through
 * to addCustomer. If the get is failing for another reason (auth, etc.)
 * the addCustomer will fail loudly with a real error — which is the right
 * place for that signal.
 */
async function getCustomerIdByExternalId(ctx, externalId) {
  const xml = `<request><externalId>${xmlEscape(externalId)}</externalId></request>`;
  const resp = await bfPost(ctx, '/customers/get.aspx', xml, /*treatFailAsNull*/ true);
  if (resp === null) return null;
  return extractTag(resp, 'customerId');
}

async function addCustomer(ctx, c) {
  const customerFields = renderFields([
    ['customerName', c.customerName],
    ['customerType', c.customerType],
    ['description',  c.description],
    ['externalId',   c.externalId],
  ]);
  const contactFields = renderFields([
    ['firstName', c.firstName],
    ['lastName',  c.lastName],
    ['email',     c.email],
    ['phone',     c.phone],
  ]);

  const xml = `<request><customerAdd>${customerFields}<primaryContact>${contactFields}</primaryContact></customerAdd></request>`;

  const resp = await bfPost(ctx, '/customers/add.aspx', xml);
  const id = extractTag(resp, 'customerId');
  if (!id) {
    throw new BlueFolderError('customerAdd succeeded but returned no customerId', {
      body: resp.slice(0, 500),
    });
  }
  return id;
}

async function addServiceRequest(ctx, sr) {
  if (!sr.customerId) {
    throw new BlueFolderError('customerId required for service request');
  }
  if (!sr.description) {
    throw new BlueFolderError('description required for service request');
  }

  const fields = renderFields([
    ['customerId',          sr.customerId],
    ['description',         sr.description],
    ['detailedDescription', sr.detailedDescription],
    ['priority',            sr.priority],
    ['status',              sr.status],
    ['type',                sr.type],
    ['sourceName',          sr.sourceName],
    ['serviceManagerId',    sr.serviceManagerId],
  ]);

  const xml = `<request><serviceRequestAdd>${fields}</serviceRequestAdd></request>`;
  const resp = await bfPost(ctx, '/serviceRequests/add.aspx', xml);
  const id = extractTag(resp, 'serviceRequestId');
  if (!id) {
    throw new BlueFolderError('serviceRequestAdd succeeded but returned no serviceRequestId', {
      body: resp.slice(0, 500),
    });
  }
  return id;
}

// ── Transport ────────────────────────────────────────────────────────────────

/**
 * POST an XML payload to BlueFolder and return the response body as a string.
 *
 * On status='ok' returns the raw XML text.
 * On status='fail': by default throws; if treatFailAsNull is true, returns null.
 * On HTTP/transport errors: always throws.
 */
async function bfPost(ctx, path, xmlBody, treatFailAsNull = false) {
  const url = ctx.baseUrl + path;
  // BlueFolder uses Basic auth with token as username and any string as password.
  const auth = 'Basic ' + btoa(`${ctx.token}:X`);

  // 12-second cap. Workers have their own ceiling but we want to fail
  // fast if BlueFolder is sluggish — the user is staring at a "Sending..."
  // button and we still need time for the failure path to log + return.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  let resp;
  try {
    resp = await fetch(url, {
      method:  'POST',
      headers: {
        'Authorization': auth,
        'Content-Type':  'application/xml; charset=utf-8',
        'Accept':        'application/xml',
      },
      body:   xmlBody,
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new BlueFolderError(`BlueFolder request timed out at ${url}`);
    }
    throw new BlueFolderError(`fetch error to ${url}: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }

  const text = await resp.text();

  if (resp.status === 429) {
    throw new BlueFolderError('BlueFolder rate-limited (429)', {
      code: 429, body: text.slice(0, 500),
    });
  }
  if (resp.status >= 500) {
    throw new BlueFolderError(`BlueFolder ${resp.status} at ${path}`, {
      code: resp.status, body: text.slice(0, 500),
    });
  }
  if (resp.status >= 400) {
    throw new BlueFolderError(`BlueFolder ${resp.status} at ${path}`, {
      code: resp.status, body: text.slice(0, 500),
    });
  }

  // Parse the BlueFolder-level status attribute on the root element.
  const status = extractRootStatus(text);
  if (status !== 'ok') {
    if (treatFailAsNull) return null;
    const errCode = extractAttr(text, 'code') || '?';
    const errMsg  = extractTag(text, 'error') || 'unknown';
    throw new BlueFolderError(
      `BlueFolder error at ${path}: code=${errCode} msg=${errMsg}`,
      { code: errCode, body: text.slice(0, 500) },
    );
  }

  return text;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function xmlEscape(s) {
  return String(s)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}

/** Render [[tag, value], ...] pairs as XML elements, skipping empty values. */
function renderFields(pairs) {
  let out = '';
  for (const [k, v] of pairs) {
    if (v === '' || v === null || v === undefined) continue;
    out += `<${k}>${xmlEscape(v)}</${k}>`;
  }
  return out;
}

/** Extract the inner text of the first <tag>...</tag> match. */
function extractTag(xmlText, tagName) {
  const re = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const m  = xmlText.match(re);
  return m ? m[1].trim() : null;
}

/** Extract an attribute value from the first opening tag in the document. */
function extractAttr(xmlText, attrName) {
  const re = new RegExp(`${attrName}\\s*=\\s*"([^"]*)"`, 'i');
  const m  = xmlText.match(re);
  return m ? m[1] : null;
}

/** Extract status="..." from the document root specifically. */
function extractRootStatus(xmlText) {
  // Find the first <something ... status="x"> opening tag; ignore <?xml ?> prologue.
  const m = xmlText.match(/<[a-zA-Z][^>]*\bstatus\s*=\s*"([^"]*)"[^>]*>/);
  return m ? m[1] : null;
}

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function splitName(full) {
  const cleaned = full.replace(/\s+/g, ' ').trim();
  if (!cleaned) return ['Unknown', 'Lead'];
  const parts = cleaned.split(' ');
  if (parts.length === 1) {
    // Single token — duplicate it. Better than blank lastName which BF rejects.
    return [parts[0], parts[0]];
  }
  return [parts[0], parts.slice(1).join(' ')];
}

function truncate(s, max) {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

/**
 * Build the long-form work order body. Includes everything from the form
 * plus a timestamp for triage context.
 */
function buildDetailedDescription(lead) {
  const lines = [];
  lines.push('New web lead via wabashsystems.com');
  lines.push(`Submitted: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Name:     ${lead.name  || ''}`);
  lines.push(`Email:    ${lead.email || ''}`);
  if (lead.phone)    lines.push(`Phone:    ${lead.phone}`);
  if (lead.business) lines.push(`Business: ${lead.business}`);
  if (lead.service)  lines.push(`Service:  ${lead.service}`);
  if (lead.message) {
    lines.push('');
    lines.push('Message:');
    lines.push(String(lead.message));
  }
  if (lead.emailOptIn !== undefined || lead.smsOptIn !== undefined) {
    lines.push('');
    lines.push(`Email opt-in: ${lead.emailOptIn ? 'Yes' : 'No'}`);
    lines.push(`SMS opt-in:   ${lead.smsOptIn   ? 'Yes' : 'No'}`);
  }
  return lines.join('\n');
}
