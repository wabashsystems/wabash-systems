// Top-level Pages Functions middleware.
//
// Wraps every Functions route to capture uncaught exceptions to Sentry
// and return a clean JSON 500 instead of Cloudflare's default 502 HTML
// page. Functions that have their own try/catch (like contact.js) catch
// internally before this fires; this is the safety net for everything
// else.
//
// Pages middleware stacks outer-to-inner. functions/admin/_middleware.js
// (basic auth) runs INSIDE this one, so any error thrown by the auth
// gate or by the admin handlers gets reported here.

import { captureException } from './lib/sentry.js';

export async function onRequest(context) {
  try {
    return await context.next();
  } catch (err) {
    const path = (() => {
      try { return new URL(context.request.url).pathname; }
      catch { return 'unknown'; }
    })();

    captureException(context, err, {
      tags: { route: path, source: 'middleware-catch' },
    });

    // Surface to Cloudflare logs too, so it's findable via `wrangler tail`.
    console.error(`[middleware] uncaught error on ${path}:`, err?.stack || err);

    return new Response(
      JSON.stringify({
        success: false,
        ok: false,
        error: 'Server error.',
        detail: err && err.message ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      }
    );
  }
}
