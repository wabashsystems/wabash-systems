// functions/admin/login.js
//
// GET  /admin/login  — serves the login page HTML via ASSETS (no redirect, avoids
//                      Cloudflare Pages pretty-URL loop: /admin/login.html → /admin/login)
// POST /admin/login  — validates password, issues signed session cookie, redirects

import { signSessionCookie } from './_middleware.js';

const SESSION_COOKIE = 'admin_session';

// GET: serve login.html directly from the static asset bundle.
export async function onRequestGet(context) {
  return context.env.ASSETS.fetch(
    new Request(new URL('/admin/login.html', context.request.url))
  );
}

// POST: validate password and issue session cookie.
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    return new Response('Admin not configured.', { status: 503 });
  }

  let body;
  try {
    body = await request.formData();
  } catch {
    return new Response(null, { status: 303, headers: { Location: '/admin/login?error=1' } });
  }

  const submitted = body.get('password') ?? '';

  if (!safeEqual(submitted, env.ADMIN_PASSWORD)) {
    return new Response(null, { status: 303, headers: { Location: '/admin/login?error=1' } });
  }

  // Password correct — issue session cookie.
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

// ── Timing-safe string comparison ────────────────────────────────────────────
// XOR every character so comparison time depends only on string length,
// not on where the first mismatch occurs.
function safeEqual(a, b) {
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
