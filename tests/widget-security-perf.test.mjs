import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const widgetPath = path.join(root, 'extension/content/widget/widget.js');
const widgetSource = fs.readFileSync(widgetPath, 'utf8');

function getMethodSource(methodName) {
  const methodPattern = new RegExp(`\\n  (?:async\\s+)?${methodName}\\(`);
  const match = widgetSource.match(methodPattern);
  const markerIndex = match ? match.index : -1;
  assert.notEqual(markerIndex, -1, `method not found: ${methodName}`);

  const openBraceIndex = widgetSource.indexOf('{', markerIndex);
  assert.notEqual(openBraceIndex, -1, `method body not found: ${methodName}`);

  let depth = 0;
  for (let i = openBraceIndex; i < widgetSource.length; i += 1) {
    const char = widgetSource[i];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return widgetSource.slice(markerIndex, i + 1);
  }

  assert.fail(`method body did not close: ${methodName}`);
}

describe('floating widget security and startup performance guards', () => {
  test('does not warm popup iframe during constructor or async init', () => {
    const constructorSource = getMethodSource('constructor');
    const initAsyncSource = getMethodSource('initAsync');

    assert.doesNotMatch(constructorSource, /this\.warmPopupIframe\s*\(/);
    assert.doesNotMatch(initAsyncSource, /this\.warmPopupIframe\s*\(/);
    assert.match(constructorSource, /this\._installLazyPopupWarmer\s*\(/);
  });

  test('warms popup iframe only from one-shot user interaction listeners', () => {
    const warmerSource = getMethodSource('_installLazyPopupWarmer');

    assert.match(warmerSource, /addEventListener\(\s*['"]pointerenter['"][\s\S]*?\{\s*once:\s*true\s*\}/);
    assert.match(warmerSource, /addEventListener\(\s*['"]focusin['"][\s\S]*?\{\s*once:\s*true\s*\}/);
    assert.match(warmerSource, /this\.warmPopupIframe\s*\(/);
  });

  test('does not use wildcard postMessage target origins', () => {
    assert.doesNotMatch(
      widgetSource,
      /postMessage\s*\([\s\S]*?,\s*['"]\*['"]\s*\)/,
      'postMessage must target a concrete origin'
    );
    assert.doesNotMatch(widgetSource, /targetOrigin\s*=\s*['"]\*['"]/);
    assert.match(widgetSource, /window\.location\.origin/);
    assert.match(widgetSource, /quickViewTargetOrigin/);
  });
});
