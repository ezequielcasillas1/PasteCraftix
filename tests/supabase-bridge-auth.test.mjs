/**
 * Auth session cache used by isAuthenticated() / sync gates.
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

const { authBridgeMixin } = await import('../extension/supabase/auth/auth-bridge.js');
const { authMixin } = await import('../extension/supabase/auth/auth.js');

function makeClient(session = null) {
  return {
    client: {
      auth: {
        getSession: async () => ({ data: { session } }),
        setSession: async () => ({ data: { session }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
    },
    _sessionBridgeKey: 'pc_supabase_session_v1',
    _currentSession: null,
    ...authBridgeMixin,
    isAuthenticated: authMixin.isAuthenticated,
  };
}

test('isAuthenticated is false without _currentSession', () => {
  const pc = makeClient();
  assert.equal(pc.isAuthenticated(), false);
});

test('hydrate from bridge assigns _currentSession and unlocks isAuthenticated', async () => {
  storage.clear();
  await chrome.storage.local.set({
    pc_supabase_session_v1: {
      access_token: 'test-jwt',
      refresh_token: 'test-rt',
      user_id: 'user-1',
      email: 'a@b.c',
    },
  });
  const pc = makeClient(null);
  const ok = await pc.hydrateClientSessionFromBridge();
  assert.equal(ok, true);
  assert.equal(pc.isAuthenticated(), true);
  assert.equal(pc._currentSession?.access_token, 'test-jwt');
});

test('onAuthStateChange SIGNED_OUT clears _currentSession', async () => {
  storage.clear();
  let listener = null;
  const pc = makeClient({ access_token: 'jwt', user: { id: 'u1' } });
  pc.client.auth.onAuthStateChange = (fn) => {
    listener = fn;
    return { data: { subscription: { unsubscribe() {} } } };
  };
  pc.setupAuthSessionBridge();
  listener('SIGNED_IN', { access_token: 'jwt', user: { id: 'u1' } });
  assert.equal(pc.isAuthenticated(), true);
  listener('SIGNED_OUT', null);
  assert.equal(pc.isAuthenticated(), false);
});

test('hydrate soft-keeps bridge tokens when setSession fails with Failed to fetch', async () => {
  storage.clear();
  await chrome.storage.local.set({
    pc_supabase_session_v1: {
      access_token: 'bridge-jwt',
      refresh_token: 'bridge-rt',
      user_id: 'user-soft',
      email: 'soft@test.com',
    },
  });
  const pc = makeClient(null);
  pc.client.auth.setSession = async () => ({
    data: { session: null, user: null },
    error: Object.assign(new Error('Failed to fetch'), { name: 'AuthRetryableFetchError' }),
  });
  const ok = await pc.hydrateClientSessionFromBridge();
  assert.equal(ok, true);
  assert.equal(pc.isAuthenticated(), true);
  assert.equal(pc._currentSession?.access_token, 'bridge-jwt');
  assert.equal(pc._currentSession?.user?.id, 'user-soft');
});

test('hydrate soft-keeps bridge tokens when setSession throws Failed to fetch', async () => {
  storage.clear();
  await chrome.storage.local.set({
    pc_supabase_session_v1: {
      access_token: 'throw-jwt',
      refresh_token: 'throw-rt',
      user_id: 'user-throw',
    },
  });
  const pc = makeClient(null);
  pc.client.auth.setSession = async () => {
    throw new TypeError('Failed to fetch');
  };
  const ok = await pc.hydrateClientSessionFromBridge();
  assert.equal(ok, true);
  assert.equal(pc.isAuthenticated(), true);
  assert.equal(pc._currentSession?.access_token, 'throw-jwt');
});

test('hydrate does not soft-keep on non-network setSession errors', async () => {
  storage.clear();
  await chrome.storage.local.set({
    pc_supabase_session_v1: {
      access_token: 'bad-jwt',
      refresh_token: 'bad-rt',
      user_id: 'user-bad',
    },
  });
  const pc = makeClient(null);
  pc.client.auth.setSession = async () => ({
    data: { session: null, user: null },
    error: new Error('Invalid Refresh Token: Already Used'),
  });
  const ok = await pc.hydrateClientSessionFromBridge();
  assert.equal(ok, false);
  assert.equal(pc.isAuthenticated(), false);
});
