/**
 * Tab switch helpers — dirty flags and skip-render behavior.
 * Run: node --test tests/tab-nav.helpers.test.mjs
 */

import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(
  path.join(__dirname, '../extension/popup/features/app/tab-nav.helpers.js'),
).href;

function createMockApp(overrides = {}) {
  return {
    currentTab: 'clips',
    _tabDirty: { clips: false, categories: true, ai: false },
    _tabEverRendered: { clips: true, categories: false, ai: true },
    updateAiCreditsPills: () => {},
    renderChips: () => {},
    ...overrides,
  };
}

describe('tab-nav.helpers', () => {
  test('markTabsDirtyForStorageChange marks affected tabs', async () => {
    const mod = await import(moduleUrl);
    const app = createMockApp({
      _tabDirty: { clips: false, categories: false, search: false, ai: false },
    });

    mod.markTabsDirtyForStorageChange(app, { clipsChanged: true });
    assert.equal(app._tabDirty.clips, true);
    assert.equal(app._tabDirty.categories, true);
    assert.equal(app._tabDirty.search, true);
    assert.equal(app._tabDirty.ai, false);
  });

  test('switchMainTab refreshes AI credits without full render on clean tab', async () => {
    const origRaf = globalThis.requestAnimationFrame;
    const origDoc = globalThis.document;
    const origWin = globalThis.window;
    globalThis.requestAnimationFrame = (fn) => { fn(); return 0; };
    globalThis.document = {
      querySelectorAll: () => [{ classList: { remove: () => {}, add: () => {} } }],
      getElementById: (id) => (id === 'aiTab' ? { classList: { add: () => {} } } : null),
    };
    globalThis.window = { __pcTabIconRendering: false };

    const mod = await import(`${moduleUrl}?t=${Date.now()}`);
    let creditsRefreshed = false;
    const app = createMockApp({
      currentTab: 'clips',
      _tabDirty: { clips: false, ai: false },
      _tabEverRendered: { clips: true, ai: true },
      updateAiCreditsPills: () => { creditsRefreshed = true; },
    });

    const tabBtn = { classList: { add: () => {}, remove: () => {} }, dataset: { tab: 'ai' } };
    mod.switchMainTab(app, 'ai', tabBtn);
    assert.equal(creditsRefreshed, true);

    globalThis.requestAnimationFrame = origRaf;
    globalThis.document = origDoc;
    globalThis.window = origWin;
  });
});
