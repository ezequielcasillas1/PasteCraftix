/** Vertical slice: ai-history-sync.js */

function _parseHistoryThreads(raw) {
  let threads = raw || [];
  if (typeof raw === 'string') {
    try {
      threads = JSON.parse(raw);
    } catch (_) {
      threads = [];
    }
  }
  return Array.isArray(threads) ? threads : [];
}

function _pickSourceText(candidates) {
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (value) return value.substring(0, 2000);
  }
  return '';
}

function _entrySourceText(entry) {
  return _pickSourceText([
    entry?.originalText,
    entry?.original_text,
  ]);
}

function _threadsWithSourceTextFallback(entry) {
  const threads = _parseHistoryThreads(entry?.threads).map((thread) => ({ ...thread }));
  if (threads.length === 0) return threads;

  const sourceText = _entrySourceText(entry);
  if (!sourceText) return threads;

  const firstThread = threads[0];
  const existingSource = _pickSourceText([
    firstThread?.sourceText,
    firstThread?.source_text,
    firstThread?.contextSourceText,
    firstThread?.context_source_text,
  ]);
  if (!existingSource) {
    firstThread.sourceText = sourceText;
  }

  return threads;
}

function _restoreOriginalTextFromRow(row) {
  const threads = _parseHistoryThreads(row?.threads);
  const rowSourceText = _pickSourceText([
    row?.originalText,
    row?.original_text,
    row?.sourceText,
    row?.source_text,
  ]);
  if (rowSourceText) return rowSourceText;

  if (String(row?.type) === 'refactorization' && threads[0]) {
    return String(threads[0].before || threads[0].question || '').substring(0, 2000);
  }
  const firstThread = threads[0] || {};
  return _pickSourceText([
    firstThread.sourceText,
    firstThread.source_text,
    firstThread.contextSourceText,
    firstThread.context_source_text,
  ]);
}

function _preserveLocalOriginalText(existingEntry, incomingEntry) {
  if (!existingEntry) return incomingEntry;
  const localSource = _entrySourceText(existingEntry);
  const incomingSource = _entrySourceText(incomingEntry);
  if (!localSource || incomingSource) return incomingEntry;

  return {
    ...incomingEntry,
    originalText: localSource,
    threads: _threadsWithSourceTextFallback({
      ...incomingEntry,
      originalText: localSource,
    }),
  };
}

function _aiHistoryErrorText(error) {
  return `${String(error?.message || '').trim()} ${String(error?.details || '').trim()}`.trim().toLowerCase();
}

function _isRetryableAiHistoryFetchError(error) {
  const text = _aiHistoryErrorText(error);
  if (!text) return false;
  return (
    text.includes('failed to fetch') ||
    text.includes('networkerror') ||
    text.includes('network request failed') ||
    text.includes('fetchaihistory timeout') ||
    text.includes('request timed out') ||
    text.includes('load failed')
  );
}

export const aiHistorySyncMixin = {
// AI HISTORY SYNC METHODS
// =====================================================

/**
 * Sync AI history to Supabase (cloud backup)
 * No custom RLS plumbing — queries by user_id, lets RLS handle auth
 */
async syncAiHistoryToSupabase(localHistory) {
  if (!this.client) return false;
  const items = Array.isArray(localHistory) ? localHistory : [];
  if (items.length === 0) return true;

  try {
    // Do not upsert with a legacy chromeUserId and no JWT (RLS → 401 spam).
    if (typeof this.hasActiveAuthSession === 'function' && !(await this.hasActiveAuthSession())) {
      return false;
    }
    const userId = await this.getSyncUserId();
    const hasAccess = await this.hasCloudSyncAccess(userId);
    if (!hasAccess) return false;

    const rows = items.map(entry => ({
      user_id: userId,
      history_id: Number(entry.id),
      type: String(entry.type || 'summary'),
      title: String(entry.title || '').substring(0, 255),
      threads: JSON.stringify(_threadsWithSourceTextFallback(entry)),
      created_at: entry.createdAt ? new Date(entry.createdAt).toISOString() : new Date().toISOString(),
      updated_at: entry.updatedAt ? new Date(entry.updatedAt).toISOString() : new Date().toISOString()
    }));

    const { error } = await this.client
      .from('ai_history')
      .upsert(rows, { onConflict: 'user_id,history_id', ignoreDuplicates: false });

    if (error) throw error;
    console.log(`☁️ Synced ${rows.length} AI history entries to cloud`);
    return true;
  } catch (error) {
    console.error('❌ Failed to sync AI history to Supabase:', error);
    return false;
  }
},

/**
 * Fetch AI history from Supabase
 * View is always allowed regardless of subscription status
 */
async fetchAiHistoryFromSupabase() {
  if (!this.client) return [];

  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return [];
    }

    // getSyncUserId falls back to stored ids without JWT — gate first to avoid 401.
    if (typeof this.hasActiveAuthSession === 'function' && !(await this.hasActiveAuthSession())) {
      return [];
    }

    const userId = await this.getSyncUserId();
    if (!userId) return [];

    const rows = await this._fetchAiHistoryRowsWithFallback(userId);
    return rows.map(row => {
      const parsedThreads = _parseHistoryThreads(row.threads);
      const originalText = _restoreOriginalTextFromRow({ ...row, threads: parsedThreads });
      return {
        id: Number(row.history_id),
        type: String(row.type || 'summary'),
        title: String(row.title || ''),
        originalText,
        threads: _threadsWithSourceTextFallback({
          originalText,
          threads: parsedThreads,
        }),
        createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
        updatedAt: row.updated_at ? Date.parse(row.updated_at) : Date.now()
      };
    });
  } catch (error) {
    console.error('❌ Failed to fetch AI history from Supabase:', error);
    return [];
  }
},

