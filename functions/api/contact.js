export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { fname, lname, email, business, service, message, phone, sms_consent } = body;

    if (!fname || !email || !message) {
      return jsonResponse({ success: false, error: 'Missing required fields.' }, 400);
    }

    // Send email notification via Resend
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

    // Push to Klaviyo if API key is set — fire and forget, don't block form success
    if (env.KLAVIYO_PRIVATE_KEY) {
      // Normalize phone to E.164 (+1XXXXXXXXXX) — strip everything except digits
      const rawPhone = (phone || '').replace(/\D/g, '');
      const e164Phone = rawPhone.length === 10 ? `+1${rawPhone}` : rawPhone.length === 11 && rawPhone.startsWith('1') ? `+${rawPhone}` : null;

      // Build profile attributes
      const profileAttrs = {
        email,
        first_name: fname,
        last_name: lname || '',
        ...(e164Phone && { phone_number: e164Phone }),
        properties: {
          business: business || '',
          service_interest: service || '',
          sms_consent: !!sms_consent,
        },
      };

      // Create/update profile in Klaviyo
      const profileRes = await fetch('https://a.klaviyo.com/api/profiles/', {
        method: 'POST',
        headers: klaviyoHeaders(env.KLAVIYO_PRIVATE_KEY),
        body: JSON.stringify({ data: { type: 'profile', attributes: profileAttrs } }),
      });

      if (!profileRes.ok) {
        console.error('Klaviyo profile error:', profileRes.status, await profileRes.text());
      }

      // Track "Contact Form Submitted" custom event — this is what triggers the SMS flow
      const eventRes = await fetch('https://a.klaviyo.com/api/events/', {
        method: 'POST',
        headers: klaviyoHeaders(env.KLAVIYO_PRIVATE_KEY),
        body: JSON.stringify({
          data: {
            type: 'event',
            attributes: {
              metric: { data: { type: 'metric', attributes: { name: 'Contact Form Submitted' } } },
              profile: { data: { type: 'profile', attributes: { email, ...(e164Phone && { phone_number: e164Phone }) } } },
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

    return jsonResponse({ success: true }, 200);
  } catch (err) {
    console.error('Contact form error:', err.message);
    return jsonResponse({ success: false, error: 'Server error.' }, 500);
  }
}

// Required for CORS preflight — browsers send OPTIONS before POST from JS fetch
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

// Required for CORS preflight — browsers send OPTIONS before POST from JS fetch
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
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