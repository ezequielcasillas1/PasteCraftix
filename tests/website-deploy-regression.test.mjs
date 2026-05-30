import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const websiteDir = path.join(root, 'website');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

async function loadSiteData() {
  return import(`file://${path.join(websiteDir, 'src/data/site.js')}`);
}

function extractRedirects(netlifyToml) {
  const redirects = new Map();
  const blocks = netlifyToml.split(/\n\s*\[\[redirects\]\]\s*\n/g).slice(1);
  for (const block of blocks) {
    const from = block.match(/from\s*=\s*"([^"]+)"/)?.[1];
    const to = block.match(/to\s*=\s*"([^"]+)"/)?.[1];
    const status = Number(block.match(/status\s*=\s*(\d+)/)?.[1]);
    if (from && to) redirects.set(from, { to, status });
  }
  return redirects;
}

describe('website deploy regression coverage', () => {
  test('Netlify serves every shared navigation route as a static Astro page', async () => {
    const { footerLinks, navItems } = await loadSiteData();
    const redirects = extractRedirects(read('netlify.toml'));
    const routes = new Set(
      [...navItems, ...footerLinks]
        .map((item) => item.href)
        .filter((href) => href.startsWith('/') && href !== '/'),
    );

    for (const route of routes) {
      const pageName = `${route.slice(1)}.astro`;
      const pagePath = path.join(websiteDir, 'src/pages', pageName);
      assert.ok(fs.existsSync(pagePath), `Missing Astro page for ${route}`);
      assert.deepEqual(
        redirects.get(route),
        { to: `${route}.html`, status: 200 },
        `Missing Netlify static redirect for ${route}`,
      );
    }
  });

  test('homepage preserves production launch status and primary conversion routes', () => {
    const index = read('website/src/pages/index.astro');

    assert.match(index, /Edge\s+—\s+Live Now/);
    assert.match(index, /Chrome\s+—\s+Coming Soon/);
    assert.match(index, /primaryHref="\/pricing"/);
    assert.match(index, /secondaryHref="\/about"/);
    assert.match(index, /href="\/pricing"/);
    assert.match(index, /href="\/about"/);
  });

  test('decorative hero elements are hidden from assistive technology', () => {
    const hero = read('website/src/components/Hero.astro');

    assert.match(hero, /class="hero-orb orb-1" aria-hidden="true"/);
    assert.match(hero, /class="hero-orb orb-2" aria-hidden="true"/);
    assert.match(hero, /class="hero-orb orb-3" aria-hidden="true"/);
    assert.match(hero, /class="hero-glow" aria-hidden="true"/);
  });

  test('external footer links open safely without giving opener access', () => {
    const footer = read('website/src/components/Footer.astro');

    assert.match(footer, /target="_blank"/);
    assert.match(footer, /rel="noopener"/);
  });
});
