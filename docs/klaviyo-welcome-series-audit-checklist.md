# Klaviyo Welcome Series — Audit Checklist Signups

A 5-email sequence that fires when someone signs up via the lead magnet
modal or sticky bar on wabashsystems.com. Goal: warm downloaders into
consultation bookings over a 14-day window.

---

## Flow trigger

The lead-magnet function (`functions/api/lead-magnet.js`) tags every
profile with these custom properties on signup:

- `lead_source`: either `exit-intent-audit` or `sticky-bar-audit`
- `lead_magnet`: `10-point-audit-checklist`

**Trigger this flow when:** profile property `lead_magnet` equals
`10-point-audit-checklist`.

This catches everyone who came in through the audit checklist regardless
of which surface they used (modal vs sticky bar), and excludes contact
form leads (which get a different sequence).

---

## Setup steps in Klaviyo

1. Klaviyo dashboard → **Flows** → **Create Flow**
2. Choose **Create from scratch**
3. Name it: `Audit Checklist Welcome Series`
4. Trigger: **Profile property changed** → property = `lead_magnet`,
   value = `10-point-audit-checklist`
5. Add 5 email actions with the time delays and content below
6. Set **Smart Sending** ON for all emails (skips anyone who's been sent
   another email in the last 16 hours — protects against accidental
   double-sends)
7. Set live (not draft) once you're happy with the previews

---

## Email 1 — Immediate (delivery)

**Send delay from trigger:** 0 minutes (immediate)

**Subject line:** Your audit checklist is here

**Preview text:** Plus a quick note about what to expect from me.

**Body:**

```
Hey,

Thanks for grabbing the 10-Point E-Commerce Audit Checklist. The PDF is
attached, and you can also re-download it any time at:

https://www.wabashsystems.com/lead-magnets/ecommerce-audit-checklist.pdf

Quick intro since you don't know me: I'm Andy Gray. I've spent 25 years
building and running e-commerce stores - most recently as the technical
lead on a $10M flooring operation - and I started Wabash Systems to help
small businesses across the Wabash Valley do this right.

Over the next two weeks I'll send you four more short emails: things I
see go wrong on small business sites all the time, a real client story,
one quick fix you can knock out this weekend, and an open invitation to
talk if you want. No spam, no daily emails, no funnel.

If you have questions about the checklist - or your situation specifically -
just reply to this email. It comes straight to me.

- Andy
Wabash Systems LLC
```

---

## Email 2 — Day 2 (education)

**Send delay from trigger:** 2 days

**Subject line:** The mistake I see in 80% of small business sites

**Preview text:** And it has nothing to do with design.

**Body:**

```
Hey,

A quick one. The single biggest gap I see auditing small business sites
isn't bad design or slow load times. It's missing trust signals.

Open your homepage right now. Without scrolling, can a stranger find:

- A real phone number (not a 1-800)
- Your physical address or service area
- Customer reviews or testimonials
- A clear next action (Buy / Book / Call)

If they can't see at least three of those without scrolling, you're
losing customers on every visit. They're not bouncing because of design
- they're bouncing because they can't tell if you're real.

In small-town Illinois and Indiana, a 618 area code beats a 1-800 every
time. "Serving Crawford County since 2014" carries more weight than any
fancy design flourish. People here want to know they're working with
someone local.

This is fix #4 in the audit checklist if you want the full version. Or
just open your homepage right now and add the missing pieces - it's
genuinely a 30-minute task.

Tomorrow's email is a real client story; I'll keep it short.

- Andy

P.S. If your site already has all four trust signals above the fold,
reply and tell me - I'd love to know what other gaps the audit surfaced
for you instead.
```

---

## Email 3 — Day 5 (case study / proof)

**Send delay from trigger:** 5 days

**Subject line:** How a Tulsa machine shop turned their site into a lead engine

**Preview text:** From "no online presence" to "dispatch in minutes."

**Body:**

```
Hey,

Quick story. A few weeks ago I finished a project for Titan Machine
Service - they fix CNC machines for shops across Oklahoma, Kansas,
Arkansas, Missouri, and Texas.

Their problem was specific: when a shop's CNC goes down at 6 AM, the
shop owner has minutes - not hours - to find someone, get them on the
phone, and dispatch a tech. The old site didn't help with any of that.

We built them a static-fast Astro site with a service request form
that pre-segments leads by urgency (Emergency / Quote / PM Program).
Sub-second loads on rural LTE. Schema.org structured data so Google
understands what they do. A PM cost estimator that engages prospects
mid-funnel.

The site doesn't try to be everything. It tries to do one thing
exceptionally well: get a panicked shop foreman to a dispatched tech in
under 5 minutes.

That focus is the secret to most good small-business websites. They're
not "online brochures" - they're a single-purpose tool that does one
thing well.

Full case study (with the technical details) is here:
https://www.wabashsystems.com/case-studies/titan-machine-service

What's the one thing your website should do better than anything else?
Reply and tell me - I'm curious.

- Andy
```

