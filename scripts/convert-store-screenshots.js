const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const INPUT_DIR = path.join(ROOT, "edge-store-assets", "screenshots");
const OUTPUT_DIR = INPUT_DIR;

const OUT_W = 1280;
const OUT_H = 800;

const CARD_W = 560;
const CARD_H = 760;
const PAD = 20;

const INPUTS = [
  { in: "home PC.png", out: "screenshot-01-main-popup.png" },
  { in: "ai lab page PC.png", out: "screenshot-02-quick-view.png" },
  { in: "Categories PC.png", out: "screenshot-03-categories.png" },
  { in: "AI LAB PC.png", out: "screenshot-04-ai-features.png" },
  { in: "Search PC.png", out: "screenshot-05-search.png" },
];

async function buildScreenshot(inPath, outPath) {
  const bg = sharp(inPath)
    .resize(OUT_W, OUT_H, { fit: "cover" })
    .blur(24)
    .modulate({ brightness: 0.9, saturation: 1.05 });

  const fg = await sharp(inPath)
    .resize(CARD_W - PAD * 2, CARD_H - PAD * 2, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const card = await sharp({
    create: {
      width: CARD_W,
      height: CARD_H,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0.1 },
    },
  })
    .composite([{ input: fg, left: PAD, top: PAD }])
    .png()
    .toBuffer();

  const left = Math.floor((OUT_W - CARD_W) / 2);
  const top = Math.floor((OUT_H - CARD_H) / 2);

  await bg
    .composite([{ input: card, left, top }])
    .png()
    .toFile(outPath);
}

async function main() {
  if (!fs.existsSync(INPUT_DIR)) {
    throw new Error(`Input dir not found: ${INPUT_DIR}`);
  }

  let made = 0;
  for (const item of INPUTS) {
    const inPath = path.join(INPUT_DIR, item.in);
    const outPath = path.join(OUTPUT_DIR, item.out);

    if (!fs.existsSync(inPath)) {
      console.log(`Skip missing: ${item.in}`);
      continue;
    }

    await buildScreenshot(inPath, outPath);
    made += 1;
  }

  console.log(
    `Created ${made} store screenshots at ${OUT_W}x${OUT_H} in: ${OUTPUT_DIR}`
  );
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});


