// functions/api/sentry-test.js
//
// Gated endpoint for verifying that backend Sentry capture is working.
// Without the magic header, returns 404 so casual visitors and bots can't
// trigger spurious errors. With the header, throws a synthetic Error that
// the top-level middleware (functions/_middleware.js) catches and ships
// to Sentry.
//
// Usage:
//   curl -X POST https://www.wabashsystems.com/api/sentry-test \
//     -H "X-Sentry-Test: yes"
//   -> 500 JSON response, plus an event in the wabash-systems-functions
//      Sentry project within ~30s.
//
// Without the header:
//   curl -X POST https://www.wabashsystems.com/api/sentry-test
//   -> 404 (no Sentry event - this is what bots see)

export async function onRequest(context) {
  const { request } = context;

  // Gate: only proceed if the magic header is present.
  if (request.headers.get('x-sentry-test') !== 'yes') {
    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Synthetic error with a tag the parent middleware can attach for
  // searchability in Sentry. The error type is intentionally unusual so
  // it's easy to find in the issue list.
  const err = new Error(
    'Synthetic Sentry test error from /api/sentry-test at ' + new Date().toISOString()
  );
  err.name = 'SentryTestError';
  throw err;
}
