import { captureException } from '../lib/sentry.js';

const KLAVIYO_LIST_ID = 'TbWzci';

/**
 * POST /api/roi_capture
 *
 * Body: { email, monthly_revenue, current_conv_rate, current_traffic,
 *         projected_lift_low, projected_lift_high }
 *
 * - Klaviyo: profile import + subscribe + list-add (same three-call dance as
 *   /api/contact), with the calculator inputs/outputs as custom properties.
 * - LAMP: POSTs to /api/leads.php with source='roi_calculator'. The inputs
 *   land in the `message` field as a readable summary.
 *
 * Auth to LAMP: `Authorization: Bearer ${env.LAMP_API_SECRET}` — same pattern
 * as contact.js. (CLAUDE.md mentions HMAC but the existing LAMP endpoint uses
 * Bearer — see lamp/api/leads.php.)
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const email = (body.email || '').trim();
    const monthly_revenue = Number(body.monthly_revenue) || 0;
    const current_conv_rate = Number(body.current_conv_rate) || 0;
    const current_traffic = Number(body.current_traffic) || 0;
    const projected_lift_low = Number(body.projected_lift_low) || 0;
    const projected_lift_high = Number(body.projected_lift_high) || 0;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid email.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── Klaviyo ───────────────────────────────────────────────────────────
    if (env.KLAVIYO_PRIVATE_KEY) {
      const kHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'revision': '2024-02-15',
        'Authorization': `Klaviyo-API-Key ${env.KLAVIYO_PRIVATE_KEY}`,
      };

      const properties = {
        Source: 'ROI Calculator',
        monthly_revenue,
        current_conv_rate,
        current_traffic,
        projected_lift_low,
        projected_lift_high,
      };

      let profileId;
      try {
        const profileRes = await fetch('https://a.klaviyo.com/api/profile-import/', {
          method: 'POST',
          headers: kHeaders,
          body: JSON.stringify({
            data: { type: 'profile', attributes: { email, properties } },
          }),
        });
        if (profileRes.ok) {
          const data = await profileRes.json().catch(() => null);
          profileId = data?.data?.id;
        }
      } catch (e) {
        console.error('[roi_capture] profile import exception:', e?.message || e);
      }

      try {
        await fetch('https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/', {
          method: 'POST',
          headers: kHeaders,
          body: JSON.stringify({
            data: {
              type: 'profile-subscription-bulk-create-job',
              attributes: {
                custom_source: 'ROI Calculator',
                profiles: { data: [{
                  type: 'profile',
                  attributes: { email, subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } } },
                }] },
              },
              relationships: { list: { data: { type: 'list', id: KLAVIYO_LIST_ID } } },
            },
          }),
        });
      } catch (e) {
        console.error('[roi_capture] subscribe exception:', e?.message || e);
      }

      if (profileId) {
        try {
          await fetch(`https://a.klaviyo.com/api/lists/${KLAVIYO_LIST_ID}/relationships/profiles/`, {
            method: 'POST',
            headers: kHeaders,
            body: JSON.stringify({ data: [{ type: 'profile', id: profileId }] }),
          });
        } catch (e) {
          console.error('[roi_capture] list-add exception:', e?.message || e);
        }
      }
    }

    // ── LAMP /api/leads.php ───────────────────────────────────────────────
    if (env.LAMP_API_SECRET) {
      const fmt = (n) => Number(n).toLocaleString('en-US');
      const message =
        `ROI Calculator submission:\n` +
        `- Monthly revenue: $${fmt(monthly_revenue)}\n` +
        `- Current conversion rate: ${current_conv_rate}%\n` +
        `- Current monthly traffic: ${fmt(current_traffic)}\n` +
        `- Projected lift (low/high): ${projected_lift_low}% / ${projected_lift_high}%`;

      context.waitUntil(fetch('https://admin.wabashsystems.com/api/leads.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.LAMP_API_SECRET}`,
        },
        body: JSON.stringify({
          fname: 'ROI',
          lname: 'Lead',
          email,
          message,
          source: 'roi_calculator',
          ip: request.headers.get('CF-Connecting-IP') || '',
          userAgent: request.headers.get('User-Agent') || '',
        }),
      }).then(async (res) => {
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          console.error(`[roi_capture] LAMP save failed: ${res.status}`, t);
        }
      }).catch((err) => {
        console.error('[roi_capture] LAMP fetch error:', err?.message || err);
      }));
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    captureException(context, err, { tags: { route: 'roi_capture' } });
    return new Response(JSON.stringify({ ok: false, error: 'Server error.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
