import { captureException } from '../lib/sentry.js';

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
        from: 'Wabash Systems <info@wabashsystems.com>',
        to: ['andy.gray@wabashsystems.com'],
        reply_to: email,
        subject: `New inquiry from ${fname} ${lname}${business ? ' � ' + business : ''}`,
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

    // 2. Klaviyo � upsert profile + add to Email List
    if (env.KLAVIYO_PRIVATE_KEY) {
      try {
        const kHeaders = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'revision': '2024-02-15',
          'Authorization': `Klaviyo-API-Key ${env.KLAVIYO_PRIVATE_KEY}`,
        };

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
          const profileData = await profileRes.json();
          const profileId = profileData?.data?.id;

          if (profileId && env.KLAVIYO_LIST_ID) {
            await fetch(`https://a.klaviyo.com/api/lists/${env.KLAVIYO_LIST_ID}/relationships/profiles/`, {
              method: 'POST',
              headers: kHeaders,
              body: JSON.stringify({
                data: [{ type: 'profile', id: profileId }],
              }),
            });
          }
        } else {
          console.error('[klaviyo] profile upsert failed:', await profileRes.text());
        }
      } catch (klaviyoErr) {
        console.error('[klaviyo] error:', klaviyoErr?.message || klaviyoErr);
      }
    }

    // 3. Save to admin KV so the Leads tab in /admin can show this submission.
    // Best-effort: don't fail the whole request if KV is unreachable.
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
          status: 'new',                 // new | contacted | quoted | won | lost | no-fit
          followupNotes: '',
          convertedToClientId: null,
        });
        await env.ADMIN_DATA.put(KV_KEY, JSON.stringify(data));
      } catch (kvErr) {
        console.error('[contact] KV lead save failed:', kvErr?.message || kvErr);
        // intentional: don't propagate - email + Klaviyo already succeeded
      }
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
