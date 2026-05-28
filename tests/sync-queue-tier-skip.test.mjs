/**
 * Regression: free-tier cloud sync skip must not re-queue forever.
 * Run: node --test tests/sync-queue-tier-skip.test.mjs
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { CLOUD_SYNC_QUEUE_TYPES } from '../extension/supabase/sync-queue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

test('cloud sync queue types include clip and archived ops', () => {
  assert.ok(CLOUD_SYNC_QUEUE_TYPES.has('syncClips'));
  assert.ok(CLOUD_SYNC_QUEUE_TYPES.has('syncArchivedClips'));
});

test('syncClipsToSupabase returns true when free tier has no cloud access', () => {
  const src = readFileSync(
    path.join(root, 'extension/supabase/sync-clips.js'),
    'utf8',
  );
  const block = src.slice(src.indexOf('if (!hasAccess)'), src.indexOf('await this.setUserContext(userId)'));
  assert.match(block, /return true/);
  assert.doesNotMatch(block, /return false.*free tier/i);
});

test('syncArchivedClipsToSupabase returns true when free tier has no cloud access', () => {
  const src = readFileSync(
    path.join(root, 'extension/supabase/sync-archived.js'),
    'utf8',
  );
  assert.match(src, /hasCloudSyncAccess/);
  assert.match(src, /Archived clips stay local only/);
  assert.match(src, /return true/);
});
