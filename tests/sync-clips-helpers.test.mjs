import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildDbClipsForUpsert, filterDbClipsAgainstTombstones } from '../extension/supabase/sync/sync-clips.upsert.js';
import {
  rememberDeletedClipId,
  lookupDeletedClipAt,
  shouldPreferIncomingClip,
  isClipSupersededByTombstone,
  contentKeyForMerge,
  addClipToContentMerge
} from '../extension/supabase/sync/sync-clips.merge.js';
import { mapDbClipToLocal, mapDbClipToLocalPage } from '../extension/supabase/sync/sync-clips.map.js';

describe('buildDbClipsForUpsert', () => {
  it('maps clip fields and allocates __dupN for repeated base ids', () => {
    const rows = buildDbClipsForUpsert(
      [
        { id: 'a', text: 'hello', category: 'Work', timestamp: 100, updatedAt: 100 },
        { id: 'a', text: 'hello2', category: 'Work', timestamp: 200, updatedAt: 200 }
      ],
      'user-1',
      'device-1'
    );
    assert.equal(rows.length, 2);
    const byId = Object.fromEntries(rows.map((r) => [r.clip_id, r]));
    assert.equal(byId.a.text, 'hello');
    assert.equal(byId.a__dup2.text, 'hello2');
    assert.equal(byId.a.user_id, 'user-1');
    assert.equal(byId.a.device_id, 'device-1');
  });

  it('drops foreign origin_device_id imports', () => {
    const rows = buildDbClipsForUpsert(
      [{ id: 'x', text: 'n', origin_device_id: 'other', timestamp: 1 }],
      'user-1',
      'device-1'
    );
    assert.equal(rows.length, 0);
    assert.equal(rows._pcStats.droppedImported, 1);
  });

  it('filters tombstoned alive rows', () => {
    const dbClips = [
      { clip_id: 'dead', deleted_at: null },
      { clip_id: 'ok', deleted_at: null },
      { clip_id: 'local-tomb', deleted_at: '2026-01-01T00:00:00.000Z' }
    ];
    const tombstoned = new Set(['dead', 'local-tomb']);
    const safe = filterDbClipsAgainstTombstones(dbClips, tombstoned);
    assert.deepEqual(safe.map((c) => c.clip_id), ['ok', 'local-tomb']);
  });
});

describe('merge helpers', () => {
  it('remembers deleted ids by key and raw', () => {
    const map = new Map();
    rememberDeletedClipId(map, 'clip-1', 50);
    rememberDeletedClipId(map, 'clip-1', 40);
    assert.equal(lookupDeletedClipAt(map, 'clip-1'), 50);
  });

  it('prefers newer updatedAt then newer timestamp', () => {
    const older = { text: 'a', updatedAt: 10, timestamp: 10 };
    const newer = { text: 'a', updatedAt: 20, timestamp: 5 };
    assert.equal(shouldPreferIncomingClip(older, newer), true);
    const tieOlderTs = { text: 'a', updatedAt: 20, timestamp: 1 };
    const tieNewerTs = { text: 'a', updatedAt: 20, timestamp: 9 };
    assert.equal(shouldPreferIncomingClip(tieOlderTs, tieNewerTs), true);
  });

  it('skips clips superseded by tombstone', () => {
    const deletedById = new Map([['id-1', 100]]);
    const clip = { id: 'id-1', text: 'x', updatedAt: 50, timestamp: 50 };
    assert.equal(isClipSupersededByTombstone(clip, deletedById), true);
    const contentMerged = new Map();
    addClipToContentMerge(clip, deletedById, contentMerged);
    assert.equal(contentMerged.size, 0);
  });

  it('content keys collapse same text in 3s bucket', () => {
    const a = { text: 'same', category: 'c', timestamp: 1000 };
    const b = { text: 'same', category: 'c', timestamp: 2500 };
    assert.equal(contentKeyForMerge(a), contentKeyForMerge(b));
  });
});

describe('mapDbClip', () => {
  it('maps sync and page shapes', () => {
    const row = {
      clip_id: 'c1',
      text: 't',
      title: '',
      category: 'Uncategorized',
      timestamp: 10,
      updated_at: null,
      deleted_at: null,
      device_id: 'd1',
      meta: { x: 1 }
    };
    assert.deepEqual(mapDbClipToLocal(row), {
      id: 'c1',
      text: 't',
      title: '',
      category: 'Uncategorized',
      timestamp: 10,
      updatedAt: 10,
      deletedAt: null,
      deviceId: 'd1'
    });
    assert.deepEqual(mapDbClipToLocalPage(row), {
      id: 'c1',
      text: 't',
      title: '',
      category: 'Uncategorized',
      timestamp: 10,
      updatedAt: 10,
      deviceId: 'd1',
      meta: { x: 1 }
    });
  });
});
