/** Vertical slice: sync-clips.js */
import { getClipIdKey } from '../../shared/clip-id.js';

function rememberDeletedClipId(deletedById, id, when) {
  const key = getClipIdKey(id);
  const raw = id != null ? String(id) : '';
  if (key) {
    const prev = deletedById.get(key) || 0;
    if (when > prev) deletedById.set(key, when);
  }
  if (raw && raw !== key) {
    const prev = deletedById.get(raw) || 0;
    if (when > prev) deletedById.set(raw, when);
  }
}

function lookupDeletedClipAt(deletedById, id) {
  const key = getClipIdKey(id);
  const raw = id != null ? String(id) : '';
  if (key && deletedById.has(key)) return deletedById.get(key);
  if (raw && deletedById.has(raw)) return deletedById.get(raw);
  return null;
}

export const syncClipsMixin = {
// CLIPS SYNC METHODS
// =====================================================

/**
 * Sync local clips to Supabase (with batch support for large datasets)
 */
async syncClipsToSupabase(localClips) {
  if (!this.client) {
    console.warn('⚠️ Supabase not initialized - skipping clip sync');
    return false;
  }

  try {
    const _pcSyncStart = Date.now();
    const userId = await this.getSyncUserId();
    
    // Check cloud sync access (FREE tier = local only)
    const hasAccess = await this.hasCloudSyncAccess(userId);
    if (!hasAccess) {
      console.log('ℹ️ Cloud sync not available for free tier. Clips stored locally only.');
      return false; // Silently fail - user stays on local storage
    }
    
    await this.setUserContext(userId);

    const deviceId = await this.getDeviceId();
    const totalClips = Array.isArray(localClips) ? localClips.length : 0;
    console.log(`📤 Syncing ${totalClips} clips to Supabase...`);


    // Use batch processing for large datasets (>100 clips)
    if (totalClips > this.BATCH_SIZE) {
      return await this.syncClipsToSupabaseBatch(localClips, userId, deviceId);
    }

    // Standard sync for small datasets
    const dbClips = this.buildDbClipsForUpsert(localClips, userId, deviceId);

    // TOMBSTONE GUARD: prevent stale devices from resurrecting deleted clips.
    const tombstoned = await this._fetchTombstonedIds('clips', 'clip_id');
    const safeDbClips = dbClips.filter(c => {
      const idStr = String(c.clip_id || '');
      const hasLocalTombstone = c.deleted_at != null;
      return !(tombstoned.has(idStr) && !hasLocalTombstone);
    });
    if (safeDbClips.length !== dbClips.length) {
      console.log(`🛡️ Tombstone guard skipped ${dbClips.length - safeDbClips.length} already-deleted clips from upsert`);
      await this._mergeTombstonesIntoLocal('pc_deleted_clips', tombstoned);
    }
    if (safeDbClips.length === 0) {
      console.log('⚠️ All local clips were already tombstoned remotely; nothing to upsert');
      return true;
    }

    const { error } = await this.client
      .from('clips')
      .upsert(safeDbClips, {
        onConflict: 'user_id,clip_id',
        ignoreDuplicates: false
      });

    if (error) throw error;

    console.log(`✅ Synced ${safeDbClips.length} clips to Supabase`);
    return true;
  } catch (error) {
    console.error('❌ Failed to sync clips to Supabase:', error);
    return false;
  }
},

/**
 * Sync local clips to Supabase for a specific userId (used for legacy→auth migration).
 */
async syncClipsToSupabaseForUser(localClips, userId) {
  if (!this.client) return false;
  try {
    await this.setUserContext(userId);

    const deviceId = await this.getDeviceId();
    const dbClips = this.buildDbClipsForUpsert(localClips, userId, deviceId);

    const { error } = await this.client
      .from('clips')
      .upsert(dbClips, { onConflict: 'user_id,clip_id', ignoreDuplicates: false });

    if (error) throw error;
    return true;
  } catch (_) {
    return false;
  }
},

buildDbClipsForUpsert(localClips, userId, deviceId) {
  const arr = Array.isArray(localClips) ? localClips : [];

  // Stable-ish hash for legacy clips without ids (avoid undefined clip_id collisions)
  const hash = (s) => {
    const str = String(s || '');
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  };

  const seen = new Map(); // clip_id -> dbClip (keep newest)
  const dupCounter = new Map(); // baseId -> count
  let droppedNoText = 0;
  let droppedInvalid = 0;
  let droppedImported = 0;
  let inferredIds = 0;

  for (let i = 0; i < arr.length; i++) {
    const clip = arr[i];
    const text = typeof clip === 'string' ? clip : (clip?.text ?? clip);
    if (!text) { droppedNoText++; continue; }

    const originDeviceId = typeof clip === 'object' && clip ? String(clip.origin_device_id || '').trim() : '';
    if (originDeviceId && originDeviceId !== deviceId) {
      droppedImported++;
      continue;
    }

    const ts = typeof clip === 'object' && clip ? (clip.timestamp ?? null) : null;
    const updatedAtMs =
      typeof clip === 'object' && clip
        ? (clip.updatedAt ?? clip.updated_at ?? ts)
        : ts;
    const deletedAtMs =
      typeof clip === 'object' && clip
        ? (clip.deletedAt ?? clip.deleted_at ?? null)
        : null;
    const rawId =
      (typeof clip === 'object' && clip ? (clip.id ?? clip.clip_id ?? clip.clipId ?? null) : null) ??
      `legacy_${hash(text)}_${Number.isFinite(ts) ? ts : 0}`;
    if (!(typeof clip === 'object' && clip && (clip.id ?? clip.clip_id ?? clip.clipId))) inferredIds++;

    const baseId = getClipIdKey(rawId) || String(rawId);
    const count = (dupCounter.get(baseId) || 0) + 1;
    dupCounter.set(baseId, count);
    const clipId = count === 1 ? baseId : `${baseId}__dup${count}`;

    const db = {
      user_id: userId,
      clip_id: clipId,
      text: String(text),
      title: typeof clip === 'object' && clip ? String(clip.title || clip.clip_title || '').trim() : '',
      category: (typeof clip === 'object' && clip && clip.category) ? clip.category : 'Uncategorized',
      timestamp: Number.isFinite(ts) ? ts : Date.now(),
      updated_at: Number.isFinite(updatedAtMs) ? new Date(updatedAtMs).toISOString() : new Date().toISOString(),
      deleted_at: Number.isFinite(deletedAtMs) ? new Date(deletedAtMs).toISOString() : null,
      device_id: (() => {
        if (typeof clip === 'object' && clip) {
          const incomingDeviceId = String(clip.deviceId ?? clip.device_id ?? '').trim();
          if (incomingDeviceId) return incomingDeviceId;
        }
        return deviceId || null;
      })(),
      content_hash: hash(text)
    };

    const existing = seen.get(clipId);
    if (!existing || (db.timestamp || 0) > (existing.timestamp || 0)) {
      seen.set(clipId, db);
    }
  }

  const out = Array.from(seen.values());
  out._pcStats = { inputCount: arr.length, outCount: out.length, droppedNoText, droppedInvalid, droppedImported, inferredIds };
  return out;
},

async insertAuditLogs(rows) {
  if (!this.client) return;
  if (!Array.isArray(rows) || rows.length === 0) return;
  try {
    await this.client.from('audit_log').insert(rows);
  } catch (error) {
    console.warn('⚠️ Audit log insert failed:', error?.message || error);
  }
},

async syncDeletedClipsToSupabase(deletedClips) {
  if (!this.client) {
    console.warn('⚠️ Supabase not initialized - skipping deleted clips sync');
    return false;
  }

  const items = Array.isArray(deletedClips) ? deletedClips : [];
  if (items.length === 0) return true;

  try {
    const userId = await this.getSyncUserId();
    await this.setUserContext(userId);
    const deviceId = await this.getDeviceId();

    const normalized = items.map(item => ({
      ...item,
      deletedAt: Number.isFinite(item?.deletedAt) ? item.deletedAt : Date.now()
    }));
    const dbClips = this.buildDbClipsForUpsert(normalized, userId, deviceId);

    const { error } = await this.client
      .from('clips')
      .upsert(dbClips, {
        onConflict: 'user_id,clip_id',
        ignoreDuplicates: false
      });
    if (error) throw error;

    await this.insertAuditLogs(dbClips.map(clip => ({
      user_id: userId,
      entity_type: 'clip',
      entity_id: String(clip.clip_id),
      action: 'soft_delete',
      data: { text: clip.text, category: clip.category, timestamp: clip.timestamp },
      device_id: deviceId || null
    })));

    return true;
  } catch (error) {
    console.error('❌ Failed to sync deleted clips to Supabase:', error);
    return false;
  }
},

async syncDeletedArchivedClipsToSupabase(deletedClips) {
  if (!this.client) {
    console.warn('⚠️ Supabase not initialized - skipping deleted archived clips sync');
    return false;
  }

  const items = Array.isArray(deletedClips) ? deletedClips : [];
  if (items.length === 0) return true;

  try {
    const userId = await this.getSyncUserId();
    await this.setUserContext(userId);
    const deviceId = await this.getDeviceId();

    const normalized = items.map(item => ({
      ...item,
      deletedAt: Number.isFinite(item?.deletedAt) ? item.deletedAt : Date.now()
    }));
    const dbClips = this.buildDbClipsForUpsert(normalized, userId, deviceId);

    const { error } = await this.client
      .from('archived_clips')
      .upsert(dbClips, {
        onConflict: 'user_id,clip_id',
        ignoreDuplicates: false
      });
    if (error) throw error;

    await this.insertAuditLogs(dbClips.map(clip => ({
      user_id: userId,
      entity_type: 'archived_clip',
      entity_id: String(clip.clip_id),
      action: 'soft_delete',
      data: { text: clip.text, category: clip.category, timestamp: clip.timestamp },
      device_id: deviceId || null
    })));

    return true;
  } catch (error) {
    console.error('❌ Failed to sync deleted archived clips to Supabase:', error);
    return false;
  }
},

/**
 * Batch sync clips to Supabase (for large datasets)
 */
async syncClipsToSupabaseBatch(localClips, userId, deviceId) {
  const totalClips = localClips.length;
  const batches = Math.ceil(totalClips / this.BATCH_SIZE);
  let syncedCount = 0;

  console.log(`📦 Using batch sync: ${batches} batches of ${this.BATCH_SIZE} clips`);

  // Reset progress
  this.updateSyncProgress(0, totalClips, 0);

  // TOMBSTONE GUARD (fetched once for the whole batch run).
  const tombstoned = await this._fetchTombstonedIds('clips', 'clip_id');

  for (let i = 0; i < batches; i++) {
    const start = i * this.BATCH_SIZE;
    const end = Math.min(start + this.BATCH_SIZE, totalClips);
    const batchClips = localClips.slice(start, end);

    // Transform to DB format (and dedupe/normalize ids)
    const dbClips = this.buildDbClipsForUpsert(batchClips, userId, deviceId);
    const safeDbClips = dbClips.filter(c => {
      const idStr = String(c.clip_id || '');
      const hasLocalTombstone = c.deleted_at != null;
      return !(tombstoned.has(idStr) && !hasLocalTombstone);
    });
    if (safeDbClips.length === 0) continue;

    try {
      const { error } = await this.client
        .from('clips')
        .upsert(safeDbClips, {
          onConflict: 'user_id,clip_id',
          ignoreDuplicates: false
        });

      if (error) throw error;

      syncedCount += safeDbClips.length;
      const percentage = Math.round((syncedCount / totalClips) * 100);
      
      // Update progress
      this.updateSyncProgress(syncedCount, totalClips, percentage);
      console.log(`📤 Batch ${i + 1}/${batches}: Synced ${syncedCount}/${totalClips} clips (${percentage}%)`);

    } catch (error) {
      console.error(`❌ Batch ${i + 1} failed:`, error);
      throw error;
    }
  }

  console.log(`✅ Batch sync complete: ${syncedCount} clips synced`);
  return true;
},

/**
 * Sync clips from Supabase to local storage (with batch support for large datasets)
 * Fetches ALL clips for the user across ALL devices for automatic cross-device sync.
 */
async syncClipsFromSupabase(userIdOverride = null) {
  if (!this.client) {
    console.warn('⚠️ Supabase not initialized - skipping clip sync');
    return null;
  }

  try {
    const userId = userIdOverride || await this.getSyncUserId();
    await this.setUserContext(userId);

    console.log('📥 Fetching clips from Supabase (all devices)...');

    // First, get total count
    const { count, error: countError } = await this.client
      .from('clips')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) throw countError;

    const totalClips = count || 0;
    console.log(`📊 Total clips to fetch: ${totalClips}`);

    // Use batch fetching for large datasets (>100 clips)
    if (totalClips > this.BATCH_SIZE) {
      return await this.syncClipsFromSupabaseBatch(userId, totalClips);
    }

    // Standard fetch for small datasets - all devices
    const { data, error } = await this.client
      .from('clips')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    if (error) throw error;

    // Transform DB format to local format
    const localClips = data.map(clip => ({
      id: clip.clip_id,
      text: clip.text,
      title: clip.title || '',
      category: clip.category,
      timestamp: clip.timestamp,
      updatedAt: clip.updated_at ? Date.parse(clip.updated_at) : clip.timestamp,
      deletedAt: clip.deleted_at ? Date.parse(clip.deleted_at) : null,
      deviceId: clip.device_id || null
    }));

    console.log(`✅ Fetched ${localClips.length} clips from Supabase (all devices)`);
    return localClips;
  } catch (error) {
    console.error('❌ Failed to fetch clips from Supabase:', error);
    return null;
  }
},

