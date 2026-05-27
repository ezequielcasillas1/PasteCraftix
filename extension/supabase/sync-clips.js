/** Vertical slice: sync-clips.js */
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

    // #region agent log
    fetch('http://127.0.0.1:7917/ingest/ad95356a-805b-4ff0-9f29-cccbb04c04fd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'96d59e'},body:JSON.stringify({sessionId:'96d59e',location:'sync-clips.js:upsert',message:'clips upsert attempt',data:{count:safeDbClips.length,columns:safeDbClips[0]?Object.keys(safeDbClips[0]):[]},timestamp:Date.now(),hypothesisId:'A',runId:'post-fix'})}).catch(()=>{});
    // #endregion
    const { error } = await this.client
      .from('clips')
      .upsert(safeDbClips, {
        onConflict: 'user_id,clip_id',
        ignoreDuplicates: false
      });

    if (error) {
      // #region agent log
      fetch('http://127.0.0.1:7917/ingest/ad95356a-805b-4ff0-9f29-cccbb04c04fd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'96d59e'},body:JSON.stringify({sessionId:'96d59e',location:'sync-clips.js:upsert-error',message:'clips upsert failed',data:{code:error.code,message:error.message},timestamp:Date.now(),hypothesisId:'A',runId:'post-fix'})}).catch(()=>{});
      // #endregion
      throw error;
    }

    // #region agent log
    fetch('http://127.0.0.1:7917/ingest/ad95356a-805b-4ff0-9f29-cccbb04c04fd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'96d59e'},body:JSON.stringify({sessionId:'96d59e',location:'sync-clips.js:upsert-ok',message:'clips upsert success',data:{count:safeDbClips.length},timestamp:Date.now(),hypothesisId:'A',runId:'post-fix'})}).catch(()=>{});
    // #endregion
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

    const baseId = String(rawId);
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
      content_hash: hash(text),
      expires_at: (typeof clip === 'object' && clip && Number.isFinite(clip.expiresAt)) ? clip.expiresAt : null,
      expire_preset: (typeof clip === 'object' && clip && clip.expirePreset) ? String(clip.expirePreset).slice(0, 32) : null,
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

      if (error) {
        throw error;
      }

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
      deviceId: clip.device_id || null,
      expiresAt: Number.isFinite(clip.expires_at) ? clip.expires_at : null,
      expirePreset: clip.expire_preset || null,
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
        deviceId: clip.device_id || null,
        expiresAt: Number.isFinite(clip.expires_at) ? clip.expires_at : null,
        expirePreset: clip.expire_preset || null,
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
      meta: clip.meta || undefined,
      expiresAt: Number.isFinite(clip.expires_at) ? clip.expires_at : null,
      expirePreset: clip.expire_preset || null,
    }));
  } catch (e) {
    console.error(`Failed to fetch clips page (offset=${offset}, limit=${limit}):`, e);
    return [];
  }
},

/**
 * Get total notes count for the user (for pagination)
 * @returns {Promise<number>}
 */
async getNotesCount() {
  if (!this.client) return 0;
  
  try {
    const userId = await this.getSyncUserId();
    if (!userId) return 0;
    
    const { count, error } = await this.client
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null);
    
    if (error) throw error;
    return count || 0;
  } catch (e) {
    console.error('Failed to get notes count:', e);
    return 0;
  }
},

/**
 * Fetch a single page of notes for lazy loading
 * @param {number} offset - Starting index (0-based)
 * @param {number} limit - Number of notes to fetch
 * @returns {Promise<Array>}
 */
async fetchNotesPage(offset, limit) {
  if (!this.client) return [];
  
  try {
    const userId = await this.getSyncUserId();
    if (!userId) return [];
    
    const end = offset + limit - 1;
    
    const { data, error } = await this.client
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .range(offset, end);
    
    if (error) throw error;
    
    // Transform DB format to local format
    return (data || []).map(note => ({
      id: note.note_id,
      type: note.note_type || 'note',
      title: note.title || '',
      description: note.description || '',
      body: note.body || '',
      clips: note.attachments?.filter(a => a.type === 'clip') || [],
      images: note.attachments?.filter(a => a.type === 'image') || [],
      urls: note.attachments?.filter(a => a.type === 'url') || [],
      noteRefs: note.note_refs || [],
      createdAt: note.created_at ? Date.parse(note.created_at) : Date.now(),
      updatedAt: note.updated_at ? Date.parse(note.updated_at) : Date.now(),
      deviceId: note.device_id || null
    }));
  } catch (e) {
    console.error(`Failed to fetch notes page (offset=${offset}, limit=${limit}):`, e);
    return [];
  }
},

/**
 * Get total archived clips count for the user (for pagination)
 * @returns {Promise<number>}
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
 * @param {number} offset - Starting index (0-based)
 * @param {number} limit - Number of archived clips to fetch
 * @returns {Promise<Array>}
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
    
    // Transform DB format to local format
    return (data || []).map(clip => ({
      id: clip.clip_id,
      text: clip.text,
      title: clip.title || '',
      category: clip.category,
      timestamp: clip.timestamp,
      updatedAt: clip.updated_at ? Date.parse(clip.updated_at) : clip.timestamp,
      deviceId: clip.device_id || null,
      meta: clip.meta || undefined,
      expiresAt: Number.isFinite(clip.expires_at) ? clip.expires_at : null,
      expirePreset: clip.expire_preset || null,
    }));
  } catch (e) {
    console.error(`Failed to fetch archived clips page (offset=${offset}, limit=${limit}):`, e);
    return [];
  }
},

/**
 * Check if user is authenticated (has valid session)
 * @returns {boolean}
 */
