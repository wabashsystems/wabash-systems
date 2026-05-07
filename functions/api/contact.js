import { captureException } from '../lib/sentry.js';

// Hardcoded so it works regardless of env var state.
const KLAVIYO_LIST_ID = 'TbWzci';

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { fname, lname, email, phone, business, service, message, emailOptIn, smsOptIn } = body;
    if (!fname || !email || !message) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Notification email via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Wabash Systems <andy.gray@wabashsystems.com>',
        to: ['andy.gray@wabashsystems.com'],
        reply_to: email,
        subject: `New inquiry from ${fname} ${lname}${business ? ' - ' + business : ''}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${fname} ${lname}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
          <p><strong>Business:</strong> ${business || 'Not provided'}</p>
          <p><strong>Service:</strong> ${service || 'Not specified'}</p>
          <p><strong>Message:</strong></p><p>${message}</p>
          <hr/>
          <p><small>Email opt-in: ${emailOptIn ? 'Yes' : 'No'} &nbsp;|&nbsp; SMS opt-in: ${smsOptIn ? 'Yes' : 'No'}</small></p>
        `,
      }),
    });
    if (!emailRes.ok) {
      const errText = await emailRes.text();
      return new Response(JSON.stringify({ success: false, error: 'Failed to send email.', detail: errText }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Klaviyo - belt + suspenders approach.
    // Three calls so we don't depend on any one of them succeeding:
    //   A) Profile import (creates/updates profile with custom props)
    //   B) Subscribe with marketing consent (async; triggers list-based flows)
    //   C) Add to list directly (sync; ensures membership immediately)
    if (env.KLAVIYO_PRIVATE_KEY) {
      const kHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'revision': '2024-02-15',
        'Authorization': `Klaviyo-API-Key ${env.KLAVIYO_PRIVATE_KEY}`,
      };

      // A) Profile import — need the profile ID for step C.
      let klaviyoProfileId;
      try {
        const profileRes = await fetch('https://a.klaviyo.com/api/profile-import/', {
          method: 'POST',
          headers: kHeaders,
          body: JSON.stringify({
            data: {
              type: 'profile',
              attributes: {
                email,
                first_name: fname || undefined,
                last_name: lname || undefined,
                phone_number: phone || undefined,
                properties: {
                  ...(business && { 'Business Name': business }),
                  ...(service && { 'Service Interest': service }),
                  'Contact Message': message,
                  'Email Opt-In': !!emailOptIn,
                  'SMS Opt-In': !!smsOptIn,
                  'Source': 'Contact Form',
                },
              },
            },
          }),
        });
        if (profileRes.ok) {
          const profileData = await profileRes.json().catch(() => null);
          klaviyoProfileId = profileData?.data?.id;
        } else {
          console.error('[contact] Klaviyo profile import failed:', profileRes.status, await profileRes.text().catch(() => ''));
        }
      } catch (e) {
        console.error('[contact] Klaviyo profile import exception:', e?.message || e);
      }

      // B) Subscribe with marketing consent (async bulk job — triggers welcome flow).
      try {
        const subRes = await fetch('https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/', {
          method: 'POST',
          headers: kHeaders,
          body: JSON.stringify({
            data: {
              type: 'profile-subscription-bulk-create-job',
              attributes: {
                custom_source: 'Contact Form',
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
                list: { data: { type: 'list', id: KLAVIYO_LIST_ID } },
              },
            },
          }),
        });
        if (!subRes.ok) {
          console.error('[contact] Klaviyo subscribe failed:', subRes.status, await subRes.text().catch(() => ''));
        }
      } catch (e) {
        console.error('[contact] Klaviyo subscribe exception:', e?.message || e);
      }

      // C) Add to list directly (sync, immediate membership).
      // Independent of B — ensures membership lands even if the bulk job is delayed.
      if (klaviyoProfileId) {
        try {
          const addRes = await fetch(
            `https://a.klaviyo.com/api/lists/${KLAVIYO_LIST_ID}/relationships/profiles/`,
            {
              method: 'POST',
              headers: kHeaders,
              body: JSON.stringify({
                data: [{ type: 'profile', id: klaviyoProfileId }],
              }),
            }
          );
          if (addRes.status !== 204) {
            console.error('[contact] Klaviyo list-add failed:', addRes.status, await addRes.text().catch(() => ''));
          }
        } catch (e) {
          console.error('[contact] Klaviyo list-add exception:', e?.message || e);
        }
      }
    }

    // 3. Save lead to LAMP CRM (non-blocking — a failure here doesn't break the form response).
    // LAMP is source of truth for leads; KV is retired for this purpose.
    // Requires LAMP_API_SECRET env var in CF Pages (must match the secret on the LAMP box).
    if (env.LAMP_API_SECRET) {
      fetch('https://admin.wabashsystems.com/api/leads.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.LAMP_API_SECRET}`,
        },
        body: JSON.stringify({
          fname: fname || '',
          lname: lname || '',
          email,
          phone: phone || '',
          business: business || '',
          service: service || '',
          message: message || '',
          emailOptIn: !!emailOptIn,
          smsOptIn: !!smsOptIn,
          ip: request.headers.get('CF-Connecting-IP') || '',
          userAgent: request.headers.get('User-Agent') || '',
          source: 'contact-form',
        }),
      }).then(async (res) => {
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          console.error(`[contact] LAMP lead save failed: ${res.status}`, body);
        }
      }).catch((err) => {
        console.error('[contact] LAMP lead save fetch error:', err?.message || err);
      });
    } else {
      // Log so we notice it's not configured — but don't fail the request.
      console.warn('[contact] LAMP_API_SECRET not set — lead not saved to CRM');
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    captureException(context, err, { tags: { route: 'contact' } });
    return new Response(JSON.stringify({ success: false, error: 'Server error.', detail: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
