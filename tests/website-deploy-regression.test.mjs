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

function listAstroPages() {
  return new Set(
    fs
      .readdirSync(path.join(websiteDir, 'src', 'pages'))
      .filter((file) => file.endsWith('.astro'))
      .map((file) => file.replace(/\.astro$/, '.html'))
  );
}

describe('website deploy regression coverage', () => {
  test('Netlify publishes Astro build output from the website app', () => {
    const netlify = read('netlify.toml');
    const websitePackage = JSON.parse(read('website/package.json'));
    const astroConfig = read('website/astro.config.mjs');
    const guide = read('website/DEPLOYMENT_GUIDE.md');

    assert.match(netlify, /\[build\][\s\S]*base = "website"/);
    assert.match(netlify, /\[build\][\s\S]*command = "npm run build"/);
    assert.match(netlify, /\[build\][\s\S]*publish = "dist"/);
    assert.equal(websitePackage.scripts.build, 'astro build');
    assert.match(astroConfig, /output:\s*'static'/);
    assert.match(astroConfig, /format:\s*'file'/);
    assert.match(guide, /Publish directory:\*\* `dist`/);
    assert.match(guide, /Legacy files like `website\/index\.html` are not published/);
  });

  test('Netlify redirects map to existing Astro pages', () => {
    const netlify = read('netlify.toml');
    const pages = listAstroPages();
    const redirects = [...netlify.matchAll(/from = "\/([^"]+)"\s+to = "\/([^"]+\.html)"/g)];

    assert.ok(redirects.length >= 10, 'expected route redirects for website pages');

    for (const [, route, htmlTarget] of redirects) {
      assert.ok(pages.has(htmlTarget), `/${route} points to missing Astro page ${htmlTarget}`);
    }
  });
});

describe('homepage visual overhaul regression coverage', () => {
  test('homepage source owns the launch messaging and conversion paths', () => {
    const index = read('website/src/pages/index.astro');

    assert.match(index, /import Hero from '\.\.\/components\/Hero\.astro'/);
    assert.match(index, /title="PasteCraft \| Best Clipboard Manager & History Extension for Chrome & Edge"/);
    assert.match(index, /primaryHref="\/pricing"/);
    assert.match(index, /secondaryHref="\/about"/);
    assert.match(index, /href="\/account"/);
    assert.match(index, /Edge\s+.\s+Live Now/);
    assert.match(index, /Chrome\s+.\s+Coming Soon/);
    assert.match(index, /pricingPlans\.map/);
    assert.match(index, /trustPills\.map/);
  });

  test('password recovery hashes still route to the reset-password page', () => {
    const index = read('website/src/pages/index.astro');

    assert.match(index, /new URLSearchParams\(\(window\.location\.hash \|\| ''\)\.substring\(1\)\)/);
    assert.match(index, /_hashParams\.get\('type'\) === 'recovery'/);
    assert.match(index, /_hashParams\.get\('access_token'\)/);
    assert.match(index, /_hashParams\.get\('error_description'\)/);
    assert.match(index, /window\.location\.replace\('\/reset-password' \+ \(window\.location\.hash \|\| ''\)\)/);
  });

  test('new shared visual components keep core accessibility and external-link safety', () => {
    const hero = read('website/src/components/Hero.astro');
    const header = read('website/src/components/Header.astro');
    const footer = read('website/src/components/Footer.astro');

    assert.match(hero, /class="hero-orb orb-1" aria-hidden="true"/);
    assert.match(hero, /class="hero-orb orb-2" aria-hidden="true"/);
    assert.match(hero, /class="hero-orb orb-3" aria-hidden="true"/);
    assert.match(hero, /class="hero-glow" aria-hidden="true"/);
    assert.match(header, /<nav aria-label="Primary">/);
    assert.match(header, /aria-label="PasteCraft home"/);
    assert.match(header, /alt="PasteCraft logo"/);
    assert.match(footer, /target="_blank" rel="noopener"/);
  });
});
