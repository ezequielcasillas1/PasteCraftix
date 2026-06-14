import assert from 'node:assert/strict';
import test from 'node:test';

import { syncQueueMixin } from '../extension/supabase/sync-queue.js';

const mixin = {
  ...syncQueueMixin,
  _getQueueEntityKey: syncQueueMixin._getQueueEntityKey,
  _getQueueEntityVersion: syncQueueMixin._getQueueEntityVersion,
  _mergeQueueOperationData: syncQueueMixin._mergeQueueOperationData,
  _collectQueuedDeleteIds: syncQueueMixin._collectQueuedDeleteIds,
  _sanitizeQueueAgainstDeletes: syncQueueMixin._sanitizeQueueAgainstDeletes,
  _orderQueueDeleteOpsFirst: syncQueueMixin._orderQueueDeleteOpsFirst,
  _compactSyncQueue: syncQueueMixin._compactSyncQueue,
};

test('compact queue strips deleted clip ids from pending syncClips upserts', () => {
  const queue = [
    { type: 'syncClips', data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] },
    { type: 'syncDeletedClips', data: [{ id: 'b', deletedAt: 2000 }] },
    { type: 'syncClips', data: [{ id: 'a' }, { id: 'c' }] },
  ];

  const compacted = mixin._compactSyncQueue(queue);
  const syncClipsOp = compacted.find((op) => op.type === 'syncClips');

  assert.ok(syncClipsOp, 'syncClips operation should remain compacted');
  assert.deepEqual(
    syncClipsOp.data.map((clip) => clip.id),
    ['a', 'c'],
    'deleted clip b must not remain in syncClips payload',
  );
});

test('delete tombstone ops are ordered before upsert ops', () => {
  const queue = [
    { type: 'syncClips', data: [{ id: 'a' }] },
    { type: 'syncDeletedClips', data: [{ id: 'b', deletedAt: 1000 }] },
    { type: 'syncNotes', data: [{ id: 'note-1' }] },
    { type: 'syncDeletedNotes', data: [{ id: 'note-2', deletedAt: 1000 }] },
  ];

  const ordered = mixin._orderQueueDeleteOpsFirst(queue);
  const firstDeleteIndex = ordered.findIndex((op) => String(op.type).startsWith('syncDeleted'));
  const firstUpsertIndex = ordered.findIndex((op) => !String(op.type).startsWith('syncDeleted'));

  assert.ok(firstDeleteIndex >= 0);
  assert.ok(firstUpsertIndex >= 0);
  assert.ok(firstDeleteIndex < firstUpsertIndex);
});
