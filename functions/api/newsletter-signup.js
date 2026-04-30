// functions/api/newsletter-signup.js
//
// POST /api/newsletter-signup
// Captures email from the footer newsletter form on every public page
// and subscribes the profile to the main email list in Klaviyo with
// `lead_source: footer-newsletter` so it stays distinct from the audit
// checklist signups (which trigger their own welcome series).

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

  const payload = {
    data: {
      type: 'profile-subscription-bulk-create-job',
      attributes: {
        custom_source: 'wabashsystems-newsletter',
        profiles: {
          data: [{
            type: 'profile',
            attributes: {
              email,
              properties: {
                lead_source: source,
                signup_url:  new URL(request.url).origin,
              },
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

  let kRes;
  try {
    kRes = await fetch(`${KLAVIYO_API}/profile-subscription-bulk-create-jobs/`, {
      method: 'POST',
      headers: {
        'Authorization': `Klaviyo-API-Key ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'revision':     KLAVIYO_REVISION,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('newsletter-signup: klaviyo fetch threw', err);
    return json({ error: 'Could not reach Klaviyo. Try again in a moment.' }, 502);
  }

  if (!kRes.ok && kRes.status !== 202) {
    const detail = await kRes.text();
    console.error('newsletter-signup: klaviyo error', kRes.status, detail);
    return json({ error: 'Could not save your email. Please try again.' }, 502);
  }

  return json({ ok: true, message: 'Subscribed!' });
}

export async function onRequest({ request }) {
  if (request.method === 'POST') return;
  return json({ error: 'Method not allowed.' }, 405);
}
