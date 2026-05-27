import assert from 'node:assert/strict';
import { mergeClipArrays } from '../extension/supabase/merge-clips-logic.js';

const baseTs = 1_700_000_000_000;

const local = [
  { id: 'clip-a', text: 'same text', category: 'Work', timestamp: baseTs },
  { id: 'clip-b', text: 'same text', category: 'Work', timestamp: baseTs + 100 },
];

const remote = [
  { id: 'clip-c', text: 'same text', category: 'Work', timestamp: baseTs + 200 },
];

const merged = mergeClipArrays(local, remote, new Map());

assert.equal(merged.length, 3, 'distinct clip ids must not collapse on identical text');
assert.ok(merged.some((c) => c.id === 'clip-a'));
assert.ok(merged.some((c) => c.id === 'clip-b'));
assert.ok(merged.some((c) => c.id === 'clip-c'));

const legacyLocal = [{ text: 'legacy dup', category: 'Notes', timestamp: baseTs }];
const legacyRemote = [{ text: 'legacy dup', category: 'Notes', timestamp: baseTs + 500 }];
const legacyMerged = mergeClipArrays(legacyLocal, legacyRemote, new Map());

assert.equal(legacyMerged.length, 1, 'id-less rows still dedupe by content key');

const tombstoned = mergeClipArrays(
  [{ id: 'gone', text: 'deleted', timestamp: baseTs, updatedAt: baseTs }],
  [{ id: 'gone', text: 'deleted remote', timestamp: baseTs + 1000, updatedAt: baseTs + 1000 }],
  new Map([['gone', baseTs + 2000]]),
);

assert.equal(tombstoned.length, 0, 'tombstoned clip ids must be removed');

console.log('merge-clips tests passed');
