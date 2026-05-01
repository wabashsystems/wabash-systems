// functions/admin/login.js
// Handles POST /admin/login — validates password, issues signed session cookie.
// Requires env vars: ADMIN_PASSWORD, SESSION_SECRET

const SESSION_COOKIE  = 'admin_session';
const SESSION_HOURS   = 8;
const SESSION_SECONDS = SESSION_HOURS * 60 * 60;

// -------------------------------------------------------------------
// Timing-safe string comparison (prevent length-leak timing attacks)
// -------------------------------------------------------------------
function safeEqual(a, b) {
  const ta = new TextEncoder().encode(a);
  const tb = new TextEncoder().encode(b);
  // Always do full XOR walk — don't short-circuit on length mismatch
  const maxLen = Math.max(ta.length, tb.length);
  let diff = ta.length ^ tb.length;
  for (let i = 0; i < maxLen; i++) {
    diff |= (ta[i] ?? 0) ^ (tb[i] ?? 0);
  }
  return diff === 0;
}

// -------------------------------------------------------------------
// HMAC-SHA256 helpers (Web Crypto — available in Cloudflare Workers)
// -------------------------------------------------------------------
async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function signToken(secret, message) {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  // Encode as URL-safe base64
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// -------------------------------------------------------------------
// Build a signed session cookie value: "{expiry}.{hmac}"
// -------------------------------------------------------------------
async function buildSessionCookie(secret) {
  const expiry = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const message = `${SESSION_COOKIE}:${expiry}`;
  const hmac = await signToken(secret, message);
  return { value: `${expiry}.${hmac}`, expiry };
}

// -------------------------------------------------------------------
// Request handler
// -------------------------------------------------------------------
export async function onRequestPost(context) {
  const { request, env } = context;

  // Fail closed if env vars not configured
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    return new Response('Admin not configured.', { status: 503 });
  }

  // Parse form body
  let password = '';
  try {
    const body = await request.formData();
    password = body.get('password') ?? '';
  } catch {
    return Response.redirect('/admin/login?error=1', 303);
  }

  // Validate password
  if (!safeEqual(password, env.ADMIN_PASSWORD)) {
    return Response.redirect('/admin/login?error=1', 303);
  }

  // Issue signed session cookie
  const { value, expiry } = await buildSessionCookie(env.SESSION_SECRET);

  const cookieAttrs = [
    `${SESSION_COOKIE}=${value}`,
    `Path=/admin`,
    `HttpOnly`,
    `Secure`,
    `SameSite=Strict`,
    `Max-Age=${SESSION_SECONDS}`,
    `Expires=${new Date(expiry * 1000).toUTCString()}`,
  ].join('; ');

  return new Response(null, {
    status: 303,
    headers: {
      Location: '/admin/',
      'Set-Cookie': cookieAttrs,
    },
  });
}

// Redirect GET /admin/login → /admin/login.html (static file)
// (Cloudflare Pages serves the .html automatically, but just in case)
export async function onRequestGet() {
  return Response.redirect('/admin/login.html', 302);
}
