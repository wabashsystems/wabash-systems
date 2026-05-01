// functions/admin/_middleware.js
// Guards all /admin/* routes with a signed session cookie.
// Login and logout routes are exempt from the auth check.
//
// Required env vars (Cloudflare Pages → Settings → Environment Variables):
//   ADMIN_PASSWORD  — the password used on /admin/login
//   SESSION_SECRET  — random secret used to sign session tokens (separate from password)
//
// Cookie format: admin_session={expiry_unix}.{hmac_base64url}
// HMAC covers: "admin_session:{expiry_unix}"

const SESSION_COOKIE = 'admin_session';

// Routes that don't require an active session
const PUBLIC_PATHS = ['/admin/login', '/admin/login.html'];

// -------------------------------------------------------------------
// HMAC-SHA256 helpers (Web Crypto — available in Cloudflare Workers)
// -------------------------------------------------------------------
async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

// Decode URL-safe base64 → Uint8Array
function decodeBase64Url(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (padded.length % 4)) % 4;
  const b64 = padded + '='.repeat(pad);
  const binary = atob(b64);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

// Verify a token produced by login.js
async function verifySessionCookie(cookieValue, secret) {
  // Format: "{expiry}.{hmac_base64url}"
  const dot = cookieValue.indexOf('.');
  if (dot < 0) return false;

  const expiryStr = cookieValue.slice(0, dot);
  const hmacStr   = cookieValue.slice(dot + 1);

  // Check expiry
  const expiry = parseInt(expiryStr, 10);
  if (!Number.isFinite(expiry) || expiry < Math.floor(Date.now() / 1000)) {
    return false; // expired or invalid
  }

  // Verify HMAC — crypto.subtle.verify is constant-time
  try {
    const key = await importHmacKey(secret);
    const expectedMsg = new TextEncoder().encode(`${SESSION_COOKIE}:${expiryStr}`);
    const sigBytes = decodeBase64Url(hmacStr);
    return await crypto.subtle.verify('HMAC', key, sigBytes, expectedMsg);
  } catch {
    return false;
  }
}

// Parse a specific cookie from the Cookie header
function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k.trim() === name) return rest.join('=');
  }
  return null;
}

// -------------------------------------------------------------------
// Middleware
// -------------------------------------------------------------------
export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Fail closed if env vars missing
  if (!env.SESSION_SECRET) {
    return new Response('Admin not configured.', { status: 503 });
  }

  // Allow login / logout pages through without a session check
  if (PUBLIC_PATHS.some(p => url.pathname === p || url.pathname.startsWith(p + '?'))) {
    return next();
  }

  // Also allow the logout endpoint through (it clears the cookie)
  if (url.pathname === '/admin/logout') {
    return next();
  }

  // Check session cookie
  const cookieValue = getCookie(request, SESSION_COOKIE);
  if (cookieValue && await verifySessionCookie(cookieValue, env.SESSION_SECRET)) {
    return next();
  }

  // Not authenticated — redirect to login, preserving the intended destination
  // Note: Response.redirect() requires absolute URLs in Workers; use Location header instead
  const returnTo = encodeURIComponent(url.pathname + url.search);
  return new Response(null, {
    status: 302,
    headers: { Location: `/admin/login?next=${returnTo}` },
  });
}
