import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(join(__dirname, '..', 'website/src/data/seo.js')).href;
const {
  TITLE_MIN,
  TITLE_MAX,
  DESC_MIN,
  DESC_MAX,
  DEFAULT_KEYWORDS,
  pageSeo,
  getPageSeo,
  normalizeSeoPath,
  listIndexablePages,
  listNoindexPaths,
  renderRobotsTxt,
  renderSitemapXml,
  SITE_URL,
  OG_IMAGE_PATH,
  OG_IMAGE_ALT,
} = await import(url);

for (const [path, entry] of Object.entries(pageSeo)) {
  assert.ok(entry.title.length >= TITLE_MIN, `${path} title too short (${entry.title.length})`);
  assert.ok(entry.title.length <= TITLE_MAX, `${path} title too long (${entry.title.length})`);
  assert.ok(entry.description.length >= DESC_MIN, `${path} description too short (${entry.description.length})`);
  assert.ok(entry.description.length <= DESC_MAX, `${path} description too long (${entry.description.length})`);
}

assert.equal(normalizeSeoPath('/about.html'), '/about');
assert.equal(normalizeSeoPath('/merchant-test.html'), '/merchant-test');
assert.equal(normalizeSeoPath('/merchant-test/etsy.html'), '/merchant-test');
assert.equal(getPageSeo('/about.html').title, pageSeo['/about'].title);

const indexable = listIndexablePages().map((page) => page.path);
assert.deepEqual(indexable.sort(), [
  '/',
  '/about',
  '/changelog',
  '/contact',
  '/pricing',
  '/privacy',
  '/scholar-vs-merchant',
  '/support',
  '/terms',
  '/upgrade',
].sort());

const noindex = listNoindexPaths();
assert.ok(noindex.includes('/account'));
assert.ok(noindex.includes('/merchant-test'));
assert.ok(noindex.includes('/reset-password'));

const robots = renderRobotsTxt();
assert.match(robots, /Sitemap: https:\/\/pastecraft.com\/sitemap.xml/);
assert.match(robots, /Disallow: \/merchant-test\//);
assert.match(robots, /Disallow: \/account/);

const sitemap = renderSitemapXml('2026-08-16');
assert.match(sitemap, /<loc>https:\/\/pastecraft.com\/<\/loc>/);
assert.match(sitemap, /<loc>https:\/\/pastecraft.com\/pricing<\/loc>/);
assert.doesNotMatch(sitemap, /merchant-test/);
assert.doesNotMatch(sitemap, /\/account</);
assert.equal(SITE_URL, 'https://pastecraft.com');
assert.ok(
  existsSync(join(__dirname, '..', 'website/public', OG_IMAGE_PATH.replace(/^\//, ''))),
  `missing ${OG_IMAGE_PATH}`,
);

assert.match(pageSeo['/'].title, /smart clipboard manager extension/i);
assert.match(pageSeo['/'].title, /clipboard manager extension/i);
assert.match(pageSeo['/'].description, /smart clipboard manager extension/i);
assert.match(pageSeo['/'].description, /clipboard manager extension/i);
assert.match(DEFAULT_KEYWORDS, /clipboard manager extension/i);
assert.match(DEFAULT_KEYWORDS, /smart clipboard manager extension/i);
assert.match(OG_IMAGE_ALT, /smart clipboard manager extension/i);

const websiteSrc = join(__dirname, '..', 'website/src');
const heroCopy = readFileSync(join(websiteSrc, 'components/Hero.astro'), 'utf8');
const homeCopy = readFileSync(join(websiteSrc, 'pages/index.astro'), 'utf8');
const aboutCopy = readFileSync(join(websiteSrc, 'pages/about.astro'), 'utf8');
assert.match(heroCopy, /smart clipboard manager extension/);
assert.match(heroCopy, /clipboard manager extension/);
assert.match(homeCopy, /clipboard manager extension/);
assert.match(homeCopy, /smart clipboard manager extension/);
assert.match(aboutCopy, /clipboard manager extension/);
assert.match(aboutCopy, /href="\/"/);

console.log('website-seo-meta: ok');
