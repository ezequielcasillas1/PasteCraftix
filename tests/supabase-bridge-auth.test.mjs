/**
 * Auth bridge session flag used by isAuthenticated() for cloud lazy-load gates.
 * Run: node --test tests/supabase-bridge-auth.test.mjs
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

const storage = new Map();

globalThis.chrome = {
  storage: {
    local: {
      get(keys, cb) {
        const list = Array.isArray(keys) ? keys : [keys];
        const out = {};
        for (const k of list) {
          if (storage.has(k)) out[k] = storage.get(k);
        }
        if (typeof cb === 'function') cb(out);
        return Promise.resolve(out);
      },
      set(obj, cb) {
        for (const [k, v] of Object.entries(obj)) storage.set(k, v);
        if (typeof cb === 'function') cb();
        return Promise.resolve();
      },
      remove(keys, cb) {
        const list = Array.isArray(keys) ? keys : [keys];
        for (const k of list) storage.delete(k);
        if (typeof cb === 'function') cb();
        return Promise.resolve();
      },
    },
  },
};

const { authBridgeMixin } = await import('../extension/supabase/auth-bridge.js');
const { syncClipsMixin } = await import('../extension/supabase/sync-clips.js');

function makeClient() {
  const client = {
    client: { auth: {} },
    _sessionBridgeKey: 'pc_supabase_session_v1',
    _sessionBridgeActive: false,
    ...authBridgeMixin,
    ...syncClipsMixin,
  };
  return client;
}

test('isAuthenticated is false without bridge token', async () => {
  storage.clear();
  const pc = makeClient();
  await pc.refreshBridgeSessionState();
  assert.equal(pc.isAuthenticated(), false);
});

test('isAuthenticated is true when bridge stores access_token', async () => {
  storage.clear();
  const pc = makeClient();
  await chrome.storage.local.set({
    pc_supabase_session_v1: { access_token: 'test-jwt', user_id: 'user-1' },
  });
  await pc.refreshBridgeSessionState();
  assert.equal(pc.isAuthenticated(), true);
});

test('sign-out path clears bridge flag', async () => {
  storage.clear();
  const pc = makeClient();
  await chrome.storage.local.set({
    pc_supabase_session_v1: { access_token: 'test-jwt' },
  });
  await pc.refreshBridgeSessionState();
  assert.equal(pc.isAuthenticated(), true);

  pc._sessionBridgeActive = false;
  await chrome.storage.local.remove(['pc_supabase_session_v1']);
  await pc.refreshBridgeSessionState();
  assert.equal(pc.isAuthenticated(), false);
});
