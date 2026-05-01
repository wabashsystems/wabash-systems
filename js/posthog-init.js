// posthog-init.js
//
// PostHog product analytics initializer. Loaded once per page from a single
// <script src="/js/posthog-init.js"></script> tag. Self-contained: pulls in
// the PostHog loader stub, configures it, and wires up the high-value
// conversion events for the site.
//
// Why explicit events on top of autocapture:
//   PostHog autocapture fires on every click/form-submit by default, but the
//   resulting events are keyed on DOM selectors that change whenever the page
//   is redesigned. Booking CTAs and contact-form submits are conversions we
//   care about long-term, so we capture them by behavior (Cal.com URL match,
//   form action match) rather than CSS selectors. That keeps funnels stable
//   across redesigns.
//
// API key is a public/client key (phc_...). Safe to ship in client-side JS.
// PostHog only treats the personal API key as secret.

(function () {
  if (window.__posthogInitialized) return;
  window.__posthogInitialized = true;

  // ── Configuration ──────────────────────────────────────────────────────
  // Replace POSTHOG_KEY with the project key from PostHog -> Settings ->
  // Project -> Project API key. POSTHOG_HOST is the data ingestion host;
  // 'us.i.posthog.com' for US Cloud, 'eu.i.posthog.com' for EU Cloud.
  var POSTHOG_KEY  = 'phc_vwuPMe2j85zzjxNMyde4pQk9qnmHHGZ6hAA52cQcmwux';
  var POSTHOG_HOST = 'https://us.i.posthog.com';

  // Bail before loading anything if the key wasn't filled in. Keeps dev
  // environments quiet and avoids 401s on the ingest endpoint.
  if (!POSTHOG_KEY || POSTHOG_KEY.indexOf('REPLACE_ME') !== -1) {
    if (window.console && console.info) {
      console.info('[posthog] not initialized - POSTHOG_KEY is a placeholder');
    }
    return;
  }

  // ── Standard PostHog loader snippet ────────────────────────────────────
  // Verbatim from PostHog's official install snippet. Creates window.posthog
  // as a queue-stub, then async-loads array.js which replaces the stub with
  // the real SDK and replays queued calls.
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]);t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,

    // Only create person profiles when we explicitly call identify(). Keeps
    // anonymous traffic from inflating the MAU billing tier and matches the
    // intent of "track conversions tied to leads, not bot scrolls".
    person_profiles: 'identified_only',

    // Default-on instrumentation - autocapture handles incidental clicks,
    // pageview/pageleave round out the basic funnel. Anything we care about
    // long-term gets explicit capture() calls below.
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,

    // Session replay off by default. Flip on once the data has signal -
    // turning it on too early just burns ingest quota on bot traffic.
    disable_session_recording: true,

    loaded: function (ph) {
      // Don't pollute production data with localhost dev sessions.
      var host = location.hostname;
      if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
        ph.opt_out_capturing();
        if (window.console && console.info) {
          console.info('[posthog] dev host detected - capture opted out');
        }
      }

      // Cloudflare Pages preview deploys land on *.pages.dev. We still want
      // to know they happened (for QA debugging) but tag them so they can be
      // filtered out of production funnels.
      if (host.indexOf('.pages.dev') !== -1) {
        ph.register({ environment: 'preview' });
      } else {
        ph.register({ environment: 'production' });
      }
    }
  });

  // ── Conversion events ──────────────────────────────────────────────────

  // Booking CTAs: any link or button pointing at our Cal.com page, plus
  // anything explicitly tagged data-booking-cta="true". Delegated listener
  // on document so it survives DOM reflows (modal openers, etc.).
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('a, button');
    if (!el) return;

    var href = (el.getAttribute && el.getAttribute('href')) || '';
    var isCal = href.indexOf('cal.com/wabashsystems') !== -1;
    var isTagged = el.dataset && el.dataset.bookingCta === 'true';
    if (!isCal && !isTagged) return;

    var section = el.closest('section');
    posthog.capture('booking_cta_clicked', {
      destination: href || null,
      location: (el.dataset && el.dataset.location) || (section && section.id) || 'unknown',
      text: (el.textContent || '').trim().slice(0, 80),
      page: location.pathname
    });
  }, false);

  // Contact form: identify the lead by email, then capture the conversion.
  // Capture-phase (true) so we run before the page's existing submit handler
  // - that handler does e.preventDefault() and an async fetch, but our work
  // is synchronous (queueing into posthog) so we're safe either way.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.id !== 'contactForm') return;

    var emailEl   = form.querySelector('input[type="email"], input[name="email"]');
    var fnameEl   = form.querySelector('input[name="fname"]');
    var lnameEl   = form.querySelector('input[name="lname"]');
    var bizEl     = form.querySelector('input[name="business"]');
    var serviceEl = form.querySelector('[name="service"]');
    var emailOpt  = form.querySelector('input[name="emailOptIn"]');
    var smsOpt    = form.querySelector('input[name="smsOptIn"]');

    var email = emailEl && emailEl.value ? emailEl.value.trim().toLowerCase() : null;
    var fullName = [
      fnameEl && fnameEl.value ? fnameEl.value.trim() : '',
      lnameEl && lnameEl.value ? lnameEl.value.trim() : ''
    ].filter(Boolean).join(' ').trim();

    if (email) {
      // Use the email as the distinct ID. PostHog will alias the anonymous
      // session to this identity, so the pre-submit pageviews carry over.
      posthog.identify(email, {
        email: email,
        name: fullName || undefined,
        business: bizEl && bizEl.value ? bizEl.value.trim() : undefined,
        first_seen_path: location.pathname,
        first_seen_at: new Date().toISOString(),
        email_opt_in: !!(emailOpt && emailOpt.checked),
        sms_opt_in:   !!(smsOpt && smsOpt.checked)
      });
    }

    posthog.capture('contact_form_submitted', {
      service_interest: serviceEl && serviceEl.value ? serviceEl.value : null,
      page: location.pathname,
      has_email: !!email,
      email_opt_in: !!(emailOpt && emailOpt.checked),
      sms_opt_in:   !!(smsOpt && smsOpt.checked)
    });
  }, true);
})();
