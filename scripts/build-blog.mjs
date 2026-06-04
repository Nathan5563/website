import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const contentDir = join(root, "content", "blog");
const outputDir = join(root, "blog");
const siteUrl = "https://nathanabebe.com";

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function parseFrontmatter(source, filePath) {
  if (!source.startsWith("---\n")) {
    throw new Error(`${filePath} is missing frontmatter`);
  }

  const end = source.indexOf("\n---", 4);
  if (end === -1) {
    throw new Error(`${filePath} has unterminated frontmatter`);
  }

  const frontmatter = source.slice(4, end).trim();
  const body = source.slice(end + 4).trim();
  const data = {};

  for (const line of frontmatter.split("\n")) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const raw = line.slice(index + 1).trim();
    data[key] = key === "tags"
      ? raw.split(",").map((item) => item.trim()).filter(Boolean)
      : raw;
  }

  for (const key of ["title", "slug", "date", "summary"]) {
    if (!data[key]) throw new Error(`${filePath} is missing "${key}"`);
  }

  data.tags = Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [];
  data.status = data.status || "Post";
  data.updated = data.updated || data.date;
  data.robots = data.robots || "index, follow";

  return { data, body };
}

function formatDate(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return value;
  return `${monthNames[month - 1]} ${day}, ${year}`;
}

function displayTitle(title) {
  return /[.?!]$/.test(title) ? title : `${title}.`;
}

function inlineMarkdown(value) {
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, href) => {
    return `<a href="${escapeAttr(href)}">${text}</a>`;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return html;
}

