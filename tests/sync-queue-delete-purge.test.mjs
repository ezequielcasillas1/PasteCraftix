import assert from 'node:assert/strict';
import test from 'node:test';

import { syncQueueMixin } from '../extension/supabase/sync-queue.js';

test('sync queue purges deleted clip ids from pending syncClips operations', () => {
  const queueApi = {
    syncQueue: [{
      type: 'syncClips',
      data: [
        { id: 'clip-a', text: 'A', updatedAt: 10 },
        { id: 'clip-b', text: 'B', updatedAt: 20 },
      ],
      timestamp: 1,
      id: 'op-1',
    }],
    _getQueueEntityKey: syncQueueMixin._getQueueEntityKey,
    _purgeDeletedIdsFromAliveQueue: syncQueueMixin._purgeDeletedIdsFromAliveQueue,
    _purgeDeletedIdsFromQueue: syncQueueMixin._purgeDeletedIdsFromQueue,
    _compactSyncQueue: syncQueueMixin._compactSyncQueue,
    _mergeQueueOperationData: syncQueueMixin._mergeQueueOperationData,
    _isMergeableQueueType: syncQueueMixin._isMergeableQueueType,
  };

  const purged = queueApi._purgeDeletedIdsFromQueue(queueApi.syncQueue, {
    type: 'syncDeletedClips',
    data: [{ id: 'clip-a', deletedAt: 99 }],
  });

  assert.equal(purged.length, 1);
  assert.equal(purged[0].data.length, 1);
  assert.equal(purged[0].data[0].id, 'clip-b');
});

test('sync queue compaction no longer resurrects deleted clips', () => {
  const queueApi = {
    _getQueueEntityKey: syncQueueMixin._getQueueEntityKey,
    _purgeDeletedIdsFromAliveQueue: syncQueueMixin._purgeDeletedIdsFromAliveQueue,
    _purgeDeletedIdsFromQueue: syncQueueMixin._purgeDeletedIdsFromQueue,
    _compactSyncQueue: syncQueueMixin._compactSyncQueue,
    _mergeQueueOperationData: syncQueueMixin._mergeQueueOperationData,
    _isMergeableQueueType: syncQueueMixin._isMergeableQueueType,
  };

  const existing = [{
    type: 'syncClips',
    data: [{ id: 'clip-a', text: 'A', updatedAt: 10 }],
    timestamp: 1,
    id: 'op-1',
  }];

  const purged = queueApi._purgeDeletedIdsFromQueue(existing, {
    type: 'syncDeletedClips',
    data: [{ id: 'clip-a', deletedAt: 99 }],
  });

  const compacted = queueApi._compactSyncQueue([
    ...purged,
    {
      type: 'syncClips',
      data: [{ id: 'clip-b', text: 'B', updatedAt: 20 }],
      timestamp: 2,
      id: 'op-2',
    },
  ]);

  assert.equal(compacted.length, 1);
  assert.deepEqual(
    compacted[0].data.map((clip) => clip.id),
    ['clip-b'],
  );
});
