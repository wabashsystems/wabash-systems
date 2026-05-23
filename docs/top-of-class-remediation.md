# Top-of-class remediation roadmap

**Audit date:** 2026-05-23
**Source:** 7 parallel audit agents — ADA, Performance, SEO+AEO, Security, CRO/UX, Code quality, Content/brand
**Bottom line:** ~120-130 hours of focused work to clear every finding. **~25-30 hours of "first sprint" fixes close the 80/20 gap to "top of class."**

---

## Severity legend

- **P0** — Inviolable-rule violation, broken page, blocks user, or active security risk. Fix immediately.
- **P1** — Major friction or quality issue. Cleared by end of first sprint.
- **P2** — Minor friction, easy polish. Backlog.
- **P3** — Cosmetic / nice-to-have.

**Effort:** S = <1h · M = 1-4h · L = 4-8h · XL = full day+

---

## The First-100-Points Sprint (one focused week, ~25-30 hours)

These fixes give you 80% of the perceived quality lift. Do these before anything else.

### Block 1: Inviolable-rule violations (5-7h)

The site contains explicit violations of the constraints documented in memory + CLAUDE.md.

| # | Finding | File:Line | Effort |
|---|---------|-----------|--------|
| 1 | **70+ I-voice instances** across service pages, audit page, pricing FAQ, blog posts, and FAQ JSON-LD. Site is supposed to be we-voice. | `services/seo-management.html:508,596,600,605,611,635,648,654,659,685,708`, `services/google-ads.html:44,63,71,79,87,498-499,544-545,565,571,594,601,604,620,631,636,641,646`, `services/bigcommerce-development.html:50,58,74,90,545,564,587,590,592,605,610,620,624,630`, `services/performance-audit.html:344,348,438,448,504,567,569,570,596,600,606,616`, `services/index.html:459,477,649-651`, `pricing.html:102,107,110,690,963,967,968,979-981`, `audit.html:613,633,815,833`, `case-studies/index.html:494`, `blog/why-your-google-ads-campaign-isnt-profitable.html:385,391,393,395,398,401,406,432`, `blog/5-website-fixes-every-small-business-should-make.html:297,310-311,439,461-463,492,596`, `blog/shopify-vs-bigcommerce-small-business.html:392,413,438`, `blog/cost-to-set-up-online-store-wabash-valley.html:408,478,585,676`, `blog/index.html:534` | L (4-6h) |
| 2 | **Founder bio ceiling violations** — "16 years on one storefront" + specific $700-800K/mo monthly revenue claim on homepage hero stats. Memory rule: max "20+ years building and operating high-traffic e-commerce." | `index.html:1249, 1257` | S (15 min) |
| 3 | **Hero testimonial is a TODO placeholder** — code comment confirms it's pending Jeremiah's permission. Either get sign-off and ship it, or pull the block. | `index.html:1081-1089` | S (1 email) |
| 4 | **Years inconsistency** — homepage says "20+ years," blog posts say "25 years" — pick one. | `blog/why-your-google-ads-campaign-isnt-profitable.html:393`, `blog/cost-to-set-up-online-store-wabash-valley.html:676` | S (30 min) |

### Block 2: Conversion mismatch on homepage (1h)

Homepage CTAs push to `/booking` despite `/audit` being the stated #1 conversion goal. This is the single biggest CRO opportunity.

| # | Finding | File:Line | Effort |
|---|---------|-----------|--------|
| 5 | Swap homepage hero primary CTA from "Book a Free Consultation" → `/booking` to "Run a Free Audit" → `/audit`. Demote booking to secondary CTA. Estimated lift: 30-60% on top-of-funnel email captures. | `index.html` hero buttons | S |
| 6 | Add "Start with the free audit →" inline CTA on `/pricing` above the fold. | `pricing.html` | S |

### Block 3: ADA critical fixes — admin app (4-6h)

The public site is mostly clean. The admin app needs mechanical sweeps.

