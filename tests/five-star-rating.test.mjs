import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const repo = join(root, '..');

const constantsUrl = pathToFileURL(
  join(repo, 'extension/popup/features/five-star-rating/five-star-rating.constants.js'),
).href;
const openUrl = pathToFileURL(
  join(repo, 'extension/popup/features/five-star-rating/five-star-rating.open-store.js'),
).href;
const siteUrl = pathToFileURL(join(repo, 'website/src/data/site.js')).href;

const {
  CHROME_WEB_STORE_EXTENSION_ID,
  CHROME_WEB_STORE_REVIEWS_URL,
  EDGE_ADDONS_EXTENSION_ID,
  EDGE_ADDONS_REVIEWS_URL,
  FIVE_STAR_INCENTIVE_NOTE,
  FIVE_STAR_RATE_LABEL_CHROME,
  FIVE_STAR_RATING_LEAD,
  FIVE_STAR_RATING_SECTIONS,
} = await import(constantsUrl);
const { openChromeWebStoreReviews, resolveStoreReviewsUrl } = await import(openUrl);
const { storeLinks } = await import(siteUrl);

const publishedId = 'fidljmdohgkjmmgojdblbbnfoeengoko';

assert.equal(CHROME_WEB_STORE_EXTENSION_ID, publishedId);
assert.ok(storeLinks.chrome.includes(publishedId));
assert.equal(
  CHROME_WEB_STORE_REVIEWS_URL,
  `https://chromewebstore.google.com/detail/${publishedId}/reviews`,
);
assert.equal(FIVE_STAR_RATE_LABEL_CHROME, 'Rate 5 stars on the Chrome Web Store');
assert.equal(EDGE_ADDONS_EXTENSION_ID, 'fblihhfoojjhmhnhilhhejdcigjmmncc');
assert.ok(EDGE_ADDONS_REVIEWS_URL.includes(EDGE_ADDONS_EXTENSION_ID));

const copy = [
  FIVE_STAR_RATING_LEAD,
  FIVE_STAR_INCENTIVE_NOTE,
  ...FIVE_STAR_RATING_SECTIONS.flatMap((section) => [
    section.title,
    ...(section.paragraphs || []),
    ...(section.steps || []),
  ]),
].join('\n');

assert.match(copy, /5 stars/);
assert.match(copy, /Chrome Web Store/);
assert.match(copy, /doing a good job/);
assert.match(copy, /worth continuing/);
assert.match(copy, /recommendation/);
assert.match(copy, /spread the good news/i);
assert.match(copy, /one month/i);
assert.match(copy, /Basic plan/i);
assert.doesNotMatch(copy, /commission/i);
assert.doesNotMatch(copy, /payout/i);
assert.doesNotMatch(copy, /\$\d/);

const opened = [];
assert.equal(
  openChromeWebStoreReviews((options) => opened.push(options)),
  'tabs',
);
assert.deepEqual(opened, [{ url: resolveStoreReviewsUrl(), active: true }]);

const boot = fs.readFileSync(
  join(repo, 'extension/popup/features/app/popup.boot.js'),
  'utf8',
);
const popup = fs.readFileSync(join(repo, 'extension/popup.html'), 'utf8');
assert.match(boot, /five-star-rating\.controller\.js/);
assert.match(popup, /popup\/features\/five-star-rating\/five-star-rating\.css/);
assert.match(popup, /data-action="open-five-star-rating"/);
assert.match(popup, /headerRateBtn/);
