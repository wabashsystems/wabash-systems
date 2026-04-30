// functions/api/newsletter-signup.js
//
// POST /api/newsletter-signup
// Captures email from the footer newsletter form on every public page.
//
// Two-step Klaviyo flow (this is what Klaviyo's docs actually recommend
// in their 2025+ revision; the bulk-subscribe endpoint does NOT accept
// custom properties on the profile, only email/phone/subscriptions):
//   1. POST /profiles/  - create or update the profile with custom properties
//   2. POST /profile-subscription-bulk-create-jobs/  - subscribe to the list
//
// Bindings expected:
//   KLAVIYO_PRIVATE_KEY  (Secret)
//   KLAVIYO_LIST_ID      (Plaintext, in wrangler.toml)

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
  // 200, 201, 202 are all success for these endpoints
  if (res.status >= 200 && res.status < 300) {
    return { ok: true, status: res.status };
  }
  const text = await res.text();
  return { ok: false, status: res.status, detail: text };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const apiKey = env.KLAVIYO_PRIVATE_KEY;
  const listId = env.KLAVIYO_LIST_ID;
  if (!apiKey || !listId) {
    console.error('newsletter-signup: missing KLAVIYO_PRIVATE_KEY or KLAVIYO_LIST_ID');
    return json({ error: 'Service not configured.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const email  = (body.email  || '').trim().toLowerCase();
  const source = (body.source || 'footer-newsletter').toString().slice(0, 80);

  if (!isValidEmail(email)) {
    return json({ error: 'Please enter a valid email address.' }, 400);
  }

  // ── Step 1: upsert profile with custom properties ─────────────────────
  // Klaviyo's create-profile endpoint returns 409 if a profile with this
  // email already exists - that's not actually an error for us, we just
  // proceed to subscribe them. Treat 409 as success.
  const profilePayload = {
    data: {
      type: 'profile',
      attributes: {
        email,
        properties: {
          lead_source: source,
          signup_url:  new URL(request.url).origin,
        },
      },
    },
  };
  const profileRes = await klaviyoFetch(apiKey, '/profiles/', profilePayload);
  if (!profileRes.ok && profileRes.status !== 409) {
    console.error('newsletter-signup: profile create failed', profileRes.status, profileRes.detail);
    return json({
      error:   'Could not save your email.',
      // Surface the Klaviyo error to make debugging visible from the browser.
      // Safe to return because the API key never appears in the response.
      detail:  profileRes.detail,
      step:    'profile-create',
    }, 502);
  }

  // ── Step 2: subscribe profile to the email list ────────────────────────
  const subscribePayload = {
    data: {
      type: 'profile-subscription-bulk-create-job',
      attributes: {
        custom_source: 'wabashsystems-newsletter',
        profiles: {
          data: [{
            type: 'profile',
            attributes: {
              email,
              subscriptions: {
                email: { marketing: { consent: 'SUBSCRIBED' } },
              },
            },
          }],
        },
      },
      relationships: {
        list: { data: { type: 'list', id: listId } },
      },
    },
  };
  const subRes = await klaviyoFetch(apiKey, '/profile-subscription-bulk-create-jobs/', subscribePayload);
  if (!subRes.ok) {
    console.error('newsletter-signup: subscribe failed', subRes.status, subRes.detail);
    return json({
      error:  'Could not save your email.',
      detail: subRes.detail,
      step:   'subscribe',
    }, 502);
  }

  return json({ ok: true, message: 'Subscribed!' });
}

export async function onRequest({ request }) {
  if (request.method === 'POST') return;
  return json({ error: 'Method not allowed.' }, 405);
}
