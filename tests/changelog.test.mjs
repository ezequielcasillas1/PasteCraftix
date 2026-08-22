import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataUrl = pathToFileURL(join(__dirname, '..', 'website/src/data/changelog.js')).href;
const headerUrl = pathToFileURL(
  join(__dirname, '..', 'extension/popup/features/header/header.changelog.constants.js'),
).href;
const eventsUrl = pathToFileURL(
  join(__dirname, '..', 'extension/popup/features/header/header.changelog.js'),
).href;

const { changelogReleases, changelogEras, listChangelogVersions } = await import(dataUrl);
const { CHANGELOG_URL, CHANGELOG_LINK_ID } = await import(headerUrl);
const { openChangelogPage } = await import(eventsUrl);

assert.ok(changelogReleases.length >= 8, 'expected store versions');
assert.equal(changelogReleases[0].version, '3.0.37');
assert.deepEqual(
  [...listChangelogVersions()],
  [...new Set(listChangelogVersions())],
  'versions must be unique',
);

for (const release of changelogReleases) {
  assert.ok(release.version);
  assert.match(release.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(release.title);
  assert.ok(Array.isArray(release.highlights) && release.highlights.length > 0);
}

assert.ok(changelogEras.some((era) => era.id === 'late-2025'));
assert.equal(CHANGELOG_URL, 'https://pastecraft.com/changelog');
assert.equal(CHANGELOG_LINK_ID, 'headerChangelogLink');

let opened = null;
openChangelogPage((opts) => {
  opened = opts;
});
assert.deepEqual(opened, { url: CHANGELOG_URL, active: true });

console.log('changelog: ok');
