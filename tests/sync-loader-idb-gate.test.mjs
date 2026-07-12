/**
 * Regression: full IDB wipe+rewrite on every popup open trips the 10s
 * offline-mode watchdog (seen with 400+ clips). Gate must stay present.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const LOADER = new URL('../extension/popup/features/sync/sync.loader.js', import.meta.url);

test('sync.loader tracks cameFromIdb and gates IDB backfill', () => {
  const source = readFileSync(LOADER, 'utf8');
  assert.match(source, /shouldBackfillIndexedDb/);
  assert.match(source, /scheduleIdbBackfill/);
  assert.match(source, /cameFromIdb\s*=\s*false/);
  assert.match(source, /cameFromIdb\s*=\s*true/);
  assert.doesNotMatch(
    source,
    /if\s*\(\s*app\._idbReady\s*&&\s*app\.idb\s*\)\s*\{\s*\n\s*await\s+app\.idb\.syncEntityFromLocalStorage\('clips'/,
    'must not unconditionally await full IDB clip rewrite on the init path',
  );
});

test('popup clears offline banner after successful init', () => {
  const source = readFileSync(new URL('../extension/popup.js', import.meta.url), 'utf8');
  assert.match(source, /_clearOfflineModeBanner/);
  assert.match(source, /Loaded in offline mode \\u2014 click to retry/);
});