| # | Finding | File:Line | Effort |
|---|---------|-----------|--------|
| 7 | **Universal label/control disassociation** — ~120 admin form labels lack `for=`. Screen readers announce "edit text." Mechanical sweep across 16 files. | `lamp/index.php, clients.php, lead.php, lead_new.php, prospect_view.php, proposals.php, proposal_new.php, invoice_new.php, time_tracker.php, freelance.php, prospects.php, audit_admin.php, account_2fa.php, client_report.php, includes/deep_audit.php` | L (4h) |
| 8 | **Table headers missing `scope`** — 198 `<th>` tags across the admin, 0 have `scope="col"` or `scope="row"`. Screen-reader table navigation broken. | All admin tables — `clients.php, invoices.php, prospects.php, lead.php, proposals.php, time_tracker.php, freelance.php, rank_tracker.php, etc.` | M (3h) |
| 9 | **Dropdown ARIA broken** — `aria-haspopup`+`aria-expanded` declared but never updated (CSS-only hover); `role="menu"`+`role="menuitem"` declared without keyboard arrow-key support. Drop the ARIA roles entirely; let nav be a list of links. | `lamp/includes/nav.php:356-358, 372-374, 396-398, 412-414, 438-440` | M (2h) |
| 10 | **Select onchange auto-submit** traps keyboard users — arrow keys trigger navigation. | `lamp/index.php:1003` + similar | M (2h) |

### Block 4: Security P1s (6-8h)

| # | Finding | File:Line | Effort |
|---|---------|-----------|--------|
| 11 | **13 admin POST handlers missing CSRF guards.** Highest-impact: `index.php` "email_all" bulk action lets an attacker fire mass outreach. | `lamp/index.php:45, invoice_new.php:67, lead_new.php:54, proposal_new.php:35, invoice_view.php:39, proposal_view.php:20, prospect_view.php:26, outreach_review.php:142, outreach_health.php:23, client_report.php:149, freelance.php:121, time_tracker.php:33, admin/api/toggle_email_exclude.php` | M (3h) |
| 12 | **Hardcoded `REPLACE_WITH_SECRET` fallback** in `lamp/api/leads.php` — if env var ever unset, this string becomes a valid bearer token. Replace with explicit fail-closed. | `lamp/api/leads.php:19` | S (5 min) |
| 13 | **No rate limit on `/admin/login` (CF Pages)** — brute-forceable up to CF's default DDoS limit. Mirror the LAMP `login_attempts` pattern with KV-backed bucket. | `functions/admin/login.js:24` | M (2h) |
| 14 | **Stale duplicate API tree** — `lamp/admin/api/*.php` vs `lamp/api/*.php`, 8 files diverged. `resend_webhook.php` lost 38 lines of Klaviyo "Outreach Engaged" logic in the older copy. Retire one tree. | `lamp/admin/api/` and `lamp/api/` | S-M (1h) |

### Block 5: SEO+AEO P0s (3h)

| # | Finding | File:Line | Effort |
|---|---------|-----------|--------|
| 15 | **Blog `BlogPosting.author` is Organization, not Person** — kills E-E-A-T for AI citation. Convert to a `Person` (Andy Gray, jobTitle, sameAs LinkedIn/GitHub, worksFor → Org) across all 7 posts. | `blog/*.html` (all 7) | M (1.5h) |
| 16 | **Homepage Organization `logo` is `favicon.svg`** (32px). Google's logo guidance requires ≥112×112. Use `/brand-assets/wabash-logo.png` (already correct on about.html). | `index.html:22-126` schema | S (10 min) |
| 17 | **Locations index card grid links only 5 of 10 location pages.** Five effectively-orphaned city pages. | `locations/index.html` | S (15 min) |
| 18 | **Homepage Organization `founder` self-references the Org `@id`** (circular). Add a Person node for Andy Gray. | `index.html` schema | S (15 min) |

### Block 6: Code quality + deploy fixes (2-3h)

| # | Finding | File:Line | Effort |
|---|---------|-----------|--------|
| 19 | `deploy.ps1` **doesn't check `$LASTEXITCODE`** after git push, wrangler, or Copy-Item. Silent partial deploys possible. | `deploy.ps1` | S (20 min) |
| 20 | `deploy.ps1` **`Copy-Item -Recurse -Force` doesn't mirror deletes** — renamed/deleted source files leak old copies that ship forever. Switch to `robocopy /MIR` or explicit cleanup. | `deploy.ps1` | S (30 min) |
| 21 | **`wabash-systems/.gitignore` is UTF-16-corrupted** (effectively empty). Rewrite as ASCII. | `C:\Users\andy\wabash-systems\.gitignore` | S (5 min) |
| 22 | **3 ESLint warnings** (unused vars). | `functions/admin/login.js:83`, `functions/api/audit.js:143`, `functions/lib/sentry.js:52` | S (5 min) |

### Block 7: /audit page perf scaffolding (1h)

