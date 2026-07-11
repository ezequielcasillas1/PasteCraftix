import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const libDir = path.join(root, 'extension', 'lib');

const PDF_VERSION = '3.11.174';
const assets = [
  {
    file: 'pdf.min.js',
    url: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/pdf.min.js`,
  },
  {
    file: 'pdf.worker.min.js',
    url: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/pdf.worker.min.js`,
  },
];

await mkdir(libDir, { recursive: true });

for (const asset of assets) {
  const response = await fetch(asset.url);
  if (!response.ok) {
    throw new Error(`Failed to download ${asset.file}: ${response.status} ${response.statusText}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1024) {
    throw new Error(`Downloaded ${asset.file} looks invalid (${bytes.length} bytes)`);
  }
  await writeFile(path.join(libDir, asset.file), bytes);
  console.log(`Prepared ${asset.file} (${bytes.length} bytes)`);
}