/**
 * Batch fetch clips from Supabase (for large datasets)
 * Fetches all clips for user across all devices
 */
async syncClipsFromSupabaseBatch(userId, totalClips) {
  const batches = Math.ceil(totalClips / this.BATCH_SIZE);
  let allClips = [];
  let fetchedCount = 0;

  console.log(`📦 Using batch fetch: ${batches} batches of ${this.BATCH_SIZE} clips`);

  // Reset progress
  this.updateSyncProgress(0, totalClips, 0);

  for (let i = 0; i < batches; i++) {
    const start = i * this.BATCH_SIZE;
    const end = start + this.BATCH_SIZE - 1;

    try {
      const { data, error } = await this.client
        .from('clips')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .range(start, end);

      if (error) throw error;

      // Transform DB format to local format
      const localClips = data.map(clip => ({
        id: clip.clip_id,
        text: clip.text,
        title: clip.title || '',
        category: clip.category,
        timestamp: clip.timestamp,
        updatedAt: clip.updated_at ? Date.parse(clip.updated_at) : clip.timestamp,
        deletedAt: clip.deleted_at ? Date.parse(clip.deleted_at) : null,
        deviceId: clip.device_id || null
      }));

      allClips = allClips.concat(localClips);
      fetchedCount += localClips.length;
      const percentage = Math.round((fetchedCount / totalClips) * 100);

      // Update progress
      this.updateSyncProgress(fetchedCount, totalClips, percentage);
      console.log(`📥 Batch ${i + 1}/${batches}: Fetched ${fetchedCount}/${totalClips} clips (${percentage}%)`);

    } catch (error) {
      console.error(`❌ Batch ${i + 1} failed:`, error);
      throw error;
    }
  }

  console.log(`✅ Batch fetch complete: ${allClips.length} clips fetched`);
  return allClips;
},

