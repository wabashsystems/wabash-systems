// functions/admin/_middleware.js
// Protects all routes under /admin/* with HTTP Basic Auth.
// Set ADMIN_PASSWORD in Cloudflare Pages → Settings → Environment Variables.

export async function onRequest(context) {
  const { request, env, next } = context;

  const expectedPassword = env.ADMIN_PASSWORD;
  if (!expectedPassword) {
    // Fail closed — if env var isn't set, block access entirely.
    // Diagnostic: dump the names of bindings the function CAN see so we can
    // tell whether ADMIN_PASSWORD is missing, misnamed, or in the wrong env.
    const visibleKeys = Object.keys(env || {}).sort().join(', ') || '(none)';
    return new Response(
      'Admin not configured.\n\nVisible env bindings: ' + visibleKeys,
      { status: 503, headers: { 'Content-Type': 'text/plain' } }
    );
  }

  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6));
      const colon   = decoded.indexOf(':');
      const pass    = colon >= 0 ? decoded.slice(colon + 1) : '';
      if (pass === expectedPassword) {
        return next();
      }
    } catch {
      // malformed base64 — fall through to 401
    }
  }

  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Wabash Systems Admin", charset="UTF-8"',
      'Content-Type': 'text/plain',
    },
  });
}