---

## Email 4 — Day 9 (tactical fix)

**Send delay from trigger:** 9 days

**Subject line:** One thing you can fix this weekend

**Preview text:** Free, takes an hour, immediate impact.

**Body:**

```
Hey,

If you do nothing else this month, do this:

Run your homepage through pagespeed.web.dev. Get the mobile score. If
it's below 50, your customers in Robinson, Vincennes, Sullivan, and
every other small town with rural broadband are bouncing before your
page finishes loading.

The fix is almost always one of three things:

1. A giant unoptimized hero image. If your homepage banner is over 500KB,
   resize it to web dimensions and run it through tinypng.com. Often
   takes a 30 score to 80.

2. Too many third-party scripts. Every Facebook pixel, chat widget,
   review widget, and analytics tag adds latency. Audit what's installed
   and cut anything you're not actively using.

3. Cheap hosting. If you're on a $3/month shared host, your site is
   one of 500 on the same server. Move to Cloudflare Pages (free) or a
   managed platform.

This is a Saturday-morning fix. By Sunday night you can have a faster
site, lower bounce rate, and better Google rankings. No agency required.

Pull up pagespeed.web.dev right now and check your score. Reply and tell
me what you got - I'm collecting data on small business performance
across the Wabash Valley.

- Andy
```

---

## Email 5 — Day 13 (soft close / consultation offer)

**Send delay from trigger:** 13 days

**Subject line:** Want me to look at your site?

**Preview text:** Free 30 minutes, no pitch. Just an honest answer.

**Body:**

```
Hey,

Last email in this little series. Quick offer.

If you've worked through the audit checklist and you're stuck on which
gap to fix first - or you'd just rather have an experienced second pair
of eyes walk through your site with you - I do free 30-minute
consultations.

Not a sales call. No pitch. We pull up your site, I look at it the same
way I'd look at it if you were a paying client, and you walk away with
the one or two things that'll actually move the needle for your
specific business.

If we're a good fit and you want to work together after that, great. If
not, you got 30 minutes of useful advice and a clearer picture of where
your site stands.

Either way, the conversation is free:
https://www.wabashsystems.com/booking

If now's not the right time, that's fine too. The audit checklist is
yours to keep, and you can always reply to any of these emails if a
question comes up later.

Thanks for paying attention this week. Good luck with your business.

- Andy
Wabash Systems LLC
agray@wabashsystems.com
```

---

## After the welcome series ends

Klaviyo will keep these profiles in your main email list. They become
candidates for:

- Monthly newsletter (when you start sending one)
- Retargeting for new content (blog posts, case studies)
- Promotional offers (rare; treat your list like a peer, not a target)

**Don't spam the list.** Sending more than 4-6 emails per month to a
list this small kills engagement faster than any subject line trick can
recover.

---

## Segmentation tip

Once you have 20-30 signups, build a Klaviyo segment:

- Filter: `Properties` -> `lead_magnet` equals `10-point-audit-checklist`
- AND: `Properties` -> `lead_source` is one of `exit-intent-audit` or
  `sticky-bar-audit`

Use that segment for any future content specifically targeted at people
who downloaded the audit checklist (vs. contact form leads, who are
warmer).

You can further split by `lead_source` to see whether exit-intent or
sticky-bar audiences convert differently. After 50+ signups the
data is meaningful.

---

## Maintenance

**Quarterly:** review the open rates and click rates on each email. The
benchmark for a B2B small-business welcome series in 2026 is roughly:

- Email 1 (delivery): 60%+ open rate (people are expecting it)
- Emails 2-4: 35-50% open rate
- Email 5 (close): 30-40% open rate, 5-15% click rate to /booking

If any email drops below those, rewrite the subject line first
(biggest impact). If that doesn't help, the body content needs work.

**Annually:** rotate at least one email's content. The Titan case study
in Email 3 will eventually feel dated. Replace with whatever's most
recent and relevant.
