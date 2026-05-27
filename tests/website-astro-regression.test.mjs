/**
 * Regression coverage for the Astro marketing site and Netlify deploy wiring.
 * Run: node --test tests/website-astro-regression.test.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import { footerLinks, navItems, pricingPlans, trustPills } from '../website/src/data/site.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const websiteDir = path.join(root, 'website');
const pagesDir = path.join(websiteDir, 'src', 'pages');

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function parseAssignments(block) {
  const values = {};
  for (const match of block.matchAll(/^\s*([a-z_]+)\s*=\s*"([^"]*)"/gm)) {
    values[match[1]] = match[2];
  }
  for (const match of block.matchAll(/^\s*([a-z_]+)\s*=\s*(\d+)/gm)) {
    values[match[1]] = Number(match[2]);
  }
  return values;
}

function parseNetlifyConfig(source) {
  const buildMatch = source.match(/\[build\]([\s\S]*?)(?:\n\[|\n\[\[|$)/);
  const redirects = source
    .split('[[redirects]]')
    .slice(1)
    .map((block) => parseAssignments(block));

  return {
    build: buildMatch ? parseAssignments(buildMatch[1]) : {},
    redirects,
  };
}

function pagePathForRoute(route) {
  if (route === '/') return path.join(pagesDir, 'index.astro');
  return path.join(pagesDir, `${route.slice(1)}.astro`);
}

describe('website Astro regression coverage', () => {
  test('root npm test runs every mjs regression test', () => {
    const packageJson = JSON.parse(readText('package.json'));

    assert.match(
      packageJson.scripts.test,
      /node --test tests\/\*\.test\.mjs/,
      'root npm test should include all tests/*.test.mjs files'
    );
  });

  test('Netlify deploy config publishes the Astro static build', () => {
    const netlify = parseNetlifyConfig(readText('netlify.toml'));
    const astroConfig = readText('website/astro.config.mjs');

    assert.deepEqual(netlify.build, {
      base: 'website',
      command: 'npm run build',
      publish: 'dist',
    });
    assert.match(astroConfig, /output:\s*'static'/);
    assert.match(astroConfig, /format:\s*'file'/);
  });

  test('Netlify extensionless redirects target real Astro pages', () => {
    const { redirects } = parseNetlifyConfig(readText('netlify.toml'));

    assert.ok(redirects.length >= 8, 'expected website route redirects');

    for (const redirect of redirects) {
      assert.equal(redirect.status, 200, `${redirect.from} should be a rewrite`);
      assert.equal(redirect.to, `${redirect.from}.html`, `${redirect.from} should map to file output`);
      assert.ok(fs.existsSync(pagePathForRoute(redirect.from)), `Missing Astro page for ${redirect.from}`);
    }
  });

  test('shared navigation and footer links resolve to Astro pages', () => {
    const localLinks = [...navItems, ...footerLinks]
      .map((item) => item.href)
      .filter((href) => href.startsWith('/'));

    assert.deepEqual(navItems.map((item) => item.href), ['/', '/pricing', '/about', '/contact', '/account']);

    for (const href of localLinks) {
      assert.ok(fs.existsSync(pagePathForRoute(href)), `Broken website link: ${href}`);
    }
  });

  test('homepage keeps launch status, password recovery, and pricing entry points', () => {
    const home = readText('website/src/pages/index.astro');

    assert.match(home, /Edge\s+.\s+Live Now/);
    assert.match(home, /Chrome\s+.\s+Coming Soon/);
    assert.match(home, /window\.location\.replace\('\/reset-password'/);
    assert.match(home, /pricingPlans\.map/);
    assert.match(home, /href="\/pricing"/);
    assert.match(home, /counterStats/);
    assert.match(home, /IntersectionObserver/);
    assert.match(home, /requestAnimationFrame/);
  });

  test('homepage plan data preserves free, sync, and AI tier messaging', () => {
    assert.equal(pricingPlans.length, 3);

    const free = pricingPlans.find((plan) => plan.id === 'freemium');
    const basic = pricingPlans.find((plan) => plan.id === 'basic');
    const enhanced = pricingPlans.find((plan) => plan.id === 'enhanced');

    assert.ok(free.features.includes('Local device storage'));
    assert.ok(basic.features.includes('Cloud sync'));
    assert.ok(enhanced.features.includes('AI summaries'));
    assert.ok(trustPills.includes('Cloud-backed sync'));
  });

  test('decorative visual elements stay hidden from assistive tech', () => {
    const hero = readText('website/src/components/Hero.astro');
    const featureGrid = readText('website/src/components/FeatureGrid.astro');

    assert.match(hero, /class="hero-orb orb-1"\s+aria-hidden="true"/);
    assert.match(hero, /class="hero-orb orb-2"\s+aria-hidden="true"/);
    assert.match(hero, /class="hero-orb orb-3"\s+aria-hidden="true"/);
    assert.match(hero, /class="hero-glow"\s+aria-hidden="true"/);
    assert.match(featureGrid, /pointer-events:\s*none/);
  });
});
