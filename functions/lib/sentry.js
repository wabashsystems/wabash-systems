// Tiny Sentry client for Cloudflare Pages Functions.
//
// Why hand-rolled instead of @sentry/cloudflare:
// This project deploys via `wrangler pages deploy .` with no build step,
// so npm packages aren't bundled. A dependency-free fetch-to-envelope
// implementation gives us 90% of the value (exception capture with
// context, breadcrumbs from request data, environment tagging) at the
// cost of skipping the SDK's auto-instrumentation. For a handful of API
// routes that's a fine trade.
//
// Usage:
//   import { captureException } from '../lib/sentry.js';
//   ...
//   } catch (err) {
//     captureException(context, err, { tags: { route: 'contact' } });
//     return new Response(...);
//   }

const DSN = 'https://0cea3bfd85cf7e61ebd0de695fe3f1ed@o4511311528460288.ingest.us.sentry.io/4511311585607680';

// Parse the DSN once at module load. If the format ever changes upstream,
// failures here would break the module import - but the DSN is a constant
// from Sentry, so this is fine.
const parsed = (() => {
  try {
    const url = new URL(DSN);
    return {
      publicKey: url.username,
      host: url.host,
      projectId: url.pathname.slice(1),
      envelopeUrl: `https://${url.host}/api/${url.pathname.slice(1)}/envelope/`,
    };
  } catch {
    return null;
  }
})();

/**
 * Capture an exception and ship it to Sentry. Non-blocking via ctx.waitUntil
 * when available, otherwise fire-and-forget (best effort).
 *
 * @param {object} context - Cloudflare Pages Functions context (has request, env, waitUntil)
 * @param {Error|string} err - The thrown value
 * @param {object} [opts]
 * @param {object} [opts.tags] - Extra tags to attach (e.g. { route: 'contact' })
 * @param {object} [opts.extra] - Extra arbitrary context data
 * @param {string} [opts.user] - User identifier if known (email, etc.)
 */
export function captureException(context, err, opts = {}) {
  if (!parsed) return; // DSN unparseable - no-op

  const { request, env } = context || {};
  const url = request ? new URL(request.url) : null;
  const hostname = url ? url.hostname : 'unknown';

  const event = {
    event_id: crypto.randomUUID().replace(/-/g, ''),
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: 'error',
    sdk: { name: 'wabash-systems.cloudflare', version: '1.0.0' },
    environment:
      hostname === 'www.wabashsystems.com' || hostname === 'wabashsystems.com'
        ? 'production'
        : 'preview',
    server_name: 'cloudflare-pages',
    tags: {
      runtime: 'cloudflare-pages-functions',
      ...(opts.tags || {}),
    },
    extra: {
      ...(opts.extra || {}),
    },
    request: request
      ? {
          url: request.url,
          method: request.method,
          headers: Object.fromEntries(
            // Strip auth/cookie headers - never send those to a third-party.
            [...request.headers.entries()].filter(
              ([k]) => !/authorization|cookie|x-api-key|x-auth/i.test(k)
            )
          ),
        }
      : undefined,
    exception: {
      values: [
        {
          type: err && err.name ? err.name : 'Error',
          value: err && err.message ? String(err.message) : String(err),
          stacktrace: err && err.stack ? parseStack(err.stack) : undefined,
        },
      ],
    },
  };

  if (opts.user) {
    event.user = { id: opts.user };
  }

  // Sentry envelope format: NDJSON-ish — a header line, then per-item
  // header lines + payload lines.
  const envelopeHeader = JSON.stringify({
    event_id: event.event_id,
    sent_at: new Date().toISOString(),
    sdk: event.sdk,
  });
  const itemHeader = JSON.stringify({ type: 'event' });
  const itemPayload = JSON.stringify(event);
  const body = `${envelopeHeader}\n${itemHeader}\n${itemPayload}\n`;

  const sendPromise = fetch(parsed.envelopeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-sentry-envelope',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=wabash-systems.cloudflare/1.0.0`,
    },
    body,
  }).catch((sendErr) => {
    // If Sentry itself is down we don't want to take the function with us.
    // Log to Cloudflare's stdout so it shows up in tail logs.
    console.error('[sentry] event send failed:', sendErr?.message || sendErr);
  });

  // Use waitUntil so the function response isn't blocked on Sentry.
  // ctx.waitUntil is the standard Workers/Pages name; some examples call
  // it context.waitUntil. Both should be present on Pages Functions.
  if (context && typeof context.waitUntil === 'function') {
    context.waitUntil(sendPromise);
  }
  // else: best-effort - fetch was already kicked off; we're done.
}

// Parse a v8 / Cloudflare-style stack trace into Sentry's stacktrace format.
// Best effort - if parsing fails we just send an empty frames list and Sentry
// still shows the raw exception.value, just without line numbers.
function parseStack(stack) {
  const lines = String(stack).split('\n');
  const frames = [];
  for (const line of lines) {
    // Match patterns like:
    //   "    at functionName (/path/file.js:10:5)"
    //   "    at /path/file.js:10:5"
    const m = line.match(/^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
    if (!m) continue;
    frames.push({
      function: m[1] || '<anonymous>',
      filename: m[2],
      lineno: parseInt(m[3], 10),
      colno: parseInt(m[4], 10),
      in_app: !m[2].includes('node_modules'),
    });
  }
  // Sentry shows frames bottom-up (innermost last), v8 stacks are innermost-first
  return { frames: frames.reverse() };
}
