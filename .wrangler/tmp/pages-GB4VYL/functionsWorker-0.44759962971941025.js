var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// functions/admin/api/data.js
var KV_KEY = "billing_data";
var EMPTY = JSON.stringify({ clients: [], entries: [], invoices: [] });
var json = /* @__PURE__ */ __name((body, status = 200) => new Response(body, {
  status,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  }
}), "json");
async function onRequestGet(context) {
  const { env } = context;
  if (!env.ADMIN_DATA) {
    return json(JSON.stringify({ error: "ADMIN_DATA KV binding not configured." }), 503);
  }
  const data = await env.ADMIN_DATA.get(KV_KEY);
  return json(data || EMPTY);
}
__name(onRequestGet, "onRequestGet");
async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.ADMIN_DATA) {
    return json(JSON.stringify({ error: "ADMIN_DATA KV binding not configured." }), 503);
  }
  const body = await request.text();
  try {
    const parsed = JSON.parse(body);
    if (!Array.isArray(parsed.clients) || !Array.isArray(parsed.entries) || !Array.isArray(parsed.invoices)) {
      return json(JSON.stringify({ error: "Invalid data structure." }), 400);
    }
  } catch {
    return json(JSON.stringify({ error: "Invalid JSON." }), 400);
  }
  await env.ADMIN_DATA.put(KV_KEY, body);
  return json(JSON.stringify({ ok: true }));
}
__name(onRequestPost, "onRequestPost");

// admin/api/data.js
var KV_KEY2 = "billing_data";
var EMPTY2 = JSON.stringify({ clients: [], entries: [], invoices: [] });
var json2 = /* @__PURE__ */ __name((body, status = 200) => new Response(body, {
  status,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  }
}), "json");
async function onRequestGet2(context) {
  const { env } = context;
  if (!env.ADMIN_DATA) {
    return json2(JSON.stringify({ error: "ADMIN_DATA KV binding not configured." }), 503);
  }
  const data = await env.ADMIN_DATA.get(KV_KEY2);
  return json2(data || EMPTY2);
}
__name(onRequestGet2, "onRequestGet");
async function onRequestPost2(context) {
  const { request, env } = context;
  if (!env.ADMIN_DATA) {
    return json2(JSON.stringify({ error: "ADMIN_DATA KV binding not configured." }), 503);
  }
  const body = await request.text();
  try {
    const parsed = JSON.parse(body);
    if (!Array.isArray(parsed.clients) || !Array.isArray(parsed.entries) || !Array.isArray(parsed.invoices)) {
      return json2(JSON.stringify({ error: "Invalid data structure." }), 400);
    }
  } catch {
    return json2(JSON.stringify({ error: "Invalid JSON." }), 400);
  }
  await env.ADMIN_DATA.put(KV_KEY2, body);
  return json2(JSON.stringify({ ok: true }));
}
__name(onRequestPost2, "onRequestPost");

