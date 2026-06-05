import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  maxIdbRecordUpdatedAtMs,
  shouldPreferChromeStorageOverIdb,
} from '../extension/popup/features/sync/sync.loader.js';

test('maxIdbRecordUpdatedAtMs returns newest updated_at', () => {
  const max = maxIdbRecordUpdatedAtMs([
    { updated_at: '2026-06-01T10:00:00.000Z' },
    { updated_at: '2026-06-02T12:00:00.000Z' },
  ]);
  assert.equal(max, Date.parse('2026-06-02T12:00:00.000Z'));
});

test('restore prefers chrome when pc_local_updatedAt is newer than IDB', () => {
  const idbRecords = [
    { updated_at: '2026-06-01T10:00:00.000Z', payload: { id: 'old' } },
    { updated_at: '2026-06-01T11:00:00.000Z', payload: { id: 'old2' } },
  ];
  const restoreAt = Date.parse('2026-06-05T17:00:00.000Z');
  assert.equal(
    shouldPreferChromeStorageOverIdb(restoreAt, idbRecords, 1),
    true,
  );
});

test('stale chrome with fewer rows falls back to IDB', () => {
  const idbRecords = [
    { updated_at: '2026-06-05T16:00:00.000Z', payload: { id: 'clip-1' } },
    { updated_at: '2026-06-05T16:00:00.000Z', payload: { id: 'clip-2' } },
  ];
  const staleChromeTs = Date.parse('2026-06-05T10:00:00.000Z');
  assert.equal(
    shouldPreferChromeStorageOverIdb(staleChromeTs, idbRecords, 1),
    false,
  );
});

test('delete-all prefers empty chrome when write is newer than IDB', () => {
  const idbRecords = [
    { updated_at: '2026-06-05T10:00:00.000Z', payload: { id: 'clip-1' } },
  ];
  const deleteAt = Date.parse('2026-06-05T17:00:00.000Z');
  assert.equal(
    shouldPreferChromeStorageOverIdb(deleteAt, idbRecords, 0),
    true,
  );
});
