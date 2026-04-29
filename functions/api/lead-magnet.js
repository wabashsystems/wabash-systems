// functions/api/lead-magnet.js
//
// POST /api/lead-magnet
// Captures an email (and optionally a phone number for SMS) from the
// homepage lead-capture surfaces - exit-intent modal and sticky bottom bar.
// Drops the profile into Klaviyo with custom properties for segmentation
// and subscribes to the email list (and SMS list, when opted in).
//
// Bindings expected on the Pages project:
//   KLAVIYO_PRIVATE_KEY  (Secret, dashboard-managed)
//   KLAVIYO_LIST_ID      (Plaintext, in wrangler.toml) - main email list
//   KLAVIYO_SMS_LIST_ID  (Plaintext, in wrangler.toml, optional) - SMS list
//
// Body shape:
//   {
//     email:      string (required),
//     phone:      string (optional, E.164 like "+15555551234"),
//     sms_opt_in: boolean (optional),
//     source:     string (optional, e.g. "exit-intent-audit" / "sticky-bar-audit")
//   }

const KLAVIYO_API = 'https://a.klaviyo.com/api';
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

// Strict E.164 check: + followed by 8-15 digits
const isValidE164 = (p) =>
  typeof p === 'string' && /^\+[1-9]\d{7,14}$/.test(p);

async function callKlaviyo(apiKey, path, payload) {
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
  if (!res.ok && res.status !== 202) {
    const detail = await res.text();
    const err = new Error(`Klaviyo ${res.status}: ${detail}`);
    err.status = res.status;
    err.body = detail;
    throw err;
  }
  return res;
}

function buildSubscriptionPayload({ listId, email, phone, smsOptIn, source }) {
  const properties = {
    lead_source:  source,
    lead_magnet:  '10-point-audit-checklist',
  };
  const subscriptions = {
    email: { marketing: { consent: 'SUBSCRIBED' } },
  };
  const profile = {
    type: 'profile',
    attributes: { email, properties, subscriptions },
  };
  if (smsOptIn && phone) {
    profile.attributes.phone_number = phone;
    subscriptions.sms = {
      marketing:        { consent: 'SUBSCRIBED' },
      transactional:    { consent: 'SUBSCRIBED' },
    };
  }
  return {
    data: {
      type: 'profile-subscription-bulk-create-job',
      attributes: {
        custom_source: 'wabashsystems-lead-magnet',
        profiles: { data: [profile] },
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

  const email     = (body.email || '').trim().toLowerCase();
  const rawPhone  = (body.phone || '').trim();
  const smsOptIn  = !!body.sms_opt_in;
  const source    = (body.source || 'unknown').toString().slice(0, 80);

  if (!isValidEmail(email)) {
    return json({ error: 'Please enter a valid email address.' }, 400);
  }

  // If SMS opt-in is set, the phone must be a real E.164 number.
  // If opt-in is set but phone is bad, fail the whole request - don't
  // silently drop the SMS half.
  let phone = '';
  if (smsOptIn) {
    if (!isValidE164(rawPhone)) {
      return json({
        error: 'Please enter a valid mobile number, or uncheck the text option.'
      }, 400);
    }
    phone = rawPhone;
  }

  // -- 1. Subscribe to email list (always) ---------------------------------
  try {
    await callKlaviyo(
      apiKey,
      '/profile-subscription-bulk-create-jobs/',
      buildSubscriptionPayload({
        listId:    emailListId,
        email,
        phone:     null,
        smsOptIn:  false,
        source,
      })
    );
  } catch (err) {
    console.error('lead-magnet: email-list subscription failed', err);
    return json({ error: 'Could not save your email. Please try again.' }, 502);
  }

  // -- 2. If SMS opted in and SMS list configured, subscribe to that too --
  if (smsOptIn && smsListId) {
    try {
      await callKlaviyo(
        apiKey,
        '/profile-subscription-bulk-create-jobs/',
        buildSubscriptionPayload({
          listId:    smsListId,
          email,
          phone,
          smsOptIn:  true,
          source,
        })
      );
    } catch (err) {
      // SMS failure shouldn't fail the whole request - email already
      // captured. Log and return success with a soft warning.
      console.error('lead-magnet: SMS-list subscription failed (email captured)', err);
      return json({
        ok: true,
        download: '/lead-magnets/ecommerce-audit-checklist.pdf',
        message: 'Email saved! SMS opt-in failed, retry from your inbox link.',
      });
    }
  }

  return json({
    ok: true,
    download: '/lead-magnets/ecommerce-audit-checklist.pdf',
    message: 'Got it! Check your inbox.',
  });
}

export async function onRequest({ request }) {
  if (request.method === 'POST') return;
  return json({ error: 'Method not allowed.' }, 405);
}
