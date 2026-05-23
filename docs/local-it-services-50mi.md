# Local IT services within 50 miles of Robinson, IL (62433)

**Last updated:** 2026-05-23
**Status:** Strategy doc — not a launch plan. Conflict-of-interest gate per memory rule: lead-gen quietly until day-job ends, then promote.

---

## TL;DR

There's a viable $5K-15K/mo local IT business inside 50 miles of Robinson, IL — primarily small manufacturing, agribusiness back-office, oil & gas vendor shops, healthcare clinics, professional services (law/accounting/insurance), and independent retail. The opportunity sits in the gap between $50/hr Geek Squad and $200/hr metro-Indianapolis MSPs. Recommend offering five services under the Wabash Systems brand with a `/local` landing page, retainer-first pricing, and lead-gen via Chamber/BNI/referral relationships rather than paid ads. Realistic ramp: first $1K/mo client in 3-6 months, $5K/mo retainer base in 12 months.

---

## Geographic scope

50-mile radius of Robinson, IL covers:

| Town | County | State | Pop. | Drive time |
|------|--------|-------|------|------------|
| Robinson | Crawford | IL | 7,300 | 0 |
| Lawrenceville | Lawrence | IL | 4,400 | 25 min |
| Vincennes | Knox | IN | 17,400 | 35 min |
| Terre Haute | Vigo | IN | 60,500 | 60 min |
| Mt. Carmel | Wabash | IL | 6,900 | 40 min |
| Olney | Richland | IL | 8,800 | 35 min |
| Bridgeport | Lawrence | IL | 1,800 | 20 min |
| Marshall | Clark | IL | 3,800 | 35 min |
| Carmi | White | IL | 4,800 | 50 min |
| Mt. Vernon | Posey | IN | 6,700 | 55 min |
| Princeton | Gibson | IN | 8,700 | 60 min |
| Washington | Daviess | IN | 11,900 | 65 min |

**Total addressable population:** ~280K across 12 towns / 8 counties spanning the IL-IN border. Roughly 8,000-12,000 small businesses (rough estimate from county business pattern data, 2024 — verify before sales planning).

**Drive coverage:** anything within 60 minutes is comfortable same-day on-site. 90 minutes is workable for emergency calls. Beyond that, remote-only or scheduled visits.

---

## Local industry composition (where the money is)

Largest employers / sectors by economic significance:

1. **Marathon Petroleum refinery (Robinson)** — 700+ direct employees, plus a tail of vendor / contractor / service firms (welding shops, valve specialists, engineering consultancies, environmental testing labs). These vendors typically run 5-50 employees and have IT budgets but limited expertise.
2. **Agribusiness back-office** — grain elevators, seed dealers, equipment dealers (John Deere, Case IH dealerships), large family farms (1,000+ acres). Often run accounting software + precision-ag software that needs networking + integration help.
3. **Healthcare** — small clinics, dental practices, optometrists, physical therapy. HIPAA-bound, predictable IT spend, sticky retainer relationships.
4. **Professional services** — law firms (3-10 attorneys), CPA firms, insurance agencies, real estate offices. Compliance + document management needs.
5. **Independent retail + restaurants** — single-location boutiques, hardware stores, restaurants. Low budget but high volume; point-of-sale + ecom + WiFi work.
6. **Light manufacturing** — small precision machining shops, fabrication shops, food processors. Often have aging Windows XP/7 systems controlling equipment, need network segmentation + backup.
7. **Trades** — construction, plumbing, electrical, HVAC contractors. Mobile workforce, need cloud-based field service software + tablets + dispatch tools.
8. **Education** — small private schools, daycares. Limited budget but tax-favorable contracts.

What's NOT a target market here:
- **Large enterprise** — none in the area; they go to Indy/Chicago/St Louis firms anyway.
- **Tech startups** — almost none locally; chase remote work instead.
- **Government** — RFP-heavy, slow procurement, often locked into incumbent vendors.

---

## Competitive landscape (what's already serving this market)

**Direct local competitors (estimated):**
- 2-4 part-time IT contractors per town (often retired Marathon IT staff)
- 1-2 small MSPs in Terre Haute (Crossroads Tech, Tech Garage — verify current state)
- Larger regional MSPs from Evansville IN and Indianapolis IN that occasionally service the area
- Big-box: Best Buy Geek Squad (consumer-grade, not appropriate for business)

