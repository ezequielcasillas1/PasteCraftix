/** Vertical slice: ai-history-sync.js */

function _parseHistoryThreads(raw) {
  const threads = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
  return Array.isArray(threads) ? threads : [];
}

function _restoreOriginalTextFromRow(row) {
  const threads = _parseHistoryThreads(row?.threads);
  if (String(row?.type) === 'refactorization' && threads[0]) {
    return String(threads[0].before || threads[0].question || '').substring(0, 2000);
  }
  return '';
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
    const userId = await this.getSyncUserId();
    const hasAccess = await this.hasCloudSyncAccess(userId);
    if (!hasAccess) return false;

    const rows = items.map(entry => ({
      user_id: userId,
      history_id: Number(entry.id),
      type: String(entry.type || 'summary'),
      title: String(entry.title || '').substring(0, 255),
      threads: JSON.stringify(entry.threads || []),
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
    const userId = await this.getSyncUserId();
    if (!userId) return [];

    // Guardrail: supabase-js can hang when the auth/session client is stuck
    // (same failure mode as getCurrentUser / getUserSubscription). Race the
    // query against a 3s timeout so popup init can never block past 10s.
    const queryPromise = this.client
      .from('ai_history')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(50);

    const timeoutMs = 3000;
    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error('fetchAiHistoryFromSupabase timeout') }), timeoutMs)
    );

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

    if (error) {
      if (error.message === 'fetchAiHistoryFromSupabase timeout') {
        console.warn('⏱️ fetchAiHistoryFromSupabase timed out after 3s, returning empty');
        return [];
      }
      throw error;
    }

    return (data || []).map(row => ({
      id: Number(row.history_id),
      type: String(row.type || 'summary'),
      title: String(row.title || ''),
      originalText: _restoreOriginalTextFromRow(row),
      threads: _parseHistoryThreads(row.threads),
      createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
      updatedAt: row.updated_at ? Date.parse(row.updated_at) : Date.now()
    }));
  } catch (error) {
    console.error('❌ Failed to fetch AI history from Supabase:', error);
    return [];
  }
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
      merged.set(entry.id, entry);
    }
  });

  return Array.from(merged.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

// =====================================================
};
