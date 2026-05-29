import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import { footerLinks, navItems, pricingPlans, socialLinks, storeLinks } from '../website/src/data/site.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const websiteDir = path.join(root, 'website');
const pagesDir = path.join(websiteDir, 'src', 'pages');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function publicRouteFromPage(fileName) {
  const name = fileName.replace(/\.astro$/, '');
  return name === 'index' ? '/' : `/${name}`;
}

function assertInternalPageExists(href) {
  if (href === '/') {
    assert.ok(fs.existsSync(path.join(pagesDir, 'index.astro')), 'Missing homepage source');
    return;
  }

  const pageName = href.replace(/^\//, '');
  assert.ok(
    fs.existsSync(path.join(pagesDir, `${pageName}.astro`)),
    `Missing Astro page for internal link: ${href}`
  );
}

describe('website deploy routing', () => {
  test('Netlify publishes the Astro build output, not legacy root files', () => {
    const astroConfig = read('website/astro.config.mjs');
    const netlifyConfig = read('netlify.toml');
    const deploymentGuide = read('website/DEPLOYMENT_GUIDE.md');

    assert.match(astroConfig, /output:\s*'static'/);
    assert.match(astroConfig, /format:\s*'file'/);
    assert.match(netlifyConfig, /base\s*=\s*"website"/);
    assert.match(netlifyConfig, /command\s*=\s*"npm run build"/);
    assert.match(netlifyConfig, /publish\s*=\s*"dist"/);
    assert.match(deploymentGuide, /Publish directory:\*\*\s*`dist`/);
    assert.match(deploymentGuide, /Legacy files like `website\/index\.html` are not published/);
  });

  test('every non-root Astro page has a clean-url Netlify redirect', () => {
    const netlifyConfig = read('netlify.toml');
    const routes = fs
      .readdirSync(pagesDir)
      .filter((file) => file.endsWith('.astro'))
      .map(publicRouteFromPage)
      .filter((route) => route !== '/');

    for (const route of routes) {
      const block = new RegExp(
        String.raw`\[\[redirects\]\]\s+from\s*=\s*"${route}"\s+to\s*=\s*"${route}\.html"\s+status\s*=\s*200`,
        'm'
      );
      assert.match(netlifyConfig, block, `Missing redirect for ${route}`);
    }
  });
});

describe('website business-flow links', () => {
  test('shared navigation and footer links resolve to Astro pages', () => {
    for (const item of [...navItems, ...footerLinks]) {
      assertInternalPageExists(item.href);
    }
  });

  test('homepage keeps primary conversion paths and plan cards wired', () => {
    const home = read('website/src/pages/index.astro');

    assert.match(home, /primaryHref="\/pricing"/);
    assert.match(home, /secondaryHref="\/about"/);
    assert.match(home, /href="\/account"/);
    assert.match(home, /pricingPlans\.map\(\(plan\) =>/);

    for (const plan of pricingPlans) {
      assert.ok(plan.id, 'Plan must have stable id');
      assert.ok(plan.name, `Plan ${plan.id} must have a display name`);
      assert.ok(plan.features.length >= 3, `Plan ${plan.id} must keep meaningful features`);
    }
  });

  test('store links and homepage launch status do not overstate Chrome availability', () => {
    const home = read('website/src/pages/index.astro');
    const dash = String.fromCharCode(0x2014);

    assert.equal(storeLinks.chrome, '#chrome-store-coming-soon');
    assert.match(home, new RegExp(`Chrome\\s+${dash}\\s+Coming Soon`));
    assert.match(home, new RegExp(`Edge\\s+${dash}\\s+Live Now`));
  });
});

describe('website auth and safety regressions', () => {
  test('homepage forwards Supabase recovery hashes to the reset-password route', () => {
    const home = read('website/src/pages/index.astro');

    assert.match(home, /new URLSearchParams\(\(window\.location\.hash \|\| ''\)\.substring\(1\)\)/);
    assert.match(home, /_hashParams\.get\('type'\) === 'recovery'/);
    assert.match(home, /_hashParams\.get\('access_token'\)/);
    assert.match(home, /_hashParams\.get\('error_description'\)/);
    assert.match(home, /window\.location\.replace\('\/reset-password' \+ \(window\.location\.hash \|\| ''\)\)/);
  });

  test('decorative hero layers are hidden from assistive tech and do not intercept clicks', () => {
    const hero = read('website/src/components/Hero.astro');

    assert.match(hero, /<div class="hero-orb orb-1" aria-hidden="true"><\/div>/);
    assert.match(hero, /<div class="hero-orb orb-2" aria-hidden="true"><\/div>/);
    assert.match(hero, /<div class="hero-orb orb-3" aria-hidden="true"><\/div>/);
    assert.match(hero, /<div class="hero-glow" aria-hidden="true"><\/div>/);
    assert.match(hero, /\.hero-glow\s*\{[\s\S]*?pointer-events:\s*none;/);
    assert.match(hero, /\.hero-orb\s*\{[\s\S]*?pointer-events:\s*none;/);
  });

  test('external social links open safely with noopener', () => {
    const footer = read('website/src/components/Footer.astro');
    const contact = read('website/src/pages/contact.astro');

    for (const item of socialLinks) {
      assert.match(item.href, /^https:\/\//, `${item.label} must use HTTPS`);
    }

    assert.match(footer, /target="_blank" rel="noopener"/);
    assert.match(contact, /target="_blank" rel="noopener"/);
  });
});