// =====================================================
// PAGINATED FETCH FUNCTIONS (for lazy loading)
// =====================================================

/**
 * Get total clips count for the user (for pagination)
 * @param {string} userIdOverride - Optional user ID override
 * @returns {Promise<number>}
 */
async getClipsCount(userIdOverride = null) {
  if (!this.client) return 0;
  
  try {
    const userId = userIdOverride || await this.getSyncUserId();
    if (!userId) return 0;
    
    const { count, error } = await this.client
      .from('clips')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null);
    
    if (error) throw error;
    return count || 0;
  } catch (e) {
    console.error('Failed to get clips count:', e);
    return 0;
  }
},

/**
 * Fetch a single page of clips for lazy loading
 * @param {number} offset - Starting index (0-based)
 * @param {number} limit - Number of clips to fetch
 * @param {string} userIdOverride - Optional user ID override
 * @returns {Promise<Array>}
 */
async fetchClipsPage(offset, limit, userIdOverride = null) {
  if (!this.client) return [];
  
  try {
    const userId = userIdOverride || await this.getSyncUserId();
    if (!userId) return [];
    
    const end = offset + limit - 1;
    
    const { data, error } = await this.client
      .from('clips')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('timestamp', { ascending: false })
      .range(offset, end);
    
    if (error) throw error;
    
    // Transform DB format to local format
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
    console.error(`Failed to fetch clips page (offset=${offset}, limit=${limit}):`, e);
    return [];
  }
},

