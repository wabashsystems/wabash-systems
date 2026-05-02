// functions/admin/api/blog/publish.js
//
// Publish a blog post from the admin UI.
//
// Receives raw markdown + post metadata, renders to HTML, splices the
// post card into blog/index.html, appends the URL to sitemap.xml, and
// commits all three changes to GitHub via the Contents API. The next
// time auto-push.ps1 runs (every 30 min via Windows Task Scheduler, or
// manually), it pulls + deploys.
//
// Required Cloudflare Pages env vars:
//   GITHUB_TOKEN  - fine-grained PAT for wabashsystems/wabash-systems
//                   with Repository contents: Read and Write permission
//   GITHUB_OWNER  - "wabashsystems"
//   GITHUB_REPO   - "wabash-systems"
//   GITHUB_BRANCH - "main"  (defaults to "main" if unset)
//
// Protected by /admin/_middleware.js (cookie auth via SESSION_SECRET).

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const VALID_SERVICES = [
  'aeo',
  'store-setup',
  'platform-migration',
  'seo-management',
  'google-ads',
  'monthly-management',
  'web-design',
];

const VALID_CATEGORIES = [
  'AEO',
  'Quick Wins',
  'E-Commerce',
  'SEO',
  'Google Ads',
  'Platform Migration',
  'Strategy',
  'Local Business',
];

// Markdown parser
// Hand-rolled minimal markdown -> HTML for blog post bodies. Handles:
// h1-h3, paragraphs, bold/italic, inline code, fenced code blocks,
// unordered + ordered lists, blockquotes, hr, links. Edge-cases beyond
// that fall through as-is, which is fine for our voice (the source posts
// don't use anything fancier).

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  return escapeHtml(s);
}

// Inline transforms applied to a single line of paragraph/heading/list-item
// text. Applied in this order so links don't get bold-mangled etc.
function applyInline(text) {
  // Code spans first - protect their contents from other transforms.
  const codes = [];
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(escapeHtml(code));
    return ` ${codes.length - 1} `;
  });

  // Escape HTML in the rest of the text.
  text = escapeHtml(text);

  // Links: [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    return `<a href="${escapeAttr(url)}">${label}</a>`;
  });

  // Bold and italic. Bold first (** wraps, * wraps after).
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
  text = text.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Restore code spans.
  text = text.replace(/ (\d+) /g, (_, i) => `<code>${codes[Number(i)]}</code>`);

  return text;
}

function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      const cls = lang ? ` class="lang-${escapeAttr(lang)}"` : '';
      out.push(`<pre><code${cls}>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // Headings
    let m;
    if ((m = line.match(/^### (.+)$/))) { out.push(`<h3>${applyInline(m[1].trim())}</h3>`); i++; continue; }
    if ((m = line.match(/^## (.+)$/)))  { out.push(`<h2>${applyInline(m[1].trim())}</h2>`); i++; continue; }
    if ((m = line.match(/^# (.+)$/)))   { out.push(`<h1>${applyInline(m[1].trim())}</h1>`); i++; continue; }

    // Horizontal rule
    if (/^(-{3,}|_{3,}|\*{3,})\s*$/.test(line)) {
      out.push('<hr />');
      i++;
      continue;
    }

    // Blockquote (single or multi-line)
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote><p>${applyInline(buf.join(' ').trim())}</p></blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
        items.push(applyInline(lines[i].replace(/^[-*+]\s+/, '').trim()));
        i++;
      }
      out.push('<ul>' + items.map(it => `<li>${it}</li>`).join('') + '</ul>');
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(applyInline(lines[i].replace(/^\d+\.\s+/, '').trim()));
        i++;
      }
      out.push('<ol>' + items.map(it => `<li>${it}</li>`).join('') + '</ol>');
      continue;
    }

    // Blank line
    if (/^\s*$/.test(line)) { i++; continue; }

    // Paragraph - collect consecutive non-blank, non-block lines
    const paraLines = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^#{1,3} /.test(lines[i]) &&
      !/^[-*+]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^(-{3,}|_{3,}|\*{3,})\s*$/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      out.push(`<p>${applyInline(paraLines.join(' ').trim())}</p>`);
    }
  }

  return out.join('\n');
}

// Date helpers

function formatDateDisplay(yyyyMmDd) {
  // "2026-04-29" -> "April 29, 2026"
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[m - 1]} ${d}, ${y}`;
}

