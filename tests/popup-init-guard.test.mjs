import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const GUARD = new URL('../extension/popup/features/app/popup.init-guard.js', import.meta.url);

test('init-guard recovers lucide and clips after a thrown init', async () => {
  const painted = [];
  const rendered = [];
  globalThis.window = {
    __pcPopupLucideBooting: true,
    finishBootLucideIcons: (ctx) => painted.push(ctx || 'finish'),
    paintBootShellIcons: () => painted.push('shell'),
  };
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'pcOfflineModeBanner') return null;
      if (id === 'topBar') return { style: { display: 'none' } };
      return null;
    },
    createElement: () => ({
      style: { cssText: '' },
      addEventListener() {},
    }),
    body: { appendChild() {} },
    documentElement: { appendChild() {} },
  };

  const { recoverPopupAfterInitFailure, recoverPopupAfterInitHang } = await import(GUARD.href);
  const app = {
    _coreHydrationState: 'loading',
    clips: [],
    renderChips() { rendered.push('chips'); },
    hideLoadingOverlay() { rendered.push('overlay'); },
  };

  recoverPopupAfterInitFailure(app);
  assert.equal(app._coreHydrationState, 'failed');
  assert.equal(window.__pcPopupLucideBooting, false);
  assert.ok(painted.includes('init-failed'));
  assert.deepEqual(rendered, ['chips']);

  recoverPopupAfterInitHang({ hideLoadingOverlay() { rendered.push('hang-overlay'); } });
  assert.ok(rendered.includes('hang-overlay'));
});

test('popup boot import failure does not leave Lucide gated', () => {
  const source = readFileSync(new URL('../extension/popup.js', import.meta.url), 'utf8');
  assert.match(source, /Popup boot import failed/);
  assert.match(source, /paintBootShellIcons/);
});

test('popup.init paints header icons before auth hydration', () => {
  const source = readFileSync(
    new URL('../extension/popup/features/app/popup.init.js', import.meta.url),
    'utf8',
  );
  assert.match(source, /paintBootShellIcons/);
});
