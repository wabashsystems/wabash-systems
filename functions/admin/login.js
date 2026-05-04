// functions/admin/login.js
//
// GET  /admin/login  - serves the login page HTML via ASSETS (no redirect, avoids
//                      Cloudflare Pages pretty-URL loop: /admin/login.html -> /admin/login)
// POST /admin/login  - validates username + password + TOTP code, issues signed
//                      session cookie, redirects.
//
// Required Cloudflare Pages env vars:
//   ADMIN_USERNAME  - the login username (e.g. "andy")
//   ADMIN_PASSWORD  - the login password
//   TOTP_SECRET     - base32-encoded TOTP secret (set up in your authenticator app)
//   SESSION_SECRET  - hex string used to sign session cookies

import { signSessionCookie } from './_middleware.js';
import { verifyTotp } from './totp.js';

const SESSION_COOKIE = 'admin_session';

// GET: serve login.html directly from the static asset bundle.
export async function onRequestGet(context) {
  return context.env.ASSETS.fetch(
    new Request(new URL('/admin/login.html', context.request.url))
  );
}

// POST: validate username + password + TOTP code, then issue session cookie.
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.TOTP_SECRET || !env.SESSION_SECRET) {
    return new Response('Admin not configured. Missing one of: ADMIN_USERNAME, ADMIN_PASSWORD, TOTP_SECRET, SESSION_SECRET.', { status: 503 });
  }

  let body;
  try {
    body = await request.formData();
  } catch {
    return redirectErr(1);
  }

  const username = (body.get('username') ?? '').trim();
  const password = body.get('password') ?? '';
  const code     = (body.get('code') ?? '').trim();

  // Verify ALL three. We always run all three checks (don't short-circuit) so
  // an attacker can't time-distinguish "wrong username" from "wrong password"
  // from "wrong TOTP".
  const userOk = safeEqual(username, env.ADMIN_USERNAME);
  const passOk = safeEqual(password, env.ADMIN_PASSWORD);
  const totpOk = await verifyTotp(env.TOTP_SECRET, code);

  if (!userOk || !passOk || !totpOk) {
    // Generic error - don't leak which check failed
    return redirectErr(1);
  }

  // All three valid - issue session cookie.
  const cookieValue = await signSessionCookie(env.SESSION_SECRET);
  const cookie = [
    `${SESSION_COOKIE}=${cookieValue}`,
    'Path=/admin',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    'Max-Age=28800', // 8 hours
  ].join('; ');

  // Redirect to the originally requested page, or /admin/ if none.
  const url    = new URL(request.url);
  const next   = url.searchParams.get('next') || '/admin/';
  const target = /^\/admin(\/|$)/.test(next) ? next : '/admin/';

  return new Response(null, {
    status: 303,
    headers: { Location: target, 'Set-Cookie': cookie },
  });
}

function redirectErr(code) {
  return new Response(null, { status: 303, headers: { Location: `/admin/login?error=${code}` } });
}

// Timing-safe string comparison.
// XOR every character so comparison time depends only on string length,
// not on where the first mismatch occurs.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) {
    // Still consume time proportional to `a` to avoid length oracle.
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ 0;
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
