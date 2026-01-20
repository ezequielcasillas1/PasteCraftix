// PasteCraft Advanced Popup Script
// (startup logging removed)

class PasteCraftPopup {
  constructor() {
    console.log('🟢 PasteCraftPopup constructor called');
    this.clips = [];
    this.categories = [];
    this.selectedChips = new Set();
    this.selectedPickerClips = new Set();
    this.delimiter = 'comma';
    this.currentTab = 'clips';
    this.searchQuery = '';
    this.selectedCategory = '';
    this.selectedDateFilter = '';
    this.pendingText = null;
    this.selectedCategoryForSave = 'Uncategorized';
    this.autoDeletePeriod = 'never';
    this.searchOnlyClips = [];
    this.selectedCategoryClips = new Set();
    this.selectedSearchClips = new Set();
    this.categoryUiOrderSelectedIds = [];

    // Crafted Output (preview) editability
    this.previewIsManual = false;
    this.previewLastAutoValue = '';
    this.options = {
      deduplicate: false,
      sort: false,
      uppercase: false
    };
    this.userProfile = null;
    
    // Pagination system
    this.currentPage = 0;
    this.clipsPerPage = 10;
    this.maxPages = 50;
    this.maxClips = this.clipsPerPage * this.maxPages; // 500 clips total
    
    // Breakdown text cache
    this.currentBreakdownText = null;
    this.currentBreakdownLevel = null;
    this.breakdownCache = {};
    
    // Summary state
    this.currentSummaryText = null;
    this.generatedQuestions = [];
    this.currentSummaryQuestion = null;
    
    // Thread conversation state
    this.summaryThreads = [];
    this.breakdownThreads = [];
    this.currentSummaryThreadIndex = 0;
    this.currentBreakdownThreadIndex = 0;
    this.selectedFollowupLevel = null;
    
    // Countdown timers
    this.aiGenerationTimerInterval = null;
    this.profileCollapseInterval = null;
    this.nameCollapseInterval = null;
    
    // Analysis history
    this.analysisHistory = [];
    
    // Notes system
    this.notes = [];
    this.currentNoteId = null;
    this.currentNoteType = 'note';
    this.currentNoteAttachments = [];
    this.pendingClipForNotes = null;
    this.pendingNoteForAlbum = null;
    this.currentViewerNoteId = null;
    this.currentAlbumAttachmentContext = null;
    this.noteViewerParentAlbumId = null;
    this.notesViewMode = 'notes'; // 'notes' | 'albums'
    this.notesPageIndex = 0; // starts at 0
    this.notesAiEnabled = false;
    this.albumAttachmentOpenMode = 'overlay'; // 'edgePopup' | 'overlay'

    // (debug instrumentation removed)
    
    this.init();
  }
  
  async init() {
    console.log('🚀 Initializing PasteCraft popup...');
    
    // Setup auth modal events FIRST (before checking auth)
    this.setupAuthModalEvents();
    
    // Check if this is a password reset callback from storage
    const resetCallback = await this.checkPasswordResetCallback();
    if (resetCallback) {
      console.log('🔑 Password reset callback detected from storage');
      // Show new password modal
      this.hideLoadingOverlay();
      document.getElementById('newPasswordModal').style.display = 'flex';
      return;
    }
    
    // Check if this is a password reset callback from URL
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    console.log('🔍 URL check:', {
      search: window.location.search,
      hash: window.location.hash,
      type: hashParams.get('type'),
      accessToken: hashParams.get('access_token') ? 'present' : 'missing'
    });
    
    if (urlParams.get('reset') === 'true' || hashParams.get('type') === 'recovery') {
      console.log('🔑 Password reset callback detected from URL');
      
      // If tokens are in URL hash, set the session
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      if (accessToken) {
        await this.setPasswordResetSession(accessToken, refreshToken);
      }
      
      // Show new password modal
      this.hideLoadingOverlay();
      document.getElementById('newPasswordModal').style.display = 'flex';
      return;
    }
    
    // Check for OAuth callback tokens
    await this.checkOAuthCallback();
    
    // Check if user is authenticated
    const currentUser = await pasteCraftSupabase.getCurrentUser();
    
    if (!currentUser) {
      // Show auth modal
      this.showAuthModal();
      return;
    }
    
    // User is authenticated, proceed with normal init
    console.log('✅ User authenticated:', currentUser.email);
    this.currentUser = currentUser;
    
    // Load subscription info
    // Do NOT block popup UI on slow network subscription fetch.
    // Use cached subscription if available, then refresh in background.
    try {
      this.userSubscription = await pasteCraftSupabase.getCachedSubscription(currentUser.id);
    } catch (_) {
      this.userSubscription = null;
    }
    console.log('💎 Subscription tier (cached):', this.userSubscription?.subscription_tier);

    pasteCraftSupabase.getUserSubscription(currentUser.id).then((sub) => {
      this.userSubscription = sub;
      console.log('💎 Subscription tier (fresh):', this.userSubscription?.subscription_tier);
    }).catch(() => {});
    
    // Show top bar (with sign out button)
    document.getElementById('topBar').style.display = 'flex';
    
    // Cross-device transfer (browser sync): restore from chrome.storage.sync if local is empty,
    // and/or back up local into sync to enable transfer to a new machine.
    await this.bootstrapStorageSyncTransfer();
    this.setupStorageSyncListener();

    await this.loadData();
    await this.loadSettings();
    await this.loadUserProfile();
    await this.loadAnalysisHistory();

    // Always update top bar name/image (even if no image saved yet)
    this.updateTopBarIdentity();
    
    // ✅ DISPLAY SAVED PROFILE IMAGE
    console.log('🔍 Checking for saved profile image...');
    if (this.userProfile?.profileImageUrl) {
      console.log('✅ Saved profile image found, displaying in top-left...');
      this.displayImageTopLeft(this.userProfile.profileImageUrl);
    } else {
      console.log('ℹ️ No saved profile image found');
    }
    
    await this.cleanupOldClips();
    this.setupEventListeners();
    this.renderChips();
    this.updateLastCapture();
    this.updatePreview();
    this.renderCategories();
    this.updateCategoryFilter();
    
    // 🎯 HIDE LOADING OVERLAY (local data loaded, ready to show)
    this.hideLoadingOverlay();
    
    // 🔄 SYNC WITH SUPABASE IN BACKGROUND (don't await - let it happen naturally)
    this.performBackgroundSync();
    
    // Reload data whenever popup becomes visible
    this.setupVisibilityListener();
    
    // Setup realtime data sync listeners
    this.setupRealtimeListeners();
    
    // Setup sync status listeners
    this.setupSyncStatusListeners();
    
    console.log('✅ PasteCraft popup initialized successfully');
  }

  setupStorageSyncListener() {
    try {
      // Debounce repeated sync change events (and avoid re-entrancy loops)
      this._handlingSyncChange = false;
      this._lastSyncChangeAt = 0;

      chrome.storage.onChanged.addListener(async (changes, areaName) => {
        if (areaName !== 'sync') return;
        if (!changes || !changes.pc_sync_backup_v1) return;
        if (this._handlingSyncChange) return;
        const now = Date.now();
        if (now - this._lastSyncChangeAt < 750) return;
        this._lastSyncChangeAt = now;
        this._handlingSyncChange = true;

        const next = changes.pc_sync_backup_v1?.newValue || null;
        const nextClips = next && Array.isArray(next.clips) ? next.clips.length : 0;
        const nextNotes = next && Array.isArray(next.notes) ? next.notes.length : 0;
        const nextUpdatedAt = next && typeof next.updatedAt === 'number' ? next.updatedAt : 0;


        try {
          await this.bootstrapStorageSyncTransfer();
          await this.loadData();
          await this.loadNotes();
          this.renderChips();
          this.renderCategories();
          this.renderNotes();
          this.updateCategoryFilter();
          this.updateLastCapture();
          this.updatePreview();
        } finally {
          this._handlingSyncChange = false;
        }
      });
    } catch (_) {
      // ignore
    }
  }

  async bootstrapStorageSyncTransfer() {
    try {
      const local = await chrome.storage.local.get([
        'clips',
        'categories',
        'searchOnlyClips',
        'notes',
        'pc_local_updatedAt',
        'notesViewMode',
        'notesPageIndex',
        'notesAiEnabled',
        'settings',
        'userProfile'
      ]);

      // Repair duplicate / missing clip ids in local storage BEFORE any syncing/backup.
      // This prevents clip rows overwriting each other in Supabase and collapsing during merge.
      const repaired = this.repairLocalClipIds(local.clips, local.searchOnlyClips);
      if (repaired.changed) {
        await chrome.storage.local.set({
          clips: repaired.clips,
          searchOnlyClips: repaired.searchOnlyClips
        });
        local.clips = repaired.clips;
        local.searchOnlyClips = repaired.searchOnlyClips;
      }

      const sync = await new Promise((resolve) => chrome.storage.sync.get(['pc_sync_backup_v1'], resolve));
      const backup = sync?.pc_sync_backup_v1 || null;

      const localClipsCount = Array.isArray(local.clips) ? local.clips.length : 0;
      const localNotesCount = Array.isArray(local.notes) ? local.notes.length : 0;

      const backupClipsCount = backup && Array.isArray(backup.clips) ? backup.clips.length : 0;
      const backupNotesCount = backup && Array.isArray(backup.notes) ? backup.notes.length : 0;

      const backupUpdatedAt = backup && typeof backup.updatedAt === 'number' ? backup.updatedAt : 0;
      let localUpdatedAt = typeof local.pc_local_updatedAt === 'number' ? local.pc_local_updatedAt : 0;

      const localHasAny = localClipsCount > 0 || localNotesCount > 0;
      const backupHasAny = backupClipsCount > 0 || backupNotesCount > 0;

      // If local already has data but no updated marker yet, initialize it so we don't
      // incorrectly restore an older sync backup over existing local state.
      let localUpdatedAtInitialized = false;
      if (localHasAny && localUpdatedAt === 0) {
        localUpdatedAt = Date.now();
        localUpdatedAtInitialized = true;
        try {
          await chrome.storage.local.set({ pc_local_updatedAt: localUpdatedAt });
          local.pc_local_updatedAt = localUpdatedAt;
        } catch (_) {
          // ignore
        }
      }

      // Merge helper (works for clips, archived clips, categories, notes)
      const stableKey = (item) => {
        if (!item) return '';
        if (typeof item === 'string') return `s:${item.slice(0, 80)}`;
        // Prefer content-based key for clip-like objects to avoid duplicates across sources with different ids.
        if (typeof item.text === 'string' && typeof item.timestamp === 'number') {
          const s = item.text;
          let h = 2166136261;
          for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
          const textHash = (h >>> 0).toString(36);
          const bucket = Math.floor(item.timestamp / 3000); // 3s bucket to collapse accidental dupes
          const cat = item.category != null ? String(item.category) : '';
          return `clip:${textHash}:${bucket}:${cat}`;
        }
        const id = item.id ?? item.clip_id ?? item.clipId ?? item.category_id ?? item.categoryId ?? null;
        if (id != null) return `id:${String(id)}`;
        const t = item.text ?? item.url ?? item.name ?? '';
        const ts = item.timestamp ?? item.createdAt ?? item.updatedAt ?? 0;
        return `h:${String(t).slice(0, 80)}:${ts}`;
      };

      const mergeArrays = (a, b) => {
        const out = new Map();
        const add = (x) => {
          const k = stableKey(x);
          if (!k) return;
          const prev = out.get(k);
          const ts = (x && typeof x === 'object') ? (x.timestamp ?? x.updatedAt ?? x.createdAt ?? 0) : 0;
          const prevTs = (prev && typeof prev === 'object') ? (prev.timestamp ?? prev.updatedAt ?? prev.createdAt ?? 0) : 0;
          if (!prev || (ts || 0) >= (prevTs || 0)) out.set(k, x);
        };
        (Array.isArray(a) ? a : []).forEach(add);
        (Array.isArray(b) ? b : []).forEach(add);
        return Array.from(out.values());
      };

      const mergedClips = mergeArrays(local.clips, backup?.clips).slice(0, 500);
      const mergedSearchOnlyClips = mergeArrays(local.searchOnlyClips, backup?.searchOnlyClips).slice(0, 1000);
      const mergedCategories = mergeArrays(local.categories, backup?.categories).slice(0, 300);
      const mergedNotes = mergeArrays(local.notes, backup?.notes).slice(0, 300);

      // Prefer newest side by updatedAt, falling back to count-based heuristics when missing.
      // This prevents deleted clips from being restored from an older sync backup.
      const preferLocal = localHasAny && localUpdatedAt > 0 && (backupUpdatedAt === 0 || localUpdatedAt >= backupUpdatedAt);
      const preferBackup = backupHasAny && backupUpdatedAt > 0 && (localUpdatedAt === 0 || backupUpdatedAt > localUpdatedAt);

      // Decide which direction to sync.
      const shouldWriteLocal =
        preferBackup ||
        (
          !preferLocal &&
          backupHasAny && (
            backupClipsCount > localClipsCount ||
            backupNotesCount > localNotesCount
          )
        );

      const shouldWriteSync =
        preferLocal ||
        (
          !preferBackup &&
          localHasAny && (
            !backupHasAny ||
            localClipsCount > backupClipsCount ||
            localNotesCount > backupNotesCount
          )
        );

      // When we prefer one side by updatedAt, do not merge in the other side (merging would resurrect deleted clips).
      const nextLocalClips = preferBackup ? (Array.isArray(backup?.clips) ? backup.clips : []) : mergedClips;
      const nextLocalArchived = preferBackup ? (Array.isArray(backup?.searchOnlyClips) ? backup.searchOnlyClips : []) : mergedSearchOnlyClips;
      const nextLocalCategories = preferBackup ? (Array.isArray(backup?.categories) ? backup.categories : []) : mergedCategories;
      const nextLocalNotes = preferBackup ? (Array.isArray(backup?.notes) ? backup.notes : []) : mergedNotes;

      const nextSyncClips = preferLocal ? (Array.isArray(local.clips) ? local.clips : []) : mergedClips;
      const nextSyncArchived = preferLocal ? (Array.isArray(local.searchOnlyClips) ? local.searchOnlyClips : []) : mergedSearchOnlyClips;
      const nextSyncCategories = preferLocal ? (Array.isArray(local.categories) ? local.categories : []) : mergedCategories;
      const nextSyncNotes = preferLocal ? (Array.isArray(local.notes) ? local.notes : []) : mergedNotes;

      const willWriteLocal = shouldWriteLocal && (nextLocalClips.length !== localClipsCount || nextLocalNotes.length !== localNotesCount);
      const willWriteSync = shouldWriteSync && (nextSyncClips.length !== backupClipsCount || nextSyncNotes.length !== backupNotesCount);

      if (willWriteLocal) {
        await chrome.storage.local.set({
          clips: nextLocalClips.slice(0, 500),
          categories: nextLocalCategories.slice(0, 300),
          searchOnlyClips: nextLocalArchived.slice(0, 1000),
          notes: nextLocalNotes.slice(0, 300),
          notesViewMode: backup?.notesViewMode || local.notesViewMode || 'notes',
          notesPageIndex: typeof (backup?.notesPageIndex) === 'number' ? backup.notesPageIndex : (typeof local.notesPageIndex === 'number' ? local.notesPageIndex : 0),
          notesAiEnabled: backup ? !!backup.notesAiEnabled : !!local.notesAiEnabled,
          settings: backup?.settings || local.settings || {},
          userProfile: backup?.userProfile || local.userProfile || null
        });
      }

      if (willWriteSync) {
        const payload = {
          version: 1,
          updatedAt: Date.now(),
          clips: nextSyncClips.slice(0, 500),
          categories: nextSyncCategories.slice(0, 300),
          searchOnlyClips: nextSyncArchived.slice(0, 1000),
          notes: nextSyncNotes.slice(0, 300),
          notesViewMode: local.notesViewMode || backup?.notesViewMode || 'notes',
          notesPageIndex: typeof local.notesPageIndex === 'number' ? local.notesPageIndex : (typeof backup?.notesPageIndex === 'number' ? backup.notesPageIndex : 0),
          notesAiEnabled: !!local.notesAiEnabled,
          settings: local.settings || backup?.settings || {},
          userProfile: local.userProfile || backup?.userProfile || null
        };

        await new Promise((resolve) => chrome.storage.sync.set({ pc_sync_backup_v1: payload }, resolve));
      }
    } catch (e) {
      // Ignore sync failures (quota / sync disabled)
    }
  }

  async backupLocalToSync(reason = 'local-change') {
    try {
      const local = await chrome.storage.local.get([
        'clips',
        'categories',
        'searchOnlyClips',
        'notes',
        'notesViewMode',
        'notesPageIndex',
        'notesAiEnabled',
        'settings',
        'userProfile'
      ]);

      const payload = {
        version: 1,
        updatedAt: Date.now(),
        clips: Array.isArray(local.clips) ? local.clips : [],
        categories: Array.isArray(local.categories) ? local.categories : [],
        searchOnlyClips: Array.isArray(local.searchOnlyClips) ? local.searchOnlyClips : [],
        notes: Array.isArray(local.notes) ? local.notes : [],
        notesViewMode: local.notesViewMode || 'notes',
        notesPageIndex: typeof local.notesPageIndex === 'number' ? local.notesPageIndex : 0,
        notesAiEnabled: !!local.notesAiEnabled,
        settings: local.settings || {},
        userProfile: local.userProfile || null
      };

      // Persist local "last updated" marker so sync-transfer doesn't restore older backups over deletions.
      try {
        await chrome.storage.local.set({ pc_local_updatedAt: payload.updatedAt });
      } catch (_) {
        // ignore
      }

      let ok = true;
      try {
        await new Promise((resolve) => {
          chrome.storage.sync.set({ pc_sync_backup_v1: payload }, () => {
            if (chrome.runtime && chrome.runtime.lastError) ok = false;
            resolve();
          });
        });
      } catch (e) {
        ok = false;
      }

    } catch (_) {
      // ignore (quota / sync disabled)
    }
  }

  repairLocalClipIds(clipsRaw, searchOnlyRaw) {
    const normalize = (raw) => {
      const arr = Array.isArray(raw) ? raw : [];
      const seen = new Set();
      let changed = false;

      const hashText = (t) => {
        const s = String(t || '');
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        return (h >>> 0).toString(36);
      };

      const toObj = (clip, i) => {
        if (typeof clip === 'string') {
          changed = true;
          const ts = Date.now();
          return {
            id: `${ts}_${hashText(clip)}_${i}`,
            text: clip,
            category: 'Uncategorized',
            timestamp: ts
          };
        }
        if (clip && typeof clip === 'object') return { ...clip };
        changed = true;
        return null;
      };

      const out = [];
      for (let i = 0; i < arr.length; i++) {
        const c = toObj(arr[i], i);
        if (!c) continue;
        if (!c.text) { changed = true; continue; }

        const ts = typeof c.timestamp === 'number' ? c.timestamp : Date.now();
        if (typeof c.timestamp !== 'number') { c.timestamp = ts; changed = true; }

        let id = c.id ?? c.clip_id ?? c.clipId ?? null;
        if (id == null) {
          id = `${ts}_${hashText(c.text)}_${i}`;
          c.id = id;
          changed = true;
        } else {
          if (c.id == null) { c.id = id; changed = true; }
        }

        const key = String(c.id);
        if (seen.has(key)) {
          // If duplicate id is actually the same clip content, drop it to prevent user-visible dupes.
          // Otherwise, mint a stable-ish new id.
          const contentKey = `${hashText(c.text)}:${Math.floor(ts / 3000)}:${String(c.category || 'Uncategorized')}`;
          const hasSameContentAlready = out.some(x => `${hashText(x.text)}:${Math.floor((x.timestamp || 0) / 3000)}:${String(x.category || 'Uncategorized')}` === contentKey);
          if (hasSameContentAlready) {
            changed = true;
            continue;
          }
          c.id = `${key}__r${ts}_${i}`;
          changed = true;
        }
        seen.add(String(c.id));
        out.push(c);
      }

      return { out, changed };
    };

    const active = normalize(clipsRaw);
    const archived = normalize(searchOnlyRaw);

    return {
      changed: !!(active.changed || archived.changed),
      activeChanged: !!active.changed,
      archivedChanged: !!archived.changed,
      clips: active.out,
      searchOnlyClips: archived.out
    };
  }
  
  async performBackgroundSync() {
    try {
      console.log('🔄 Starting background sync with Supabase...');
      const syncResult = await pasteCraftSupabase.performFullSync();
      
      if (syncResult.success) {
        console.log('✅ Background sync complete:', syncResult.stats);
        // Reload data after sync
        await this.loadData();
    this.renderChips();
    this.renderCategories();
    this.updateCategoryFilter();
    this.updateManualInputCategories();
        
        // 🔄 RELOAD USER PROFILE AFTER SYNC (fixes image disappearing after cache clear)
        await this.loadUserProfile();
        if (this.userProfile?.profileImageUrl) {
          console.log('✅ Profile image restored from Supabase after sync');
          this.displayImageTopLeft(this.userProfile.profileImageUrl);
        }
      } else {
        console.warn('⚠️ Background sync failed:', syncResult.message);
      }
    } catch (error) {
      console.error('❌ Background sync error:', error);
      // Don't block app - local data still works
    }
  }
  
  hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        overlay.style.display = 'none';
        console.log('✅ Loading overlay hidden');
      }, 300);
    }
  }
  
  setupVisibilityListener() {
    // Reload data when popup is shown
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 Popup became visible - reloading data...');
        await this.loadData();
        await this.loadUserProfile(); // Reload profile too
        this.renderChips();
        this.updateLastCapture();
        this.updatePreview();
        this.renderCategories();
        this.updateCategoryFilter();
        
        // Update profile image if available
        if (this.userProfile?.profileImageUrl) {
          this.displayImageTopLeft(this.userProfile.profileImageUrl);
        }
        console.log('✅ Data reloaded successfully');
      }
    });
  }
  
  setupSyncStatusListeners() {
    // Listen for sync status changes
    window.addEventListener('syncStatusChanged', (event) => {
      const { status, queueLength } = event.detail;
      this.updateSyncIndicator(status, queueLength);
    });
    
    // Listen for sync progress updates
    window.addEventListener('syncProgress', (event) => {
      const { current, total, percentage } = event.detail;
      this.updateSyncProgress(current, total, percentage);
    });
  }
  
  setupRealtimeListeners() {
    // Listen for realtime data changes
    window.addEventListener('dataChanged', async (event) => {
      const { type } = event.detail;
      console.log(`🔔 Realtime change detected: ${type}`);
      
      // Reload and re-render based on data type
      if (type === 'clips' || type === 'archivedClips') {
        await this.loadData();
        this.renderChips();
        this.updateLastCapture();
        this.renderSearchResults();
      } else if (type === 'categories') {
        await this.loadData();
        this.renderCategories();
        this.updateCategoryFilter();
      } else if (type === 'settings') {
        await this.loadSettings();
      } else if (type === 'profile') {
        await this.loadUserProfile();
        if (this.userProfile?.profileImageUrl) {
          this.displayImageTopLeft(this.userProfile.profileImageUrl);
        }
      }
    });
  }
  
  updateSyncIndicator(status, queueLength = 0) {
    const indicator = document.getElementById('syncIndicator');
    const statusText = document.getElementById('syncStatusText');
    const queueCount = document.getElementById('syncQueueCount');
    
    if (!indicator || !statusText) return;
    
    // Update indicator color and status text
    indicator.className = `sync-indicator ${status}`;
    
    const statusMessages = {
      'synced': '🟢 Synced',
      'syncing': '🟡 Syncing...',
      'offline': '🔴 Offline'
    };
    
    statusText.textContent = statusMessages[status] || status;
    
    // Show queue count if pending operations
    if (queueLength > 0 && queueCount) {
      queueCount.textContent = `${queueLength} pending`;
      queueCount.style.display = 'inline-block';
    } else if (queueCount) {
      queueCount.style.display = 'none';
    }
  }
  
  updateSyncProgress(current, total, percentage) {
    const progressContainer = document.getElementById('syncProgressContainer');
    const progressFill = document.getElementById('syncProgressFill');
    const progressText = document.getElementById('syncProgressText');
    
    if (!progressContainer || !progressFill || !progressText) return;
    
    // Show progress bar if syncing large dataset
    if (total > 100 && current < total) {
      progressContainer.style.display = 'block';
      progressFill.style.width = `${percentage}%`;
      progressText.textContent = `${current} / ${total} (${percentage}%)`;
    } else {
      // Hide progress bar when done
      progressContainer.style.display = 'none';
    }
  }
  
  async loadData() {
    const result = await chrome.storage.local.get(['clips', 'categories', 'searchOnlyClips']);
    
    const { clips = [], categories = [], searchOnlyClips = [] } = result;
    let normalizedChanged = false;

    const hashText = (t) => {
      const s = String(t || '');
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      return (h >>> 0).toString(36);
    };
    
    // Load active clips (max 20, shown in clips tab and quick paste)
    this.clips = clips.map(clip => {
      // Handle both old string format and new object format
      if (typeof clip === 'string') {
        normalizedChanged = true;
        const ts = Date.now();
        return {
          id: `${ts}_${hashText(clip)}`,
          text: clip,
          category: 'Uncategorized',
          timestamp: ts
        };
      } else {
        const text = clip?.text || clip;
        const ts = (typeof clip?.timestamp === 'number') ? clip.timestamp : Date.now();
        const id = clip?.id ?? clip?.clip_id ?? clip?.clipId ?? `${ts}_${hashText(text)}`;
        if (clip?.id == null || typeof clip?.timestamp !== 'number') normalizedChanged = true;
        return {
          id,
          text,
          category: clip?.category || 'Uncategorized',
          timestamp: ts,
          ...(clip && typeof clip === 'object' && clip.meta ? { meta: clip.meta } : {})
        };
      }
    });
    
    // Load search-only clips (archived clips, only shown in search)
    this.searchOnlyClips = searchOnlyClips.map(clip => {
      if (typeof clip === 'string') {
        normalizedChanged = true;
        const ts = Date.now();
        return {
          id: `${ts}_${hashText(clip)}`,
          text: clip,
          category: 'Uncategorized',
          timestamp: ts
        };
      } else {
        const text = clip?.text || clip;
        const ts = (typeof clip?.timestamp === 'number') ? clip.timestamp : Date.now();
        const id = clip?.id ?? clip?.clip_id ?? clip?.clipId ?? `${ts}_${hashText(text)}`;
        if (clip?.id == null || typeof clip?.timestamp !== 'number') normalizedChanged = true;
        return {
          id,
          text,
          category: clip?.category || 'Uncategorized',
          timestamp: ts,
          ...(clip && typeof clip === 'object' && clip.meta ? { meta: clip.meta } : {})
        };
      }
    });
    
    this.categories = categories;
    
    if (normalizedChanged) {
      await chrome.storage.local.set({
        clips: this.clips,
        searchOnlyClips: this.searchOnlyClips
      });
    }

    // Enforce pagination clip limit
    await this.enforceClipLimit();

  }
  
  async enforceClipLimit() {
    if (this.clips.length <= this.maxClips) {
      return;
    }
    
    console.log(`📦 Clip limit exceeded: ${this.clips.length}/${this.maxClips}. Moving oldest clips to search...`);
    
    // Sort clips by timestamp (newest first)
    this.clips.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    // Keep first 500 clips (newest), move rest to searchOnlyClips (oldest)
    const clipsToArchive = this.clips.slice(this.maxClips);
    this.clips = this.clips.slice(0, this.maxClips);
    
    // Add archived clips to searchOnlyClips
    this.searchOnlyClips = [...clipsToArchive, ...this.searchOnlyClips];
    
    // Save to storage
    await chrome.storage.local.set({
      clips: this.clips,
      searchOnlyClips: this.searchOnlyClips
    });
    
    console.log(`✅ Archived ${clipsToArchive.length} clips to search. Active: ${this.clips.length}, Archived: ${this.searchOnlyClips.length}`);
  }
  
  setupEventListeners() {
    // Tab navigation
    document.querySelector('.tab-nav').addEventListener('click', async (e) => {
      const target = e.target;
      const tabBtn = (target && target.closest)
        ? target.closest('.tab-btn')
        : (target && target.classList && target.classList.contains('tab-btn') ? target : null);

      if (tabBtn) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        tabBtn.classList.add('active');
        this.currentTab = tabBtn.dataset.tab;
        document.getElementById(this.currentTab + 'Tab').classList.add('active');
        
        // Format controls, preview, and magic wand are always visible across all tabs
        
        // Auto-reload data when switching tabs to ensure fresh counts
        if (this.currentTab === 'clips') {
          console.log('🔄 Clips tab opened - reloading data...');
          await this.loadData();
          this.renderChips();
          console.log('✅ Clips data refreshed');
        } else if (this.currentTab === 'categories') {
          console.log('🔄 Categories tab opened - reloading data...');
          await this.loadData();
          this.renderCategories();
          this.updateCategoryBulkActions();
          console.log('✅ Categories data refreshed');
        } else if (this.currentTab === 'search') {
          console.log('🔄 Search tab opened - reloading data...');
          await this.loadData();
          this.renderSearchResults();
          this.updateSearchBulkActions();
          console.log('✅ Search data refreshed');
        } else if (this.currentTab === 'ai') {
          this.loadAIGallery();
          this.migrateProfileImageToGallery();
        } else if (this.currentTab === 'notes') {
          console.log('🔄 Notes tab opened - loading notes...');
          await this.loadNotes();
          this.renderNotes();
          console.log('✅ Notes loaded');
        }
      }
    });

    // Manual Text Input functionality
    const manualInputToggle = document.getElementById('manualInputToggle');
    const manualInputBody = document.getElementById('manualInputBody');
    const manualInputHeader = document.querySelector('.manual-input-header');
    
    if (manualInputToggle && manualInputBody && manualInputHeader) {
      manualInputHeader.addEventListener('click', () => {
        const isVisible = manualInputBody.style.display !== 'none';
        manualInputBody.style.display = isVisible ? 'none' : 'block';
        manualInputToggle.classList.toggle('active', !isVisible);
      });
    }

    const manualInputSaveBtn = document.getElementById('manualInputSaveBtn');
    const manualInputTextarea = document.getElementById('manualInputTextarea');
    const manualInputCategory = document.getElementById('manualInputCategory');
    const manualInputClearBtn = document.getElementById('manualInputClearBtn');
    const manualInputSaveSpinner = document.getElementById('manualInputSaveSpinner');
    const manualInputSaveIcon = document.getElementById('manualInputSaveIcon');
    const manualInputSaveLabel = document.getElementById('manualInputSaveLabel');

    const setManualInputSavingState = (isSaving) => {
      if (manualInputSaveBtn) manualInputSaveBtn.disabled = !!isSaving;
      if (manualInputSaveSpinner) manualInputSaveSpinner.style.display = isSaving ? 'inline-block' : 'none';
      if (manualInputSaveIcon) manualInputSaveIcon.style.display = isSaving ? 'none' : '';
      if (manualInputSaveLabel) manualInputSaveLabel.textContent = isSaving ? 'Uploading…' : 'Save Clip';
    };

    if (manualInputSaveBtn && manualInputTextarea && manualInputCategory) {
      manualInputSaveBtn.addEventListener('click', async () => {
        if (this.manualClipSaveInProgress) return;

        const text = manualInputTextarea.value.trim();
        if (!text) {
          this.showToast('Please enter some text to save');
          return;
        }

        const category = manualInputCategory.value || 'Uncategorized';
        
        // Check category limit (Uncategorized = unlimited, others = 150 max)
        if (category !== 'Uncategorized') {
          const allClips = [...this.clips, ...this.searchOnlyClips];
          const clipsInCategory = allClips.filter(clip => clip.category === category);
          
          if (clipsInCategory.length >= 150) {
            this.showToast(`Category "${category}" is full (150 clips max)`);
            return;
          }
        }

        try {
          setManualInputSavingState(true);
          this.manualClipSaveInProgress = true;

          const newClip = {
            id: Date.now() + Math.random(),
            text: text,
            category: category,
            timestamp: Date.now()
          };

          this.clips.unshift(newClip);
          
          await this.enforceClipLimit();


          await chrome.storage.local.set({ clips: this.clips, pc_local_updatedAt: Date.now() });

          
          // Sync to Supabase
          try {
            const _pcSyncStart = Date.now();
            const ok = await pasteCraftSupabase.syncClipsToSupabase(this.clips);
            const _pcSyncMs = Date.now() - _pcSyncStart;


            console.log('✅ Manual clip synced to Supabase');
          } catch (error) {
            console.error('⚠️ Failed to sync manual clip to Supabase:', error);
          }
          
          // Notify content scripts (without auto-showing Quick View)
          try {
            chrome.tabs.query({}, (tabs) => {
              tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                  action: 'clipSaved',
                  clip: newClip,
                  autoShow: false
                }).catch(() => {});
              });
            });
          } catch (error) {
            console.log('Could not notify content scripts:', error);
          }
          
          this.renderChips();
          this.renderCategories();
          this.updateCategoryFilter();
          this.updateManualInputCategories();
          this.showToast(`Saved to ${category}!`);
          
          // Clear textarea
          manualInputTextarea.value = '';
        } finally {
          this.manualClipSaveInProgress = false;
          setManualInputSavingState(false);
        }
      });
    }

    if (manualInputClearBtn && manualInputTextarea) {
      manualInputClearBtn.addEventListener('click', () => {
        manualInputTextarea.value = '';
        manualInputTextarea.focus();
      });
    }

    // Populate category dropdown
    this.updateManualInputCategories();

    // Notes functionality
    document.getElementById('createNoteBtn').addEventListener('click', () => {
      this.openNoteEditor('note');
    });

    document.getElementById('createAlbumBtn').addEventListener('click', () => {
      this.openNoteEditor('album');
    });

    const viewAlbumsBtn = document.getElementById('viewAlbumsBtn');
    if (viewAlbumsBtn) {
      viewAlbumsBtn.addEventListener('click', async () => {
        this.notesViewMode = this.notesViewMode === 'albums' ? 'notes' : 'albums';
        this.notesPageIndex = 0;
        viewAlbumsBtn.classList.toggle('active', this.notesViewMode === 'albums');
        await this.saveNotesPrefs();
        this.renderNotes();
      });
    }

    const notesAiToggle = document.getElementById('notesAiToggle');
    if (notesAiToggle) {
      notesAiToggle.addEventListener('change', async (e) => {
        this.notesAiEnabled = !!e.target.checked;
        await this.saveNotesPrefs();
        this.updateNoteAiControls();
      });
    }

    document.getElementById('closeNoteEditor').addEventListener('click', () => {
      this.closeNoteEditor();
    });

    document.getElementById('cancelNoteEditor').addEventListener('click', () => {
      this.closeNoteEditor();
    });

    document.getElementById('saveNote').addEventListener('click', () => {
      this.saveNote();
    });

    document.getElementById('addClipToNote').addEventListener('click', () => {
      if (this.currentNoteType === 'album') {
        this.showToast('Albums do not use attachments');
        return;
      }
      this.showClipPickerForNote();
    });

    // Clip Picker Modal
    document.getElementById('closeClipPicker').addEventListener('click', () => {
      this.closeClipPicker();
    });

    const clipPickerTabs = document.querySelectorAll('.clip-picker-tab');
    clipPickerTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.pickerTab;
        this.switchClipPickerTab(targetTab);
      });
    });

    document.getElementById('clipPickerSearchInput').addEventListener('input', (e) => {
      this.searchClipsInPicker(e.target.value);
    });

    document.getElementById('clipPickerAddBtn').addEventListener('click', () => {
      this.addSelectedClipsToNote();
    });

    document.getElementById('addImageToNote').addEventListener('click', () => {
      if (this.currentNoteType === 'album') {
        this.showToast('Albums do not use attachments');
        return;
      }
      this.showImagePickerForNote();
    });

    document.getElementById('addURLToNote').addEventListener('click', () => {
      if (this.currentNoteType === 'album') {
        this.showToast('Albums do not use attachments');
        return;
      }
      this.addURLToNote();
    });

    const aiTitleBtn = document.getElementById('aiTitleBtn');
    if (aiTitleBtn) {
      aiTitleBtn.addEventListener('click', async () => {
        await this.generateNoteTitleFromContent();
      });
    }

    const aiDescBtn = document.getElementById('aiDescBtn');
    if (aiDescBtn) {
      aiDescBtn.addEventListener('click', async () => {
        await this.generateNoteDescriptionFromContent();
      });
    }

    const noteBodyInput = document.getElementById('noteBodyInput');
    if (noteBodyInput) {
      noteBodyInput.addEventListener('input', () => {
        this.updateNoteAiControls();
      });
    }

    // Album Picker Modal
    document.getElementById('closeAlbumPicker').addEventListener('click', () => {
      this.closeAlbumPicker();
    });

    document.getElementById('createNewNoteFromPicker').addEventListener('click', () => {
      this.closeAlbumPicker();
      this.openNoteEditor('note', null, true);
    });

    document.getElementById('createNewAlbumFromPicker').addEventListener('click', () => {
      this.closeAlbumPicker();
      this.openNoteEditor('album', null, true);
    });

    document.getElementById('backToAlbumPicker').addEventListener('click', () => {
      this.closeNoteEditor();
      this.showAlbumPicker();
    });

    document.getElementById('albumPickerSearch').addEventListener('input', (e) => {
      this.filterAlbumPicker(e.target.value);
    });

    // Notes view toggle (delegate to parent to handle dynamic content)
    const notesHeader = document.querySelector('.notes-header');
    if (notesHeader) {
      notesHeader.addEventListener('click', (e) => {
        const _pcTarget = e.target;
        const _pcTargetTag = (_pcTarget && _pcTarget.tagName) ? _pcTarget.tagName : null;
        const _pcTargetType = (_pcTarget && typeof _pcTarget.nodeType === 'number') ? _pcTarget.nodeType : null;
        const _pcTargetHasClosest = !!(_pcTarget && typeof _pcTarget.closest === 'function');

        const toggleBtn = e.target.closest('.view-toggle-btn');
        if (toggleBtn) {
          document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
          toggleBtn.classList.add('active');
          const view = toggleBtn.dataset.view;
          const container = document.getElementById('notesContainer');
          if (container) {
            const _pcBefore = {hasListView:container.classList.contains('list-view')};
            if (view === 'list') {
              container.classList.add('list-view');
            } else {
              container.classList.remove('list-view');
            }
            const _pcAfter = {hasListView:container.classList.contains('list-view')};

            const _pcComputed = {
              gridTemplateColumns: getComputedStyle(container).gridTemplateColumns,
              display: getComputedStyle(container).display
            };
            const _pcFirstCard = container.querySelector('.note-card');
            const _pcFirstCardStyle = _pcFirstCard ? {
              padding: getComputedStyle(_pcFirstCard).padding,
              borderRadius: getComputedStyle(_pcFirstCard).borderRadius
            } : null;

            // Re-render to apply view-dependent pagination (list=3, grid=8)
            this.renderNotes();
          }
        }
      });
    }

    // Note Viewer Modal
    document.getElementById('closeNoteViewer').addEventListener('click', () => {
      this.closeNoteViewer();
    });

    document.getElementById('closeNoteViewerBtn').addEventListener('click', () => {
      this.closeNoteViewer();
    });

    const noteViewerBackBtn = document.getElementById('noteViewerBackBtn');
    if (noteViewerBackBtn) {
      noteViewerBackBtn.addEventListener('click', () => {
        if (this.noteViewerParentAlbumId) {
          const albumId = this.noteViewerParentAlbumId;
          this.noteViewerParentAlbumId = null;
          this.openNoteViewer(albumId);
        }
      });
    }

    document.getElementById('editNoteFromViewer').addEventListener('click', () => {
      const noteId = this.currentViewerNoteId;
      this.closeNoteViewer();
      if (noteId) {
        const note = this.notes.find(n => n.id == noteId);
        this.openNoteEditor(note?.type || 'note', noteId);
      }
    });

    document.getElementById('copyNoteContent').addEventListener('click', () => {
      const content = document.getElementById('noteViewerContent').textContent;
      if (content) {
        navigator.clipboard.writeText(content);
        this.showToast('Content copied!');
      }
    });

    document.getElementById('copyAllAttachments').addEventListener('click', () => {
      this.copyAllNoteAttachments();
    });

    // Album Attachment Viewer (Overlay Mode)
    const albumAttachmentBackBtn = document.getElementById('albumAttachmentBackBtn');
    if (albumAttachmentBackBtn) {
      albumAttachmentBackBtn.addEventListener('click', () => this.closeAlbumAttachmentViewer());
    }

    const closeAlbumAttachmentViewerBtn = document.getElementById('closeAlbumAttachmentViewer');
    if (closeAlbumAttachmentViewerBtn) {
      closeAlbumAttachmentViewerBtn.addEventListener('click', () => this.closeAlbumAttachmentViewer());
    }

    const albumAttachmentOpenInPopupBtn = document.getElementById('albumAttachmentOpenInPopupBtn');
    if (albumAttachmentOpenInPopupBtn) {
      albumAttachmentOpenInPopupBtn.addEventListener('click', () => {
        const ctx = this.currentAlbumAttachmentContext;
        if (ctx && ctx.noteId != null && typeof ctx.attachmentIndex === 'number') {
          this.openAlbumAttachmentInEdgePopup(ctx.noteId, ctx.attachmentIndex);
        }
      });
    }

    // Modal overlay clicks
    document.getElementById('noteEditorModal').addEventListener('click', (e) => {
      if (e.target.id === 'noteEditorModal') {
        this.closeNoteEditor();
      }
    });

    document.getElementById('albumPickerModal').addEventListener('click', (e) => {
      if (e.target.id === 'albumPickerModal') {
        this.closeAlbumPicker();
      }
    });

    document.getElementById('clipPickerModal').addEventListener('click', (e) => {
      if (e.target.id === 'clipPickerModal') {
        this.closeClipPicker();
      }
    });

    document.getElementById('noteViewerModal').addEventListener('click', (e) => {
      if (e.target.id === 'noteViewerModal') {
        this.closeNoteViewer();
      }
    });

    const albumAttachmentViewerModal = document.getElementById('albumAttachmentViewerModal');
    if (albumAttachmentViewerModal) {
      albumAttachmentViewerModal.addEventListener('click', (e) => {
        if (e.target.id === 'albumAttachmentViewerModal') {
          this.closeAlbumAttachmentViewer();
        }
      });
    }

    // Album Source Note Viewer (Overlay Mode)
    const albumSourceNoteBackBtn = document.getElementById('albumSourceNoteBackBtn');
    if (albumSourceNoteBackBtn) {
      albumSourceNoteBackBtn.addEventListener('click', () => this.closeAlbumSourceNoteOverlay());
    }

    const closeAlbumSourceNoteModalBtn = document.getElementById('closeAlbumSourceNoteModal');
    if (closeAlbumSourceNoteModalBtn) {
      closeAlbumSourceNoteModalBtn.addEventListener('click', () => this.closeAlbumSourceNoteOverlay());
    }

    const albumSourceNoteCopyContentBtn = document.getElementById('albumSourceNoteCopyContent');
    if (albumSourceNoteCopyContentBtn) {
      albumSourceNoteCopyContentBtn.addEventListener('click', () => {
        const content = document.getElementById('albumSourceNoteBody')?.textContent;
        if (content) {
          navigator.clipboard.writeText(content);
          this.showToast('Content copied!');
        }
      });
    }

    const albumSourceNoteModal = document.getElementById('albumSourceNoteModal');
    if (albumSourceNoteModal) {
      albumSourceNoteModal.addEventListener('click', (e) => {
        if (e.target.id === 'albumSourceNoteModal') {
          this.closeAlbumSourceNoteOverlay();
        }
      });
    }

    // Search functionality
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.renderSearchResults();
      this.updateSearchBulkActions();
    });

    document.getElementById('clearSearch').addEventListener('click', () => {
      document.getElementById('searchInput').value = '';
      this.searchQuery = '';
      this.renderSearchResults();
      this.updateSearchBulkActions();
    });

    document.getElementById('categoryFilter').addEventListener('change', (e) => {
      this.selectedCategory = e.target.value;
      this.renderSearchResults();
      this.updateSearchBulkActions();
    });

    document.getElementById('dateFilter').addEventListener('change', (e) => {
      this.selectedDateFilter = e.target.value;
      this.renderSearchResults();
      this.updateSearchBulkActions();
    });

    // Category management
    document.getElementById('createCategoryBtn').addEventListener('click', () => {
      this.showCreateCategoryDialog();
    });

    // Crafted Output is editable: mark as manual when user types
    const previewArea = document.getElementById('previewArea');
    if (previewArea) {
      previewArea.addEventListener('input', () => {
        this.previewIsManual = true;
      });
    }

    // Categories bulk actions (copy | delete)
    const categoryBulkCopyBtn = document.getElementById('categoryBulkCopyBtn');
    const categoryBulkDeleteBtn = document.getElementById('categoryBulkDeleteBtn');
    if (categoryBulkCopyBtn) {
      categoryBulkCopyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.handleCategoryBulkCopy();
      });
    }
    if (categoryBulkDeleteBtn) {
      categoryBulkDeleteBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.handleCategoryBulkDelete();
      });
    }

    // Search bulk action (copy 2+ selected)
    const searchBulkCopyBtn = document.getElementById('searchBulkCopyBtn');
    if (searchBulkCopyBtn) {
      searchBulkCopyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.handleSearchBulkCopy();
      });
    }

    // Category modal events
    document.getElementById('closeCategoryModal').addEventListener('click', () => {
      this.hideCategoryModal();
    });

    document.getElementById('cancelCategorization').addEventListener('click', () => {
      this.hideCategoryModal();
    });

    document.getElementById('createNewCategory').addEventListener('click', () => {
      this.showCreateCategoryFromModal();
    });

    document.getElementById('categoryOptions').addEventListener('click', (e) => {
      // Check if delete button was clicked
      const deleteBtn = e.target.closest('.category-delete-btn');
      if (deleteBtn) {
        e.stopPropagation();
        this.handleClipDelete();
        return;
      }
      
      const option = e.target.closest('.category-option');
      if (option && !option.classList.contains('category-full')) {
        document.querySelectorAll('.category-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        this.selectedCategoryForSave = option.dataset.category;
        
        // Enable the Add button
        document.getElementById('addToCategory').disabled = false;
      } else if (option && option.classList.contains('category-full')) {
        // Show feedback for full categories
        this.showToast('This category is full (150 clips max). Remove some clips first.');
      }
    });

    document.getElementById('addToCategory').addEventListener('click', () => {
      this.saveTextWithCategory();
    });

    // Modal overlay click to close
    document.getElementById('categoryModal').addEventListener('click', (e) => {
      if (e.target.id === 'categoryModal') {
        this.hideCategoryModal();
      }
    });

    // Profile modal events
    document.getElementById('profileBtn').addEventListener('click', () => {
      this.showProfileModal();
    });

    document.getElementById('closeProfileModal').addEventListener('click', () => {
      this.hideProfileModal();
    });

    // Settings modal events
    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.showSettingsModal();
    });

    document.getElementById('closeSettingsModal').addEventListener('click', () => {
      this.hideSettingsModal();
    });
    
    // Help button
    document.getElementById('helpBtn').addEventListener('click', () => {
      this.showHelpModal();
    });

    document.getElementById('cancelSettings').addEventListener('click', () => {
      this.hideSettingsModal();
    });

    document.getElementById('saveSettings').addEventListener('click', () => {
      this.saveSettings();
    });
    
    // Help modal events
    document.getElementById('closeHelpModal').addEventListener('click', () => {
      this.hideHelpModal();
    });
    
    document.getElementById('backBtn').addEventListener('click', () => {
      this.hideHelpModal();
    });
    
    document.getElementById('backToSettingsFromHelp').addEventListener('click', () => {
      this.hideHelpModal();
    });

    // Help modal overlay click to close
    document.getElementById('helpModal').addEventListener('click', (e) => {
      if (e.target.id === 'helpModal') {
        this.hideHelpModal();
      }
    });

    // Info modal events
    const clipJoinerInfo = document.getElementById('clipJoinerInfo');
    if (clipJoinerInfo) {
      clipJoinerInfo.addEventListener('click', () => {
        document.getElementById('clipJoinerModal').classList.add('active');
      });
    }

    const clipSettingsInfo = document.getElementById('clipSettingsInfo');
    if (clipSettingsInfo) {
      clipSettingsInfo.addEventListener('click', () => {
        document.getElementById('clipSettingsModal').classList.add('active');
      });
    }

    const closeClipJoinerModal = document.getElementById('closeClipJoinerModal');
    if (closeClipJoinerModal) {
      closeClipJoinerModal.addEventListener('click', () => {
        document.getElementById('clipJoinerModal').classList.remove('active');
      });
    }

    const closeClipSettingsModal = document.getElementById('closeClipSettingsModal');
    if (closeClipSettingsModal) {
      closeClipSettingsModal.addEventListener('click', () => {
        document.getElementById('clipSettingsModal').classList.remove('active');
      });
    }

    // Close info modals when clicking overlay
    const clipJoinerModal = document.getElementById('clipJoinerModal');
    if (clipJoinerModal) {
      clipJoinerModal.addEventListener('click', (e) => {
        if (e.target.id === 'clipJoinerModal') {
          clipJoinerModal.classList.remove('active');
        }
      });
    }

    const clipSettingsModal = document.getElementById('clipSettingsModal');
    if (clipSettingsModal) {
      clipSettingsModal.addEventListener('click', (e) => {
        if (e.target.id === 'clipSettingsModal') {
          clipSettingsModal.classList.remove('active');
        }
      });
    }

    // Breakdown modal events
    document.getElementById('closeBreakdownModal').addEventListener('click', () => {
      this.hideBreakdownModal();
    });

    document.getElementById('closeBreakdownBtn').addEventListener('click', () => {
      this.hideBreakdownModal();
    });

    document.getElementById('copyBreakdownBtn').addEventListener('click', () => {
      this.copyBreakdownText();
    });

    // Italics toggle button
    document.getElementById('breakdownItalicsBtn').addEventListener('click', () => {
      this.toggleBreakdownItalics();
    });

    // Breakdown modal overlay click to close
    document.getElementById('breakdownModal').addEventListener('click', (e) => {
      if (e.target.id === 'breakdownModal') {
        this.hideBreakdownModal();
      }
    });

    // Clip Viewer modal events
    const closeClipViewerModal = document.getElementById('closeClipViewerModal');
    if (closeClipViewerModal) {
      closeClipViewerModal.addEventListener('click', () => this.hideClipViewerModal());
    }
    const closeClipViewerBtn = document.getElementById('closeClipViewerBtn');
    if (closeClipViewerBtn) {
      closeClipViewerBtn.addEventListener('click', () => this.hideClipViewerModal());
    }
    const copyClipViewerBtn = document.getElementById('copyClipViewerBtn');
    if (copyClipViewerBtn) {
      copyClipViewerBtn.addEventListener('click', () => this.copyClipViewerText());
    }
    const clipViewerModal = document.getElementById('clipViewerModal');
    if (clipViewerModal) {
      clipViewerModal.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'clipViewerModal') {
          this.hideClipViewerModal();
        }
      });
    }

    // Breakdown tab switching
    document.querySelector('.breakdown-tabs').addEventListener('click', (e) => {
      const tab = e.target.closest('.breakdown-tab');
      if (tab) {
        const level = tab.dataset.level;
        
        // Update active tab
        document.querySelectorAll('.breakdown-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update level info text
        this.updateLevelInfo(level);
        
        // Generate breakdown for this level
        this.currentBreakdownLevel = level;
        this.generateBreakdown(level);
      }
    });

    document.getElementById('settingsModal').addEventListener('click', (e) => {
      if (e.target.id === 'settingsModal') {
        this.hideSettingsModal();
      }
    });

    // Delimiter controls
    document.getElementById('delimiterControl').addEventListener('click', (e) => {
      if (e.target.classList.contains('segment-btn')) {
        document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        this.delimiter = e.target.dataset.delimiter;
        this.updatePreview();
        this.updatePreviewFromSelection(); // Also update category selection preview
        this.updateDelimiterExample(); // Update example text
        
        // Handle custom delimiter
        const customInput = document.getElementById('customDelimiter');
        if (this.delimiter === 'custom') {
          customInput.style.display = 'block';
          customInput.focus();
        } else {
          customInput.style.display = 'none';
        }
      }
    });
    
    // Custom delimiter input
    document.getElementById('customDelimiter').addEventListener('input', () => {
      if (this.delimiter === 'custom') {
        this.updatePreview();
        this.updatePreviewFromSelection();
        this.updateDelimiterExample(); // Update example text
      }
    });
    
    // Toggle controls
    document.getElementById('deduplicateToggle').addEventListener('change', (e) => {
      this.options.deduplicate = e.target.checked;
      this.updatePreview();
      this.updatePreviewFromSelection(); // Also update category selection preview
    });
    
    document.getElementById('sortToggle').addEventListener('change', (e) => {
      this.options.sort = e.target.checked;
      this.updatePreview();
      this.updatePreviewFromSelection(); // Also update category selection preview
    });
    
    document.getElementById('uppercaseToggle').addEventListener('change', (e) => {
      this.options.uppercase = e.target.checked;
      this.updatePreview();
      this.updatePreviewFromSelection(); // Also update category selection preview
    });
    
    // Copy button
    document.getElementById('copyBtn').addEventListener('click', () => {
      this.copyToClipboard();
    });
    
    // Magic wand
    document.getElementById('magicWand').addEventListener('click', () => {
      this.magicFormat();
    });
    
    // AI button and tab handlers
    const aiBtn = document.getElementById('aiBtn');
    if (aiBtn) {
      aiBtn.addEventListener('click', () => {
        // Switch to AI tab
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        const aiTabBtn = document.querySelector('.tab-btn[data-tab="ai"]');
        if (aiTabBtn) {
          aiTabBtn.classList.add('active');
        }
        
        this.currentTab = 'ai';
        document.getElementById('aiTab').classList.add('active');
        
        // Load gallery and migrate existing profile image
        this.loadAIGallery();
        this.migrateProfileImageToGallery();
      });
    }

    // AI Lab internal tab navigation
    const aiLabTabsContainer = document.querySelector('.ai-lab-tabs');
    if (aiLabTabsContainer) {
      aiLabTabsContainer.addEventListener('click', (e) => {
        const clickedTab = e.target.closest('.ai-lab-tab');
        if (clickedTab) {
          // Remove active class from all AI Lab tabs
          document.querySelectorAll('.ai-lab-tab').forEach(tab => tab.classList.remove('active'));
          document.querySelectorAll('.ai-lab-section').forEach(section => section.classList.remove('active'));
          
          // Add active class to clicked tab
          clickedTab.classList.add('active');
          
          // Show corresponding section
          const tabName = clickedTab.dataset.aiTab;
          if (tabName === 'generator') {
            document.getElementById('aiGeneratorSection').classList.add('active');
          } else if (tabName === 'gallery') {
            document.getElementById('aiGallerySection').classList.add('active');
            this.loadAIGallery();
            this.migrateProfileImageToGallery();
          } else if (tabName === 'summary') {
            document.getElementById('aiSummarySection').classList.add('active');
          }
        }
      });
    }

    // AI Breakdown standalone button
    const breakdownButton = document.querySelector('.ai-breakdown-feature');
    if (breakdownButton) {
      breakdownButton.addEventListener('click', () => {
        // Remove active class from all tabs and sections
        document.querySelectorAll('.ai-lab-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.ai-lab-section').forEach(section => section.classList.remove('active'));
        
        // Show breakdown section
        document.getElementById('aiBreakdownSection').classList.add('active');
      });
    }

    // AI Breakdown page state
    this.selectedBreakdownLevel = null;

    // AI Breakdown page event listeners
    const clearBreakdownInput = document.getElementById('clearBreakdownInput');
    const breakdownInput = document.getElementById('breakdownInput');
    const charCounter = document.getElementById('breakdownCharCounter');
    const analyzeLevelBtn = document.getElementById('analyzeLevelBtn');
    const levelChips = document.querySelectorAll('.level-chip');
    const levelSelectionHint = document.getElementById('levelSelectionHint');

    if (clearBreakdownInput && breakdownInput) {
      clearBreakdownInput.addEventListener('click', () => {
        breakdownInput.value = '';
        if (charCounter) charCounter.textContent = '0 characters';
        this.selectedBreakdownLevel = null;
        
        // Disable and deselect all level chips
        levelChips.forEach(chip => {
          chip.disabled = true;
          chip.classList.remove('selected');
        });
        
        // Disable analyze button
        if (analyzeLevelBtn) analyzeLevelBtn.disabled = true;
        
        // Reset hint
        if (levelSelectionHint) {
          levelSelectionHint.textContent = 'Type at least one sentence above to enable levels';
        }
        
        breakdownInput.focus();
      });
    }

    // Character counter and level chip enabler
    if (breakdownInput && charCounter) {
      breakdownInput.addEventListener('input', () => {
        const text = breakdownInput.value.trim();
        const length = breakdownInput.value.length;
        const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
        
        charCounter.textContent = `${length} character${length !== 1 ? 's' : ''}`;
        
        // Enable level chips if at least 5 words (roughly one sentence)
        const hasEnoughText = wordCount >= 5;
        
        levelChips.forEach(chip => {
          chip.disabled = !hasEnoughText;
        });
        
        // Update hint text
        if (levelSelectionHint) {
          if (hasEnoughText) {
            levelSelectionHint.textContent = 'Select a level below to continue';
          } else {
            const remaining = 5 - wordCount;
            levelSelectionHint.textContent = `Type ${remaining} more word${remaining !== 1 ? 's' : ''} to enable levels`;
          }
        }
        
        // If text is cleared, disable analyze button and reset selection
        if (!hasEnoughText) {
          this.selectedBreakdownLevel = null;
          levelChips.forEach(chip => chip.classList.remove('selected'));
          if (analyzeLevelBtn) analyzeLevelBtn.disabled = true;
        }
      });
    }

    // Level chip selection
    levelChips.forEach(chip => {
      chip.addEventListener('click', () => {
        if (!chip.disabled) {
          // Deselect all chips
          levelChips.forEach(c => c.classList.remove('selected'));
          
          // Select this chip
          chip.classList.add('selected');
          this.selectedBreakdownLevel = chip.dataset.level;
          
          // Enable analyze button
          if (analyzeLevelBtn) analyzeLevelBtn.disabled = false;
          
          // Update hint
          if (levelSelectionHint) {
            const levelName = chip.querySelector('strong').textContent;
            levelSelectionHint.textContent = `${levelName} level selected - Click analyze button below`;
          }
        }
      });
    });

    // Analyze button
    if (analyzeLevelBtn && breakdownInput) {
      analyzeLevelBtn.addEventListener('click', () => {
        const text = breakdownInput.value.trim();
        if (text && this.selectedBreakdownLevel) {
          this.showBreakdownModalWithLevel(text, this.selectedBreakdownLevel);
        }
      });
    }
    
    // AI Summary page event listeners
    const summaryInput = document.getElementById('summaryInput');
    const summaryCharCounter = document.getElementById('summaryCharCounter');
    const clearSummaryInput = document.getElementById('clearSummaryInput');
    const generateQuestionsBtn = document.getElementById('generateQuestionsBtn');
    const customQuestionInput = document.getElementById('customQuestionInput');
    const customQuestionBtn = document.getElementById('customQuestionBtn');
    const backToInputBtn = document.getElementById('backToInputBtn');
    const newQuestionBtn = document.getElementById('newQuestionBtn');
    const newSummaryBtn = document.getElementById('newSummaryBtn');
    const copySummaryBtn = document.getElementById('copySummaryBtn');

    // Summary input character counter
    if (summaryInput && summaryCharCounter) {
      summaryInput.addEventListener('input', () => {
        const length = summaryInput.value.length;
        const wordCount = summaryInput.value.trim().split(/\s+/).filter(w => w.length > 0).length;
        summaryCharCounter.textContent = `${length} characters`;
        
        // Enable generate questions button if enough text (at least 5 words)
        if (generateQuestionsBtn) {
          generateQuestionsBtn.disabled = wordCount < 5;
        }
      });
    }

    // Clear summary input
    if (clearSummaryInput && summaryInput) {
      clearSummaryInput.addEventListener('click', () => {
        summaryInput.value = '';
        if (summaryCharCounter) summaryCharCounter.textContent = '0 characters';
        if (generateQuestionsBtn) generateQuestionsBtn.disabled = true;
        summaryInput.focus();
      });
    }

    // Generate questions button
    if (generateQuestionsBtn) {
      generateQuestionsBtn.addEventListener('click', () => {
        const text = summaryInput.value.trim();
        if (text) {
          this.currentSummaryText = text;
          this.generateSummaryQuestions(text);
        }
      });
    }

    // Custom question input
    if (customQuestionInput && customQuestionBtn) {
      customQuestionInput.addEventListener('input', () => {
        customQuestionBtn.disabled = customQuestionInput.value.trim().length < 5;
      });
      
      customQuestionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !customQuestionBtn.disabled) {
          customQuestionBtn.click();
        }
      });
    }

    // Custom question button
    if (customQuestionBtn) {
      customQuestionBtn.addEventListener('click', () => {
        const question = customQuestionInput.value.trim();
        if (question && this.currentSummaryText) {
          this.currentSummaryQuestion = question;
          this.generateSummary(this.currentSummaryText, question);
        }
      });
    }

    // Back to input button
    if (backToInputBtn) {
      backToInputBtn.addEventListener('click', () => {
        this.showSummarySection('input');
        this.currentSummaryText = null;
        this.generatedQuestions = [];
      });
    }

    // New question button
    if (newQuestionBtn) {
      newQuestionBtn.addEventListener('click', () => {
        this.showSummarySection('questions');
      });
    }

    // New summary button
    if (newSummaryBtn) {
      newSummaryBtn.addEventListener('click', () => {
        this.showSummarySection('input');
        this.currentSummaryText = null;
        this.generatedQuestions = [];
        this.currentSummaryQuestion = null;
        // Reset threads
        this.summaryThreads = [];
        this.currentSummaryThreadIndex = 0;
        // Hide follow-up and pagination
        const followupContainer = document.getElementById('summaryFollowupContainer');
        const paginationContainer = document.getElementById('summaryThreadPagination');
        if (followupContainer) followupContainer.style.display = 'none';
        if (paginationContainer) paginationContainer.style.display = 'none';
        if (summaryInput) summaryInput.value = '';
        if (summaryCharCounter) summaryCharCounter.textContent = '0 characters';
        if (generateQuestionsBtn) generateQuestionsBtn.disabled = true;
      });
    }

    // Copy summary button
    if (copySummaryBtn) {
      copySummaryBtn.addEventListener('click', () => {
        const content = document.getElementById('summaryResultContent').textContent;
        if (content) {
          navigator.clipboard.writeText(content);
          this.showToast('Summary copied to clipboard!');
        }
      });
    }

    // Summary follow-up handlers
    const summaryFollowupInput = document.getElementById('summaryFollowupInput');
    const summaryFollowupBtn = document.getElementById('summaryFollowupBtn');

    if (summaryFollowupInput) {
      summaryFollowupInput.addEventListener('input', (e) => {
        if (summaryFollowupBtn) {
          summaryFollowupBtn.disabled = e.target.value.trim() === '';
        }
      });

      summaryFollowupInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.value.trim() && this.currentSummaryText) {
          this.handleSummaryFollowup(e.target.value.trim());
        }
      });
    }

    if (summaryFollowupBtn) {
      summaryFollowupBtn.disabled = true;
      summaryFollowupBtn.addEventListener('click', () => {
        if (summaryFollowupInput && this.currentSummaryText) {
          const followupQuestion = summaryFollowupInput.value.trim();
          if (followupQuestion) {
            this.handleSummaryFollowup(followupQuestion);
          }
        }
      });
    }

    // Breakdown follow-up handlers
    const breakdownFollowupInput = document.getElementById('breakdownFollowupInput');
    const breakdownFollowupBtn = document.getElementById('breakdownFollowupBtn');

    if (breakdownFollowupInput) {
      breakdownFollowupInput.addEventListener('input', (e) => {
        const hasText = e.target.value.trim() !== '';
        
        // Enable/disable send button
        if (breakdownFollowupBtn) {
          breakdownFollowupBtn.disabled = !hasText;
        }
        
        // Enable/disable level tabs
        this.toggleFollowupLevelTabs(hasText);
      });

      breakdownFollowupInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.value.trim() && this.currentBreakdownText) {
          this.handleBreakdownFollowup(e.target.value.trim());
        }
      });
    }

    if (breakdownFollowupBtn) {
      breakdownFollowupBtn.disabled = true;
      breakdownFollowupBtn.addEventListener('click', () => {
        if (breakdownFollowupInput && this.currentBreakdownText) {
          const followupQuestion = breakdownFollowupInput.value.trim();
          if (followupQuestion) {
            this.handleBreakdownFollowup(followupQuestion);
          }
        }
      });
    }

    // Follow-up level tab handlers
    const followupLevelTabs = document.querySelectorAll('.followup-level-tab');
    followupLevelTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        if (!tab.classList.contains('disabled')) {
          // Remove selected from all
          followupLevelTabs.forEach(t => t.classList.remove('selected'));
          // Add selected to clicked
          tab.classList.add('selected');
          // Store selected level
          this.selectedFollowupLevel = tab.dataset.followupLevel;
          console.log('📊 Selected follow-up level:', this.selectedFollowupLevel);
          
          // ✅ FIX: Auto-submit the followup when level is clicked
          if (breakdownFollowupInput && this.currentBreakdownText) {
            const followupQuestion = breakdownFollowupInput.value.trim();
            if (followupQuestion) {
              this.handleBreakdownFollowup(followupQuestion);
            }
          }
        }
      });
    });
    
    // AI generation buttons
    const aiGenerateFromProfileBtn = document.getElementById('aiGenerateFromProfileBtn');
    const aiGenerateRandomBtn = document.getElementById('aiGenerateRandomBtn');
    const aiTimerDismiss = document.getElementById('aiTimerDismiss');
    
    if (aiGenerateFromProfileBtn) {
      aiGenerateFromProfileBtn.addEventListener('click', () => {
        this.generateAIImageFromProfile();
      });
    }
    
    if (aiGenerateRandomBtn) {
      aiGenerateRandomBtn.addEventListener('click', () => {
        this.generateRandomAIImage();
      });
    }
    
    if (aiTimerDismiss) {
      aiTimerDismiss.addEventListener('click', () => {
        this.hideAIGenerationTimer();
      });
    }
    
    // Quick Copy Button
    document.getElementById('quickCopyBtn').addEventListener('click', () => {
      this.handleQuickCopy();
    });

    // Quick Delete Button (2+ selected)
    const quickDeleteBtn = document.getElementById('quickDeleteBtn');
    if (quickDeleteBtn) {
      quickDeleteBtn.addEventListener('click', () => {
        this.handleQuickDelete();
      });
    }
    
    // Setup image viewer for expanded view
    this.setupImageViewer();
    
    // Initialize delimiter example text
    this.updateDelimiterExample();
  }
  
  // =====================================================
  // AUTHENTICATION METHODS
  // =====================================================
  
  async checkOAuthCallback() {
    try {
      const result = await chrome.storage.local.get('oauth_callback');
      if (result.oauth_callback) {
        const { access_token, refresh_token } = result.oauth_callback;
        console.log('🔐 Found OAuth callback tokens, completing sign in...');
        
        // Set session with tokens
        const { error } = await pasteCraftSupabase.client.auth.setSession({
          access_token,
          refresh_token
        });
        
        if (!error) {
          console.log('✅ OAuth sign in completed!');
          const { data: { user } } = await pasteCraftSupabase.client.auth.getUser();
          
          // Create subscription for new user
          if (user) {
            await pasteCraftSupabase.createUserSubscription(user.id, user.email);
          }
          
          // Clear the temporary tokens
          await chrome.storage.local.remove('oauth_callback');
        } else {
          console.error('❌ Failed to set session:', error);
        }
      }
    } catch (error) {
      console.error('❌ Error checking OAuth callback:', error);
    }
  }

  async checkPasswordResetCallback() {
    try {
      console.log('=================================');
      console.log('🔍 CHECKING PASSWORD RESET CALLBACK');
      console.log('=================================');
      console.log('📦 Reading from chrome.storage.local...');
      
      const result = await chrome.storage.local.get('password_reset_callback');
      console.log('📥 Storage result:', result);
      
      if (result.password_reset_callback) {
        const { access_token, refresh_token, type, timestamp } = result.password_reset_callback;
        console.log('✅ Password reset callback data found!');
        console.log('📦 Data details:', {
          access_token_length: access_token?.length,
          refresh_token_length: refresh_token?.length,
          type: type,
          timestamp: new Date(timestamp).toISOString(),
          age_seconds: (Date.now() - timestamp) / 1000
        });
        
        if (type === 'recovery') {
          console.log('🔑 Type is "recovery" - setting Supabase session...');
          
          // Set session with recovery tokens
          const { error } = await pasteCraftSupabase.client.auth.setSession({
            access_token,
            refresh_token
          });
          
          if (!error) {
            console.log('✅ Password reset session established successfully!');
            
            // Verify session
            const { data: { user } } = await pasteCraftSupabase.client.auth.getUser();
            console.log('👤 Current user after session:', user?.email);
            
            // Clear the temporary tokens
            console.log('🧹 Clearing temporary tokens from storage...');
            await chrome.storage.local.remove('password_reset_callback');
            console.log('✅ Tokens cleared');
            
            return true;
          } else {
            console.error('❌ Failed to set password reset session:', error);
            console.error('Error details:', JSON.stringify(error, null, 2));
          }
        } else {
          console.warn('⚠️ Type is not "recovery":', type);
        }
      } else {
        console.log('ℹ️ No password reset callback data in storage');
      }
    } catch (error) {
      console.error('❌ Error checking password reset callback:', error);
      console.error('Error stack:', error.stack);
    }
    return false;
  }

  async setPasswordResetSession(accessToken, refreshToken) {
    try {
      console.log('🔑 Setting password reset session from URL tokens');
      
      const { error } = await pasteCraftSupabase.client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      
      if (!error) {
        console.log('✅ Password reset session established from URL!');
      } else {
        console.error('❌ Failed to set password reset session:', error);
      }
    } catch (error) {
      console.error('❌ Error setting password reset session:', error);
    }
  }
  
  showAuthModal() {
    console.log('🔐 Showing auth modal...');
    this.hideLoadingOverlay();
    document.getElementById('authModal').style.display = 'flex';
  }
  
  hideAuthModal() {
    document.getElementById('authModal').style.display = 'none';
  }
  
  setupAuthModalEvents() {
    console.log('🔧 Setting up auth modal event listeners...');
    // Tab switching - support both old and new tab classes
    document.querySelectorAll('.auth-tab, .auth-tab-new').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.auth-tab, .auth-tab-new').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        const targetTab = e.target.dataset.authTab;
        document.getElementById('signinForm').style.display = targetTab === 'signin' ? 'flex' : 'none';
        document.getElementById('signupForm').style.display = targetTab === 'signup' ? 'flex' : 'none';
      });
    });

    // Password strength indicator
    const signupPassword = document.getElementById('signupPassword');
    if (signupPassword) {
      signupPassword.addEventListener('input', (e) => {
        this.updatePasswordStrength(e.target.value);
      });
    }

    // Resend Verification Email
    document.getElementById('resendVerificationLink').addEventListener('click', async (e) => {
      e.preventDefault();
      const email = document.getElementById('signinEmail').value;
      
      if (!email) {
        alert('📧 Please enter your email address in the Sign In form first!');
        return;
      }
      
      this.showToast('📧 Sending verification email...', 'info');
      
      const result = await pasteCraftSupabase.resendVerificationEmail(email);
      
      if (result.success) {
        alert(`✅ Verification Email Sent!\n\nCheck your inbox at: ${email}\n\nThe verification link has been sent. Click it to activate your account.\n\n⚠️ Check your spam folder if you don't see it within a few minutes.`);
        this.showToast('✅ Verification email sent! Check your inbox.', 'success');
      } else {
        this.showToast(`❌ Failed to resend: ${result.error}`, 'error');
      }
    });

    // Sign In Handler Function
    const handleSignIn = async () => {
      console.log('🔐 Sign In triggered');
      const email = document.getElementById('signinEmail').value;
      const password = document.getElementById('signinPassword').value;
      
      if (!email || !password) {
        this.showToast('⚠️ Please fill in all fields', 'error');
        return;
      }
      
      const result = await pasteCraftSupabase.signInWithEmail(email, password);
      
      if (result.success) {
        this.showToast('✅ Welcome back!', 'success');
        this.hideAuthModal();
        // Reload page to initialize with authenticated user
        window.location.reload();
      } else {
        // Provide helpful error messages
        let errorMessage = result.error;
        
        if (result.error.toLowerCase().includes('email not confirmed') || 
            result.error.toLowerCase().includes('email_not_confirmed')) {
          errorMessage = '📧 Email Not Verified!\n\nYou must verify your email before signing in.\n\nCheck your inbox for the verification email from Supabase and click the link.\n\nCheck spam if needed.';
          alert(errorMessage);
        } else if (result.error.toLowerCase().includes('invalid') || 
                   result.error.toLowerCase().includes('credentials')) {
          errorMessage = '❌ Invalid email or password.\n\nPlease check your credentials and try again.\n\nIf you just signed up, make sure you verified your email first!';
        }
        
        this.showToast(`❌ ${errorMessage}`, 'error');
      }
    };
    
    // Sign In Button Click
    document.getElementById('signinBtn').addEventListener('click', handleSignIn);
    
    // Sign In with Enter Key
    document.getElementById('signinEmail').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSignIn();
      }
    });
    
    document.getElementById('signinPassword').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSignIn();
      }
    });

    // Sign Up Handler Function
    const handleSignUp = async () => {
      console.log('📝 Sign Up triggered');
      const email = document.getElementById('signupEmail').value;
      const password = document.getElementById('signupPassword').value;
      const confirmPassword = document.getElementById('signupPasswordConfirm').value;
      const agreeTerms = document.getElementById('agreeTerms').checked;
      
      if (!email || !password || !confirmPassword) {
        this.showToast('⚠️ Please fill in all fields', 'error');
        return;
      }
      
      if (password !== confirmPassword) {
        this.showToast('⚠️ Passwords do not match', 'error');
        return;
      }
      
      // Validate password requirements
      if (!this.validatePassword(password)) {
        this.showToast('⚠️ Password does not meet requirements. Check the red requirements below.', 'error');
        return;
      }
      
      if (!agreeTerms) {
        this.showToast('⚠️ Please agree to terms and conditions', 'error');
        return;
      }
      
      const result = await pasteCraftSupabase.signUpWithEmail(email, password);
      
      if (result.success) {
        // Show detailed verification instructions
        alert(`✅ Account Created Successfully!\n\n📧 IMPORTANT: Check your email (${email})\n\n1️⃣ Open the verification email from Supabase\n2️⃣ Click the verification link\n3️⃣ Come back here and sign in\n\n⚠️ You CANNOT sign in until you verify your email!\n\nCheck your spam folder if you don't see it.`);
        this.showToast('✅ Check your email to verify your account!', 'success');
        // Switch to sign in tab
        document.querySelector('[data-auth-tab="signin"]').click();
      } else {
        this.showToast(`❌ ${result.error}`, 'error');
      }
    };
    
    // Sign Up Button Click
    document.getElementById('signupBtn').addEventListener('click', handleSignUp);
    
    // Sign Up with Enter Key
    document.getElementById('signupEmail').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSignUp();
      }
    });
    
    document.getElementById('signupPassword').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSignUp();
      }
    });
    
    document.getElementById('signupPasswordConfirm').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSignUp();
      }
    });

    // Google Sign In
    document.getElementById('googleSigninBtn').addEventListener('click', async () => {
      console.log('🔵 Google Sign In button clicked');
      this.showToast('🔵 Opening Google sign in...', 'info');
      
      const result = await pasteCraftSupabase.signInWithGoogle();
      
      if (result.success) {
        this.showToast('✅ Complete sign in in the new window!', 'success');
        // Don't reload - user will close and reopen popup after OAuth
      } else {
        this.showToast(`❌ ${result.error}`, 'error');
      }
    });

    // Google Sign Up
    document.getElementById('googleSignupBtn').addEventListener('click', async () => {
      console.log('🔵 Google Sign Up button clicked');
      this.showToast('🔵 Opening Google sign up...', 'info');
      
      const result = await pasteCraftSupabase.signInWithGoogle();
      
      if (result.success) {
        this.showToast('✅ Complete sign up in the new window!', 'success');
        // Don't reload - user will close and reopen popup after OAuth
      } else {
        this.showToast(`❌ ${result.error}`, 'error');
      }
    });

    // =====================================================
    // FORGOT PASSWORD FLOW
    // =====================================================

    // Forgot Password Link Click
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
      forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('🔑 Forgot password link clicked');
        // Hide main auth modal, show reset modal
        document.getElementById('authModal').style.display = 'none';
        document.getElementById('passwordResetModal').style.display = 'flex';
        
        // Pre-fill email if user already entered it
        const signinEmail = document.getElementById('signinEmail').value;
        if (signinEmail) {
          document.getElementById('resetEmail').value = signinEmail;
        }
      });
    }

    // Cancel Reset - Back to Sign In
    document.getElementById('cancelResetBtn').addEventListener('click', () => {
      console.log('🔙 Cancel reset, back to sign in');
      document.getElementById('passwordResetModal').style.display = 'none';
      document.getElementById('authModal').style.display = 'flex';
    });

    // Password Reset Handler Function
    const handlePasswordReset = async () => {
      const email = document.getElementById('resetEmail').value;
      
      if (!email) {
        this.showToast('⚠️ Please enter your email', 'error');
        return;
      }
      
      console.log('📧 Requesting password reset for:', email);
      this.showToast('📧 Sending reset link...', 'info');
      
      const result = await pasteCraftSupabase.resetPassword(email);
      
      if (result.success) {
        alert(`✅ Password Reset Email Sent!\n\nCheck your inbox at: ${email}\n\n1️⃣ Click the link in the email\n2️⃣ Follow instructions on pastecraft.com\n3️⃣ Return here to set your new password\n\n⚠️ Check spam if you don't see it within 5 minutes.`);
        this.showToast('✅ Reset email sent! Check your inbox.', 'success');
        
        // Hide reset modal, show sign in
        document.getElementById('passwordResetModal').style.display = 'none';
        document.getElementById('authModal').style.display = 'flex';
      } else {
        this.showToast(`❌ Failed: ${result.error}`, 'error');
      }
    };
    
    // Submit Reset Request
    document.getElementById('resetRequestForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await handlePasswordReset();
    });
    
    // Password Reset with Enter Key
    document.getElementById('resetEmail').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handlePasswordReset();
      }
    });

    // =====================================================
    // NEW PASSWORD FLOW (after clicking email link)
    // =====================================================

    // Password strength for new password
    const newPasswordInput = document.getElementById('newPassword');
    if (newPasswordInput) {
      newPasswordInput.addEventListener('input', (e) => {
        this.updateNewPasswordStrength(e.target.value);
        this.checkPasswordMatch();
      });
    }

    // Check password match on confirm password input
    const confirmNewPasswordInput = document.getElementById('confirmNewPassword');
    if (confirmNewPasswordInput) {
      confirmNewPasswordInput.addEventListener('input', () => {
        this.checkPasswordMatch();
      });
    }

    // New Password Handler Function
    const handleNewPassword = async () => {
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmNewPassword').value;
      
      // Validate password requirements
      if (!this.validatePassword(newPassword)) {
        this.showToast('⚠️ Password does not meet requirements', 'error');
        return;
      }
      
      // Check if passwords match
      if (newPassword !== confirmPassword) {
        this.showToast('⚠️ Passwords do not match', 'error');
        return;
      }
      
      console.log('🔐 Updating password...');
      this.showToast('🔄 Updating password...', 'info');
      
      const result = await pasteCraftSupabase.updatePassword(newPassword);
      
      if (result.success) {
        alert('✅ Password Updated Successfully!\n\nYou can now sign in with your new password.');
        this.showToast('✅ Password updated!', 'success');
        
        // Hide new password modal, show sign in
        document.getElementById('newPasswordModal').style.display = 'none';
        document.getElementById('authModal').style.display = 'flex';
        
        // Clear the hash from URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        this.showToast(`❌ Failed: ${result.error}`, 'error');
      }
    };
    
    // Submit New Password
    document.getElementById('newPasswordForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleNewPassword();
    });
    
    // New Password with Enter Key
    document.getElementById('newPassword').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleNewPassword();
      }
    });
    
    document.getElementById('confirmNewPassword').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleNewPassword();
      }
    });

    // Admin Sign In Link
    document.getElementById('adminSignInLink').addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('authModal').style.display = 'none';
      document.getElementById('adminAuthModal').style.display = 'flex';
    });

    // Close Admin Modal
    document.getElementById('closeAdminAuthModal').addEventListener('click', () => {
      document.getElementById('adminAuthModal').style.display = 'none';
      document.getElementById('authModal').style.display = 'flex';
    });

    // Back to User Auth
    document.getElementById('backToUserAuth').addEventListener('click', () => {
      document.getElementById('adminAuthModal').style.display = 'none';
      document.getElementById('authModal').style.display = 'flex';
    });

    // Admin Sign In Handler Function
    const handleAdminSignIn = async () => {
      const email = document.getElementById('adminEmail').value;
      const password = document.getElementById('adminPassword').value;
      
      if (!email || !password) {
        this.showToast('⚠️ Please fill in all fields', 'error');
        return;
      }
      
      const result = await pasteCraftSupabase.signInAsAdmin(email, password);
      
      if (result.success && result.isAdmin) {
        this.showToast('✅ Admin access granted!', 'success');
        document.getElementById('adminAuthModal').style.display = 'none';
        // Reload page to initialize with authenticated admin user
        window.location.reload();
      } else {
        this.showToast(`❌ ${result.error || 'Admin access denied'}`, 'error');
      }
    };
    
    // Admin Sign In Button Click
    document.getElementById('adminSigninBtn').addEventListener('click', handleAdminSignIn);
    
    // Admin Sign In with Enter Key
    document.getElementById('adminEmail').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdminSignIn();
      }
    });
    
    document.getElementById('adminPassword').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdminSignIn();
      }
    });

    // Close App Button
    document.getElementById('closeAppBtn').addEventListener('click', () => {
      // If we're in an iframe (content-script overlay), send message to parent
      if (window.self !== window.top) {
        window.parent.postMessage({ type: 'PASTECRAFT_CLOSE_POPUP' }, '*');
      } else {
        // Otherwise just close the window (for standalone popup)
        window.close();
      }
    });

    // Support Forms (Team/Help/Support/Improve/Report Bugs)
    const openSupport = (type) => {
      try {
        this.openSupportForm(type);
      } catch (e) {
        console.error('Support form open failed:', e);
        this.showToast('❌ Could not open support form', 'error');
      }
    };

    const teamBtn = document.getElementById('supportTeamBtn');
    const helpBtn = document.getElementById('supportHelpBtn');
    const supportBtn = document.getElementById('supportSupportBtn');
    const improveBtn = document.getElementById('supportImproveBtn');
    const reportBugsBtn = document.getElementById('supportReportBugsBtn');

    teamBtn && teamBtn.addEventListener('click', () => openSupport('team'));
    helpBtn && helpBtn.addEventListener('click', () => openSupport('help'));
    supportBtn && supportBtn.addEventListener('click', () => openSupport('support'));
    improveBtn && improveBtn.addEventListener('click', () => openSupport('howcanweimprove'));
    reportBugsBtn && reportBugsBtn.addEventListener('click', () => openSupport('reportbugs'));

    const closeSupportBtn = document.getElementById('closeSupportFormModal');
    const cancelSupportBtn = document.getElementById('cancelSupportForm');
    const sendSupportBtn = document.getElementById('sendSupportForm');
    const supportModal = document.getElementById('supportFormModal');

    closeSupportBtn && closeSupportBtn.addEventListener('click', () => this.closeSupportForm());
    cancelSupportBtn && cancelSupportBtn.addEventListener('click', () => this.closeSupportForm());
    supportModal && supportModal.addEventListener('click', (e) => {
      if (e && e.target && e.target.id === 'supportFormModal') {
        this.closeSupportForm();
      }
    });
    sendSupportBtn && sendSupportBtn.addEventListener('click', async () => {
      await this.submitSupportForm();
    });
    
    // Sign Out
    document.getElementById('signOutBtn').addEventListener('click', async () => {
      if (confirm('Are you sure you want to sign out?')) {
        const result = await pasteCraftSupabase.signOut();
        
        if (result.success) {
          this.showToast('👋 Signed out successfully', 'success');
          // Clear local state
          this.currentUser = null;
          this.userSubscription = null;
          // Reload page to show auth modal
          window.location.reload();
        } else {
          this.showToast(`❌ ${result.error}`, 'error');
        }
      }
    });
  }

  openSupportForm(type) {
    this.currentSupportFormType = type;
    const titleEl = document.getElementById('supportFormTitle');
    const infoEl = document.getElementById('supportFormInfo');
    const fieldsEl = document.getElementById('supportFormFields');
    const subjectEl = document.getElementById('supportFormSubject');
    const descEl = document.getElementById('supportFormDescription');
    const statusEl = document.getElementById('supportFormStatus');

    const SUPPORT_FORM_SCHEMAS = {
      reportbugs: {
        blurb: 'Report bugs and UX/UI discrepancies.',
        fields: [
          { key: 'where', label: 'Where did it happen? (optional)', type: 'text', maxLen: 160, placeholder: 'Page, feature, or screen' },
          { key: 'steps', label: 'Steps to reproduce (optional)', type: 'textarea', maxLen: 800, placeholder: '1) …\n2) …\n3) …' },
          { key: 'expected_vs_actual', label: 'Expected vs actual (optional)', type: 'textarea', maxLen: 800, placeholder: 'Expected …\nActual …' },
        ],
      },
      help: {
        blurb: 'How do I use the app? Where do I find this feature? Add examples.',
        fields: [
          { key: 'feature', label: 'Feature / question (optional)', type: 'text', maxLen: 160, placeholder: 'What are you trying to do?' },
          { key: 'example', label: 'Example (optional)', type: 'textarea', maxLen: 800, placeholder: 'Example input/output or scenario…' },
        ],
      },
      support: {
        blurb: 'Login, signup, errors, and account/subscription concerns.',
        fields: [
          { key: 'category', label: 'Category (optional)', type: 'select', options: ['Login', 'Signup', 'Error', 'Account', 'Subscription', 'Other'] },
          { key: 'error_message', label: 'Error message (optional)', type: 'textarea', maxLen: 800, placeholder: 'Paste the exact error message (if any)…' },
        ],
      },
      howcanweimprove: {
        blurb: 'Feature requests and UX/UI improvements.',
        fields: [
          { key: 'request_type', label: 'Request type (optional)', type: 'select', options: ['Feature request', 'UX/UI improvement', 'Other'] },
          { key: 'why', label: 'Why this matters (optional)', type: 'textarea', maxLen: 800, placeholder: 'What problem does this solve? What would “better” look like?' },
        ],
      },
      team: {
        blurb: 'Talk to the team, work for us, partnerships, etc.',
        fields: [
          { key: 'topic', label: 'Topic (optional)', type: 'select', options: ['Talk to the team', 'Work for us', 'Partnership', 'Press', 'Other'] },
          { key: 'contact', label: 'Best way to contact you (optional)', type: 'text', maxLen: 160, placeholder: 'Email/phone/link (we’ll reply to your account email by default)' },
          { key: 'links', label: 'Links (optional)', type: 'textarea', maxLen: 800, placeholder: 'Portfolio, LinkedIn, website, docs…' },
        ],
      },
    };

    const schema = SUPPORT_FORM_SCHEMAS[type] || { blurb: '', fields: [] };

    const titles = {
      team: '👥 Team',
      help: '🆘 Help',
      support: '💬 Support',
      howcanweimprove: '💡 How can we improve?',
      reportbugs: '🐞 Report a bug',
    };

    if (titleEl) titleEl.textContent = `📨 ${titles[type] || 'Contact PasteCraft'}`;

    const userEmail = this.currentUser?.email || '';
    if (infoEl) {
      infoEl.innerHTML = '';
      const line1 = document.createElement('div');
      line1.textContent = userEmail
        ? `From: ${userEmail} • We’ll reply to this email.`
        : `We’ll reply to your PasteCraft account email.`;
      infoEl.appendChild(line1);

      if (schema.blurb) {
        const line2 = document.createElement('div');
        line2.textContent = schema.blurb;
        line2.style.marginTop = '6px';
        line2.style.color = '#374151';
        infoEl.appendChild(line2);
      }
    }

    if (fieldsEl) {
      fieldsEl.innerHTML = '';
      for (const field of schema.fields || []) {
        if (!field || !field.key) continue;
        const wrapper = document.createElement('div');
        wrapper.className = 'support-form-field';

        const label = document.createElement('label');
        const inputId = `supportField_${field.key}`;
        label.htmlFor = inputId;
        label.textContent = field.label || field.key;

        let inputEl = null;
        if (field.type === 'textarea') {
          const ta = document.createElement('textarea');
          ta.className = 'support-form-textarea';
          if (field.maxLen) ta.maxLength = field.maxLen;
          if (field.placeholder) ta.placeholder = field.placeholder;
          ta.rows = 3;
          inputEl = ta;
        } else if (field.type === 'select') {
          const sel = document.createElement('select');
          sel.className = 'support-form-input';
          const optEmpty = document.createElement('option');
          optEmpty.value = '';
          optEmpty.textContent = 'Select…';
          sel.appendChild(optEmpty);
          for (const opt of field.options || []) {
            const o = document.createElement('option');
            o.value = String(opt);
            o.textContent = String(opt);
            sel.appendChild(o);
          }
          inputEl = sel;
        } else {
          const inp = document.createElement('input');
          inp.className = 'support-form-input';
          inp.type = 'text';
          if (field.maxLen) inp.maxLength = field.maxLen;
          if (field.placeholder) inp.placeholder = field.placeholder;
          inputEl = inp;
        }

        inputEl.id = inputId;
        inputEl.setAttribute('data-support-field', field.key);

        wrapper.appendChild(label);
        wrapper.appendChild(inputEl);
        fieldsEl.appendChild(wrapper);
      }
    }
    if (subjectEl) subjectEl.value = '';
    if (descEl) descEl.value = '';
    if (statusEl) {
      statusEl.style.display = 'none';
      statusEl.textContent = '';
      statusEl.style.color = '#111827';
    }

    const modal = document.getElementById('supportFormModal');
    if (modal) modal.style.display = 'flex';
  }

  closeSupportForm() {
    const modal = document.getElementById('supportFormModal');
    if (modal) modal.style.display = 'none';
  }

  async submitSupportForm() {
    const type = this.currentSupportFormType;
    const subjectEl = document.getElementById('supportFormSubject');
    const descEl = document.getElementById('supportFormDescription');
    const statusEl = document.getElementById('supportFormStatus');
    const sendBtn = document.getElementById('sendSupportForm');

    const subject = (subjectEl?.value || '').trim();
    const description = (descEl?.value || '').trim();
    const fields = {};
    try {
      const fieldEls = document.querySelectorAll('#supportFormFields [data-support-field]');
      fieldEls.forEach((el) => {
        const key = el?.getAttribute && el.getAttribute('data-support-field');
        if (!key) return;
        const raw = typeof el.value === 'string' ? el.value : '';
        const val = raw.trim();
        if (val) fields[key] = val;
      });
    } catch (_) {
      // ignore field collection failures
    }

    if (!subject || !description) {
      this.showToast('⚠️ Please add subject and description', 'error');
      return;
    }

    try {
      if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';
      }

      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.color = '#111827';
        statusEl.textContent = 'Sending…';
      }

      const { data: { session } } = await pasteCraftSupabase.client.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        this.showToast('❌ Please sign in again', 'error');
        return;
      }

      const endpoint = `https://pastecraft.com/.netlify/functions/support-ticket?v=${Date.now()}`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          type,
          subject,
          description,
          fields,
        }),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        console.error('Support ticket failed:', resp.status, text);
        this.showToast('❌ Could not send message', 'error');
        if (statusEl) {
          statusEl.style.display = 'block';
          statusEl.style.color = '#b91c1c';
          statusEl.textContent = resp.status === 429 ? 'Too many requests. Please wait a moment and try again.' : 'Failed to send. Please try again.';
        }
        return;
      }

      this.showToast('✅ Sent', 'success');
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.color = '#065f46';
        statusEl.textContent = 'Sent successfully.';
      }

      setTimeout(() => this.closeSupportForm(), 600);
    } catch (e) {
      console.error('Support ticket error:', e);
      this.showToast('❌ Could not send message', 'error');
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.color = '#b91c1c';
        statusEl.textContent = 'Failed to send. Please try again.';
      }
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
      }
    }
  }
  
  renderChips() {
    const container = document.getElementById('chipContainer');
    
    if (this.clips.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✨</div>
          <h3>No clips yet</h3>
          <p>Right-click selected text to save it here</p>
          <div class="demo-hint">
            <span class="demo-step">1️⃣ Select text</span>
            <span class="demo-step">2️⃣ Right-click</span>
            <span class="demo-step">3️⃣ Save to PasteCraft</span>
          </div>
        </div>
      `;
      return;
    }
    
    // Calculate pagination
    const startIndex = this.currentPage * this.clipsPerPage;
    const endIndex = Math.min(startIndex + this.clipsPerPage, this.clips.length);
    const pageClips = this.clips.slice(startIndex, endIndex);
    
    container.innerHTML = '';
    pageClips.forEach((clip, pageIndex) => {
      const actualIndex = startIndex + pageIndex;
      const chip = this.createChip(clip, actualIndex);
      container.appendChild(chip);
    });
    
    // Render pagination controls
    this.renderPagination();
    
    // Update quick copy button visibility
    this.updateQuickCopyButton();
  }
  
  renderPagination() {
    const paginationContainer = document.getElementById('paginationControls');
    if (!paginationContainer) return;
    
    const totalPages = Math.min(Math.ceil(this.clips.length / this.clipsPerPage), this.maxPages);
    
    if (totalPages <= 1) {
      paginationContainer.innerHTML = '';
      return;
    }
    
    let paginationHTML = '<div class="pagination-wrapper">';
    
    // Previous button
    paginationHTML += `
      <button class="pagination-btn pagination-prev" ${this.currentPage === 0 ? 'disabled' : ''} data-page="${this.currentPage - 1}">
        ‹ Prev
      </button>
    `;
    
    // Page numbers
    paginationHTML += '<div class="pagination-numbers">';
    
    // Show first page
    if (this.currentPage > 2) {
      paginationHTML += `<button class="pagination-number" data-page="0">0</button>`;
      if (this.currentPage > 3) {
        paginationHTML += '<span class="pagination-ellipsis">...</span>';
      }
    }
    
    // Show pages around current page
    const startPage = Math.max(0, this.currentPage - 2);
    const endPage = Math.min(totalPages - 1, this.currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === this.currentPage ? 'active' : '';
      paginationHTML += `<button class="pagination-number ${isActive}" data-page="${i}">${i}</button>`;
    }
    
    // Show last page
    if (this.currentPage < totalPages - 3) {
      if (this.currentPage < totalPages - 4) {
        paginationHTML += '<span class="pagination-ellipsis">...</span>';
      }
      paginationHTML += `<button class="pagination-number" data-page="${totalPages - 1}">${totalPages - 1}</button>`;
    }
    
    paginationHTML += '</div>';
    
    // Next button
    paginationHTML += `
      <button class="pagination-btn pagination-next" ${this.currentPage >= totalPages - 1 ? 'disabled' : ''} data-page="${this.currentPage + 1}">
        Next ›
      </button>
    `;
    
    paginationHTML += '</div>';
    
    paginationContainer.innerHTML = paginationHTML;
    
    // Add click handlers
    paginationContainer.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const page = parseInt(e.target.dataset.page);
        if (!isNaN(page) && page >= 0 && page < totalPages) {
          this.currentPage = page;
          this.renderChips();
        }
      });
    });
  }
  
  createChip(clip, index) {
    const chip = document.createElement('div');
    chip.className = 'chip animate-slide-in';
    chip.dataset.index = index;
    chip.dataset.clipId = clip.id || index;
    
    const text = clip.text.length > 30 ? clip.text.substring(0, 30) + '...' : clip.text;
    const timeAgo = this.getTimeAgo(clip.timestamp);
    
    const clipCategory = clip.category || 'Uncategorized';
    const isSelected = this.selectedChips.has(index);
    
    chip.innerHTML = `
      <input type="checkbox" class="chip-checkbox" ${isSelected ? 'checked' : ''}>
      <span class="chip-text" title="${clip.text}">${text}</span>
      <span class="chip-time">${timeAgo}</span>
      <div class="chip-actions">
        <button class="chip-breakdown-btn" title="AI Breakdown">🧠</button>
        <button class="chip-open-btn" title="Open">🔎</button>
        <button class="chip-summary-btn" title="AI Summary">📝</button>
        <button class="chip-notes-btn" title="Send to Notes">
          <img src="assets/notebook_354567.svg" alt="" style="width: 14px; height: 14px;">
        </button>
        <button class="chip-category-btn" title="Add to category">📁</button>
        <button class="chip-remove" title="Remove clip">×</button>
      </div>
    `;

    // Add category indicator if not Uncategorized
    if (clipCategory !== 'Uncategorized') {
      const categoryIndicator = document.createElement('span');
      categoryIndicator.className = 'chip-category-indicator';
      categoryIndicator.style.cssText = `
        font-size: 10px;
        background: rgba(0,0,0,0.1);
        padding: 2px 6px;
        border-radius: 8px;
        margin-left: 4px;
      `;
      categoryIndicator.textContent = clipCategory;
      chip.querySelector('.chip-text').appendChild(categoryIndicator);
    }
    
    if (isSelected) {
      chip.classList.add('selected');
    }
    
    // Checkbox handler
    const checkbox = chip.querySelector('.chip-checkbox');
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleChip(index, chip);
    });
    
    // Click to select/deselect
    chip.addEventListener('click', (e) => {
      if (e.target.classList.contains('chip-remove')) {
        this.removeChip(index);
      } else if (e.target.classList.contains('chip-breakdown-btn')) {
        e.stopPropagation();
        const textToSend = this.getSelectedOrCurrentText(clip.text, 'clips');
        this.showBreakdownModal(textToSend);
      } else if (e.target.classList.contains('chip-open-btn')) {
        e.stopPropagation();
        if (typeof this.openClipViewer === 'function') {
          this.openClipViewer(clip);
        }
      } else if (e.target.classList.contains('chip-summary-btn')) {
        e.stopPropagation();
        const textToSend = this.getSelectedOrCurrentText(clip.text, 'clips');
        this.showSummaryModal(textToSend);
      } else if (e.target.classList.contains('chip-notes-btn') || e.target.closest('.chip-notes-btn')) {
        e.stopPropagation();
        // Load notes and show album picker
        this.loadNotes().then(() => {
          this.showAlbumPicker();
          // Store the clip to be added
          this.pendingClipForNotes = clip;
        });
      } else if (e.target.classList.contains('chip-category-btn')) {
        e.stopPropagation();
        this.pendingText = clip.text;
        this.pendingClipIndex = index;
        this.showCategoryModal(true);
      } else if (!e.target.classList.contains('chip-checkbox')) {
        this.toggleChip(index, chip);
      }
    });
    
    return chip;
  }
  
  toggleChip(index, chipElement) {
    const checkbox = chipElement.querySelector('.chip-checkbox');
    if (this.selectedChips.has(index)) {
      this.selectedChips.delete(index);
      chipElement.classList.remove('selected');
      if (checkbox) checkbox.checked = false;
    } else {
      this.selectedChips.add(index);
      chipElement.classList.add('selected');
      if (checkbox) checkbox.checked = true;
    }
    this.syncOptionToggles();
    this.updatePreview();
  }
  
  toggleSearchClip(clipId, itemElement) {
    const checkbox = itemElement.querySelector('.search-checkbox');
    if (this.selectedSearchClips.has(clipId)) {
      this.selectedSearchClips.delete(clipId);
      itemElement.classList.remove('selected');
      if (checkbox) checkbox.checked = false;
    } else {
      this.selectedSearchClips.add(clipId);
      itemElement.classList.add('selected');
      if (checkbox) checkbox.checked = true;
    }
    this.updatePreviewFromSearchSelection();
    this.updateSearchBulkActions();
  }
  
  toggleCategoryClip(clipId, itemElement) {
    const checkbox = itemElement.querySelector('.category-checkbox');
    if (this.selectedCategoryClips.has(clipId)) {
      this.selectedCategoryClips.delete(clipId);
      itemElement.classList.remove('selected');
      if (checkbox) checkbox.checked = false;
    } else {
      this.selectedCategoryClips.add(clipId);
      itemElement.classList.add('selected');
      if (checkbox) checkbox.checked = true;
    }
    this.updatePreviewFromSelection();
    this.updateCategoryBulkActions();
  }
  
  syncOptionToggles() {
    // Sync UI toggle states with internal options
    const deduplicateToggle = document.getElementById('deduplicateToggle');
    const sortToggle = document.getElementById('sortToggle');
    const uppercaseToggle = document.getElementById('uppercaseToggle');
    
    if (deduplicateToggle) deduplicateToggle.checked = this.options.deduplicate;
    if (sortToggle) sortToggle.checked = this.options.sort;
    if (uppercaseToggle) uppercaseToggle.checked = this.options.uppercase;
  }
  
  async removeChip(index) {
    const clip = this.clips?.[index];

    this.clips.splice(index, 1);
    await chrome.storage.local.set({ clips: this.clips });
    await this.backupLocalToSync('delete:removeChip');

    this.selectedChips.clear();
    
    // 🔄 AUTO-SYNC TO SUPABASE
    try {
      await pasteCraftSupabase.syncClipsToSupabase(this.clips);
      console.log('✅ Clip deletion synced to Supabase');
    } catch (error) {
      console.error('⚠️ Failed to sync deletion to Supabase:', error);
    }
    
    this.renderChips();
    this.updatePreview();
  }
  
  updateLastCapture() {
    const lastCaptureEl = document.getElementById('lastCapture');
    if (this.clips.length > 0) {
      const lastClip = this.clips[0];
      const timeAgo = this.getTimeAgo(lastClip.timestamp);
      lastCaptureEl.textContent = `Last: ${timeAgo}`;
    } else {
      lastCaptureEl.textContent = 'No recent captures';
    }
  }
  
  getTimeAgo(timestamp) {
    // Handle both timestamp (number) and date string formats
    const now = Date.now();
    const clipTime = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    
    // Validate timestamp
    if (isNaN(clipTime)) {
      return 'unknown';
    }
    
    const diffMs = now - clipTime;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
  
  updatePreview() {
    const previewArea = document.getElementById('previewArea');
    const selectedTexts = Array.from(this.selectedChips)
      .map(index => this.clips[index]?.text)
      .filter(Boolean);
    
    if (selectedTexts.length === 0) {
      // Don't wipe user edits when nothing is selected
      if (!this.previewIsManual && this.previewLastAutoValue) {
        previewArea.value = '';
        this.previewLastAutoValue = '';
      }
      return;
    }
    
    let processedTexts = [...selectedTexts];
    
    // Apply transformations
    if (this.options.deduplicate) {
      processedTexts = [...new Set(processedTexts)];
    }
    
    if (this.options.sort) {
      processedTexts.sort();
    }
    
    if (this.options.uppercase) {
      processedTexts = processedTexts.map(t => t.toUpperCase());
    }
    
    // Apply delimiter
    const delimiters = {
      comma: ', ',
      newline: '\n',
      space: ' ',
      custom: document.getElementById('customDelimiter')?.value || ', '
    };
    
    const output = processedTexts.join(delimiters[this.delimiter] || ', ');
    previewArea.value = output;
    this.previewIsManual = false;
    this.previewLastAutoValue = output;
    
    // Update quick copy button visibility
    this.updateQuickCopyButton();
  }
  
  updateDelimiterExample() {
    const exampleText = document.querySelector('.example-text');
    if (!exampleText) return;
    
    const delimiters = {
      comma: ', ',
      newline: '\n',
      space: ' ',
      custom: document.getElementById('customDelimiter')?.value || ' | '
    };
    
    const delimiter = delimiters[this.delimiter] || ', ';
    const items = ['apple', 'banana', 'cherry'];
    
    // For newline, show it visually
    if (this.delimiter === 'newline') {
      exampleText.textContent = 'apple ↵ banana ↵ cherry';
    } else {
      exampleText.textContent = items.join(delimiter);
    }
  }
  
  // Fallback clipboard method for extension popups (Clipboard API blocked by permissions policy)
  async copyToClipboardFallback(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.log('📋 Clipboard API blocked, using fallback method...');
    }

    // Fallback: Use execCommand with temporary textarea
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (!success) throw new Error('execCommand copy failed');
      return true;
    } catch (e) {
      document.body.removeChild(textarea);
      throw e;
    }
  }
  
  async copyToClipboard() {
    const previewArea = document.getElementById('previewArea');
    const copyBtn = document.getElementById('copyBtn');
    
    if (!previewArea.value) return;
    
    try {
      await this.copyToClipboardFallback(previewArea.value);
      
      // Success feedback
      copyBtn.textContent = 'Copied! ✓';
      copyBtn.classList.add('success');
      
      // Confetti for large copies
      if (this.selectedChips.size >= 5) {
        this.showConfetti();
      }
      
      setTimeout(() => {
        copyBtn.textContent = 'Copy Crafted Output';
        copyBtn.classList.remove('success');
      }, 2000);
      
    } catch (error) {
      console.error('Copy failed:', error);
      copyBtn.textContent = 'Copy Failed';
      setTimeout(() => {
        copyBtn.textContent = 'Copy Crafted Output';
      }, 2000);
    }
  }
  
  async handleQuickCopy() {
    const quickCopyBtn = document.getElementById('quickCopyBtn');
    
    if (this.selectedChips.size === 0) return;
    
    console.log('📋 Quick Copy - Selected indices:', Array.from(this.selectedChips));
    console.log('📋 Quick Copy - Total clips:', this.clips.length);
    
    // Get selected clips text (with safe access to prevent crashes)
    const selectedTexts = Array.from(this.selectedChips)
      .filter(index => index < this.clips.length && this.clips[index]) // Filter valid indices first
      .map(index => this.clips[index].text)
      .filter(Boolean);
    
    console.log('📋 Quick Copy - Valid texts found:', selectedTexts.length);
    
    if (selectedTexts.length === 0) {
      console.warn('⚠️ Quick Copy - No valid texts to copy. Clearing stale selections.');
      this.selectedChips.clear();
      this.updateQuickCopyButton();
      return;
    }
    
    // Apply options (deduplicate, sort, uppercase)
    let processedTexts = [...selectedTexts];
    
    if (this.options.deduplicate) {
      processedTexts = [...new Set(processedTexts)];
    }
    
    if (this.options.sort) {
      processedTexts.sort((a, b) => a.localeCompare(b));
    }
    
    if (this.options.uppercase) {
      processedTexts = processedTexts.map(t => t.toUpperCase());
    }
    
    // Get delimiter
    let delimiter = '\n';
    if (this.delimiter === 'comma') {
      delimiter = ', ';
    } else if (this.delimiter === 'space') {
      delimiter = ' ';
    } else if (this.delimiter === 'pipe') {
      delimiter = ' | ';
    } else if (this.delimiter === 'custom') {
      const customInput = document.getElementById('customDelimiter');
      delimiter = customInput ? customInput.value : '\n';
    }
    
    const textToCopy = processedTexts.join(delimiter);
    
    console.log('📋 Quick Copy - Text to copy:', textToCopy.substring(0, 100) + (textToCopy.length > 100 ? '...' : ''));
    console.log('📋 Quick Copy - Delimiter used:', JSON.stringify(delimiter));
    
    try {
      // Use fallback method for extension popups (Clipboard API is blocked by permissions policy)
      await this.copyToClipboardFallback(textToCopy);
      
      console.log('✅ Quick Copy - Successfully copied to clipboard!');
      
      // Success feedback
      const originalHTML = quickCopyBtn.innerHTML;
      quickCopyBtn.innerHTML = `
        <span class="btn-icon">✓</span>
        <span class="btn-text">Copied!</span>
      `;
      quickCopyBtn.classList.add('success');
      
      // Confetti for large copies
      if (this.selectedChips.size >= 5) {
        this.showConfetti();
      }
      
      setTimeout(() => {
        quickCopyBtn.innerHTML = originalHTML;
        quickCopyBtn.classList.remove('success');
      }, 2000);
      
    } catch (error) {
      console.error('❌ Quick copy failed:', error);
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      const originalHTML = quickCopyBtn.innerHTML;
      quickCopyBtn.innerHTML = `
        <span class="btn-icon">✗</span>
        <span class="btn-text">Failed</span>
      `;
      setTimeout(() => {
        quickCopyBtn.innerHTML = originalHTML;
      }, 2000);
    }
  }

  async handleQuickDelete() {
    const quickDeleteBtn = document.getElementById('quickDeleteBtn');
    if (!quickDeleteBtn) return;

    const selectedIndices = Array.from(this.selectedChips || []).filter(i => Number.isFinite(i));
    if (selectedIndices.length <= 1) return; // only for 2+

    const validIndices = selectedIndices.filter(i => i >= 0 && i < this.clips.length);
    if (validIndices.length <= 1) {
      this.selectedChips.clear();
      this.updateQuickCopyButton();
      return;
    }

    if (!confirm(`Delete ${validIndices.length} selected clip${validIndices.length === 1 ? '' : 's'}?`)) {
      return;
    }

    // Delete from highest index down to avoid reindex issues
    const removed = [];
    validIndices.sort((a, b) => b - a).forEach((idx) => {
      const c = this.clips?.[idx];
      if (c) removed.push({ id: c?.id != null ? String(c.id) : null, idx });
      this.clips.splice(idx, 1);
    });

    await chrome.storage.local.set({ clips: this.clips });
    await this.backupLocalToSync('delete:handleQuickDelete');


    // 🔄 AUTO-SYNC TO SUPABASE
    try {
      await pasteCraftSupabase.syncClipsToSupabase(this.clips);
      console.log('✅ Bulk clip deletion synced to Supabase');
    } catch (error) {
      console.error('⚠️ Failed to sync bulk clip deletion to Supabase:', error);
    }

    // Clear selection + refresh UI
    this.selectedChips.clear();
    this.renderChips();
    this.updatePreview();
    this.updateQuickCopyButton();
    this.showToast(`Deleted ${validIndices.length} clip${validIndices.length === 1 ? '' : 's'}`);
  }
  
  updateQuickCopyButton() {
    const quickCopyBtn = document.getElementById('quickCopyBtn');
    const quickDeleteBtn = document.getElementById('quickDeleteBtn');
    if (!quickCopyBtn) return;
    
    // Show button only if there are selected clips
    if (this.selectedChips.size > 0) {
      quickCopyBtn.style.display = 'flex';
    } else {
      quickCopyBtn.style.display = 'none';
    }

    // Show delete only when 2+ are selected (per requirement)
    if (quickDeleteBtn) {
      if (this.selectedChips.size > 1) {
        quickDeleteBtn.style.display = 'flex';
      } else {
        quickDeleteBtn.style.display = 'none';
        quickDeleteBtn.classList.remove('success');
      }
    }
  }
  
  magicFormat() {
    // Select all clips
    this.clips.forEach((_, index) => {
      this.selectedChips.add(index);
      const chip = document.querySelector(`[data-index="${index}"]`);
      if (chip) chip.classList.add('selected');
    });
    
    // Enable all options
    document.getElementById('deduplicateToggle').checked = true;
    document.getElementById('sortToggle').checked = true;
    this.options.deduplicate = true;
    this.options.sort = true;
    
    // Set comma delimiter
    document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-delimiter="comma"]').classList.add('active');
    this.delimiter = 'comma';
    
    this.updatePreview();
    
    // Magic wand animation
    const wand = document.getElementById('magicWand');
    wand.style.transform = 'scale(1.2) rotate(360deg)';
    setTimeout(() => {
      wand.style.transform = '';
    }, 500);
  }
  
  showConfetti() {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const container = document.body;
    
    for (let i = 0; i < 30; i++) {
      setTimeout(() => {
        const confetti = document.createElement('div');
        confetti.style.cssText = `
          position: fixed;
          width: 6px;
          height: 6px;
          background: ${colors[Math.floor(Math.random() * colors.length)]};
          left: ${Math.random() * 100}vw;
          top: -10px;
          border-radius: 50%;
          pointer-events: none;
          z-index: 9999;
          animation: confetti 3s linear forwards;
        `;
        
        container.appendChild(confetti);
        setTimeout(() => confetti.remove(), 3000);
      }, i * 50);
    }
  }

  // Search and Filter Functions
  renderSearchResults() {
    const container = document.getElementById('searchResults');
    
    if (!this.searchQuery && !this.selectedCategory && !this.selectedDateFilter) {
      container.innerHTML = `
        <div class="empty-search">
          <div class="empty-search-icon">🔍</div>
          <h3>Start searching</h3>
          <p>Type in the search bar to find your clips</p>
        </div>
      `;
      this.updateSearchBulkActions();
      return;
    }

    const filteredClips = this.filterClips();
    
    if (filteredClips.length === 0) {
      container.innerHTML = `
        <div class="empty-search">
          <div class="empty-search-icon">😔</div>
          <h3>No results found</h3>
          <p>Try adjusting your search criteria</p>
        </div>
      `;
      this.updateSearchBulkActions();
      return;
    }

    container.innerHTML = '';
    filteredClips.forEach(clip => {
      const resultItem = this.createSearchResultItem(clip);
      container.appendChild(resultItem);
    });

    this.updateSearchBulkActions();
  }

  // Backwards-compat: older code paths still call this name
  performSearch() {
    this.renderSearchResults();
  }

  filterClips() {
    // Combine active clips and search-only clips for search functionality
    const allClips = [...this.clips, ...this.searchOnlyClips];
    
    return allClips.filter(clip => {
      // Text search
      if (this.searchQuery && !clip.text.toLowerCase().includes(this.searchQuery.toLowerCase())) {
        return false;
      }

      // Category filter
      if (this.selectedCategory && clip.category !== this.selectedCategory) {
        return false;
      }

      // Date filter
      if (this.selectedDateFilter) {
        const clipDate = new Date(clip.timestamp);
        const now = new Date();
        
        switch (this.selectedDateFilter) {
          case 'today':
            if (clipDate.toDateString() !== now.toDateString()) return false;
            break;
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (clipDate < weekAgo) return false;
            break;
          case 'month':
            const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            if (clipDate < monthAgo) return false;
            break;
        }
      }

      return true;
    });
  }

  createSearchResultItem(clip) {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.dataset.clipId = clip.id;
    
    const isSelected = this.selectedSearchClips.has(clip.id);
    if (isSelected) {
      item.classList.add('selected');
    }

    const truncatedText = clip.text.length > 100 ? clip.text.substring(0, 100) + '...' : clip.text;
    const timeAgo = this.getTimeAgo(clip.timestamp);

    item.innerHTML = `
      <input type="checkbox" class="search-checkbox" ${isSelected ? 'checked' : ''}>
      <div class="search-result-content">
        <div class="search-result-text">${this.escapeHtml(truncatedText)}</div>
        <div class="search-result-meta">
          <span class="search-result-category">${clip.category}</span>
          <span>${timeAgo}</span>
        </div>
      </div>
      <div class="search-result-actions">
        <button class="chip-breakdown-btn" title="AI Breakdown">🧠</button>
        <button class="chip-open-btn" title="Open">🔎</button>
        <button class="chip-summary-btn" title="AI Summary">📝</button>
        <button class="search-notes-btn" title="Send to Notes">
          <img src="assets/notebook_354567.svg" alt="" style="width: 14px; height: 14px;">
        </button>
        <button class="chip-category-btn" title="Add to category">📁</button>
        <button class="btn-copy" title="Copy to clipboard">📋</button>
      </div>
    `;
    
    // Checkbox handler
    const checkbox = item.querySelector('.search-checkbox');
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSearchClip(clip.id, item);
    });
    
    // Item click handler for selection
    item.addEventListener('click', (e) => {
      if (!e.target.closest('.search-result-actions') && !e.target.classList.contains('search-checkbox')) {
        this.toggleSearchClip(clip.id, item);
      }
    });

    // Copy functionality
    item.querySelector('.btn-copy').addEventListener('click', (e) => {
      e.stopPropagation();
      this.copyClipToClipboard(clip.text);
    });

    // Breakdown functionality
    item.querySelector('.chip-breakdown-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const textToSend = this.getSelectedOrCurrentText(clip.text, 'search');
      this.showBreakdownModal(textToSend);
    });

    // Open/view functionality
    const openBtn = item.querySelector('.chip-open-btn');
    if (openBtn) {
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof this.openClipViewer === 'function') {
          this.openClipViewer(clip);
        }
      });
    }
    
    // Summary functionality
    item.querySelector('.chip-summary-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const textToSend = this.getSelectedOrCurrentText(clip.text, 'search');
      this.showSummaryModal(textToSend);
    });

    // Send to Notes functionality
    item.querySelector('.search-notes-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      // Load notes and show album picker
      await this.loadNotes();
      this.showAlbumPicker();
      // Store the clip to be added
      this.pendingClipForNotes = clip;
    });

    // Category assignment
    item.querySelector('.chip-category-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const clipIndex = this.clips.findIndex(c => c.id === clip.id);
      this.pendingText = clip.text;
      this.pendingClipIndex = clipIndex;
      this.showCategoryModal(true);
    });

    return item;
  }

  // Category Management Functions
  renderCategories() {
    const container = document.getElementById('categoriesList');
    
    if (this.categories.length === 0) {
      container.innerHTML = `
        <div class="empty-categories">
          <div class="empty-categories-icon">📁</div>
          <h3>No categories yet</h3>
          <p>Create your first category to organize clips</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    // Newest categories first (top of list)
    const categoriesSorted = [...this.categories].sort((a, b) => {
      const aTs = Number(a?.created ?? a?.id ?? 0);
      const bTs = Number(b?.created ?? b?.id ?? 0);
      return bTs - aTs;
    });

    categoriesSorted.forEach(category => {
      const categoryItem = this.createCategoryItem(category);
      container.appendChild(categoryItem);
    });
  }

  createCategoryItem(category) {
    const item = document.createElement('div');
    item.className = 'category-item';

    // Get clips in this category (from both active and archived)
    const allClips = [...this.clips, ...this.searchOnlyClips];
    const clipsInCategory = allClips.filter(clip => clip.category === category.name);
    const clipCount = clipsInCategory.length;
    
    console.log(`📊 Category "${category.name}" has ${clipCount} clips`);

    item.innerHTML = `
      <div class="category-header">
        <div class="category-info">
          <div class="category-icon">${category.icon}</div>
          <div class="category-details">
            <h4>${this.escapeHtml(category.name)}</h4>
            <p>${clipCount}/150 clips</p>
          </div>
        </div>
        <div class="category-header-actions">
          <button class="category-btn edit-category" data-action="edit" title="Edit category">✏️</button>
          <button class="category-btn delete-category" data-action="delete" title="Delete category">🗑️</button>
          <span class="category-expand-icon">▶</span>
        </div>
      </div>
      <div class="category-dropdown" id="dropdown-${category.id}">
        ${this.createCategoryClipsHTML(clipsInCategory, category.id)}
      </div>
    `;

    // Add click handler for expand/collapse
    const header = item.querySelector('.category-header');
    header.addEventListener('click', (e) => {
      // Don't trigger if clicking on action buttons
      if (e.target.closest('.category-header-actions button')) return;
      
      this.toggleCategoryDropdown(item, category);
    });

    // Add event listeners for category actions
    item.querySelector('.edit-category').addEventListener('click', (e) => {
      e.stopPropagation();
      this.editCategory(category);
    });

    item.querySelector('.delete-category').addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteCategory(category);
    });

    return item;
  }

  showCreateCategoryDialog() {
    const name = prompt('Enter category name:');
    if (name && name.trim()) {
      const icon = prompt('Enter category icon (emoji):') || '📁';
      this.createCategory(name.trim(), icon, { originButtonId: 'createCategoryBtn' });
    }
  }

  setActionButtonLoading(buttonId, isLoading, loadingText = 'Loading...') {
    if (!buttonId) return;
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    if (!btn.dataset.originalHtml) {
      btn.dataset.originalHtml = btn.innerHTML;
    }

    if (isLoading) {
      btn.disabled = true;
      btn.innerHTML = `<span class="btn-loading-spinner" aria-hidden="true"></span>${this.escapeHtml(loadingText)}`;
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalHtml;
    }
  }

  async createCategory(name, icon, options = {}) {
    const originButtonId = options?.originButtonId || null;
    this.setActionButtonLoading(originButtonId, true, 'Creating...');

    const category = {
      id: Date.now(),
      name,
      icon,
      created: Date.now()
    };

    this.categories.push(category);
    await chrome.storage.local.set({ categories: this.categories, pc_local_updatedAt: Date.now() });

    // Render immediately so the folder appears instantly (don't block on network sync)
    this.renderCategories();
    this.updateCategoryFilter();

    // If the category modal is open, refresh its options too
    const categoryModal = document.getElementById('categoryModal');
    if (categoryModal && categoryModal.style.display === 'flex') {
      this.populateCategoryOptions();
    }

    // 🔄 AUTO-SYNC TO SUPABASE (background)
    let cleared = false;
    const clearLoading = () => {
      if (cleared) return;
      cleared = true;
      this.setActionButtonLoading(originButtonId, false);
    };

    const fallbackTimer = setTimeout(clearLoading, 8000);

    Promise.resolve()
      .then(() => pasteCraftSupabase.syncCategoriesToSupabase(this.categories))
      .then(() => {
        console.log('✅ Category creation synced to Supabase');
      })
      .catch((error) => {
        console.error('⚠️ Failed to sync category creation to Supabase:', error);
      })
      .finally(() => {
        clearTimeout(fallbackTimer);
        clearLoading();
      });
  }

  async editCategory(category) {
    const newName = prompt('Enter new category name:', category.name);
    if (newName && newName.trim()) {
      const newIcon = prompt('Enter new category icon:', category.icon) || category.icon;
      
      const oldName = category.name;
      category.name = newName.trim();
      category.icon = newIcon;

      // Update clips that use this category
      this.clips.forEach(clip => {
        if (clip.category === oldName) {
          clip.category = newName.trim();
        }
      });

      await chrome.storage.local.set({ 
        categories: this.categories,
        clips: this.clips,
        pc_local_updatedAt: Date.now()
      });
      
      // 🔄 AUTO-SYNC TO SUPABASE
      try {
        await pasteCraftSupabase.syncCategoriesToSupabase(this.categories);
        await pasteCraftSupabase.syncClipsToSupabase(this.clips);
        console.log('✅ Category edit synced to Supabase');
      } catch (error) {
        console.error('⚠️ Failed to sync category edit to Supabase:', error);
      }
      
      this.renderCategories();
      this.updateCategoryFilter();
      this.renderChips();
    }
  }

  async deleteCategory(category) {
    const ok = confirm(`Delete category "${category.name}"? Clips will be moved to "Uncategorized".`);
    if (ok) {
      // Move clips to Uncategorized
      this.clips.forEach(clip => {
        if (clip.category === category.name) {
          clip.category = 'Uncategorized';
        }
      });

      // Move archived clips to Uncategorized too (prevents deleted category lingering in filters/dropdowns)
      this.searchOnlyClips.forEach(clip => {
        if (clip.category === category.name) {
          clip.category = 'Uncategorized';
        }
      });

      // Remove category
      this.categories = this.categories.filter(cat => cat.id !== category.id);
      
      await chrome.storage.local.set({ 
        categories: this.categories,
        clips: this.clips,
        searchOnlyClips: this.searchOnlyClips,
        pc_local_updatedAt: Date.now()
      });

      // Update UI immediately (don't block on network sync)
      this.renderCategories();
      this.updateCategoryFilter();
      this.renderChips();

      // 🔄 AUTO-SYNC TO SUPABASE (background)
      Promise.resolve()
        .then(async () => {
          // Remove the category from Supabase so realtime merge doesn't resurrect it
          try {
            await pasteCraftSupabase.deleteCategoryFromSupabase(String(category?.id ?? ''));
          } catch (_) {}
          await pasteCraftSupabase.syncCategoriesToSupabase(this.categories);
          await pasteCraftSupabase.syncClipsToSupabase(this.clips);
        })
        .then(() => {
          console.log('✅ Category deletion synced to Supabase');
        })
        .catch((error) => {
          console.error('⚠️ Failed to sync category deletion to Supabase:', error);
        });
    }
  }

  updateCategoryFilter() {
    const select = document.getElementById('categoryFilter');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">All Categories</option>';
    
    // Include categories from both active and archived clips
    const allClips = [...this.clips, ...this.searchOnlyClips];
    const uniqueCategories = [...new Set(allClips.map(clip => clip.category))];
    console.log('🎯 Unique categories found in all clips:', uniqueCategories);
    
    uniqueCategories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      select.appendChild(option);
    });
    
    select.value = currentValue;
  }

  updateManualInputCategories() {
    const select = document.getElementById('manualInputCategory');
    if (!select) return;
    
    const currentValue = select.value;
    
    // Include categories from both active and archived clips
    const allClips = [...this.clips, ...this.searchOnlyClips];
    const uniqueCategories = [...new Set(allClips.map(clip => clip.category))];
    
    // Always include Uncategorized
    if (!uniqueCategories.includes('Uncategorized')) {
      uniqueCategories.unshift('Uncategorized');
    }
    
    select.innerHTML = '';
    uniqueCategories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      select.appendChild(option);
    });
    
    // Restore previous selection or default to Uncategorized
    if (uniqueCategories.includes(currentValue)) {
      select.value = currentValue;
    } else {
      select.value = 'Uncategorized';
    }
  }

  // Utility Functions
  // getTimeAgo moved up to line ~1483 to avoid duplication

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async copyClipToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  showToast(message) {
    // Single-instance toast (no stacking) + safe auto-dismiss.
    const TOAST_DURATION_MS = 3000;

    this._toastState = this._toastState || {
      el: null,
      timerId: null,
      lastMessage: null,
      lastShownAt: 0
    };

    const now = Date.now();
    const msg = String(message ?? '');
    if (!msg) return;

    // Dedupe: ignore rapid repeats of the same message (prevents "stuck" toasts from re-firing).
    if (this._toastState.lastMessage === msg && (now - this._toastState.lastShownAt) < 1200) {
      return;
    }
    this._toastState.lastMessage = msg;
    this._toastState.lastShownAt = now;

    // Create once, then reuse.
    if (!this._toastState.el || !this._toastState.el.isConnected) {
      const toast = document.createElement('div');
      toast.setAttribute('data-pastecraft-toast', '1');
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10000;
        opacity: 0;
        transform: translateY(-6px);
        transition: opacity 180ms ease, transform 180ms ease;
        pointer-events: none;
      `;
      document.body.appendChild(toast);
      this._toastState.el = toast;
    }

    const toast = this._toastState.el;
    toast.textContent = msg;

    // Reset any pending dismissal.
    if (this._toastState.timerId) {
      clearTimeout(this._toastState.timerId);
      this._toastState.timerId = null;
    }

    // Show (animate in).
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    // Hide after duration (animate out, then remove).
    this._toastState.timerId = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-6px)';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 220);
    }, TOAST_DURATION_MS);
  }

  // Category Modal Functions
  showCategoryModal(isReassignment = false) {
    this.populateCategoryOptions();
    document.getElementById('categoryModal').style.display = 'flex';
    
    // Reset Add button to disabled state
    document.getElementById('addToCategory').disabled = true;
    
    // Update modal text for reassignment vs new save
    const modalText = document.querySelector('.modal-text');
    if (isReassignment) {
      modalText.textContent = 'Choose a new category for this clip:';
    } else {
      modalText.textContent = 'Where would you like to save this clip?';
    }
  }

  hideCategoryModal() {
    document.getElementById('categoryModal').style.display = 'none';
    this.pendingText = null;
    this.pendingClipIndex = null;
    this.selectedCategoryForSave = 'Uncategorized';
    
    // Reset Add button to disabled state
    document.getElementById('addToCategory').disabled = true;
    
    // Clear selected state from options
    document.querySelectorAll('.category-option').forEach(opt => opt.classList.remove('selected'));
  }

  // Breakdown Modal Functions
  showBreakdownModalWithLevel(text, level) {
    this.currentBreakdownText = text;
    this.currentBreakdownLevel = level;
    this.breakdownCache = {}; // Cache explanations to avoid re-generating
    
    // Set original text
    document.getElementById('breakdownOriginalText').textContent = text;
    
    // Set text length
    const wordCount = text.trim().split(/\s+/).length;
    document.getElementById('breakdownTextLength').textContent = `${wordCount} words`;
    
    // Clear previous result
    document.getElementById('breakdownResult').textContent = '';
    
    // Set active tab to the selected level
    document.querySelectorAll('.breakdown-tab').forEach(tab => {
      if (tab.dataset.level === level) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
    
    // Update level info for the pre-selected level
    this.updateLevelInfo(level);
    
    // Show modal
    document.getElementById('breakdownModal').style.display = 'flex';
    
    // Auto-generate explanation for the selected level
    this.generateBreakdown(level);
  }

  hideBreakdownModal() {
    document.getElementById('breakdownModal').style.display = 'none';
    this.currentBreakdownText = null;
    this.currentBreakdownLevel = null;
    this.breakdownCache = {};
    
    // Reset threads
    this.breakdownThreads = [];
    this.currentBreakdownThreadIndex = 0;
    
    // Hide follow-up and pagination
    const followupContainer = document.getElementById('breakdownFollowupContainer');
    const paginationContainer = document.getElementById('breakdownThreadPagination');
    if (followupContainer) followupContainer.style.display = 'none';
    if (paginationContainer) paginationContainer.style.display = 'none';
    
    // Reset italics state
    const breakdownResult = document.getElementById('breakdownResult');
    const italicsBtn = document.getElementById('breakdownItalicsBtn');
    if (breakdownResult && italicsBtn) {
      breakdownResult.classList.remove('italics');
      italicsBtn.classList.remove('active');
    }
  }

  toggleBreakdownItalics() {
    const breakdownResult = document.getElementById('breakdownResult');
    const italicsBtn = document.getElementById('breakdownItalicsBtn');
    
    if (breakdownResult && italicsBtn) {
      const isActive = breakdownResult.classList.toggle('italics');
      italicsBtn.classList.toggle('active');
      console.log(`✒️ Breakdown Result Italics ${isActive ? 'ENABLED' : 'DISABLED'}`);
    } else {
      console.error('❌ Elements not found:', {breakdownResult, italicsBtn});
    }
  }

  updateLevelInfo(level) {
    const levelDescriptions = {
      eli5: '<strong>Child Level:</strong> Super simple explanation using basic words and fun examples',
      elementary: '<strong>Elementary School Level:</strong> Clear explanation for kids ages 8-11 with relatable examples',
      highschool: '<strong>High School Level:</strong> More sophisticated explanation with relevant concepts for teenagers',
      college: '<strong>College Level:</strong> Academic explanation with detailed analysis and nuanced understanding',
      phd: '<strong>PhD/Expert Level:</strong> Technical analysis with advanced concepts and scholarly depth',
      wiseman: '<strong>Wise Man:</strong> Philosophical wisdom with metaphors, life lessons, and profound insights'
    };

    document.getElementById('levelInfoText').innerHTML = levelDescriptions[level] || '';
  }

  async generateBreakdown(level) {
    // Premium check
    if (this.currentUser && !await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'breakdown')) {
      return;
    }

    // Check cache first
    if (this.breakdownCache[level]) {
      document.getElementById('breakdownResult').textContent = this.breakdownCache[level];
      return;
    }

    const loadingEl = document.getElementById('breakdownLoading');
    const resultEl = document.getElementById('breakdownResult');

    try {
      // Show loading
      loadingEl.style.display = 'flex';
      resultEl.textContent = '';

      // Generate explanation
      const explanation = await pasteCraftSupabase.breakdownText(this.currentBreakdownText, level);

      // Cache the result
      this.breakdownCache[level] = explanation;

      // Show result
      resultEl.textContent = explanation;
      loadingEl.style.display = 'none';

      // Add to threads
      this.breakdownThreads.push({
        question: `Breakdown at ${level} level`,
        answer: explanation,
        level,
        timestamp: Date.now()
      });
      this.currentBreakdownThreadIndex = this.breakdownThreads.length - 1;

      // Show follow-up input after first response
      const followupContainer = document.getElementById('breakdownFollowupContainer');
      if (followupContainer) {
        followupContainer.style.display = 'block';
      }

      // Update thread pagination (only show after 2nd response)
      if (this.breakdownThreads.length >= 2) {
        this.renderThreadPagination('breakdown');
      }

    } catch (error) {
      console.error('Failed to generate breakdown:', error);
      resultEl.textContent = '❌ Failed to generate explanation. Please check your OpenAI API key configuration.';
      loadingEl.style.display = 'none';
      this.showToast('Failed to generate explanation');
    }
  }

  copyBreakdownText() {
    const text = document.getElementById('breakdownResult').textContent;
    if (text) {
      navigator.clipboard.writeText(text);
      this.showToast('Explanation copied to clipboard!');
    }
  }

  // AI Summary Methods
  showSummarySection(section) {
    const inputSection = document.getElementById('summaryInputSection');
    const questionsSection = document.getElementById('summaryQuestionsSection');
    const resultSection = document.getElementById('summaryResultSection');

    // Hide all sections
    if (inputSection) inputSection.style.display = 'none';
    if (questionsSection) questionsSection.style.display = 'none';
    if (resultSection) resultSection.style.display = 'none';

    // Show requested section
    if (section === 'input' && inputSection) {
      inputSection.style.display = 'block';
    } else if (section === 'questions' && questionsSection) {
      questionsSection.style.display = 'block';
    } else if (section === 'result' && resultSection) {
      resultSection.style.display = 'block';
    }
  }

  async generateSummaryQuestions(text) {
    // Premium check
    if (this.currentUser && !await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'summary')) {
      return;
    }

    try {
      this.showSummarySection('questions');
      const questionsLoading = document.getElementById('questionsLoading');
      const questionsList = document.getElementById('questionsList');
      
      // Show loading
      if (questionsLoading) questionsLoading.style.display = 'flex';
      if (questionsList) questionsList.innerHTML = '';

      // Generate questions using AI
      const questions = await pasteCraftSupabase.generateSummaryQuestions(text);
      this.generatedQuestions = questions;

      // Hide loading
      if (questionsLoading) questionsLoading.style.display = 'none';

      // Display questions
      if (questionsList) {
        questions.forEach(question => {
          const chip = document.createElement('button');
          chip.className = 'question-chip';
          chip.textContent = question;
          chip.addEventListener('click', () => {
            this.currentSummaryQuestion = question;
            this.generateSummary(text, question);
          });
          questionsList.appendChild(chip);
        });
      }

      // Clear custom question input
      const customInput = document.getElementById('customQuestionInput');
      if (customInput) {
        customInput.value = '';
        document.getElementById('customQuestionBtn').disabled = true;
      }

    } catch (error) {
      console.error('Failed to generate questions:', error);
      this.showToast('Failed to generate questions. Please check your API key.');
      this.showSummarySection('input');
    }
  }

  async generateSummary(text, question) {
    // Premium check
    if (this.currentUser && !await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'summary')) {
      return;
    }

    try {
      this.showSummarySection('result');
      const summaryLoading = document.getElementById('summaryLoading');
      const summaryContent = document.getElementById('summaryResultContent');

      // Show loading
      if (summaryLoading) summaryLoading.style.display = 'flex';
      if (summaryContent) summaryContent.textContent = '';

      // Generate summary using AI
      const summary = await pasteCraftSupabase.generateSummary(text, question);

      // Hide loading
      if (summaryLoading) summaryLoading.style.display = 'none';

      // Display summary
      if (summaryContent) {
        summaryContent.textContent = summary;
      }

      // Add to threads
      this.summaryThreads.push({
        question,
        answer: summary,
        timestamp: Date.now()
      });
      this.currentSummaryThreadIndex = this.summaryThreads.length - 1;

      // Show follow-up input after first response
      const followupContainer = document.getElementById('summaryFollowupContainer');
      if (followupContainer) {
        followupContainer.style.display = 'block';
      }

      // Update thread pagination (only show after 2nd response)
      if (this.summaryThreads.length >= 2) {
        this.renderThreadPagination('summary');
      }

    } catch (error) {
      console.error('Failed to generate summary:', error);
      const summaryContent = document.getElementById('summaryResultContent');
      if (summaryContent) {
        summaryContent.textContent = '❌ Failed to generate summary. Please check your OpenAI API key configuration.';
      }
      document.getElementById('summaryLoading').style.display = 'none';
      this.showToast('Failed to generate summary');
    }
  }

  // Handle Summary Follow-up
  async handleSummaryFollowup(followupQuestion) {
    const summaryFollowupInput = document.getElementById('summaryFollowupInput');
    if (summaryFollowupInput) {
      summaryFollowupInput.value = '';
      summaryFollowupInput.disabled = true;
    }
    
    const summaryFollowupBtn = document.getElementById('summaryFollowupBtn');
    if (summaryFollowupBtn) {
      summaryFollowupBtn.disabled = true;
    }

    // Generate summary with follow-up question
    await this.generateSummary(this.currentSummaryText, followupQuestion);

    // Re-enable input
    if (summaryFollowupInput) {
      summaryFollowupInput.disabled = false;
    }
  }

  // Handle Breakdown Follow-up
  async handleBreakdownFollowup(followupQuestion) {
    const breakdownFollowupInput = document.getElementById('breakdownFollowupInput');
    if (breakdownFollowupInput) {
      breakdownFollowupInput.value = '';
      breakdownFollowupInput.disabled = true;
    }
    
    const breakdownFollowupBtn = document.getElementById('breakdownFollowupBtn');
    if (breakdownFollowupBtn) {
      breakdownFollowupBtn.disabled = true;
    }

    // Disable level tabs during processing
    this.toggleFollowupLevelTabs(false);

    const loadingEl = document.getElementById('breakdownLoading');
    const resultEl = document.getElementById('breakdownResult');

    try {
      // Show loading
      if (loadingEl) loadingEl.style.display = 'flex';
      if (resultEl) resultEl.textContent = '';

      let answer;
      
      // Use selected level if specified, otherwise use general summary
      if (this.selectedFollowupLevel) {
        console.log('🎯 Generating follow-up at level:', this.selectedFollowupLevel);
        // Generate with specific breakdown level
        const levelPrompt = `Based on the previous explanation, answer this follow-up question at a ${this.selectedFollowupLevel} comprehension level: ${followupQuestion}. Context: "${this.currentBreakdownText.substring(0, 100)}..."`;
        answer = await pasteCraftSupabase.breakdownText(levelPrompt, this.selectedFollowupLevel);
      } else {
        // Generate standard follow-up response
        const contextPrompt = `Based on the previous explanation about "${this.currentBreakdownText.substring(0, 100)}...", answer this follow-up: ${followupQuestion}`;
        answer = await pasteCraftSupabase.generateSummary(this.currentBreakdownText, contextPrompt);
      }

      // Hide loading
      if (loadingEl) loadingEl.style.display = 'none';

      // Display answer
      if (resultEl) {
        resultEl.textContent = answer;
      }

      // Add to threads
      this.breakdownThreads.push({
        question: followupQuestion,
        answer,
        level: this.selectedFollowupLevel || 'standard',
        timestamp: Date.now()
      });
      this.currentBreakdownThreadIndex = this.breakdownThreads.length - 1;

      // Update pagination
      if (this.breakdownThreads.length >= 2) {
        this.renderThreadPagination('breakdown');
      }

      // Reset selected level for next follow-up
      this.selectedFollowupLevel = null;
      document.querySelectorAll('.followup-level-tab').forEach(t => t.classList.remove('selected'));

    } catch (error) {
      console.error('Failed to generate follow-up:', error);
      if (resultEl) {
        resultEl.textContent = '❌ Failed to generate follow-up response.';
      }
      if (loadingEl) loadingEl.style.display = 'none';
      this.showToast('Failed to generate follow-up');
    }

    // Re-enable input
    if (breakdownFollowupInput) {
      breakdownFollowupInput.disabled = false;
    }
  }

  // Toggle Follow-up Level Tabs Enabled/Disabled
  toggleFollowupLevelTabs(enable) {
    const tabs = document.querySelectorAll('.followup-level-tab');
    tabs.forEach(tab => {
      if (enable) {
        tab.classList.remove('disabled');
        tab.disabled = false;
      } else {
        tab.classList.add('disabled');
        tab.disabled = true;
      }
    });
  }

  // Render Thread Pagination Boxes
  renderThreadPagination(type) {
    const threads = type === 'summary' ? this.summaryThreads : this.breakdownThreads;
    const currentIndex = type === 'summary' ? this.currentSummaryThreadIndex : this.currentBreakdownThreadIndex;
    const paginationContainer = document.getElementById(`${type}ThreadPagination`);

    console.log('🔍 renderThreadPagination called:', { type, threadsLength: threads.length, containerFound: !!paginationContainer });

    if (!paginationContainer || threads.length < 2) {
      console.log('⚠️ Early return:', { containerExists: !!paginationContainer, threadsLength: threads.length });
      return;
    }

    // Show pagination
    paginationContainer.style.display = 'flex';
    paginationContainer.style.gap = '8px';
    paginationContainer.innerHTML = '';

    console.log('✅ Rendering', threads.length, 'thread boxes for', type);

    threads.forEach((thread, index) => {
      const box = document.createElement('div');
      box.className = `thread-box ${index === currentIndex ? 'active' : ''}`;
      box.textContent = index + 1;
      
      // Force styling inline as fallback
      box.style.cssText = `
        width: 32px;
        height: 32px;
        border-radius: 6px;
        background: ${index === currentIndex ? 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)' : 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)'};
        border: 2px solid ${index === currentIndex ? '#2563eb' : '#cbd5e1'};
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 700;
        color: ${index === currentIndex ? 'white' : '#64748b'};
        transition: all 0.25s ease;
        position: relative;
      `;
      
      // Generate tooltip with AI summary title
      const tooltipText = this.generateThreadTooltip(thread, index + 1);
      box.setAttribute('data-tooltip', tooltipText);
      box.setAttribute('title', tooltipText); // Fallback native tooltip
      
      box.addEventListener('click', () => {
        this.navigateToThread(type, index);
      });

      paginationContainer.appendChild(box);
      console.log(`✅ Added thread box ${index + 1}, className: "${box.className}"`);
    });

    console.log('✅ Pagination rendered. Container display:', paginationContainer.style.display);
  }

  // Generate tooltip text for thread box
  generateThreadTooltip(thread, number) {
    // Extract first few words as summary title
    const question = thread.question || 'Response';
    const summaryTitle = question.length > 30 ? question.substring(0, 30) + '...' : question;
    return `${number}. "${summaryTitle}"`;
  }

  // Navigate to specific thread
  navigateToThread(type, index) {
    const threads = type === 'summary' ? this.summaryThreads : this.breakdownThreads;
    if (index < 0 || index >= threads.length) return;

    const thread = threads[index];
    const contentEl = document.getElementById(type === 'summary' ? 'summaryResultContent' : 'breakdownResult');

    if (contentEl) {
      contentEl.textContent = thread.answer;
    }

    // Update current index
    if (type === 'summary') {
      this.currentSummaryThreadIndex = index;
    } else {
      this.currentBreakdownThreadIndex = index;
    }

    // Re-render pagination to update active state
    this.renderThreadPagination(type);
  }

  populateCategoryOptions() {
    const container = document.getElementById('categoryOptions');
    const allClips = [...this.clips, ...this.searchOnlyClips];
    
    // Count clips in Uncategorized (unlimited capacity)
    const uncategorizedCount = allClips.filter(clip => clip.category === 'Uncategorized').length;
    const uncategorizedFull = false; // Uncategorized is never full
    
    container.innerHTML = `
      <div class="category-option ${uncategorizedFull ? 'category-full' : ''}" data-category="Uncategorized">
        <div class="category-option-icon">📄</div>
        <span>Uncategorized (${uncategorizedCount}/∞)</span>
        ${uncategorizedFull ? '<span class="full-indicator">FULL</span>' : ''}
        <button class="category-delete-btn" title="Delete this clip">🗑️</button>
      </div>
    `;

    this.categories.forEach(category => {
      const clipsInCategory = allClips.filter(clip => clip.category === category.name).length;
      const isFull = clipsInCategory >= 150;
      
      const option = document.createElement('div');
      option.className = `category-option ${isFull ? 'category-full' : ''}`;
      option.dataset.category = category.name;
      option.innerHTML = `
        <div class="category-option-icon">${category.icon}</div>
        <span>${this.escapeHtml(category.name)} (${clipsInCategory}/150)</span>
        ${isFull ? '<span class="full-indicator">FULL</span>' : ''}
        <button class="category-delete-btn" title="Delete this clip">🗑️</button>
      `;
      container.appendChild(option);
    });
  }

  async handleClipDelete() {
    if (this.pendingClipIndex === null) return;
    
    const clipToDelete = this.clips[this.pendingClipIndex];
    if (!clipToDelete) return;
    
    if (confirm('Delete this clip permanently?')) {

      // Remove the clip
      this.clips.splice(this.pendingClipIndex, 1);
      await chrome.storage.local.set({ clips: this.clips });
      await this.backupLocalToSync('delete:handleClipDelete');

      
      // Sync to Supabase
      try {
        await pasteCraftSupabase.syncClipsToSupabase(this.clips);
        console.log('✅ Clip deletion synced to Supabase');
      } catch (error) {
        console.error('⚠️ Failed to sync clip deletion to Supabase:', error);
      }
      
      // Close modal and refresh UI
      this.hideCategoryModal();
      this.renderChips();
      this.showToast('Clip deleted successfully');
    }
  }

  async saveTextWithCategory() {
    if (!this.pendingText) return;

    if (this.pendingClipIndex !== null) {
      // Reassigning existing clip - check category limit first
      const currentClip = this.clips[this.pendingClipIndex];
      if (currentClip.category !== this.selectedCategoryForSave) {
        // Only check limit if moving to a different category (Uncategorized = unlimited, others = 150 max)
        if (this.selectedCategoryForSave !== 'Uncategorized') {
          const allClips = [...this.clips, ...this.searchOnlyClips];
          const clipsInTargetCategory = allClips.filter(clip => 
            clip.category === this.selectedCategoryForSave && clip.id !== currentClip.id
          );
          
          if (clipsInTargetCategory.length >= 150) {
            this.showToast(`Category "${this.selectedCategoryForSave}" is full (150 clips max). Remove some clips first.`);
            return;
          }
        }
      }
      
      this.clips[this.pendingClipIndex].category = this.selectedCategoryForSave;
      await chrome.storage.local.set({ clips: this.clips, pc_local_updatedAt: Date.now() });
      
      // 🔄 AUTO-SYNC TO SUPABASE
      try {
        await pasteCraftSupabase.syncClipsToSupabase(this.clips);
        console.log('✅ Clip category update synced to Supabase');
      } catch (error) {
        console.error('⚠️ Failed to sync category update to Supabase:', error);
      }
      
      this.renderChips();
      this.renderSearchResults();
      this.renderCategories();
      this.updateCategoryFilter();
      this.showToast(`Moved to ${this.selectedCategoryForSave}!`);
    } else {
      // New clip save - check category limit first (Uncategorized = unlimited, others = 150 max)
      if (this.selectedCategoryForSave !== 'Uncategorized') {
        const allClips = [...this.clips, ...this.searchOnlyClips];
        const clipsInCategory = allClips.filter(clip => clip.category === this.selectedCategoryForSave);
        
        if (clipsInCategory.length >= 150) {
          this.showToast(`Category "${this.selectedCategoryForSave}" is full (150 clips max). Remove some clips first.`);
          return;
        }
      }

      const newClip = {
        id: Date.now() + Math.random(),
        text: this.pendingText,
        category: this.selectedCategoryForSave,
        timestamp: Date.now()
      };

      this.clips.unshift(newClip);
      
      // Enforce 500 clip limit with auto-archive
      await this.enforceClipLimit();

      await chrome.storage.local.set({ clips: this.clips, pc_local_updatedAt: Date.now() });
      
      // 🔄 AUTO-SYNC TO SUPABASE
      try {
        await pasteCraftSupabase.syncClipsToSupabase(this.clips);
        console.log('✅ New clip synced to Supabase');
      } catch (error) {
        console.error('⚠️ Failed to sync new clip to Supabase:', error);
        // Don't block user - local save already succeeded
      }
      
      // Notify content scripts about new clip (for Quick Paste updates)
      try {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'clipSaved',
              clip: newClip,
              autoShow: true // Auto-show when saving from popup
            }).catch(() => {}); // Ignore errors for tabs without content script
          });
        });
      } catch (error) {
        console.log('Could not notify content scripts:', error);
      }
      
    this.renderChips();
    this.renderCategories();
    this.updateCategoryFilter();
    this.updateManualInputCategories();
      this.showToast(`Saved to ${this.selectedCategoryForSave}!`);
    }

    this.hideCategoryModal();
  }

  showCreateCategoryFromModal() {
    const name = prompt('Enter category name:');
    if (name && name.trim()) {
      const icon = prompt('Enter category icon (emoji):') || '📁';
      this.createCategory(name.trim(), icon, { originButtonId: 'createNewCategory' }).then(() => {
        this.populateCategoryOptions();
      });
    }
  }

  // Settings Management Functions
  async loadSettings() {
    const {
      autoDeletePeriod = 'never',
      quickPasteSettings = {},
      albumAttachmentOpenMode = 'overlay'
    } = await chrome.storage.local.get(['autoDeletePeriod', 'quickPasteSettings', 'albumAttachmentOpenMode']);
    this.autoDeletePeriod = autoDeletePeriod;
    this.quickPasteSettings = {
      theme: 'light',
      autoHide: true,
      showTimestamps: true,
      maxClipsDisplay: 20,
      ...quickPasteSettings
    };
    this.albumAttachmentOpenMode =
      albumAttachmentOpenMode === 'overlay' || albumAttachmentOpenMode === 'edgePopup'
        ? albumAttachmentOpenMode
        : 'overlay';
  }

  async saveSettings() {
    const newAutoDeletePeriod = document.getElementById('autoDeletePeriod').value;
    this.autoDeletePeriod = newAutoDeletePeriod;
    
    // Update quick paste settings
    this.quickPasteSettings.theme = document.getElementById('quickPasteThemePopup').value;
    this.quickPasteSettings.autoHide = document.getElementById('quickPasteAutoHidePopup').checked;
    this.quickPasteSettings.showTimestamps = document.getElementById('quickPasteShowTimestampsPopup').checked;
    this.quickPasteSettings.maxClipsDisplay = parseInt(document.getElementById('quickPasteMaxClipsPopup').value);

    const albumAttachmentOpenModeEl = document.getElementById('albumAttachmentOpenMode');
    this.albumAttachmentOpenMode =
      albumAttachmentOpenModeEl && (albumAttachmentOpenModeEl.value === 'overlay' || albumAttachmentOpenModeEl.value === 'edgePopup')
        ? albumAttachmentOpenModeEl.value
        : 'edgePopup';
    
    await chrome.storage.local.set({ 
      autoDeletePeriod: newAutoDeletePeriod,
      quickPasteSettings: this.quickPasteSettings,
      albumAttachmentOpenMode: this.albumAttachmentOpenMode
    });
    
    // 🔄 AUTO-SYNC TO SUPABASE
    try {
      const settingsData = {
        autoDeletePeriod: newAutoDeletePeriod,
        quickPasteSettings: this.quickPasteSettings,
        albumAttachmentOpenMode: this.albumAttachmentOpenMode
      };
      
      await pasteCraftSupabase.syncSettingsToSupabase(settingsData);
      console.log('✅ Settings synced to Supabase');
      this.showToast('✅ Settings saved and synced!');
    } catch (error) {
      console.error('⚠️ Failed to sync settings to Supabase:', error);
      this.showToast('✅ Settings saved locally');
    }
    
    this.hideSettingsModal();
    
    // Run cleanup after changing settings
    await this.cleanupOldClips();
    this.renderChips();
    this.updateCategoryFilter();
    
    // Notify content scripts about settings change
    try {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'settingsUpdated',
            settings: this.quickPasteSettings
          }).catch(() => {}); // Ignore errors for tabs without content script
        });
      });
    } catch (error) {
      console.log('Could not notify content scripts about settings:', error);
    }
  }

  showSettingsModal() {
    // Update storage statistics
    this.updateStorageStats();
    
    // Set current auto-delete period
    document.getElementById('autoDeletePeriod').value = this.autoDeletePeriod;
    
    // Set current quick paste settings
    document.getElementById('quickPasteThemePopup').value = this.quickPasteSettings.theme;
    document.getElementById('quickPasteAutoHidePopup').checked = this.quickPasteSettings.autoHide;
    document.getElementById('quickPasteShowTimestampsPopup').checked = this.quickPasteSettings.showTimestamps;
    document.getElementById('quickPasteMaxClipsPopup').value = this.quickPasteSettings.maxClipsDisplay;

    const albumAttachmentOpenModeEl = document.getElementById('albumAttachmentOpenMode');
    if (albumAttachmentOpenModeEl) albumAttachmentOpenModeEl.value = this.albumAttachmentOpenMode || 'edgePopup';
    
    document.getElementById('settingsModal').style.display = 'flex';
    
  }

  hideSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
  }
  
  showHelpModal() {
    console.log('🔍 Help modal requested');
    document.getElementById('helpModal').style.display = 'flex';
    console.log('✅ Help modal shown');
  }
  
  hideHelpModal() {
    console.log('🙈 Help modal hidden');
    document.getElementById('helpModal').style.display = 'none';
  }
  

  updateStorageStats() {
    const allClips = [...this.clips, ...this.searchOnlyClips];
    const totalClips = allClips.length;
    const categorizedClips = allClips.filter(clip => clip.category !== 'Uncategorized').length;
    const uncategorizedClips = totalClips - categorizedClips;

    document.getElementById('totalClipsCount').textContent = `${totalClips} (${this.clips.length} active, ${this.searchOnlyClips.length} archived)`;
    document.getElementById('categorizedClipsCount').textContent = categorizedClips;
    document.getElementById('uncategorizedClipsCount').textContent = uncategorizedClips;
  }

  // Auto-Delete Functions
  async cleanupOldClips() {
    if (this.autoDeletePeriod === 'never') return;

    const cutoffTime = this.getCutoffTime(this.autoDeletePeriod);
    const initialCount = this.clips.length;

    // Filter out old uncategorized clips
    this.clips = this.clips.filter(clip => {
      const isUncategorized = clip.category === 'Uncategorized';
      const isOld = clip.timestamp < cutoffTime;
      
      // Keep clip if it's categorized OR not old
      return !isUncategorized || !isOld;
    });

    const deletedCount = initialCount - this.clips.length;
    
    if (deletedCount > 0) {
      await chrome.storage.local.set({ clips: this.clips });
      console.log(`🗑️ Auto-deleted ${deletedCount} old uncategorized clips`);
    }
  }

  getCutoffTime(period) {
    const now = Date.now();
    const periods = {
      '1day': 24 * 60 * 60 * 1000,
      '1week': 7 * 24 * 60 * 60 * 1000,
      '1month': 30 * 24 * 60 * 60 * 1000,
      '3months': 90 * 24 * 60 * 60 * 1000,
      '6months': 180 * 24 * 60 * 60 * 1000,
      '1year': 365 * 24 * 60 * 60 * 1000
    };
    
    return now - (periods[period] || 0);
  }

  // Category Dropdown Functions
  createCategoryClipsHTML(clips, categoryId) {
    if (clips.length === 0) {
      return '<div class="category-clip" style="text-align: center; color: #9ca3af; padding: 16px;">No clips in this category</div>';
    }

    return clips.map(clip => {
      const truncatedText = clip.text.length > 60 ? clip.text.substring(0, 60) + '...' : clip.text;
      const timeAgo = this.getTimeAgo(clip.timestamp);
      const isSelected = this.selectedCategoryClips.has(clip.id);
      
      const html = `
        <div class="category-clip ${isSelected ? 'selected' : ''}" data-clip-id="${clip.id}">
          <input type="checkbox" class="category-checkbox" ${isSelected ? 'checked' : ''}>
          <div class="category-clip-content">
            <div class="category-clip-text">${this.escapeHtml(truncatedText)}</div>
            <div class="category-clip-time">${timeAgo}</div>
          </div>
          <div class="category-clip-actions">
            <button class="category-clip-breakdown-btn" data-clip-id="${clip.id}" title="AI Breakdown">🧠</button>
            <button class="category-clip-open-btn" data-clip-id="${clip.id}" title="Open">🔎</button>
            <button class="category-clip-summary-btn" data-clip-id="${clip.id}" title="AI Summary">📝</button>
            <button class="category-clip-notes-btn" data-clip-id="${clip.id}" title="Send to Notes">
              <img src="assets/notebook_354567.svg" alt="" style="width: 14px; height: 14px;">
            </button>
            <button class="category-clip-copy-btn" data-clip-id="${clip.id}" title="Copy">📋</button>
          </div>
        </div>
      `;
      console.log(`🏗️ Creating category clip with ID: ${clip.id} (type: ${typeof clip.id})`);
      return html;
    }).join('');
  }

  toggleCategoryDropdown(categoryItem, category) {
    const dropdown = categoryItem.querySelector('.category-dropdown');
    const isExpanded = categoryItem.classList.contains('expanded');
    
    // Close all other dropdowns
    document.querySelectorAll('.category-item.expanded').forEach(item => {
      if (item !== categoryItem) {
        item.classList.remove('expanded');
        item.querySelector('.category-dropdown').classList.remove('expanded');
      }
    });
    
    if (isExpanded) {
      // Collapse this dropdown
      categoryItem.classList.remove('expanded');
      dropdown.classList.remove('expanded');
    } else {
      // Expand this dropdown
      categoryItem.classList.add('expanded');
      dropdown.classList.add('expanded');
      
      // Add click handlers to clips in dropdown
      this.attachClipHandlers(dropdown, category);
    }
  }

  attachClipHandlers(dropdown, category) {
    const clips = dropdown.querySelectorAll('.category-clip');
    clips.forEach(clipElement => {
      const clipId = parseFloat(clipElement.dataset.clipId);
      
      // Handle checkbox
      const checkbox = clipElement.querySelector('.category-checkbox');
      if (checkbox) {
        checkbox.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleCategoryClip(clipId, clipElement);
        });
      }
      
      // Handle breakdown button
      const breakdownBtn = clipElement.querySelector('.category-clip-breakdown-btn');
      if (breakdownBtn) {
        breakdownBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const allClips = [...this.clips, ...this.searchOnlyClips];
          const clip = allClips.find(c => c.id === clipId);
          if (clip) {
            const textToSend = this.getSelectedOrCurrentText(clip.text, 'categories');
            this.showBreakdownModal(textToSend);
          }
        });
      }

      // Handle open/view button
      const openBtn = clipElement.querySelector('.category-clip-open-btn');
      if (openBtn) {
        openBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const allClips = [...this.clips, ...this.searchOnlyClips];
          const clip = allClips.find(c => c.id === clipId);
          if (clip && typeof this.openClipViewer === 'function') {
            this.openClipViewer(clip);
          }
        });
      }
      
      // Handle summary button
      const summaryBtn = clipElement.querySelector('.category-clip-summary-btn');
      if (summaryBtn) {
        summaryBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const allClips = [...this.clips, ...this.searchOnlyClips];
          const clip = allClips.find(c => c.id === clipId);
          if (clip) {
            const textToSend = this.getSelectedOrCurrentText(clip.text, 'categories');
            this.showSummaryModal(textToSend);
          }
        });
      }

      // Handle send to notes button
      const notesBtn = clipElement.querySelector('.category-clip-notes-btn');
      if (notesBtn) {
        notesBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const allClips = [...this.clips, ...this.searchOnlyClips];
          const clip = allClips.find(c => c.id === clipId);
          if (clip) {
            // Load notes and show album picker
            await this.loadNotes();
            this.showAlbumPicker();
            // Store the clip to be added
            this.pendingClipForNotes = clip;
          }
        });
      }

      // Handle copy button
      const copyBtn = clipElement.querySelector('.category-clip-copy-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const allClips = [...this.clips, ...this.searchOnlyClips];
          const clip = allClips.find(c => c.id === clipId);
          if (clip) {
            this.copyClipToClipboard(clip.text);
          }
        });
      }

      // Handle clip selection (clicking on clip itself, not buttons or checkbox)
      clipElement.addEventListener('click', (e) => {
        // Only toggle selection if not clicking on buttons or checkbox
        if (!e.target.closest('.category-clip-actions') && !e.target.classList.contains('category-checkbox')) {
          e.stopPropagation();
          this.toggleCategoryClip(clipId, clipElement);
        }
      });
    });
  }

  toggleClipSelection(clipElement, category) {
    const clipId = parseFloat(clipElement.dataset.clipId); // Convert string to number
    const isSelected = clipElement.classList.contains('selected');
    
    console.log(`🎯 Toggling clip selection - ID: ${clipId} (${typeof clipId}), Currently selected: ${isSelected}`);
    
    if (isSelected) {
      clipElement.classList.remove('selected');
      console.log(`❌ Deselecting clip ${clipId}`);
      // Remove from selection tracking
      this.removeClipFromSelection(clipId);
    } else {
      clipElement.classList.add('selected');
      console.log(`✅ Selecting clip ${clipId}`);
      // Add to selection tracking
      this.addClipToSelection(clipId);
    }
    
    this.updatePreviewFromSelection();
  }

  addClipToSelection(clipId) {
    if (!this.selectedCategoryClips) {
      this.selectedCategoryClips = new Set();
    }
    this.selectedCategoryClips.add(clipId);
    console.log(`✅ Added clip ${clipId} to selection. Total:`, Array.from(this.selectedCategoryClips));
  }

  removeClipFromSelection(clipId) {
    if (this.selectedCategoryClips) {
      this.selectedCategoryClips.delete(clipId);
    }
    console.log(`🗑️ Removed clip ${clipId} from selection. Remaining:`, Array.from(this.selectedCategoryClips));
  }

  updatePreviewFromSelection() {
    console.log('🔄 Updating preview from selection:', this.selectedCategoryClips?.size || 0, 'clips selected');
    
    if (!this.selectedCategoryClips || this.selectedCategoryClips.size === 0) {
      // Don't wipe user edits when nothing is selected
      if (!this.previewIsManual && this.previewLastAutoValue) {
        document.getElementById('previewArea').value = '';
        this.previewLastAutoValue = '';
      }
      console.log('📄 Preview cleared - no clips selected');
      this.updateCategoryBulkActions();
      return;
    }

    // Get selected clips
    const allClips = [...this.clips, ...this.searchOnlyClips];
    console.log('🔍 All clips available:', allClips.map(c => ({id: c.id, text: c.text.substring(0, 20)})));
    console.log('🎯 Selected clip IDs:', Array.from(this.selectedCategoryClips));

    // Preserve CURRENT UI ORDER (DOM order in expanded category dropdowns)
    const orderedSelectedIds = this.getSelectedCategoryClipIdsInUiOrder();
    const selectedClips = orderedSelectedIds
      .map((clipId) => {
        const found = allClips.find(clip => clip.id === clipId);
        console.log(`🔎 Looking for clip ${clipId} (${typeof clipId}), found:`, found ? found.text.substring(0, 20) : 'NOT FOUND');
        return found;
      })
      .filter(Boolean);

    console.log('📋 Found selected clips:', selectedClips.length);

    // Apply formatting
    let processedTexts = selectedClips.map(clip => clip.text);
    
    // Apply transformations
    if (this.options.deduplicate) {
      processedTexts = [...new Set(processedTexts)];
      console.log('🔄 Applied deduplication');
    }
    
    if (this.options.sort) {
      processedTexts.sort();
      console.log('⬆️ Applied sorting');
    }
    
    if (this.options.uppercase) {
      processedTexts = processedTexts.map(text => text.toUpperCase());
      console.log('🔤 Applied uppercase');
    }

    // Apply delimiter
    const delimiters = {
      comma: ', ',
      newline: '\n',
      space: ' ',
      custom: document.getElementById('customDelimiter')?.value || ', '
    };
    
    const delimiter = delimiters[this.delimiter] || delimiters.comma;
    const formattedText = processedTexts.join(delimiter);
    
    document.getElementById('previewArea').value = formattedText;
    this.previewIsManual = false;
    this.previewLastAutoValue = formattedText;
    console.log('✅ Preview updated with formatted text:', formattedText.substring(0, 50) + '...');
    this.updateCategoryBulkActions();
  }

  getSelectedCategoryClipIdsInUiOrder() {
    if (!this.selectedCategoryClips || this.selectedCategoryClips.size === 0) return [];

    const selected = this.selectedCategoryClips;
    const ordered = [];

    // Prefer DOM order of expanded dropdowns (true UI order)
    const domClips = document.querySelectorAll('.category-item.expanded .category-clip');
    if (domClips && domClips.length > 0) {
      domClips.forEach(el => {
        const id = parseFloat(el.dataset.clipId);
        if (selected.has(id)) ordered.push(id);
      });
    }

    // Fallback: stable data order from storage if DOM not available
    if (ordered.length === 0) {
      const allClips = [...this.clips, ...this.searchOnlyClips];
      allClips.forEach(c => {
        if (selected.has(c.id)) ordered.push(c.id);
      });
    }

    return ordered;
  }

  updateCategoryBulkActions() {
    const bar = document.getElementById('categoryBulkActions');
    const countEl = document.getElementById('categoryBulkCount');
    if (!bar || !countEl) return;

    const count = this.selectedCategoryClips ? this.selectedCategoryClips.size : 0;

    if (this.currentTab === 'categories' && count > 0) {
      bar.style.display = 'flex';
      countEl.textContent = `${count} selected`;
    } else {
      bar.style.display = 'none';
      countEl.textContent = '';
      const copyBtn = document.getElementById('categoryBulkCopyBtn');
      if (copyBtn) copyBtn.classList.remove('success');
    }
  }

  async handleCategoryBulkCopy() {
    if (!this.selectedCategoryClips || this.selectedCategoryClips.size === 0) return;

    // Ensure preview matches selection + UI order + delimiter/options
    this.updatePreviewFromSelection();
    const previewArea = document.getElementById('previewArea');
    const textToCopy = previewArea ? previewArea.value : '';
    if (!textToCopy) return;

    const copyBtn = document.getElementById('categoryBulkCopyBtn');
    const originalText = copyBtn ? copyBtn.textContent : 'copy';

    try {
      await this.copyToClipboardFallback(textToCopy);
      if (copyBtn) {
        copyBtn.textContent = 'copied ✓';
        copyBtn.classList.add('success');
      }
      setTimeout(() => {
        if (copyBtn) {
          copyBtn.textContent = originalText;
          copyBtn.classList.remove('success');
        }
      }, 1400);
    } catch (error) {
      console.error('❌ Category bulk copy failed:', error);
      if (copyBtn) {
        copyBtn.textContent = 'failed';
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 1400);
      }
    }
  }

  async handleCategoryBulkDelete() {
    const count = this.selectedCategoryClips ? this.selectedCategoryClips.size : 0;
    if (count === 0) return;

    if (!confirm(`Delete ${count} selected clip${count === 1 ? '' : 's'}?`)) return;

    const ids = new Set(this.selectedCategoryClips);
    const beforeActive = this.clips.length;
    const beforeArchived = this.searchOnlyClips.length;


    this.clips = this.clips.filter(c => !ids.has(c.id));
    this.searchOnlyClips = this.searchOnlyClips.filter(c => !ids.has(c.id));

    await chrome.storage.local.set({
      clips: this.clips,
      searchOnlyClips: this.searchOnlyClips
    });
    await this.backupLocalToSync('delete:handleCategoryBulkDelete');

    try {
      await pasteCraftSupabase.syncClipsToSupabase(this.clips);
      await pasteCraftSupabase.syncArchivedClipsToSupabase(this.searchOnlyClips);
      console.log('✅ Bulk deletion synced to Supabase');
    } catch (error) {
      console.error('⚠️ Failed to sync bulk deletion to Supabase:', error);
    }

    this.selectedCategoryClips.clear();
    document.getElementById('previewArea').value = '';
    this.renderChips();
    this.renderSearchResults();
    this.renderCategories();
    this.updateCategoryFilter();
    this.updateManualInputCategories();
    this.updateCategoryBulkActions();

    const deletedCount = (beforeActive - this.clips.length) + (beforeArchived - this.searchOnlyClips.length);
    this.showToast(`Deleted ${deletedCount} clip${deletedCount === 1 ? '' : 's'}`);
  }

  getSelectedSearchClipIdsInUiOrder() {
    if (!this.selectedSearchClips || this.selectedSearchClips.size === 0) return [];

    const selected = this.selectedSearchClips;
    const ordered = [];

    // UI order = DOM order of current search results
    const domItems = document.querySelectorAll('#searchResults .search-result-item');
    if (domItems && domItems.length > 0) {
      domItems.forEach(el => {
        const id = parseFloat(el.dataset.clipId);
        if (selected.has(id)) ordered.push(id);
      });
    }

    // Fallback: storage order
    if (ordered.length === 0) {
      const allClips = [...this.clips, ...this.searchOnlyClips];
      allClips.forEach(c => {
        if (selected.has(c.id)) ordered.push(c.id);
      });
    }

    return ordered;
  }

  updatePreviewFromSearchSelection() {
    if (!this.selectedSearchClips || this.selectedSearchClips.size === 0) return;

    const previewArea = document.getElementById('previewArea');
    if (!previewArea) return;

    const allClips = [...this.clips, ...this.searchOnlyClips];
    const orderedIds = this.getSelectedSearchClipIdsInUiOrder();
    const selectedClips = orderedIds.map(id => allClips.find(c => c.id === id)).filter(Boolean);

    if (selectedClips.length === 0) return;

    let processedTexts = selectedClips.map(c => c.text);

    if (this.options.deduplicate) {
      processedTexts = [...new Set(processedTexts)];
    }
    if (this.options.sort) {
      processedTexts.sort();
    }
    if (this.options.uppercase) {
      processedTexts = processedTexts.map(t => t.toUpperCase());
    }

    const delimiters = {
      comma: ', ',
      newline: '\n',
      space: ' ',
      custom: document.getElementById('customDelimiter')?.value || ', '
    };
    const delimiter = delimiters[this.delimiter] || delimiters.comma;
    const formattedText = processedTexts.join(delimiter);

    previewArea.value = formattedText;
    this.previewIsManual = false;
    this.previewLastAutoValue = formattedText;
  }

  updateSearchBulkActions() {
    const bar = document.getElementById('searchBulkActions');
    const countEl = document.getElementById('searchBulkCount');
    if (!bar || !countEl) return;

    const visibleSelectedCount = this.getSelectedSearchClipIdsInUiOrder().length;

    if (this.currentTab === 'search' && visibleSelectedCount > 1) {
      bar.style.display = 'flex';
      countEl.textContent = `${visibleSelectedCount} selected`;
    } else {
      bar.style.display = 'none';
      countEl.textContent = '';
      const copyBtn = document.getElementById('searchBulkCopyBtn');
      if (copyBtn) copyBtn.classList.remove('success');
    }
  }

  async handleSearchBulkCopy() {
    const orderedIds = this.getSelectedSearchClipIdsInUiOrder();
    if (orderedIds.length <= 1) return; // only show/copy for 2+

    // Ensure preview matches current selection + options + delimiter
    this.updatePreviewFromSearchSelection();
    const previewArea = document.getElementById('previewArea');
    const textToCopy = previewArea ? previewArea.value : '';
    if (!textToCopy) return;

    const copyBtn = document.getElementById('searchBulkCopyBtn');
    const originalText = copyBtn ? copyBtn.textContent : 'copy';

    try {
      await this.copyToClipboardFallback(textToCopy);
      if (copyBtn) {
        copyBtn.textContent = 'copied ✓';
        copyBtn.classList.add('success');
      }
      setTimeout(() => {
        if (copyBtn) {
          copyBtn.textContent = originalText;
          copyBtn.classList.remove('success');
        }
      }, 1400);
    } catch (error) {
      console.error('❌ Search bulk copy failed:', error);
      if (copyBtn) {
        copyBtn.textContent = 'failed';
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 1400);
      }
    }
  }

  // Search-Only Storage Management
  async moveToSearchStorage(overflowClips) {
    const { searchOnlyClips = [] } = await chrome.storage.local.get(['searchOnlyClips']);
    searchOnlyClips.unshift(...overflowClips);
    
    // Keep search storage reasonable (max 1000 total archived clips)
    if (searchOnlyClips.length > 1000) {
      searchOnlyClips.splice(1000);
    }
    
    this.searchOnlyClips = searchOnlyClips;
    await chrome.storage.local.set({ searchOnlyClips });
    console.log(`📦 Moved ${overflowClips.length} clips to search-only storage`);
    
    // 🔄 AUTO-SYNC TO SUPABASE
    try {
      await pasteCraftSupabase.syncArchivedClipsToSupabase(this.searchOnlyClips);
      console.log('✅ Archived clips synced to Supabase');
    } catch (error) {
      console.error('⚠️ Failed to sync archived clips to Supabase:', error);
    }
  }

  // Profile Management Functions
  async loadUserProfile() {
    try {
      console.log('🔄 Loading user profile from chrome.storage.local...');
      const { userProfile = null } = await chrome.storage.local.get(['userProfile']);
      this.userProfile = userProfile;
      console.log('✅ Loaded user profile:', this.userProfile);
      
      if (this.userProfile?.profileImageUrl) {
        console.log('✅ Profile image URL found:', this.userProfile.profileImageUrl);
      } else {
        console.log('ℹ️ No profile image URL in saved profile');
      }
    } catch (error) {
      console.error('❌ CRITICAL: Failed to load user profile:', error);
    }
  }

  updateTopBarIdentity(imageUrlOverride = undefined) {
    const topBar = document.getElementById('topBar');
    const topLeftContainer = document.getElementById('topLeftProfileImage');
    const topLeftImg = document.getElementById('topLeftProfileImg');
    const topLeftPlaceholder = document.getElementById('topLeftProfilePlaceholder');
    const nameEl = document.getElementById('topBarFunkyName');
    const nameSection = nameEl?.closest?.('.top-bar-name-section') || null;

    if (!topBar || !topLeftContainer) return;

    // Always show top bar when authenticated
    topBar.style.display = 'flex';
    topLeftContainer.style.display = 'flex';

    const profileImageUrl =
      (typeof imageUrlOverride === 'string' ? imageUrlOverride : null) ??
      this.userProfile?.profileImageUrl ??
      '';

    // Image / placeholder
    if (!profileImageUrl) {
      if (topLeftImg) {
        topLeftImg.src = '';
        topLeftImg.style.display = 'none';
      }
      if (topLeftPlaceholder) topLeftPlaceholder.style.display = 'flex';
    } else if (topLeftImg) {
      topLeftImg.src = profileImageUrl;
      topLeftImg.style.display = 'block';
      if (topLeftPlaceholder) topLeftPlaceholder.style.display = 'none';

      topLeftImg.onerror = () => {
        topLeftImg.style.display = 'none';
        if (topLeftPlaceholder) topLeftPlaceholder.style.display = 'flex';
      };
    }

    // Display name: prefer user's name, fallback to funky animal name, then email prefix
    const userName = typeof this.userProfile?.userName === 'string' ? this.userProfile.userName.trim() : '';
    const funkyName = typeof this.userProfile?.aiGeneratedName === 'string' ? this.userProfile.aiGeneratedName.trim() : '';
    const emailPrefix = typeof this.currentUser?.email === 'string' ? this.currentUser.email.split('@')[0] : '';
    const displayName = userName || funkyName || emailPrefix || '';

    if (nameEl) {
      nameEl.textContent = displayName;
      nameEl.style.display = displayName ? 'inline-block' : 'none';
    }

    // Enable marquee only if name overflows
    if (nameSection) {
      nameSection.classList.remove('is-marquee');
      nameSection.style.removeProperty('--pc-marquee-distance');
      nameSection.style.removeProperty('--pc-marquee-duration');

      if (displayName && nameEl) {
        // Wait a tick so layout measurements are accurate
        requestAnimationFrame(() => {
          const available = nameSection.clientWidth;
          const needed = nameEl.scrollWidth;
          const distance = Math.max(0, needed - available);
          if (distance > 6) {
            // ~30px/sec, clamp duration to keep readable
            const duration = Math.min(18, Math.max(8, distance / 30));
            nameSection.style.setProperty('--pc-marquee-distance', String(distance));
            nameSection.style.setProperty('--pc-marquee-duration', `${duration}s`);
            nameSection.classList.add('is-marquee');
          }
        });
      }
    }
  }

  async saveUserProfile() {
    try {
      console.log('💾 Attempting to save user profile:', this.userProfile);
      await chrome.storage.local.set({ userProfile: this.userProfile });
      console.log('✅ User profile saved successfully to chrome.storage.local');
      
      // Verify the save worked
      const verification = await chrome.storage.local.get(['userProfile']);
      console.log('🔍 Verification - Profile in storage:', verification.userProfile);
      
      if (!verification.userProfile || !verification.userProfile.profileImageUrl) {
        console.error('⚠️ WARNING: Profile saved but verification failed!');
      }
      
      // 🔄 AUTO-SYNC TO SUPABASE
      try {
        await pasteCraftSupabase.syncUserProfileToSupabase(this.userProfile);
        console.log('✅ User profile synced to Supabase');
      } catch (syncError) {
        console.error('⚠️ Failed to sync profile to Supabase:', syncError);
        // Don't fail the whole save if sync fails
      }

      // Keep top bar in sync with latest profile data
      this.updateTopBarIdentity();
    } catch (error) {
      console.error('❌ CRITICAL: Failed to save user profile:', error);
      this.showToast('❌ Failed to save profile image', 'error');
    }
  }

  showProfileModal() {
    document.getElementById('profileModal').style.display = 'flex';
    
    // Load existing profile data
    if (this.userProfile) {
      if (this.userProfile.userName) {
        document.getElementById('userName').value = this.userProfile.userName;
      }
      if (this.userProfile.aiGeneratedName) {
        document.getElementById('aiNameValue').textContent = this.userProfile.aiGeneratedName;
        document.getElementById('aiNameDisplay').style.display = 'flex';
      }
      if (this.userProfile.profileImageUrl) {
        document.getElementById('profileImage').src = this.userProfile.profileImageUrl;
        document.getElementById('profileImage').style.display = 'block';
        document.getElementById('profileImagePlaceholder').style.display = 'none';
      }
    }

    // Update AI Generate button state based on uploaded photo
    this.updateAIGenerateButtonState();

    // Setup profile modal event listeners
    this.setupProfileModalEvents();
    
    // Add scroll listener for sticky profile image effect
    const modalBody = document.querySelector('#profileModal .modal-body');
    const imageContainer = document.querySelector('.profile-image-container');
    
    if (modalBody && imageContainer) {
      // Remove old listener if exists
      modalBody.removeEventListener('scroll', this.profileScrollHandler);
      
      // Create new handler
      this.profileScrollHandler = () => {
        if (modalBody.scrollTop > 50) {
          imageContainer.classList.add('scrolled');
        } else {
          imageContainer.classList.remove('scrolled');
        }
      };
      
      // Add listener
      modalBody.addEventListener('scroll', this.profileScrollHandler);
      console.log('✅ Profile image sticky scroll behavior enabled');
    }
  }
  
  updateAIGenerateButtonState() {
    const generateAnimalBtn = document.getElementById('generateAnimalBtn');
    const generateCartoonBtn = document.getElementById('generateCartoonBtn');
    
    console.log('🔄 Updating button states...');
    console.log('AI Generated Name:', this.userProfile?.aiGeneratedName);
    console.log('Photo uploaded:', !!this.userProfile?.profileImageBase64);
    
    // Enable Animal Avatar if AI name is generated
    if (this.userProfile && this.userProfile.aiGeneratedName) {
      const match = this.userProfile.aiGeneratedName.match(/(Rabbit|Tiger|Dragon|Fox|Wolf|Bear|Panda|Lion|Eagle|Phoenix|Unicorn|Owl|Cat|Dog|Monkey|Penguin|Koala|Raccoon|Shark|Dolphin|Cheetah|Leopard|Panther|Otter|Lynx|Jaguar|Cougar|Sloth|Badger|Moose|Bison|Rhino|Elephant|Giraffe|Zebra|Kangaroo|Platypus|Hamster|Ferret|Squirrel|Chipmunk|Hawk|Falcon|Raven|Crow|Parrot|Toucan|Flamingo|Peacock|Swan|Hummingbird|Octopus|Whale|Orca|Seal|Walrus|Seahorse|Stingray|Snake|Gecko|Chameleon|Turtle|Crocodile|Alligator|Griffin|Hydra|Pegasus|Kraken)$/i);
      console.log('Animal match found:', match ? match[1] : 'none');
      if (match) {
        generateAnimalBtn.disabled = false;
        generateAnimalBtn.classList.remove('btn-disabled');
        generateAnimalBtn.textContent = `🐾 ${match[1]} Avatar`;
        generateAnimalBtn.title = `Generate funky ${match[1]} avatar`;
        console.log(`✅ Animal Avatar button enabled for ${match[1]}`);
      } else {
        generateAnimalBtn.disabled = true;
        generateAnimalBtn.classList.add('btn-disabled');
        generateAnimalBtn.title = 'No animal detected in funky animal name';
        console.log('⚠️ AI name has no animal type');
      }
    } else {
      generateAnimalBtn.disabled = true;
      generateAnimalBtn.classList.add('btn-disabled');
      generateAnimalBtn.title = 'Generate funky animal name first';
      console.log('⚠️ No AI name generated yet');
    }
    
    // Enable My Cartoon if photo is uploaded
    if (this.userProfile && this.userProfile.profileImageBase64) {
      generateCartoonBtn.disabled = false;
      generateCartoonBtn.classList.remove('btn-disabled');
      generateCartoonBtn.title = 'Generate cartoon from your photo';
    } else {
      generateCartoonBtn.disabled = true;
      generateCartoonBtn.classList.add('btn-disabled');
      generateCartoonBtn.title = 'Upload a photo first';
    }
  }

  hideProfileModal() {
    document.getElementById('profileModal').style.display = 'none';
  }

  setupProfileModalEvents() {
    // Prevent multiple event listener attachments
    const profileModal = document.getElementById('profileModal');
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const generateImageBtn = document.getElementById('generateImageBtn');
    const generateNameBtn = document.getElementById('generateNameBtn');
    const saveUserNameBtn = document.getElementById('saveUserNameBtn');
    const saveAiNameBtn = document.getElementById('saveAiNameBtn');
    const unsubscribeBtn = document.getElementById('unsubscribeBtn');
    const profileImageUpload = document.getElementById('profileImageUpload');
    const nameToggleBtn = document.getElementById('nameToggleBtn');
    const photoToggleBtn = document.getElementById('photoToggleBtn');
    const nameRegHeader = document.getElementById('nameRegHeader');
    const photoCreationHeader = document.getElementById('photoCreationHeader');

    // Get new buttons
    const generateAnimalBtn = document.getElementById('generateAnimalBtn');
    const generateCartoonBtn = document.getElementById('generateCartoonBtn');

    
    // Remove old listeners by cloning and replacing nodes (for buttons)
    const newUploadBtn = uploadImageBtn.cloneNode(true);
    uploadImageBtn.replaceWith(newUploadBtn);
    
    const newGenerateAnimalBtn = generateAnimalBtn.cloneNode(true);
    generateAnimalBtn.replaceWith(newGenerateAnimalBtn);
    
    const newGenerateCartoonBtn = generateCartoonBtn.cloneNode(true);
    generateCartoonBtn.replaceWith(newGenerateCartoonBtn);
    
    const newSaveUserNameBtn = saveUserNameBtn.cloneNode(true);
    saveUserNameBtn.replaceWith(newSaveUserNameBtn);

    const newGenerateNameBtn = generateNameBtn.cloneNode(true);
    generateNameBtn.replaceWith(newGenerateNameBtn);

    const newSaveAiNameBtn = saveAiNameBtn.cloneNode(true);
    saveAiNameBtn.replaceWith(newSaveAiNameBtn);
    
    const newUnsubscribeBtn = unsubscribeBtn.cloneNode(true);
    unsubscribeBtn.replaceWith(newUnsubscribeBtn);

    // ✅ FIX: Clone and replace headers to remove stacked event listeners
    const newNameRegHeader = nameRegHeader.cloneNode(true);
    nameRegHeader.replaceWith(newNameRegHeader);
    
    const newPhotoCreationHeader = photoCreationHeader.cloneNode(true);
    photoCreationHeader.replaceWith(newPhotoCreationHeader);

    // Collapse/Expand handlers for Name Registration (using new cloned element)
    newNameRegHeader.addEventListener('click', () => {
      this.toggleSection('nameRegContent', 'nameToggleBtn');
    });

    // Collapse/Expand handlers for Photo Creation (using new cloned element)
    newPhotoCreationHeader.addEventListener('click', () => {
      this.toggleSection('photoCreationContent', 'photoToggleBtn');
    });

    // Loading exit button - allows user to skip waiting
    const loadingExitBtn = document.getElementById('loadingExitBtn');
    if (loadingExitBtn) {
      loadingExitBtn.addEventListener('click', () => {
        console.log('⏭️ User clicked exit button - hiding loading overlay');
        document.getElementById('profileImageLoading').style.display = 'none';
        // Show placeholder or existing image
        const profileImage = document.getElementById('profileImage');
        const placeholder = document.getElementById('profileImagePlaceholder');
        if (profileImage && profileImage.src) {
          profileImage.style.display = 'block';
        } else if (placeholder) {
          placeholder.style.display = 'flex';
        }
        // Generation continues in background
        console.log('✅ Loading screen closed - generation continues in background');
      });
    }

    // Upload image button - attach to NEW cloned button
    newUploadBtn.addEventListener('click', (e) => {
      profileImageUpload.click();
    });

    // Profile image upload
    profileImageUpload.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await this.handleProfileImageUpload(file);
      }
    });

    // Generate Animal Avatar - attach to NEW cloned button
    console.log('🔘 Attaching Generate Animal listener');
    newGenerateAnimalBtn.addEventListener('click', async () => {
      console.log('🖱️ Generate Animal Avatar button CLICKED!');
      await this.generateAnimalAvatar();
    });
    console.log('✅ Generate Animal event listener attached');
    
    // Generate Cartoon from Photo - attach to NEW cloned button
    console.log('🔘 Attaching Generate Cartoon listener');
    newGenerateCartoonBtn.addEventListener('click', async () => {
      console.log('🖱️ Generate My Cartoon button CLICKED!');
      await this.generateMyCartoon();
    });
    console.log('✅ Generate Cartoon event listener attached');

    // Generate AI name - attach to NEW cloned button
    newGenerateNameBtn.addEventListener('click', async () => {
      console.log('🖱️ Generate Name button CLICKED!');
      await this.generateAIName();
    });

    // Save user name - attach to NEW cloned button
    newSaveUserNameBtn.addEventListener('click', async () => {
      try {
        const userName = document.getElementById('userName').value.trim();
        if (!userName) {
          this.showToast('⚠️ Please enter a name first', 'error');
          return;
        }

        if (!this.userProfile) this.userProfile = {};
        this.userProfile.userName = userName;

        await this.saveUserProfile();
        this.showToast('✅ Name saved', 'success');
      } catch (error) {
        console.error('Failed to save name:', error);
        this.showToast('❌ Failed to save name', 'error');
      }
    });

    // Save funky animal name - attach to NEW cloned button
    newSaveAiNameBtn.addEventListener('click', async () => {
      try {
        const aiNameFromUi = document.getElementById('aiNameValue')?.textContent?.trim() || '';
        const aiName = aiNameFromUi || (typeof this.userProfile?.aiGeneratedName === 'string' ? this.userProfile.aiGeneratedName.trim() : '');

        if (!aiName || aiName === '-') {
          this.showToast('⚠️ Please generate a funky animal name first', 'error');
          return;
        }

        if (!this.userProfile) this.userProfile = {};
        this.userProfile.aiGeneratedName = aiName;

        await this.saveUserProfile();
        this.updateAIGenerateButtonState();
        this.showToast('✅ Funky name saved', 'success');
      } catch (error) {
        console.error('Failed to save funky name:', error);
        this.showToast('❌ Failed to save funky name', 'error');
      }
    });

    // Unsubscribe - attach to NEW cloned button
    newUnsubscribeBtn.addEventListener('click', () => {
      console.log('🖱️ Unsubscribe button CLICKED!');
      this.showUnsubscribeConfirmation();
    });

    // Modal overlay click to close
    profileModal.addEventListener('click', (e) => {
      if (e.target.id === 'profileModal') {
        this.hideProfileModal();
      }
    });
  }
  
  toggleSection(contentId, toggleBtnId) {
    const content = document.getElementById(contentId);
    const toggleBtn = document.getElementById(toggleBtnId);
    
    if (content.classList.contains('collapsed')) {
      // Expand
      content.classList.remove('collapsed');
      toggleBtn.classList.remove('collapsed');
      toggleBtn.textContent = '▼';
    } else {
      // Collapse
      content.classList.add('collapsed');
      toggleBtn.classList.add('collapsed');
      toggleBtn.textContent = '▶';
    }
  }

  async handleProfileImageUpload(file) {
    try {
      this.showToast('📤 Uploading image...', 'info');
      
      // Convert to base64 for preview
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageUrl = e.target.result;
        
        // Display image
        document.getElementById('profileImage').src = imageUrl;
        document.getElementById('profileImage').style.display = 'block';
        document.getElementById('profileImagePlaceholder').style.display = 'none';
        
        // Save to profile
        if (!this.userProfile) {
          this.userProfile = {};
        }
        this.userProfile.profileImageUrl = imageUrl;
        this.userProfile.profileImageBase64 = imageUrl;
        
        await this.saveUserProfile();
        
        // Update AI Generate button state (enable it now)
        this.updateAIGenerateButtonState();
        
        this.showToast('✅ Profile image uploaded! Now you can generate AI avatar!', 'success');
      };
      reader.readAsDataURL(file);
      
    } catch (error) {
      console.error('Failed to upload profile image:', error);
      this.showToast('❌ Failed to upload image', 'error');
    }
  }

  async generateAnimalAvatar() {
    console.log('🐾 generateAnimalAvatar() CALLED!');
    
    // Premium check
    let hasAvatarAccess = true;
    if (this.currentUser) {
      hasAvatarAccess = await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'avatar');
    }
    if (!hasAvatarAccess) {
      return;
    }

    try {
      const userName = document.getElementById('userName').value.trim();
      const aiGeneratedName = this.userProfile?.aiGeneratedName;
      const animalMatch = aiGeneratedName?.match(/(Rabbit|Tiger|Dragon|Fox|Wolf|Bear|Panda|Lion|Eagle|Phoenix|Unicorn|Owl|Cat|Dog|Monkey|Penguin|Koala|Raccoon|Shark|Dolphin|Cheetah|Leopard|Panther|Otter|Lynx|Jaguar|Cougar|Sloth|Badger|Moose|Bison|Rhino|Elephant|Giraffe|Zebra|Kangaroo|Platypus|Hamster|Ferret|Squirrel|Chipmunk|Hawk|Falcon|Raven|Crow|Parrot|Toucan|Flamingo|Peacock|Swan|Hummingbird|Octopus|Whale|Orca|Seal|Walrus|Seahorse|Stingray|Snake|Gecko|Chameleon|Turtle|Crocodile|Alligator|Griffin|Hydra|Pegasus|Kraken)$/i);
      
      if (!userName || !aiGeneratedName) {
        this.showToast('⚠️ Please generate a funky animal name first', 'error');
        return;
      }
      
      // Extract animal type
      const match = aiGeneratedName.match(/(Rabbit|Tiger|Dragon|Fox|Wolf|Bear|Panda|Lion|Eagle|Phoenix|Unicorn|Owl|Cat|Dog|Monkey|Penguin|Koala|Raccoon|Shark|Dolphin|Cheetah|Leopard|Panther|Otter|Lynx|Jaguar|Cougar|Sloth|Badger|Moose|Bison|Rhino|Elephant|Giraffe|Zebra|Kangaroo|Platypus|Hamster|Ferret|Squirrel|Chipmunk|Hawk|Falcon|Raven|Crow|Parrot|Toucan|Flamingo|Peacock|Swan|Hummingbird|Octopus|Whale|Orca|Seal|Walrus|Seahorse|Stingray|Snake|Gecko|Chameleon|Turtle|Crocodile|Alligator|Griffin|Hydra|Pegasus|Kraken)$/i);
      if (!match) {
        this.showToast('⚠️ No animal found in your funky animal name', 'error');
        return;
      }
      
      const animalType = match[1];
      
      // Show loading animation
      document.getElementById('profileImageLoading').style.display = 'flex';
      document.querySelector('.loading-text').textContent = `Creating your ${animalType}...`;
      document.getElementById('profileImage').style.display = 'none';
      document.getElementById('profileImagePlaceholder').style.display = 'none';
      
      this.showToast(`🐾 Creating your funky ${animalType}...`, 'info');
      document.getElementById('generateAnimalBtn').disabled = true;
      document.getElementById('generateAnimalBtn').textContent = `⏳ Creating...`;

      const description = `${userName} - ${animalType} avatar`;
      const imageUrl = await pasteCraftSupabase.generateProfileImage(description, 'animal', aiGeneratedName);

      if (imageUrl) {
        // Hide loading, display generated image
        document.getElementById('profileImageLoading').style.display = 'none';
        document.getElementById('profileImage').src = imageUrl;
        document.getElementById('profileImage').style.display = 'block';
        document.getElementById('profileImagePlaceholder').style.display = 'none';
        
        // ✅ AUTO-SAVE TO STORAGE
        if (!this.userProfile) {
          this.userProfile = {};
        }
        this.userProfile.generatedImageUrl = imageUrl;
        this.userProfile.profileImageUrl = imageUrl; // Set as active profile image
        await this.saveUserProfile();
        console.log('✅ Animal avatar auto-saved to storage');
        
        // ✅ ADD TO AI GALLERY
        await this.addToGallery(imageUrl, 'profile');
        console.log('✅ Animal avatar added to AI Gallery');
        
        // ✅ DISPLAY TOP-LEFT
        this.displayImageTopLeft(imageUrl);
        
        // ✅ AUTO-COLLAPSE SECTION AFTER 10 SECONDS (with timer countdown)
        this.startProfileImageCollapse();
        
        const animalType = match[1];
        this.showToast(`✅ ${animalType} avatar created and saved!`, 'success');
      }
      
    } catch (error) {
      console.error('Failed to generate animal avatar:', error);
      document.getElementById('profileImageLoading').style.display = 'none';
      document.getElementById('profileImagePlaceholder').style.display = 'flex';
      this.showToast('❌ Failed to generate animal avatar', 'error');
    } finally {
      document.getElementById('generateAnimalBtn').disabled = false;
      document.getElementById('generateAnimalBtn').textContent = '🐾 Animal Avatar';
    }
  }
  
  async generateMyCartoon() {
    console.log('🎨 generateMyCartoon() CALLED!');
    
    // Premium check
    let hasCartoonAccess = true;
    if (this.currentUser) {
      hasCartoonAccess = await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'cartoon');
    }
    if (!hasCartoonAccess) {
      return;
    }

    try {
      const userName = document.getElementById('userName').value.trim();
      const userImageBase64 = this.userProfile?.profileImageBase64;
      
      if (!userName) {
        this.showToast('⚠️ Please enter your name first', 'error');
        return;
      }
      
      if (!userImageBase64) {
        this.showToast('⚠️ Please upload a photo first', 'error');
        return;
      }

      // Show loading animation
      document.getElementById('profileImageLoading').style.display = 'flex';
      document.querySelector('.loading-text').textContent = 'Creating your cartoon...';
      document.getElementById('profileImage').style.display = 'none';
      document.getElementById('profileImagePlaceholder').style.display = 'none';
      
      this.showToast('🎨 Creating your cartoon avatar...', 'info');
      document.getElementById('generateCartoonBtn').disabled = true;
      document.getElementById('generateCartoonBtn').textContent = '⏳ Creating...';

      const description = `${userName} - cartoon avatar`;
      const imageUrl = await pasteCraftSupabase.generateProfileImage(description, userImageBase64, null);

      if (imageUrl) {
        // Hide loading, display generated image
        document.getElementById('profileImageLoading').style.display = 'none';
        document.getElementById('profileImage').src = imageUrl;
        document.getElementById('profileImage').style.display = 'block';
        document.getElementById('profileImagePlaceholder').style.display = 'none';

        // ✅ AUTO-SAVE TO STORAGE
        if (!this.userProfile) {
          this.userProfile = {};
        }
        this.userProfile.profileImageUrl = imageUrl;
        this.userProfile.aiGeneratedImage = true;
        await this.saveUserProfile();
        console.log('✅ Cartoon image auto-saved to storage');
        
        // ✅ ADD TO AI GALLERY
        await this.addToGallery(imageUrl, 'profile');
        console.log('✅ Cartoon image added to AI Gallery');
        
        // ✅ DISPLAY TOP-LEFT
        this.displayImageTopLeft(imageUrl);
        
        // ✅ AUTO-COLLAPSE SECTION AFTER 10 SECONDS (with timer countdown)
        this.startProfileImageCollapse();
        
        if (userImageBase64) {
          this.showToast('✅ Your funky cartoon remix is ready and saved!', 'success');
        } else {
          this.showToast('✅ AI image generated and saved!', 'success');
        }
      } else {
        document.getElementById('profileImageLoading').style.display = 'none';
        document.getElementById('profileImagePlaceholder').style.display = 'flex';
        this.showToast('❌ Failed to generate AI image', 'error');
      }

    } catch (error) {
      console.error('Failed to generate AI profile image:', error);
      
      // Hide loading on error
      document.getElementById('profileImageLoading').style.display = 'none';
      document.getElementById('profileImagePlaceholder').style.display = 'flex';
      
      // Show more helpful error message
      const errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('quota') || errorMessage.includes('billing')) {
        this.showToast('❌ OpenAI API quota exceeded. Check your billing.', 'error');
      } else if (errorMessage.includes('invalid')) {
        this.showToast('❌ Invalid API key. Check config.js', 'error');
      } else {
        this.showToast(`❌ Error: ${errorMessage}`, 'error');
      }
    } finally {
      document.getElementById('generateCartoonBtn').disabled = false;
      document.getElementById('generateCartoonBtn').textContent = '🎨 My Cartoon';
    }
  }

  async generateAIName() {
    // Premium check
    if (this.currentUser && !await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'name')) {
      return;
    }

    try {
      const userName = document.getElementById('userName').value.trim();
      
      if (!userName) {
        this.showToast('⚠️ Please enter your name first', 'error');
        return;
      }

      this.showToast('🎭 Generating funky animal name...', 'info');
      document.getElementById('generateNameBtn').disabled = true;
      document.getElementById('generateNameBtn').textContent = '⏳ Generating...';

      const aiName = await pasteCraftSupabase.generateAIName(userName);

      if (aiName) {
        // Display AI name
        document.getElementById('aiNameValue').textContent = aiName;
        document.getElementById('aiNameDisplay').style.display = 'flex';

        // Save to profile
        if (!this.userProfile) {
          this.userProfile = {};
        }
        this.userProfile.userName = userName;
        this.userProfile.aiGeneratedName = aiName; // Fixed: was aiName, now aiGeneratedName
        
        await this.saveUserProfile();
        
        // Update button states to enable Animal Avatar
        this.updateAIGenerateButtonState();
        
        // ✅ SHOW COUNTDOWN TIMER AND AUTO-COLLAPSE SECTION
        this.startNameSectionCollapse();
        
        this.showToast('✅ Funky animal name generated!', 'success');
      } else {
        this.showToast('❌ Failed to generate funky animal name', 'error');
      }

    } catch (error) {
      console.error('Failed to generate AI name:', error);
      this.showToast('❌ Failed to generate funky animal name', 'error');
    } finally {
      document.getElementById('generateNameBtn').disabled = false;
      document.getElementById('generateNameBtn').textContent = 'Generate Funky Animal Name';
    }
  }

  showUnsubscribeConfirmation() {
    if (confirm('⚠️ Are you sure you want to unsubscribe from PasteCraft?\n\nThis will:\n• Delete all your clips\n• Remove all categories\n• Clear your profile data\n• This action cannot be undone!')) {
      if (confirm('🚨 FINAL WARNING: This will permanently delete ALL your data. Continue?')) {
        this.handleUnsubscribe();
      }
    }
  }

  async handleUnsubscribe() {
    try {
      this.showToast('🗑️ Deleting all data...', 'info');

      // Clear all storage
      await chrome.storage.local.clear();

      // Clear in-memory data
      this.clips = [];
      this.searchOnlyClips = [];
      this.categories = [];
      this.userProfile = null;

      // Update UI
    this.renderChips();
    this.renderCategories();
    this.updateCategoryFilter();
    this.updateManualInputCategories();
      this.hideProfileModal();

      this.showToast('✅ All data deleted. You have been unsubscribed.', 'success');

      console.log('🗑️ User unsubscribed - all data cleared');

    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      this.showToast('❌ Failed to unsubscribe', 'error');
    }
  }

  // Display image and funky name in top bar
  displayImageTopLeft(imageUrl) {
    console.log('🖼️ displayImageTopLeft() called with URL:', imageUrl);
    this.updateTopBarIdentity(imageUrl);
    console.log('✅ Top bar identity updated');
  }

  // Auto-collapse profile name section after generation
  autoCollapseNameSection() {
    const content = document.getElementById('nameRegContent');
    const toggleBtn = document.getElementById('nameToggleBtn');
    const timer = document.getElementById('nameCountdownTimer');
    
    if (content && toggleBtn && !content.classList.contains('collapsed')) {
      // Hide countdown timer
      if (timer) {
        timer.style.display = 'none';
      }
      
      // Collapse the section
      content.classList.add('collapsed');
      toggleBtn.classList.add('collapsed');
      toggleBtn.textContent = '▶';
      
      console.log('✅ Name section auto-collapsed');
    }
  }

  // Start 10-second countdown with visible timer before collapsing name section
  startNameSectionCollapse() {
    const timer = document.getElementById('nameCountdownTimer');
    const countdownValue = document.getElementById('nameCountdownValue');
    
    if (!timer || !countdownValue) return;
    
    let timeLeft = 10;
    timer.style.display = 'flex';
    countdownValue.textContent = timeLeft;
    
    console.log(`⏱️ Starting 10-second visible countdown for name section`);
    
    // Clear any existing countdown
    if (this.nameCollapseInterval) {
      clearInterval(this.nameCollapseInterval);
    }
    
    this.nameCollapseInterval = setInterval(() => {
      timeLeft--;
      countdownValue.textContent = timeLeft;
      console.log(`⏱️ Name section collapse in ${timeLeft}s...`);
      
      if (timeLeft <= 0) {
        clearInterval(this.nameCollapseInterval);
        this.nameCollapseInterval = null;
        this.autoCollapseNameSection();
      }
    }, 1000);
  }

  // Auto-collapse profile photo section after generation
  autoCollapsePhotoSection() {
    const content = document.getElementById('photoCreationContent');
    const toggleBtn = document.getElementById('photoToggleBtn');
    const timer = document.getElementById('photoCountdownTimer');
    
    if (content && toggleBtn && !content.classList.contains('collapsed')) {
      // Hide countdown timer
      if (timer) {
        timer.style.display = 'none';
      }
      
      // Collapse the section
      content.classList.add('collapsed');
      toggleBtn.classList.add('collapsed');
      toggleBtn.textContent = '▶';
      
      console.log('✅ Photo section auto-collapsed');
    }
  }

  // Start 10-second countdown with visible timer before collapsing profile image section
  startProfileImageCollapse() {
    const timer = document.getElementById('photoCountdownTimer');
    const countdownValue = document.getElementById('photoCountdownValue');
    
    if (!timer || !countdownValue) return;
    
    let timeLeft = 10;
    timer.style.display = 'flex';
    countdownValue.textContent = timeLeft;
    
    console.log(`⏱️ Starting 10-second visible countdown for photo section`);
    
    // Clear any existing countdown
    if (this.profileCollapseInterval) {
      clearInterval(this.profileCollapseInterval);
    }
    
    this.profileCollapseInterval = setInterval(() => {
      timeLeft--;
      countdownValue.textContent = timeLeft;
      console.log(`⏱️ Photo section collapse in ${timeLeft}s...`);
      
      if (timeLeft <= 0) {
        clearInterval(this.profileCollapseInterval);
        this.profileCollapseInterval = null;
        this.autoCollapsePhotoSection();
      }
    }, 1000);
  }

  // Setup Image Viewer for expanded view
  setupImageViewer() {
    const modal = document.getElementById('imageViewerModal');
    const modalImg = document.getElementById('imageViewerImg');
    const closeBtn = document.getElementById('imageViewerClose');
    const profileImage = document.getElementById('profileImage');
    const topLeftImg = document.getElementById('topLeftProfileImg');
    
    // Function to show expanded image
    const showExpandedImage = (imgSrc) => {
      if (!imgSrc || imgSrc === '') return;
      modalImg.src = imgSrc;
      modal.style.display = 'flex';
    };
    
    // Click on profile image in modal
    if (profileImage) {
      profileImage.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event bubbling
        if (profileImage.style.display !== 'none') {
          showExpandedImage(profileImage.src);
        }
      });
    }
    
    // Click on top-left profile image
    if (topLeftImg) {
      // Remove the old onclick that opens profile modal
      const topLeftContainer = document.getElementById('topLeftProfileImage');
      if (topLeftContainer) {
        topLeftContainer.onclick = null; // Remove old handler
        topLeftImg.addEventListener('click', (e) => {
          e.stopPropagation();
          showExpandedImage(topLeftImg.src);
        });
      }
    }
    
    // Close button
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
      });
    }
    
    // Click outside image to close
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    }
    
    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        modal.style.display = 'none';
      }
    });
  }

  // Password strength indicator and validation
  updatePasswordStrength(password) {
    const strengthBar = document.querySelector('.strength-bar');
    if (!strengthBar) return;

    let strength = 0;
    
    // Check requirements
    const hasLength = password.length >= 8;
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    // Update requirement indicators
    this.updateRequirement('req-length', hasLength);
    this.updateRequirement('req-number', hasNumber);
    this.updateRequirement('req-special', hasSpecial);
    
    // Calculate strength
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    
    // Complexity checks
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (hasNumber) strength += 12.5;
    if (hasSpecial) strength += 12.5;
    
    strengthBar.style.width = `${strength}%`;
    
    // Color based on strength
    if (strength < 40) {
      strengthBar.style.background = '#EF4444'; // Red
    } else if (strength < 70) {
      strengthBar.style.background = '#F59E0B'; // Orange
    } else {
      strengthBar.style.background = '#10B981'; // Green
    }
  }

  // Update password requirement indicator
  updateRequirement(elementId, isValid) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const icon = element.querySelector('.requirement-icon');
    if (isValid) {
      element.classList.add('valid');
      if (icon) icon.textContent = '✓';
    } else {
      element.classList.remove('valid');
      if (icon) icon.textContent = '✗';
    }
  }

  // Validate password meets all requirements
  validatePassword(password) {
    const hasLength = password.length >= 8;
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    return hasLength && hasNumber && hasSpecial;
  }

  // Update password strength for new password form
  updateNewPasswordStrength(password) {
    const strengthBar = document.querySelector('#newPasswordStrength .strength-bar');
    if (!strengthBar) return;

    let strength = 0;
    
    // Check requirements
    const hasLength = password.length >= 8;
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    // Update requirement indicators
    this.updateRequirement('new-req-length', hasLength);
    this.updateRequirement('new-req-number', hasNumber);
    this.updateRequirement('new-req-special', hasSpecial);
    
    // Calculate strength
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (hasNumber) strength += 12.5;
    if (hasSpecial) strength += 12.5;
    
    strengthBar.style.width = `${strength}%`;
    
    if (strength < 40) {
      strengthBar.style.background = '#EF4444';
    } else if (strength < 70) {
      strengthBar.style.background = '#F59E0B';
    } else {
      strengthBar.style.background = '#10B981';
    }
  }

  // Check if passwords match
  checkPasswordMatch() {
    const newPassword = document.getElementById('newPassword')?.value || '';
    const confirmPassword = document.getElementById('confirmNewPassword')?.value || '';
    const matchHint = document.getElementById('passwordMatchHint');
    
    if (!matchHint) return;
    
    if (confirmPassword.length > 0) {
      if (newPassword === confirmPassword) {
        matchHint.textContent = '✅ Passwords match';
        matchHint.style.color = '#10B981';
        matchHint.style.display = 'block';
      } else {
        matchHint.textContent = '❌ Passwords do not match';
        matchHint.style.color = '#DC2626';
        matchHint.style.display = 'block';
      }
    } else {
      matchHint.style.display = 'none';
    }
  }

  // Global message handler for background script
  static async handleMessage(message) {
    const popup = window.pasteCraftPopup;
    if (!popup) return;
    
    if (message.action === 'showCategoryModal' && message.text) {
      // This will be called from background script
      popup.pendingText = message.text;
      popup.showCategoryModal(false);
    } else if (message.action === 'clipSaved') {
      // Clip was saved externally (e.g., via context menu)
      console.log('📢 Received clipSaved message - reloading data...');
      
      // Reload clips and categories from storage
      await popup.loadData();
      
      // Re-render the UI to show updated counts
      popup.renderCategories();
      
      // If we're on the clips tab, refresh the clips display too
      if (popup.currentTab === 'clips') {
        popup.renderChips();
      }
      
      console.log('✅ UI refreshed with new clip data');
    }
  }

  // =====================================================
  // AI GALLERY & GENERATION METHODS
  // =====================================================

  async loadAIGallery() {
    try {
      // Get gallery from storage
      const result = await chrome.storage.local.get('aiGallery');
      const gallery = result.aiGallery || [];
      
      this.renderAIGallery(gallery);
    } catch (error) {
      console.error('Failed to load AI gallery:', error);
    }
  }

  renderAIGallery(gallery) {
    const galleryGrid = document.getElementById('aiGalleryGrid');
    const galleryCount = document.getElementById('aiGalleryCount');
    const paginationContainer = document.getElementById('aiGalleryPagination');
    
    if (!galleryGrid || !galleryCount) return;
    
    const imagesPerPage = 4;
    const totalPages = Math.ceil(gallery.length / imagesPerPage);
    
    if (!this.currentGalleryPage) this.currentGalleryPage = 1;
    if (this.currentGalleryPage > totalPages && totalPages > 0) this.currentGalleryPage = totalPages;
    
    galleryCount.textContent = `${gallery.length} image${gallery.length !== 1 ? 's' : ''}`;
    
    if (gallery.length === 0) {
      galleryGrid.innerHTML = `
        <div class="ai-gallery-empty">
          <div class="ai-empty-icon">🎨</div>
          <h4>No images yet</h4>
          <p>Generate your first AI image to start your gallery</p>
        </div>
      `;
      if (paginationContainer) paginationContainer.style.display = 'none';
      return;
    }
    
    const startIndex = (this.currentGalleryPage - 1) * imagesPerPage;
    const endIndex = startIndex + imagesPerPage;
    const currentPageImages = gallery.slice(startIndex, endIndex);
    const currentProfileUrl = this.userProfile?.profileImageUrl;
    
    galleryGrid.innerHTML = currentPageImages.map((item, pageIndex) => {
      const actualIndex = startIndex + pageIndex;
      const isCurrentProfile = item.url === currentProfileUrl;
      return `
      <div class="ai-gallery-item ${isCurrentProfile ? 'is-profile' : ''}" data-index="${actualIndex}">
        <img src="${item.url}" alt="AI Generated ${actualIndex + 1}" />
        ${isCurrentProfile ? '<div class="ai-profile-badge">✓ Profile</div>' : ''}
        <div class="ai-gallery-item-actions">
          <button class="ai-gallery-action-btn set-profile" data-action="set-profile" data-index="${actualIndex}" title="Set as Profile Image">
            👤
          </button>
          <button class="ai-gallery-action-btn delete" data-action="delete" data-index="${actualIndex}" title="Delete">
            🗑️
          </button>
        </div>
      </div>
    `;
    }).join('');
    
    this.setupGalleryEventListeners();
    this.renderGalleryPagination(totalPages);
  }

  setupGalleryEventListeners() {
    const galleryGrid = document.getElementById('aiGalleryGrid');
    if (!galleryGrid) return;
    
    galleryGrid.removeEventListener('click', this.handleGalleryClick);
    this.handleGalleryClick = (e) => {
      const button = e.target.closest('.ai-gallery-action-btn');
      if (!button) return;
      
      e.stopPropagation();
      const action = button.dataset.action;
      const index = parseInt(button.dataset.index);
      
      if (action === 'set-profile') {
        this.setAsProfile(index);
      } else if (action === 'delete') {
        this.deleteFromGallery(index);
      }
    };
    
    galleryGrid.addEventListener('click', this.handleGalleryClick);
  }

  renderGalleryPagination(totalPages) {
    const paginationContainer = document.getElementById('aiGalleryPagination');
    if (!paginationContainer) return;
    
    if (totalPages <= 1) {
      paginationContainer.style.display = 'none';
      return;
    }
    
    paginationContainer.style.display = 'flex';
    
    let paginationHTML = '';
    
    paginationHTML += `
      <button class="pagination-btn" ${this.currentGalleryPage === 1 ? 'disabled' : ''} 
        data-page="${this.currentGalleryPage - 1}">
        ◀
      </button>
    `;
    
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentGalleryPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
      paginationHTML += `<button class="pagination-btn" data-page="1">1</button>`;
      if (startPage > 2) paginationHTML += `<span class="pagination-ellipsis">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
      paginationHTML += `
        <button class="pagination-btn ${i === this.currentGalleryPage ? 'active' : ''}" 
          data-page="${i}">
          ${i}
        </button>
      `;
    }
    
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) paginationHTML += `<span class="pagination-ellipsis">...</span>`;
      paginationHTML += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
    }
    
    paginationHTML += `
      <button class="pagination-btn" ${this.currentGalleryPage === totalPages ? 'disabled' : ''} 
        data-page="${this.currentGalleryPage + 1}">
        ▶
      </button>
    `;
    
    paginationContainer.innerHTML = paginationHTML;
    
    this.setupPaginationEventListeners();
  }

  setupPaginationEventListeners() {
    const paginationContainer = document.getElementById('aiGalleryPagination');
    if (!paginationContainer) return;
    
    paginationContainer.removeEventListener('click', this.handlePaginationClick);
    this.handlePaginationClick = (e) => {
      const button = e.target.closest('.pagination-btn');
      if (!button || button.disabled) return;
      
      const page = parseInt(button.dataset.page);
      if (!isNaN(page)) {
        this.goToGalleryPage(page);
      }
    };
    
    paginationContainer.addEventListener('click', this.handlePaginationClick);
  }

  async goToGalleryPage(page) {
    this.currentGalleryPage = page;
    const result = await chrome.storage.local.get('aiGallery');
    const gallery = result.aiGallery || [];
    this.renderAIGallery(gallery);
  }

  async setAsProfile(index) {
    try {
      const result = await chrome.storage.local.get('aiGallery');
      const gallery = result.aiGallery || [];
      
      if (index >= 0 && index < gallery.length) {
        const imageUrl = gallery[index].url;
        
        if (!this.userProfile) {
          this.userProfile = {};
        }
        
        this.userProfile.profileImageUrl = imageUrl;
        await this.saveUserProfile();
        
        this.displayImageTopLeft(imageUrl);
        
        this.renderAIGallery(gallery);
        
        this.showToast('✓ Profile image updated!', 'success');
      }
    } catch (error) {
      console.error('Failed to set profile image:', error);
      this.showToast('❌ Failed to set profile image', 'error');
    }
  }

  async deleteFromGallery(index) {
    try {
      const result = await chrome.storage.local.get('aiGallery');
      const gallery = result.aiGallery || [];
      
      if (index >= 0 && index < gallery.length) {
        gallery.splice(index, 1);
        await chrome.storage.local.set({ aiGallery: gallery });
        
        this.renderAIGallery(gallery);
        this.showToast('🗑️ Image removed from gallery', 'success');
      }
    } catch (error) {
      console.error('Failed to delete from gallery:', error);
      this.showToast('❌ Failed to delete image', 'error');
    }
  }

  async generateAIImageFromProfile() {
    try {
      if (!this.userProfile?.aiGeneratedName) {
        this.showToast('⚠️ Generate your funky name first in Profile!', 'error');
        return;
      }
      
      this.showToast('🎨 Generating AI image...', 'info');
      document.getElementById('aiGenerateFromProfileBtn').disabled = true;
      document.getElementById('aiGenerateFromProfileBtn').textContent = '⏳ Generating...';
      
      const imageUrl = await pasteCraftSupabase.generateProfileImage(null, null, this.userProfile.aiGeneratedName);
      
      if (imageUrl) {
        // Add to gallery
        await this.addToGallery(imageUrl, 'profile');
        
        this.showToast('✅ AI image generated!', 'success');
        this.showAIGenerationTimer();
        this.loadAIGallery();
      } else {
        this.showToast('❌ Failed to generate AI image', 'error');
      }
    } catch (error) {
      console.error('Failed to generate AI image:', error);
      this.showToast('❌ Failed to generate AI image', 'error');
    } finally {
      document.getElementById('aiGenerateFromProfileBtn').disabled = false;
      document.getElementById('aiGenerateFromProfileBtn').innerHTML = '<span class="ai-gen-icon">✨</span><span>Generate from Profile</span>';
    }
  }

  async generateRandomAIImage() {
    try {
      this.showToast('🎲 Generating random avatar...', 'info');
      document.getElementById('aiGenerateRandomBtn').disabled = true;
      document.getElementById('aiGenerateRandomBtn').textContent = '⏳ Generating...';
      
      // Generate a random animal name
      const animals = ['Tiger', 'Dragon', 'Fox', 'Wolf', 'Lion', 'Eagle', 'Phoenix', 'Panda', 'Bear', 'Owl'];
      const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
      const randomName = `Random${randomAnimal}`;
      
      const imageUrl = await pasteCraftSupabase.generateProfileImage(null, null, randomName);
      
      if (imageUrl) {
        // Add to gallery
        await this.addToGallery(imageUrl, 'random');
        
        this.showToast('✅ Random avatar generated!', 'success');
        this.showAIGenerationTimer();
        this.loadAIGallery();
      } else {
        this.showToast('❌ Failed to generate random avatar', 'error');
      }
    } catch (error) {
      console.error('Failed to generate random avatar:', error);
      this.showToast('❌ Failed to generate random avatar', 'error');
    } finally {
      document.getElementById('aiGenerateRandomBtn').disabled = false;
      document.getElementById('aiGenerateRandomBtn').innerHTML = '<span class="ai-gen-icon">🎲</span><span>Random Avatar</span>';
    }
  }

  async addToGallery(imageUrl, type) {
    try {
      const result = await chrome.storage.local.get('aiGallery');
      const gallery = result.aiGallery || [];
      
      gallery.push({
        url: imageUrl,
        type: type,
        timestamp: Date.now()
      });
      
      await chrome.storage.local.set({ aiGallery: gallery });
    } catch (error) {
      console.error('Failed to add to gallery:', error);
    }
  }

  async migrateProfileImageToGallery() {
    try {
      if (!this.userProfile?.profileImageUrl) {
        return;
      }

      const result = await chrome.storage.local.get('aiGallery');
      const gallery = result.aiGallery || [];
      
      const imageExists = gallery.some(item => item.url === this.userProfile.profileImageUrl);
      
      if (!imageExists) {
        console.log('📸 Migrating existing profile image to gallery...');
        await this.addToGallery(this.userProfile.profileImageUrl, 'profile');
        this.loadAIGallery();
        console.log('✅ Profile image migrated to gallery');
      }
    } catch (error) {
      console.error('Failed to migrate profile image:', error);
    }
  }

  showAIGenerationTimer() {
    const timer = document.getElementById('aiGenerationTimer');
    const countdown = document.getElementById('aiTimerCountdown');
    
    if (!timer || !countdown) return;
    
    timer.style.display = 'flex';
    
    let timeLeft = 10;
    countdown.textContent = timeLeft;
    
    // Clear any existing timer
    if (this.aiGenerationTimerInterval) {
      clearInterval(this.aiGenerationTimerInterval);
    }
    
    this.aiGenerationTimerInterval = setInterval(() => {
      timeLeft--;
      countdown.textContent = timeLeft;
      
      if (timeLeft <= 0) {
        clearInterval(this.aiGenerationTimerInterval);
        this.aiGenerationTimerInterval = null;
        this.hideAIGenerationTimer();
      }
    }, 1000);
  }

  hideAIGenerationTimer() {
    const timer = document.getElementById('aiGenerationTimer');
    if (timer) {
      timer.style.display = 'none';
    }
    
    if (this.aiGenerationTimerInterval) {
      clearInterval(this.aiGenerationTimerInterval);
      this.aiGenerationTimerInterval = null;
    }
  }
  
  showBreakdownModal(text) {
    // Use the existing breakdown modal from the page
    const breakdownModal = document.getElementById('breakdownModal');
    const breakdownOriginalText = document.getElementById('breakdownOriginalText');
    const breakdownTextLength = document.getElementById('breakdownTextLength');
    
    if (breakdownModal && breakdownOriginalText) {
      // Show FULL text, not truncated - let CSS handle scrolling
      breakdownOriginalText.textContent = text;
      
      if (breakdownTextLength) {
        const wordCount = text.trim().split(/\s+/).length;
        breakdownTextLength.textContent = `${wordCount} words`;
      }
      
      // Store the full text for analysis
      this.currentBreakdownText = text;
      
      // Force reflow to ensure scrollbar appears correctly
      breakdownOriginalText.style.display = 'none';
      breakdownOriginalText.offsetHeight; // Trigger reflow
      breakdownOriginalText.style.display = 'block';
      
      // Scroll to top of the original text box
      breakdownOriginalText.scrollTop = 0;
      
      // Show the modal
      breakdownModal.style.display = 'flex';
      
      // Clear any previous result
      const breakdownResult = document.getElementById('breakdownResult');
      if (breakdownResult) {
        breakdownResult.innerHTML = '';
      }
      
      // Reset tabs - no active tab initially
      document.querySelectorAll('.breakdown-tab').forEach(tab => tab.classList.remove('active'));
      
      // Show initial level info
      const levelInfoText = document.getElementById('levelInfoText');
      if (levelInfoText) {
        levelInfoText.innerHTML = `
          <strong>Choose a level:</strong> Select a comprehension level above to get an AI-powered explanation tailored to that audience
        `;
      }
      
      // Show toast if multiple clips were added
      const clipCount = (text.match(/\n\n---\n\n/g) || []).length + 1;
      if (clipCount > 1) {
        this.showToast(`🧠 ${clipCount} clips ready for breakdown (scroll to see all)`);
      }
      
      // Save to history
      this.saveToAnalysisHistory(text, 'breakdown-initiated');
    }
  }
  
  showSummaryModal(text) {
    // Navigate to AI Lab > Summary tab and pre-fill text
    const aiTab = document.querySelector('[data-tab="ai"]');
    const summarySubTab = document.querySelector('[data-ai-tab="summary"]');
    const summaryInput = document.getElementById('summaryInput');
    
    if (aiTab && summarySubTab && summaryInput) {
      // Switch to AI Lab tab
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      aiTab.classList.add('active');
      document.getElementById('aiTab').classList.add('active');
      
      // Switch to Summary sub-tab
      document.querySelectorAll('.ai-lab-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.ai-lab-section').forEach(s => s.classList.remove('active'));
      summarySubTab.classList.add('active');
      document.getElementById('aiSummarySection').classList.add('active');
      
      // Pre-fill the text
      summaryInput.value = text;
      summaryInput.dispatchEvent(new Event('input'));
      
      // Scroll to top of textarea to show the first clip
      summaryInput.scrollTop = 0;
      
      // Focus the textarea
      summaryInput.focus();
      
      // Show toast if multiple clips were added
      const clipCount = (text.match(/\n\n---\n\n/g) || []).length + 1;
      if (clipCount > 1) {
        this.showToast(`📝 ${clipCount} clips added to summary (scroll to see all)`);
      }
      
      // Save to history
      this.saveToAnalysisHistory(text, 'summary-initiated');
      
      // Clear selections and hide buttons
      this.clearAllSelections();
    }
  }

  openClipViewer(clip) {
    const modal = document.getElementById('clipViewerModal');
    const titleEl = document.getElementById('clipViewerTitle');
    const metaEl = document.getElementById('clipViewerMeta');
    const bodyEl = document.getElementById('clipViewerBody');
    const htmlDetails = document.getElementById('clipViewerHtmlDetails');
    const htmlPre = document.getElementById('clipViewerHtml');

    if (!modal || !titleEl || !bodyEl) return;

    this.currentClipViewerClip = clip || null;

    const text = (clip && clip.text != null) ? String(clip.text) : '';
    const meta = (clip && clip.meta && typeof clip.meta === 'object') ? clip.meta : null;

    titleEl.textContent = meta && meta.kind === 'image'
      ? '🖼️ Clip Viewer'
      : meta && meta.kind === 'url'
        ? '🔗 Clip Viewer'
        : '🔎 Clip Viewer';

    // Meta section
    if (metaEl) {
      const bits = [];
      if (meta && meta.kind) bits.push(`<strong>Type:</strong> ${this.escapeHtml(meta.kind)}`);
      if (meta && meta.sourcePageUrl) bits.push(`<strong>From:</strong> ${this.escapeHtml(meta.sourcePageUrl)}`);
      if (clip && typeof clip.timestamp === 'number') bits.push(`<strong>Saved:</strong> ${this.escapeHtml(this.getTimeAgo(clip.timestamp))}`);

      if (bits.length) {
        metaEl.innerHTML = bits.join('<br>');
        metaEl.style.display = 'block';
      } else {
        metaEl.textContent = '';
        metaEl.style.display = 'none';
      }
    }

    // Body
    const safeText = this.escapeHtml(text);
    let html = '';
    let url = '';
    let imgSrc = '';

    if (meta) {
      if (typeof meta.html === 'string' && meta.html.trim()) html = meta.html;
      if (typeof meta.url === 'string' && meta.url.trim()) url = meta.url.trim();
      if (meta.image && typeof meta.image === 'object') {
        imgSrc = (meta.image.dataUrl || meta.image.srcUrl || '').trim();
      }
    }

    const parts = [];

    if (url) {
      const safeUrl = this.escapeHtml(url);
      parts.push(`
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom: 12px;">
          <div style="font-weight:700; color:#111827;">Link</div>
          <a href="${safeUrl}" target="_blank" rel="noreferrer" style="word-break:break-all; color:#2563eb; text-decoration:underline;">${safeUrl}</a>
        </div>
      `);
    }

    const isRenderableImageSrc =
      imgSrc.startsWith('data:image/') ||
      imgSrc.startsWith('http://') ||
      imgSrc.startsWith('https://');

    if (imgSrc && !isRenderableImageSrc) {
      parts.push(`<div style="margin-bottom:10px; color:#6b7280; font-size:12px;">Image preview unavailable (non-renderable source).</div>`);
    } else if (imgSrc && isRenderableImageSrc) {
      parts.push(`<img src="${this.escapeHtml(imgSrc)}" alt="Clip image" />`);
      if (meta && meta.image && meta.image.tooLarge) {
        parts.push(`<div style="margin-top:10px; color:#6b7280; font-size:12px;">Image payload too large to embed; showing what’s available.</div>`);
      }
      if (meta && meta.image && meta.image.exportFailed) {
        parts.push(`<div style="margin-top:10px; color:#6b7280; font-size:12px;">Image export blocked by the page (canvas/security restrictions).</div>`);
      }
    }

    parts.push(`<pre class="clip-viewer-pre">${safeText}</pre>`);

    bodyEl.innerHTML = parts.join('');

    // Raw HTML (collapsed)
    if (htmlDetails && htmlPre) {
      if (html) {
        htmlPre.textContent = String(html);
        htmlDetails.style.display = 'block';
      } else {
        htmlPre.textContent = '';
        htmlDetails.style.display = 'none';
      }
    }

    modal.style.display = 'flex';
  }

  hideClipViewerModal() {
    const modal = document.getElementById('clipViewerModal');
    if (modal) modal.style.display = 'none';
    this.currentClipViewerClip = null;
  }

  async copyClipViewerText() {
    const clip = this.currentClipViewerClip;
    const text = (clip && clip.text != null) ? String(clip.text) : '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Content copied!');
    } catch (e) {
      console.error('Copy failed:', e);
      this.showToast('Copy failed');
    }
  }
  
  clearAllSelections() {
    this.selectedChips.clear();
    this.selectedSearchClips.clear();
    this.selectedCategoryClips.clear();
    
    // Re-render to update UI
    this.renderChips();
    // Refresh search UI (performSearch was removed/renamed)
    this.renderSearchResults();
    this.renderCategories();
  }
  
  getSelectedOrCurrentText(currentClipText, source) {
    // Check if there are any selected clips based on the source
    let selectedTexts = [];
    
    if (source === 'clips' && this.selectedChips.size > 0) {
      // Get texts from selected chips
      this.selectedChips.forEach(index => {
        if (this.clips[index]) {
          selectedTexts.push(this.clips[index].text);
        }
      });
    } else if (source === 'search' && this.selectedSearchClips.size > 0) {
      // Get texts from selected search clips
      const allClips = [...this.clips, ...this.searchOnlyClips];
      this.selectedSearchClips.forEach(clipId => {
        const clip = allClips.find(c => c.id === clipId);
        if (clip) {
          selectedTexts.push(clip.text);
        }
      });
    } else if (source === 'categories' && this.selectedCategoryClips.size > 0) {
      // Get texts from selected category clips
      const allClips = [...this.clips, ...this.searchOnlyClips];
      this.selectedCategoryClips.forEach(clipId => {
        const clip = allClips.find(c => c.id === clipId);
        if (clip) {
          selectedTexts.push(clip.text);
        }
      });
    }
    
    // If we have selected clips, join them with delimiter
    if (selectedTexts.length > 0) {
      return selectedTexts.join('\n\n---\n\n');
    }
    
    // Otherwise, return the current clip text
    return currentClipText;
  }
  
  showBreakdownModalWithLevel(text, level) {
    // Show the breakdown modal with pre-selected level
    this.showBreakdownModal(text);
  }
  
  // Analysis History Functions
  async saveToAnalysisHistory(text, type, level = null, result = null) {
    const historyEntry = {
      id: Date.now(),
      text: text.substring(0, 500), // Store first 500 chars
      type,
      level,
      result: result ? result.substring(0, 1000) : null,
      timestamp: Date.now(),
      source: this.currentTab
    };
    
    // Load existing history
    const { analysisHistory = [] } = await chrome.storage.local.get(['analysisHistory']);
    
    // Add new entry at the beginning
    analysisHistory.unshift(historyEntry);
    
    // Keep only last 50 entries
    if (analysisHistory.length > 50) {
      analysisHistory.splice(50);
    }
    
    // Save to storage
    await chrome.storage.local.set({ analysisHistory });
    this.analysisHistory = analysisHistory;
    
    console.log('✅ Saved to analysis history:', historyEntry);
  }
  
  async loadAnalysisHistory() {
    const { analysisHistory = [] } = await chrome.storage.local.get(['analysisHistory']);
    this.analysisHistory = analysisHistory;
    return analysisHistory;
  }
  
  renderAnalysisHistory() {
    // This will be called when user navigates to AI Lab, Breakdown, or Summary tabs
    const history = this.analysisHistory;
    
    if (history.length === 0) {
      return `
        <div style="text-align: center; padding: 40px 20px; color: #9ca3af;">
          <p style="font-size: 48px; margin: 0 0 16px 0;">📊</p>
          <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #6b7280;">No Analysis History</h3>
          <p style="margin: 0; font-size: 14px;">Start analyzing clips to see your history here</p>
        </div>
      `;
    }
    
    return history.map(entry => {
      const icon = entry.type === 'breakdown' ? '🧠' : entry.type === 'summary' ? '📝' : '🤖';
      const timeAgo = this.getTimeAgo(entry.timestamp);
      const levelBadge = entry.level ? `<span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">${entry.level}</span>` : '';
      
      return `
        <div class="history-entry" style="padding: 16px; border-bottom: 1px solid #e5e7eb; cursor: pointer; transition: background 0.2s;" data-entry-id="${entry.id}">
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <span style="font-size: 24px;">${icon}</span>
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="font-size: 13px; font-weight: 600; color: #1f2937; text-transform: capitalize;">${entry.type}</span>
                ${levelBadge}
                <span style="font-size: 12px; color: #9ca3af; margin-left: auto;">${timeAgo}</span>
              </div>
              <p style="margin: 0; font-size: 13px; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(entry.text.substring(0, 100))}...</p>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ==================== NOTES SYSTEM ====================
  
  async loadNotes() {
    const {
      notes = [],
      notesViewMode = 'notes',
      notesPageIndex = 0,
      notesAiEnabled = false
    } = await chrome.storage.local.get(['notes', 'notesViewMode', 'notesPageIndex', 'notesAiEnabled']);
    this.notes = notes;
    this.notesViewMode = notesViewMode;
    this.notesPageIndex = typeof notesPageIndex === 'number' ? notesPageIndex : 0;
    this.notesAiEnabled = !!notesAiEnabled;

    const viewAlbumsBtn = document.getElementById('viewAlbumsBtn');
    if (viewAlbumsBtn) viewAlbumsBtn.classList.toggle('active', this.notesViewMode === 'albums');
    const notesAiToggle = document.getElementById('notesAiToggle');
    if (notesAiToggle) notesAiToggle.checked = this.notesAiEnabled;

    console.log(`📝 Loaded ${notes.length} notes`);
    return notes;
  }

  async saveNotes() {
    await chrome.storage.local.set({ notes: this.notes });
    console.log(`💾 Saved ${this.notes.length} notes`);
  }

  async saveNotesPrefs() {
    await chrome.storage.local.set({
      notesViewMode: this.notesViewMode,
      notesPageIndex: this.notesPageIndex,
      notesAiEnabled: this.notesAiEnabled
    });
  }

  renderNotes() {
    const container = document.getElementById('notesContainer');
    const paginationEl = document.getElementById('notesPagination');
    const isListView = !!container?.classList?.contains('list-view');
    
    const allNotes = Array.isArray(this.notes) ? this.notes : [];
    // Show notes + albums together (View Albums button removed; mixed catalog is the desired UX)
    const filtered = allNotes;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <h3>No notes yet</h3>
          <p>Create a note or album to bundle your clips, images, and URLs</p>
          <div class="demo-hint">
            <span class="demo-step">📝 Take notes</span>
            <span class="demo-step">📚 Create albums</span>
            <span class="demo-step">📤 Export to PDF</span>
          </div>
        </div>
      `;
      if (paginationEl) paginationEl.style.display = 'none';
      return;
    }

    // Pagination: list shows 3; grid shows 6 (2 columns × 3 rows)
    const pageSize = isListView ? 3 : 6;
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (this.notesPageIndex < 0) this.notesPageIndex = 0;
    if (this.notesPageIndex > pageCount - 1) this.notesPageIndex = pageCount - 1;
    const start = this.notesPageIndex * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);

    container.innerHTML = pageItems.map(note => {
      const noteRefCount = note.type === 'album' ? (Array.isArray(note.noteRefs) ? note.noteRefs.length : 0) : 0;
      const clipCount = note.type === 'album' ? 0 : (note.clips?.length || 0);
      const imageCount = note.type === 'album' ? 0 : (note.images?.length || 0);
      const urlCount = note.type === 'album' ? 0 : (note.urls?.length || 0);
      const totalItems = note.type === 'album' ? noteRefCount : (clipCount + imageCount + urlCount);
      const icon = note.type === 'album' ? '📚' : '📝';
      const cardClass = note.type === 'album' ? 'note-card album' : 'note-card';
      const date = new Date(note.createdAt).toLocaleDateString();
      const safeTitle = (note.title || '').trim();
      const safeDesc = (note.description || '').trim();
      const displayTitle = safeTitle ? safeTitle : (note.type === 'album' ? 'Untitled Album' : 'Untitled Note');

      const sendToAlbumBtn = note.type !== 'album' ? `<button class="note-action-btn send-to-album-btn" data-note-id="${note.id}" title="Send/Create Album">📚</button>` : '';
      
      return `
        <div class="${cardClass}" data-note-id="${note.id}">
          <div class="note-card-header">
            <span class="note-card-type">${icon}</span>
            <div class="note-card-actions">
              <button class="note-action-btn edit-note" data-note-id="${note.id}" title="Edit">✏️</button>
              ${sendToAlbumBtn}
              <button class="note-action-btn export-note" data-note-id="${note.id}" title="Export">📤</button>
              <button class="note-action-btn delete-note" data-note-id="${note.id}" title="Delete">🗑️</button>
            </div>
          </div>
          <h4 class="note-card-title">${this.escapeHtml(displayTitle)}</h4>
          <p class="note-card-description">${this.escapeHtml(safeDesc)}</p>
          <div class="note-card-meta">
            <div class="note-card-count">
              ${note.type === 'album' && noteRefCount > 0 ? `<span>📝 ${noteRefCount}</span>` : ''}
              ${clipCount > 0 ? `<span>📋 ${clipCount}</span>` : ''}
              ${imageCount > 0 ? `<span>🖼️ ${imageCount}</span>` : ''}
              ${urlCount > 0 ? `<span>🔗 ${urlCount}</span>` : ''}
              ${totalItems === 0 ? '<span style="color: #9ca3af;">Empty</span>' : ''}
            </div>
            <span>${date}</span>
          </div>
        </div>
      `;
    }).join('');

    // Render pagination controls (0..N-1)
    if (paginationEl) {
      if (pageCount <= 1) {
        paginationEl.style.display = 'none';
      } else {
        paginationEl.style.display = 'flex';
        paginationEl.innerHTML = Array.from({ length: pageCount }).map((_, idx) => {
          const active = idx === this.notesPageIndex ? 'active' : '';
          return `<button class="notes-page-btn ${active}" data-page="${idx}" title="Page ${idx}">${idx}</button>`;
        }).join('');

        paginationEl.querySelectorAll('.notes-page-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const nextPage = parseInt(btn.dataset.page, 10);
            if (!Number.isNaN(nextPage)) {
              this.notesPageIndex = nextPage;
              await this.saveNotesPrefs();
              this.renderNotes();
            }
          });
        });
      }
    }

    // Add event listeners to note cards
    container.querySelectorAll('.note-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.classList.contains('note-action-btn')) {
          const noteId = card.dataset.noteId;
          this.openNoteViewer(noteId);
        }
      });
    });

    // Edit buttons
    container.querySelectorAll('.edit-note').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const noteId = btn.dataset.noteId;
        this.openNoteEditor('note', noteId);
      });
    });

    // Export buttons
    container.querySelectorAll('.export-note').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const noteId = btn.dataset.noteId;
        this.exportNoteToPDF(noteId);
      });
    });

    // Delete buttons
    container.querySelectorAll('.delete-note').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const noteId = btn.dataset.noteId;
        this.deleteNote(noteId);
      });
    });

    // Send to Album buttons
    container.querySelectorAll('.send-to-album-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const noteId = btn.dataset.noteId;
        const note = this.notes.find(n => n.id == noteId);
        if (note) {
          this.pendingNoteForAlbum = note;
          await this.loadNotes();
          this.showAlbumPickerForNote();
        }
      });
    });
  }

  updateNoteAiControls() {
    const aiTitleBtn = document.getElementById('aiTitleBtn');
    const aiDescBtn = document.getElementById('aiDescBtn');
    const bodyInput = document.getElementById('noteBodyInput');

    if (!aiTitleBtn || !aiDescBtn || !bodyInput) return;

    const hasContent = !!bodyInput.value.trim();
    const shouldShow = !!this.notesAiEnabled;

    aiTitleBtn.style.display = shouldShow ? 'inline-flex' : 'none';
    aiDescBtn.style.display = shouldShow ? 'inline-flex' : 'none';

    aiTitleBtn.disabled = !hasContent;
    aiDescBtn.disabled = !hasContent;
  }

  async generateNoteTitleFromContent() {
    const bodyInput = document.getElementById('noteBodyInput');
    const titleInput = document.getElementById('noteTitleInput');
    const aiTitleBtn = document.getElementById('aiTitleBtn');
    if (!bodyInput || !titleInput || !aiTitleBtn) return;

    const content = bodyInput.value.trim();
    if (!content) {
      this.showToast('Add content first');
      this.updateNoteAiControls();
      return;
    }

    // Premium check (reuse Summary gating)
    if (this.currentUser && !await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'summary')) {
      return;
    }

    try {
      aiTitleBtn.disabled = true;
      const question = 'Generate a short note title (max 6 words). Return ONLY the title, no quotes.';
      const result = await pasteCraftSupabase.generateSummary(content.substring(0, 3000), question);
      const cleaned = (result || '').trim().replace(/^["'“”]+|["'“”]+$/g, '');
      if (cleaned) titleInput.value = cleaned;
      this.showToast('Title generated');
    } catch (e) {
      console.error('Failed to generate title:', e);
      this.showToast('Failed to generate title');
    } finally {
      aiTitleBtn.disabled = false;
      this.updateNoteAiControls();
    }
  }

  async generateNoteDescriptionFromContent() {
    const bodyInput = document.getElementById('noteBodyInput');
    const descInput = document.getElementById('noteDescriptionInput');
    const aiDescBtn = document.getElementById('aiDescBtn');
    if (!bodyInput || !descInput || !aiDescBtn) return;

    const content = bodyInput.value.trim();
    if (!content) {
      this.showToast('Add content first');
      this.updateNoteAiControls();
      return;
    }

    // Premium check (reuse Summary gating)
    if (this.currentUser && !await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'summary')) {
      return;
    }

    try {
      aiDescBtn.disabled = true;
      const question = 'Generate a one-sentence description for this note (max 140 characters). Return ONLY the description.';
      const result = await pasteCraftSupabase.generateSummary(content.substring(0, 3000), question);
      const cleaned = (result || '').trim().replace(/^["'“”]+|["'“”]+$/g, '');
      if (cleaned) descInput.value = cleaned;
      this.showToast('Description generated');
    } catch (e) {
      console.error('Failed to generate description:', e);
      this.showToast('Failed to generate description');
    } finally {
      aiDescBtn.disabled = false;
      this.updateNoteAiControls();
    }
  }

  openNoteEditor(type = 'note', noteId = null, showBack = false) {
    this.currentNoteType = type;
    this.currentNoteId = noteId;
    this.currentNoteAttachments = [];

    const modal = document.getElementById('noteEditorModal');
    const titleInput = document.getElementById('noteTitleInput');
    const descInput = document.getElementById('noteDescriptionInput');
    const bodyInput = document.getElementById('noteBodyInput');
    const attachmentsList = document.getElementById('noteAttachmentsList');
    const attachmentsSection = document.getElementById('noteEditorAttachmentsSection');
    const editorType = document.getElementById('noteEditorType');
    const aiToggle = document.getElementById('notesAiToggle');
    const saveBtn = document.getElementById('saveNote');

    // Show/hide back button
    if (showBack) {
      this.showBackToAlbumPicker();
    } else {
      this.hideBackToAlbumPicker();
    }

    if (noteId) {
      // Edit existing note
      const note = this.notes.find(n => n.id == noteId);
      if (note) {
        this.currentNoteType = note.type;
        titleInput.value = note.title;
        descInput.value = note.description;
        bodyInput.value = note.body;
        this.currentNoteAttachments = note.type === 'album'
          ? []
          : [
              ...(note.clips || []),
              ...(note.images || []),
              ...(note.urls || [])
            ];
        editorType.textContent = note.type === 'album' ? 'Edit Album' : 'Edit Note';
      }
    } else {
      // New note
      titleInput.value = '';
      descInput.value = '';
      bodyInput.value = '';
      this.currentNoteAttachments = [];
      editorType.textContent = type === 'album' ? 'New Album' : 'New Note';
    }

    // Set AI toggle state
    if (aiToggle) aiToggle.checked = this.notesAiEnabled;

    // Albums do not take attachments
    if (attachmentsSection) attachmentsSection.style.display = this.currentNoteType === 'album' ? 'none' : 'block';
    if (saveBtn) saveBtn.textContent = this.currentNoteType === 'album' ? 'Save Album' : 'Save Note';

    if (this.currentNoteType !== 'album') {
      this.renderNoteAttachments();
    } else if (attachmentsList) {
      attachmentsList.innerHTML = '';
    }
    this.updateNoteAiControls();
    modal.style.display = 'flex';
  }

  closeNoteEditor() {
    document.getElementById('noteEditorModal').style.display = 'none';
    this.currentNoteId = null;
    this.currentNoteType = 'note';
    this.currentNoteAttachments = [];
    this.hideBackToAlbumPicker();
  }

  renderNoteAttachments() {
    const attachmentsList = document.getElementById('noteAttachmentsList');
    
    if (this.currentNoteAttachments.length === 0) {
      attachmentsList.innerHTML = '<p style="text-align: center; color: #9ca3af; font-size: 13px;">No attachments yet</p>';
      return;
    }

    attachmentsList.innerHTML = this.currentNoteAttachments.map((att, index) => {
      const icon = att.type === 'clip' ? '📋' : att.type === 'image' ? '🖼️' : '🔗';
      const text = att.type === 'url' ? att.url : att.text?.substring(0, 50) + '...';
      const date = att.addedDate ? new Date(att.addedDate).toLocaleDateString() : '';

      return `
        <div class="attachment-item">
          <div class="attachment-info">
            <span>${icon}</span>
            <span class="attachment-text" title="${this.escapeHtml(text)}">${this.escapeHtml(text)}</span>
            ${date ? `<span class="attachment-date">${date}</span>` : ''}
          </div>
          <button class="attachment-remove" data-index="${index}">✕</button>
        </div>
      `;
    }).join('');

    // Add remove handlers
    attachmentsList.querySelectorAll('.attachment-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        this.currentNoteAttachments.splice(index, 1);
        this.renderNoteAttachments();
      });
    });
  }

  async saveNote() {
    const isUpdate = !!this.currentNoteId;
    const title = document.getElementById('noteTitleInput').value.trim();
    const description = document.getElementById('noteDescriptionInput').value.trim();
    const body = document.getElementById('noteBodyInput').value.trim();

    const existing = this.currentNoteId ? this.notes.find(n => n.id == this.currentNoteId) : null;
    const noteData = {
      id: this.currentNoteId || Date.now(),
      type: this.currentNoteType,
      title,
      description,
      body,
      ...(this.currentNoteType === 'album'
        ? { noteRefs: Array.isArray(existing?.noteRefs) ? existing.noteRefs : [] }
        : {
            clips: this.currentNoteAttachments.filter(a => a.type === 'clip'),
            images: this.currentNoteAttachments.filter(a => a.type === 'image'),
            urls: this.currentNoteAttachments.filter(a => a.type === 'url')
          }),
      createdAt: this.currentNoteId ? (this.notes.find(n => n.id == this.currentNoteId)?.createdAt || Date.now()) : Date.now(),
      updatedAt: Date.now()
    };

    if (this.currentNoteId) {
      // Update existing note
      const index = this.notes.findIndex(n => n.id == this.currentNoteId);
      if (index !== -1) {
        this.notes[index] = noteData;
      }
    } else {
      // Add new note
      this.notes.unshift(noteData);
      // Always jump to first page so the newly created note appears immediately (top-left in grid)
      this.notesPageIndex = 0;
    }

    // If this note is included in any albums, refresh those albums immediately.
    if (noteData.type !== 'album') {
      this.refreshAlbumsForNote(noteData);
    }

    await this.saveNotes();
    await this.saveNotesPrefs();
    this.renderNotes();
    this.closeNoteEditor();
    this.showToast(isUpdate ? 'Note updated!' : 'Note created!');
  }

  refreshAlbumsForNote(sourceNote) {
    if (!sourceNote || sourceNote.type === 'album') return;

    const sourceNoteId = sourceNote.id;
    const safeTitle = (sourceNote.title || '').trim();
    const displayTitle = safeTitle ? safeTitle : 'Untitled Note';
    const bodyPrefix = `[From: ${displayTitle}]`;

    const sourceAttachmentIds = new Set();
    (sourceNote.clips || []).forEach(c => {
      if (c && c.id != null) sourceAttachmentIds.add(c.id);
    });
    (sourceNote.urls || []).forEach(u => {
      if (u && u.id != null) sourceAttachmentIds.add(u.id);
    });
    (sourceNote.images || []).forEach(i => {
      if (i && i.id != null) sourceAttachmentIds.add(i.id);
    });

    const updatedAlbumIds = new Set();

    const containsSourceNoteId = (arr) =>
      Array.isArray(arr) && arr.some(x => x && x.sourceNoteId == sourceNoteId);
    const containsAnySourceAttachmentId = (arr) =>
      Array.isArray(arr) && arr.some(x => x && sourceAttachmentIds.has(x.id));

    for (const album of (this.notes || [])) {
      if (!album || album.type !== 'album') continue;

      const isLinked =
        containsSourceNoteId(album.clips) ||
        containsSourceNoteId(album.urls) ||
        containsSourceNoteId(album.images) ||
        containsAnySourceAttachmentId(album.clips) ||
        containsAnySourceAttachmentId(album.urls) ||
        containsAnySourceAttachmentId(album.images);

      if (!isLinked) continue;

      if (!Array.isArray(album.clips)) album.clips = [];
      if (!Array.isArray(album.urls)) album.urls = [];
      if (!Array.isArray(album.images)) album.images = [];

      // Remove previous synced items for this note (tagged items) and best-effort cleanup for legacy (id match / body prefix).
      album.clips = album.clips.filter(c => {
        if (!c) return false;
        if (c.sourceNoteId == sourceNoteId) return false;
        if (sourceAttachmentIds.has(c.id)) return false;
        if (typeof c.text === 'string' && c.text.startsWith(bodyPrefix)) return false;
        return true;
      });
      album.urls = album.urls.filter(u => {
        if (!u) return false;
        if (u.sourceNoteId == sourceNoteId) return false;
        if (sourceAttachmentIds.has(u.id)) return false;
        return true;
      });
      album.images = album.images.filter(i => {
        if (!i) return false;
        if (i.sourceNoteId == sourceNoteId) return false;
        if (sourceAttachmentIds.has(i.id)) return false;
        return true;
      });

      // Re-copy current note content into album with tagging.
      const now = Date.now();
      if (sourceNote.body && sourceNote.body.trim()) {
        album.clips.push({
          type: 'clip',
          id: now + Math.random(),
          text: `${bodyPrefix}\n\n${sourceNote.body}`,
          addedDate: now,
          sourceNoteId
        });
      }

      if (sourceNote.clips?.length > 0) {
        album.clips.push(...sourceNote.clips.map(c => ({
          ...c,
          addedDate: now,
          sourceNoteId
        })));
      }

      if (sourceNote.urls?.length > 0) {
        album.urls.push(...sourceNote.urls.map(u => ({
          ...u,
          addedDate: now,
          sourceNoteId
        })));
      }

      if (sourceNote.images?.length > 0) {
        album.images.push(...sourceNote.images.map(i => ({
          ...i,
          addedDate: now,
          sourceNoteId
        })));
      }

      album.updatedAt = now;
      if (!Array.isArray(album.sourceNoteIds)) album.sourceNoteIds = [];
      if (!album.sourceNoteIds.includes(sourceNoteId)) album.sourceNoteIds.push(sourceNoteId);

      updatedAlbumIds.add(album.id);
    }

    if (this.currentViewerNoteId && updatedAlbumIds.has(this.currentViewerNoteId)) {
      this.openNoteViewer(this.currentViewerNoteId);
    }
  }

  async deleteNote(noteId) {
    const note = this.notes.find(n => n.id == noteId);
    if (!note) return;

    const confirmed = confirm(`Delete "${note.title}"?`);
    if (!confirmed) return;

    this.notes = this.notes.filter(n => n.id != noteId);
    await this.saveNotes();
    this.renderNotes();
    this.showToast('Note deleted');
  }

  showClipPickerForNote() {
    if (this.clips.length === 0 && this.searchOnlyClips.length === 0) {
      this.showToast('No clips available. Create some clips first!');
      return;
    }

    this.selectedPickerClips.clear();
    this.updateClipPickerFooter();
    
    const modal = document.getElementById('clipPickerModal');
    if (modal) {
      modal.style.display = 'flex';
      this.switchClipPickerTab('clips');
      this.renderClipPickerRecentClips();
    }
  }

  closeClipPicker() {
    const modal = document.getElementById('clipPickerModal');
    if (modal) {
      modal.style.display = 'none';
      this.selectedPickerClips.clear();
    }
  }

  updateClipPickerFooter() {
    const countEl = document.getElementById('clipPickerSelectionCount');
    const addBtn = document.getElementById('clipPickerAddBtn');
    
    if (countEl) {
      const count = this.selectedPickerClips.size;
      countEl.textContent = count === 1 ? '1 selected' : `${count} selected`;
    }
    
    if (addBtn) {
      addBtn.disabled = this.selectedPickerClips.size === 0;
    }
  }

  togglePickerClip(clipId, itemElement) {
    const checkbox = itemElement.querySelector('.clip-picker-checkbox, .clip-picker-checkbox-sm, .search-checkbox, .category-checkbox');
    
    if (this.selectedPickerClips.has(clipId)) {
      this.selectedPickerClips.delete(clipId);
      itemElement.classList.remove('selected');
      if (checkbox) checkbox.checked = false;
    } else {
      this.selectedPickerClips.add(clipId);
      itemElement.classList.add('selected');
      if (checkbox) checkbox.checked = true;
    }
    
    this.updateClipPickerFooter();
  }

  normalizePickerText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  createPickerSearchRowHTML(clip) {
    const category = clip.category || 'Uncategorized';
    const timeAgo = this.getTimeAgo(clip.timestamp);
    const normalized = this.normalizePickerText(clip.text);
    const truncatedText = normalized.length > 110 ? normalized.substring(0, 110) + '...' : normalized;
    const isSelected = this.selectedPickerClips.has(clip.id);
    const alreadyAdded = this.currentNoteAttachments.some(att => att.type === 'clip' && att.id == clip.id);
    const selectedClass = isSelected ? 'selected' : '';
    const addedClass = alreadyAdded ? 'already-added' : '';

    return `
      <div class="search-result-item ${selectedClass} ${addedClass}" data-clip-id="${clip.id}">
        <input type="checkbox" class="search-checkbox" ${isSelected ? 'checked' : ''} ${alreadyAdded ? 'disabled' : ''}>
        <div class="search-result-content">
          <div class="search-result-text">${this.escapeHtml(truncatedText)}</div>
          <div class="search-result-meta">
            <span class="search-result-category">${this.escapeHtml(category)}</span>
            <span>${timeAgo}</span>
            ${alreadyAdded ? '<span class="already-added-badge">✓ Added</span>' : ''}
          </div>
        </div>
      </div>
    `;
  }

  createPickerChipElement(clip) {
    const chip = document.createElement('div');
    chip.className = 'chip animate-slide-in';
    chip.dataset.clipId = clip.id;

    const timeAgo = this.getTimeAgo(clip.timestamp);
    const normalized = this.normalizePickerText(clip.text);
    const truncatedText = normalized.length > 30 ? normalized.substring(0, 30) + '...' : normalized;

    const isSelected = this.selectedPickerClips.has(clip.id);
    const alreadyAdded = this.currentNoteAttachments.some(att => att.type === 'clip' && att.id == clip.id);

    chip.innerHTML = `
      <input type="checkbox" class="chip-checkbox" ${isSelected ? 'checked' : ''} ${alreadyAdded ? 'disabled' : ''}>
      <span class="chip-text" title="${this.escapeHtml(normalized)}">${this.escapeHtml(truncatedText)}</span>
      <span class="chip-time">${timeAgo}</span>
      ${alreadyAdded ? '<span class="already-added-badge-sm">✓</span>' : ''}
    `;

    if (isSelected) chip.classList.add('selected');
    if (alreadyAdded) chip.classList.add('already-added');

    if (!alreadyAdded) {
      const checkbox = chip.querySelector('.chip-checkbox');
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePickerClip(clip.id, chip);
      });

      chip.addEventListener('click', (e) => {
        if (!e.target.classList.contains('chip-checkbox')) {
          this.togglePickerClip(clip.id, chip);
        }
      });
    }

    return chip;
  }

  attachPickerSearchRowHandlers(container) {
    container.querySelectorAll('.search-result-item').forEach(item => {
      const alreadyAdded = item.classList.contains('already-added');
      if (alreadyAdded) return;

      const checkbox = item.querySelector('.search-checkbox');
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        const clipId = item.dataset.clipId;
        this.togglePickerClip(clipId, item);
      });

      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('search-checkbox')) {
          const clipId = item.dataset.clipId;
          this.togglePickerClip(clipId, item);
        }
      });
    });
  }

  switchClipPickerTab(tabName) {
    const contentIds = ['clipPickerClipsTab','clipPickerSearchTab','clipPickerCategoriesTab'];
    const before = contentIds.map(id => {
      const el = document.getElementById(id);
      return {id,hasEl:!!el,active:!!el?.classList?.contains('active'),display:el?getComputedStyle(el).display:null};
    });

    document.querySelectorAll('.clip-picker-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.pickerTab === tabName);
    });

    document.querySelectorAll('.clip-picker-tab-content').forEach(content => {
      content.classList.remove('active');
      // Force hide to avoid CSS conflicts causing all panes to stay visible
      content.style.display = 'none';
    });

    const targetContent = document.getElementById(`clipPicker${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`);
    if (targetContent) {
      targetContent.classList.add('active');
      // Force show target pane
      targetContent.style.display = 'block';
    }

    const after = contentIds.map(id => {
      const el = document.getElementById(id);
      return {id,hasEl:!!el,active:!!el?.classList?.contains('active'),display:el?getComputedStyle(el).display:null};
    });

    if (tabName === 'clips') {
      this.renderClipPickerRecentClips();
    } else if (tabName === 'categories') {
      this.renderClipPickerCategories();
    } else if (tabName === 'search') {
      const searchInput = document.getElementById('clipPickerSearchInput');
      if (searchInput) searchInput.value = '';
      this.renderClipPickerSearchResults([]);
    }
  }

  renderClipPickerRecentClips() {
    const container = document.getElementById('clipPickerRecentList');
    if (!container) return;

    const recentClips = this.clips.slice(0, 20);

    if (recentClips.length === 0) {
      container.innerHTML = `
        <div class="clip-picker-empty">
          <div class="clip-picker-empty-icon">📋</div>
          <p>No recent clips available</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    recentClips.forEach(clip => {
      container.appendChild(this.createPickerChipElement(clip));
    });
  }

  searchClipsInPicker(query) {
    const allClips = [...this.clips, ...this.searchOnlyClips];
    
    if (!query.trim()) {
      this.renderClipPickerSearchResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const results = allClips.filter(clip => 
      (clip.text || '').toLowerCase().includes(lowerQuery) ||
      (clip.category && clip.category.toLowerCase().includes(lowerQuery))
    );

    this.renderClipPickerSearchResults(results.slice(0, 50));
  }

  renderClipPickerSearchResults(results) {
    const container = document.getElementById('clipPickerSearchList');
    if (!container) return;

    if (results.length === 0) {
      container.innerHTML = `
        <div class="clip-picker-empty">
          <div class="clip-picker-empty-icon">🔍</div>
          <p>No clips found matching your search</p>
        </div>
      `;
      return;
    }

    container.innerHTML = results.map(clip => this.createPickerSearchRowHTML(clip)).join('');
    this.attachPickerSearchRowHandlers(container);
  }

  renderClipPickerCategories() {
    const container = document.getElementById('clipPickerCategoriesList');
    if (!container) return;

    const allClips = [...this.clips, ...this.searchOnlyClips];
    const categories = this.categories || [];
    const uncategorizedClips = allClips.filter(c => (c.category || 'Uncategorized') === 'Uncategorized');

    const pickerCategories = [
      { id: 'uncategorized', name: 'Uncategorized', icon: '📁', isVirtual: true, clips: uncategorizedClips },
      ...categories.map(c => ({
        id: c.id,
        name: c.name,
        icon: c.icon || '📁',
        isVirtual: false,
        clips: allClips.filter(cl => cl.category === c.name)
      }))
    ].filter(c => c.clips.length > 0);

    if (pickerCategories.length === 0) {
      container.innerHTML = `
        <div class="clip-picker-empty">
          <div class="clip-picker-empty-icon">📁</div>
          <p>No clips found in categories</p>
        </div>
      `;
      return;
    }

    container.innerHTML = pickerCategories.map(cat => {
      const clipCount = cat.clips.length;
      const dropdownId = `picker-dropdown-${cat.id}`;
      const clipsHtml = cat.clips.slice(0, 25).map(clip => {
        const timeAgo = this.getTimeAgo(clip.timestamp);
        const normalized = this.normalizePickerText(clip.text);
        const truncatedText = normalized.length > 60 ? normalized.substring(0, 60) + '...' : normalized;
        const isSelected = this.selectedPickerClips.has(clip.id);
        const alreadyAdded = this.currentNoteAttachments.some(att => att.type === 'clip' && att.id == clip.id);

        return `
          <div class="category-clip ${isSelected ? 'selected' : ''} ${alreadyAdded ? 'already-added' : ''}" data-clip-id="${clip.id}">
            <input type="checkbox" class="category-checkbox" ${isSelected ? 'checked' : ''} ${alreadyAdded ? 'disabled' : ''}>
            <div class="category-clip-content">
              <div class="category-clip-text">${this.escapeHtml(truncatedText)}</div>
              <div class="category-clip-time">${timeAgo}</div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="category-item" data-picker-category-id="${cat.id}">
          <div class="category-header">
            <div class="category-info">
              <div class="category-icon">${this.escapeHtml(cat.icon)}</div>
              <div class="category-details">
                <h4>${this.escapeHtml(cat.name)}</h4>
                <p>${clipCount} clips</p>
              </div>
            </div>
            <div class="category-header-actions">
              <span class="category-expand-icon">▶</span>
            </div>
          </div>
          <div class="category-dropdown" id="${dropdownId}">
            ${clipsHtml || '<div class="category-clip" style="text-align: center; color: #9ca3af; padding: 16px;">No clips in this category</div>'}
          </div>
        </div>
      `;
    }).join('');

    // Toggle expand/collapse (scoped to picker only)
    container.querySelectorAll('.category-item .category-header').forEach(header => {
      header.addEventListener('click', () => {
        const item = header.closest('.category-item');
        const dropdown = item.querySelector('.category-dropdown');
        const isExpanded = item.classList.contains('expanded');

        // close others in picker
        container.querySelectorAll('.category-item.expanded').forEach(other => {
          if (other !== item) {
            other.classList.remove('expanded');
            other.querySelector('.category-dropdown')?.classList.remove('expanded');
          }
        });

        if (isExpanded) {
          item.classList.remove('expanded');
          dropdown.classList.remove('expanded');
        } else {
          item.classList.add('expanded');
          dropdown.classList.add('expanded');
        }
      });
    });

    // Attach selection handlers
    container.querySelectorAll('.category-clip').forEach(row => {
      const alreadyAdded = row.classList.contains('already-added');
      if (alreadyAdded) return;

      const checkbox = row.querySelector('.category-checkbox');
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePickerClip(row.dataset.clipId, row);
      });

      row.addEventListener('click', (e) => {
        if (!e.target.classList.contains('category-checkbox')) {
          this.togglePickerClip(row.dataset.clipId, row);
        }
      });
    });
  }

  addSelectedClipsToNote() {
    if (this.selectedPickerClips.size === 0) {
      this.showToast('No clips selected');
      return;
    }

    const allClips = [...this.clips, ...this.searchOnlyClips];
    let addedCount = 0;
    let skippedCount = 0;

    this.selectedPickerClips.forEach(clipId => {
      const clip = allClips.find(c => c.id == clipId);
      
      if (!clip) return;

      const alreadyAdded = this.currentNoteAttachments.some(att => 
        att.type === 'clip' && att.id == clipId
      );

      if (alreadyAdded) {
        skippedCount++;
        return;
      }

      this.currentNoteAttachments.push({
        type: 'clip',
        id: clip.id,
        text: clip.text,
        addedDate: Date.now()
      });
      addedCount++;
    });

    this.renderNoteAttachments();
    this.closeClipPicker();
    
    const parts = [];
    if (addedCount > 0) parts.push(addedCount === 1 ? '✅ 1 clip added' : `✅ ${addedCount} clips added`);
    if (skippedCount > 0) parts.push(skippedCount === 1 ? '(1 already added)' : `(${skippedCount} already added)`);
    this.showToast(parts.join(' '));
  }

  showImagePickerForNote() {
    this.showToast('Image picker coming soon! Use Add URL for now.');
  }

  addURLToNote() {
    const url = prompt('Enter URL:');
    if (url && url.trim()) {
      this.currentNoteAttachments.push({
        type: 'url',
        id: Date.now(),
        url: url.trim(),
        title: url.trim(),
        addedDate: Date.now()
      });
      this.renderNoteAttachments();
      this.showToast('URL added to note');
    }
  }

  exportNoteToPDF(noteId) {
    const note = this.notes.find(n => n.id == noteId);
    if (!note) return;

    // Simple text export (PDF generation would require a library)
    let content = `${note.title}\n\n${note.description}\n\n${note.body}\n\n`;
    
    if (note.clips?.length > 0) {
      content += '\nCLIPS:\n';
      note.clips.forEach((clip, i) => {
        content += `${i + 1}. ${clip.text}\n`;
      });
    }
    
    if (note.urls?.length > 0) {
      content += '\nLINKS:\n';
      note.urls.forEach((url, i) => {
        content += `${i + 1}. ${url.url}\n`;
      });
    }

    // Create a blob and download
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    this.showToast('Note exported as text file');
  }

  openNoteViewer(noteId) {
    const note = this.notes.find(n => n.id == noteId);
    if (!note) return;

    this.currentViewerNoteId = noteId;
    const isAlbum = note.type === 'album';
    const allAttachments = [
      ...(note.clips || []).map(c => ({ ...c, type: 'clip' })),
      ...(note.images || []).map(i => ({ ...i, type: 'image' })),
      ...(note.urls || []).map(u => ({ ...u, type: 'url' }))
    ];
    const modal = document.getElementById('noteViewerModal');
    const icon = document.getElementById('noteViewerIcon');
    const titleText = document.getElementById('noteViewerTitleText');
    const backBtn = document.getElementById('noteViewerBackBtn');
    const descSection = document.getElementById('noteViewerDescSection');
    const descText = document.getElementById('noteViewerDesc');
    const contentText = document.getElementById('noteViewerContent');
    const attachSection = document.getElementById('noteViewerAttachmentsSection');
    const attachList = document.getElementById('noteViewerAttachments');
    const copyAllBtn = document.getElementById('copyAllAttachments');
    const attachmentsTitle = document.getElementById('noteViewerAttachmentsTitle');

    // Set icon and title
    icon.textContent = note.type === 'album' ? '📚' : '📝';
    const safeTitle = (note.title || '').trim();
    titleText.textContent = safeTitle || (note.type === 'album' ? 'Untitled Album' : 'Untitled Note');
    if (backBtn) backBtn.style.display = this.noteViewerParentAlbumId && !isAlbum ? 'inline-flex' : 'none';
    if (isAlbum) this.noteViewerParentAlbumId = null;

    // Description
    const safeDesc = (note.description || '').trim();
    if (safeDesc) {
      descSection.style.display = 'block';
      descText.textContent = safeDesc;
    } else {
      descSection.style.display = 'none';
    }

    // Content
    contentText.textContent = note.body || 'No content';

    // Album shows Notes list (references). Notes show Attachments list.
    if (isAlbum) {
      if (attachmentsTitle) attachmentsTitle.textContent = 'Notes';
      if (copyAllBtn) copyAllBtn.style.display = 'none';
    }

    if (allAttachments.length > 0) {
      attachSection.style.display = 'block';
      if (copyAllBtn) copyAllBtn.style.display = isAlbum ? 'none' : '';
      attachList.innerHTML = allAttachments.map((att, idx) => {
        const icon = att.type === 'clip' ? '📋' : att.type === 'image' ? '🖼️' : '🔗';
        const text = att.type === 'url' ? att.url : (att.text || '').substring(0, 80);
        const displayText = text.length > 80 ? text + '...' : text;

        if (isAlbum) {
          const sourceNoteId = att.sourceNoteId;
          let sourceNote = sourceNoteId ? this.notes.find(n => n && n.id == sourceNoteId) : null;
          // Legacy fallback: try to infer source note by matching attachment id.
          if (!sourceNote && att && att.id != null) {
            sourceNote = (this.notes || []).find(n => {
              if (!n || n.type === 'album') return false;
              const hasClip = Array.isArray(n.clips) && n.clips.some(c => c && c.id == att.id);
              const hasUrl = Array.isArray(n.urls) && n.urls.some(u => u && u.id == att.id);
              const hasImage = Array.isArray(n.images) && n.images.some(i => i && i.id == att.id);
              return hasClip || hasUrl || hasImage;
            }) || null;
          }
          const fromTitle = sourceNote ? ((sourceNote.title || '').trim() || 'Untitled Note') : 'Album';
          const metaLine = `
            <div style="margin-top:6px; font-size:11px; color:#6b7280; line-height:1.25;">
              <div><strong style="color:#4b5563;">From:</strong> ${this.escapeHtml(fromTitle)}</div>
            </div>
          `;
          return `
            <div class="viewer-attachment-item viewer-attachment-openable" data-index="${idx}" role="button" tabindex="0">
              <div class="viewer-attachment-info">
                <span class="viewer-attachment-icon">${icon}</span>
                <div style="min-width:0;">
                  <div class="viewer-attachment-text" title="${this.escapeHtml(text)}">${this.escapeHtml(displayText)}</div>
                  ${metaLine}
                </div>
              </div>
              <div class="viewer-attachment-actions">
                <button class="btn-copy-album-attachment" data-index="${idx}" type="button">Copy</button>
                <button class="btn-open-album-attachment" data-index="${idx}" type="button" title="Open attachment" style="border:none; background:transparent; cursor:pointer; color:#9ca3af; font-size:18px; line-height:1; padding:0 2px;">›</button>
              </div>
            </div>
          `;
        }

        return `
          <div class="viewer-attachment-item">
            <div class="viewer-attachment-info">
              <span class="viewer-attachment-icon">${icon}</span>
              <span class="viewer-attachment-text" title="${this.escapeHtml(text)}">${this.escapeHtml(displayText)}</span>
            </div>
            <div class="viewer-attachment-actions">
              <button class="btn-copy-attachment" data-index="${idx}" type="button">Copy</button>
            </div>
          </div>
        `;
        }).join('');

      if (isAlbum) {
        const openSourceNote = (idx) => {
          const att = allAttachments[idx];
          if (!att) return;
          let sourceNoteId = att.sourceNoteId;
          // Legacy fallback: infer source note by attachment id
          if (sourceNoteId == null && att.id != null) {
            const inferred = (this.notes || []).find(n => {
              if (!n || n.type === 'album') return false;
              const hasClip = Array.isArray(n.clips) && n.clips.some(c => c && c.id == att.id);
              const hasUrl = Array.isArray(n.urls) && n.urls.some(u => u && u.id == att.id);
              const hasImage = Array.isArray(n.images) && n.images.some(i => i && i.id == att.id);
              return hasClip || hasUrl || hasImage;
            });
            if (inferred) sourceNoteId = inferred.id;
          }

          if (sourceNoteId == null) {
            this.showToast('No source note for this item');
            return;
          }
          this.openAlbumSourceNoteOverlay(sourceNoteId, noteId);
        };

        // Copy handlers (albums)
        attachList.querySelectorAll('.btn-copy-album-attachment').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index, 10);
            const att = allAttachments[idx];
            if (!att) return;

            const copyText =
              att.type === 'url'
                ? att.url
                : att.type === 'image'
                  ? (att.url || att.src || att.dataUrl)
                  : att.text;

            if (copyText) {
              navigator.clipboard.writeText(copyText);
              this.showToast('Attachment copied!');
            }
          });
        });

        // Explicit open attachment (secondary action)
        attachList.querySelectorAll('.btn-open-album-attachment').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index, 10);
            if (!Number.isNaN(idx)) this.openAlbumAttachment(noteId, idx);
          });
        });

        attachList.querySelectorAll('.viewer-attachment-openable').forEach(item => {
          item.addEventListener('click', () => {
            const idx = parseInt(item.dataset.index, 10);
            if (!Number.isNaN(idx)) openSourceNote(idx);
          });
          item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              const idx = parseInt(item.dataset.index, 10);
              if (!Number.isNaN(idx)) openSourceNote(idx);
            }
          });
        });
      } else {
        // Add copy handlers (notes only)
        attachList.querySelectorAll('.btn-copy-attachment').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index, 10);
            const att = allAttachments[idx];
            if (att) {
              const copyText = att.type === 'url' ? att.url : att.text;
              if (copyText) {
                navigator.clipboard.writeText(copyText);
                this.showToast('Attachment copied!');
              }
            }
          });
        });
      }
    } else {
      attachSection.style.display = 'none';
      if (copyAllBtn) copyAllBtn.style.display = '';
    }

    modal.style.display = 'flex';
  }

  closeNoteViewer() {
    document.getElementById('noteViewerModal').style.display = 'none';
    this.currentViewerNoteId = null;
    this.noteViewerParentAlbumId = null;
  }

  getAlbumAttachmentOpenMode() {
    return this.albumAttachmentOpenMode === 'overlay' || this.albumAttachmentOpenMode === 'edgePopup'
      ? this.albumAttachmentOpenMode
      : 'edgePopup';
  }

  openAlbumAttachment(noteId, attachmentIndex) {
    const note = this.notes.find(n => n.id == noteId);
    if (!note || note.type !== 'album') return;

    const allAttachments = [
      ...(note.clips || []).map(c => ({ ...c, type: 'clip' })),
      ...(note.images || []).map(i => ({ ...i, type: 'image' })),
      ...(note.urls || []).map(u => ({ ...u, type: 'url' }))
    ];
    const att = allAttachments[attachmentIndex];
    if (!att) return;

    this.currentAlbumAttachmentContext = { noteId, attachmentIndex };

    const mode = this.getAlbumAttachmentOpenMode();
    if (mode === 'overlay') {
      this.openAlbumAttachmentOverlay(note, att);
      return;
    }

    this.openAlbumAttachmentInEdgePopup(noteId, attachmentIndex);
  }

  openAlbumAttachmentInEdgePopup(noteId, attachmentIndex) {
    const note = this.notes.find(n => n.id == noteId);
    if (!note || note.type !== 'album') return;

    const allAttachments = [
      ...(note.clips || []).map(c => ({ ...c, type: 'clip' })),
      ...(note.images || []).map(i => ({ ...i, type: 'image' })),
      ...(note.urls || []).map(u => ({ ...u, type: 'url' }))
    ];
    const att = allAttachments[attachmentIndex];
    if (!att) return;

    const mf = chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest() : null;
    const mfName = mf && mf.name ? String(mf.name) : '';
    const mfDesc = mf && mf.description ? String(mf.description) : '';
    const isRepoLoader =
      mfName.includes('Repo Loader') ||
      mfDesc.includes('repo root') ||
      mfDesc.includes('Actual extension lives in /extension');

    if (att.type === 'url' && att.url) {
      try {
        chrome.windows.create({
          url: att.url,
          type: 'popup',
          width: 980,
          height: 720,
          focused: true
        });
      } catch (e) {
        console.error('Failed to open URL in popup:', e);
        this.showToast('Could not open link');
      }
      return;
    }

    const viewerPath = isRepoLoader ? 'extension/attachment-viewer.html' : 'attachment-viewer.html';
    const viewerUrl =
      chrome.runtime.getURL(viewerPath) +
      `?noteId=${encodeURIComponent(String(noteId))}&index=${encodeURIComponent(String(attachmentIndex))}`;

    try {
      chrome.windows.create({
        url: viewerUrl,
        type: 'popup',
        width: 980,
        height: 720,
        focused: true
      });
    } catch (e) {
      console.error('Failed to open attachment viewer popup:', e);
      this.showToast('Could not open attachment');
    }
  }

  openAlbumAttachmentOverlay(note, att) {
    const modal = document.getElementById('albumAttachmentViewerModal');
    const titleEl = document.getElementById('albumAttachmentViewerTitle');
    const metaSection = document.getElementById('albumAttachmentViewerNoteMeta');
    const albumTitle = document.getElementById('albumAttachmentViewerAlbumTitle');
    const albumDesc = document.getElementById('albumAttachmentViewerAlbumDesc');
    const body = document.getElementById('albumAttachmentViewerBody');
    const openBtn = document.getElementById('albumAttachmentOpenInPopupBtn');

    if (!modal || !titleEl || !metaSection || !albumTitle || !albumDesc || !body) return;

    // Album meta
    const safeTitle = (note.title || '').trim() || 'Untitled Album';
    const safeDesc = (note.description || '').trim();
    metaSection.style.display = 'block';
    albumTitle.textContent = safeTitle;
    albumDesc.textContent = safeDesc || '';

    // Attachment content
    const typeLabel = att.type === 'clip' ? 'Clip' : att.type === 'image' ? 'Image' : 'Link';
    titleEl.textContent = typeLabel;

    // Always allow open-in-popup as an escape hatch
    if (openBtn) openBtn.style.display = 'inline-flex';

    if (att.type === 'clip') {
      body.textContent = att.text || '';
    } else if (att.type === 'image') {
      const src = att.dataUrl || att.url || att.src || '';
      if (src) {
        body.innerHTML = `<img src="${this.escapeHtml(src)}" alt="Album attachment" style="max-width:100%; border-radius:10px; border:1px solid #e5e7eb;" />`;
      } else {
        body.textContent = 'Image attachment is missing a source.';
      }
    } else {
      const url = att.url || '';
      const safeUrl = this.escapeHtml(url);
      body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="font-weight:600; color:#111827;">Link</div>
          <a href="${safeUrl}" target="_blank" rel="noreferrer" style="word-break:break-all; color:#2563eb; text-decoration:underline;">${safeUrl}</a>
          <div style="color:#6b7280; font-size:13px;">Use Open to launch this link in a popup window.</div>
        </div>
      `;
    }

    modal.style.display = 'flex';
  }

  closeAlbumAttachmentViewer() {
    const modal = document.getElementById('albumAttachmentViewerModal');
    if (modal) modal.style.display = 'none';
    this.currentAlbumAttachmentContext = null;
  }

  openAlbumSourceNoteOverlay(sourceNoteId, albumId) {
    const sourceNote = this.notes.find(n => n && n.id == sourceNoteId && n.type !== 'album');
    if (!sourceNote) {
      this.showToast('Source note not found');
      return;
    }

    const modal = document.getElementById('albumSourceNoteModal');
    const titleText = document.getElementById('albumSourceNoteTitleText');
    const descSection = document.getElementById('albumSourceNoteDescSection');
    const descText = document.getElementById('albumSourceNoteDesc');
    const body = document.getElementById('albumSourceNoteBody');
    const clipsSection = document.getElementById('albumSourceNoteClipsSection');
    const clipsList = document.getElementById('albumSourceNoteClips');
    const urlsSection = document.getElementById('albumSourceNoteUrlsSection');
    const urlsList = document.getElementById('albumSourceNoteUrls');
    const imagesSection = document.getElementById('albumSourceNoteImagesSection');
    const imagesList = document.getElementById('albumSourceNoteImages');

    if (!modal || !titleText || !descSection || !descText || !body || !clipsSection || !clipsList || !urlsSection || !urlsList || !imagesSection || !imagesList) {
      return;
    }

    this.currentAlbumSourceNoteContext = { sourceNoteId, albumId };

    const safeTitle = (sourceNote.title || '').trim();
    titleText.textContent = safeTitle || 'Untitled Note';

    const safeDesc = (sourceNote.description || '').trim();
    if (safeDesc) {
      descSection.style.display = 'block';
      descText.textContent = safeDesc;
    } else {
      descSection.style.display = 'none';
    }

    body.textContent = (sourceNote.body || '').trim() || 'No content';

    // Render sections
    const clips = Array.isArray(sourceNote.clips) ? sourceNote.clips : [];
    const urls = Array.isArray(sourceNote.urls) ? sourceNote.urls : [];
    const images = Array.isArray(sourceNote.images) ? sourceNote.images : [];

    clipsSection.style.display = clips.length > 0 ? 'block' : 'none';
    urlsSection.style.display = urls.length > 0 ? 'block' : 'none';
    imagesSection.style.display = images.length > 0 ? 'block' : 'none';

    clipsList.innerHTML = clips.map((c, idx) => {
      const text = (c && c.text) ? String(c.text) : '';
      const display = text.length > 120 ? text.substring(0, 120) + '...' : text;
      return `
        <div class="viewer-attachment-item" data-type="clip" data-index="${idx}">
          <div class="viewer-attachment-info">
            <span class="viewer-attachment-icon">📋</span>
            <span class="viewer-attachment-text" title="${this.escapeHtml(text)}">${this.escapeHtml(display)}</span>
          </div>
          <div class="viewer-attachment-actions">
            <button class="btn-copy-source-note-attachment" data-type="clip" data-index="${idx}" type="button">Copy</button>
          </div>
        </div>
      `;
    }).join('');

    urlsList.innerHTML = urls.map((u, idx) => {
      const url = (u && u.url) ? String(u.url) : '';
      const display = url.length > 120 ? url.substring(0, 120) + '...' : url;
      return `
        <div class="viewer-attachment-item" data-type="url" data-index="${idx}">
          <div class="viewer-attachment-info">
            <span class="viewer-attachment-icon">🔗</span>
            <span class="viewer-attachment-text" title="${this.escapeHtml(url)}">${this.escapeHtml(display)}</span>
          </div>
          <div class="viewer-attachment-actions">
            <button class="btn-copy-source-note-attachment" data-type="url" data-index="${idx}" type="button">Copy</button>
          </div>
        </div>
      `;
    }).join('');

    imagesList.innerHTML = images.map((i, idx) => {
      const src = (i && (i.url || i.src || i.dataUrl)) ? String(i.url || i.src || i.dataUrl) : '';
      const display = src.length > 120 ? src.substring(0, 120) + '...' : src;
      return `
        <div class="viewer-attachment-item" data-type="image" data-index="${idx}">
          <div class="viewer-attachment-info">
            <span class="viewer-attachment-icon">🖼️</span>
            <span class="viewer-attachment-text" title="${this.escapeHtml(src)}">${this.escapeHtml(display)}</span>
          </div>
          <div class="viewer-attachment-actions">
            <button class="btn-copy-source-note-attachment" data-type="image" data-index="${idx}" type="button">Copy</button>
          </div>
        </div>
      `;
    }).join('');

    // Per-attachment copy handlers
    modal.querySelectorAll('.btn-copy-source-note-attachment').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = btn.dataset.type;
        const idx = parseInt(btn.dataset.index, 10);
        if (Number.isNaN(idx)) return;

        let copyText = '';
        if (type === 'clip') {
          const c = clips[idx];
          copyText = c && c.text ? String(c.text) : '';
        } else if (type === 'url') {
          const u = urls[idx];
          copyText = u && u.url ? String(u.url) : '';
        } else if (type === 'image') {
          const i = images[idx];
          copyText = i ? String(i.url || i.src || i.dataUrl || '') : '';
        }

        if (copyText) {
          navigator.clipboard.writeText(copyText);
          this.showToast('Attachment copied!');
        }
      });
    });

    modal.style.display = 'flex';
  }

  closeAlbumSourceNoteOverlay() {
    const modal = document.getElementById('albumSourceNoteModal');
    if (modal) modal.style.display = 'none';
    this.currentAlbumSourceNoteContext = null;
  }

  getAlbumAttachmentOpenMode() {
    return this.albumAttachmentOpenMode === 'overlay' || this.albumAttachmentOpenMode === 'edgePopup'
      ? this.albumAttachmentOpenMode
      : 'edgePopup';
  }

  openAlbumAttachment(noteId, attachmentIndex) {
    const note = this.notes.find(n => n.id == noteId);
    if (!note || note.type !== 'album') return;

    const allAttachments = [
      ...(note.clips || []).map(c => ({ ...c, type: 'clip' })),
      ...(note.images || []).map(i => ({ ...i, type: 'image' })),
      ...(note.urls || []).map(u => ({ ...u, type: 'url' }))
    ];
    const att = allAttachments[attachmentIndex];
    if (!att) return;

    this.currentAlbumAttachmentContext = { noteId, attachmentIndex };

    const mode = this.getAlbumAttachmentOpenMode();
    if (mode === 'overlay') {
      this.openAlbumAttachmentOverlay(note, att);
      return;
    }

    this.openAlbumAttachmentInEdgePopup(noteId, attachmentIndex);
  }

  openAlbumAttachmentInEdgePopup(noteId, attachmentIndex) {
    const note = this.notes.find(n => n.id == noteId);
    if (!note || note.type !== 'album') return;

    const allAttachments = [
      ...(note.clips || []).map(c => ({ ...c, type: 'clip' })),
      ...(note.images || []).map(i => ({ ...i, type: 'image' })),
      ...(note.urls || []).map(u => ({ ...u, type: 'url' }))
    ];
    const att = allAttachments[attachmentIndex];
    if (!att) return;

    const mf = chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest() : null;
    const mfName = mf && mf.name ? String(mf.name) : '';
    const mfDesc = mf && mf.description ? String(mf.description) : '';
    const isRepoLoader =
      mfName.includes('Repo Loader') ||
      mfDesc.includes('repo root') ||
      mfDesc.includes('Actual extension lives in /extension');

    if (att.type === 'url' && att.url) {
      try {
        chrome.windows.create({
          url: att.url,
          type: 'popup',
          width: 980,
          height: 720,
          focused: true
        });
      } catch (e) {
        console.error('Failed to open URL in popup:', e);
        this.showToast('Could not open link');
      }
      return;
    }

    const viewerPath = isRepoLoader ? 'extension/attachment-viewer.html' : 'attachment-viewer.html';
    const viewerUrl =
      chrome.runtime.getURL(viewerPath) +
      `?noteId=${encodeURIComponent(String(noteId))}&index=${encodeURIComponent(String(attachmentIndex))}`;

    try {
      chrome.windows.create({
        url: viewerUrl,
        type: 'popup',
        width: 980,
        height: 720,
        focused: true
      });
    } catch (e) {
      console.error('Failed to open attachment viewer popup:', e);
      this.showToast('Could not open attachment');
    }
  }

  openAlbumAttachmentOverlay(note, att) {
    const modal = document.getElementById('albumAttachmentViewerModal');
    const titleEl = document.getElementById('albumAttachmentViewerTitle');
    const metaSection = document.getElementById('albumAttachmentViewerNoteMeta');
    const albumTitle = document.getElementById('albumAttachmentViewerAlbumTitle');
    const albumDesc = document.getElementById('albumAttachmentViewerAlbumDesc');
    const body = document.getElementById('albumAttachmentViewerBody');
    const openBtn = document.getElementById('albumAttachmentOpenInPopupBtn');

    if (!modal || !titleEl || !metaSection || !albumTitle || !albumDesc || !body) return;

    // Album meta
    const safeTitle = (note.title || '').trim() || 'Untitled Album';
    const safeDesc = (note.description || '').trim();
    metaSection.style.display = 'block';
    albumTitle.textContent = safeTitle;
    albumDesc.textContent = safeDesc || '';

    // Attachment content
    const typeLabel = att.type === 'clip' ? 'Clip' : att.type === 'image' ? 'Image' : 'Link';
    titleEl.textContent = typeLabel;

    // Always allow open-in-popup as an escape hatch
    if (openBtn) openBtn.style.display = 'inline-flex';

    if (att.type === 'clip') {
      body.textContent = att.text || '';
    } else if (att.type === 'image') {
      const src = att.dataUrl || att.url || att.src || '';
      if (src) {
        body.innerHTML = `<img src="${this.escapeHtml(src)}" alt="Album attachment" style="max-width:100%; border-radius:10px; border:1px solid #e5e7eb;" />`;
      } else {
        body.textContent = 'Image attachment is missing a source.';
      }
    } else {
      const url = att.url || '';
      const safeUrl = this.escapeHtml(url);
      body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="font-weight:600; color:#111827;">Link</div>
          <a href="${safeUrl}" target="_blank" rel="noreferrer" style="word-break:break-all; color:#2563eb; text-decoration:underline;">${safeUrl}</a>
          <div style="color:#6b7280; font-size:13px;">Use Open to launch this link in a popup window.</div>
        </div>
      `;
    }

    modal.style.display = 'flex';
  }

  closeAlbumAttachmentViewer() {
    const modal = document.getElementById('albumAttachmentViewerModal');
    if (modal) modal.style.display = 'none';
    this.currentAlbumAttachmentContext = null;
  }

  copyAllNoteAttachments() {
    const noteId = this.currentViewerNoteId;
    const note = this.notes.find(n => n.id == noteId);
    if (!note) return;

    const allText = [
      ...(note.clips || []).map(c => c.text || ''),
      ...(note.urls || []).map(u => u.url || '')
    ].filter(t => t).join('\n\n');

    if (allText) {
      navigator.clipboard.writeText(allText);
      this.showToast('All attachments copied!');
    } else {
      this.showToast('No attachments to copy');
    }
  }

  showAlbumPicker() {
    const modal = document.getElementById('albumPickerModal');
    this.renderAlbumPicker();
    modal.style.display = 'flex';
  }

  showAlbumPickerForNote() {
    const modal = document.getElementById('albumPickerModal');
    this.renderAlbumPicker();
    modal.style.display = 'flex';
  }

  closeAlbumPicker() {
    document.getElementById('albumPickerModal').style.display = 'none';
    this.pendingNoteForAlbum = null;
  }

  showBackToAlbumPicker() {
    const backBtn = document.getElementById('backToAlbumPicker');
    if (backBtn) {
      backBtn.style.display = 'block';
    }
  }

  hideBackToAlbumPicker() {
    const backBtn = document.getElementById('backToAlbumPicker');
    if (backBtn) {
      backBtn.style.display = 'none';
    }
  }

  renderAlbumPicker(searchTerm = '') {
    const list = document.getElementById('albumPickerList');
    
    // If we have a pending note to send to album, show only albums
    const showOnlyAlbums = !!this.pendingNoteForAlbum;
    let filteredNotes = showOnlyAlbums ? this.notes.filter(n => n.type === 'album') : this.notes;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredNotes = filteredNotes.filter(n => 
        n.title.toLowerCase().includes(term) || 
        n.description.toLowerCase().includes(term)
      );
    }

    if (filteredNotes.length === 0) {
      list.innerHTML = `<p style="text-align: center; color: #9ca3af; padding: 20px;">No ${showOnlyAlbums ? 'albums' : 'notes'} found</p>`;
      return;
    }

    list.innerHTML = filteredNotes.map(note => {
      const icon = note.type === 'album' ? '📚' : '📝';
      const itemCount =
        note.type === 'album'
          ? (Array.isArray(note.noteRefs) ? note.noteRefs.length : 0)
          : (note.clips?.length || 0) + (note.images?.length || 0) + (note.urls?.length || 0);
      const itemClass = note.type === 'album' ? 'album-picker-item album' : 'album-picker-item';

      return `
        <div class="${itemClass}" data-note-id="${note.id}">
          <div class="album-picker-info">
            <span class="album-picker-icon">${icon}</span>
            <div class="album-picker-details">
              <div class="album-picker-title">${this.escapeHtml(note.title)}</div>
              <div class="album-picker-meta">${itemCount} items</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers
    list.querySelectorAll('.album-picker-item').forEach(item => {
      item.addEventListener('click', async () => {
        const noteId = item.dataset.noteId;
        
        // Check if we're adding a note to an album or a clip to a note
        if (this.pendingNoteForAlbum) {
          await this.addNoteToAlbum(noteId);
        } else {
          await this.addCurrentClipToNote(noteId);
        }
      });
    });
  }

  filterAlbumPicker(searchTerm) {
    this.renderAlbumPicker(searchTerm);
  }

  async addCurrentClipToNote(noteId) {
    const note = this.notes.find(n => n.id == noteId);
    if (!note) return;

    // Get the clip to add (pending clip or most recent clip)
    let clipToAdd = this.pendingClipForNotes;
    
    if (!clipToAdd) {
      if (this.clips.length === 0) {
        this.showToast('No clips to add');
        return;
      }
      clipToAdd = this.clips[0];
    }

    if (!note.clips) note.clips = [];
    
    note.clips.push({
      type: 'clip',
      id: clipToAdd.id,
      text: clipToAdd.text,
      addedDate: Date.now()
    });

    note.updatedAt = Date.now();
    this.refreshAlbumsForNote(note);
    await this.saveNotes();
    this.closeAlbumPicker();
    this.pendingClipForNotes = null; // Clear pending clip
    this.showToast(`Clip added to "${note.title}"`);
  }

  async addNoteToAlbum(albumId) {
    const album = this.notes.find(n => n.id == albumId && n.type === 'album');
    const sourceNote = this.pendingNoteForAlbum;
    
    if (!album || !sourceNote) return;

    // Copy content from note to album (keep original note unchanged)
    if (!album.clips) album.clips = [];
    if (!album.urls) album.urls = [];
    if (!album.images) album.images = [];
    if (!Array.isArray(album.sourceNoteIds)) album.sourceNoteIds = [];
    if (!album.sourceNoteIds.includes(sourceNote.id)) album.sourceNoteIds.push(sourceNote.id);

    // Add a special "note content" clip if the note has body content
    if (sourceNote.body && sourceNote.body.trim()) {
      album.clips.push({
        type: 'clip',
        id: Date.now() + Math.random(),
        text: `[From: ${sourceNote.title || 'Untitled Note'}]\n\n${sourceNote.body}`,
        addedDate: Date.now(),
        sourceNoteId: sourceNote.id
      });
    }

    // Copy all attachments from source note
    if (sourceNote.clips?.length > 0) {
      album.clips.push(...sourceNote.clips.map(c => ({
        ...c,
        addedDate: Date.now(),
        sourceNoteId: sourceNote.id
      })));
    }

    if (sourceNote.urls?.length > 0) {
      album.urls.push(...sourceNote.urls.map(u => ({
        ...u,
        addedDate: Date.now(),
        sourceNoteId: sourceNote.id
      })));
    }

    if (sourceNote.images?.length > 0) {
      album.images.push(...sourceNote.images.map(i => ({
        ...i,
        addedDate: Date.now(),
        sourceNoteId: sourceNote.id
      })));
    }

    album.updatedAt = Date.now();
    await this.saveNotes();
    this.closeAlbumPicker();
    this.pendingNoteForAlbum = null;
    this.showToast(`Note added to album "${album.title}"`);
    this.renderNotes(); // Refresh to show updated counts
  }
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Popup script loaded');
  try {
    window.pasteCraftPopup = new PasteCraftPopup();
  } catch (error) {
    console.error('❌ Popup initialization failed:', error);
    // Fallback simple interface
    document.body.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h2>📋 PasteCraft</h2>
        <div id="simpleClips"></div>
        <p style="color: #666; font-size: 12px;">Right-click selected text to save clips</p>
      </div>
    `;
    loadSimpleClips();
  }
});

// Also boot immediately if DOMContentLoaded already fired (resilience for any non-blocking script load edge-cases)
if (document.readyState !== 'loading' && !window.pasteCraftPopup) {
  try {
    window.pasteCraftPopup = new PasteCraftPopup();
  } catch (error) {
    console.error('❌ Popup initialization failed (immediate boot):', error);
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  PasteCraftPopup.handleMessage(message);
  sendResponse(true);
});

async function loadSimpleClips() {
  const { clips = [] } = await chrome.storage.local.get(['clips']);
  const container = document.getElementById('simpleClips');
  
  if (clips.length === 0) {
    container.innerHTML = '<p style="color: #999;">No clips yet</p>';
    return;
  }
  
  clips.forEach((clip, index) => {
    const div = document.createElement('div');
    div.style.cssText = 'background: #f0f0f0; margin: 8px 0; padding: 8px; border-radius: 4px; cursor: pointer;';
    div.textContent = clip.text.substring(0, 50) + (clip.text.length > 50 ? '...' : '');
    div.onclick = async () => {
      await navigator.clipboard.writeText(clip.text);
      div.style.background = '#90EE90';
      setTimeout(() => div.style.background = '#f0f0f0', 500);
    };
    container.appendChild(div);
  });
}
