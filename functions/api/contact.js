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
    const kd = {
      hasKey: !!env.KLAVIYO_PRIVATE_KEY,
      listIdUsed: KLAVIYO_LIST_ID,
    };

    if (env.KLAVIYO_PRIVATE_KEY) {
      const kHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'revision': '2024-02-15',
        'Authorization': `Klaviyo-API-Key ${env.KLAVIYO_PRIVATE_KEY}`,
      };

      // A) Profile import
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
        kd.profileStatus = profileRes.status;
        const profileText = await profileRes.text();
        if (!profileRes.ok) {
          kd.profileError = profileText;
        } else {
          try { kd.profileId = JSON.parse(profileText)?.data?.id; } catch (_) {}
        }
      } catch (e) {
        kd.profileException = e?.message || String(e);
      }

      // B) Subscribe with marketing consent (async bulk job)
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
        kd.subStatus = subRes.status;
        kd.subBody = await subRes.text();
      } catch (e) {
        kd.subException = e?.message || String(e);
      }

      // C) Add to list directly (sync, immediate membership)
      // This is independent of B — even if the subscribe job fails or is delayed,
      // the profile will still be in the list right away.
      try {
        const addRes = await fetch(
          `https://a.klaviyo.com/api/lists/${KLAVIYO_LIST_ID}/relationships/profiles/`,
          {
            method: 'POST',
            headers: kHeaders,
            body: JSON.stringify({
              data: [{ type: 'profile', id: kd.profileId }],
            }),
          }
        );
        kd.addStatus = addRes.status;
        if (addRes.status !== 204) {
          kd.addBody = await addRes.text();
        }
      } catch (e) {
        kd.addException = e?.message || String(e);
      }
    }

    // 3. Save to admin KV
    if (env.ADMIN_DATA) {
      try {
        const KV_KEY = 'billing_data';
        const raw = await env.ADMIN_DATA.get(KV_KEY);
        const data = raw ? JSON.parse(raw) : { clients: [], entries: [], invoices: [] };
        if (!Array.isArray(data.leads)) data.leads = [];
        data.leads.push({
          id: 'l' + Date.now() + Math.random().toString(36).slice(2, 6),
          createdAt: new Date().toISOString(),
          fname: fname || '',
          lname: lname || '',
          email: email,
          phone: phone || '',
          business: business || '',
          service: service || '',
          message: message || '',
          emailOptIn: !!emailOptIn,
          smsOptIn: !!smsOptIn,
          ip: request.headers.get('CF-Connecting-IP') || '',
          userAgent: request.headers.get('User-Agent') || '',
          source: 'contact-form',
          status: 'new',
          followupNotes: '',
          convertedToClientId: null,
        });
        await env.ADMIN_DATA.put(KV_KEY, JSON.stringify(data));
      } catch (kvErr) {
        console.error('[contact] KV lead save failed:', kvErr?.message || kvErr);
      }
    }

    return new Response(JSON.stringify({ success: true, _klaviyo_debug: kd }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    captureException(context, err, { tags: { route: 'contact' } });
    return new Response(JSON.stringify({ success: false, error: 'Server error.', detail: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
