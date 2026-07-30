import { randomInt } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, join } from "node:path";
import katex from "katex";

const root = process.cwd();
const contentDir = join(root, "content", "problems");
const outputDir = join(root, "problems");
const katexSrcDir = join(root, "node_modules", "katex", "dist");
const katexDestDir = join(root, "public", "vendor", "katex");
const idChars = "abcdefghijklmnopqrstuvwxyz0123456789";

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

function generateId(existing) {
  let id;
  do {
    id = Array.from({ length: 5 }, () => idChars[randomInt(idChars.length)]).join("");
  } while (existing.has(id));
  existing.add(id);
  return id;
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
    data[key] = line.slice(index + 1).trim();
  }

  if (!data.title) {
    throw new Error(`${filePath} is missing "title"`);
  }

  return { data, body };
}

function ensureId(filePath, source, existingIds) {
  const frontmatterEnd = source.indexOf("\n---", 4);
  const frontmatter = source.slice(4, frontmatterEnd);
  if (/^id:/m.test(frontmatter)) return null;

  const id = generateId(existingIds);
  const updatedFrontmatter = `${frontmatter.trimEnd()}\nid: ${id}\n`;
  const updatedSource = `---\n${updatedFrontmatter}---${source.slice(frontmatterEnd + 4)}`;
  writeFileSync(filePath, updatedSource);
  return id;
}

function renderMath(tex, displayMode, filePath) {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: true, strict: "warn" });
  } catch (error) {
    throw new Error(`${filePath}: failed to render math "${tex.slice(0, 60)}": ${error.message}`);
  }
}

function inlineTex(raw, filePath) {
  return raw
    .split(/(\$[^$\n]+\$)/g)
    .map((part) => {
      if (part.startsWith("$") && part.endsWith("$") && part.length > 1) {
        return renderMath(part.slice(1, -1), false, filePath);
      }
      return formatText(part);
    })
    .join("");
}

function formatText(text) {
  let html = escapeHtml(text);
  html = html.replace(/\\emph\{([^}]*)\}/g, "<em>$1</em>");
  html = html.replace(/\\textit\{([^}]*)\}/g, "<em>$1</em>");
  html = html.replace(/\\textbf\{([^}]*)\}/g, "<strong>$1</strong>");
  html = html.replace(/\\texttt\{([^}]*)\}/g, "<code>$1</code>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
    return `<a href="${escapeAttr(href)}">${label}</a>`;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return html;
}

const displayEnvironments = /^\\begin\{(align\*?|equation\*?|gather\*?|multline\*?|alignat\*?)\}/;

function renderBody(source, filePath) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const output = [];
  const paragraph = [];

  const flush = () => {
    if (!paragraph.length) return;
    output.push(`<p>${inlineTex(paragraph.join(" "), filePath)}</p>`);
    paragraph.length = 0;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();

    if (!trimmed) {
      flush();
      continue;
    }

    if (trimmed.startsWith("```")) {
      flush();
      const language = trimmed.slice(3).trim();
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i += 1;
      }
      output.push(
        `<pre${language ? ` data-language="${escapeAttr(language)}"` : ""}><code>${escapeHtml(code.join("\n"))}</code></pre>`
      );
      continue;
    }

    if (trimmed === "$$" || trimmed === "\\[") {
      flush();
      const closer = trimmed === "$$" ? "$$" : "\\]";
      const collected = [];
      i += 1;
      while (i < lines.length && lines[i].trim() !== closer) {
        collected.push(lines[i]);
        i += 1;
      }
      if (i >= lines.length) {
        throw new Error(`${filePath}: unterminated display math (missing ${closer})`);
      }
      output.push(`<div class="problem-math">${renderMath(collected.join("\n"), true, filePath)}</div>`);
      continue;
    }

    const envMatch = trimmed.match(displayEnvironments);
    if (envMatch) {
      flush();
      const envName = envMatch[1];
      const collected = [lines[i]];
      while (i + 1 < lines.length && !lines[i].includes(`\\end{${envName}}`)) {
        i += 1;
        collected.push(lines[i]);
      }
      if (!lines[i]?.includes(`\\end{${envName}}`)) {
        throw new Error(`${filePath}: unterminated \\begin{${envName}}`);
      }
      output.push(`<div class="problem-math">${renderMath(collected.join("\n"), true, filePath)}</div>`);
      continue;
    }

    const sectionMatch = trimmed.match(/^\\(section|subsection)\{(.*)\}$/);
    if (sectionMatch) {
      flush();
      const level = sectionMatch[1] === "section" ? 2 : 3;
      output.push(`<h${level}>${inlineTex(sectionMatch[2], filePath)}</h${level}>`);
      continue;
    }

    const listMatch = trimmed.match(/^\\begin\{(itemize|enumerate)\}$/);
    if (listMatch) {
      flush();
      const listType = listMatch[1] === "itemize" ? "ul" : "ol";
      const items = [];
      let current = null;
      i += 1;
      while (i < lines.length && lines[i].trim() !== `\\end{${listMatch[1]}}`) {
        const itemTrimmed = lines[i].trim();
        if (itemTrimmed.startsWith("\\item")) {
          if (current !== null) items.push(current);
          const rest = itemTrimmed.slice(5);
          const labelMatch = rest.match(/^\[(.*?)\]\s*(.*)$/);
          current = labelMatch
            ? { label: labelMatch[1], text: labelMatch[2] }
            : { label: null, text: rest.trim() };
        } else if (itemTrimmed) {
          current.text = current.text ? `${current.text} ${itemTrimmed}` : itemTrimmed;
        }
        i += 1;
      }
      if (i >= lines.length) {
        throw new Error(`${filePath}: unterminated \\begin{${listMatch[1]}}`);
      }
      if (current !== null) items.push(current);

      let autoIndex = 0;
      const renderedItems = items.map((item) => {
        let label = item.label;
        if (label === null) {
          label = listType === "ul" ? "•" : `${(autoIndex += 1)}.`;
        }
        return `<li><span class="item-label">${inlineTex(label, filePath)}</span><span class="item-body">${inlineTex(item.text, filePath)}</span></li>`;
      });
      output.push(`<${listType} class="problem-list">${renderedItems.join("")}</${listType}>`);
      continue;
    }

    paragraph.push(trimmed);
  }

  flush();
  return output.join("\n");
}

