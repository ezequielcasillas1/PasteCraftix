import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const widgetPath = path.join(root, 'extension/content/widget/widget.js');

function widgetSource() {
  return fs.readFileSync(widgetPath, 'utf8');
}

describe('Quick View messaging security', () => {
  test('widget quick view no longer uses wildcard postMessage targets', () => {
    const src = widgetSource();
    const wildcardTargets = [...src.matchAll(/postMessage\s*\([^)]*['"]\*['"]/gs)];

    assert.deepEqual(
      wildcardTargets.map((match) => match[0]),
      [],
      'Quick View messages must target a concrete origin',
    );
  });

  test('quick view parent and iframe messages use the page origin', () => {
    const src = widgetSource();
    const loadQuickViewStart = src.indexOf('loadQuickViewContent(iframe)');
    assert.ok(loadQuickViewStart >= 0, 'loadQuickViewContent not found');

    const quickViewBlock = src.slice(loadQuickViewStart, src.indexOf('addQuickViewStyles()', loadQuickViewStart));

    assert.match(quickViewBlock, /const quickViewTargetOrigin = window\.location\.origin;/);
    assert.match(
      quickViewBlock,
      /window\.parent\.postMessage\(\{ type: 'quickview-get-clips' \}, window\.location\.origin\)/,
    );
    assert.match(
      quickViewBlock,
      /iframe\.contentWindow\.postMessage\(\{ type: 'quickview-clips-data', clips \}, quickViewTargetOrigin\)/,
    );
  });

  test('quick view delete messages keep stable clip identity fields', () => {
    const src = widgetSource();

    assert.match(src, /const clipId = \(clip && clip\.id != null\) \? String\(clip\.id\) : String\(index\);/);
    assert.match(src, /const clipIdArg = JSON\.stringify\(clipId\);/);
    assert.match(src, /clipId: String\(clipId\), index: index, archived: !!archived/);
  });
});
