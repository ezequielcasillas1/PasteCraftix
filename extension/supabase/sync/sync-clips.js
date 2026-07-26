/** Vertical slice: sync-clips.js */
import {
  buildDbClipsForUpsert as buildDbClipsForUpsertRows,
  filterDbClipsAgainstTombstones
} from './sync-clips.upsert.js';
import { mapDbClipToLocal, mapDbClipToLocalPage } from './sync-clips.map.js';
import { mergeClips as mergeClipsPure } from './sync-clips.merge.js';

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
    const userId = await this.getSyncUserId();
    const hasAccess = await this.hasCloudSyncAccess(userId);
    if (!hasAccess) {
      console.log('ℹ️ Cloud sync not available for free tier. Clips stored locally only.');
      return false;
    }

    await this.setUserContext(userId);
    const deviceId = await this.getDeviceId();
    const totalClips = Array.isArray(localClips) ? localClips.length : 0;
    console.log(`📤 Syncing ${totalClips} clips to Supabase...`);

    if (totalClips > this.BATCH_SIZE) {
      return await this.syncClipsToSupabaseBatch(localClips, userId, deviceId);
    }

    return await this._upsertClipsWithTombstoneGuard(localClips, userId, deviceId);
  } catch (error) {
    console.error('❌ Failed to sync clips to Supabase:', error);
    return false;
  }
},

async _upsertClipsWithTombstoneGuard(localClips, userId, deviceId) {
  const dbClips = this.buildDbClipsForUpsert(localClips, userId, deviceId);
  const tombstoned = await this._fetchTombstonedIds('clips', 'clip_id');
  const safeDbClips = filterDbClipsAgainstTombstones(dbClips, tombstoned);

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
  return buildDbClipsForUpsertRows(localClips, userId, deviceId);
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

_normalizeSoftDeletedClips(items) {
  return items.map((item) => ({
    ...item,
    deletedAt: Number.isFinite(item?.deletedAt) ? item.deletedAt : Date.now()
  }));
},

_softDeleteAuditRows(dbClips, userId, deviceId, entityType) {
  return dbClips.map((clip) => ({
    user_id: userId,
    entity_type: entityType,
    entity_id: String(clip.clip_id),
    action: 'soft_delete',
    data: { text: clip.text, category: clip.category, timestamp: clip.timestamp },
    device_id: deviceId || null
  }));
},

/**
 * Shared soft-delete upsert for clips / archived_clips (+ audit log).
 */
async _syncSoftDeletedClipsToTable(deletedClips, { table, entityType, skipWarn, failLog }) {
  if (!this.client) {
    console.warn(skipWarn);
    return false;
  }

  const items = Array.isArray(deletedClips) ? deletedClips : [];
  if (items.length === 0) return true;

  try {
    const userId = await this.getSyncUserId();
    await this.setUserContext(userId);
    const deviceId = await this.getDeviceId();
    const dbClips = this.buildDbClipsForUpsert(
      this._normalizeSoftDeletedClips(items),
      userId,
      deviceId
    );

    const { error } = await this.client
      .from(table)
      .upsert(dbClips, {
        onConflict: 'user_id,clip_id',
        ignoreDuplicates: false
      });
    if (error) throw error;

    await this.insertAuditLogs(
      this._softDeleteAuditRows(dbClips, userId, deviceId, entityType)
    );
    return true;
  } catch (error) {
    console.error(failLog, error);
    return false;
  }
},

async syncDeletedClipsToSupabase(deletedClips) {
  return this._syncSoftDeletedClipsToTable(deletedClips, {
    table: 'clips',
    entityType: 'clip',
    skipWarn: '⚠️ Supabase not initialized - skipping deleted clips sync',
    failLog: '❌ Failed to sync deleted clips to Supabase:'
  });
},

async syncDeletedArchivedClipsToSupabase(deletedClips) {
  return this._syncSoftDeletedClipsToTable(deletedClips, {
    table: 'archived_clips',
    entityType: 'archived_clip',
    skipWarn: '⚠️ Supabase not initialized - skipping deleted archived clips sync',
    failLog: '❌ Failed to sync deleted archived clips to Supabase:'
  });
},

/**
 * Batch sync clips to Supabase (for large datasets)
 */
async syncClipsToSupabaseBatch(localClips, userId, deviceId) {
  const totalClips = localClips.length;
  const batches = Math.ceil(totalClips / this.BATCH_SIZE);
  let syncedCount = 0;

  console.log(`📦 Using batch sync: ${batches} batches of ${this.BATCH_SIZE} clips`);
  this.updateSyncProgress(0, totalClips, 0);

  const tombstoned = await this._fetchTombstonedIds('clips', 'clip_id');

  for (let i = 0; i < batches; i++) {
    const start = i * this.BATCH_SIZE;
    const end = Math.min(start + this.BATCH_SIZE, totalClips);
    const batchClips = localClips.slice(start, end);
    const dbClips = this.buildDbClipsForUpsert(batchClips, userId, deviceId);
    const safeDbClips = filterDbClipsAgainstTombstones(dbClips, tombstoned);
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

    const totalClips = await this._countClipsForUser(userId);
    console.log(`📊 Total clips to fetch: ${totalClips}`);

    if (totalClips > this.BATCH_SIZE) {
      return await this.syncClipsFromSupabaseBatch(userId, totalClips);
    }

    const { data, error } = await this.client
      .from('clips')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    if (error) throw error;

    const localClips = data.map(mapDbClipToLocal);
    console.log(`✅ Fetched ${localClips.length} clips from Supabase (all devices)`);
    return localClips;
  } catch (error) {
    console.error('❌ Failed to fetch clips from Supabase:', error);
    return null;
  }
},

async _countClipsForUser(userId) {
  const { count, error: countError } = await this.client
    .from('clips')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) throw countError;
  return count || 0;
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

      const localClips = data.map(mapDbClipToLocal);
      allClips = allClips.concat(localClips);
      fetchedCount += localClips.length;
      const percentage = Math.round((fetchedCount / totalClips) * 100);
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
    return (data || []).map(mapDbClipToLocalPage);
  } catch (e) {
    console.error(`Failed to fetch clips page (offset=${offset}, limit=${limit}):`, e);
    return [];
  }
},

/**
 * Merge local and remote clips (newest wins)
 */
async mergeClips(localClips, remoteClips) {
  return mergeClipsPure(localClips, remoteClips);
}

// =====================================================
};
