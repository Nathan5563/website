import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { basename, extname, join } from "node:path";

const root = process.cwd();
const photoDir = join(root, "content", "gallery");
const publicPhotoDir = join(root, "public", "gallery");
const metadataPath = join(root, "content", "gallery", "photos.json");
const galleryPath = join(root, "gallery", "index.html");
const publicUrl = "/gallery";
const startMarker = "<!-- gallery:generated:start -->";
const endMarker = "<!-- gallery:generated:end -->";

const stateAbbreviations = new Set([
  "ak",
  "al",
  "ar",
  "az",
  "ca",
  "co",
  "ct",
  "dc",
  "de",
  "fl",
  "ga",
  "hi",
  "ia",
  "id",
  "il",
  "in",
  "ks",
  "ky",
  "la",
  "ma",
  "md",
  "me",
  "mi",
  "mn",
  "mo",
  "ms",
  "mt",
  "nc",
  "nd",
  "ne",
  "nh",
  "nj",
  "nm",
  "nv",
  "ny",
  "oh",
  "ok",
  "or",
  "pa",
  "ri",
  "sc",
  "sd",
  "tn",
  "tx",
  "ut",
  "va",
  "vt",
  "wa",
  "wi",
  "wv",
  "wy"
]);

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

function readPngSize(filePath) {
  const buffer = readFileSync(filePath);

  if (
    buffer.length < 24 ||
    buffer.toString("hex", 0, 8) !== "89504e470d0a1a0a" ||
    buffer.toString("ascii", 12, 16) !== "IHDR"
  ) {
    throw new Error(`${filePath} is not a valid PNG`);
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function readMetadata() {
  if (!existsSync(metadataPath)) return new Map();

  const parsed = JSON.parse(readFileSync(metadataPath, "utf8"));
  const entries = Array.isArray(parsed) ? parsed : parsed.photos;

  if (!Array.isArray(entries)) {
    throw new Error(`${metadataPath} must be an array or an object with a photos array`);
  }

  return new Map(
    entries
      .filter((entry) => entry && entry.file)
      .map((entry, index) => [entry.file, { ...entry, order: entry.order ?? index }])
  );
}

function cleanName(file) {
  return basename(file, extname(file))
    .replace(/^\d+[-_. ]+/, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

function titleToken(token) {
  const lower = token.toLowerCase();
  if (stateAbbreviations.has(lower)) return lower.toUpperCase();
  if (lower === "usa" || lower === "uk") return lower.toUpperCase();
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
}

function captionFromFile(file) {
  const tokens = cleanName(file).split(/\s+/).filter(Boolean);
  if (!tokens.length) return "Untitled.";

  const words = tokens.map(titleToken);
  const last = tokens[tokens.length - 1].toLowerCase();
  const caption = stateAbbreviations.has(last) && words.length > 1
    ? `${words.slice(0, -1).join(" ")}, ${words.at(-1)}`
    : words.join(" ");

  return /[.?!]$/.test(caption) ? caption : `${caption}.`;
}

function chooseColumns(width, height, metadata) {
  if (metadata.columns) {
    const explicit = Number(metadata.columns);
    if (Number.isFinite(explicit)) return Math.min(6, Math.max(1, Math.round(explicit)));
  }

  const ratio = width / height;
  if (ratio >= 1.85) return 4;
  if (ratio >= 1.12) return 3;
  return 2;
}

function chooseRows(width, height, columns) {
  const desktopMax = 920;
  const columnGap = 18;
  const gridColumns = 6;
  const rowHeight = 4;
  const rowGap = 8;
  const rowStep = rowHeight + rowGap;
  const captionHeight = 36;
  const columnWidth = (desktopMax - columnGap * (gridColumns - 1)) / gridColumns;
  const renderedWidth = columnWidth * columns + columnGap * (columns - 1);
  const renderedHeight = renderedWidth * (height / width) + captionHeight;

  return Math.max(24, Math.ceil((renderedHeight + rowGap) / rowStep));
}

function readPhotos() {
  mkdirSync(photoDir, { recursive: true });
  mkdirSync(publicPhotoDir, { recursive: true });
  const metadata = readMetadata();
  const files = readdirSync(photoDir)
    .filter((file) => file.toLowerCase().endsWith(".png"))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  const liveFiles = new Set(files);

  for (const entry of readdirSync(publicPhotoDir, { withFileTypes: true })) {
    if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".png") &&
      !liveFiles.has(entry.name)
    ) {
      rmSync(join(publicPhotoDir, entry.name), { force: true });
    }
  }

  return files
    .map((file, fallbackOrder) => {
      const filePath = join(photoDir, file);
      copyFileSync(filePath, join(publicPhotoDir, file));
      const dimensions = readPngSize(filePath);
      const data = metadata.get(file) || {};
      const location = data.location || captionFromFile(file);
      const columns = chooseColumns(dimensions.width, dimensions.height, data);

      return {
        file,
        order: Number(data.order ?? fallbackOrder),
        location,
        alt: data.alt || `Photograph from ${location.replace(/[.?!]$/, "")}`,
        columns,
        rows: chooseRows(dimensions.width, dimensions.height, columns),
        ...dimensions
      };
    })
    .sort((left, right) => left.order - right.order || left.file.localeCompare(right.file));
}

function renderFigure(photo) {
  const src = `${publicUrl}/${encodeURIComponent(photo.file)}`;

  return `          <figure class="photo-tile" style="--cols: ${photo.columns}; --rows: ${photo.rows}">
            <a class="photo-frame" href="${src}">
              <img
                src="${src}"
                width="${photo.width}"
                height="${photo.height}"
                loading="lazy"
                alt="${escapeAttr(photo.alt)}"
              />
            </a>
            <figcaption>${escapeHtml(photo.location)}</figcaption>
          </figure>`;
}

function replaceGeneratedRegion(html, photos) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);

  if (start === -1 || end === -1 || end < start) {
    throw new Error(`${galleryPath} is missing gallery generation markers`);
  }

  const body = photos.length
    ? `\n${photos.map(renderFigure).join("\n")}\n          `
    : `\n          <p class="gallery-empty">Coming soon.</p>\n          `;

  return `${html.slice(0, start + startMarker.length)}${body}${html.slice(end)}`;
}

const photos = readPhotos();
writeFileSync(galleryPath, replaceGeneratedRegion(readFileSync(galleryPath, "utf8"), photos));

console.log(`Generated ${photos.length} gallery photo${photos.length === 1 ? "" : "s"}.`);
