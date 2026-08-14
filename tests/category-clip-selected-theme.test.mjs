import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function ruleBlock(css, selector) {
  const idx = css.indexOf(selector);
  assert.ok(idx >= 0, `missing selector: ${selector}`);
  const slice = css.slice(idx, idx + 900);
  const brace = slice.indexOf('{');
  const end = slice.indexOf('}', brace);
  return slice.slice(brace, end + 1);
}

test('blue theme category clip selected uses dark-navy premium fill', () => {
  const css = read('extension/assets/styles/theme-blue-phase2.css');
  const selectedHover = '[data-theme="blue"] .category-clip.selected:hover';

  assert.ok(
    css.includes('[data-theme="blue"] .category-clip.selected,'),
    'blue theme must override .category-clip.selected (popup.html electric fill otherwise wins)',
  );
  assert.ok(
    css.includes(selectedHover),
    'selected:hover must beat [data-theme="blue"] .category-clip:hover while the pointer is down',
  );

  const selected = ruleBlock(css, selectedHover);
  assert.match(selected, /rgba\(30,\s*58,\s*138/);
  assert.equal(
    /#3b82f6|#eff6ff|#1d4ed8/.test(selected),
    false,
    `electric/light selected fill leaked: ${selected}`,
  );
});

test('category clip rows disable native text selection', () => {
  const css = read('extension/assets/styles/theme-blue-phase2.css');
  const html = read('extension/popup.html');
  const blueRow = ruleBlock(css, '[data-theme="blue"] .category-clip {');
  assert.match(blueRow, /user-select:\s*none/);
  assert.match(html, /\.category-clip\s*\{[^}]*user-select:\s*none/s);
});
