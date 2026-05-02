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
  if (PUBLIC_PATHS.some(p => url.pathname === p || url.pathname.startsWith(p + '?'))) {
    return next();
  }
  if (url.pathname === '/admin/logout') return next();

  // Valid session? Pass through.
  const cookieValue = getCookie(request, SESSION_COOKIE);
  if (cookieValue && await verifySessionCookie(cookieValue, env.SESSION_SECRET)) {
    return next();
  }

  // Not authenticated — redirect to login, preserving the original destination.
  const returnTo = encodeURIComponent(url.pathname + url.search);
  return new Response(null, {
    status: 302,
    headers: { Location: `/admin/login?next=${returnTo}` },
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k.trim() === name) return v.join('=');
  }
  return null;
}

async function getSigningKey(secret) {
  const raw = hexToBytes(secret);
  return crypto.subtle.importKey(
    'raw', raw,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signSessionCookie(secret) {
  const expiry = Math.floor(Date.now() / 1000) + SESSION_HOURS * 3600;
  const message = `admin_session:${expiry}`;
  const key = await getSigningKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, strToBytes(message));
  const b64 = bytesToBase64Url(new Uint8Array(sig));
  return `${expiry}.${b64}`;
}

async function verifySessionCookie(value, secret) {
  const dot = value.indexOf('.');
  if (dot === -1) return false;

  const expiry = parseInt(value.slice(0, dot), 10);
  if (isNaN(expiry) || expiry < Math.floor(Date.now() / 1000)) return false;

  const sig = value.slice(dot + 1);
  const message = `admin_session:${expiry}`;

  let sigBytes;
  try { sigBytes = base64UrlToBytes(sig); } catch { return false; }

  const key = await getSigningKey(secret);
  return crypto.subtle.verify('HMAC', key, sigBytes, strToBytes(message));
}

function strToBytes(str) {
  return new TextEncoder().encode(str);
}

function hexToBytes(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

function bytesToBase64Url(bytes) {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlToBytes(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - padded.length % 4) % 4;
  const b64 = padded + '='.repeat(pad);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export { signSessionCookie };
