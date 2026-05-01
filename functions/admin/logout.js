// functions/admin/logout.js
// Handles GET /admin/logout — clears the session cookie and redirects to login.

const SESSION_COOKIE = 'admin_session';

export async function onRequestGet() {
  // Expire the cookie immediately by setting Max-Age=0
  const cookieAttrs = [
    `${SESSION_COOKIE}=`,
    `Path=/admin`,
    `HttpOnly`,
    `Secure`,
    `SameSite=Strict`,
    `Max-Age=0`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  ].join('; ');

  return new Response(null, {
    status: 303,
    headers: {
      Location: '/admin/login',
      'Set-Cookie': cookieAttrs,
    },
  });
}