| # | Finding | File:Line | Effort |
|---|---------|-----------|--------|
| 23 | `/audit` page is missing the head pattern other pages have — no preconnect, no font preload, no deferred-analytics loader, no Clarity. `posthog.capture()` calls on lines 715, 821 are no-ops because PostHog never loads. Copy the head from `pricing.html`. **~300-500ms LCP improvement on cold mobile + finally tracks audit conversions.** | `audit.html:23-37` | S (5 min) |
| 24 | **Cal.com preconnect missing** on `/booking`. Cal.com is the page's primary content. Add `<link rel="preconnect" href="https://app.cal.com" crossorigin>`. **150-300ms faster calendar render.** | `booking.html:47-50` | S (2 min) |
| 25 | **Microsoft Clarity loaded eagerly** on every page. Move into the existing deferred `loadAnalytics()` IIFE. **50-150ms TBT savings on mid-tier mobile.** | `index.html:1001, pricing.html:632, booking.html:539, etc.` | S (10 min) |

### Block 8: Founder identity + 2nd case study (3-4h)

Trust gap is the biggest barrier to $1k-$2.5k/mo retainer signups. Solo operators win on credibility through a face, not "our team."

| # | Finding | File:Line | Effort |
|---|---------|-----------|--------|
| 26 | **Add named founder bio + photo on `/about`** and an "About Andy →" tile on `/`. Decide single inbox (about.html schema uses `andy.gray@`, index.html uses `info@` — mismatch). | `about.html, index.html` | M (2h) |
| 27 | **Resolve about.html JSON-LD broken logo URL** — references `brand-assets/wabash-logo.png` which doesn't exist (actual files: `wabash-logo-horizontal-1200x720.png` etc). | `about.html:65` schema | S (5 min) |
| 28 | **Add screenshots / before-after / images to Titan case study.** Strongest piece of work, currently text-only. | `case-studies/titan-machine-service.html` | M (2h) |

---

**Sprint total: ~25-30 hours**

Outcomes after this sprint:
- All inviolable-rule violations cleared (legal + memory)
- Homepage finally optimized for stated #1 conversion goal (audit)
- Admin app passes screen-reader baseline
- No silent deploys; no broken nav; no dropdown ARIA fakery
- 13 CSRF holes closed (including the "fire mass outreach" exposure)
- AEO author authority restored (Person schema on all blog posts)
- /audit page finally tracks conversions correctly
- Founder name + face visible (trust signal)
- 2nd real testimonial-worthy artifact (Titan case study with images)

You should see measurable lift in audit signups + retainer-call rate within 2-4 weeks of this sprint shipping.

---

## Backlog after the sprint (P1 + P2, ordered by leverage)

### Round 2: ADA cleanup (~9h) — clears WCAG 2.1 AA

| # | Finding | Effort |
|---|---------|--------|
| 29 | Swap orange `#c4622d` → `--orange-button #ae5320` on `.btn-primary`, `.form-submit`, newsletter Subscribe button. Hover state `--orange-light` drops to 2.88:1 — replace. | M (3h) |
| 30 | Admin app: add global `:focus-visible` rule + skip-nav + `<main id="main" tabindex="-1">`. | M (3h) |
| 31 | Admin app: swap `--c-orange` link color for a darker token (currently 4.43:1, fails AA). | M (2h) |
| 32 | Mobile drawer focus trap (public site). | M (1h) |
| 33 | `booking.html:596` `role="banner"` on inner header — remove. Homepage missing `aria-current="page"` on its nav — add. | S (15 min) |
| 34 | Audit page error + loading state announcements (`role="alert"`, `role="status" aria-live="polite"`). | S (30 min) |
| 35 | Audit + ROI calculator email inputs: add `<label for=>` / `aria-label`. | S (15 min) |

### Round 3: Content + brand polish (~8-10h)

| # | Finding | Effort |
|---|---------|--------|
| 36 | Rewrite homepage hero H1 — "Turn Your Small Business Into an Online Revenue Machine" reads agency-cliché. | S (15 min) |
| 37 | Remove "best-in-class" 2x from `services/shopify-development.html:35, 502`. | S (5 min) |
| 38 | Generate **per-category OG images** (one each for blog, case-studies, services, locations). Current single generic OG image kills social CTR. | M (2h) |
| 39 | Ship Etsy migration blog post (already drafted in `blog/drafts/`). | M (1h) |
| 40 | Write **AEO Hub** pillar page linking the 3 AEO blog posts + the AEO service page. Internal-linking play. | M (2h) |
| 41 | Write a **Shopify vs WooCommerce** comparison post (mirror of the existing Shopify vs BigCommerce). | M (2h) |
| 42 | Write **"When NOT to migrate your store"** contrarian post. | M (2h) |

