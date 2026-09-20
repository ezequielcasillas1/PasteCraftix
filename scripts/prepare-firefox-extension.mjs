/**
 * Copy extension/ → dist/firefox-unpacked with a Firefox manifest.
 * Load Temporary Add-on: dist/firefox-unpacked/manifest.json
 * Does not change the Chrome/Edge extension/manifest.json.
 */

import { cp, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { transformChromiumManifestForFirefox } from '../extension/shared/firefox-manifest-transform.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'extension');
const destDir = join(root, 'dist', 'firefox-unpacked');

function shouldCopy(src) {
  const name = String(src || '').replace(/\\/g, '/').split('/').pop() || '';
  return !name.endsWith('.wip');
}

const chromiumManifest = JSON.parse(
  readFileSync(join(sourceDir, 'manifest.json'), 'utf8'),
);
const firefoxManifest = transformChromiumManifestForFirefox(chromiumManifest);

await mkdir(destDir, { recursive: true });
await cp(sourceDir, destDir, {
  recursive: true,
  force: true,
  filter: (src) => shouldCopy(src),
});
await writeFile(
  join(destDir, 'manifest.json'),
  `${JSON.stringify(firefoxManifest, null, 2)}\n`,
  'utf8',
);

console.log(`Firefox unpacked: ${destDir}`);
console.log('about:debugging → This Firefox → Load Temporary Add-on → manifest.json');