**Gaps in the current market:**
- Few competitors offer transparent fixed-fee retainer pricing — most are hourly with surprise invoices
- Most local IT shops focus on break-fix; very few do proactive security or cloud migration
- Almost none offer e-commerce expertise — this is your unique angle (bridges to Wabash Systems' core offer)
- Few offer NIST CSF / cybersecurity audit work at SMB price points

**Pricing benchmarks (local market intel needed — these are estimates):**
- Local hourly IT: $75-$125/hr
- Local MSP (per workstation): $80-$200/mo (many are under-priced for what they deliver)
- Indianapolis MSP (per workstation): $150-$300/mo
- Cybersecurity audit (Indy firms): $5K-$25K (way above local SMB budget)

**Your positioning play:** **fixed-fee retainers** + **upfront audits** + **e-commerce specialization** + **boutique service model** (one engineer per account, no junior-tech rotation).

---

## Five viable service offerings

### 1. Managed IT services (MSP retainer) — flagship offering

**What's included:**
- Endpoint patching (Windows updates, browser updates, app patches)
- Antivirus / EDR (recommend Bitdefender GravityZone Business Security or SentinelOne)
- Backup management (cloud-native: Datto, Acronis, or Veeam) — daily backups, 30-day retention minimum
- Help desk (email + phone, 4-hour SLA business hours)
- Quarterly security review + report
- Annual hardware/software inventory + lifecycle planning

**Pricing:** $300-$500/mo per workstation, sliding scale by org size

| Org size | Per-seat | 5-seat total | 10-seat total | 25-seat total |
|----------|----------|--------------|---------------|---------------|
| 1-5 seats | $500 | $2,500 | — | — |
| 6-15 seats | $400 | — | $4,000 | — |
| 16-50 seats | $300 | — | — | $7,500 |

**Onboarding:** $500-$1,500 one-time fee (covers asset audit, agent install, baseline backup verification)

**Target client profile:**
- 5-25 employees
- Uses email + line-of-business app + accounting software + maybe Office 365
- Currently no dedicated IT person (or has one part-time contractor)
- Has had at least one painful IT incident in last 12 months (server crash, ransomware, bad email)
- Pays for things on time

**Tools to standardize on:**
- RMM: NinjaOne or Atera ($1.50-$3/endpoint/mo — included in margin)
- Documentation: Hudu or IT Glue ($10-$30/user/mo)
- Ticketing: same RMM or Zoho Desk (free for <3 agents)
- Quoting: Quoter or just custom Wabash Systems invoice templates

### 2. Network + wireless infrastructure setup

**What's included:**
- Site survey (physical visit, RF analysis, switch port count, existing gear assessment)
- Design doc with bill of materials
- Procurement (we order through Provantage or D&H Distributing, mark up 10-15%)
- On-site install (mounting access points, running cable, configuring switches)
- VLAN / SSID configuration (guest network separation, IoT segmentation)
- Documentation handoff

**Pricing:** $500-$3,000 project depending on scope

| Scope | Price range |
|-------|------------|
| Single office, <2,500 sqft, 1-2 APs | $500-$1,000 |
| Multi-room office, 3-5 APs, switch + firewall | $1,500-$2,500 |
| Manufacturing floor with VLANs + segmentation | $2,500-$5,000+ |

**Vendor preference:** Ubiquiti UniFi for SMBs (cost-effective, no licensing) OR Meraki for enterprises that want managed support contracts.

**Add-on:** monthly managed wireless ($25-$50 per access point) for monitoring + firmware updates.

### 3. SMB cybersecurity audit (NIST CSF mini-assessment)

**What's included:**
- Stakeholder interview (60 min)
- Asset inventory walkthrough (employee count, devices, cloud services, vendors)
- Network scan (Nessus Essentials free tier or Greenbone open-source)
- Endpoint review (AV present? Backup working? Patching current?)
- Cloud config review (Office 365 / Google Workspace — MFA enforced? Sharing settings? Conditional access?)
- Written report mapped to NIST Cybersecurity Framework subcategories (Identify, Protect, Detect, Respond, Recover)
- 60-minute findings call
- Prioritized remediation roadmap

**Pricing:** $1,000-$2,500 fixed fee depending on org size

| Org size | Price | Timeline |
|----------|-------|----------|
| 1-10 employees | $1,000 | 1 week |
| 11-25 employees | $1,500 | 2 weeks |
| 26-50 employees | $2,000 | 2-3 weeks |
| 51-100 employees | $2,500 | 3-4 weeks |

**Conversion play:** ~30-40% of audit clients convert to an MSP retainer or a remediation project. The audit IS the sales tool.

**Compliance angle:** HIPAA-bound healthcare, SOC2-bound vendors to enterprise, CMMC-bound DoD subcontractors all need this. Don't claim certification work you can't deliver — partner with a compliance firm for actual SOC2 audit reports.

### 4. Cloud migration projects

**Most common scenarios:**
- On-prem Exchange → Office 365 / Google Workspace
- On-prem file server → SharePoint / OneDrive or Google Drive
- On-prem QuickBooks → QuickBooks Online (often co-sold with bookkeeper)
- Self-hosted business app → cloud version of same vendor

**Pricing:** $1,000-$5,000 project depending on complexity

| Scope | Price |
|-------|-------|
| Email migration (mailbox count <25) | $1,000-$1,500 |
| Email migration (25-50) | $1,500-$2,500 |
| File server → cloud (TB scale, permissions mapping) | $2,500-$5,000 |
| Full migration package (email + files + apps) | $5,000-$10,000 |

**Add-on retainer:** post-migration MSP relationship covers the "we broke something, fix it" support that always comes up in the first 90 days.

### 5. Custom local-business websites + ecommerce

**What's included:**
- Discovery (2-3 hours)
- Design + content collection
- Build (Shopify or WooCommerce per fit)
- Google Business Profile setup + verification
- On-page SEO (title tags, meta, schema, sitemap)
- Mobile + desktop QA
- Training (1-hour handoff)
- 30-day warranty period

**Pricing:** $2,500-$8,000 project depending on scope

| Scope | Price |
|-------|-------|
| Single-page brochure + GBP | $2,500-$3,500 |
| 5-7 page brochure site | $3,500-$5,500 |
| Brochure + product catalog (no checkout) | $5,000-$7,000 |
| Full Shopify/WooCommerce store | $5,500-$8,000+ |

**Add-on retainer:** $500-$1,500/mo for ongoing SEO, content, ad management, product updates. (This is where the long-term value is — match-funded to the Wabash Systems retainer model.)

**Key differentiator vs. local "web guys":** real e-commerce expertise + transparent pricing + actual SEO/AEO work, not just "I built you a Wix site for $500."

---

## What NOT to offer locally

**Skip these (low margin, high friction, wrong fit):**

- **VoIP / phone systems** — saturated by national MSPs (RingCentral, Dialpad direct-sell). Margins are thin. Only do this as a tag-along to an MSP relationship.
- **Data recovery** — too specialized, too liability-heavy. Refer to DriveSavers or Secure Data Recovery and take a small referral fee.
- **Break-fix without retainer** — race to the bottom. Don't be the "call when something's broken" person. Frame everything as a retainer-or-project conversation.
- **Residential / consumer IT** — Geek Squad territory. Time sink. Says nothing about your brand. Refer to a local "I fix PCs" person.
- **Hardware sales standalone** — you're not Dell. Sell hardware as part of a project, never as a profit center.
- **Printer support** — soul-crushing. Refer to a local print/copier dealer.
- **Helpdesk-only model** — locks you into hourly thinking. Always pair helpdesk with retainer + proactive work.

---

## Lead-generation channels (local)

In rough order of expected ROI:

### Tier 1 (highest ROI, lowest cost)

1. **Referrals from existing clients** — once you have your first 3 clients, ask each for 1-2 intros. Local business networks are tight. A warm intro from a trusted peer is worth 50 cold calls.
2. **Referral partnerships with bookkeepers / CPAs** — when they migrate a client to QuickBooks Online, they need an IT person. Offer a $250 referral fee per signed client.
3. **Referral partnerships with insurance agents** (especially commercial liability + cyber insurance writers) — they have an interested third-party motivation to recommend you, since better IT = lower claims.
4. **Robinson Chamber of Commerce + Crawford County Development Corporation** — annual membership ~$400-$500. Quarterly mixers, member directory, occasional sponsorship opportunities.

### Tier 2 (moderate ROI, moderate cost)

5. **BNI chapters in Lawrenceville, Vincennes, Terre Haute** — weekly meeting commitment (60-90 min). One member per profession, so you're the only IT person in the chapter. Members refer business to each other; expect 1-3 leads/month at full participation. Annual cost ~$700 + meeting time.
6. **Sponsoring a local high school robotics team or business-plan competition** — cheap PR ($500-$2,000), good will, occasional press mention, builds local brand recognition without feeling salesy.
7. **Local print + radio**: occasional ads in Robinson Daily News, Vincennes Sun-Commercial, Tribune-Star, or local radio (WTHI, WAOV). Mostly for brand recognition, not direct response. Budget cap: $200-$500/mo if you decide to do this.

### Tier 3 (long-term play, lower direct ROI)

8. **Speaking at local Rotary / Kiwanis / business luncheons** — free, builds local authority. Pitch a 20-minute talk: "5 cybersecurity mistakes Wabash Valley businesses are making right now" or similar.
9. **Hosting your own local event** — quarterly "lunch and learn" at the Crawford County Public Library or a coworking space. Topic: practical SMB security / cloud migration / e-commerce. Light food, no hard pitch. 10-15 attendees per event is a success.
10. **Local PR / case study placement** — when you do a notable project for a local business (with their permission), pitch the Robinson Daily News or Tribune-Star business reporter.

### What NOT to do for local lead-gen

- **Google Ads for local IT** — competition with national MSPs at $20+ CPC for local keywords. Bad ROI at this budget. Use the $20/day for the nationwide e-commerce funnel instead.
- **Facebook ads** — Boomer-heavy audience but engagement is low for B2B IT services. Skip.
- **LinkedIn outreach to local owners** — most rural-area SMB owners aren't on LinkedIn. Direct mail or referrals outperform.
- **Cold calling** — exhausting, low conversion, hurts your brand if you mess it up. Only useful if you have a specific high-value vertical (e.g., calling every dental practice within 50 miles for HIPAA audits). Don't shotgun-cold-call.

---

## Brand strategy

**Recommendation:** keep local IT services under the Wabash Systems brand with a `/local` landing page.

**Reasoning:**
- Brand equity is being built nationally for Wabash Systems anyway (e-commerce consulting). Don't fragment.
- "Wabash Valley" already signals local origin in the brand name. Lean into it.
- Local clients respect a national-presence agency that happens to also serve them locally — it implies sophistication.
- One website, one tax entity, one set of marketing assets to maintain.

**The `/local` landing page should have:**
- Hero: "Local IT services for Wabash Valley businesses"
- Sub-hero: "We're 10 minutes from Robinson, 35 from Vincennes, 60 from Terre Haute"
- 5 service cards (MSP, Network, Security audit, Cloud migration, Local websites)
- Service area map (50-mile radius visual)
- 3-5 local testimonials (when you have them)
- LocalBusiness schema with full NAP (name, address, phone)
- Lead form: "Tell us about your business" → routes to your inbox

**What NOT to do:**
- Don't spin up a separate brand (e.g. "Wabash Tech" or "Crawford County IT"). Twice the maintenance, half the trust.
- Don't downplay the national consulting on the local page. Some local clients want a "serious agency" who also happens to be 15 minutes away.

---

## Pricing philosophy

- **Retainer > project > hourly.** Maximize predictable monthly revenue. Hourly billing is a race to the bottom locally.
- **Fixed fee on projects.** No "T&M" (time + materials) unless the scope is truly undefined.
- **Annual contracts on MSP retainers.** Auto-renew unless cancelled with 60 days notice. Industry standard.
- **Quarterly business reviews (QBRs)** with every retainer client — preempts churn.
- **Net 30 invoicing** with auto-pay discount (2% off if they set up ACH/card on file). Cash flow matters in local services.
- **No free emergency support.** Charge 1.5x rate for after-hours, weekend, holiday work. Mandates respect for boundaries.

---

## Realistic timeline + revenue targets

| Month | Activity | Expected revenue |
|-------|----------|------------------|
| Month 1 | Set up: insurance, contracts, RMM tool, doc templates | $0 |
| Month 2-3 | First 2-3 audit projects ($1K-$2K each) via warm intros | $2K-$5K total |
| Month 4-6 | 1-2 audit conversions to MSP retainer ($1K-$2K/mo) + 1-2 website projects | $2K-$5K MRR + $5K-$10K project revenue |
| Month 7-9 | 4-6 MSP retainer clients ($4K-$8K MRR), steady project work | $4K-$10K MRR + $3K-$6K projects |
| Month 10-12 | 6-10 retainer clients ($6K-$15K MRR), full project pipeline | $6K-$15K MRR + ongoing projects |

**Year-1 realistic gross:** $50K-$100K total (mostly back-loaded)
**Year-2 realistic gross:** $120K-$200K (mostly recurring)

**Constraints:**
- Solo operation (per CLAUDE.md, no hiring without explicit ask). 8-12 active retainers is a single-person ceiling without sacrificing quality.
- Wabash Systems e-commerce consulting takes priority on time allocation — local IT shouldn't cannibalize that.

---

## Operational setup (one-time, do before first client)

- **Business insurance** — General liability + Professional liability + Cyber liability. Budget $1,500-$3,000/year. Use a local agent (Hometown Insurance, Country Financial, etc.).
- **Contracts** — Get an attorney to draft: MSA, Master Service Agreement template, MSP retainer template, project SOW template, cybersecurity audit engagement letter. Budget $1,500-$3,000 one-time. Find a local IT-friendly attorney via the Vigo or Crawford County Bar Association.
- **RMM + ticketing tool** — Sign up for NinjaOne or Atera. ~$2/endpoint, no minimum. Test with your own devices first.
- **Documentation tool** — Hudu or IT Glue trial. Decide based on UX preference.
- **Backup vendor** — Pick one of Datto / Acronis / Veeam. Set up reseller account.
- **Onboarding checklist** — Build a Notion or Google Doc template for client onboarding (asset list, account list, vendor list, escalation list).
- **Stripe configured for local invoicing** — Already done via the Wabash Systems Stripe setup. Use the same.
- **Separate email alias** — `local@wabashsystems.com` for local-only inquiries. Helps you triage.
- **Google Business Profile** — Update existing Wabash Systems GBP to mention IT services + 50-mile service area. Same listing, expanded categories.

---

## Conflict-of-interest gate

Per memory rule: this is a side project alongside Andy's full-time job for the next year. Don't promote local services until that gate lifts.

**What's OK now:**
- Quietly building the assets (this doc, contracts, tooling)
- Soft-launching the `/local` landing page (live on the site but not advertised)
- Building referral partnerships informally
- Taking inbound inquiries that come in organically

**What's NOT OK now:**
- Paid ads for local services
- Cold outreach to local businesses
- Public PR / press / Chamber sponsorships
- Active BNI participation
- Speaking gigs / lunch and learns

**Revisit timing:** quarterly. Likely greenlit ~12 months from 2026-05-23 (around mid-2027).

---

## Open questions / decisions deferred

- **LLC structure**: same Wabash Systems LLC or separate sub-entity for liability isolation? Ask attorney + accountant. Default recommendation: same entity, just add insurance coverage.
- **Workers comp / 1099 contractors**: if scaling beyond solo, need to think about labor + liability. Defer for now.
- **Geographic expansion**: 50mi feels right. Going to 75-100mi adds Evansville IN, Champaign IL, Effingham IL — bigger markets but more competition. Defer to year 2+ decision.
- **Vertical specialization**: should we focus on, e.g., dental practices or manufacturing? Specialization commands premium pricing. Generalist offers more volume. Decide after first 3-5 clients reveal organic pattern.
- **Subcontracting**: when you hit 8+ retainers, you'll need help. Local college (Lincoln Trail, Vincennes U, ISU) IT students as part-time contractors? Defer.

---

## Reference resources

- Robinson Daily News (local paper): `robdailynews.com`
- Crawford County Development Corporation: `crawfordcountydevelopment.com`
- Robinson Chamber of Commerce: `robinsonchamber.com`
- Lincoln Trail College (Robinson): `iecc.edu/ltc`
- BNI Indiana (chapter finder): `bni-indiana.com`
- BNI Illinois: `bniill.com`
- NIST Cybersecurity Framework: `nist.gov/cyberframework`
- Center for Internet Security (CIS) Controls v8: `cisecurity.org/controls`
- IT Nation Connect (annual MSP conference): `connectit.com` — useful peer network