function head({ id }) {
  return `<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(id.toUpperCase())}</title>
    <meta name="robots" content="noindex, nofollow" />
    <meta name="theme-color" content="#fbfbf7" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="stylesheet" href="/app.css" />
    <link rel="stylesheet" href="/vendor/katex/katex.min.css" />
  </head>`;
}

function renderPage(problem) {
  return `<!doctype html>
<html lang="en">
  ${head({ id: problem.id })}
  <body>
    <main class="site-shell problem-shell">
      <header class="problem-header">
        <h1>${escapeHtml(problem.title)}</h1>
        ${problem.data.date ? `<p class="problem-meta">${escapeHtml(problem.data.date)}</p>` : ""}
      </header>
      <article class="post-article problem-body">
${problem.html}
      </article>
    </main>
  </body>
</html>
`;
}

function write(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function copyKatexAssets() {
  mkdirSync(join(katexDestDir, "fonts"), { recursive: true });
  copyFileSync(join(katexSrcDir, "katex.min.css"), join(katexDestDir, "katex.min.css"));
  for (const file of readdirSync(join(katexSrcDir, "fonts"))) {
    if (!file.endsWith(".woff2")) continue;
    copyFileSync(join(katexSrcDir, "fonts", file), join(katexDestDir, "fonts", file));
  }
}

function removeStaleProblemDirs(ids) {
  if (!existsSync(outputDir)) return;
  for (const entry of readdirSync(outputDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || ids.has(entry.name)) continue;
    const indexPath = join(outputDir, entry.name, "index.html");
    if (existsSync(indexPath)) {
      rmSync(join(outputDir, entry.name), { recursive: true, force: true });
    }
  }
}

function readProblems() {
  if (!existsSync(contentDir)) return [];

  const files = readdirSync(contentDir).filter((file) => file.endsWith(".tex"));
  const existingIds = new Set();

  for (const file of files) {
    const filePath = join(contentDir, file);
    const source = readFileSync(filePath, "utf8");
    const frontmatterEnd = source.indexOf("\n---", 4);
    if (frontmatterEnd === -1) continue;
    const idMatch = source.slice(4, frontmatterEnd).match(/^id:\s*(\S+)/m);
    if (idMatch) existingIds.add(idMatch[1]);
  }

  return files.map((file) => {
    let filePath = join(contentDir, file);
    let source = readFileSync(filePath, "utf8");
    const newId = ensureId(filePath, source, existingIds);
    if (newId) {
      source = readFileSync(filePath, "utf8");
      console.log(`Assigned id ${newId} to ${file}`);
    }

    const { data, body } = parseFrontmatter(source, filePath);

    const expectedFile = `${data.id}.tex`;
    if (file !== expectedFile) {
      const expectedPath = join(contentDir, expectedFile);
      renameSync(filePath, expectedPath);
      console.log(`Renamed ${file} to ${expectedFile}`);
      filePath = expectedPath;
    }

    return {
      title: data.title,
      data,
      id: data.id,
      html: renderBody(body, filePath)
    };
  });
}

copyKatexAssets();

const problems = readProblems();
removeStaleProblemDirs(new Set(problems.map((problem) => problem.id)));

for (const problem of problems) {
  write(join(outputDir, problem.id, "index.html"), renderPage(problem));
}

console.log(`Generated ${problems.length} problem page${problems.length === 1 ? "" : "s"}.`);