// functions/lib/bluefolder.js
var BlueFolderError = class extends Error {
  static {
    __name(this, "BlueFolderError");
  }
  constructor(message, { code, body } = {}) {
    super(message);
    this.name = "BlueFolderError";
    this.code = code;
    this.body = body;
  }
};
async function createLead(env, lead) {
  const baseUrl = (env.BLUEFOLDER_BASE_URL || "https://app.bluefolder.com/api/2.0").replace(/\/+$/, "");
  const token = env.BLUEFOLDER_API_TOKEN;
  if (!token) {
    throw new BlueFolderError("BLUEFOLDER_API_TOKEN missing from env");
  }
  const name = String(lead?.name || "").trim();
  const email = String(lead?.email || "").trim();
  if (!name || !isValidEmail(email)) {
    throw new BlueFolderError(`invalid lead payload: name='${name}' email='${email}'`);
  }
  const externalId = email.toLowerCase();
  const [firstName, lastName] = splitName(name);
  const ctx = { baseUrl, token };
  let customerId = await getCustomerIdByExternalId(ctx, externalId);
  const reused = customerId !== null;
  if (!reused) {
    customerId = await addCustomer(ctx, {
      externalId,
      customerName: name,
      customerType: "Web Lead",
      description: "Auto-created from wabashsystems.com contact form",
      firstName,
      lastName,
      email,
      phone: String(lead.phone || "")
    });
  }
  const business = String(lead.business || "").trim();
  const service = String(lead.service || "").trim();
  const shortDesc = truncate(
    `Web lead: ${name}${business ? " / " + business : ""}${service ? " \u2014 " + service : ""}`,
    100
  );
  const detailed = buildDetailedDescription(lead);
  const serviceRequestId = await addServiceRequest(ctx, {
    customerId,
    description: shortDesc,
    detailedDescription: detailed,
    priority: env.BLUEFOLDER_PRIORITY || "Low",
    status: "New",
    type: env.BLUEFOLDER_WO_TYPE || "Web Lead",
    sourceName: "wabashsystems.com web form",
    serviceManagerId: env.BLUEFOLDER_SERVICE_MANAGER_ID || ""
  });
  return { customerId, serviceRequestId, reused };
}
__name(createLead, "createLead");
async function getCustomerIdByExternalId(ctx, externalId) {
  const xml = `<request><externalId>${xmlEscape(externalId)}</externalId></request>`;
  const resp = await bfPost(
    ctx,
    "/customers/get.aspx",
    xml,
    /*treatFailAsNull*/
    true
  );
  if (resp === null) return null;
  return extractTag(resp, "customerId");
}
__name(getCustomerIdByExternalId, "getCustomerIdByExternalId");
async function addCustomer(ctx, c) {
  const customerFields = renderFields([
    ["customerName", c.customerName],
    ["customerType", c.customerType],
    ["description", c.description],
    ["externalId", c.externalId]
  ]);
  const contactFields = renderFields([
    ["firstName", c.firstName],
    ["lastName", c.lastName],
    ["email", c.email],
    ["phone", c.phone]
  ]);
  const xml = `<request><customerAdd>${customerFields}<primaryContact>${contactFields}</primaryContact></customerAdd></request>`;
  const resp = await bfPost(ctx, "/customers/add.aspx", xml);
  const id = extractTag(resp, "customerId");
  if (!id) {
    throw new BlueFolderError("customerAdd succeeded but returned no customerId", {
      body: resp.slice(0, 500)
    });
  }
  return id;
}
__name(addCustomer, "addCustomer");
async function addServiceRequest(ctx, sr) {
  if (!sr.customerId) {
    throw new BlueFolderError("customerId required for service request");
  }
  if (!sr.description) {
    throw new BlueFolderError("description required for service request");
  }
  const fields = renderFields([
    ["customerId", sr.customerId],
    ["description", sr.description],
    ["detailedDescription", sr.detailedDescription],
    ["priority", sr.priority],
    ["status", sr.status],
    ["type", sr.type],
    ["sourceName", sr.sourceName],
    ["serviceManagerId", sr.serviceManagerId]
  ]);
  const xml = `<request><serviceRequestAdd>${fields}</serviceRequestAdd></request>`;
  const resp = await bfPost(ctx, "/serviceRequests/add.aspx", xml);
  const id = extractTag(resp, "serviceRequestId");
  if (!id) {
    throw new BlueFolderError("serviceRequestAdd succeeded but returned no serviceRequestId", {
      body: resp.slice(0, 500)
    });
  }
  return id;
}
__name(addServiceRequest, "addServiceRequest");
async function bfPost(ctx, path, xmlBody, treatFailAsNull = false) {
  const url = ctx.baseUrl + path;
  const auth = "Basic " + btoa(`${ctx.token}:X`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12e3);
  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": auth,
        "Content-Type": "application/xml; charset=utf-8",
        "Accept": "application/xml"
      },
      body: xmlBody,
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new BlueFolderError(`BlueFolder request timed out at ${url}`);
    }
    throw new BlueFolderError(`fetch error to ${url}: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
  const text = await resp.text();
  if (resp.status === 429) {
    throw new BlueFolderError("BlueFolder rate-limited (429)", {
      code: 429,
      body: text.slice(0, 500)
    });
  }
  if (resp.status >= 500) {
    throw new BlueFolderError(`BlueFolder ${resp.status} at ${path}`, {
      code: resp.status,
      body: text.slice(0, 500)
    });
  }
  if (resp.status >= 400) {
    throw new BlueFolderError(`BlueFolder ${resp.status} at ${path}`, {
      code: resp.status,
      body: text.slice(0, 500)
    });
  }
  const status = extractRootStatus(text);
  if (status !== "ok") {
    if (treatFailAsNull) return null;
    const errCode = extractAttr(text, "code") || "?";
    const errMsg = extractTag(text, "error") || "unknown";
    throw new BlueFolderError(
      `BlueFolder error at ${path}: code=${errCode} msg=${errMsg}`,
      { code: errCode, body: text.slice(0, 500) }
    );
  }
  return text;
}
__name(bfPost, "bfPost");
function xmlEscape(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
__name(xmlEscape, "xmlEscape");
function renderFields(pairs) {
  let out = "";
  for (const [k, v] of pairs) {
    if (v === "" || v === null || v === void 0) continue;
    out += `<${k}>${xmlEscape(v)}</${k}>`;
  }
  return out;
}
__name(renderFields, "renderFields");
function extractTag(xmlText, tagName) {
  const re = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const m = xmlText.match(re);
  return m ? m[1].trim() : null;
}
__name(extractTag, "extractTag");
function extractAttr(xmlText, attrName) {
  const re = new RegExp(`${attrName}\\s*=\\s*"([^"]*)"`, "i");
  const m = xmlText.match(re);
  return m ? m[1] : null;
}
__name(extractAttr, "extractAttr");
function extractRootStatus(xmlText) {
  const m = xmlText.match(/<[a-zA-Z][^>]*\bstatus\s*=\s*"([^"]*)"[^>]*>/);
  return m ? m[1] : null;
}
__name(extractRootStatus, "extractRootStatus");
function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
__name(isValidEmail, "isValidEmail");
function splitName(full) {
  const cleaned = full.replace(/\s+/g, " ").trim();
  if (!cleaned) return ["Unknown", "Lead"];
  const parts = cleaned.split(" ");
  if (parts.length === 1) {
    return [parts[0], parts[0]];
  }
  return [parts[0], parts.slice(1).join(" ")];
}
__name(splitName, "splitName");
function truncate(s, max) {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "\u2026";
}
__name(truncate, "truncate");
function buildDetailedDescription(lead) {
  const lines = [];
  lines.push("New web lead via wabashsystems.com");
  lines.push(`Submitted: ${(/* @__PURE__ */ new Date()).toISOString()}`);
  lines.push("");
  lines.push(`Name:     ${lead.name || ""}`);
  lines.push(`Email:    ${lead.email || ""}`);
  if (lead.phone) lines.push(`Phone:    ${lead.phone}`);
  if (lead.business) lines.push(`Business: ${lead.business}`);
  if (lead.service) lines.push(`Service:  ${lead.service}`);
  if (lead.message) {
    lines.push("");
    lines.push("Message:");
    lines.push(String(lead.message));
  }
  if (lead.emailOptIn !== void 0 || lead.smsOptIn !== void 0) {
    lines.push("");
    lines.push(`Email opt-in: ${lead.emailOptIn ? "Yes" : "No"}`);
    lines.push(`SMS opt-in:   ${lead.smsOptIn ? "Yes" : "No"}`);
  }
  return lines.join("\n");
}
__name(buildDetailedDescription, "buildDetailedDescription");

