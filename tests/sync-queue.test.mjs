/**
 * Sync queue durability: successful ops must be removed from storage incrementally.
 * Run: node --test tests/sync-queue.test.mjs
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { syncQueueMixin } from '../extension/supabase/sync-queue.js';

function createQueueHarness(executeImpl) {
  const saved = [];
  const client = {
    ...syncQueueMixin,
    syncQueue: [
      { type: 'syncSettings', data: { theme: 'dark' }, timestamp: 1, id: 'op-1' },
      { type: 'syncProfile', data: { userName: 'a' }, timestamp: 2, id: 'op-2' },
      { type: 'syncClips', data: [{ id: 'c' }], timestamp: 3, id: 'op-3' },
    ],
    isOnline: true,
    _pauseSync: false,
    _isFullSyncRunning: false,
    _isProcessingSyncQueue: false,
    _activeSyncTypes: new Set(),
    syncStatus: 'synced',
    async saveSyncQueue() {
      saved.push(JSON.parse(JSON.stringify(this.syncQueue)));
    },
    updateSyncStatus() {},
    async executeSyncOperation(operation) {
      return executeImpl(operation);
    },
  };
  return { client, saved };
}

test('processSyncQueue persists remaining ops after each success', async () => {
  const processed = [];
  const { client, saved } = createQueueHarness(async (op) => {
    processed.push(op.id);
  });

  await client.processSyncQueue();

  assert.deepEqual(processed, ['op-1', 'op-2', 'op-3']);
  assert.equal(client.syncQueue.length, 0);
  assert.ok(saved.length >= 3, 'expected save after each successful dequeue');
  assert.deepEqual(saved[saved.length - 1], []);
});

test('processSyncQueue keeps failed ops and continues with the rest', async () => {
  const { client, saved } = createQueueHarness(async (op) => {
    if (op.id === 'op-2') throw new Error('network');
  });

  await client.processSyncQueue();

  assert.equal(client.syncQueue.length, 1);
  assert.equal(client.syncQueue[0].id, 'op-2');
  assert.ok(saved.length >= 2);
  const lastSave = saved[saved.length - 1];
  assert.equal(lastSave.length, 1);
  assert.equal(lastSave[0].id, 'op-2');
});