function flushParagraph(lines, output) {
  if (!lines.length) return;
  output.push(`<p>${inlineMarkdown(lines.join(" "))}</p>`);
  lines.length = 0;
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const output = [];
  const paragraph = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph(paragraph, output);
      continue;
    }

    if (trimmed.startsWith("```")) {
      flushParagraph(paragraph, output);
      const language = trimmed.slice(3).trim();
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      output.push(
        `<pre${language ? ` data-language="${escapeAttr(language)}"` : ""}><code>${escapeHtml(code.join("\n"))}</code></pre>`
      );
      continue;
    }

    if (/^#{2,4}\s+/.test(trimmed)) {
      flushParagraph(paragraph, output);
      const level = trimmed.match(/^#+/)[0].length;
      const text = trimmed.replace(/^#{2,4}\s+/, "");
      output.push(`<h${level}>${inlineMarkdown(text)}</h${level}>`);
      continue;
    }

    if (trimmed.startsWith("> ")) {
      flushParagraph(paragraph, output);
      const quote = [];
      while (index < lines.length && lines[index].trim().startsWith("> ")) {
        quote.push(lines[index].trim().slice(2));
        index += 1;
      }
      index -= 1;
      output.push(`<blockquote><p>${inlineMarkdown(quote.join(" "))}</p></blockquote>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph(paragraph, output);
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      index -= 1;
      output.push(`<ul>${items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushParagraph(paragraph, output);
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      index -= 1;
      output.push(`<ol>${items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ol>`);
      continue;
    }

    if (trimmed.includes("|") && lines[index + 1]?.trim().match(/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/)) {
      flushParagraph(paragraph, output);
      const header = splitTableRow(trimmed);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].trim().includes("|")) {
        rows.push(splitTableRow(lines[index].trim()));
        index += 1;
      }
      index -= 1;
      output.push(renderTable(header, rows));
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph(paragraph, output);
  return output.join("\n");
}

function splitTableRow(row) {
  return row.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function renderTable(header, rows) {
  const thead = `<thead><tr>${header.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;
  return `<table>${thead}${tbody}</table>`;
}

function nav(current = "Blog") {
  const links = [
    ["Home", "/"],
    ["Projects", "/projects/"],
    ["Gallery", "/gallery/"],
    ["Blog", "/blog/"]
  ];

  return `<nav class="site-nav" aria-label="Primary navigation">
          ${links
            .map(([label, href]) => `<a href="${href}"${label === current ? ' aria-current="page"' : ""}>${label}</a>`)
            .join("\n          ")}
        </nav>`;
}

function head({ title, description, canonical, robots = "index, follow", type = "website" }) {
  const fullTitle = title.includes("Nathan Abebe") ? title : `${title} | Nathan Abebe`;
  return `<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(fullTitle)}</title>
    <meta name="author" content="Nathan Abebe" />
    <meta name="theme-color" content="#fbfbf7" />
    <meta name="description" content="${escapeAttr(description)}" />
    <meta name="robots" content="${escapeAttr(robots)}" />
    <meta property="og:title" content="${escapeAttr(fullTitle)}" />
    <meta property="og:site_name" content="Nathan Abebe" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:url" content="${escapeAttr(canonical)}" />
    <meta property="og:type" content="${type}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeAttr(fullTitle)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />
    <link rel="canonical" href="${escapeAttr(canonical)}" />
    <link rel="icon" type="image/svg+xml" href="/icons/favicon.svg" />
    <link rel="stylesheet" href="/app.css" />
  </head>`;
}

function page({ title, description, canonical, robots, type, body }) {
  return `<!doctype html>
<html lang="en">
  ${head({ title, description, canonical, robots, type })}
  <body>
    <a class="skip-link" href="#content">Skip to content</a>
    <main id="content" class="site-shell">
${body}
    </main>
  </body>
</html>
`;
}

function renderIndex(posts) {
  const postList = posts.length
    ? posts.map(renderPostPreview).join("\n")
    : `          <article class="post-entry">
            <p>Coming soon.</p>
          </article>`;

  const body = `      <header class="site-header">
        <div>
          <p class="eyebrow">Blog</p>
          <h1 class="page-title">Blog.</h1>
          <p class="lede">
            My thoughts on, and experiments with, systems, performance, engineering, and research.
          </p>
        </div>
        ${nav("Blog")}
      </header>

      <section class="section" aria-labelledby="posts">
        <h2 id="posts" class="section-title">Posts</h2>
        <div class="post-list">
${postList}
        </div>
      </section>

      <footer class="footer">
        <a href="/">Home</a>
      </footer>`;

  return page({
    title: "Blog | Nathan Abebe",
    description: "Short technical notes by Nathan Abebe on systems, graphics, tools, and low-level software.",
    canonical: `${siteUrl}/blog/`,
    body
  });
}

function renderPostPreview(post) {
  const tagText = post.tags.join(" / ");
  return `          <article class="post-entry">
            <div class="post-head">
              <h3><a href="/blog/${escapeAttr(post.slug)}/">${escapeHtml(displayTitle(post.title))}</a></h3>
              <span class="post-meta">Last edited ${formatDate(post.updated)}</span>
            </div>
            <p>${escapeHtml(post.summary)}</p>
            ${tagText ? `<p class="post-tags">${escapeHtml(tagText)}</p>` : ""}
          </article>`;
}

function renderPost(post, previous, next) {
  const tags = post.tags.join(" / ");
  const adjacent = [
    previous
      ? `<a href="/blog/${escapeAttr(previous.slug)}/">Previous<span class="pagination-title">: ${escapeHtml(previous.title)}</span></a>`
      : "",
    next
      ? `<a href="/blog/${escapeAttr(next.slug)}/">Next<span class="pagination-title">: ${escapeHtml(next.title)}</span></a>`
      : ""
  ].filter(Boolean);

  const body = `      <header class="article-header">
        <p class="eyebrow">Blog / ${escapeHtml(post.title)}</p>
        <h1>${escapeHtml(displayTitle(post.title))}</h1>
        <p class="lede">${escapeHtml(post.summary)}</p>
        <dl class="article-meta">
          <dt>Date</dt>
          <dd>${formatDate(post.date)}</dd>
          <dt>Last edited</dt>
          <dd>${formatDate(post.updated)}</dd>
          ${tags ? `<dt>Tags</dt>\n          <dd>${escapeHtml(tags)}</dd>` : ""}
        </dl>
        ${nav("Blog")}
      </header>

      <article class="post-article">
${post.html}
      </article>

      <footer class="footer article-footer">
        <a href="/blog/">Blog</a>
        ${adjacent.length ? `<div class="article-pagination">\n          ${adjacent.join("\n          ")}\n        </div>` : ""}
      </footer>`;

  return page({
    title: `${post.title} | Nathan Abebe`,
    description: post.summary,
    canonical: `${siteUrl}/blog/${post.slug}/`,
    robots: post.robots,
    type: "article",
    body
  });
}

function readPosts() {
  if (!existsSync(contentDir)) return [];

  return readdirSync(contentDir)
    .filter((file) => file.endsWith(".md") && file !== "README.md")
    .map((file) => {
      const filePath = join(contentDir, file);
      const { data, body } = parseFrontmatter(readFileSync(filePath, "utf8"), filePath);
      return {
        ...data,
        html: renderMarkdown(body)
      };
    })
    .sort((left, right) => String(right.date).localeCompare(String(left.date)));
}

function write(path, html) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, html);
}

function removeStalePostDirs(posts) {
  if (!existsSync(outputDir)) return;

  const slugs = new Set(posts.map((post) => post.slug));
  for (const entry of readdirSync(outputDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || slugs.has(entry.name)) continue;
    const indexPath = join(outputDir, entry.name, "index.html");
    if (existsSync(indexPath)) {
      rmSync(join(outputDir, entry.name), { recursive: true, force: true });
    }
  }
}

const posts = readPosts();
removeStalePostDirs(posts);
write(join(outputDir, "index.html"), renderIndex(posts));

for (let index = 0; index < posts.length; index += 1) {
  const previous = posts[index + 1];
  const next = posts[index - 1];
  write(join(outputDir, posts[index].slug, "index.html"), renderPost(posts[index], previous, next));
}

console.log(`Generated ${posts.length} blog post${posts.length === 1 ? "" : "s"}.`);
