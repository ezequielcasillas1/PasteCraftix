import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import {
  footerLinks,
  navItems,
  pricingPlans,
  trustPills,
} from '../website/src/data/site.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const websiteDir = path.join(root, 'website');
const pagesDir = path.join(websiteDir, 'src', 'pages');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function routeToPageFile(route) {
  return route === '/' ? 'index.astro' : `${route.slice(1)}.astro`;
}

function assertSourceRouteExists(route) {
  assert.ok(route.startsWith('/'), `Route must be absolute: ${route}`);
  assert.ok(!route.includes('.html'), `Source routes should stay extensionless: ${route}`);

  const pagePath = path.join(pagesDir, routeToPageFile(route));
  assert.ok(fs.existsSync(pagePath), `Missing Astro page for ${route}: ${pagePath}`);
}

function parseNetlifyRedirects(source) {
  const redirects = [];
  let current = null;

  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (line === '[[redirects]]') {
      current = {};
      redirects.push(current);
      continue;
    }

    if (!current) continue;

    const match = line.match(/^([A-Za-z_]+)\s*=\s*(?:"([^"]*)"|(\d+))$/);
    if (match) current[match[1]] = match[2] ?? Number(match[3]);
  }

  return redirects;
}

function listExpectedStaticRoutes() {
  return fs
    .readdirSync(pagesDir)
    .filter((name) => name.endsWith('.astro') && name !== 'index.astro')
    .map((name) => `/${name.replace(/\.astro$/, '')}`)
    .sort();
}

describe('website Astro regression coverage', () => {
  test('Netlify deploy config stays aligned with Astro static file routes', () => {
    const astroConfig = read('website/astro.config.mjs');
    assert.match(astroConfig, /site:\s*['"]https:\/\/pastecraft\.com['"]/);
    assert.match(astroConfig, /output:\s*['"]static['"]/);
    assert.match(astroConfig, /format:\s*['"]file['"]/);

    const netlify = read('netlify.toml');
    assert.match(netlify, /base\s*=\s*"website"/);
    assert.match(netlify, /command\s*=\s*"npm run build"/);
    assert.match(netlify, /publish\s*=\s*"dist"/);

    const redirects = parseNetlifyRedirects(netlify);
    const expectedRoutes = listExpectedStaticRoutes();

    assert.deepEqual(
      redirects.map((redirect) => redirect.from).sort(),
      expectedRoutes,
      'Every non-home Astro page needs an extensionless Netlify redirect'
    );

    for (const redirect of redirects) {
      assert.equal(redirect.status, 200, `Redirect ${redirect.from} should be a rewrite`);
      assert.equal(redirect.to, `${redirect.from}.html`);
      assertSourceRouteExists(redirect.from);
    }
  });

  test('homepage keeps Supabase password recovery hash redirect intact', () => {
    const indexPage = read('website/src/pages/index.astro');

    assertSourceRouteExists('/reset-password');
    assert.match(indexPage, /new URLSearchParams\(\(window\.location\.hash \|\| ''\)\.substring\(1\)\)/);
    assert.match(indexPage, /_hashParams\.get\('type'\) === 'recovery'/);
    assert.match(indexPage, /_hashParams\.get\('access_token'\)/);
    assert.match(indexPage, /_hashParams\.get\('error_description'\)/);
    assert.match(indexPage, /window\.location\.replace\('\/reset-password' \+ \(window\.location\.hash \|\| ''\)\)/);
  });

  test('homepage and shared navigation links resolve to Astro source routes', () => {
    const indexPage = read('website/src/pages/index.astro');
    const routeAttrs = indexPage.matchAll(
      /\b(?:href|primaryHref|secondaryHref)=["'](\/[^"'#?]+)["']/g
    );
    const homepageRoutes = [...routeAttrs].map(([, route]) => route);
    const sharedRoutes = [...navItems, ...footerLinks]
      .map((item) => item.href)
      .filter((href) => href.startsWith('/'));

    for (const route of new Set([...homepageRoutes, ...sharedRoutes])) {
      assertSourceRouteExists(route);
    }
  });

  test('homepage preserves launch status and plan data used by pricing cards', () => {
    const indexPage = read('website/src/pages/index.astro');

    assert.match(indexPage, /Edge\s+[^A-Za-z0-9]*\s+Live Now/);
    assert.match(indexPage, /Chrome\s+[^A-Za-z0-9]*\s+Coming Soon/);
    assert.match(indexPage, /pricingPlans\.map/);
    assert.match(indexPage, /trustPills\.map/);
    assert.ok(trustPills.includes('Cloud-backed sync'));

    assert.deepEqual(
      pricingPlans.map((plan) => plan.id),
      ['freemium', 'basic', 'enhanced']
    );

    const [freemiumPlan, basicPlan, enhancedPlan] = pricingPlans;
    assert.equal(freemiumPlan.price, '$0');
    assert.match(freemiumPlan.note, /locally/i);
    assert.equal(basicPlan.popular, true);
    assert.deepEqual(Object.keys(basicPlan.billing), ['weekly', 'monthly', 'yearly']);
    assert.deepEqual(Object.keys(enhancedPlan.billing), ['weekly', 'monthly', 'yearly']);
  });
});
