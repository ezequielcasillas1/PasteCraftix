/** Vertical slice: full-sync.js */
export const fullSyncMixin = {
// FULL SYNC METHOD (Call on startup)
// =====================================================

/**
 * Perform full bidirectional sync on extension startup
 */
async performFullSync() {
  if (!this.client) {
    console.warn('⚠️ Supabase not initialized - skipping full sync');
    return {
      success: false,
      message: 'Supabase not configured'
    };
  }
  if (this._fullSyncPromise) {
    return await this._fullSyncPromise;
  }

  this._isFullSyncRunning = true;
  this._fullSyncPromise = (async () => {
    try {
    if (!(await this.hasActiveAuthSession())) {
      console.warn('⚠️ Skipping full sync: no active Supabase session (sign in again)');
      return {
        success: false,
        message: 'Not authenticated'
      };
    }

    const userId = await this.getSyncUserId();
    
    // Check cloud sync access (FREE tier = local only)
    const hasAccess = await this.hasCloudSyncAccess(userId);
    if (!hasAccess) {
      console.log('ℹ️ Cloud sync not available for free tier. Using local storage only.');
      return {
        success: false,
        message: 'Cloud sync requires Basic or Enhanced subscription'
      };
    }
    
    console.log('🔄 Starting full bidirectional sync...');

    // Get local data from Chrome storage
    const localData = await new Promise((resolve) => {
      chrome.storage.local.get([
        'clips',
        'categories',
        'searchOnlyClips',
        'notes',
        'settings',
        'userProfile',
        'pc_aiHistory_v1',
        'pc_deleted_clips',
        'pc_deleted_archived_clips',
        'pc_deleted_categories',
        'pc_deleted_notes',
        'pc_local_updatedAt'
      ], resolve);
    });

    const localClips = localData.clips || [];
    const localCategories = localData.categories || [];
    const localArchivedClips = localData.searchOnlyClips || [];
    const localNotes = localData.notes || [];
    const localSettings = localData.settings || {};
    const localProfile = localData.userProfile || {};
    const localAiHistory = localData.pc_aiHistory_v1 || [];
    const deletedClips = localData.pc_deleted_clips || [];
    const deletedArchivedClips = localData.pc_deleted_archived_clips || [];
    const deletedCategories = localData.pc_deleted_categories || [];
    const deletedNotes = localData.pc_deleted_notes || [];
    const snapshotLocalUpdatedAt = Number.isFinite(localData.pc_local_updatedAt) ? localData.pc_local_updatedAt : Date.now();
    const hasNewerLocalWrites = async () => {
      try {
        const latest = await chrome.storage.local.get(['pc_local_updatedAt']);
        const latestUpdatedAt = Number.isFinite(latest?.pc_local_updatedAt) ? latest.pc_local_updatedAt : 0;
        return latestUpdatedAt > snapshotLocalUpdatedAt;
      } catch (_) {
        return false;
      }
    };
    const pendingQueueCount = Array.isArray(this.syncQueue) ? this.syncQueue.length : 0;
    console.log(`📥 Startup sync running in read-mostly mode (${pendingQueueCount} queued local operation${pendingQueueCount === 1 ? '' : 's'})`);

    // Read-mostly startup sync:
    // Local changes should travel through the queue/delta path. Re-uploading
    // whole local tables on every popup open is what has been timing out.
    const remoteClips = await this.syncClipsFromSupabase();
    if (remoteClips) {
      const mergedClips = await this.mergeClips(localClips, remoteClips);
      if (await hasNewerLocalWrites()) {
        console.warn('⏭️ Skipping clips merge write - newer local changes detected during full sync');
      } else {
        const clipsSaved = await this._safeStorageSet({ clips: mergedClips });
        if (clipsSaved) {
          console.log(`✅ Clips merged: ${mergedClips.length} total`);
        } else {
          console.warn('⏭️ Clips merge not persisted — storage save failed');
        }
      }
    }

    const remoteCategories = await this.syncCategoriesFromSupabase();
    if (remoteCategories) {
      const mergedCategories = await this.mergeCategories(localCategories, remoteCategories);
      if (await hasNewerLocalWrites()) {
        console.warn('⏭️ Skipping categories merge write - newer local changes detected during full sync');
      } else {
        await this._safeStorageSet({ categories: mergedCategories });
        console.log(`✅ Categories merged: ${mergedCategories.length} total`);
      }
    }

    const remoteArchivedClips = await this.syncArchivedClipsFromSupabase();
    if (remoteArchivedClips) {
      const mergedArchivedClips = await this.mergeArchivedClips(localArchivedClips, remoteArchivedClips);
      if (await hasNewerLocalWrites()) {
        console.warn('⏭️ Skipping archived clips merge write - newer local changes detected during full sync');
      } else {
        await this._safeStorageSet({ searchOnlyClips: mergedArchivedClips });
        console.log(`✅ Archived clips merged: ${mergedArchivedClips.length} total (limited to 1000 locally)`);
      }
    }

    const remoteNotes = await this.syncNotesFromSupabase();
    if (remoteNotes) {
      const mergedNotes = await this.mergeNotes(localNotes, remoteNotes);
      if (await hasNewerLocalWrites()) {
        console.warn('⏭️ Skipping notes merge write - newer local changes detected during full sync');
      } else {
        await this._safeStorageSet({ notes: mergedNotes });
        console.log(`✅ Notes merged: ${mergedNotes.length} total`);
      }
    }

    const remoteAiHistory = await this.fetchAiHistoryFromSupabase();
    if (remoteAiHistory && remoteAiHistory.length > 0) {
      const mergedAiHistory = this.mergeAiHistory(localAiHistory, remoteAiHistory);
      if (await hasNewerLocalWrites()) {
        console.warn('⏭️ Skipping AI history merge write - newer local changes detected during full sync');
      } else {
        await this._safeStorageSet({ pc_aiHistory_v1: mergedAiHistory });
        console.log(`✅ AI history merged: ${mergedAiHistory.length} total`);
      }
    }

    const remoteSettings = await this.syncSettingsFromSupabase();
    if (remoteSettings) {
      if (await hasNewerLocalWrites()) {
        console.warn('⏭️ Skipping settings merge write - newer local changes detected during full sync');
      } else {
        await new Promise((resolve) => {
          chrome.storage.local.set({ settings: remoteSettings }, resolve);
        });
        console.log('✅ Settings updated');
      }
    }

    const remoteProfile = await this.syncUserProfileFromSupabase();
    if (remoteProfile) {
      const pickUrl = (localUrl, remoteUrl) => {
        const l = typeof localUrl === 'string' ? localUrl : '';
        const r = typeof remoteUrl === 'string' ? remoteUrl : '';
        if (!l && !r) return '';
        const supaHost = this._pcGetSupabaseHost();
        const isSupa = (x) => {
          const o = this._pcTryParseUrl(x);
          return !!(o && supaHost && o.hostname === supaHost);
        };
        const isTemp = (x) => {
          const o = this._pcTryParseUrl(x);
          if (!o) return false;
          const az = o.hostname.includes('blob.core.windows.net');
          const hasSig = o.searchParams.has('sig');
          return az || hasSig || this._pcIsExpiredSas(x);
        };
        if (isSupa(r)) return r;
        if (isSupa(l)) return l;
        if (l && isTemp(r)) return l;
        return r || l;
      };

      const mergedProfile = {
        ...localProfile,
        ...remoteProfile,
        profileImageUrl: pickUrl(localProfile?.profileImageUrl, remoteProfile?.profileImageUrl),
        profileImageBase64: (remoteProfile?.profileImageBase64 ? remoteProfile.profileImageBase64 : (localProfile?.profileImageBase64 || null))
      };
      if (await hasNewerLocalWrites()) {
        console.warn('⏭️ Skipping profile merge write - newer local changes detected during full sync');
      } else {
        await new Promise((resolve) => {
          chrome.storage.local.set({ userProfile: mergedProfile }, resolve);
        });
        console.log('✅ User profile updated');
      }
    }

      console.log('✅ Full sync complete!');
      return {
        success: true,
        message: 'All data synced successfully',
        stats: {
          clips: remoteClips?.length || 0,
          categories: remoteCategories?.length || 0,
          archivedClips: remoteArchivedClips?.length || 0,
          notes: remoteNotes?.length || 0,
          aiHistory: remoteAiHistory?.length || 0
        }
      };

    } catch (error) {
      console.error('❌ Full sync failed:', error);
      return {
        success: false,
        message: error.message
      };
    } finally {
      this._isFullSyncRunning = false;
      this._fullSyncPromise = null;
      if (this.isOnline && this.syncQueue.length > 0 && !this._pauseSync) {
        Promise.resolve().then(() => this.processSyncQueue()).catch(() => {});
      }
    }
  })();

  return await this._fullSyncPromise;
}
};
