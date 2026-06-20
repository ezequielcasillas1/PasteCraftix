/** Vertical slice: full-sync.js */
import { mergeFreshLocalForFullSync } from '../shared/full-sync-guard.js';
import { mergeUserProfileLocalRemote } from '../shared/profile-merge.js';

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
        'autoDeletePeriod',
        'quickPasteSettings',
        'albumAttachmentOpenMode',
        'theme',
        'settingsUpdatedAt',
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
    const localProfile = localData.userProfile || {};
    const localSettingsUpdatedAt = typeof localData.settingsUpdatedAt === 'number' ? localData.settingsUpdatedAt : 0;
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

    let localWritesApplied = false;

    const applyFullSyncMergeWrite = async ({
      storageKey,
      fallbackLocal,
      remoteData,
      mergeFn,
      label,
      countMerged = (merged) => (Array.isArray(merged) ? merged.length : null),
    }) => {
      const result = await mergeFreshLocalForFullSync({
        storageKey,
        fallbackLocal,
        remoteData,
        mergeFn,
        hasNewerLocalWrites,
      });

      if (result.skipped) {
        if (result.reason === 'newer-local-before-merge' || result.reason === 'newer-local-after-merge') {
          console.warn(`⏭️ Skipping ${label} merge write - newer local changes detected during full sync`);
        }
        return false;
      }

      const changed = await this._safeStorageSet(result.payload);
      if (changed) {
        const count = countMerged(result.merged);
        console.log(
          count == null
            ? `✅ ${label} updated`
            : `✅ ${label} merged: ${count} total`,
        );
      }
      return changed;
    };

    // Read-mostly startup sync:
    // Local changes should travel through the queue/delta path. Re-uploading
    // whole local tables on every popup open is what has been timing out.
    const remoteClips = await this.syncClipsFromSupabase();
    if (remoteClips) {
      const clipsChanged = await applyFullSyncMergeWrite({
        storageKey: 'clips',
        fallbackLocal: localClips,
        remoteData: remoteClips,
        mergeFn: (local, remote) => this.mergeClips(local, remote),
        label: 'Clips',
      });
      localWritesApplied = localWritesApplied || clipsChanged;
    }

    const remoteCategories = await this.syncCategoriesFromSupabase();
    if (remoteCategories) {
      const categoriesChanged = await applyFullSyncMergeWrite({
        storageKey: 'categories',
        fallbackLocal: localCategories,
        remoteData: remoteCategories,
        mergeFn: (local, remote) => this.mergeCategories(local, remote),
        label: 'Categories',
      });
      localWritesApplied = localWritesApplied || categoriesChanged;
    }

    const remoteArchivedClips = await this.syncArchivedClipsFromSupabase();
    if (remoteArchivedClips) {
      const archivedClipsChanged = await applyFullSyncMergeWrite({
        storageKey: 'searchOnlyClips',
        fallbackLocal: localArchivedClips,
        remoteData: remoteArchivedClips,
        mergeFn: (local, remote) => this.mergeArchivedClips(local, remote),
        label: 'Archived clips',
      });
      localWritesApplied = localWritesApplied || archivedClipsChanged;
    }

    const remoteNotes = await this.syncNotesFromSupabase();
    if (remoteNotes) {
      const notesChanged = await applyFullSyncMergeWrite({
        storageKey: 'notes',
        fallbackLocal: localNotes,
        remoteData: remoteNotes,
        mergeFn: (local, remote) => this.mergeNotes(local, remote),
        label: 'Notes',
      });
      localWritesApplied = localWritesApplied || notesChanged;
    }

    const remoteAiHistory = await this.fetchAiHistoryFromSupabase();
    if (remoteAiHistory && remoteAiHistory.length > 0) {
      const aiHistoryChanged = await applyFullSyncMergeWrite({
        storageKey: 'pc_aiHistory_v1',
        fallbackLocal: localAiHistory,
        remoteData: remoteAiHistory,
        mergeFn: (local, remote) => this.mergeAiHistory(local, remote),
        label: 'AI history',
      });
      localWritesApplied = localWritesApplied || aiHistoryChanged;
    }

    const remoteSettings = await this.syncSettingsFromSupabase();
    if (remoteSettings) {
      let latestLocalSettingsUpdatedAt = localSettingsUpdatedAt;
      try {
        const latest = await chrome.storage.local.get(['settingsUpdatedAt']);
        latestLocalSettingsUpdatedAt = typeof latest?.settingsUpdatedAt === 'number' ? latest.settingsUpdatedAt : 0;
      } catch (_) {}

      const remoteSettingsUpdatedAt = typeof remoteSettings.settingsUpdatedAt === 'number'
        ? remoteSettings.settingsUpdatedAt
        : 0;
      if (latestLocalSettingsUpdatedAt > remoteSettingsUpdatedAt) {
        console.debug('⏭️ Keeping local settings (newer than cloud during full sync)');
      } else {
        const settingsPayload = this.toSettingsStoragePayload(remoteSettings);
        const settingsChanged = settingsPayload
          ? await this._safeStorageSet(settingsPayload)
          : false;
        localWritesApplied = localWritesApplied || settingsChanged;
        if (settingsChanged) {
          console.log('✅ Settings updated');
        }
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

      const profileChanged = await applyFullSyncMergeWrite({
        storageKey: 'userProfile',
        fallbackLocal: localProfile,
        remoteData: remoteProfile,
        mergeFn: (local, remote) => mergeUserProfileLocalRemote(local, remote, pickUrl),
        label: 'User profile',
        countMerged: () => null,
      });
      localWritesApplied = localWritesApplied || profileChanged;
    }

      console.log('✅ Full sync complete!');
      return {
        success: true,
        message: 'All data synced successfully',
        localWritesApplied,
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
