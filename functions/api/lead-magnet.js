// functions/api/lead-magnet.js
//
// POST /api/lead-magnet
// Captures email (and optional phone for SMS) from the homepage
// exit-intent modal and sticky bar. Subscribes the profile to the
// email list, and to the SMS list if SMS opt-in is set.
//
// Two-step Klaviyo flow:
//   1. Upsert the profile (POST /profiles/) with custom properties
//      and the phone number if SMS opt-in is set.
//   2. Subscribe the profile to the email list, and separately to the
//      SMS list when applicable, via POST /profile-subscription-bulk-create-jobs/.
//
// Bindings expected:
//   KLAVIYO_PRIVATE_KEY  (Secret)
//   KLAVIYO_LIST_ID      (Plaintext, in wrangler.toml) - email list
//   KLAVIYO_SMS_LIST_ID  (Plaintext, in wrangler.toml, optional) - SMS list
//
// Body shape:
//   {
//     email:      string (required),
//     phone:      string (optional, E.164 like "+15555551234"),
//     sms_opt_in: boolean (optional),
//     source:     string (optional)
//   }

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

async function klaviyoFetch(apiKey, path, payload) {
  const res = await fetch(`${KLAVIYO_API}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Klaviyo-API-Key ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept':       'application/json',
      'revision':     KLAVIYO_REVISION,
    },
    body: JSON.stringify(payload),
  });
  if (res.status >= 200 && res.status < 300) {
    return { ok: true, status: res.status };
  }
  const text = await res.text();
  return { ok: false, status: res.status, detail: text };
}

function subscribePayload(listId, email, phone, smsOptIn) {
  const subscriptions = {
    email: { marketing: { consent: 'SUBSCRIBED' } },
  };
  const profileAttrs = { email, subscriptions };
  if (smsOptIn && phone) {
    profileAttrs.phone_number = phone;
    subscriptions.sms = {
      marketing:     { consent: 'SUBSCRIBED' },
      transactional: { consent: 'SUBSCRIBED' },
    };
  }
  return {
    data: {
      type: 'profile-subscription-bulk-create-job',
      attributes: {
        custom_source: 'wabashsystems-lead-magnet',
        profiles: { data: [{ type: 'profile', attributes: profileAttrs }] },
      },
      relationships: {
        list: { data: { type: 'list', id: listId } },
      },
    },
  };
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

  // ── Step 1: upsert profile with custom properties ─────────────────────
  const profileAttrs = {
    email,
    properties: {
      lead_source:  source,
      lead_magnet:  '10-point-audit-checklist',
      signup_url:   new URL(request.url).origin,
    },
  };
  if (smsOptIn && phone) profileAttrs.phone_number = phone;

  const profileRes = await klaviyoFetch(apiKey, '/profiles/', {
    data: { type: 'profile', attributes: profileAttrs },
  });
  // 409 = profile already exists; that's fine, we just continue.
  if (!profileRes.ok && profileRes.status !== 409) {
    console.error('lead-magnet: profile create failed', profileRes.status, profileRes.detail);
    return json({
      error:  'Could not save your email.',
      detail: profileRes.detail,
      step:   'profile-create',
    }, 502);
  }

  // ── Step 2: subscribe to email list ───────────────────────────────────
  const emailSubRes = await klaviyoFetch(
    apiKey,
    '/profile-subscription-bulk-create-jobs/',
    subscribePayload(emailListId, email, null, false)
  );
  if (!emailSubRes.ok) {
    console.error('lead-magnet: email subscribe failed', emailSubRes.status, emailSubRes.detail);
    return json({
      error:  'Could not save your email.',
      detail: emailSubRes.detail,
      step:   'email-subscribe',
    }, 502);
  }

  // ── Step 3: subscribe to SMS list (only if opted in and configured) ───
  if (smsOptIn && smsListId) {
    const smsSubRes = await klaviyoFetch(
      apiKey,
      '/profile-subscription-bulk-create-jobs/',
      subscribePayload(smsListId, email, phone, true)
    );
    if (!smsSubRes.ok) {
      // SMS failed but email succeeded - return success with a soft warning.
      console.error('lead-magnet: SMS subscribe failed', smsSubRes.status, smsSubRes.detail);
      return json({
        ok:       true,
        download: '/lead-magnets/ecommerce-audit-checklist.pdf',
        message:  'Email saved! SMS opt-in failed - retry from the email link.',
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
