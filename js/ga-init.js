// ga-init.js
//
// Google Analytics 4 initializer. Loaded once per page from a single
// <script src="/js/ga-init.js"></script> tag in the <head>.
//
// Single source of truth for the GA4 measurement ID. Replace the
// placeholder below with the real G-XXXXXXXXXX from GA4 -> Admin ->
// Data Streams -> Web -> the stream for wabashsystems.com.
//
// Why a shared file vs. per-page inline:
//   The public site doesn't use a templating engine, so without this
//   any ID rotation means editing 7+ HTML files by hand. Centralizing
//   here keeps that surface to one line.
//
// Cross-domain linking is configured so sessions started on the public
// marketing site survive a hop to admin.wabashsystems.com (where the
// audit + booking flows live) and vice versa.

(function () {
  if (window.__gaInitialized) return;
  window.__gaInitialized = true;

  var GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';

  // Bail before injecting anything if the ID wasn't filled in. Keeps the
  // network panel clean in dev and avoids 400s on the collect endpoint.
  if (!GA_MEASUREMENT_ID || GA_MEASUREMENT_ID.indexOf('XXXXXXXXXX') !== -1) {
    if (window.console && console.info) {
      console.info('[ga4] not initialized - GA_MEASUREMENT_ID is a placeholder');
    }
    return;
  }

  // Don't pollute production data with localhost dev sessions.
  var host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
    if (window.console && console.info) {
      console.info('[ga4] dev host detected - not loading');
    }
    return;
  }

  // Standard gtag.js bootstrap.
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, {
    linker: { domains: ['wabashsystems.com', 'admin.wabashsystems.com'] }
  });
})();
