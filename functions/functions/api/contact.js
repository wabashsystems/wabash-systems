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

    // ── 1. Send notification email via Resend ────────────────────────────────
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Wabash Systems <info@wabashsystems.com>',
        to: ['agray@wabashsystems.com'],
        reply_to: email,
        subject: `New inquiry from ${fname} ${lname}${business ? ' — ' + business : ''}`,
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

    // ── 2. Push to Klaviyo ───────────────────────────────────────────────────
    // Build profile properties
    const profileProps = {
      data: {
        type: 'profile',
        attributes: {
          email,
          first_name: fname,
          last_name: lname || '',
          properties: {
            business_name: business || '',
            service_interest: service || '',
            inquiry_message: message,
            lead_source: 'Website Contact Form',
          },
        },
      },
    };

    // Add phone for SMS if opted in
    if (smsOptIn && phone) {
      // Normalize phone to E.164 — assume US if no country code
      const digits = phone.replace(/\D/g, '');
      profileProps.data.attributes.phone_number = digits.length === 10 ? `+1${digits}` : `+${digits}`;
    }

    // Upsert profile
    const profileRes = await fetch('https://a.klaviyo.com/api/profiles/', {
      method: 'POST',
      headers: {
        'Authorization': `Klaviyo-API-Key ${env.KLAVIYO_PRIVATE_KEY}`,
        'Content-Type': 'application/json',
        'revision': '2024-02-15',
        'Accept': 'application/json',
      },
      body: JSON.stringify(profileProps),
    });

    // 409 = profile already exists — that's fine, we'll still subscribe them
    let profileId = null;
    if (profileRes.ok) {
      const profileData = await profileRes.json();
      profileId = profileData?.data?.id;
    } else if (profileRes.status === 409) {
      // Extract existing profile ID from conflict response
      const conflictData = await profileRes.json();
      profileId = conflictData?.errors?.[0]?.meta?.duplicate_profile_id;
    }

    // Subscribe to Email List if opted in
    if (emailOptIn && profileId) {
      await fetch(`https://a.klaviyo.com/api/lists/${env.KLAVIYO_LIST_ID}/relationships/profiles/`, {
        method: 'POST',
        headers: {
          'Authorization': `Klaviyo-API-Key ${env.KLAVIYO_PRIVATE_KEY}`,
          'Content-Type': 'application/json',
          'revision': '2024-02-15',
        },
        body: JSON.stringify({
          data: [{ type: 'profile', id: profileId }],
        }),
      });
    }

    // Subscribe to SMS if opted in and phone provided
    if (smsOptIn && phone && profileId) {
      await fetch('https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/', {
        method: 'POST',
        headers: {
          'Authorization': `Klaviyo-API-Key ${env.KLAVIYO_PRIVATE_KEY}`,
          'Content-Type': 'application/json',
          'revision': '2024-02-15',
        },
        body: JSON.stringify({
          data: {
            type: 'profile-subscription-bulk-create-job',
            attributes: {
              profiles: {
                data: [{
                  type: 'profile',
                  id: profileId,
                  attributes: {
                    subscriptions: {
                      sms: {
                        marketing: {
                          consent: 'SUBSCRIBED',
                        },
                      },
                    },
                  },
                }],
              },
              historical_import: false,
            },
            relationships: {
              list: {
                data: { type: 'list', id: env.KLAVIYO_LIST_ID },
              },
            },
          },
        }),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: 'Server error.', detail: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
