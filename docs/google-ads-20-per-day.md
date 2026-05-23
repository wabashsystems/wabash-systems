# Google Ads: $20/day audit-funnel playbook

**Last updated:** 2026-05-23
**Budget:** $20/day = $600/month cap
**Primary conversion:** `audit_run` (someone enters a URL on /audit and gets results)
**Secondary conversion:** `audit_email_captured` (someone gave us their email to see the full report)
**Goal:** 20-40 audit signups per month at a $15-30 CPA, building the top-of-funnel email list for retainer nurture.

---

## TL;DR

One Search campaign, three ad groups, US-wide, sending traffic to /audit. Spend two weeks collecting data before optimizing. Pause any keyword with 100+ clicks and zero conversions. Expect ~25 audits/mo by month two.

This plan is launchable in 60-90 minutes. The site itself is ready — /audit already converts, PostHog tracks events, cross-domain linker is configured.

---

## Account setup (do this once)

1. **Create Google Ads account** at ads.google.com. Sign in with the same Google account that owns Google Analytics 4 (so they auto-link).
2. **Link GA4** under Tools → Linked accounts → Google Analytics. This pulls /audit conversion events into Ads.
3. **Import conversion goals from GA4**:
   - `audit_run` → mark as primary conversion
   - `audit_email_captured` → secondary conversion
   - `contact_submitted` → secondary conversion