isAuthenticated() {
  return !!(this.client && this._currentSession);
},

/**
 * Merge local and remote clips (newest wins)
 */
async mergeClips(localClips, remoteClips) {
  const contentMerged = new Map();
  const deletedById = new Map();

  remoteClips.forEach(clip => {
    const id = clip?.id != null ? String(clip.id) : '';
    if (!id || !clip?.deletedAt) return;
    deletedById.set(id, clip.deletedAt);
  });

  // Honor local tombstones so remote stale-alive rows cannot resurrect.
  try {
    const local = await new Promise((resolve) => {
      chrome.storage.local.get(['pc_deleted_clips'], (res) => resolve(res || {}));
    });
    const localTombs = Array.isArray(local?.pc_deleted_clips) ? local.pc_deleted_clips : [];
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
    const bucket = Math.floor(ts / 3000); // 3s bucket to collapse accidental dupes
    const cat = clip.category != null ? String(clip.category) : '';
    return `${hashText(text)}:${bucket}:${cat}`;
  };

  const add = (clip) => {
    if (!clip || !clip.text) return;
    const id = clip?.id != null ? String(clip.id) : '';
    const deletedAt = id ? deletedById.get(id) : null;
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
},

/**
 * Merge local and remote categories (newest wins by ID).
 * Honors both remote tombstones (deleted_at) AND local pc_deleted_categories
 * so a stale remote alive-row cannot resurrect a category the user just deleted here.
 */
async mergeCategories(localCategories, remoteCategories) {
  const merged = new Map();
  const deletedById = new Map();
  const normalizeName = (name) => String(name || '').trim().toLowerCase();

  remoteCategories.forEach(cat => {
    const id = cat?.id != null ? String(cat.id) : '';
    if (!id || !cat?.deletedAt) return;
    deletedById.set(id, cat.deletedAt);
  });

  // Also pull local tombstones (written by deleteCategory/appendDeletedItems).
  try {
    const local = await new Promise((resolve) => {
      chrome.storage.local.get(['pc_deleted_categories'], (res) => resolve(res || {}));
    });
    const localTombs = Array.isArray(local?.pc_deleted_categories) ? local.pc_deleted_categories : [];
    localTombs.forEach((t) => {
      const id = t?.id != null ? String(t.id) : '';
      if (!id) return;
      const when = Number.isFinite(t?.deletedAt) ? t.deletedAt : Date.now();
      const prev = deletedById.get(id) || 0;
      if (when > prev) deletedById.set(id, when);
    });
  } catch (_) { /* non-fatal */ }

  const shouldDrop = (cat) => {
    if (!cat) return true;
    const id = cat?.id != null ? String(cat.id) : '';
    const deletedAt = id ? deletedById.get(id) : null;
    const updatedAt = Number.isFinite(cat?.updatedAt) ? cat.updatedAt : 0;
    return deletedAt && deletedAt >= updatedAt;
  };

  // Add all local categories
  localCategories.forEach(cat => {
    if (!shouldDrop(cat)) {
      merged.set(cat.id, cat);
    }
  });

  // Add/update with remote categories (newer ID wins - later creation)
  remoteCategories.forEach(remoteCat => {
    if (shouldDrop(remoteCat)) {
      merged.delete(remoteCat.id);
      return;
    }
    const localCat = merged.get(remoteCat.id);
    if (!localCat) {
      // New category from remote, add it
      merged.set(remoteCat.id, remoteCat);
      return;
    }
    const localUpdatedAt = Number.isFinite(localCat?.updatedAt) ? localCat.updatedAt : 0;
    const remoteUpdatedAt = Number.isFinite(remoteCat?.updatedAt) ? remoteCat.updatedAt : 0;
    if (remoteUpdatedAt >= localUpdatedAt) {
      merged.set(remoteCat.id, remoteCat);
    }
  });

  const dedupedByName = new Map();
  Array.from(merged.values()).forEach((cat) => {
    const key = normalizeName(cat?.name);
    if (!key) return;
    const prev = dedupedByName.get(key);
    const catUpdatedAt = Number.isFinite(cat?.updatedAt) ? cat.updatedAt : 0;
    const prevUpdatedAt = Number.isFinite(prev?.updatedAt) ? prev.updatedAt : 0;
    if (!prev || catUpdatedAt >= prevUpdatedAt) {
      dedupedByName.set(key, cat);
    }
  });

  // Sort by name for consistent display
  return Array.from(dedupedByName.values()).sort((a, b) => a.name.localeCompare(b.name));
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

  // Sort by timestamp descending, then limit to 1000 most recent
  const sortedClips = Array.from(contentMerged.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  return sortedClips.slice(0, 1000); // Keep only 1000 most recent locally
}

// =====================================================
};
