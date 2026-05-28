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
    const hasAccess = await this.hasCloudSyncAccess(userId);
    if (!hasAccess) {
      console.log('ℹ️ Cloud sync not available for free tier. Archived clips stay local only.');
      return true;
    }
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
}

// =====================================================
};
