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

## Problems

Each `.tex` file in `content/problems/` becomes one unlisted page at
`/problems/<id>/`. `<id>` is a random 5-character id assigned automatically the
first time a file is built (the generator writes `id: ...` back into the
file's frontmatter and renames the file to `<id>.tex`, so name the file
whatever's convenient when you create it). These pages are not linked from
anywhere on the site, are marked `noindex, nofollow`, and are blocked in
`robots.txt` — they're only reachable by someone who has the exact URL.

Frontmatter:

```
---
title: Problem title
date: 2026-07-29
---
```

`title` is required. `date` is optional and shown as a small caption if
present. `id` is filled in automatically — don't set it by hand.

The body is a lightweight LaTeX-flavored format, rendered server-side with
KaTeX (no client-side JS or fonts loaded from a CDN):

- `$...$` for inline math, `$$` / `\[ ... \]` on their own lines for display
  math (opening and closing delimiters must each be alone on a line).
- `\begin{align}...\end{align}` and `equation`, `gather`, `multline`,
  `alignat` (and their starred forms) work the same way.
- `\section{...}` and `\subsection{...}` for headings.
- `\begin{itemize}` / `\begin{enumerate}` with `\item` lines for lists.
- `\textbf{}`, `\textit{}`/`\emph{}`, `\texttt{}`, plus Markdown-style
  `**bold**`, `*italic*`, `` `code` ``, and `[text](url)` links.
- Blank-line-separated plain text becomes paragraphs.
- Triple-backtick fenced blocks for code.

Example:

```
---
title: A parity argument
date: 2026-07-29
---
Let $n$ be a positive integer. Show that $n^2 + n$ is always even.

\section{Solution sketch}

Note that $n^2 + n = n(n+1)$, a product of consecutive integers, so one of
them is even.

$$
n(n+1) \equiv 0 \pmod{2}
$$
```

Run `npm run problems` to regenerate only problem pages, or `npm run build`
to regenerate everything. Deleting a `.tex` file removes its generated page
on the next generation run.