/**
 * Merge local and remote clips (newest wins)
 */
async mergeClips(localClips, remoteClips) {
  const contentMerged = new Map();
  const deletedById = new Map();

  remoteClips.forEach(clip => {
    if (clip?.id == null || !clip?.deletedAt) return;
    rememberDeletedClipId(deletedById, clip.id, clip.deletedAt);
  });

  // Honor local tombstones so remote stale-alive rows cannot resurrect.
  // Use getClipIdKey so float ids (.223 vs .2229) still match across pages/sync.
  try {
    const local = await new Promise((resolve) => {
      chrome.storage.local.get(['pc_deleted_clips'], (res) => resolve(res || {}));
    });
    const localTombs = Array.isArray(local?.pc_deleted_clips) ? local.pc_deleted_clips : [];
    localTombs.forEach((t) => {
      if (t?.id == null || t?.id === '') return;
      const when = Number.isFinite(t?.deletedAt) ? t.deletedAt : Date.now();
      rememberDeletedClipId(deletedById, t.id, when);
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
    const bucket = Math.floor(ts / 3000); // 3s bucket to collapse accidental dupes
    const cat = clip.category != null ? String(clip.category) : '';
    return `${hashText(text)}:${bucket}:${cat}`;
  };

  const add = (clip) => {
    if (!clip || !clip.text) return;
    const deletedAt = lookupDeletedClipAt(deletedById, clip?.id);
    const clipUpdatedAt = Number.isFinite(clip?.updatedAt) ? clip.updatedAt : (clip?.timestamp || 0);
    if (deletedAt && deletedAt >= clipUpdatedAt) {
      return;
    }
    const k = contentKey(clip);
    const prev = contentMerged.get(k);
    const prevUpdatedAt = Number.isFinite(prev?.updatedAt) ? prev.updatedAt : (prev?.timestamp || 0);
    if (!prev || clipUpdatedAt > prevUpdatedAt || ((clipUpdatedAt === prevUpdatedAt) && (clip.timestamp || 0) > (prev.timestamp || 0))) {
      contentMerged.set(k, clip);
    }
  };

  localClips.forEach(add);
  remoteClips.forEach(add);


  return Array.from(contentMerged.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

// =====================================================
};
