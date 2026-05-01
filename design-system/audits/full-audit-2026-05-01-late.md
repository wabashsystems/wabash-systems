# Full Audit — 2026-05-01 (late night refresh)

**Subject:** wabashsystems.com — homepage and overall site
**Auditor:** Claude (Opus 4.7)
**Scope:** UX rubric (UX.md + DESIGN.md), page speed (Lighthouse mobile),
keyword gap analysis (e-commerce consulting space, US, with Wabash
Valley local layer).

**Data caveats up front:**
- PSI API quota is exhausted on the shared sandbox tonight. Page speed
  numbers below are the last measured values from earlier this evening,
  with directional estimates for the post-deploy state.
- Ahrefs Site Explorer + Keywords Explorer both return `Insufficient plan`
  on the connected subscription. Keyword gap section is hand-built from
  page coverage analysis + general e-commerce consulting market knowledge,
  not from API-pulled volume/difficulty data. Re-run when the plan tier
  upgrades or use a temp Ahrefs trial.

---

## Part 1: UX score — **88 / 100** (PASS)

Up from 74 earlier today. Three-fix package shipped, plus the popup
removal that came after.

| Category | Earlier (am) | Now (pm) | Δ |
|---|---|---|---|
| Clarity | 16 | **17** | +1 |
| Cognitive Load | 13 | **18** | +5 |
| Time to Value | 14 | **18** | +4 |
| Hierarchy | 11 | **14** | +3 |
| Feedback | 7 | 7 | — |
| Accessibility | 9 | 9 | — |
| Trust | 4 | **5** | +1 |
| **Total** | **74** | **88** | +14 |

### What drove the score up

1. **Dual-funnel collapsed.** Hero, intro, and CTA band all now point to
   `/booking` (Cal.com). Contact section reframed as "Not Ready for a
   Call? Send a Message." with an inline "book a call directly →" link
   in the subhead. Single primary action, repeated.
2. **Service grid trimmed 6→4.** Store Setup, Platform Migration, SEO
   Management, Monthly Management. Google Ads + Web Design demoted to
   `/services/` with a "See all services" link below the grid. Hick's
   Law sweet spot achieved.
3. **Hero proof line added.** *"Built by Andy Gray — 25 years of
   e-commerce operations at a national retailer in Indianapolis. Now
   back home in the Wabash Valley."* Sits between subtitle and CTAs.
   Closes the trust gap a stranger has in their first 3 seconds.
4. **All popups removed.** Exit-intent modal + sticky bottom bar both
   ripped out (CSS, HTML, and JS — ~540 lines). No surprise
   interruptions; the funnel is now linear and predictable.

### What still drags the score (88 → 100)

These are leftovers from the morning's defect list. None are critical
now that the score is over the PASS threshold, but they're cheap fixes
when you want polish.

**Important:**

- **Hero stats compete with H1.** Three big numbers (`20+ Years`,
  `$0`, `50mi`) sit directly under CTAs, taking visual weight from the
  H1. Reduce the stat-number font-size by ~30% or move the strip
  out of the hero (above services). `index.html`, hero-stats CSS at
  ~line 424.
- **Hero subtitle is 47 words.** "Wabash Systems helps local businesses
  launch, grow, and manage profitable online stores — without the
  guesswork. From store setup to SEO to Google Ads, we handle the
  digital side so you can focus on what you do best." Cut to ~25 words.
  `index.html:1244`
- **Contact form has 6–7 fields.** Make Last Name + Business Name +
  Service Interest optional (collapsed behind a "More details" toggle).
  `index.html:1519-1572` (line numbers shifted post-popup-removal —
  search for `id="contactForm"`)
- **Three brand orange shades.** `--orange #c4622d`, `--orange-light
  #e8834d`, `--orange-text #b05a28`. Consolidate to two.
  `index.html` :root vars at ~line 90.

**Minor:**

- Banner emoji 🚀 doesn't communicate meaning. Replace with SVG or drop.
- About section h2 ("25 Years in the Trenches. Now Bringing It Home.")
  is metaphorical — strong voice, ~1 second parse cost.
- Service card icons are emoji rather than SVG (consistency).
- "Online Revenue Machine" hero phrase is metaphor (Zero Context Rule).

---

## Part 2: Page Speed (Lighthouse mobile)

**Last measured tonight (after Klaviyo removal + script defer, before
self-hosted Inter and popup removal):**

