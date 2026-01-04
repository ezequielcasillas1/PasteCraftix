const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const INPUT_DIR = path.join(
  ROOT,
  "edge-store-assets",
  "promotional",
  "feature-icons"
);
const OUTPUT_DIR = path.join(INPUT_DIR, "png");

const SIZE = Number.parseInt(process.argv[2] || "256", 10);
const DENSITY = Number.parseInt(process.argv[3] || "512", 10);

function sanitizeBaseName(name) {
  return name
    .replace(/\.(svg)$/i, "")
    .replace(/\s*\(\d+\)\s*/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  if (!Number.isFinite(SIZE) || SIZE <= 0) {
    throw new Error(`Invalid size: ${process.argv[2]}`);
  }

  if (!fs.existsSync(INPUT_DIR)) {
    throw new Error(`Input dir not found: ${INPUT_DIR}`);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const entries = fs
    .readdirSync(INPUT_DIR, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".svg"))
    .map((d) => d.name);

  if (entries.length === 0) {
    console.log("No SVGs found. Nothing to do.");
    return;
  }

  let converted = 0;
  for (const file of entries) {
    const inPath = path.join(INPUT_DIR, file);
    const base = sanitizeBaseName(file);
    const outPath = path.join(OUTPUT_DIR, `${base}-${SIZE}x${SIZE}.png`);

    const svg = fs.readFileSync(inPath);
    await sharp(svg, { density: DENSITY })
      .resize(SIZE, SIZE, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(outPath);

    converted += 1;
  }

  console.log(
    `Converted ${converted} SVG(s) to ${SIZE}x${SIZE} PNG(s) in: ${OUTPUT_DIR}`
  );
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});


