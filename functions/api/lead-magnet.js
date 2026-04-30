// functions/api/lead-magnet.js
//
// POST /api/lead-magnet
// Captures email (and optional phone for SMS) from the homepage
// exit-intent modal and sticky bar.
//
// Same synchronous flow as newsletter-signup:
//   1. POST /profiles/ - create profile with email, properties, consent.
//      Returns 201 with id, or 409 with duplicate_profile_id in error meta.
//   2. POST /lists/{email_list_id}/relationships/profiles/ - add to email list.
//   3. If SMS opt-in: POST /lists/{sms_list_id}/relationships/profiles/.
//
// Bindings:
//   KLAVIYO_PRIVATE_KEY  (Secret)
//   KLAVIYO_LIST_ID      (Plaintext) - email list
//   KLAVIYO_SMS_LIST_ID  (Plaintext, optional) - SMS list

const KLAVIYO_API      = 'https://a.klaviyo.com/api';
const KLAVIYO_REVISION = '2024-10-15';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

const isValidEmail = (e) =>
  typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const isValidE164 = (p) =>
  typeof p === 'string' && /^\+[1-9]\d{7,14}$/.test(p);

async function klaviyoFetch(apiKey, path, payload, method = 'POST') {
  const opts = {
    method,
    headers: {
      'Authorization': `Klaviyo-API-Key ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept':       'application/json',
      'revision':     KLAVIYO_REVISION,
    },
  };
  if (payload !== undefined) opts.body = JSON.stringify(payload);

  const res = await fetch(`${KLAVIYO_API}${path}`, opts);
  const text = await res.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { /* leave null on non-JSON */ }
  }
  return {
    ok:      res.status >= 200 && res.status < 300,
    status:  res.status,
    body,
    rawText: text,
  };
}

async function addToList(apiKey, listId, profileId) {
  return klaviyoFetch(
    apiKey,
    `/lists/${listId}/relationships/profiles/`,
    { data: [{ type: 'profile', id: profileId }] }
  );
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const apiKey      = env.KLAVIYO_PRIVATE_KEY;
  const emailListId = env.KLAVIYO_LIST_ID;
  const smsListId   = env.KLAVIYO_SMS_LIST_ID || null;

  if (!apiKey || !emailListId) {
    console.error('lead-magnet: missing KLAVIYO_PRIVATE_KEY or KLAVIYO_LIST_ID');
    return json({ error: 'Service not configured.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const email    = (body.email    || '').trim().toLowerCase();
  const rawPhone = (body.phone    || '').trim();
  const smsOptIn = !!body.sms_opt_in;
  const source   = (body.source   || 'unknown').toString().slice(0, 80);

  if (!isValidEmail(email)) {
    return json({ error: 'Please enter a valid email address.' }, 400);
  }

  let phone = '';
  if (smsOptIn) {
    if (!isValidE164(rawPhone)) {
      return json({
        error: 'Please enter a valid mobile number, or uncheck the text option.'
      }, 400);
    }
    phone = rawPhone;
  }

  // ── Step 1: create profile, get id ──────────────────────────────────────
  const profileAttrs = {
    email,
    properties: {
      lead_source:  source,
      lead_magnet:  '10-point-audit-checklist',
      signup_url:   new URL(request.url).origin,
    },
    subscriptions: {
      email: { marketing: { consent: 'SUBSCRIBED' } },
    },
  };
  if (smsOptIn && phone) {
    profileAttrs.phone_number = phone;
    profileAttrs.subscriptions.sms = {
      marketing:     { consent: 'SUBSCRIBED' },
      transactional: { consent: 'SUBSCRIBED' },
    };
  }

  let profileId = null;
  const createRes = await klaviyoFetch(apiKey, '/profiles/', {
    data: { type: 'profile', attributes: profileAttrs },
  });

  if (createRes.ok) {
    profileId = createRes.body && createRes.body.data && createRes.body.data.id;
  } else if (createRes.status === 409) {
    const err = createRes.body && createRes.body.errors && createRes.body.errors[0];
    profileId = err && err.meta && err.meta.duplicate_profile_id;
  } else {
    console.error('lead-magnet: profile create failed', createRes.status, createRes.rawText);
    return json({
      error:  'Could not save your email.',
      detail: createRes.rawText,
      step:   'profile-create',
    }, 502);
  }

  if (!profileId) {
    console.error('lead-magnet: profile id missing from response', createRes.status, createRes.rawText);
    return json({
      error:  'Could not save your email.',
      detail: 'Profile created but ID not returned by Klaviyo.',
      step:   'profile-id',
      response: createRes.body,
    }, 502);
  }

  // ── Step 2: add profile to email list ──────────────────────────────────
  const emailAddRes = await addToList(apiKey, emailListId, profileId);
  if (!emailAddRes.ok) {
    console.error('lead-magnet: email list add failed', emailAddRes.status, emailAddRes.rawText);
    return json({
      error:      'Profile saved but could not add to email list.',
      detail:     emailAddRes.rawText,
      step:       'email-list-add',
      profile_id: profileId,
    }, 502);
  }

  // ── Step 3: add to SMS list (only if opted in and configured) ──────────
  if (smsOptIn && smsListId) {
    const smsAddRes = await addToList(apiKey, smsListId, profileId);
    if (!smsAddRes.ok) {
      // SMS failure is soft - email is already captured, return success
      // with a warning so the user still gets the PDF.
      console.error('lead-magnet: SMS list add failed (soft-fail)', smsAddRes.status, smsAddRes.rawText);
      return json({
        ok:       true,
        download: '/lead-magnets/ecommerce-audit-checklist.pdf',
        message:  'Email saved! SMS opt-in failed - retry from email link.',
      });
    }
  }

  return json({
    ok:       true,
    download: '/lead-magnets/ecommerce-audit-checklist.pdf',
    message:  'Got it! Check your inbox.',
  });
}

export async function onRequest({ request }) {
  if (request.method === 'POST') return;
  return json({ error: 'Method not allowed.' }, 405);
}
