/**
 * Activity service auth regression tests.
 * Run: node --test tests/activity-service.test.mjs
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const activityServiceUrl = pathToFileURL(
  path.join(__dirname, '../extension/popup/features/activity/activity.service.js')
).href;
const activityRenderUrl = pathToFileURL(
  path.join(__dirname, '../extension/popup/features/activity/activity.render.js')
).href;

const { fetchActivityPage, loadActivityLog } = await import(activityServiceUrl);
const { renderActivityList } = await import(activityRenderUrl);

function createDocumentHarness() {
  const elements = new Map([
    ['activityDateFrom', { value: '' }],
    ['activityDateTo', { value: '' }],
    ['activityList', { innerHTML: '' }],
    ['loadMoreActivityBtn', { style: { display: '' } }],
  ]);

  return {
    getElementById(id) {
      return elements.get(id) || null;
    },
    _elements: elements,
  };
}

function createThenableQuery(rows, error = null) {
  const calls = [];
  const query = {
    select(value) {
      calls.push(['select', value]);
      return query;
    },
    order(column, options) {
      calls.push(['order', column, options]);
      return query;
    },
    range(from, to) {
      calls.push(['range', from, to]);
      return query;
    },
    eq(column, value) {
      calls.push(['eq', column, value]);
      return query;
    },
    gte(column, value) {
      calls.push(['gte', column, value]);
      return query;
    },
    lte(column, value) {
      calls.push(['lte', column, value]);
      return query;
    },
    then(resolve, reject) {
      return Promise.resolve({ data: rows, error }).then(resolve, reject);
    },
  };

  return { query, calls };
}

function createSupabaseMock(rows = []) {
  const fromCalls = [];
  const { query, calls } = createThenableQuery(rows);

  return {
    fromCalls,
    queryCalls: calls,
    client: {
      auth: {
        getSession: async () => ({ data: { session: null } }),
      },
      from(table) {
        fromCalls.push(table);
        return query;
      },
    },
  };
}

function createApp(overrides = {}) {
  return {
    activityEntries: [],
    activityOffset: 0,
    activityFilter: 'all',
    activityHasMore: true,
    activityStatus: { type: 'empty' },
    restoreSupabaseSessionFromBridge: async () => true,
    ...overrides,
  };
}

describe('activity service auth guard', () => {
  test('restores bridge session before querying change_audit_log', async () => {
    const priorDocument = globalThis.document;
    const priorPasteCraftSupabase = globalThis.pasteCraftSupabase;
    const documentHarness = createDocumentHarness();
    const row = {
      id: 'audit-1',
      occurred_at: new Date().toISOString(),
      table_name: 'clips',
      operation: 'UPDATE',
      row_new: { text: 'Synced clip' },
      row_old: null,
    };
    const supabase = createSupabaseMock([row]);
    let restoreReason = '';

    globalThis.document = documentHarness;
    globalThis.pasteCraftSupabase = {
      client: supabase.client,
      getCurrentUser: async () => ({ id: 'user-1', email: 'user@example.com' }),
    };

    try {
      const app = createApp({
        restoreSupabaseSessionFromBridge: async (reason) => {
          restoreReason = reason;
          return true;
        },
      });

      const ok = await loadActivityLog(app);

      assert.equal(ok, true);
      assert.equal(restoreReason, 'activity-log');
      assert.deepEqual(supabase.fromCalls, ['change_audit_log']);
      assert.equal(app.activityEntries.length, 1);
      assert.equal(app.activityStatus.type, 'ready');
    } finally {
      globalThis.document = priorDocument;
      globalThis.pasteCraftSupabase = priorPasteCraftSupabase;
    }
  });

  test('blocks query when bridge user exists but client session is missing', async () => {
    const priorDocument = globalThis.document;
    const priorPasteCraftSupabase = globalThis.pasteCraftSupabase;
    const supabase = createSupabaseMock([]);

    globalThis.document = createDocumentHarness();
    globalThis.pasteCraftSupabase = {
      client: supabase.client,
      getCurrentUser: async () => ({ id: 'user-1', email: 'user@example.com' }),
    };

    try {
      const app = createApp({
        restoreSupabaseSessionFromBridge: async () => false,
      });

      const ok = await fetchActivityPage(app);

      assert.equal(ok, false);
      assert.deepEqual(supabase.fromCalls, []);
      assert.equal(app.activityStatus.type, 'session_unavailable');
      assert.equal(app.activityEntries.length, 0);
    } finally {
      globalThis.document = priorDocument;
      globalThis.pasteCraftSupabase = priorPasteCraftSupabase;
    }
  });

  test('renders session problem instead of no-activity copy', () => {
    const priorDocument = globalThis.document;
    const documentHarness = createDocumentHarness();

    globalThis.document = documentHarness;

    try {
      renderActivityList(createApp({
        activityStatus: { type: 'session_unavailable' },
      }));

      const html = documentHarness._elements.get('activityList').innerHTML;
      assert.match(html, /Cloud session needs refresh/);
      assert.doesNotMatch(html, /No cloud activity yet/);
    } finally {
      globalThis.document = priorDocument;
    }
  });
});
