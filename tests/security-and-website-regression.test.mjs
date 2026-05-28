import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

async function importTypeScript(relativePath) {
  const source = read(relativePath);
  const js = stripTypeScriptTypes(source);
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(js)}`);
}

describe('security hardening regressions', () => {
  test('admin CORS stays localhost-only while app CORS allows trusted origins', async () => {
    const { corsHeadersForOrigin, isAllowedAppOrigin, isLocalhostAdminOrigin } =
      await importTypeScript('supabase/functions/_shared/cors.ts');

    assert.equal(isLocalhostAdminOrigin('http://localhost:54321'), true);
    assert.equal(isLocalhostAdminOrigin('https://127.0.0.1:3000'), true);
    assert.equal(isLocalhostAdminOrigin('https://pastecraft.com'), false);

    assert.equal(isAllowedAppOrigin('https://pastecraft.com'), true);
    assert.equal(isAllowedAppOrigin('https://app.pastecraft.com'), true);
    assert.equal(isAllowedAppOrigin('chrome-extension://abcdefghijklmnop'), true);
    assert.equal(isAllowedAppOrigin('https://evil-pastecraft.com'), false);

    assert.equal(
      corsHeadersForOrigin('https://pastecraft.com', 'admin')['Access-Control-Allow-Origin'],
      'null',
    );
    assert.equal(
      corsHeadersForOrigin('http://localhost:54321', 'admin')['Access-Control-Allow-Origin'],
      'http://localhost:54321',
    );
    assert.equal(
      corsHeadersForOrigin('https://evil.example', 'app')['Access-Control-Allow-Origin'],
      'null',
    );
  });

  test('site guard blocks sensitive, scammy, and unsupported pages', async () => {
    const { isSiteAllowed } = await import(
      pathToFileURL(path.join(root, 'extension/content/safety/site-guard.js')).href
    );

    const allowed = [
      'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
      'https://docs.pastecraft.com/help?topic=clips',
    ];
    const blocked = [
      'chrome://extensions',
      'file:///tmp/secret.txt',
      'https://paypal.com/signin',
      'https://checkout.stripe.com/pay/cs_test_123',
      'https://secure-paypal-login.com/session',
      'https://xn--paypa1-l2a.com/login',
      'https://example.zip/download',
      'https://safe.example.com/wallet-connect?approve=true',
    ];

    for (const url of allowed) assert.equal(isSiteAllowed(url), true, url);
    for (const url of blocked) assert.equal(isSiteAllowed(url), false, url);
  });

  test('admin alerts cron uses a dedicated secret and preserves dedup filters', () => {
    const source = read('supabase/functions/admin-alerts/index.ts');
    const migration = read('db/migrations/20260522_admin_alerts_cron_secret.sql');

    assert.match(source, /ADMIN_ALERTS_CRON_SECRET/);
    assert.match(source, /token === CRON_SECRET/);
    assert.match(source, /\.is\('notified_at', null\)/);
    assert.match(source, /update\(\{ notified_at: new Date\(\)\.toISOString\(\) \}\)\.eq\('id', ev\.id\)/);
    assert.match(source, /T2_RATE_VIOLATION_THRESHOLD = 5/);
    assert.match(source, /T2_SECURITY_EVENT_THRESHOLD = 3/);
    assert.match(source, /T3_DAILY_UTC_HOUR = 15/);

    assert.match(migration, /cron_secret/);
    assert.match(migration, /Bearer '\s*\|\|\s*(settings|s)\.cron_secret/);
    assert.doesNotMatch(migration, /Bearer '\s*\|\|\s*settings\.service_role_key/);
  });
});

describe('Astro website deployment regressions', () => {
  test('Netlify publishes the Astro build output with extensionless route redirects', () => {
    const netlify = read('netlify.toml');
    const astroConfig = read('website/astro.config.mjs');
    const routes = [
      'account',
      'pricing',
      'upgrade',
      'about',
      'contact',
      'terms',
      'privacy',
      'success',
      'testerinfo',
      'reset-password',
    ];

    assert.match(netlify, /base = "website"/);
    assert.match(netlify, /command = "npm run build"/);
    assert.match(netlify, /publish = "dist"/);
    assert.match(astroConfig, /output:\s*'static'/);
    assert.match(astroConfig, /format:\s*'file'/);

    for (const route of routes) {
      assert.match(netlify, new RegExp(`from = "/${route}"[\\s\\S]*?to = "/${route}\\.html"`));
      assert.ok(fs.existsSync(path.join(root, 'website/src/pages', `${route}.astro`)), route);
    }
  });

  test('homepage keeps password recovery routing, launch status, and pricing CTAs intact', () => {
    const index = read('website/src/pages/index.astro');

    assert.match(index, /window\.location\.hash/);
    assert.match(index, /_hashParams\.get\('type'\) === 'recovery'/);
    assert.match(index, /_hashParams\.get\('access_token'\)/);
    assert.match(index, /window\.location\.replace\('\/reset-password' \+ \(window\.location\.hash \|\| ''\)\)/);
    assert.match(index, /Edge\s+.\s+Live Now/);
    assert.match(index, /Chrome\s+.\s+Coming Soon/);
    assert.match(index, /href="\/pricing"/);
    assert.match(index, /href="\/account"/);
  });

  test('decorative homepage motion remains hidden from assistive technology', () => {
    const hero = read('website/src/components/Hero.astro');

    assert.match(hero, /class="hero-orb orb-1" aria-hidden="true"/);
    assert.match(hero, /class="hero-orb orb-2" aria-hidden="true"/);
    assert.match(hero, /class="hero-orb orb-3" aria-hidden="true"/);
    assert.match(hero, /class="hero-glow" aria-hidden="true"/);
  });
});
