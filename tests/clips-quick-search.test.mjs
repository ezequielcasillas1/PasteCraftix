import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const html = fs.readFileSync(new URL('../extension/popup.html', import.meta.url), 'utf8');
const events = fs.readFileSync(new URL('../extension/popup/features/clips/clips.events.js', import.meta.url), 'utf8');
const quick = fs.readFileSync(new URL('../extension/popup/features/clips/clips.quick-search.js', import.meta.url), 'utf8');

test('quick clip search sits right under the One-click copy bar', () => {
  const bar = html.indexOf('id="activityOneClickCopyToggle"');
  const box = html.indexOf('id="clipsQuickSearchInput"');
  const chips = html.indexOf('id="chipContainer"');
  assert.ok(bar > 0 && box > bar && chips > box);
});

test('quick search reuses the existing Search tab instead of a second search', () => {
  assert.match(events, /registerClipsQuickSearch\(app\)/);
  assert.match(quick, /getElementById\('searchInput'\)/);
  assert.match(quick, /activatePopupTab\(app, 'search'/);
  assert.match(quick, /renderSearchResults/);
});
