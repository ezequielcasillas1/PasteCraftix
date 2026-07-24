/** Vertical slice: sync-archived.js */
export const syncArchivedMixin = {
// ARCHIVED CLIPS SYNC METHODS
// =====================================================

/**
 * Sync archived clips (searchOnlyClips) to Supabase
 */
async syncArchivedClipsToSupabase(localArchivedClips) {
  if (!this.client) {
    console.warn('⚠️ Supabase not initialized - skipping archived clips sync');
    return false;
  }

  try {
    const userId = await this.getSyncUserId();
    const deviceId = await this.getDeviceId();
    await this.setUserContext(userId);

    console.log(`📤 Syncing ${localArchivedClips.length} archived clips to Supabase...`);

    // Transform local archived clips to DB format (and dedupe/normalize ids)
    const dbArchivedClips = this.buildDbClipsForUpsert(localArchivedClips, userId, deviceId);

    // TOMBSTONE GUARD: prevent resurrection of deleted archived clips.
    const tombstoned = await this._fetchTombstonedIds('archived_clips', 'clip_id');
    const safeDbArchivedClips = dbArchivedClips.filter(c => {
      const idStr = String(c.clip_id || '');
      const hasLocalTombstone = c.deleted_at != null;
      return !(tombstoned.has(idStr) && !hasLocalTombstone);
    });
    if (safeDbArchivedClips.length !== dbArchivedClips.length) {
      console.log(`🛡️ Tombstone guard skipped ${dbArchivedClips.length - safeDbArchivedClips.length} already-deleted archived clips`);
      await this._mergeTombstonesIntoLocal('pc_deleted_archived_clips', tombstoned);
    }
    if (safeDbArchivedClips.length === 0) {
      console.log('⚠️ All local archived clips were already tombstoned remotely');
      return true;
    }

    // Upsert archived clips (insert or update on conflict)
    const { data, error } = await this.client
      .from('archived_clips')
      .upsert(safeDbArchivedClips, {
        onConflict: 'user_id,clip_id',
        ignoreDuplicates: false
      })
      .select();

    if (error) throw error;

    console.log(`✅ Synced ${data.length} archived clips to Supabase`);
    return true;
  } catch (error) {
    console.error('❌ Failed to sync archived clips to Supabase:', error);
    return false;
  }
},

/**
 * Sync archived clips from Supabase to local storage (all devices for automatic cross-device sync)
 */
async syncArchivedClipsFromSupabase() {
  if (!this.client) {
    console.warn('⚠️ Supabase not initialized - skipping archived clips sync');
    return null;
  }

  try {
    const userId = await this.getSyncUserId();
    await this.setUserContext(userId);

    console.log('📥 Fetching archived clips from Supabase (all devices)...');

    // Fetch all archived clips across all devices
    const { data, error } = await this.client
      .from('archived_clips')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(100000);

    if (error) throw error;

    // Transform DB format to local format
    const localArchivedClips = data.map(clip => ({
      id: clip.clip_id,
      text: clip.text,
      title: clip.title || '',
      category: clip.category,
      timestamp: clip.timestamp,
      updatedAt: clip.updated_at ? Date.parse(clip.updated_at) : clip.timestamp,
      deletedAt: clip.deleted_at ? Date.parse(clip.deleted_at) : null,
      deviceId: clip.device_id || null
    }));

    console.log(`✅ Fetched ${localArchivedClips.length} archived clips from Supabase (all devices)`);
    return localArchivedClips;
  } catch (error) {
    console.error('❌ Failed to fetch archived clips from Supabase:', error);
    return null;
  }
},

/**
 * Get total archived clips count for the user (for pagination).
 * Filters by user_id only (no device_id sync source filter).
 */
async getArchivedClipsCount() {
  if (!this.client) return 0;

  try {
    const userId = await this.getSyncUserId();
    if (!userId) return 0;

    const { count, error } = await this.client
      .from('archived_clips')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) throw error;
    return count || 0;
  } catch (e) {
    console.error('Failed to get archived clips count:', e);
    return 0;
  }
},

/**
 * Fetch a single page of archived clips for lazy loading
 */
async fetchArchivedClipsPage(offset, limit) {
  if (!this.client) return [];

  try {
    const userId = await this.getSyncUserId();
    if (!userId) return [];

    const end = offset + limit - 1;

    const { data, error } = await this.client
      .from('archived_clips')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('timestamp', { ascending: false })
      .range(offset, end);

    if (error) throw error;

    return (data || []).map(clip => ({
      id: clip.clip_id,
      text: clip.text,
      title: clip.title || '',
      category: clip.category,
      timestamp: clip.timestamp,
      updatedAt: clip.updated_at ? Date.parse(clip.updated_at) : clip.timestamp,
      deviceId: clip.device_id || null,
      meta: clip.meta || undefined
    }));
  } catch (e) {
    console.error(`Failed to fetch archived clips page (offset=${offset}, limit=${limit}):`, e);
    return [];
  }
},

/**
 * Merge local and remote archived clips (newest wins)
 */
async mergeArchivedClips(localArchivedClips, remoteArchivedClips) {
  const contentMerged = new Map();
  const deletedById = new Map();

  remoteArchivedClips.forEach(clip => {
    const id = clip?.id != null ? String(clip.id) : '';
    if (!id || !clip?.deletedAt) return;
    deletedById.set(id, clip.deletedAt);
  });

  try {
    const local = await new Promise((resolve) => {
      chrome.storage.local.get(['pc_deleted_archived_clips'], (res) => resolve(res || {}));
    });
    const localTombs = Array.isArray(local?.pc_deleted_archived_clips) ? local.pc_deleted_archived_clips : [];
    localTombs.forEach((t) => {
      const id = t?.id != null ? String(t.id) : '';
      if (!id) return;
      const when = Number.isFinite(t?.deletedAt) ? t.deletedAt : Date.now();
      const prev = deletedById.get(id) || 0;
      if (when > prev) deletedById.set(id, when);
    });
  } catch (_) { /* non-fatal */ }

  const hashText = (t) => {
    const s = String(t || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  };

  const contentKey = (clip) => {
    if (!clip) return '';
    const text = String(clip.text || '');
    const ts = typeof clip.timestamp === 'number' ? clip.timestamp : 0;
    const bucket = Math.floor(ts / 3000);
    const cat = clip.category != null ? String(clip.category) : '';
    return `${hashText(text)}:${bucket}:${cat}`;
  };

  const add = (clip) => {
    if (!clip || !clip.text) return;
    const id = clip?.id != null ? String(clip.id) : '';
    const deletedAt = id ? deletedById.get(id) : null;
    const clipUpdatedAt = Number.isFinite(clip?.updatedAt) ? clip.updatedAt : (clip?.timestamp || 0);
    if (deletedAt && deletedAt >= clipUpdatedAt) return;
    const k = contentKey(clip);
    const prev = contentMerged.get(k);
    const prevUpdatedAt = Number.isFinite(prev?.updatedAt) ? prev.updatedAt : (prev?.timestamp || 0);
    if (!prev || clipUpdatedAt > prevUpdatedAt || ((clipUpdatedAt === prevUpdatedAt) && (clip.timestamp || 0) > (prev.timestamp || 0))) {
      contentMerged.set(k, clip);
    }
  };

  localArchivedClips.forEach(add);
  remoteArchivedClips.forEach(add);

  const sortedClips = Array.from(contentMerged.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  return sortedClips.slice(0, 1000);
}

// =====================================================
};
