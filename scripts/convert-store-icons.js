const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const INPUT_SVG = path.join(ROOT, "edge-store-assets", "icons", "logo.svg");
const OUTPUT_DIR = path.join(ROOT, "edge-store-assets", "icons");

const DENSITY = Number.parseInt(process.argv[4] || "768", 10);

const SIZES = [16, 32, 48, 128, 300];

async function rasterizeSvgToPng(svgPath, outPath, size) {
  const svg = fs.readFileSync(svgPath);
  await sharp(svg, { density: DENSITY })
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outPath);
}

async function main() {
  if (path.extname(INPUT_SVG).toLowerCase() !== ".svg") {
    throw new Error(`Input file must be an SVG: ${INPUT_SVG}`);
  }

  if (!fs.existsSync(INPUT_SVG)) {
    throw new Error(`Input SVG not found: ${INPUT_SVG}`);
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Master/source raster (helps for future manual edits / re-exports)
  await rasterizeSvgToPng(
    INPUT_SVG,
    path.join(OUTPUT_DIR, "icon-master-1024.png"),
    1024
  );

  for (const size of SIZES) {
    await rasterizeSvgToPng(
      INPUT_SVG,
      path.join(OUTPUT_DIR, `icon-${size}.png`),
      size
    );
  }

  console.log(
    `Created store icons in ${OUTPUT_DIR}: icon-master-1024.png, ${SIZES.map(
      (s) => `icon-${s}.png`
    ).join(", ")}`
  );
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});


