# Design System

Two reference docs that govern any visual or UX work on this project:

- **DESIGN.md** — visual system rules: color, typography, spacing,
  hierarchy, components, alignment, contrast, density, interaction,
  motion, accessibility. Used to evaluate "how does this look and how
  does it support clarity?"
- **UX.md** — flow and cognitive-load rules: decision hierarchy, the
  100-point scoring rubric, anti-patterns, primary-action rule, feedback,
  friction removal. Used to evaluate "does this work for a user with
  zero context and 3 seconds of attention?"

## How to use

When making any change to the site UI - homepage, service pages, blog
template, admin panels, contact forms, anything user-facing - apply
both rubrics:

1. Implement the change with DESIGN.md and UX.md rules in mind from
   the start (not as a post-hoc check).
2. After implementing, run the UX.md validation loop: score 0-100,
   identify weak areas, fix, repeat until >= 85.
3. Apply the DESIGN.md validation loop: hierarchy, spacing, contrast,
   alignment, density, accessibility, noise removal.

These docs are the working standard - refer to them, don't relitigate
their content. Disagreements with specific rules should be flagged
explicitly with reasoning before deviating.

## Audit backlog

Work that hasn't been audited against these docs yet:

- Homepage (`index.html`)
- Booking page (`booking.html`)
- Blog index + posts (`blog/`)
- Service pages (`services/`)
- Case study (`case-studies/titan-machine-service.html`)
- Admin tabs (`admin/index.html`)

Each audit should produce a numbered defect list with file paths and
line numbers, scored using the UX.md rubric. Do these one at a time -
batching audits leads to broad-strokes recommendations that don't
land.