// functions/api/contact.js
async function onRequestPost3(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { fname, lname, email, phone, business, service, message, emailOptIn, smsOptIn } = body;
    if (!fname || !email || !message) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Wabash Systems <info@wabashsystems.com>",
        to: ["agray@wabashsystems.com"],
        reply_to: email,
        subject: `New inquiry from ${fname} ${lname}${business ? " \u2014 " + business : ""}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${fname} ${lname}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
          <p><strong>Business:</strong> ${business || "Not provided"}</p>
          <p><strong>Service:</strong> ${service || "Not specified"}</p>
          <p><strong>Message:</strong></p><p>${message}</p>
          <hr/>
          <p><small>Email opt-in: ${emailOptIn ? "Yes" : "No"} &nbsp;|&nbsp; SMS opt-in: ${smsOptIn ? "Yes" : "No"}</small></p>
        `
      })
    });
    if (!emailRes.ok) {
      const errText = await emailRes.text();
      return new Response(JSON.stringify({ success: false, error: "Failed to send email.", detail: errText }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    const profileProps = {
      data: {
        type: "profile",
        attributes: {
          email,
          first_name: fname,
          last_name: lname || "",
          properties: {
            business_name: business || "",
            service_interest: service || "",
            inquiry_message: message,
            lead_source: "Website Contact Form"
          }
        }
      }
    };
    if (smsOptIn && phone) {
      const digits = phone.replace(/\D/g, "");
      profileProps.data.attributes.phone_number = digits.length === 10 ? `+1${digits}` : `+${digits}`;
    }
    const profileRes = await fetch("https://a.klaviyo.com/api/profiles/", {
      method: "POST",
      headers: {
        "Authorization": `Klaviyo-API-Key ${env.KLAVIYO_PRIVATE_KEY}`,
        "Content-Type": "application/json",
        "revision": "2024-02-15",
        "Accept": "application/json"
      },
      body: JSON.stringify(profileProps)
    });
    let profileId = null;
    if (profileRes.ok) {
      const profileData = await profileRes.json();
      profileId = profileData?.data?.id;
    } else if (profileRes.status === 409) {
      const conflictData = await profileRes.json();
      profileId = conflictData?.errors?.[0]?.meta?.duplicate_profile_id;
    }
    if (emailOptIn && profileId) {
      await fetch(`https://a.klaviyo.com/api/lists/${env.KLAVIYO_LIST_ID}/relationships/profiles/`, {
        method: "POST",
        headers: {
          "Authorization": `Klaviyo-API-Key ${env.KLAVIYO_PRIVATE_KEY}`,
          "Content-Type": "application/json",
          "revision": "2024-02-15"
        },
        body: JSON.stringify({
          data: [{ type: "profile", id: profileId }]
        })
      });
    }
    if (smsOptIn && phone && profileId) {
      await fetch("https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/", {
        method: "POST",
        headers: {
          "Authorization": `Klaviyo-API-Key ${env.KLAVIYO_PRIVATE_KEY}`,
          "Content-Type": "application/json",
          "revision": "2024-02-15"
        },
        body: JSON.stringify({
          data: {
            type: "profile-subscription-bulk-create-job",
            attributes: {
              profiles: {
                data: [{
                  type: "profile",
                  id: profileId,
                  attributes: {
                    subscriptions: {
                      sms: {
                        marketing: {
                          consent: "SUBSCRIBED"
                        }
                      }
                    }
                  }
                }]
              },
              historical_import: false
            },
            relationships: {
              list: {
                data: { type: "list", id: env.KLAVIYO_LIST_ID }
              }
            }
          }
        })
      });
    }
    if (env.BLUEFOLDER_API_TOKEN) {
      try {
        await createLead(env, {
          name: `${fname || ""} ${lname || ""}`.trim() || (email || ""),
          email,
          phone,
          business,
          service,
          message,
          emailOptIn,
          smsOptIn
        });
      } catch (bfErr) {
        console.error("[bluefolder] lead push failed:", bfErr?.message || bfErr);
      }
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: "Server error.", detail: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(onRequestPost3, "onRequestPost");

// lib/bluefolder.js
var BlueFolderError2 = class extends Error {
  static {
    __name(this, "BlueFolderError");
  }
  constructor(message, { code, body } = {}) {
    super(message);
    this.name = "BlueFolderError";
    this.code = code;
    this.body = body;
  }
};
async function createLead2(env, lead) {
  const baseUrl = (env.BLUEFOLDER_BASE_URL || "https://app.bluefolder.com/api/2.0").replace(/\/+$/, "");
  const token = env.BLUEFOLDER_API_TOKEN;
  if (!token) {
    throw new BlueFolderError2("BLUEFOLDER_API_TOKEN missing from env");
  }
  const name = String(lead?.name || "").trim();
  const email = String(lead?.email || "").trim();
  if (!name || !isValidEmail2(email)) {
    throw new BlueFolderError2(`invalid lead payload: name='${name}' email='${email}'`);
  }
  const externalId = email.toLowerCase();
  const [firstName, lastName] = splitName2(name);
  const ctx = { baseUrl, token };
  let customerId = await getCustomerIdByExternalId2(ctx, externalId);
  const reused = customerId !== null;
  if (!reused) {
    customerId = await addCustomer2(ctx, {
      externalId,
      customerName: name,
      customerType: "Web Lead",
      description: "Auto-created from wabashsystems.com contact form",
      firstName,
      lastName,
      email,
      phone: String(lead.phone || "")
    });
  }
  const business = String(lead.business || "").trim();
  const service = String(lead.service || "").trim();
  const shortDesc = truncate2(
    `Web lead: ${name}${business ? " / " + business : ""}${service ? " \u2014 " + service : ""}`,
    100
  );
  const detailed = buildDetailedDescription2(lead);
  const serviceRequestId = await addServiceRequest2(ctx, {
    customerId,
    description: shortDesc,
    detailedDescription: detailed,
    priority: env.BLUEFOLDER_PRIORITY || "Low",
    status: "New",
    type: env.BLUEFOLDER_WO_TYPE || "Web Lead",
    sourceName: "wabashsystems.com web form",
    serviceManagerId: env.BLUEFOLDER_SERVICE_MANAGER_ID || ""
  });
  return { customerId, serviceRequestId, reused };
}
__name(createLead2, "createLead");
async function getCustomerIdByExternalId2(ctx, externalId) {
  const xml = `<request><externalId>${xmlEscape2(externalId)}</externalId></request>`;
  const resp = await bfPost2(
    ctx,
    "/customers/get.aspx",
    xml,
    /*treatFailAsNull*/
    true
  );
  if (resp === null) return null;
  return extractTag2(resp, "customerId");
}
__name(getCustomerIdByExternalId2, "getCustomerIdByExternalId");
async function addCustomer2(ctx, c) {
  const customerFields = renderFields2([
    ["customerName", c.customerName],
    ["customerType", c.customerType],
    ["description", c.description],
    ["externalId", c.externalId]
  ]);
  const contactFields = renderFields2([
    ["firstName", c.firstName],
    ["lastName", c.lastName],
    ["email", c.email],
    ["phone", c.phone]
  ]);
  const xml = `<request><customerAdd>${customerFields}<primaryContact>${contactFields}</primaryContact></customerAdd></request>`;
  const resp = await bfPost2(ctx, "/customers/add.aspx", xml);
  const id = extractTag2(resp, "customerId");
  if (!id) {
    throw new BlueFolderError2("customerAdd succeeded but returned no customerId", {
      body: resp.slice(0, 500)
    });
  }
  return id;
}
__name(addCustomer2, "addCustomer");
async function addServiceRequest2(ctx, sr) {
  if (!sr.customerId) {
    throw new BlueFolderError2("customerId required for service request");
  }
  if (!sr.description) {
    throw new BlueFolderError2("description required for service request");
  }
  const fields = renderFields2([
    ["customerId", sr.customerId],
    ["description", sr.description],
    ["detailedDescription", sr.detailedDescription],
    ["priority", sr.priority],
    ["status", sr.status],
    ["type", sr.type],
    ["sourceName", sr.sourceName],
    ["serviceManagerId", sr.serviceManagerId]
  ]);
  const xml = `<request><serviceRequestAdd>${fields}</serviceRequestAdd></request>`;
  const resp = await bfPost2(ctx, "/serviceRequests/add.aspx", xml);
  const id = extractTag2(resp, "serviceRequestId");
  if (!id) {
    throw new BlueFolderError2("serviceRequestAdd succeeded but returned no serviceRequestId", {
      body: resp.slice(0, 500)
    });
  }
  return id;
}
__name(addServiceRequest2, "addServiceRequest");
async function bfPost2(ctx, path, xmlBody, treatFailAsNull = false) {
  const url = ctx.baseUrl + path;
  const auth = "Basic " + btoa(`${ctx.token}:X`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12e3);
  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": auth,
        "Content-Type": "application/xml; charset=utf-8",
        "Accept": "application/xml"
      },
      body: xmlBody,
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new BlueFolderError2(`BlueFolder request timed out at ${url}`);
    }
    throw new BlueFolderError2(`fetch error to ${url}: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
  const text = await resp.text();
  if (resp.status === 429) {
    throw new BlueFolderError2("BlueFolder rate-limited (429)", {
      code: 429,
      body: text.slice(0, 500)
    });
  }
  if (resp.status >= 500) {
    throw new BlueFolderError2(`BlueFolder ${resp.status} at ${path}`, {
      code: resp.status,
      body: text.slice(0, 500)
    });
  }
  if (resp.status >= 400) {
    throw new BlueFolderError2(`BlueFolder ${resp.status} at ${path}`, {
      code: resp.status,
      body: text.slice(0, 500)
    });
  }
  const status = extractRootStatus2(text);
  if (status !== "ok") {
    if (treatFailAsNull) return null;
    const errCode = extractAttr2(text, "code") || "?";
    const errMsg = extractTag2(text, "error") || "unknown";
    throw new BlueFolderError2(
      `BlueFolder error at ${path}: code=${errCode} msg=${errMsg}`,
      { code: errCode, body: text.slice(0, 500) }
    );
  }
  return text;
}
__name(bfPost2, "bfPost");
function xmlEscape2(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
__name(xmlEscape2, "xmlEscape");
function renderFields2(pairs) {
  let out = "";
  for (const [k, v] of pairs) {
    if (v === "" || v === null || v === void 0) continue;
    out += `<${k}>${xmlEscape2(v)}</${k}>`;
  }
  return out;
}
__name(renderFields2, "renderFields");
function extractTag2(xmlText, tagName) {
  const re = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const m = xmlText.match(re);
  return m ? m[1].trim() : null;
}
__name(extractTag2, "extractTag");
function extractAttr2(xmlText, attrName) {
  const re = new RegExp(`${attrName}\\s*=\\s*"([^"]*)"`, "i");
  const m = xmlText.match(re);
  return m ? m[1] : null;
}
__name(extractAttr2, "extractAttr");
function extractRootStatus2(xmlText) {
  const m = xmlText.match(/<[a-zA-Z][^>]*\bstatus\s*=\s*"([^"]*)"[^>]*>/);
  return m ? m[1] : null;
}
__name(extractRootStatus2, "extractRootStatus");
function isValidEmail2(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
__name(isValidEmail2, "isValidEmail");
function splitName2(full) {
  const cleaned = full.replace(/\s+/g, " ").trim();
  if (!cleaned) return ["Unknown", "Lead"];
  const parts = cleaned.split(" ");
  if (parts.length === 1) {
    return [parts[0], parts[0]];
  }
  return [parts[0], parts.slice(1).join(" ")];
}
__name(splitName2, "splitName");
function truncate2(s, max) {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "\u2026";
}
__name(truncate2, "truncate");
function buildDetailedDescription2(lead) {
  const lines = [];
  lines.push("New web lead via wabashsystems.com");
  lines.push(`Submitted: ${(/* @__PURE__ */ new Date()).toISOString()}`);
  lines.push("");
  lines.push(`Name:     ${lead.name || ""}`);
  lines.push(`Email:    ${lead.email || ""}`);
  if (lead.phone) lines.push(`Phone:    ${lead.phone}`);
  if (lead.business) lines.push(`Business: ${lead.business}`);
  if (lead.service) lines.push(`Service:  ${lead.service}`);
  if (lead.message) {
    lines.push("");
    lines.push("Message:");
    lines.push(String(lead.message));
  }
  if (lead.emailOptIn !== void 0 || lead.smsOptIn !== void 0) {
    lines.push("");
    lines.push(`Email opt-in: ${lead.emailOptIn ? "Yes" : "No"}`);
    lines.push(`SMS opt-in:   ${lead.smsOptIn ? "Yes" : "No"}`);
  }
  return lines.join("\n");
}
__name(buildDetailedDescription2, "buildDetailedDescription");

// api/contact.js
async function onRequestPost4(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { fname, lname, email, phone, business, service, message, emailOptIn, smsOptIn } = body;
    if (!fname || !email || !message) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Wabash Systems <info@wabashsystems.com>",
        to: ["agray@wabashsystems.com"],
        reply_to: email,
        subject: `New inquiry from ${fname} ${lname}${business ? " \u2014 " + business : ""}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${fname} ${lname}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
          <p><strong>Business:</strong> ${business || "Not provided"}</p>
          <p><strong>Service:</strong> ${service || "Not specified"}</p>
          <p><strong>Message:</strong></p><p>${message}</p>
          <hr/>
          <p><small>Email opt-in: ${emailOptIn ? "Yes" : "No"} &nbsp;|&nbsp; SMS opt-in: ${smsOptIn ? "Yes" : "No"}</small></p>
        `
      })
    });
    if (!emailRes.ok) {
      const errText = await emailRes.text();
      return new Response(JSON.stringify({ success: false, error: "Failed to send email.", detail: errText }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    const profileProps = {
      data: {
        type: "profile",
        attributes: {
          email,
          first_name: fname,
          last_name: lname || "",
          properties: {
            business_name: business || "",
            service_interest: service || "",
            inquiry_message: message,
            lead_source: "Website Contact Form"
          }
        }
      }
    };
    if (smsOptIn && phone) {
      const digits = phone.replace(/\D/g, "");
      profileProps.data.attributes.phone_number = digits.length === 10 ? `+1${digits}` : `+${digits}`;
    }
    const profileRes = await fetch("https://a.klaviyo.com/api/profiles/", {
      method: "POST",
      headers: {
        "Authorization": `Klaviyo-API-Key ${env.KLAVIYO_PRIVATE_KEY}`,
        "Content-Type": "application/json",
        "revision": "2024-02-15",
        "Accept": "application/json"
      },
      body: JSON.stringify(profileProps)
    });
    let profileId = null;
    if (profileRes.ok) {
      const profileData = await profileRes.json();
      profileId = profileData?.data?.id;
    } else if (profileRes.status === 409) {
      const conflictData = await profileRes.json();
      profileId = conflictData?.errors?.[0]?.meta?.duplicate_profile_id;
    }
    if (emailOptIn && profileId) {
      await fetch(`https://a.klaviyo.com/api/lists/${env.KLAVIYO_LIST_ID}/relationships/profiles/`, {
        method: "POST",
        headers: {
          "Authorization": `Klaviyo-API-Key ${env.KLAVIYO_PRIVATE_KEY}`,
          "Content-Type": "application/json",
          "revision": "2024-02-15"
        },
        body: JSON.stringify({
          data: [{ type: "profile", id: profileId }]
        })
      });
    }
    if (smsOptIn && phone && profileId) {
      await fetch("https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/", {
        method: "POST",
        headers: {
          "Authorization": `Klaviyo-API-Key ${env.KLAVIYO_PRIVATE_KEY}`,
          "Content-Type": "application/json",
          "revision": "2024-02-15"
        },
        body: JSON.stringify({
          data: {
            type: "profile-subscription-bulk-create-job",
            attributes: {
              profiles: {
                data: [{
                  type: "profile",
                  id: profileId,
                  attributes: {
                    subscriptions: {
                      sms: {
                        marketing: {
                          consent: "SUBSCRIBED"
                        }
                      }
                    }
                  }
                }]
              },
              historical_import: false
            },
            relationships: {
              list: {
                data: { type: "list", id: env.KLAVIYO_LIST_ID }
              }
            }
          }
        })
      });
    }
    if (env.BLUEFOLDER_API_TOKEN) {
      try {
        await createLead2(env, {
          name: `${fname || ""} ${lname || ""}`.trim() || (email || ""),
          email,
          phone,
          business,
          service,
          message,
          emailOptIn,
          smsOptIn
        });
      } catch (bfErr) {
        console.error("[bluefolder] lead push failed:", bfErr?.message || bfErr);
      }
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: "Server error.", detail: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(onRequestPost4, "onRequestPost");

// api/lead-magnet.js
var KLAVIYO_API = "https://a.klaviyo.com/api";
var KLAVIYO_REVISION = "2024-10-15";
var json3 = /* @__PURE__ */ __name((body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  }
}), "json");
var isValidEmail3 = /* @__PURE__ */ __name((e) => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e), "isValidEmail");
var isValidE164 = /* @__PURE__ */ __name((p) => typeof p === "string" && /^\+[1-9]\d{7,14}$/.test(p), "isValidE164");
async function klaviyoFetch(apiKey, path, payload, method = "POST") {
  const opts = {
    method,
    headers: {
      "Authorization": `Klaviyo-API-Key ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "revision": KLAVIYO_REVISION
    }
  };
  if (payload !== void 0) opts.body = JSON.stringify(payload);
  const res = await fetch(`${KLAVIYO_API}${path}`, opts);
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
    }
  }
  return {
    ok: res.status >= 200 && res.status < 300,
    status: res.status,
    body,
    rawText: text
  };
}
__name(klaviyoFetch, "klaviyoFetch");
async function addToList(apiKey, listId, profileId) {
  return klaviyoFetch(
    apiKey,
    `/lists/${listId}/relationships/profiles/`,
    { data: [{ type: "profile", id: profileId }] }
  );
}
__name(addToList, "addToList");
async function onRequestPost5(context) {
  const { request, env } = context;
  const apiKey = env.KLAVIYO_PRIVATE_KEY;
  const emailListId = env.KLAVIYO_LIST_ID;
  const smsListId = env.KLAVIYO_SMS_LIST_ID || null;
  if (!apiKey || !emailListId) {
    console.error("lead-magnet: missing KLAVIYO_PRIVATE_KEY or KLAVIYO_LIST_ID");
    return json3({ error: "Service not configured." }, 503);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json3({ error: "Invalid JSON body." }, 400);
  }
  const email = (body.email || "").trim().toLowerCase();
  const rawPhone = (body.phone || "").trim();
  const smsOptIn = !!body.sms_opt_in;
  const source = (body.source || "unknown").toString().slice(0, 80);
  if (!isValidEmail3(email)) {
    return json3({ error: "Please enter a valid email address." }, 400);
  }
  let phone = "";
  if (smsOptIn) {
    if (!isValidE164(rawPhone)) {
      return json3({
        error: "Please enter a valid mobile number, or uncheck the text option."
      }, 400);
    }
    phone = rawPhone;
  }
  const profileAttrs = {
    email,
    properties: {
      lead_source: source,
      lead_magnet: "10-point-audit-checklist",
      signup_url: new URL(request.url).origin
    },
    subscriptions: {
      email: { marketing: { consent: "SUBSCRIBED" } }
    }
  };
  if (smsOptIn && phone) {
    profileAttrs.phone_number = phone;
    profileAttrs.subscriptions.sms = {
      marketing: { consent: "SUBSCRIBED" },
      transactional: { consent: "SUBSCRIBED" }
    };
  }
  let profileId = null;
  const createRes = await klaviyoFetch(apiKey, "/profiles/", {
    data: { type: "profile", attributes: profileAttrs }
  });
  if (createRes.ok) {
    profileId = createRes.body && createRes.body.data && createRes.body.data.id;
  } else if (createRes.status === 409) {
    const err = createRes.body && createRes.body.errors && createRes.body.errors[0];
    profileId = err && err.meta && err.meta.duplicate_profile_id;
  } else {
    console.error("lead-magnet: profile create failed", createRes.status, createRes.rawText);
    return json3({
      error: "Could not save your email.",
      detail: createRes.rawText,
      step: "profile-create"
    }, 502);
  }
  if (!profileId) {
    console.error("lead-magnet: profile id missing from response", createRes.status, createRes.rawText);
    return json3({
      error: "Could not save your email.",
      detail: "Profile created but ID not returned by Klaviyo.",
      step: "profile-id",
      response: createRes.body
    }, 502);
  }
  const emailAddRes = await addToList(apiKey, emailListId, profileId);
  if (!emailAddRes.ok) {
    console.error("lead-magnet: email list add failed", emailAddRes.status, emailAddRes.rawText);
    return json3({
      error: "Profile saved but could not add to email list.",
      detail: emailAddRes.rawText,
      step: "email-list-add",
      profile_id: profileId
    }, 502);
  }
  if (smsOptIn && smsListId) {
    const smsAddRes = await addToList(apiKey, smsListId, profileId);
    if (!smsAddRes.ok) {
      console.error("lead-magnet: SMS list add failed (soft-fail)", smsAddRes.status, smsAddRes.rawText);
      return json3({
        ok: true,
        download: "/lead-magnets/ecommerce-audit-checklist.pdf",
        message: "Email saved! SMS opt-in failed - retry from email link."
      });
    }
  }
  return json3({
    ok: true,
    download: "/lead-magnets/ecommerce-audit-checklist.pdf",
    message: "Got it! Check your inbox."
  });
}
__name(onRequestPost5, "onRequestPost");
async function onRequest({ request }) {
  if (request.method === "POST") return;
  return json3({ error: "Method not allowed." }, 405);
}
__name(onRequest, "onRequest");

// api/newsletter-signup.js
var KLAVIYO_API2 = "https://a.klaviyo.com/api";
var KLAVIYO_REVISION2 = "2024-10-15";
var json4 = /* @__PURE__ */ __name((body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  }
}), "json");
var isValidEmail4 = /* @__PURE__ */ __name((e) => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e), "isValidEmail");
async function klaviyoFetch2(apiKey, path, payload, method = "POST") {
  const opts = {
    method,
    headers: {
      "Authorization": `Klaviyo-API-Key ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "revision": KLAVIYO_REVISION2
    }
  };
  if (payload !== void 0) opts.body = JSON.stringify(payload);
  const res = await fetch(`${KLAVIYO_API2}${path}`, opts);
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
    }
  }
  return {
    ok: res.status >= 200 && res.status < 300,
    status: res.status,
    body,
    rawText: text
  };
}
__name(klaviyoFetch2, "klaviyoFetch");
async function onRequestPost6(context) {
  try {
    return await handleRequest(context);
  } catch (err) {
    console.error("newsletter-signup: unhandled exception", err && err.stack ? err.stack : err);
    return json4({
      error: "Internal server error.",
      detail: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack : null,
      step: "unhandled"
    }, 502);
  }
}
__name(onRequestPost6, "onRequestPost");
async function handleRequest(context) {
  const { request, env } = context;
  const apiKey = env.KLAVIYO_PRIVATE_KEY;
  const listId = env.KLAVIYO_LIST_ID;
  if (!apiKey || !listId) {
    console.error("newsletter-signup: missing KLAVIYO_PRIVATE_KEY or KLAVIYO_LIST_ID");
    return json4({ error: "Service not configured." }, 503);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json4({ error: "Invalid JSON body." }, 400);
  }
  const email = (body.email || "").trim().toLowerCase();
  const source = (body.source || "footer-newsletter").toString().slice(0, 80);
  if (!isValidEmail4(email)) {
    return json4({ error: "Please enter a valid email address." }, 400);
  }
  const profilePayload = {
    data: {
      type: "profile",
      attributes: {
        email,
        properties: {
          lead_source: source,
          signup_url: new URL(request.url).origin
        },
        subscriptions: {
          email: { marketing: { consent: "SUBSCRIBED" } }
        }
      }
    }
  };
  let profileId = null;
  let createRes;
  try {
    createRes = await klaviyoFetch2(apiKey, "/profiles/", profilePayload);
  } catch (err) {
    return json4({
      error: "Could not reach Klaviyo for profile creation.",
      detail: err && err.message ? err.message : String(err),
      step: "profile-fetch"
    }, 502);
  }
  if (createRes.ok) {
    profileId = createRes.body && createRes.body.data && createRes.body.data.id;
  } else if (createRes.status === 409) {
    const err = createRes.body && createRes.body.errors && createRes.body.errors[0];
    profileId = err && err.meta && err.meta.duplicate_profile_id;
  } else {
    return json4({
      error: "Could not save your email.",
      detail: createRes.rawText,
      step: "profile-create",
      status: createRes.status
    }, 502);
  }
  if (!profileId) {
    return json4({
      error: "Could not save your email.",
      detail: "Profile created but ID not returned by Klaviyo.",
      step: "profile-id",
      response: createRes.body,
      raw: createRes.rawText
    }, 502);
  }
  let addRes;
  try {
    addRes = await klaviyoFetch2(
      apiKey,
      `/lists/${listId}/relationships/profiles/`,
      { data: [{ type: "profile", id: profileId }] }
    );
  } catch (err) {
    return json4({
      error: "Could not reach Klaviyo for list add.",
      detail: err && err.message ? err.message : String(err),
      step: "list-fetch",
      profile_id: profileId
    }, 502);
  }
  if (!addRes.ok) {
    return json4({
      error: "Profile saved but could not add to list.",
      detail: addRes.rawText,
      step: "list-add",
      status: addRes.status,
      profile_id: profileId
    }, 502);
  }
  return json4({ ok: true, message: "Subscribed!" });
}
__name(handleRequest, "handleRequest");
async function onRequest2({ request }) {
  if (request.method === "POST") return;
  return json4({ error: "Method not allowed." }, 405);
}
__name(onRequest2, "onRequest");

