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

Put original PNG files in `content/gallery/`, then list the public gallery in
`content/gallery/photos.json`. The manifest is authoritative: images not listed
there are ignored, order follows the JSON order unless an `order` value is set,
and captions come only from `location`.

The gallery generator runs before `npm run dev` and `npm run build`. It converts
listed PNG sources into stripped, lossless WebP files in `public/gallery/` and
serves them at `/gallery/<basename>.webp`. Raw PNG originals are not copied into
`public/gallery/` or `dist/`.

Each generated WebP must stay below the Cloudflare Workers Static Assets
per-file limit of `26,214,400` bytes; generation fails if an image exceeds it.

```json
[
  {
    "file": "ceid-yale.png",
    "location": "CEID @ Yale, New Haven, CT.",
    "alt": "Photograph of the CEID at Yale University in New Haven, Connecticut",
    "columns": 4
  }
]
```
