import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  closeSync,
  openSync,
  readSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
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
const maxWorkerAssetBytes = 25 * 1024 * 1024;

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

function requireText(entry, key, index) {
  if (typeof entry[key] !== "string" || !entry[key].trim()) {
    throw new Error(`${metadataPath} entry ${index + 1} needs a non-empty ${key}`);
  }

  return entry[key].trim();
}

function readPhotoEntries() {
  if (!existsSync(metadataPath)) return [];

  const parsed = JSON.parse(readFileSync(metadataPath, "utf8"));
  const entries = Array.isArray(parsed) ? parsed : parsed.photos;

  if (!Array.isArray(entries)) {
    throw new Error(`${metadataPath} must be an array or an object with a photos array`);
  }

  const seen = new Set();

  return entries.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`${metadataPath} entry ${index + 1} must be an object`);
    }

    const file = requireText(entry, "file", index);

    if (file !== basename(file) || file.includes("\\") || file.includes("/")) {
      throw new Error(`${metadataPath} entry ${index + 1} file must be a filename only`);
    }

    if (!file.toLowerCase().endsWith(".png")) {
      throw new Error(`${metadataPath} entry ${index + 1} must name a PNG source file`);
    }

    if (seen.has(file)) {
      throw new Error(`${metadataPath} contains duplicate gallery file ${file}`);
    }

    seen.add(file);

    const order = Number(entry.order ?? index);

    if (!Number.isFinite(order)) {
      throw new Error(`${metadataPath} entry ${index + 1} order must be a number`);
    }

    return {
      file,
      location: requireText(entry, "location", index),
      alt: requireText(entry, "alt", index),
      columns: entry.columns,
      order
    };
  });
}

function publicFileFor(sourceFile) {
  return `${basename(sourceFile, extname(sourceFile))}.webp`;
}

function chooseColumns(width, height, metadata) {
  if (metadata.columns !== undefined) {
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

function convertToLosslessWebp(sourcePath, outputPath) {
  const tempPath = `${outputPath}.${process.pid}.tmp.webp`;

  rmSync(tempPath, { force: true });

  try {
    execFileSync(
      "convert",
      [sourcePath, "-strip", "-define", "webp:lossless=true", tempPath],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    const outputSize = validateWebpOutput(tempPath);

    renameSync(tempPath, outputPath);
    return outputSize;
  } catch (error) {
    rmSync(tempPath, { force: true });
    const stderr = error.stderr?.toString().trim();
    if (stderr) {
      throw new Error(`ImageMagick failed while converting ${sourcePath}:\n${stderr}`);
    }

    throw error;
  }
}

function validateWebpOutput(filePath) {
  const outputSize = statSync(filePath).size;

  if (outputSize <= 0) {
    throw new Error(`${filePath} is empty after WebP conversion`);
  }

  const header = Buffer.alloc(12);
  const descriptor = openSync(filePath, "r");

  try {
    const bytesRead = readSync(descriptor, header, 0, header.length, 0);

    if (
      bytesRead < header.length ||
      header.toString("ascii", 0, 4) !== "RIFF" ||
      header.toString("ascii", 8, 12) !== "WEBP"
    ) {
      throw new Error(`${filePath} is not a valid WebP file`);
    }
  } finally {
    closeSync(descriptor);
  }

  return outputSize;
}

function readCachedWebpSize(sourcePath, outputPath) {
  if (!existsSync(outputPath)) return null;

  try {
    const sourceStats = statSync(sourcePath);
    const outputStats = statSync(outputPath);

    if (outputStats.mtimeMs < sourceStats.mtimeMs) return null;

    const outputSize = validateWebpOutput(outputPath);

    if (outputSize > maxWorkerAssetBytes) return null;

    return outputSize;
  } catch {
    return null;
  }
}

function removeStalePublicFiles(liveWebps) {
  for (const entry of readdirSync(publicPhotoDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;

    const lowerName = entry.name.toLowerCase();
    const isRawPng = lowerName.endsWith(".png");
    const isStaleWebp = lowerName.endsWith(".webp") && !liveWebps.has(entry.name);

    if (isRawPng || isStaleWebp) {
      rmSync(join(publicPhotoDir, entry.name), { force: true });
    }
  }
}

function readPhotos() {
  mkdirSync(photoDir, { recursive: true });
  mkdirSync(publicPhotoDir, { recursive: true });

  const entries = readPhotoEntries();
  const liveWebps = new Set(entries.map((entry) => publicFileFor(entry.file)));
  let cachedCount = 0;
  let convertedCount = 0;

  removeStalePublicFiles(liveWebps);

  const photos = entries.map((entry) => {
    const sourcePath = join(photoDir, entry.file);

    if (!existsSync(sourcePath)) {
      throw new Error(`${metadataPath} lists missing gallery source ${entry.file}`);
    }

    const dimensions = readPngSize(sourcePath);
    const publicFile = publicFileFor(entry.file);
    const outputPath = join(publicPhotoDir, publicFile);

    let outputSize = readCachedWebpSize(sourcePath, outputPath);

    if (outputSize === null) {
      outputSize = convertToLosslessWebp(sourcePath, outputPath);
      convertedCount += 1;
    } else {
      cachedCount += 1;
    }

    if (outputSize > maxWorkerAssetBytes) {
      rmSync(outputPath, { force: true });
      throw new Error(
        `${publicFile} is ${outputSize} bytes, above Workers' ${maxWorkerAssetBytes} byte per-file limit`
      );
    }

    const columns = chooseColumns(dimensions.width, dimensions.height, entry);

    return {
      ...entry,
      publicFile,
      columns,
      rows: chooseRows(dimensions.width, dimensions.height, columns),
      size: outputSize,
      ...dimensions
    };
  });

  removeStalePublicFiles(liveWebps);

  return {
    photos: photos.sort(
      (left, right) => left.order - right.order || left.file.localeCompare(right.file)
    ),
    cachedCount,
    convertedCount
  };
}

function renderFigure(photo) {
  const src = `${publicUrl}/${encodeURIComponent(photo.publicFile)}`;

  return `          <figure class="photo-tile" style="--cols: ${photo.columns}; --rows: ${photo.rows}">
            <a class="photo-frame" href="${src}">
              <img
                src="${src}"
                width="${photo.width}"
                height="${photo.height}"
                loading="lazy"
                decoding="async"
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

const { photos, cachedCount, convertedCount } = readPhotos();
writeFileSync(galleryPath, replaceGeneratedRegion(readFileSync(galleryPath, "utf8"), photos));

console.log(
  `Generated ${photos.length} gallery photo${photos.length === 1 ? "" : "s"} (${cachedCount} cached, ${convertedCount} converted).`
);