### Round 4: SEO+AEO polish (~3h)

| # | Finding | Effort |
|---|---------|--------|
| 43 | Footer + nav service links go to `/#services` anchor — replace with deep URLs (`/services/aeo`, `/services/store-setup`, etc.) across 6 footer links + nav. | S (30 min) |
| 44 | BlogPosting `image` references `favicon.svg` on every post. Either generate per-post images or use a proper OG image URL. | M (1.5h depending on image generation path) |
| 45 | Service pages have `og:type="article"` — should be `"website"`. 11 files. | S (15 min) |
| 46 | `llms.txt` missing `/audit`, `/services/performance-audit`, `/pricing`, `/about`, and all 7 blog posts. | S (30 min) |
| 47 | HowTo schema on `blog/how-to-get-cited-by-chatgpt.html` + `blog/5-website-fixes-every-small-business-should-make.html`. | M (45 min) |
| 48 | Sitemap priority: `services/performance-audit` 0.98 vs `/` 1.0 — normalize. | S (5 min) |

### Round 5: CRO depth (~10-14h)

| # | Finding | Effort |
|---|---------|--------|
| 49 | Add hamburger menu to `/audit`, `/pricing`, `/services/` (currently mobile users on these pages can't reach nav items). | S (20 min) |
| 50 | Audit-page success state: results-personalized CTA ("Your PSI is 47 — here's what 75 would earn you. Book a call →"). | M (2h) |
| 51 | Mobile sticky bottom CTA on long pages (blog, service, pricing). | M (3h) |
| 52 | Service pages: pull a case-study tile forward (currently only discoverable via homepage portfolio). | M (1.5h) |
| 53 | ROI calculator: show one number unblurred (conservative monthly lift), gate the rest. Increases email unlock rate. | S (30 min) |
| 54 | Audit URL pre-fill collision (`value="https://www."` + placeholder). Drop the pre-fill. | S (5 min) |

### Round 6: Code quality (~5-6h)

| # | Finding | Effort |
|---|---------|--------|
| 55 | Extract Klaviyo logic to `functions/lib/klaviyo.js` (currently quadruple-duplicated across contact/audit/newsletter/roi_capture). | M (1.5h) |
| 56 | Extract shared base.css (CSS vars + nav + footer + buttons) instead of redeclaring across 42 HTML files. | L (3h, touches every page) |
| 57 | Extract GitHub API helpers to `functions/lib/github.js` (currently triplicated in blog publish/delete/list). | S (30 min) |
| 58 | Extract deferred-analytics IIFE to `/js/analytics-loader.js` (currently duplicated in 39 HTML files). | M (1h) |
| 59 | Fix `publish.js:74` markdown code-span placeholder collision (`/ (\d+) /g` is false-positive-prone). | S (15 min) |

### Round 7: Security P2 (~12-16h)

| # | Finding | Effort |
|---|---------|--------|
| 60 | DNS-rebinding TOCTOU in `lamp/api/public_audit.php:104` — resolve hostname once, pin via cURL `--resolve`. | M (2h) |
| 61 | Encrypt TOTP secrets at rest in `admin_users.totp_secret` (currently plaintext). | M (3h) |
| 62 | Generate 8 single-use TOTP backup codes at enrollment. Hash + store. | M (3h) |
| 63 | Remove `script-src 'unsafe-inline'` from CSP — hash or nonce every inline script. | L (4-5h) |
| 64 | Add per-IP rate limiting to `/api/contact`, `/api/newsletter`, `/api/roi_capture`. KV-backed bucket or Turnstile. | M (2h) |
| 65 | Strip `_klaviyo_debug` + `err.message` from production 500 responses. | S (15 min) |
| 66 | Upgrade ESLint 8.57 → 9.x (8.x EOL, no security updates). | S (30 min) |

---

## P3 backlog (cosmetic / nice-to-have)

- Mojibake on `404.html` title + several other pages (encoding inconsistency). S
- Per-location LocalBusiness schema lacks `telephone`, `priceRange` generic, no `sameAs` to GBP. M
- `services/aeo.html` Service.name contains literal `&amp;mdash;` HTML entity. S
- Pricing.html could use `OfferCatalog` instead of single Service + nested Offers. M
- `js/search.js`, `js/posthog-init.js` use `var` — modernize when next touched. S
- `auth.php:15` magic number `4 * 3600` — extract to constant. S
- 40+ run-*.ps1 wrappers at workspace root — consider `scripts/` subfolder. S
- Inconsistent `declare(strict_types=1)` across PHP. S
- Commit messages all timestamps — semantic messages would help git archaeology. User-owned.

---

## Effort breakdown by track

| Track | Sprint hours | Backlog hours | Total |
|-------|--------------|----------------|-------|
| ADA | 4-6h (admin sweeps) | 9h | 13-15h |
| Performance | 1h | 0.5h | 1.5h |
| SEO+AEO | 3h | 3h | 6h |
| Security | 6-8h | 12-16h | 18-24h |
| CRO/UX | 1h | 10-14h | 11-15h |
| Code quality | 2-3h | 5-6h | 7-9h |
| Content/brand | 5-7h | 8-10h | 13-17h |
| Founder identity + case study | 3-4h | — | 3-4h |
| **TOTAL** | **~25-30h** | **~50-60h** | **~75-95h** |

The original "120-130h to clear everything" estimate from agent reports included P2 + P3 polish. The ~75-95h figure above covers everything through P2 and skips the cosmetic P3 backlog.

---

## Verification approach (per category)

After each block ships, verify:

- **ADA:** axe DevTools clean (browser extension) + manual keyboard pass (Tab through every interactive element on top 5 pages + admin lead.php + admin invoices.php).
- **Performance:** Lighthouse before/after on mobile + desktop. Target 95+ across Performance, Accessibility, Best Practices, SEO on top 5 pages.
- **SEO+AEO:** [Schema.org validator](https://validator.schema.org) clean + [Google Rich Results Test](https://search.google.com/test/rich-results) on representative pages (homepage, a blog post, a service page, a location page).
- **Security:** [securityheaders.com](https://securityheaders.com) A+ rating. [Mozilla Observatory](https://observatory.mozilla.org) A+ rating. Manual CSRF test (try POSTing without token, expect 403).
- **CRO:** A/B test if traffic supports it; else heuristic before/after via PostHog funnel.
- **Code quality:** ESLint clean, `php -l` clean on every PHP file, no `console.log`, no dead imports.
- **Content/brand:** grep for forbidden words ("I", "me", "my", "flooring", "Indianapolis", "best-in-class") = zero hits.

---

## What's already top-of-class (don't churn these)

- HTML payloads <70KB on every page. No `<img>` tags anywhere — all SVG + emoji. Zero LCP-image risk.
- Sentry + PostHog properly deferred via `requestIdleCallback`. Cross-domain linker configured.
- `_headers` is well-thought-out: HSTS preload, per-route CSP, strict Permissions-Policy, COOP/CORP.
- Stripe webhook has signature verification + idempotency table + prepared statements.
- TOTP implementation is RFC-correct (SHA-1, 30s, ±1 window).
- HMAC-signed session cookies for admin auth (HttpOnly + Secure + SameSite=Strict).
- Audit.js SSRF protection (private CIDR blocklist) thorough.
- 40 unique titles, 38 unique meta descriptions, 40 canonicals — no duplicates.
- robots.txt allows AI crawlers (correct for AEO positioning).
- Speakable schema on every blog post (rare — most sites don't bother).
- BreadcrumbList on every interior page.
- llms.txt exists and is well-formatted.
- Universal `lang="en"`. Public site has skip-nav + `:focus-visible` on every page.
- Consistent breakpoints (720px, 900px, 600px) across 42 HTML files.
- `prospect_helpers.php`, `invoice_helpers.php`, `outreach_email.php` are nicely factored.
- `deploy-lamp.ps1` retry + timestamp + exit-code semantics are production-quality.

---

## Greenlight to start implementation?

If you want me to execute Block 1-8 of the sprint, the work parallelizes well:

- **Agent X:** Inviolable-rule sweep (I-voice, bio ceiling, years inconsistency, testimonial decision) — 5-7h
- **Agent Y:** Admin ADA mechanical sweeps (labels, table scope, dropdown ARIA, select onchange) — 4-6h
- **Agent Z:** Security P1 backfill (CSRF on 13 handlers, leads.php fallback, admin login rate limit, retire duplicate API tree) — 6-8h
- **Agent W:** SEO+AEO P0s (Person author, logo fix, locations index card grid, founder Person node) — 3h
- **Agent V:** Homepage CTA swap + pricing inline CTA + /audit perf scaffolding + booking preconnect + Clarity defer — 2-3h
- **Agent U:** Deploy script hardening + .gitignore + ESLint warnings — 1-2h
- **Manual (you):** founder bio + photo + about.html schema email decision + Jeremiah testimonial decision

Total parallel runtime: ~30 minutes of agent work, then a deploy.

When you're ready, say the word and I'll launch the sprint.
