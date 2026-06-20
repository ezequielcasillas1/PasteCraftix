/**
 * Profile upsert must not send null names (image-only saves wipe cloud display names).
 * Run: node --test tests/profile-sync-payload.test.mjs
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildProfileUpsertPayload } from '../extension/shared/profile-sync-payload.js';

test('image-only local profile omits name fields', () => {
  const payload = buildProfileUpsertPayload({
    profileImageBase64: 'data:image/png;base64,abc',
    profileImageUrl: 'data:image/png;base64,abc',
  });
  assert.equal('user_name' in payload, false);
  assert.equal('ai_generated_name' in payload, false);
  assert.ok(payload.updated_at);
});

test('non-empty names are included', () => {
  const payload = buildProfileUpsertPayload({
    userName: ' Eze ',
    aiGeneratedName: 'Swift Fox',
  });
  assert.equal(payload.user_name, 'Eze');
  assert.equal(payload.ai_generated_name, 'Swift Fox');
});

test('whitespace-only names are omitted', () => {
  const payload = buildProfileUpsertPayload({ userName: '   ', aiGeneratedName: '' });
  assert.equal('user_name' in payload, false);
  assert.equal('ai_generated_name' in payload, false);
});
