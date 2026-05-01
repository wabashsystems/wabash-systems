# Blog drafts

Auto-generated blog post drafts land here, one per week, created by the
`weekly-blog-draft` scheduled task.

This folder is **deliberately excluded** from `auto-push.ps1` (see the
`-Exclude @("drafts")` argument on the `blog` Sync-Dir call). Files here
never reach the repo or the deployed site.

## Workflow

1. The scheduled task drops a draft as `draft-YYYY-MM-DD-<slug>.md` here
   each Sunday morning, then creates a Gmail draft notifying you with an
   inline preview.
2. Review the draft. Edit voice, fix factual claims, tighten the intro.
3. Run the publish helper (coming separately) to render the markdown to
   HTML, wire it into `blog/index.html` and `sitemap.xml`, and let
   `auto-push.ps1` deploy it.

If you reject a draft, just delete the file. Nothing else needs cleanup.

## Front matter format

Every draft starts with YAML front matter:

```
---
title: "..."
slug: "..."           # used as the filename and URL path
description: "..."    # meta description, ~150 chars
primary_keyword: "..."
date: "YYYY-MM-DD"
service_links:        # which /services/ pages this post links to internally
  - store-setup
  - seo-management
---
```