async _fetchAiHistoryRowsWithFallback(userId) {
  let lastError = null;

  try {
    return await this._fetchAiHistoryRowsWithClient(userId);
  } catch (error) {
    lastError = error;
    if (!_isRetryableAiHistoryFetchError(error)) {
      throw error;
    }
  }

  try {
    return await this._fetchAiHistoryRowsDirect(userId);
  } catch (fallbackError) {
    if (lastError) {
      console.warn('⚠️ AI history direct fallback also failed:', fallbackError?.message || fallbackError);
      throw lastError;
    }
    throw fallbackError;
  }
},

async _fetchAiHistoryRowsWithClient(userId) {
  const runQuery = async () => {
    const queryPromise = this.client
      .from('ai_history')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(50);

    const timeoutMs = 7000;
    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error('fetchAiHistory timeout') }), timeoutMs)
    );

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  };

  try {
    return await runQuery();
  } catch (error) {
    if (!_isRetryableAiHistoryFetchError(error)) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    return await runQuery();
  }
},

async _fetchAiHistoryRowsDirect(userId) {
  if (!PASTECRAFT_CONFIG?.supabase?.url || !PASTECRAFT_CONFIG?.supabase?.anonKey) {
    return [];
  }

  const accessToken = await this.getStoredAccessToken();
  if (!accessToken) return [];

  const url = `${PASTECRAFT_CONFIG.supabase.url}/rest/v1/ai_history?select=*&user_id=eq.${encodeURIComponent(String(userId))}&deleted_at=is.null&order=updated_at.desc&limit=50`;
  const headers = {
    apikey: PASTECRAFT_CONFIG.supabase.anonKey,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  const response = typeof this._fetchWithTimeout === 'function'
    ? await this._fetchWithTimeout(url, { method: 'GET', headers }, 7000, 'fetchAiHistoryDirect timeout')
    : await fetch(url, { method: 'GET', headers });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(`fetchAiHistoryDirect failed (${response.status}) ${bodyText}`.trim());
  }

  const data = await response.json().catch(() => []);
  return Array.isArray(data) ? data : [];
},

/**
 * Merge local and remote AI history (remote wins on conflict, newer wins)
 */
mergeAiHistory(localHistory, remoteHistory) {
  const merged = new Map();
  const local = Array.isArray(localHistory) ? localHistory : [];
  const remote = Array.isArray(remoteHistory) ? remoteHistory : [];

  local.forEach(entry => {
    if (entry && entry.id) merged.set(entry.id, entry);
  });

  remote.forEach(entry => {
    if (!entry || !entry.id) return;
    const existing = merged.get(entry.id);
    const existingUpdated = Number.isFinite(existing?.updatedAt) ? existing.updatedAt : 0;
    const remoteUpdated = Number.isFinite(entry?.updatedAt) ? entry.updatedAt : 0;
    if (!existing || remoteUpdated >= existingUpdated) {
      merged.set(entry.id, _preserveLocalOriginalText(existing, entry));
    }
  });

  return Array.from(merged.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

// =====================================================
};
