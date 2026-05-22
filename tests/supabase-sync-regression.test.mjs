import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, test } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const { syncQueueMixin } = await import(
  pathToFileURL(path.join(root, 'extension/supabase/sync-queue.js')).href
);
const { syncClipsMixin } = await import(
  pathToFileURL(path.join(root, 'extension/supabase/sync-clips.js')).href
);

function createQueueHarness(overrides = {}) {
  return {
    ...syncQueueMixin,
    syncQueue: [],
    isOnline: true,
    _isFullSyncRunning: false,
    _isProcessingSyncQueue: false,
    _activeSyncTypes: new Set(),
    savedQueues: [],
    updateSyncStatus(status) {
      this.syncStatus = status;
    },
    async saveSyncQueue() {
      this.savedQueues.push(structuredClone(this.syncQueue));
    },
    ...overrides,
  };
}

function installChromeStorage(data) {
  const priorChrome = globalThis.chrome;
  globalThis.chrome = {
    storage: {
      local: {
        get(keys, callback) {
          const requested = Array.isArray(keys) ? keys : [keys];
          const result = {};
          for (const key of requested) result[key] = data[key];
          callback(result);
        },
      },
    },
  };
  return () => {
    globalThis.chrome = priorChrome;
  };
}

describe('supabase sync queue regression coverage', () => {
  test('compacts mergeable queue operations by entity key and keeps newest version', () => {
    const service = createQueueHarness();
    const compacted = service._compactSyncQueue([
      {
        type: 'syncClips',
        timestamp: 10,
        data: [
          { id: 'clip-1', text: 'old', updatedAt: 100 },
          { id: 'clip-2', text: 'keep', updated_at: '2026-05-22T01:00:00.000Z' },
        ],
      },
      { type: 'syncSettings', timestamp: 11, data: { theme: 'dark' } },
      {
        type: 'syncClips',
        timestamp: 12,
        data: [
          { clip_id: 'clip-1', text: 'new', updatedAt: 200 },
          { id: 'clip-3', text: 'added', createdAt: 300 },
        ],
      },
    ]);

    assert.equal(compacted.length, 2);
    assert.equal(compacted[0].type, 'syncClips');
    assert.equal(compacted[0].timestamp, 12);
    assert.equal(compacted[1].type, 'syncSettings');

    const byId = new Map(compacted[0].data.map((item) => [String(item.id ?? item.clip_id), item]));
    assert.equal(byId.size, 3);
    assert.equal(byId.get('clip-1').text, 'new');
    assert.equal(byId.get('clip-2').text, 'keep');
    assert.equal(byId.get('clip-3').text, 'added');
  });

  test('queues same-type sync while an active sync is running', async () => {
    const service = createQueueHarness({
      _activeSyncTypes: new Set(['syncClips']),
    });
    let syncCalled = false;

    const result = await service.syncWithQueue('syncClips', [{ id: 'clip-1' }], async () => {
      syncCalled = true;
      return true;
    });

    assert.equal(result, false);
    assert.equal(syncCalled, false);
    assert.equal(service.syncQueue.length, 1);
    assert.equal(service.syncQueue[0].type, 'syncClips');
    assert.deepEqual(service.syncQueue[0].data, [{ id: 'clip-1' }]);
    assert.equal(service.savedQueues.length, 1);
  });
});

describe('supabase clip sync regression coverage', () => {
  test('normalizes clip upserts without resurrecting foreign-origin imported clips', () => {
    const dbClips = syncClipsMixin.buildDbClipsForUpsert(
      [
        { text: 'legacy object', timestamp: 1000 },
        { id: 'same-id', text: 'first copy', timestamp: 2000, updatedAt: 2000 },
        { id: 'same-id', text: 'second copy', timestamp: 3000, updatedAt: 3000 },
        { id: 'foreign', text: 'do not upload', origin_device_id: 'device-b', timestamp: 4000 },
        'loose string',
      ],
      'user-1',
      'device-a'
    );

    assert.equal(dbClips.length, 4);
    assert.equal(dbClips.some((clip) => clip.clip_id === 'foreign'), false);
    assert.equal(dbClips.some((clip) => clip.clip_id === 'same-id'), true);
    assert.equal(dbClips.some((clip) => clip.clip_id === 'same-id__dup2'), true);
    assert.equal(dbClips.every((clip) => clip.user_id === 'user-1'), true);
    assert.equal(dbClips.every((clip) => clip.device_id === 'device-a'), true);
    assert.equal(dbClips._pcStats.droppedImported, 1);
    assert.equal(dbClips._pcStats.inferredIds, 2);
  });

  test('mergeClips honors local tombstones and keeps newest content duplicate', async () => {
    const restoreChrome = installChromeStorage({
      pc_deleted_clips: [{ id: 'deleted-clip', deletedAt: 7000 }],
    });

    try {
      const merged = await syncClipsMixin.mergeClips(
        [
          { id: 'deleted-clip', text: 'removed', category: 'Work', timestamp: 1000, updatedAt: 1000 },
          { id: 'dup-local', text: 'same text', category: 'Work', timestamp: 3000, updatedAt: 3000 },
        ],
        [
          { id: 'deleted-clip', text: 'removed', category: 'Work', timestamp: 5000, updatedAt: 5000 },
          { id: 'dup-remote', text: 'same text', category: 'Work', timestamp: 4500, updatedAt: 4500 },
        ]
      );

      assert.equal(merged.some((clip) => clip.id === 'deleted-clip'), false);
      assert.equal(merged.some((clip) => clip.id === 'dup-local'), false);
      assert.equal(merged.some((clip) => clip.id === 'dup-remote'), true);
      assert.deepEqual(merged.map((clip) => clip.id), ['dup-remote']);
    } finally {
      restoreChrome();
    }
  });
});
