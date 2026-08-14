import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const LIGHT_ZEBRA = /#f8fafc|#ffffff|#fafbfc|#f1f5f9/i;

test('blue theme overrides AI Summary and History table zebra stripes', () => {
  const css = read('extension/assets/styles/theme-blue-phase2.css');

  assert.ok(
    css.includes('[data-theme="blue"] .summary-result-content tr:nth-child(even) td'),
    'Summary even-row cells must have a blue-theme override (not only #breakdownModal)',
  );
  assert.ok(
    css.includes('[data-theme="blue"] .breakdown-result tr:nth-child(even) td'),
    'History/breakdown even-row cells must have a blue-theme override',
  );

  const evenBlockStart = css.indexOf(
    '[data-theme="blue"] .summary-result-content tr:nth-child(even) td',
  );
  assert.ok(evenBlockStart >= 0);
  const evenBlock = css.slice(evenBlockStart, evenBlockStart + 700);
  const brace = evenBlock.indexOf('{');
  const end = evenBlock.indexOf('}', brace);
  const decls = evenBlock.slice(brace, end + 1);
  assert.equal(LIGHT_ZEBRA.test(decls), false, `light zebra leaked into dark even-row rule: ${decls}`);
  assert.match(decls, /rgba\(30,\s*58,\s*138/);
});

test('popup AI tables use theme surface tokens instead of hardcoded light zebra', () => {
  const html = read('extension/popup.html');
  const idx = html.indexOf('summary-result-content tr:nth-child(even) td');
  assert.ok(idx >= 0);
  const snippet = html.slice(idx, idx + 220);
  assert.match(snippet, /var\(--pc-surface/);
});

test('mermaid strategy follows blue dark theme', () => {
  const src = read('extension/shared/markup/strategies/mermaid.strategy.js');
  assert.match(src, /function mermaidTheme\(/);
  assert.match(src, /getAttribute\('data-theme'\) === 'blue'/);
  assert.match(src, /return 'dark'/);
  assert.match(src, /applyMermaidTheme\(\)/);
});
