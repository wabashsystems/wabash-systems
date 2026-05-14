// search.js -- site search bar.
//
// Injects a search input into every page's .site-nav (next to the CTA button),
// fetches /search-index.json on first focus, and renders a dropdown of matches.
// Mobile (under 720px) shows a magnifying-glass icon that opens a fullscreen
// overlay instead.
//
// No deps. Inline CSS so we don't have to touch every page's stylesheet.
// Defer-load the index until first interaction so we don't blow LCP.
//
// The index format is an array of { url, title, kind, excerpt, keywords }
// produced by build-search-index.js at deploy time.

(function () {
  'use strict';

  var searchIndex = null;
  var indexLoading = null;
  var INDEX_URL = '/search-index.json';

  // Inline CSS. Keeps the search bar self-contained so we don't have to ship
  // CSS changes alongside every nav (every page has its own copy of the nav).
  var css = [
    '.ws-search-li { display:flex; align-items:center; position:relative; }',
    '.ws-search-wrap { position:relative; }',
    '.ws-search-input { width:180px; height:36px; padding:0 12px 0 34px; ',
    'background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.18); ',
    'border-radius:6px; color:#f8f6f1; font-size:13px; font-family:inherit; ',
    'outline:none; transition:border-color 0.15s, background 0.15s; }',
    '.ws-search-input::placeholder { color:rgba(248,246,241,0.55); }',
    '.ws-search-input:focus { border-color:#c4622d; background:rgba(255,255,255,0.12); }',
    '.ws-search-wrap::before { content:""; position:absolute; left:11px; top:50%; ',
    'transform:translateY(-50%); width:14px; height:14px; pointer-events:none; ',
    'background:url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 ',
    'viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23f8f6f1%27 stroke-width=%272.2%27 ',
    'stroke-linecap=%27round%27 stroke-linejoin=%27round%27 opacity=%270.6%27><circle cx=%2711%27 ',
    'cy=%2711%27 r=%278%27/><path d=%27m21 21-4.3-4.3%27/></svg>") center/contain no-repeat; }',
    '.ws-search-results { position:absolute; top:calc(100% + 8px); right:0; min-width:340px; ',
    'max-width:420px; max-height:420px; overflow-y:auto; background:#fff; border-radius:8px; ',
    'box-shadow:0 12px 40px rgba(0,0,0,0.18); padding:6px 0; z-index:1000; }',
    '.ws-search-results[hidden] { display:none; }',
    '.ws-search-result { display:block; padding:10px 16px; text-decoration:none; color:#0d1a2a; ',
    'border-bottom:1px solid #f2f4f7; transition:background 0.12s; }',
    '.ws-search-result:last-child { border-bottom:none; }',
    '.ws-search-result:hover, .ws-search-result.is-active { background:#f8f6f1; }',
    '.ws-search-result .ws-title { font-weight:600; font-size:14px; color:#0d1a2a; ',
    'margin-bottom:2px; }',
    '.ws-search-result .ws-meta { font-size:11px; color:#a04e22; text-transform:uppercase; ',
    'letter-spacing:0.5px; margin-bottom:4px; }',
    '.ws-search-result .ws-excerpt { font-size:12px; color:#606673; line-height:1.5; ',
    'display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }',
    '.ws-search-result mark { background:#fbe5d6; color:inherit; padding:0 2px; border-radius:2px; }',
    '.ws-search-empty { padding:14px 16px; font-size:13px; color:#606673; text-align:center; }',
    '.ws-search-mobile-btn { display:none; background:transparent; border:none; cursor:pointer; ',
    'padding:8px; color:#f8f6f1; }',
    '.ws-search-mobile-btn svg { width:18px; height:18px; }',
    '.ws-search-overlay { display:none; position:fixed; inset:0; z-index:9998; background:#0d1a2a; ',
    'padding:18px; flex-direction:column; }',
    '.ws-search-overlay.is-open { display:flex; }',
    '.ws-search-overlay-bar { display:flex; gap:8px; align-items:center; margin-bottom:16px; }',
    '.ws-search-overlay-input { flex:1; height:44px; padding:0 16px; font-size:16px; ',
    'background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.18); ',
    'border-radius:6px; color:#f8f6f1; outline:none; }',
    '.ws-search-overlay-close { background:transparent; border:none; color:#f8f6f1; ',
    'cursor:pointer; padding:8px; font-size:20px; }',
    '.ws-search-overlay-results { flex:1; overflow-y:auto; background:#fff; border-radius:8px; }',
    '.ws-search-overlay-results .ws-search-result { padding:14px 16px; }',
    '@media (max-width: 920px) { .ws-search-input { width:130px; } }',
    '@media (max-width: 720px) { .ws-search-wrap { display:none; } ',
    '.ws-search-mobile-btn { display:inline-flex; } }'
  ].join('\n');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  function loadIndex() {
    if (searchIndex || indexLoading) return indexLoading;
    indexLoading = fetch(INDEX_URL, { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) { searchIndex = Array.isArray(data) ? data : []; return searchIndex; })
      .catch(function () { searchIndex = []; return searchIndex; });
    return indexLoading;
  }

  // Score = sum of weighted hits across title (4x), keywords (3x), excerpt (1x).
  // Substring + token match, case-insensitive. Good enough for ~50 docs.
  function score(doc, q) {
    var s = 0;
    var qLower = q.toLowerCase();
    var titleLower = (doc.title || '').toLowerCase();
    var keywordsLower = (doc.keywords || '').toLowerCase();
    var excerptLower = (doc.excerpt || '').toLowerCase();

    if (titleLower.indexOf(qLower) !== -1) s += 12;
    if (keywordsLower.indexOf(qLower) !== -1) s += 8;
    if (excerptLower.indexOf(qLower) !== -1) s += 3;

    qLower.split(/\s+/).filter(Boolean).forEach(function (tok) {
      if (titleLower.indexOf(tok) !== -1) s += 4;
      if (keywordsLower.indexOf(tok) !== -1) s += 3;
      if (excerptLower.indexOf(tok) !== -1) s += 1;
    });

    return s;
  }

  function search(q) {
    if (!searchIndex) return [];
    return searchIndex
      .map(function (d) { return { doc: d, s: score(d, q) }; })
      .filter(function (m) { return m.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 8)
      .map(function (m) { return m.doc; });
  }

  function highlight(text, q) {
    if (!text) return '';
    var safe = text.replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
    if (!q) return safe;
    var escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp('(' + escaped + ')', 'gi'), '<mark>$1</mark>');
  }

  function renderResults(container, matches, q) {
    if (!matches.length) {
      container.innerHTML = '<div class="ws-search-empty">No matches for "' +
        highlight(q, '') + '"</div>';
      container.hidden = false;
      return;
    }
    container.innerHTML = matches.map(function (doc) {
      return '<a class="ws-search-result" href="' + doc.url + '">' +
        '<div class="ws-meta">' + (doc.kind || 'Page') + '</div>' +
        '<div class="ws-title">' + highlight(doc.title || doc.url, q) + '</div>' +
        '<div class="ws-excerpt">' + highlight(doc.excerpt || '', q) + '</div>' +
      '</a>';
    }).join('');
    container.hidden = false;
  }

  function wireSearch(input, results) {
    var debounce = null;
    input.addEventListener('focus', loadIndex);
    input.addEventListener('input', function (e) {
      var q = e.target.value.trim();
      clearTimeout(debounce);
      if (q.length < 2) { results.hidden = true; return; }
      debounce = setTimeout(function () {
        loadIndex().then(function () {
          renderResults(results, search(q), q);
        });
      }, 80);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { results.hidden = true; input.blur(); }
    });
    document.addEventListener('click', function (e) {
      if (!results.contains(e.target) && e.target !== input) results.hidden = true;
    });
  }

  function init() {
    var navLinks = document.querySelector('.site-nav .nav-links');
    if (!navLinks) return;
    var ctaLi = navLinks.querySelector('.nav-cta-li');
    if (!ctaLi) return;

    // Desktop search input
    var searchLi = document.createElement('li');
    searchLi.className = 'ws-search-li';
    searchLi.innerHTML =
      '<div class="ws-search-wrap">' +
        '<input type="search" class="ws-search-input" placeholder="Search..." aria-label="Search the site" autocomplete="off">' +
        '<div class="ws-search-results" role="listbox" hidden></div>' +
      '</div>' +
      '<button class="ws-search-mobile-btn" aria-label="Open search">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>' +
      '</button>';
    navLinks.insertBefore(searchLi, ctaLi);

    var input = searchLi.querySelector('.ws-search-input');
    var results = searchLi.querySelector('.ws-search-results');
    wireSearch(input, results);

    // Mobile overlay
    var mobileBtn = searchLi.querySelector('.ws-search-mobile-btn');
    var overlay = document.createElement('div');
    overlay.className = 'ws-search-overlay';
    overlay.innerHTML =
      '<div class="ws-search-overlay-bar">' +
        '<input type="search" class="ws-search-overlay-input" placeholder="Search..." aria-label="Search the site" autocomplete="off">' +
        '<button class="ws-search-overlay-close" aria-label="Close search">&times;</button>' +
      '</div>' +
      '<div class="ws-search-overlay-results"></div>';
    document.body.appendChild(overlay);

    var oInput = overlay.querySelector('.ws-search-overlay-input');
    var oResults = overlay.querySelector('.ws-search-overlay-results');
    var oClose = overlay.querySelector('.ws-search-overlay-close');
    wireSearch(oInput, oResults);

    mobileBtn.addEventListener('click', function () {
      overlay.classList.add('is-open');
      setTimeout(function () { oInput.focus(); }, 50);
    });
    oClose.addEventListener('click', function () { overlay.classList.remove('is-open'); });
    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') overlay.classList.remove('is-open');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
