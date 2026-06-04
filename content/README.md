# Content

This directory contains source content that generators turn into site pages and served assets.

## Blog

Each markdown file in `content/blog/` becomes one post under `/blog/<slug>/`.

Required frontmatter:

```md
---
title: Post title
slug: post-slug
date: 2026-06-04
summary: One sentence summary.
tags: systems, tools
status: Draft
robots: noindex, follow
---
```

Run `npm run blog` to regenerate only blog HTML, or `npm run build` to regenerate content and build the whole site. Deleting a markdown file removes its generated post directory on the next generation run.

## Gallery

Put PNG files in `content/gallery/`.

The gallery generator runs before `npm run dev` and `npm run build`. It copies those files to `public/gallery/` so Vite can serve them at `/gallery/<file>.png`. Deleting a PNG removes its copied public image and its gallery entry on the next generation run.

Filenames control default order and captions:

```text
01-new-haven-ct.png -> New Haven, CT.
02-east-rock-new-haven.png -> East Rock New Haven.
```

For exact captions or manual ordering, add `content/gallery/photos.json`:

```json
[
  {
    "file": "01-new-haven-ct.png",
    "location": "New Haven, CT.",
    "alt": "Photograph from New Haven, Connecticut",
    "columns": 2
  }
]
```
