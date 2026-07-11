import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('readIndexedDbPayloads opens pastecraft_local_v1 at schema version 3', () => {
  const source = readFileSync(
    new URL('../extension/background/shared.js', import.meta.url),
    'utf8',
  );
  assert.match(source, /IDB_READ_VERSION\s*=\s*3/);
  assert.match(source, /indexedDB\.open\('pastecraft_local_v1',\s*IDB_READ_VERSION\)/);
  assert.doesNotMatch(
    source,
    /indexedDB\.open\('pastecraft_local_v1',\s*1\)/,
    'must not open IDB at stale version 1',
  );
});

test('Quick View widget load path has storage fallback when background fails', () => {
  const source = readFileSync(
    new URL('../extension/content/widget/widget.quickview.js', import.meta.url),
    'utf8',
  );
  assert.match(source, /loadClipsFromLocalStorage/);
  assert.match(source, /storage-fallback-bg-fail/);
});