function estimateReadTime(markdown) {
  // ~225 wpm reading speed; round up to nearest minute.
  const words = wordCount(markdown);
  return Math.max(2, Math.ceil(words / 225));
}

function wordCount(markdown) {
  // Strip code fences, then count alphanumeric word tokens.
  const stripped = markdown.replace(/```[\s\S]*?```/g, ' ');
  const matches = stripped.match(/[A-Za-z0-9]+/g);
  return matches ? matches.length : 0;
}

function extractLede(markdown) {
  // First paragraph after the front matter / first H1 - used as the
  // hero subtitle. Strip markdown formatting for plain-text use.
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  // Skip leading blank/heading/code/HR lines
  while (i < lines.length && (
    /^\s*$/.test(lines[i]) ||
    /^#{1,6} /.test(lines[i]) ||
    /^```/.test(lines[i]) ||
    /^(-{3,}|_{3,}|\*{3,})\s*$/.test(lines[i])
  )) {
    i++;
  }
  const buf = [];
  while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^#{1,6} /.test(lines[i])) {
    buf.push(lines[i]);
    i++;
  }
  // Strip basic markdown for plain text
  return buf.join(' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
    .slice(0, 220);
}

// HTML template
// One big template literal. Mirrors the structure + CSS of the existing
// blog posts. Update this and the existing posts together if styling changes.

function renderPostHtml(p) {
  const url = `https://www.wabashsystems.com/blog/${p.slug}`;
  const titleHtml    = escapeHtml(p.title);
  const descHtml     = escapeHtml(p.description);
  const ledeHtml     = escapeHtml(p.lede);
  const titleJson    = JSON.stringify(p.title);
  const descJson     = JSON.stringify(p.description);
  const dateDisplay  = formatDateDisplay(p.date);
  const categoryJson = JSON.stringify(p.category || 'E-Commerce');
  const wcJson       = JSON.stringify(p.word_count || 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titleHtml} | Wabash Systems</title>
  <meta name="description" content="${descHtml}" />
  <link rel="canonical" href="${url}" />

  <meta property="og:type" content="article" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${titleHtml}" />
  <meta property="og:description" content="${descHtml}" />
  <meta property="article:published_time" content="${p.date}" />
  <meta property="article:author" content="Andy Gray" />

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": ${titleJson},
    "description": ${descJson},
    "datePublished": "${p.date}",
    "dateModified": "${p.date}",
    "author": {
      "@type": "Person",
      "name": "Andy Gray",
      "jobTitle": "Founder & Lead Developer, Wabash Systems"
    },
    "publisher": { "@id": "https://www.wabashsystems.com/#organization" },
    "mainEntityOfPage": { "@type": "WebPage", "@id": "${url}" },
    "image": "https://www.wabashsystems.com/favicon.svg",
    "url": "${url}",
    "inLanguage": "en-US",
    "wordCount": ${wcJson},
    "articleSection": ${categoryJson},
    "isAccessibleForFree": true
  }
  </script>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.wabashsystems.com/" },
      { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://www.wabashsystems.com/blog/" },
      { "@type": "ListItem", "position": 3, "name": ${titleJson}, "item": "${url}" }
    ]
  }
  </script>

  <link rel="preload" href="/fonts/Inter-Variable.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

  <!-- Deferred third-party analytics: load after interaction or 3.5s timeout
       so Sentry + PostHog don't block the initial render or inflate TBT. -->
  <script>
    (function () {
      var loaded = false;
      function loadAnalytics() {
        if (loaded) return;
        loaded = true;
        var srcs = [
          "/js/sentry-init.js",
          "https://js.sentry-cdn.com/8b2571b52de8397c9d84aac021fd805a.min.js",
          "/js/posthog-init.js"
        ];
        srcs.forEach(function (src) {
          var s = document.createElement("script");
          s.src = src;
          s.async = true;
          if (src.indexOf("sentry-cdn") !== -1) s.crossOrigin = "anonymous";
          document.head.appendChild(s);
        });
      }
      ["scroll", "mousedown", "keydown", "touchstart"].forEach(function (ev) {
        window.addEventListener(ev, loadAnalytics, { once: true, passive: true });
      });
      setTimeout(loadAnalytics, 3500);
    })();
  </script>

  <style>
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
      src: url('/fonts/Inter-Variable.woff2') format('woff2');
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --navy: #0d1a2a; --navy-mid: #1a2e44; --navy-light: #1a4a6e;
      --orange: #c4622d; --orange-light: #e8834d;
      --orange-text: #a04e22;
      --orange-button: #ae5320;
      --cream: #f8f6f1; --gray-light: #f2f4f7;
      --gray-mid: #606673; --white: #ffffff;
    }
    html { scroll-behavior: smooth; }
    body { font-family: 'Inter', sans-serif; color: var(--navy); background: var(--white); line-height: 1.7; padding-top: 110px; }
    .skip-nav { position: absolute; left: -100%; top: 8px; background: var(--orange); color: var(--white); padding: 12px 24px; font-weight: 600; z-index: 9999; text-decoration: none; }
    .skip-nav:focus { left: 0; }
    :focus-visible { outline: 3px solid var(--orange); outline-offset: 3px; border-radius: 3px; }
    :focus:not(:focus-visible) { outline: none; }

    .announcement-banner { background: var(--navy-mid); color: var(--white); text-align: center; padding: 10px 20px; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; position: fixed; top: 0; left: 0; right: 0; z-index: 200; border-bottom: 2px solid var(--orange); }
    .announcement-banner span.thin { opacity: 0.85; font-weight: 400; margin-left: 8px; }

    nav.site-nav { position: fixed; top: 38px; left: 0; right: 0; z-index: 100; background: var(--navy); display: flex; align-items: center; justify-content: space-between; padding: 0 5%; height: 72px; box-shadow: 0 2px 20px rgba(0,0,0,0.3); }
    .nav-logo { display: flex; align-items: center; gap: 12px; text-decoration: none; }
    .nav-logo svg { width: 52px; height: 31px; }
    .nav-brand { display: flex; flex-direction: column; line-height: 1.1; }
    .nav-brand-top { font-family: Georgia, serif; font-size: 16px; font-weight: 700; letter-spacing: 3px; color: var(--cream); }
    .nav-brand-sub { font-size: 9px; letter-spacing: 4px; color: var(--orange-light); text-transform: uppercase; }
    .nav-links { display: flex; align-items: center; gap: 32px; list-style: none; margin: 0; padding: 0; }
    .nav-links a { color: var(--cream); text-decoration: none; font-size: 14px; font-weight: 500; letter-spacing: 0.5px; opacity: 0.85; transition: opacity 0.2s, color 0.2s; }
    .nav-links a:hover, .nav-links a.is-active { opacity: 1; color: var(--orange-light); }
    .nav-cta { background: var(--orange-button) !important; color: var(--white) !important; padding: 10px 22px !important; border-radius: 6px !important; opacity: 1 !important; font-weight: 600 !important; }
    .nav-cta:hover { background: var(--orange-light) !important; }
    @media (max-width: 720px) { nav.site-nav { padding: 0 20px; height: 64px; } .nav-brand { display: none; } .nav-links { gap: 14px; } .nav-links li:not(.nav-cta-li) { display: none; } body { padding-top: 102px; } }

    .post-hero { background: linear-gradient(135deg, var(--navy) 0%, var(--navy-mid) 100%); color: var(--white); padding: 64px 32px 80px; position: relative; overflow: hidden; }
    .post-hero::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 6px; background: var(--orange); }
    .post-hero-inner { max-width: 800px; margin: 0 auto; }
    .breadcrumb { font-size: 12px; color: rgba(255,255,255,0.55); margin-bottom: 20px; letter-spacing: 1px; text-transform: uppercase; }
    .breadcrumb a { color: rgba(255,255,255,0.75); text-decoration: none; }
    .breadcrumb a:hover { color: var(--white); }
    .post-meta-top { display: flex; gap: 16px; align-items: center; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px; color: rgba(255,255,255,0.7); margin-bottom: 16px; }
    .post-meta-top .cat { color: var(--orange-light); }
    .post-hero h1 { font-family: Georgia, serif; font-size: 40px; font-weight: 700; line-height: 1.2; margin-bottom: 16px; }
    .post-hero .lede { font-size: 17px; color: rgba(255,255,255,0.78); }
    @media (max-width: 720px) {
      .post-hero { padding: 48px 20px 64px; }
      .post-hero h1 { font-size: 28px; }
      .post-hero .lede { font-size: 15px; }
    }

    main { padding: 64px 32px; }
    article { max-width: 740px; margin: 0 auto; }
    article h2 { font-family: Georgia, serif; font-size: 28px; font-weight: 700; color: var(--navy); margin-top: 48px; margin-bottom: 18px; line-height: 1.25; }
    article h3 { font-size: 18px; font-weight: 700; color: var(--navy); margin-top: 28px; margin-bottom: 10px; }
    article p { font-size: 17px; color: var(--navy); margin-bottom: 20px; }
    article p strong { font-weight: 700; }
    article a { color: var(--orange-text); text-decoration: underline; text-underline-offset: 3px; }
    article a:hover { color: var(--orange); }
    article ul, article ol { margin: 0 0 20px 24px; }
    article li { font-size: 17px; color: var(--navy); margin-bottom: 8px; }
    article blockquote { border-left: 4px solid var(--orange); background: var(--cream); padding: 20px 24px; margin: 32px 0; font-style: italic; border-radius: 0 6px 6px 0; }
    article blockquote p { margin-bottom: 0; }
    article pre { background: var(--gray-light); padding: 16px; border-radius: 6px; overflow-x: auto; margin: 20px 0; font-size: 14px; }
    article code { background: var(--gray-light); padding: 2px 6px; border-radius: 3px; font-size: 0.92em; }
    article pre code { background: transparent; padding: 0; font-size: inherit; }
    article hr { border: none; border-top: 1px solid var(--gray-light); margin: 36px 0; }

    .end-cta { background: var(--navy); color: var(--white); padding: 56px 32px; text-align: center; }
    .end-cta h2 { font-family: Georgia, serif; font-size: 26px; color: var(--white); margin-bottom: 14px; }
    .end-cta p { color: rgba(255,255,255,0.78); max-width: 540px; margin: 0 auto 24px; }
    .btn-orange { display: inline-block; background: var(--orange-button); color: var(--white); padding: 12px 28px; border-radius: 6px; font-weight: 700; text-decoration: none; font-size: 14px; letter-spacing: 0.5px; transition: background 0.15s; }
    .btn-orange:hover { background: var(--orange-light); }

    .related { background: var(--cream); padding: 48px 32px; border-top: 1px solid var(--gray-light); }
    .related-inner { max-width: 800px; margin: 0 auto; }
    .related h3 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: var(--gray-mid); margin-bottom: 14px; }
    .related a { display: block; font-family: Georgia, serif; font-size: 22px; font-weight: 700; color: var(--navy); text-decoration: none; line-height: 1.3; }
    .related a:hover { color: var(--orange); }
    .related-arrow { font-size: 13px; color: var(--orange-text); font-weight: 600; margin-top: 8px; letter-spacing: 0.3px; }

    footer { background: var(--navy); padding: 56px 5% 32px; }
    .footer-top { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 64px; padding-bottom: 48px; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .footer-brand p { font-size: 14px; color: rgba(248,246,241,0.55); line-height: 1.7; margin-top: 16px; max-width: 300px; }
    .footer-col-title { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: var(--orange-light); font-weight: 600; margin-bottom: 20px; }
    .footer-links { list-style: none; display: flex; flex-direction: column; gap: 12px; padding: 0; margin: 0; }
    .footer-links a { font-size: 14px; color: rgba(248,246,241,0.6); text-decoration: none; transition: color 0.2s; }
    .footer-links a:hover { color: var(--orange-light); }
    .footer-bottom { display: flex; justify-content: space-between; align-items: center; padding-top: 32px; font-size: 13px; color: rgba(248,246,241,0.65); flex-wrap: wrap; gap: 12px; }
    @media (max-width: 900px) { .footer-top { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 600px) { .footer-top { grid-template-columns: 1fr; } }
  </style>
    <!-- Microsoft Clarity -->
    <script type="text/javascript">(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","wkk97tce6q");</script>
</head>
<body>

<a href="#main" class="skip-nav">Skip to main content</a>

<div class="announcement-banner" role="region" aria-label="Site announcement">
  <span aria-hidden="true">&#128640;</span> Serving the Wabash Valley &mdash; Illinois &amp; Indiana<span class="thin">&mdash; Now Accepting Early Clients</span>
</div>

<nav class="site-nav" aria-label="Main navigation">
  <a href="/" class="nav-logo" aria-label="Wabash Systems home">
    <svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="400" height="240" rx="4" fill="#0d1a2a"/>
      <clipPath id="navClipBlogPost"><rect x="0" y="0" width="400" height="240" rx="4"/></clipPath>
      <path d="M0 140 Q40 80 80 120 Q120 160 160 105 Q200 50 240 100 Q280 145 320 115 Q360 85 400 105" fill="none" stroke="#1a4a6e" stroke-width="28" stroke-linecap="round" clip-path="url(#navClipBlogPost)"/>
      <path d="M0 140 Q40 80 80 120 Q120 160 160 105 Q200 50 240 100 Q280 145 320 115 Q360 85 400 105" fill="none" stroke="#c4622d" stroke-width="3.5" stroke-linecap="round" clip-path="url(#navClipBlogPost)"/>
      <rect x="0" y="155" width="400" height="85" fill="#0d1a2a" opacity="0.85" clip-path="url(#navClipBlogPost)"/>
      <text x="200" y="198" text-anchor="middle" font-family="Georgia, serif" font-size="28" font-weight="700" letter-spacing="4" fill="#f8f6f1">WABASH</text>
      <text x="200" y="222" text-anchor="middle" font-family="Georgia, serif" font-size="13" font-weight="400" letter-spacing="8" fill="#c4622d">SYSTEMS</text>
    </svg>
    <div class="nav-brand" aria-hidden="true">
      <span class="nav-brand-top">WABASH</span>
      <span class="nav-brand-sub">Systems</span>
    </div>
  </a>
  <ul class="nav-links" role="list">
    <li><a href="/#services">Services</a></li>
    <li><a href="/#about">About</a></li>
    <li><a href="/#portfolio">Portfolio</a></li>
    <li><a href="/blog/" class="is-active" aria-current="page">Blog</a></li>
    <li class="nav-cta-li"><a href="/booking" class="nav-cta">Free Consultation</a></li>
  </ul>
</nav>

<header class="post-hero">
  <div class="post-hero-inner">
    <div class="breadcrumb">
      <a href="/">Wabash Systems</a> &nbsp;/&nbsp; <a href="/blog/">Blog</a> &nbsp;/&nbsp; ${escapeHtml(p.category || 'E-Commerce')}
    </div>
    <div class="post-meta-top">
      <span class="cat">${escapeHtml(p.category || 'E-Commerce')}</span>
      <span>${dateDisplay}</span>
      <span>${p.read_time} min read</span>
    </div>
    <h1>${titleHtml}</h1>
    <p class="lede">${ledeHtml}</p>
  </div>
</header>

<main id="main" tabindex="-1">
  <article>
${p.body_html}
  </article>
</main>

<section class="end-cta">
  <h2>Want a second pair of eyes on your site?</h2>
  <p>Free 30-minute consultation, no pitch. We'll go through your specific situation and walk away with the one fix that'll move the needle most.</p>
  <a href="https://cal.com/wabashsystems" class="btn-orange">Book a Free Consultation</a>
</section>

<section class="related">
  <div class="related-inner">
    <h3>More from the blog</h3>
    <a href="/blog/">Browse all posts &rarr;</a>
    <div class="related-arrow">Continue reading</div>
  </div>
</section>

<footer>
  <div class="footer-top">
    <div class="footer-brand">
      <div class="nav-brand" aria-hidden="true">
        <span class="nav-brand-top" style="font-size:20px;">WABASH</span>
        <span class="nav-brand-sub">Systems</span>
      </div>
      <p>A boutique e-commerce consulting team helping small businesses grow online. Based in Crawford County, Illinois &mdash; serving Robinson, Lawrenceville, Mt. Carmel, Olney, and clients remotely nationwide.</p>
    </div>
    <div>
      <div class="footer-col-title">Services</div>
      <ul class="footer-links">
        <li><a href="/services/store-setup">Store Setup</a></li>
        <li><a href="/services/platform-migration">Platform Migration</a></li>
        <li><a href="/services/seo-management">SEO Management</a></li>
        <li><a href="/services/google-ads">Google Ads</a></li>
        <li><a href="/services/monthly-management">Monthly Management</a></li>
      </ul>
    </div>
    <div>
      <div class="footer-col-title">Company</div>
      <ul class="footer-links">
        <li><a href="/#about">About</a></li>
        <li><a href="/#process">How It Works</a></li>
        <li><a href="/#portfolio">Portfolio</a></li>
        <li><a href="/blog/">Blog</a></li>
        <li><a href="/#contact">Contact</a></li>
        <li><a href="/privacy">Privacy</a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <span>&copy; 2026 Wabash Systems LLC. All rights reserved.</span>
    <span>Wabash Valley &mdash; Illinois &amp; Indiana &middot; Remote E-Commerce Consulting</span>
  </div>
</footer>

</body>
</html>
`;
}

// GitHub helpers

async function ghHeaders(env) {
  return {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'wabashsystems-publish-fn',
    'Content-Type': 'application/json',
  };
}

function ghContentsUrl(env, path) {
  const owner = env.GITHUB_OWNER || 'wabashsystems';
  const repo  = env.GITHUB_REPO  || 'wabash-systems';
  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(path)}`;
}

function b64encode(s) {
  // btoa doesn't handle non-ASCII; encode via TextEncoder first.
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64decode(s) {
  const bin = atob(s.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function ghReadFile(env, path) {
  const branch = env.GITHUB_BRANCH || 'main';
  const res = await fetch(`${ghContentsUrl(env, path)}?ref=${encodeURIComponent(branch)}`, {
    headers: await ghHeaders(env),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub read ${path}: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return { sha: j.sha, content: b64decode(j.content) };
}

async function ghWriteFile(env, path, content, message, sha) {
  const branch = env.GITHUB_BRANCH || 'main';
  const body = {
    message,
    content: b64encode(content),
    branch,
  };
  if (sha) body.sha = sha;

  const res = await fetch(ghContentsUrl(env, path), {
    method: 'PUT',
    headers: await ghHeaders(env),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub write ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// Index splice + sitemap append

function buildIndexCard(p) {
  // Card format mirrors the existing blog/index.html cards exactly so
  // styling stays consistent. Initial letter of title becomes the thumb icon.
  const url = `/blog/${p.slug}`;
  const initial = (p.title || '?').trim().charAt(0).toUpperCase();
  return `    <article class="post-card">
      <div class="post-thumb"><span class="post-thumb-icon">${escapeHtml(initial)}</span></div>
      <div class="post-info">
        <div class="post-meta">
          <span class="post-cat">${escapeHtml(p.category || 'E-Commerce')}</span>
          <span>${formatDateDisplay(p.date)}</span>
        </div>
        <h2 class="post-title">
          <a href="${url}">${escapeHtml(p.title)}</a>
        </h2>
        <p class="post-excerpt">${escapeHtml(p.description)}</p>
        <a href="${url}" class="post-link">Read the full post &rarr;</a>
      </div>
    </article>
`;
}

function spliceIntoIndex(indexHtml, cardHtml) {
  // Insert immediately after the <!-- POST CARDS START --> marker if it
  // exists; otherwise insert at the start of the first <div class="posts">
  // or <main> we find. Final fallback: prepend before </main>.
  const marker = '<!-- POST CARDS START -->';
  if (indexHtml.includes(marker)) {
    return indexHtml.replace(marker, `${marker}\n${cardHtml}`);
  }
  // Try the posts container
  const m = indexHtml.match(/(<div[^>]*class="[^"]*\bposts\b[^"]*"[^>]*>)/);
  if (m) {
    return indexHtml.replace(m[1], `${m[1]}\n${cardHtml}`);
  }
  // Last resort: before </main>
  return indexHtml.replace(/<\/main>/, `${cardHtml}\n</main>`);
}

function buildSitemapEntry(p) {
  const url = `https://www.wabashsystems.com/blog/${p.slug}`;
  return `  <url>
    <loc>${url}</loc>
    <lastmod>${p.date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
}

function appendSitemap(sitemapXml, entry) {
  if (sitemapXml.includes(`https://www.wabashsystems.com/blog/${entry.slug || ''}`)) {
    // Already present; leave alone. (slug check is best-effort)
    return sitemapXml;
  }
  // Insert before </urlset>
  return sitemapXml.replace(/<\/urlset>/, `${entry.text}\n</urlset>`);
}

// Main handler

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.GITHUB_TOKEN) {
    return json({ error: 'GITHUB_TOKEN env var not configured.' }, 503);
  }

  let payload;
  try { payload = await request.json(); }
  catch { return json({ error: 'Invalid JSON body.' }, 400); }

  const {
    slug, title, description, primary_keyword, date,
    service_links, markdown, category,
  } = payload || {};

  // Validation
  if (!slug || !SLUG_RE.test(slug)) {
    return json({ error: 'Invalid slug. Must be lowercase kebab-case.' }, 400);
  }
  if (!title || title.length < 5 || title.length > 200) {
    return json({ error: 'Title must be 5-200 chars.' }, 400);
  }
  if (!description || description.length < 20 || description.length > 200) {
    return json({ error: 'Description must be 20-200 chars.' }, 400);
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ error: 'Invalid date. Use YYYY-MM-DD.' }, 400);
  }
  if (!markdown || markdown.length < 200 || markdown.length > 100000) {
    return json({ error: 'Markdown must be 200-100,000 chars.' }, 400);
  }
  if (category && !VALID_CATEGORIES.includes(category)) {
    return json({ error: `Invalid category. Use one of: ${VALID_CATEGORIES.join(', ')}.` }, 400);
  }
  const links = Array.isArray(service_links)
    ? service_links.filter(s => VALID_SERVICES.includes(s))
    : [];

  // Render
  const body_html  = markdownToHtml(markdown);
  const lede       = extractLede(markdown);
  const read_time  = estimateReadTime(markdown);
  const word_count = wordCount(markdown);
  const post = {
    slug, title, description, primary_keyword: primary_keyword || '',
    date, service_links: links, category: category || 'E-Commerce',
    body_html, lede, read_time, word_count,
  };
  const fullHtml = renderPostHtml(post);

  // Commit to GitHub
  // 3 PUTs in sequence: post, index, sitemap. Order matters - post first
  // so even if index/sitemap fail, the post page itself is live.
  try {
    // 1. New post file (no sha if it doesn't exist yet)
    const existingPost = await ghReadFile(env, `blog/${slug}.html`);
    await ghWriteFile(
      env,
      `blog/${slug}.html`,
      fullHtml,
      `blog: publish ${slug}`,
      existingPost ? existingPost.sha : undefined,
    );

    // 2. Update blog/index.html with new card
    const index = await ghReadFile(env, 'blog/index.html');
    if (index) {
      const newIndex = spliceIntoIndex(index.content, buildIndexCard(post));
      if (newIndex !== index.content) {
        await ghWriteFile(env, 'blog/index.html', newIndex, `blog: index card for ${slug}`, index.sha);
      }
    }

    // 3. Append to sitemap.xml
    const sitemap = await ghReadFile(env, 'sitemap.xml');
    if (sitemap) {
      const entry = buildSitemapEntry(post);
      const newSitemap = appendSitemap(sitemap.content, { text: entry, slug });
      if (newSitemap !== sitemap.content) {
        await ghWriteFile(env, 'sitemap.xml', newSitemap, `sitemap: add ${slug}`, sitemap.sha);
      }
    }
  } catch (err) {
    return json({ error: `GitHub commit failed: ${err.message}` }, 500);
  }

  return json({
    ok: true,
    slug,
    url: `https://www.wabashsystems.com/blog/${slug}`,
    note: 'Committed to GitHub. Live after next auto-push.ps1 run (or run it manually for instant publish).',
  });
}
