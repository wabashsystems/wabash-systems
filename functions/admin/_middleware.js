// functions/admin/_middleware.js
//
// Protects all /admin/* routes with HMAC-SHA256 signed session cookies.
//
// Required env vars (Cloudflare Pages → Settings → Environment Variables):
//   ADMIN_PASSWORD  — the login password
//   SESSION_SECRET  — hex string used to sign session tokens (keep separate from password)
//
// Cookie format: "{expiry_unix}.{hmac_base64url}"
// HMAC input:    "admin_session:{expiry_unix}"
// Session length: 8 hours
// Cookie flags:  HttpOnly; Secure; SameSite=Strict; Path=/admin

const SESSION_COOKIE  = 'admin_session';
const SESSION_HOURS   = 8;
const PUBLIC_PATHS    = ['/admin/login']; // /admin/login.html served via ASSETS in login.js

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Fail closed — SESSION_SECRET must be set or nothing works.
  if (!env.SESSION_SECRET) {
    return new Response('Admin not configured.', { status: 503 });
  }

  // Let login and logout routes through without auth check.
  if (PUBLIC_PATHS.some(p => url.pathname === p || url.pathname.startsWith(p + '.'))) {
    return next();
  }

  // Parse session cookie.
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => c.trim().split('=').map(decodeURIComponent))
  );
  const sessionCookie = cookies[SESSION_COOKIE];

  if (!sessionCookie) {
    return redirectToLogin(url);
  }

  const [expiryStr, hmacB64] = sessionCookie.split('.');
  if (!expiryStr || !hmacB64) {
    return redirectToLogin(url);
  }

  const expiry = parseInt(expiryStr, 10);
  if (isNaN(expiry) || Date.now() / 1000 > expiry) {
    return redirectToLogin(url);
  }

  // Verify HMAC-SHA256 signature.
  const valid = await verifyHmac(env.SESSION_SECRET, `admin_session:${expiryStr}`, hmacB64);
  if (!valid) {
    return redirectToLogin(url);
  }

  return next();
}

// ---------- helpers ----------

function redirectToLogin(url) {
  const loginUrl = new URL('/admin/login', url.origin);
  return Response.redirect(loginUrl.toString(), 302);
}

async function verifyHmac(secret, message, expectedB64) {
  try {
    const key = await importKey(secret);
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = base64urlToBytes(expectedB64);
    return await crypto.subtle.verify('HMAC', key, sigBytes, msgBytes);
  } catch {
    return false;
  }
}

async function importKey(secret) {
  const keyBytes = hexToBytes(secret);
  return crypto.subtle.importKey(
    'raw', keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function base64urlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
