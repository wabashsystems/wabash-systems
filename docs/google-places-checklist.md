# Google Business Profile setup checklist

## Why this matters
The on-site `Organization` schema in `index.html` declares a Robinson, IL address. Google Business Profile must match exactly for trust signals + local rich results.

## Steps

### 1. Claim / verify the listing
- [ ] Go to https://business.google.com → search "Wabash Systems"
- [ ] If listing exists, claim it. If not, create new one.
- [ ] Verify via the postcard option (or phone if available).

### 2. NAP consistency
- [ ] Business Name: "Wabash Systems"
- [ ] Address: Robinson, IL 62454 (matches `addressLocality` / `addressRegion` / `postalCode` in `index.html` Organization schema). No street address is published on-site; if GBP requires one for verification, use the LLC's registered street and keep it consistent everywhere it's published from that point forward.
- [ ] Phone: not currently published on the site. If we add a number to GBP, also add it to the Organization schema in `index.html` and to the contact section so NAP stays consistent.

### 3. Categories
- [ ] Primary: "Marketing consultant" OR "Internet marketing service"
- [ ] Secondary (up to 9): "E-commerce service," "Search engine optimization service," "Website designer"

### 4. Service area
- [ ] Toggle "I deliver goods and services to my customers"
- [ ] Add Wabash Valley counties (Crawford, Lawrence, Wabash, Richland, Sullivan, Knox, Vigo, Gibson, Greene, Daviess)
- [ ] Plus add "United States" if available, or major Midwest metros (Indianapolis, St. Louis, Chicago, Cincinnati)

### 5. Hours
- [ ] Set hours that match the website (typically Mon-Fri 9am-5pm CT)

### 6. Photos
- [ ] Logo (square, 250x250 minimum)
- [ ] Cover photo (1200x675)
- [ ] Branded card / business card photo
- [ ] Screenshot of the /audit tool (proves the engine is real)

### 7. Services menu
- [ ] Add each /services/* page as a service entry with the page URL
- [ ] Use the H1 from the page as the service name + a 1-sentence description

### 8. Posts (ongoing)
- [ ] Monthly "what we shipped" updates linking to blog posts
- [ ] Set posting cadence

### 9. Verify via Google search
- [ ] Search "wabash systems" → confirm Knowledge Panel appears with correct info
- [ ] Search "ecommerce consultant Robinson IL" → check rank