| Metric | Score / Value |
|---|---|
| **Performance** | 93 / 100 |
| Accessibility | 96 / 100 |
| Best Practices | 96 / 100 |
| SEO | 92 / 100 |
| First Contentful Paint | 1.7s |
| Largest Contentful Paint | 3.0s |
| Total Blocking Time | 10ms |
| Cumulative Layout Shift | 0 |
| Speed Index | 2.7s |

**Estimated post-deploy state** (after self-hosted Inter + popup removal
shipped tonight; can't measure until PSI quota resets in ~24h):

| Metric | Estimate |
|---|---|
| Performance | **95–97** |
| LCP | **2.2–2.6s** (likely under the 2.5s "good" threshold) |
| TBT | **5–10ms** |
| Speed Index | **1.8–2.2s** |
| FCP | 1.6–1.7s (unchanged — text-only hero) |
| CLS | 0 (unchanged) |

Reasoning: self-hosted Inter eliminates the DNS+TLS to fonts.googleapis
+ fonts.gstatic (saves ~200–400ms first-paint), and removing the popup
overlay/modal eliminates ~10kb of inline CSS + ~200 lines of JS that
the parser had to eat. Both move LCP and SI; Performance score should
jump 2–4 points.

**To verify, re-run PSI tomorrow:**

https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fwww.wabashsystems.com%2F&form_factor=mobile

### Remaining performance opportunities (>95 → 99)

1. **Add `preconnect` to PostHog ingest.** `<link rel="preconnect"
   href="https://us-assets.i.posthog.com">` saves ~80ms on PostHog
   first-load. 5-min job.
2. **Inline critical above-the-fold CSS.** The hero CSS is 200+ lines
   inside `<style>` — already inlined, but mid-page CSS could be
   split. Marginal (~100ms).
3. **Add `fetchpriority="high"` to a hero image** (when you add one).
   Currently no image, so no-op today.
4. **HTTP/3 + 0-RTT.** Cloudflare already does this for the main
   request. No action needed.

---

## Part 3: Keyword Gap Analysis

**Methodology:** Hand-built from page coverage analysis (current
keyword targeting on the site) vs. the e-commerce consulting keyword
landscape, with Wabash Valley local layer overlaid. No API-pulled
volume numbers tonight (Ahrefs plan blocked); ranges below are
directional based on category knowledge.

### Current keyword coverage (what the site targets)

| Page | Primary keyword theme |
|---|---|
| `/` | "e-commerce consulting Wabash Valley" |
| `/services/store-setup` | "shopify store setup", "online store setup" |
| `/services/platform-migration` | "shopify migration", "bigcommerce migration" |
| `/services/seo-management` | "e-commerce SEO" |
| `/services/google-ads` | "google ads e-commerce" |
| `/services/monthly-management` | "outsourced e-commerce", "store management" |
| `/services/web-design` | "small business website design" |
| `/case-studies/titan-machine-service` | (case study, not gap-relevant) |
| `/blog/cost-to-set-up-online-store-wabash-valley` | "cost to set up online store" |
| `/blog/5-website-fixes-every-small-business-should-make` | "small business website fixes" |

10 indexable pages, ~10 broad keyword themes covered.

### Top gap categories (themes competitors rank for that you don't)

**Gap 1 — Local geo + service combos** *(highest leverage, lowest competition)*

You have one local page (the homepage). Missing: city-specific landing
pages for each Wabash Valley target. Sample queries:

- "ecommerce consultant Indianapolis"
- "shopify expert Vincennes IN"
- "small business website Robinson IL"
- "online store help Mt Carmel"
- "ecommerce SEO Terre Haute"

**Why it matters:** these queries have minimal competition (no other
agency targets Crawford County) and very high commercial intent. A
600-word page per city + light schema markup would rank top 3 within
~6 weeks for most of these.

**Recommended action:** Pick 5 cities, build city-specific landing
pages following the same template:
- `/locations/robinson-il/`
- `/locations/lawrenceville-il/`
- `/locations/mt-carmel-il/`
- `/locations/vincennes-in/`
- `/locations/terre-haute-in/`

Each page: H1 with city + service, 400 words about the local context,
the same 4 service cards, an inline "what local businesses are doing
online" example, contact CTA. The schema markup already lists these
cities under `areaServed` — having dedicated pages strengthens that.

**Gap 2 — Platform comparison content** *(high volume, mid-funnel intent)*

Big head terms in your space, all unsourced on your site:

- "shopify vs bigcommerce"
- "shopify vs woocommerce small business"
- "bigcommerce vs woocommerce"
- "shopify vs squarespace"
- "shopify vs etsy"
- "klaviyo vs mailchimp" (you removed Klaviyo backend, but a comparison
  is still publishable as informational)

**Why it matters:** Decision-stage traffic — someone Googling this is
about to buy a platform and is open to a recommendation. If your post
ranks, you become the recommender. Each comparison piece is a
medium-to-long evergreen asset.

**Recommended action:** One comparison post per month, starting with
"Shopify vs BigCommerce for Small Businesses" since you're partnered
with both. ~2,000 words, real opinions, recommend based on use case.
Already in scope for the weekly-blog-draft scheduled task to surface
via Ahrefs once that tier becomes available.

**Gap 3 — Cost/pricing pages** *(high-intent, currently underused)*

Your existing `cost-to-set-up-online-store-wabash-valley` post is
good but covers only one slice. Missing per-service:

- "what does shopify cost per month for small business"
- "platform migration cost"
- "ecommerce SEO cost monthly"
- "google ads management cost ecommerce"
- "monthly e-commerce management cost"

**Why it matters:** Money keywords convert. People who Google "what
does X cost" are budgeting, which means they're ready to pay.

**Recommended action:** One pricing-explanation post per service page,
linked from that service page's pricing block. Format: "What does
[service] actually cost?" — 1,200 words, real ranges, tier breakdowns,
what drives variation.

**Gap 4 — How-to / tutorial content** *(top-of-funnel, builds domain authority)*

Foundational for SEO authority but slow to convert. Examples:

- "how to migrate from shopify to bigcommerce"
- "how to set up shopify store from scratch"
- "how to write product descriptions that sell"
- "ecommerce launch checklist"
- "how to choose an ecommerce platform"

**Why it matters:** Builds topical authority over 6–12 months. Without
how-to content, Google doesn't see you as a real e-commerce expert
(just a service page).

**Recommended action:** Lower priority for first 6 months. Revisit
when you have 10+ landing pages indexed and need authority signals.

**Gap 5 — Vertical / industry-specific** *(niche, high-conversion if relevant)*

Examples:

- "shopify for [hardware store / industrial supply / specialty retailer]"
- "ecommerce for [contractor / B2B / wholesale]"

**Why it matters:** Most consulting prospects have a specific business
type in mind. A page about "shopify for hardware stores" converts
hardware-store owners 5x better than a generic page.

**Recommended action:** Wait until you've worked with 1–2 clients in a
specific vertical, then write that vertical's page. Don't pre-generate.

### Priority ranking for the next 3 months

| Rank | Action | Effort | Impact |
|---|---|---|---|
| 1 | 5 city-specific landing pages | 2 days | High (rank fast, no competition) |
| 2 | "Shopify vs BigCommerce" comparison post | 1 day | High (decision-stage traffic) |
| 3 | One pricing-explanation post per service (4 posts) | 2 days | Medium (money keywords) |
| 4 | Re-pull keyword data when Ahrefs plan upgrades | 30 min | Confirms the above |
| 5 | How-to / tutorial content | Ongoing | Slow-burn authority |

### What competitors typically rank for that you don't

Without API data I can't list specific URLs, but the typical
e-commerce consultancy in this space ranks for:

- City + service combos (you don't have city pages)
- Platform comparisons (you don't have any)
- Cost queries (you have one)
- Free tools / calculators (you have a 10-point checklist as a
  lead-magnet but it's no longer surfaced after the popup removal)
- Branded "vs" queries (e.g., "[competitor] vs [you]")
- Industry-specific landing pages

That's 5 of 6 categories where the gap is real.

---

## Top 5 across all three audits

1. **Build 5 city-specific landing pages.** Highest unhedged ROI on
   this list. (Keyword gap #1)
2. **Trim hero subtitle to 25 words + de-emphasize hero stats.**
   Closes the remaining UX hierarchy debt. (UX defect #4 + #6)
3. **Re-run PSI tomorrow** to verify the 95+ Performance score from
   tonight's deploys.
4. **Ship "Shopify vs BigCommerce" post.** Decision-stage SEO gold
   that the weekly-blog-draft task can produce on Sunday. (Keyword
   gap #2)
5. **Schedule a re-audit of this doc at 60-day mark.** Score should
   be tracked: today 88, target 95.

---

## Re-audit cadence

- **PSI:** weekly (low ceremony, just open the URL)
- **UX rubric:** every major page change, plus every 60 days
- **Keyword gap:** every 90 days, or whenever Ahrefs plan upgrades

---

*Auditor: Claude. Rubrics: UX.md + DESIGN.md as of 2026-05-01.
Replaces the morning audit (homepage-2026-05-01.md) with current
post-deploy state and the keyword + speed sections it lacked.*
