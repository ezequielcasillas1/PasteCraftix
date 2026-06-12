import assert from 'node:assert/strict';
import { test } from 'node:test';

import { aiHistorySyncMixin } from '../extension/supabase/ai-history-sync.js';

function withGlobal(name, value, run) {
  const hadOwn = Object.prototype.hasOwnProperty.call(globalThis, name);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);

  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });

  return Promise.resolve()
    .then(run)
    .finally(() => {
      if (hadOwn) {
        Object.defineProperty(globalThis, name, descriptor);
      } else {
        delete globalThis[name];
      }
    });
}

test('syncAiHistoryToSupabase stores source text in first thread fallback', async () => {
  let capturedRows = null;
  const client = {
    from(table) {
      assert.equal(table, 'ai_history');
      return {
        upsert(rows, options) {
          capturedRows = rows;
          assert.deepEqual(options, {
            onConflict: 'user_id,history_id',
            ignoreDuplicates: false,
          });
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  const didSync = await aiHistorySyncMixin.syncAiHistoryToSupabase.call(
    {
      client,
      getSyncUserId: async () => 'user-1',
      hasCloudSyncAccess: async () => true,
    },
    [
      {
        id: '42',
        type: 'summary',
        title: 'Example summary',
        originalText: ' Original source text ',
        threads: [{ answer: 'Summary answer' }],
        createdAt: Date.parse('2026-06-01T10:00:00.000Z'),
        updatedAt: Date.parse('2026-06-01T11:00:00.000Z'),
      },
    ],
  );

  assert.equal(didSync, true);
  assert.equal(capturedRows.length, 1);
  assert.equal(capturedRows[0].user_id, 'user-1');
  assert.equal(capturedRows[0].history_id, 42);
  assert.equal(capturedRows[0].title, 'Example summary');
  assert.deepEqual(JSON.parse(capturedRows[0].threads), [
    { answer: 'Summary answer', sourceText: 'Original source text' },
  ]);
});

test('fetchAiHistoryFromSupabase restores source text from legacy thread fields', async () => {
  await withGlobal('navigator', { onLine: true }, async () => {
    const rows = await aiHistorySyncMixin.fetchAiHistoryFromSupabase.call({
      client: {},
      getSyncUserId: async () => 'user-1',
      _fetchAiHistoryRowsWithFallback: async () => [
        {
          history_id: 7,
          type: 'summary',
          title: 'Legacy row',
          threads: JSON.stringify([{ question: 'Q', answer: 'A', source_text: 'legacy source' }]),
          created_at: '2026-06-01T10:00:00.000Z',
          updated_at: '2026-06-01T11:00:00.000Z',
        },
      ],
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 7);
    assert.equal(rows[0].originalText, 'legacy source');
    assert.equal(rows[0].threads[0].source_text, 'legacy source');
  });
});

test('fetchAiHistoryFromSupabase avoids network work while offline', async () => {
  await withGlobal('navigator', { onLine: false }, async () => {
    let fetched = false;
    const rows = await aiHistorySyncMixin.fetchAiHistoryFromSupabase.call({
      client: {},
      getSyncUserId: async () => {
        throw new Error('should not resolve user while offline');
      },
      _fetchAiHistoryRowsWithFallback: async () => {
        fetched = true;
        return [];
      },
    });

    assert.deepEqual(rows, []);
    assert.equal(fetched, false);
  });
});

test('fetchAiHistoryFromSupabase restores refactorization original text from before field', async () => {
  await withGlobal('navigator', { onLine: true }, async () => {
    const [row] = await aiHistorySyncMixin.fetchAiHistoryFromSupabase.call({
      client: {},
      getSyncUserId: async () => 'user-1',
      _fetchAiHistoryRowsWithFallback: async () => [
        {
          history_id: 8,
          type: 'refactorization',
          title: 'Refactor row',
          threads: [{ before: 'old code', after: 'new code' }],
          created_at: '2026-06-01T10:00:00.000Z',
          updated_at: '2026-06-01T11:00:00.000Z',
        },
      ],
    });

    assert.equal(row.originalText, 'old code');
  });
});

test('mergeAiHistory preserves local original text when newer remote row lacks it', () => {
  const merged = aiHistorySyncMixin.mergeAiHistory(
    [
      {
        id: 1,
        type: 'summary',
        title: 'Local',
        originalText: 'local source',
        threads: [{ answer: 'old answer', sourceText: 'local source' }],
        updatedAt: 100,
      },
      {
        id: 2,
        type: 'summary',
        title: 'Local only',
        originalText: 'second source',
        threads: [{ answer: 'second answer' }],
        updatedAt: 250,
      },
    ],
    [
      {
        id: 1,
        type: 'summary',
        title: 'Remote wins',
        threads: [{ answer: 'new answer' }],
        updatedAt: 300,
      },
    ],
  );

  assert.deepEqual(
    merged.map((entry) => entry.id),
    [1, 2],
  );
  assert.equal(merged[0].title, 'Remote wins');
  assert.equal(merged[0].originalText, 'local source');
  assert.deepEqual(merged[0].threads, [{ answer: 'new answer', sourceText: 'local source' }]);
});

test('_fetchAiHistoryRowsWithFallback uses direct fetch for retryable client failures', async () => {
  let directCalled = false;
  const rows = await aiHistorySyncMixin._fetchAiHistoryRowsWithFallback.call({
    _fetchAiHistoryRowsWithClient: async () => {
      throw new Error('Failed to fetch');
    },
    _fetchAiHistoryRowsDirect: async (userId) => {
      directCalled = true;
      assert.equal(userId, 'user-1');
      return [{ history_id: 1 }];
    },
  }, 'user-1');

  assert.equal(directCalled, true);
  assert.deepEqual(rows, [{ history_id: 1 }]);
});

test('_fetchAiHistoryRowsDirect sends authenticated REST request and parses arrays', async () => {
  await withGlobal('PASTECRAFT_CONFIG', {
    supabase: {
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
    },
  }, async () => {
    let requestedUrl = '';
    let requestedOptions = null;
    const rows = await aiHistorySyncMixin._fetchAiHistoryRowsDirect.call({
      getStoredAccessToken: async () => 'access-token',
      _fetchWithTimeout: async (url, options, timeoutMs, timeoutLabel) => {
        requestedUrl = url;
        requestedOptions = options;
        assert.equal(timeoutMs, 7000);
        assert.equal(timeoutLabel, 'fetchAiHistoryDirect timeout');
        return {
          ok: true,
          json: async () => [{ history_id: 5 }],
        };
      },
    }, 'user 1');

    assert.equal(
      requestedUrl,
      'https://example.supabase.co/rest/v1/ai_history?select=*&user_id=eq.user%201&deleted_at=is.null&order=updated_at.desc&limit=50',
    );
    assert.equal(requestedOptions.method, 'GET');
    assert.equal(requestedOptions.headers.apikey, 'anon-key');
    assert.equal(requestedOptions.headers.Authorization, 'Bearer access-token');
    assert.deepEqual(rows, [{ history_id: 5 }]);
  });
});
