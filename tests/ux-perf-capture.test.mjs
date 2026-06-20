/**
 * UX perf capture thresholds and helpers.
 * Run: node --test tests/ux-perf-capture.test.mjs
 */

import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(
  path.join(__dirname, '../extension/popup/shared/ux-perf-capture.js'),
).href;

describe('ux-perf-capture', () => {
  test('levelForMs thresholds: ok <100, warn 100-299, slow >=300', async () => {
    const mod = await import(moduleUrl);
    const warns = [];
    const orig = console.warn;
    console.warn = (...args) => warns.push(args);

    mod.emitUxPerfProbe({ category: 'click', label: 'fast', durationMs: 50 });
    mod.emitUxPerfProbe({ category: 'click', label: 'warn', durationMs: 100 });
    mod.emitUxPerfProbe({ category: 'click', label: 'slow', durationMs: 300 });

    console.warn = orig;

    assert.equal(warns.length, 3);
    assert.match(String(warns[0][0]), /\[PasteCraft:debug:ux-perf\]/);
    assert.equal(warns[0][1].hypothesisId, 'PERF');
    assert.equal(warns[0][1].data.level, 'ok');
    assert.equal(warns[1][1].data.level, 'warn');
    assert.equal(warns[2][1].data.level, 'slow');
  });

  test('finishUxInteractionAfterPaint sets afterPaint', async () => {
    const origRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);

    const mod = await import(`${moduleUrl}?t=${Date.now()}`);
    const warns = [];
    const origWarn = console.warn;
    console.warn = (...args) => warns.push(args);

    const ctx = mod.startUxInteraction('nav-tab', 'clips→ai');
    await new Promise((resolve) => {
      mod.finishUxInteractionAfterPaint(ctx, { location: 'test' });
      setTimeout(resolve, 30);
    });

    console.warn = origWarn;
    globalThis.requestAnimationFrame = origRaf;

    const entry = warns.find((w) => w[1]?.data?.category === 'nav-tab');
    assert.ok(entry, 'expected nav-tab probe');
    assert.equal(entry[1].data.afterPaint, true);
  });
});
