// functions/api/newsletter-signup.js
//
// POST /api/newsletter-signup
// Captures email from the footer newsletter form on every public page.
//
// Two-step Klaviyo flow using SYNCHRONOUS endpoints (the async bulk-subscribe
// endpoint silently dropped jobs in earlier iterations):
//   1. POST /profiles/ - create the profile with email, custom properties,
//      and subscription consent. Returns 201 with profile id, OR 409 if
//      the profile already exists (in which case Klaviyo returns the
//      existing profile id in error.meta.duplicate_profile_id).
//   2. POST /lists/{list_id}/relationships/profiles/ - add the profile id
//      to the list. Synchronous, returns 204 No Content on success and
//      a hard 4xx if anything is wrong (no silent failures).
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
    try { body = JSON.parse(text); } catch { /* leave body null on non-JSON */ }
  }
  return {
    ok:      res.status >= 200 && res.status < 300,
    status:  res.status,
    body,
    rawText: text,
  };
}

export async function onRequestPost(context) {
  // Outer try/catch so any unhandled exception surfaces as a JSON 502 with
  // the error message, instead of Cloudflare's generic HTML 502 page that
  // hides the underlying error.
  try {
    return await handleRequest(context);
  } catch (err) {
    console.error('newsletter-signup: unhandled exception', err && err.stack ? err.stack : err);
    return json({
      error:  'Internal server error.',
      detail: err && err.message ? err.message : String(err),
      stack:  err && err.stack ? err.stack : null,
      step:   'unhandled',
    }, 502);
  }
}

async function handleRequest(context) {
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

  // ── Step 1: create profile (or grab existing one's id from 409 response) ─
  const profilePayload = {
    data: {
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
    },
  };

  let profileId = null;
  let createRes;
  try {
    createRes = await klaviyoFetch(apiKey, '/profiles/', profilePayload);
  } catch (err) {
    return json({
      error:  'Could not reach Klaviyo for profile creation.',
      detail: err && err.message ? err.message : String(err),
      step:   'profile-fetch',
    }, 502);
  }

  if (createRes.ok) {
    profileId = createRes.body && createRes.body.data && createRes.body.data.id;
  } else if (createRes.status === 409) {
    const err = createRes.body && createRes.body.errors && createRes.body.errors[0];
    profileId = err && err.meta && err.meta.duplicate_profile_id;
  } else {
    return json({
      error:  'Could not save your email.',
      detail: createRes.rawText,
      step:   'profile-create',
      status: createRes.status,
    }, 502);
  }

  if (!profileId) {
    return json({
      error:    'Could not save your email.',
      detail:   'Profile created but ID not returned by Klaviyo.',
      step:     'profile-id',
      response: createRes.body,
      raw:      createRes.rawText,
    }, 502);
  }

  // ── Step 2: add profile to list synchronously ────────────────────────────
  let addRes;
  try {
    addRes = await klaviyoFetch(
      apiKey,
      `/lists/${listId}/relationships/profiles/`,
      { data: [{ type: 'profile', id: profileId }] }
    );
  } catch (err) {
    return json({
      error:      'Could not reach Klaviyo for list add.',
      detail:     err && err.message ? err.message : String(err),
      step:       'list-fetch',
      profile_id: profileId,
    }, 502);
  }

  if (!addRes.ok) {
    return json({
      error:      'Profile saved but could not add to list.',
      detail:     addRes.rawText,
      step:       'list-add',
      status:     addRes.status,
      profile_id: profileId,
    }, 502);
  }

  return json({ ok: true, message: 'Subscribed!' });
}

export async function onRequest({ request }) {
  if (request.method === 'POST') return;
  return json({ error: 'Method not allowed.' }, 405);
}
