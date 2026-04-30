// Sentry frontend init config. Must load BEFORE the loader script so the
// loader picks up window.sentryOnLoad as its config callback.
//
// Loader script tag is the one Sentry generated:
//   https://js.sentry-cdn.com/8b2571b52de8397c9d84aac021fd805a.min.js
//
// To tune sample rates, replay, or filters: edit this file. Single source of truth.

window.sentryOnLoad = function () {
  Sentry.init({
    // Tracing: keep low while traffic is small. 10% gives signal without burning quota.
    tracesSampleRate: 0.1,

    // Session Replay: disabled by default. The loader-script default would be
    // 0.1 / 1.0 (10% sessions / 100% on error). Replays are heavy on quota and
    // we don't need them yet. Flip these on when we have real traffic and a
    // specific UX bug we're hunting.
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 0.0,

    // Tag environment from hostname so we can split prod errors from preview branches.
    environment: (location.hostname === 'www.wabashsystems.com' ||
                  location.hostname === 'wabashsystems.com')
                  ? 'production'
                  : 'preview',

    // Drop noise we can't act on. Better to start aggressive and back off when
    // we see real errors getting suppressed.
    ignoreErrors: [
      // Browser extension noise
      /Extension context invalidated/,
      /chrome\.runtime\.sendMessage/,
      // Ad blockers / privacy tools blocking third-party scripts
      /Failed to fetch.*klaviyo/i,
      /Network request failed/,
      // Cross-origin script errors with no actionable stack
      /^Script error\.?$/,
      // Benign ResizeObserver chatter from Chrome
      /ResizeObserver loop limit exceeded/,
      /ResizeObserver loop completed with undelivered notifications/,
    ],

    denyUrls: [
      // Browser extensions
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      /^safari-extension:\/\//,
      /^extension:\/\//,
      // Third-party scripts we don't own
      /static\.klaviyo\.com/,
      /js\.klaviyo\.com/,
      /www\.googletagmanager\.com/,
      /googleads/,
      // Cal.com embed
      /cal\.com/,
    ],

    // Last-line filter for stuff the regex lists miss.
    beforeSend(event, hint) {
      const err = hint && hint.originalException;
      // Klaviyo onsite SDK throws TypeErrors with no actionable stack
      if (err && err.stack && /klaviyo/i.test(err.stack)) return null;
      return event;
    },
  });
};
