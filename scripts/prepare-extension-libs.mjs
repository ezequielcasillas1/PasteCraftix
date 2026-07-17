import { mkdir, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libDir = path.join(root, 'extension', 'lib');
const katexFontsDir = path.join(libDir, 'katex-fonts');

const PDF_VERSION = '3.11.174';
const MARKED_VERSION = '12.0.2';
const PURIFY_VERSION = '3.1.6';
const HIGHLIGHT_VERSION = '11.9.0';
const KATEX_VERSION = '0.16.9';
const MERMAID_VERSION = '10.9.1';

const assets = [
  {
    file: 'pdf.min.js',
    url: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/pdf.min.js`,
  },
  {
    file: 'pdf.worker.min.js',
    url: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/pdf.worker.min.js`,
  },
  {
    file: 'marked.min.js',
    url: `https://cdnjs.cloudflare.com/ajax/libs/marked/${MARKED_VERSION}/marked.min.js`,
  },
  {
    file: 'purify.min.js',
    url: `https://cdnjs.cloudflare.com/ajax/libs/dompurify/${PURIFY_VERSION}/purify.min.js`,
  },
  {
    file: 'highlight.min.js',
    url: `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/${HIGHLIGHT_VERSION}/highlight.min.js`,
  },
  {
    file: 'highlight-github.min.css',
    url: `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/${HIGHLIGHT_VERSION}/styles/github.min.css`,
    minBytes: 256,
  },
  {
    file: 'katex.min.js',
    url: `https://cdnjs.cloudflare.com/ajax/libs/KaTeX/${KATEX_VERSION}/katex.min.js`,
  },
  {
    file: 'katex.min.css',
    url: `https://cdnjs.cloudflare.com/ajax/libs/KaTeX/${KATEX_VERSION}/katex.min.css`,
    // Existing popup/manifest expect fonts under lib/katex-fonts/
    transformText: (text) => text.replace(/url\(fonts\//g, 'url(katex-fonts/'),
    minBytes: 256,
  },
  {
    file: 'mermaid.min.js',
    url: `https://cdnjs.cloudflare.com/ajax/libs/mermaid/${MERMAID_VERSION}/mermaid.min.js`,
    minBytes: 50_000,
  },
];

const KATEX_FONT_FILES = [
  'KaTeX_AMS-Regular.woff2',
  'KaTeX_Caligraphic-Bold.woff2',
  'KaTeX_Caligraphic-Regular.woff2',
  'KaTeX_Fraktur-Bold.woff2',
  'KaTeX_Fraktur-Regular.woff2',
  'KaTeX_Main-Bold.woff2',
  'KaTeX_Main-BoldItalic.woff2',
  'KaTeX_Main-Italic.woff2',
  'KaTeX_Main-Regular.woff2',
  'KaTeX_Math-BoldItalic.woff2',
  'KaTeX_Math-Italic.woff2',
  'KaTeX_SansSerif-Bold.woff2',
  'KaTeX_SansSerif-Italic.woff2',
  'KaTeX_SansSerif-Regular.woff2',
  'KaTeX_Script-Regular.woff2',
  'KaTeX_Size1-Regular.woff2',
  'KaTeX_Size2-Regular.woff2',
  'KaTeX_Size3-Regular.woff2',
  'KaTeX_Size4-Regular.woff2',
  'KaTeX_Typewriter-Regular.woff2',
];

async function downloadBytes(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function prepareAsset(asset) {
  const bytes = await downloadBytes(asset.url);
  const minBytes = asset.minBytes ?? 1024;
  let output = bytes;

  if (typeof asset.transformText === 'function') {
    output = Buffer.from(asset.transformText(bytes.toString('utf8')), 'utf8');
  }

  if (output.length < minBytes) {
    throw new Error(`Downloaded ${asset.file} looks invalid (${output.length} bytes)`);
  }

  await writeFile(path.join(libDir, asset.file), output);
  console.log(`Prepared ${asset.file} (${output.length} bytes)`);
}

async function prepareKatexFonts() {
  await mkdir(katexFontsDir, { recursive: true });

  for (const file of KATEX_FONT_FILES) {
    const url = `https://cdnjs.cloudflare.com/ajax/libs/KaTeX/${KATEX_VERSION}/fonts/${file}`;
    const bytes = await downloadBytes(url);
    if (bytes.length < 256) {
      throw new Error(`Downloaded katex font ${file} looks invalid (${bytes.length} bytes)`);
    }
    await writeFile(path.join(katexFontsDir, file), bytes);
    console.log(`Prepared katex-fonts/${file} (${bytes.length} bytes)`);
  }
}

await mkdir(libDir, { recursive: true });

for (const asset of assets) {
  await prepareAsset(asset);
}

await prepareKatexFonts();

const prepared = await readdir(libDir);
console.log(`Done. extension/lib now has ${prepared.length} entries (lucide and other local vendors left untouched).`);