// functions/admin/_middleware.js
async function onRequest3(context) {
  const { request, env, next } = context;
  const expectedPassword = env.ADMIN_PASSWORD;
  if (!expectedPassword) {
    return new Response("Admin not configured.", { status: 503 });
  }
  const auth = request.headers.get("Authorization") || "";
  if (auth.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const colon = decoded.indexOf(":");
      const pass = colon >= 0 ? decoded.slice(colon + 1) : "";
      if (pass === expectedPassword) {
        return next();
      }
    } catch {
    }
  }
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Wabash Systems Admin", charset="UTF-8"',
      "Content-Type": "text/plain"
    }
  });
}
__name(onRequest3, "onRequest");

// admin/_middleware.js
async function onRequest4(context) {
  const { request, env, next } = context;
  const expectedPassword = env.ADMIN_PASSWORD;
  if (!expectedPassword) {
    return new Response("Admin not configured.", { status: 503 });
  }
  const auth = request.headers.get("Authorization") || "";
  if (auth.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const colon = decoded.indexOf(":");
      const pass = colon >= 0 ? decoded.slice(colon + 1) : "";
      if (pass === expectedPassword) {
        return next();
      }
    } catch {
    }
  }
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Wabash Systems Admin", charset="UTF-8"',
      "Content-Type": "text/plain"
    }
  });
}
__name(onRequest4, "onRequest");

// ../.wrangler/tmp/pages-GB4VYL/functionsRoutes-0.26891391302865264.mjs
var routes = [
  {
    routePath: "/functions/admin/api/data",
    mountPath: "/functions/admin/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/functions/admin/api/data",
    mountPath: "/functions/admin/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/admin/api/data",
    mountPath: "/admin/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/admin/api/data",
    mountPath: "/admin/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/functions/api/contact",
    mountPath: "/functions/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/contact",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/lead-magnet",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/api/newsletter-signup",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost6]
  },
  {
    routePath: "/api/lead-magnet",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/newsletter-signup",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/functions/admin",
    mountPath: "/functions/admin",
    method: "",
    middlewares: [onRequest3],
    modules: []
  },
  {
    routePath: "/admin",
    mountPath: "/admin",
    method: "",
    middlewares: [onRequest4],
    modules: []
  }
];

// ../../AppData/Roaming/npm/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../AppData/Roaming/npm/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
