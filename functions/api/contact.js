export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { fname, lname, email, business, service, message, phone, smsOptIn: sms_consent } = body;

    if (!fname || !email || !message) {
      return jsonResponse({ success: false, error: 'Missing required fields.' }, 400);
    }

    const res = await fetch('https://api.resend.com/emails', {
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
          <p><strong>SMS Consent:</strong> ${sms_consent ? 'Yes' : 'No'}</p>
          <p><strong>Message:</strong></p>
          <p>${message.replace(/\n/g, '<br>')}</p>
        `,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Resend error:', res.status, errText);
      return jsonResponse({ success: false, error: 'Failed to send email.' }, 500);
    }

    if (env.KLAVIYO_PRIVATE_KEY) {
      const rawPhone = (phone || '').replace(/\D/g, '');
      const e164Phone = rawPhone.length === 10
        ? `+1${rawPhone}`
        : rawPhone.length === 11 && rawPhone.startsWith('1')
          ? `+${rawPhone}`
          : null;

      const profileRes = await fetch('https://a.klaviyo.com/api/profiles/', {
        method: 'POST',
        headers: klaviyoHeaders(env.KLAVIYO_PRIVATE_KEY),
        body: JSON.stringify({
          data: {
            type: 'profile',
            attributes: {
              email,
              first_name: fname,
              last_name: lname || '',
              ...(e164Phone && { phone_number: e164Phone }),
              properties: {
                business: business || '',
                service_interest: service || '',
                sms_consent: !!sms_consent,
              },
            },
          },
        }),
      });

      if (!profileRes.ok) {
        console.error('Klaviyo profile error:', profileRes.status, await profileRes.text());
      }

      const eventRes = await fetch('https://a.klaviyo.com/api/events/', {
        method: 'POST',
        headers: klaviyoHeaders(env.KLAVIYO_PRIVATE_KEY),
        body: JSON.stringify({
          data: {
            type: 'event',
            attributes: {
              metric: { data: { type: 'metric', attributes: { name: 'Contact Form Submitted' } } },
              profile: {
                data: {
                  type: 'profile',
                  attributes: {
                    email,
                    ...(e164Phone && { phone_number: e164Phone }),
                  },
                },
              },
              properties: {
                first_name: fname,
                business: business || '',
                service_interest: service || '',
                sms_consent: !!sms_consent,
              },
            },
          },
        }),
      });

      if (!eventRes.ok) {
        console.error('Klaviyo event error:', eventRes.status, await eventRes.text());
      }
    }

    if (env.WEBHOOK_SECRET) {
      try {
        const webhookRes = await fetch('https://admin.wabashsystems.com/webhook.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': env.WEBHOOK_SECRET,
          },
          body: JSON.stringify({ fname, lname, email, phone, business, service, message, smsOptIn: sms_consent }),
        });
        if (!webhookRes.ok) {
          console.error('Webhook error:', webhookRes.status, await webhookRes.text());
        }
      } catch (err) {
        console.error('Webhook fetch error:', err.message);
      }
    }

    return jsonResponse({ success: true }, 200);
  } catch (err) {
    console.error('Contact form error:', err.message);
    return jsonResponse({ success: false, error: 'Server error.' }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function klaviyoHeaders(apiKey) {
  return {
    'Authorization': `Klaviyo-API-Key ${apiKey}`,
    'Content-Type': 'application/json',
    'revision': '2024-10-15',
  };
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
