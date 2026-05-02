// functions/admin/logout.js
//
// GET /admin/logout — expires the session cookie and redirects to the login page.

const SESSION_COOKIE = 'admin_session';

export async function onRequestGet() {
  const expiredCookie = [
    `${SESSION_COOKIE}=`,
    'Path=/admin',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    'Max-Age=0',
  ].join('; ');

  return new Response(null, {
    status: 303,
    headers: {
      Location: '/admin/login',
      'Set-Cookie': expiredCookie,
    },
  });
}
