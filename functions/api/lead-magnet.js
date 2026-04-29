// functions/api/lead-magnet.js
//
// POST /api/lead-magnet
// Captures an email from the exit-intent modal on the homepage, drops it
// into Klaviyo (subscribed to the main email list, tagged with the lead
// source), and returns a 200 with a download URL on success.
//
// Klaviyo bindings expected on the Pages project:
//   KLAVIYO_PRIVATE_KEY  (Secret)  - dashboard-managed
//   KLAVIYO_LIST_ID      (Plaintext, in wrangler.toml)
//
// The body shape from the client:
//   { email: string, source: string }

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

  // Pull bindings; fail fast with a useful error if anything is missing
  const apiKey  = env.KLAVIYO_PRIVATE_KEY;
  const listId  = env.KLAVIYO_LIST_ID;
  if (!apiKey || !listId) {
    console.error('lead-magnet: missing KLAVIYO_PRIVATE_KEY or KLAVIYO_LIST_ID');
    return json({ error: 'Service not configured.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const email  = (body.email || '').trim().toLowerCase();
  const source = (body.source || 'unknown').toString().slice(0, 80);

  if (!isValidEmail(email)) {
    return json({ error: 'Please enter a valid email address.' }, 400);
  }

  // Klaviyo expects a subscription job that creates/updates a profile and
  // attaches it to a list with confirmed consent. The profile gets a custom
  // property `lead_source` so future segmentation can target lead-magnet
  // signups separately from contact-form submissions.
  const payload = {
    data: {
      type: 'profile-subscription-bulk-create-job',
      attributes: {
        custom_source: 'wabashsystems-exit-intent',
        profiles: {
          data: [
            {
              type: 'profile',
              attributes: {
                email,
                properties: {
                  lead_source: source,
                  lead_magnet: '10-point-audit-checklist',
                  signup_url: new URL(request.url).origin,
                },
                subscriptions: {
                  email: {
                    marketing: { consent: 'SUBSCRIBED' },
                  },
                },
              },
            },
          ],
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
    console.error('lead-magnet: klaviyo fetch threw', err);
    return json({ error: 'Could not reach Klaviyo. Try again in a moment.' }, 502);
  }

  // Klaviyo returns 202 Accepted on success for bulk jobs.
  if (!kRes.ok && kRes.status !== 202) {
    const detail = await kRes.text();
    console.error('lead-magnet: klaviyo error', kRes.status, detail);
    // Don't leak Klaviyo's internal error to the client.
    return json({ error: 'Could not save your email. Please try again.' }, 502);
  }

  return json({
    ok: true,
    download: '/lead-magnets/ecommerce-audit-checklist.pdf',
    message: 'Got it! Check your inbox.',
  });
}

// Reject any non-POST verb cleanly so curlers and bots get a sane response
export async function onRequest({ request }) {
  if (request.method === 'POST') return; // handled above
  return json({ error: 'Method not allowed.' }, 405);
}
