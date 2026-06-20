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

    assert.equal(warns.length, 2);
    assert.match(String(warns[0][0]), /\[PasteCraft:debug:ux-perf\]/);
    assert.equal(warns[0][1].hypothesisId, 'PERF');
    assert.equal(warns[0][1].data.level, 'warn');
    assert.equal(warns[1][1].data.level, 'slow');
  });

  test('ok-level probes buffer without console.warn', async () => {
    globalThis.window = { __pcUxPerf: [] };
    const mod = await import(`${moduleUrl}?t=${Date.now()}-buf`);
    const warns = [];
    const orig = console.warn;
    console.warn = (...args) => warns.push(args);

    mod.emitUxPerfProbe({ category: 'click', label: 'fast', durationMs: 50 });

    console.warn = orig;

    assert.equal(warns.length, 0);
    assert.equal(globalThis.window.__pcUxPerf.length, 1);
    assert.equal(globalThis.window.__pcUxPerf[0].data.level, 'ok');
    delete globalThis.window;
  });

  test('finishUxInteractionAfterPaint sets afterPaint', async () => {
    globalThis.window = { __pcUxPerf: [] };
    const origRaf = globalThis.requestAnimationFrame;
    const origPerf = globalThis.performance;
    globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
    let perfNow = 0;
    globalThis.performance = { now: () => { perfNow += 150; return perfNow; } };

    const mod = await import(`${moduleUrl}?t=${Date.now()}-paint`);
    const ctx = mod.startUxInteraction('nav-tab', 'clips→ai');
    await new Promise((resolve) => {
      mod.finishUxInteractionAfterPaint(ctx, { location: 'test' });
      setTimeout(resolve, 30);
    });

    globalThis.requestAnimationFrame = origRaf;
    globalThis.performance = origPerf;

    const entry = globalThis.window.__pcUxPerf.find((row) => row.data?.category === 'nav-tab');
    assert.ok(entry, 'expected nav-tab probe in buffer');
    assert.equal(entry.data.afterPaint, true);
    assert.equal(entry.data.level, 'warn');
    delete globalThis.window;
  });
});
