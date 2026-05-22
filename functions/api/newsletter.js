import { captureException } from '../lib/sentry.js';

// Hardcoded so it works regardless of env var state (KLAVIYO_LIST_ID env is wrong; see CLAUDE.md).
const KLAVIYO_LIST_ID = 'TbWzci';

/**
 * POST /api/newsletter
 *
 * Lightweight newsletter signup. Mirrors only the Klaviyo half of /api/contact:
 *   - No Resend notification
 *   - No LAMP /api/leads.php write
 *   - Adds the email to list TbWzci with Source = "Newsletter Footer"
 *
 * Returns { ok: true } on success.
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const email = (body.email || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid email.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!env.KLAVIYO_PRIVATE_KEY) {
      // Treat as soft success so the UI never blocks the user, but log.
      console.warn('[newsletter] KLAVIYO_PRIVATE_KEY not set — skipping subscribe');
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    const kHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'revision': '2024-02-15',
      'Authorization': `Klaviyo-API-Key ${env.KLAVIYO_PRIVATE_KEY}`,
    };

    // A) Profile import — get an ID for direct list-add.
    let profileId;
    try {
      const profileRes = await fetch('https://a.klaviyo.com/api/profile-import/', {
        method: 'POST',
        headers: kHeaders,
        body: JSON.stringify({
          data: {
            type: 'profile',
            attributes: {
              email,
              properties: { Source: 'Newsletter Footer' },
            },
          },
        }),
      });
      if (profileRes.ok) {
        const data = await profileRes.json().catch(() => null);
        profileId = data?.data?.id;
      } else {
        console.error('[newsletter] profile import failed:', profileRes.status, await profileRes.text().catch(() => ''));
      }
    } catch (e) {
      console.error('[newsletter] profile import exception:', e?.message || e);
    }

    // B) Subscribe with marketing consent — triggers welcome flow XuVpbE.
    try {
      const subRes = await fetch('https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/', {
        method: 'POST',
        headers: kHeaders,
        body: JSON.stringify({
          data: {
            type: 'profile-subscription-bulk-create-job',
            attributes: {
              custom_source: 'Newsletter Footer',
              profiles: {
                data: [{
                  type: 'profile',
                  attributes: {
                    email,
                    subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } },
                  },
                }],
              },
            },
            relationships: {
              list: { data: { type: 'list', id: KLAVIYO_LIST_ID } },
            },
          },
        }),
      });
      if (!subRes.ok) {
        console.error('[newsletter] subscribe failed:', subRes.status, await subRes.text().catch(() => ''));
      }
    } catch (e) {
      console.error('[newsletter] subscribe exception:', e?.message || e);
    }

    // C) Direct list-add — guarantee sync membership.
    if (profileId) {
      try {
        const addRes = await fetch(
          `https://a.klaviyo.com/api/lists/${KLAVIYO_LIST_ID}/relationships/profiles/`,
          {
            method: 'POST',
            headers: kHeaders,
            body: JSON.stringify({ data: [{ type: 'profile', id: profileId }] }),
          }
        );
        if (addRes.status !== 204) {
          console.error('[newsletter] list-add failed:', addRes.status, await addRes.text().catch(() => ''));
        }
      } catch (e) {
        console.error('[newsletter] list-add exception:', e?.message || e);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    captureException(context, err, { tags: { route: 'newsletter' } });
    return new Response(JSON.stringify({ ok: false, error: 'Server error.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