4. **Set timezone**: America/Indianapolis (matches business location). NOTE: this can't be changed later — get it right the first time.
5. **Set currency**: USD.
6. **Skip the "Smart Mode" prompt** — switch to Expert Mode immediately. Smart Mode hides the controls you need.
7. **Add billing**: business credit card. Set monthly invoicing if your spend exceeds $5K/mo (won't apply here).

---

## Campaign structure

### Campaign: "Audit funnel — US"

- **Type:** Search
- **Networks:** Google Search only. **Uncheck Display Network** (Display burns budget on low-intent impressions).
- **Bidding strategy:**
  - Week 1-2: **Maximize Clicks** with a max CPC cap of $3.00 (just for data collection)
  - Week 3+: switch to **Maximize Conversions** once you have ~15 conversions logged
- **Daily budget:** $20.00
- **Locations:** United States. Target "Presence: People in or regularly in your targeted locations" (not "interest in"). No exclusions yet.
- **Languages:** English
- **Ad rotation:** Optimize for conversions (default)
- **Ad schedule:** All days, all hours initially. Refine after 4 weeks of data.

### Three ad groups (by intent stage)

#### Ad Group 1: "Free audit" (high intent, ~50% of budget)

People actively looking for a site audit. Highest conversion rate, biggest budget share.

**Keywords (exact + phrase match):**
```
[free website audit]
[free seo audit]
[free site audit]
[free ecommerce audit]
[free shopify audit]
[free woocommerce audit]
[free site performance audit]
[website audit tool]
[ecommerce audit tool]
[seo audit tool]
"free website audit"
"free seo audit"
"ecommerce site audit"
"shopify site audit"
"woocommerce site audit"
"site audit report"
"website performance audit"
```

**Max CPC bid:** $2.50 (these convert; pay up)

#### Ad Group 2: "E-commerce help" (mid intent, ~35% of budget)

People with a problem (slow site, low conversions, platform questions) who don't know an audit is the answer. Send them to /audit anyway — the free audit is the lead magnet.

**Keywords (phrase + broad match):**
```
"ecommerce consultant"
"shopify consultant"
"woocommerce consultant"
"bigcommerce consultant"
"shopify performance"
"ecommerce site speed"
"ecommerce conversion optimization"
"shopify seo"
"woocommerce seo"
"why is my shopify slow"
"why is my ecommerce site slow"
"ecommerce performance optimization"
"ecommerce site audit"
"shopify site speed"
"speed up shopify"
"shopify migration help"
"woocommerce to shopify"
"ecommerce ux audit"
"ecommerce technical seo"
```

**Max CPC bid:** $1.75

#### Ad Group 3: "Brand defense" (~15% of budget)

Defend the brand against competitor bidding, capture people who heard about Wabash from a podcast/blog and Googled the name.

**Keywords (exact match):**
```
[wabash systems]
[wabash systems consulting]
[wabashsystems.com]
[wabash valley web design]
[wabash valley seo]
```

**Max CPC bid:** $0.50 (no one else should be bidding on these)

---

## Negative keywords (apply at campaign level)

These filter out unqualified traffic. Add as **broad match negatives**.

```
free template
free theme
free course
free training
free tutorial
free guide
free ebook
free download
jobs
careers
hiring
salary
internship
resume
cv
how to learn
how to become
udemy
coursera
linkedin learning
diy
agency vs freelancer
best agency
top 10 agencies
list of agencies
ranking
review
reddit
quora
medium
youtube
wikipedia
amazon
ebay
etsy
wholesale
dropshipping
print on demand
multilevel marketing
mlm
crypto
nft
blockchain
ai generated
chatgpt audit
write my essay
homework
class
school project
```

Add ~50 more as data comes in. Use the **Search Terms report** weekly to spot waste.

---

## Ad copy

### Ad Group 1: "Free audit" RSAs (Responsive Search Ads)

**Headlines (15 — Google rotates 3 at a time):**
1. Free E-Commerce Site Audit
2. Get Your Site Audited Free
3. Instant E-Commerce Audit
4. Free Shopify & Woo Audit
5. Free Performance + SEO Audit
6. Real Audit, Not a PDF Template
7. See Your Site's Top 5 Issues
8. Built by E-Commerce Operators
9. No Sales Pitch, No Credit Card
10. 30-Second Audit, Real Findings
11. Same Engine Our Clients Pay For
12. Audit Your Site in 30 Seconds
13. E-Commerce Audit — Free Today
14. Find What's Killing Conversions
15. Free Audit for E-Commerce Sites

**Descriptions (4 — Google rotates 2 at a time):**
1. Free instant audit. PageSpeed score, platform detection, top issues. Built on the same engine our retainer clients pay for.
2. We're a boutique e-commerce consulting team. Get the same site audit our paying clients receive — no card required, no follow-up call required.
3. Catch what's slowing your store down. Free audit returns the top 5 issues plus a prioritized fix list. 30 seconds, no signup.
4. Midwest e-commerce consulting, serving clients nationwide. Free audit shows you the issues, then you decide if you want help.

**Sitelinks (4):**
1. Pricing → /pricing
2. Case Studies → /case-studies/
3. Our Approach → /about
4. Book a Call → /booking

**Callouts (4):**
1. Free Audit, No Signup
2. Real E-Commerce Operators
3. 20+ Years Experience
4. Retainer-Only Model

**Structured snippets (1):**
- Header: "Services"
- Values: Performance Audit, SEO Management, Platform Migration, Shopify Development

### Ad Group 2: "E-commerce help" RSAs

**Headlines (15):**
1. E-Commerce Consulting Help
2. Shopify + WooCommerce Experts
3. Free E-Commerce Site Audit
4. Slow Site? Get a Free Audit
5. Low Conversions? Audit It Free
6. Boutique E-Commerce Consulting
7. Fix Your Store's Top Issues
8. E-Commerce Site Audit — Free
9. 20+ Years E-Commerce Experience
10. Real Operators, Not an Agency
11. Free Diagnostic, Then You Decide
12. Built for Midwest E-Commerce
13. Get Specific About Your Issues
14. Audit-First Consulting Model
15. Performance + SEO + Conversion

**Descriptions (4):**
1. Slow site, low conversions, platform questions? Start with our free audit. We tell you what's broken before we propose anything.
2. Boutique e-commerce consulting for SMBs. Free site audit returns the top 5 issues — no sales call required.
3. Shopify, BigCommerce, WooCommerce specialists. Free audit shows you what to fix; you decide if you want help fixing it.
4. We're e-commerce operators ourselves, not generalists. Free audit, transparent pricing, retainer-only engagement model.

**Sitelinks, callouts, snippets:** same as Ad Group 1.

### Ad Group 3: "Brand defense" RSAs

**Headlines (10 — fewer needed):**
1. Wabash Systems — Official
2. Wabash Systems E-Commerce Consulting
3. Wabash Systems Free Site Audit
4. Wabash Systems Pricing
5. Wabash Systems Case Studies
6. Wabash Systems Wabash Valley
7. Wabash Systems About
8. Wabash Systems Book a Call
9. Wabash Systems Services
10. Wabash Systems Blog

**Descriptions (4):**
1. The official Wabash Systems site. Boutique e-commerce consulting. Free site audit, transparent pricing, retainer model.
2. Looking for Wabash Systems? You're in the right place. Free audit, real case studies, transparent pricing.
3. Wabash Systems — boutique e-commerce consulting team. Midwest-rooted, serving clients nationwide. Start with a free audit.
4. Need to reach Wabash Systems? Book a call, get a free audit, or read recent case studies. We respond same-day.

---

## Conversion tracking

GA4 is wired with these PostHog-equivalent events (per prior agent work):
- `audit_run` → primary
- `audit_email_captured` → secondary
- `contact_submitted` → secondary
- `newsletter_signup` → secondary
- `roi_calculator_unlock` → secondary

In Google Ads:
1. Tools → Conversions → New conversion action → Import → Google Analytics 4 → Web
2. Pick the events above
3. Set `audit_run` as the **primary** conversion (used for bid optimization)
4. Set the others as **secondary** (counted but not optimized for)

Conversion window: 30 days click-through, 1 day view-through.

---

## Week-by-week ramp + optimization rhythm

### Week 1: Data collection
- **Don't change anything.** Let it run. You'll feel the urge to optimize after 2 days — resist.
- End of week: confirm at least 200 impressions per ad group. If under that, broaden match types.

### Week 2: First negative-keyword pass
- Open the **Search Terms report**. Look at every term you got an impression on.
- Add as negatives: any term that's obviously not a fit (jobs, courses, free templates, etc).
- Don't pause any keywords yet — too early.

### Week 3: First bid adjustments
- Look at keyword performance: cost per conversion.
- Drop max CPC by 20% on any keyword spending >$30 with no conversions.
- Raise max CPC by 20% on any keyword with 2+ conversions at a CPA below $20.

### Week 4: Ad copy variants
- If a Responsive Search Ad has a Best-rated headline + a Low-rated headline, swap the Low one for a fresh test variant.
- Pin the best-converting headline to position 1 if you find a clear winner.

### Month 2 onward
- Weekly: Search Terms report → add negatives, check waste
- Bi-weekly: pause anything that's underperforming for 100+ clicks
- Monthly: review Ad Group performance, shift budget toward winners

---

## Kill criteria (no exceptions)

- **Keyword with 100+ clicks and 0 conversions** → pause
- **Ad with <2% CTR after 500 impressions** → swap copy
- **Ad Group with $200+ spend and 0 conversions in 4 weeks** → pause the whole ad group, reallocate budget
- **Campaign CPA > $40 for 30 consecutive days** → re-evaluate the whole funnel (likely audit page issue, not ads)

---

## Quality Score levers

Quality Score affects your CPC — higher score, lower cost per click. Three components:

1. **Expected CTR**: improved by tighter keyword-to-ad relevance. Each ad group's RSA headlines should match the keyword theme.
2. **Ad Relevance**: keywords in the ad copy. Note the ad copy above uses "audit", "ecommerce", "shopify", "woocommerce" matching the keywords.
3. **Landing Page Experience**: /audit page speed + content match. Already strong per the perf audit. Just make sure /audit doesn't break.

---

## Expected economics

| Metric | Conservative | Realistic | Optimistic |
|--------|-------------|-----------|------------|
| Daily spend | $20 | $20 | $20 |
| Monthly spend | $600 | $600 | $600 |
| Avg CPC | $2.50 | $2.00 | $1.50 |
| Monthly clicks | 240 | 300 | 400 |
| Conversion rate (audit_run) | 8% | 12% | 18% |
| Monthly audits | 19 | 36 | 72 |
| CPA | $31 | $17 | $8 |
| Email captures (60% of audits) | 12 | 22 | 43 |
| Email-to-call rate (8%) | 1 | 2 | 3 |
| Calls-to-retainer (15%) | ~0 | 0-1 | ~1 |
| Expected new retainers/mo | 0-1 | 0-1 | 1-2 |

**Payback analysis:** at $1500/mo average retainer + 12mo avg client lifetime = $18K LTV. ROAS positive after the first retainer signs (which happens in months 1-3 at realistic numbers).

**Reality check:** retainer sales cycle is 30-60 days. Month 1 won't produce signed retainers; it builds the email list. Plan for 3 months of spend before evaluating ROI.

---

## What you'll need from us next

After 4 weeks of data:
1. Search Terms review → bigger negative keyword list
2. Keyword performance review → kill underperformers, raise bids on winners
3. Ad copy variant test → pick winning headlines
4. Landing page A/B (if /audit conversion rate < 8%) → test variant of headline/CTA

If you want, after 4 weeks I can write a follow-up "month 1 performance review + recommendations" doc.

---

## Open questions / decisions deferred

- **Google Display Network**: skipping for now. Revisit only after we have 6 months of Search data + a clear retargeting use case.
- **YouTube ads**: skipping. Too expensive for top-of-funnel at this budget.
- **Performance Max**: skipping. Burns budget on low-quality placements at this spend level. Revisit when monthly spend > $2K.
- **Smart Shopping / Demand Gen**: not applicable (we're not a product retailer).
- **Lookalike audiences**: requires GA4 audience > 1000 users. Revisit at month 6.

---

## Reference

- Google Ads Help: [support.google.com/google-ads](https://support.google.com/google-ads)
- Quality Score deep dive: [support.google.com/google-ads/answer/6167118](https://support.google.com/google-ads/answer/6167118)
- Search Terms report: Tools → Reports → Search Terms
- Recommendations page: ignore most of them; they push you toward Smart features that surrender control
