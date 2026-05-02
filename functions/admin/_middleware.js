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
  if (PUBLIC_PATHS.some(p => url.pathname ===