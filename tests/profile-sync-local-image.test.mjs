/**
 * Run: node --test tests/profile-sync-local-image.test.mjs
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { profileSyncMixin } from '../extension/supabase/profile-sync.js';

function createProfileClient({ row = null, fetchError = null } = {}) {
  const captured = {
    table: null,
    upsertProfile: null,
    upsertOptions: null,
    filters: [],
  };

  return {
    captured,
    client: {
      from(table) {
        captured.table = table;
        return {
          upsert(profile, options) {
            captured.upsertProfile = profile;
            captured.upsertOptions = options;
            return {
              async select() {
                return { data: [profile], error: null };
              },
            };
          },
          select(columns) {
            captured.selectColumns = columns;
            return {
              eq(column, value) {
                captured.filters.push({ column, value });
                return {
                  async single() {
                    return { data: row, error: fetchError };
                  },
                };
              },
            };
          },
        };
      },
    },
  };
}

function createSyncContext(client) {
  const beacons = [];
  const userContexts = [];
  return {
    client,
    beacons,
    userContexts,
    async getSyncUserId() {
      return 'user-123';
    },
    async setUserContext(userId) {
      userContexts.push(userId);
    },
    pcBeacon(event, meta = {}) {
      beacons.push({ event, meta });
    },
  };
}

test('syncUserProfileToSupabase strips local-only image fields before upsert', async () => {
  const { client, captured } = createProfileClient();
  const ctx = createSyncContext(client);

  const ok = await profileSyncMixin.syncUserProfileToSupabase.call(ctx, {
    userName: 'Ezequiel',
    aiGeneratedName: 'Paste Pro',
    profileImageUrl: 'blob:http://local-only',
    profileImageBase64: 'data:image/png;base64,abc',
    generatedImageUrl: 'https://cdn.example/image.png',
    aiGeneratedImage: true,
  });

  assert.equal(ok, true);
  assert.equal(captured.table, 'user_profiles');
  assert.deepEqual(captured.upsertOptions, {
    onConflict: 'user_id',
    ignoreDuplicates: false,
  });
  assert.deepEqual(captured.upsertProfile, {
    user_id: 'user-123',
    user_name: 'Ezequiel',
    ai_generated_name: 'Paste Pro',
    profile_image_url: null,
    profile_image_base64: null,
    generated_image_url: null,
    ai_generated_image: false,
  });
  assert.deepEqual(ctx.userContexts, ['user-123']);
  assert.deepEqual(ctx.beacons, [
    { event: 'profile_update', meta: { fields: 'name,ai_name' } },
  ]);
});

test('syncUserProfileFromSupabase keeps profile image fields local-only', async () => {
  const { client, captured } = createProfileClient({
    row: {
      user_name: 'Ezequiel',
      ai_generated_name: 'Paste Pro',
      profile_image_url: 'https://db.example/image.png',
      profile_image_base64: 'data:image/png;base64,db',
      generated_image_url: 'https://db.example/generated.png',
      ai_generated_image: true,
    },
  });
  const ctx = createSyncContext(client);

  const profile = await profileSyncMixin.syncUserProfileFromSupabase.call(ctx);

  assert.deepEqual(captured.filters, [{ column: 'user_id', value: 'user-123' }]);
  assert.deepEqual(profile, {
    userName: 'Ezequiel',
    aiGeneratedName: 'Paste Pro',
    profileImageUrl: null,
    profileImageBase64: null,
    generatedImageUrl: null,
    aiGeneratedImage: false,
  });
  assert.deepEqual(ctx.beacons, [{ event: 'profile_view', meta: {} }]);
});
