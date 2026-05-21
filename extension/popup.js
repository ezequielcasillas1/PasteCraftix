// PasteCraft Advanced Popup Script
// (startup logging removed)

const PASTECRAFT_LOGS_ENABLED = (() => {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.PASTECRAFT_DEBUG === true) {
      return true;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('pastecraft_debug') === 'true';
    }
  } catch (_) {
    // Ignore storage access errors.
  }
  return false;
})();

if (!PASTECRAFT_LOGS_ENABLED && typeof console !== 'undefined') {
  const pastecraftNoop = () => {};
  console.log = pastecraftNoop;
  console.debug = pastecraftNoop;
  console.info = pastecraftNoop;
}

// PasteCraftCRUD — loaded from popup/shared/pastecraft-crud.js (before popup.js)

class PasteCraftPopup {
  constructor() {
    console.log('?? PasteCraftPopup constructor called');
    this.clips = [];
    this.categories = [];
    // NOTE: selectedChips stores stable clip id keys (String(clip.id)), not indices.
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
    // Global theme (single source of truth). Quick Paste follows this.
    this.theme = 'light'; // 'light' | 'dark'
    // Dark mode is enabled (single source of truth: `theme`).
    this.darkModeComingSoon = true;
    this._themeSyncing = false;
    this.searchOnlyClips = [];
    // These store stable clip id keys (String(clip.id)), not numbers.
    this.selectedCategoryClips = new Set();
    this.selectedSearchClips = new Set();
    this.expandedCategoryIds = new Set();
    this.categoryUiOrderSelectedIds = [];
    // Pending clip reference for category modal actions (stable clip id key)
    this.pendingClipId = null;

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
    
    // Tiered storage for lazy loading
    this.tieredClipsStore = null;
    this.tieredNotesStore = null;
    this.tieredArchivedStore = null;
    this.totalClipsCount = 0; // Total clips including remote
    this.totalNotesCount = 0; // Total notes including remote
    this.totalArchivedCount = 0; // Total archived including remote
    this._isLazyLoading = false; // Flag for loading indicator
    
    // Magic preview state
    this._magicAnalysis = [];
    this._magicSelected = new Set();
    this._magicPage = 0;
    this._magicUndoSnapshot = null;

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
    
    // Session persistence state
    this._currentAiLabSubTab = 'generator';
    this._currentSummarySection = 'input';
    
    // Countdown timers
    this.aiGenerationTimerInterval = null;
    this.profileCollapseInterval = null;
    this.nameCollapseInterval = null;

    // Auto-refresh while sync progress is visible
    this._syncAutoRefreshTimeout = null;
    this._syncAutoRefreshInFlight = false;
    this._syncAutoRefreshIntervalMs = 5000;
    
    // Analysis history
    this.analysisHistory = [];

    // AI History (persistent conversation logs)
    this.aiHistoryEntries = [];
    this.currentHistoryEntry = null;
    this.currentHistoryThreadIndex = 0;
    this._activeBreakdownHistoryId = null; // tracks active breakdown conversation
    this._activeSummaryHistoryId = null;   // tracks active summary conversation
    this._aiHistorySearchQuery = '';
    this._aiHistoryFilterType = 'all';
    
    // Notes system
    this.notes = [];
    this.currentNoteId = null;
    this.currentNoteType = 'note';
    this.currentNoteAttachments = [];
    this.pendingClipForNotes = null;
    this.pendingBulkClipsForNotes = null; // array of clip objects for bulk send-to-notes
    this.pendingBulkClipIds = null; // array of clip id keys for bulk send-to-categories
    this.pendingNoteForAlbum = null;
    this.currentViewerNoteId = null;
    this.currentAlbumAttachmentContext = null;
    this.noteViewerParentAlbumId = null;
    this.notesViewMode = 'notes'; // 'notes' | 'albums'
    this.notesPageIndex = 0; // starts at 0
    this.notesAiEnabled = false;
    this.albumAttachmentOpenMode = 'overlay'; // 'edgePopup' | 'overlay'
    this.idb = (typeof window !== 'undefined' && window.pasteCraftIndexedDB) ? window.pasteCraftIndexedDB : null;
    this._idbReady = false;

    // Serialize clip mutations to prevent races / double-click issues.
    this._clipOpQueue = Promise.resolve();

    // Auth preferences (local-only; never store passwords)
    this._authPrefsKey = 'pc_auth_prefs_v1';

    // Freemium guest mode (skipped login)
    this._isFreemiumGuest = false;

    // Restore points (local snapshots)
    this._restorePointsKey = 'pc_restore_points_v1';
    this._lastRestoreAtKey = 'pc_last_restore_at';
    this._lastRestorePointIdKey = 'pc_last_restore_point_id';
    this._restoreSkipCloudSyncWindowMs = 5 * 60 * 1000; // 5 minutes
    this._lastPreviewRestore = null; // { point, cutoffMs, windowKey }
    this._lastAppliedRestore = null; // { point, appliedAt }

    // AI workflow override (provider + preset)
    this._aiWorkflowKey = 'pc_ai_workflow_v1';
    this.aiWorkflow = {
      enabled: false,
      provider: 'openai',
      preset: 'default',
      updatedAt: 0
    };
    
    // BroadcastChannel is initialized by settingsFeature in _initializeSettingsFeature()
    this._broadcastChannel = null;
    
    this.init();
  }

  // =====================================================
  // AI WORKFLOW (provider + preset) - versioned storage
  // =====================================================

  // Weighted credit cost per AI text call (mirrors server CREDIT_COST map)
  static AI_CREDIT_COSTS = {
    openai: { default: 40, cheapest: 25, gpt5_mini: 200, latest: 500 },
    google: { default: 40, cheapest: 25, gemini_pro: 350, latest: 100 },
  };

  // Provider ? preset options mapping (single source of truth)
  static AI_PROVIDER_PRESETS = {
    openai: [
      { value: 'default',   label: 'Default (4o-mini) � 40 cr' },
      { value: 'cheapest',  label: 'Cheap (GPT-5 Nano) � 25 cr' },
      { value: 'gpt5_mini', label: 'Balanced (GPT-5 Mini) � 200 cr' },
      { value: 'latest',    label: 'Latest (GPT-5.2) � 500 cr' },
    ],
    google: [
      { value: 'default',        label: 'Default (Gemini 2.0 Flash) � 40 cr' },
      { value: 'cheapest',       label: 'Cheap (Gemini 2.0 Flash-Lite) � 25 cr' },
      { value: 'gemini_pro',     label: 'Balanced (Gemini 2.5 Pro) � 350 cr' },
      { value: 'latest',         label: 'Latest (Gemini 2.5 Flash) � 100 cr' },
    ],
    anthropic: [
      { value: 'default', label: 'Default (Coming Soon)' },
    ],
    groq: [
      { value: 'default', label: 'Default (Coming Soon)' },
    ],
  };

  static AI_ALLOWED_PROVIDERS = new Set(['openai', 'google', 'anthropic', 'groq']);

  _normalizeAiWorkflow(raw) {
    return this.aiLabFeature.credits._normalizeAiWorkflow.call(this, raw);
  }

  async loadAiWorkflow() {
    return this.aiLabFeature.credits.loadAiWorkflow.call(this);
  }

  applyAiWorkflowToUi() {
    return this.aiLabFeature.credits.applyAiWorkflowToUi.call(this);
  }

  async saveAiWorkflowFromUi(silent = true) {
    return this.aiLabFeature.credits.saveAiWorkflowFromUi.call(this, silent);
  }

  // =====================================================
  // LEGACY AUTH PREFS CLEANUP
  // =====================================================

  async clearLegacyAuthPrefs() {
    return this.authFeature.service.clearLegacyAuthPrefs(this);
  }

  _clipIdKey(id) {
    return this.clipsFeature.state.getClipIdKey(id);
  }

  _clipTitle(clip) {
    return this.clipsFeature.state.getClipTitle(clip);
  }

  _clipFallbackTitle(clip, maxLength = 42) {
    return this.clipsFeature.state.getClipFallbackTitle(clip, maxLength);
  }

  _clipAttachment(clip, addedDate = Date.now()) {
    return this.clipsFeature.state.getClipAttachment(clip, addedDate);
  }

  _categoryIdKey(category) {
    return this.categoriesFeature.state.getCategoryIdKey(category);
  }

  _queueClipOp(fn) {
    return this.clipsFeature.state.queueClipOp(this, fn);
  }

  getSelectedClipIdsInUiOrder() {
    return this.clipsFeature.state.getSelectedClipIdsInUiOrder(this);
  }

  async deleteClipsByIdKeys(idKeys, {
    includeArchived = true,
    reason = 'delete:unknown',
    closeCategoryModal = false,
    clearSelection = true,
    rerender = true
  } = {}) {
    return this.clipsFeature.service.deleteClipsByIdKeys(this, idKeys, {
      includeArchived,
      reason,
      closeCategoryModal,
      clearSelection,
      rerender
    });
  }
  
  async init() {
    // Guarantees that the purple loading overlay never gets stuck. Wraps the
    // real init body in try/catch/finally with an absolute 10s watchdog so a
    // throw, hang, or network stall can't freeze the popup in a loading state.
    const watchdog = setTimeout(() => {
      try {
        console.warn('? init() watchdog fired at 10s � force-hiding overlay');
        this.hideLoadingOverlay();
        this._showOfflineModeBanner();
      } catch (_) {}
    }, 10000);

    try {
      await this._initImpl();
    } catch (e) {
      console.error('? init() failed:', e);
      try { this._showOfflineModeBanner(); } catch (_) {}
    } finally {
      clearTimeout(watchdog);
      try { this.hideLoadingOverlay(); } catch (_) {}
    }
  }

  _showOfflineModeBanner() {
    if (document.getElementById('pcOfflineModeBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'pcOfflineModeBanner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10001;background:#b45309;color:#fff;font-size:12px;padding:6px 10px;text-align:center;cursor:pointer;';
    banner.textContent = 'Loaded in offline mode � click to retry';
    banner.addEventListener('click', () => { try { window.location.reload(); } catch (_) {} });
    (document.body || document.documentElement).appendChild(banner);
  }

  async _initializeClipsFeature() {
    if (this.clipsFeature) return this.clipsFeature;
    const { initClipsFeature } = await import('./popup/features/clips/clips.controller.js');
    this.clipsFeature = initClipsFeature(this);
    return this.clipsFeature;
  }

  async _initializeCategoriesFeature() {
    if (this.categoriesFeature) return this.categoriesFeature;
    const { initCategoriesFeature } = await import('./popup/features/categories/categories.controller.js');
    this.categoriesFeature = initCategoriesFeature(this);
    return this.categoriesFeature;
  }

  async _initializeNotesFeature() {
    if (this.notesFeature) return this.notesFeature;
    const { initNotesFeature } = await import('./popup/features/notes/notes.controller.js');
    this.notesFeature = initNotesFeature(this);
    return this.notesFeature;
  }

  async _initializeAiLabFeature() {
    if (this.aiLabFeature) return this.aiLabFeature;
    const { initAiLabFeature } = await import('./popup/features/ai-lab/ai-lab.controller.js');
    this.aiLabFeature = initAiLabFeature(this);
    return this.aiLabFeature;
  }

  async _initializeSettingsFeature() {
    if (this.settingsFeature) return this.settingsFeature;
    const { initSettingsFeature } = await import('./popup/features/settings/settings.controller.js');
    this.settingsFeature = initSettingsFeature(this);
    return this.settingsFeature;
  }

  async _initializeActivityFeature() {
    if (this.activityFeature) return this.activityFeature;
    const { initActivityFeature } = await import('./popup/features/activity/activity.controller.js');
    this.activityFeature = initActivityFeature(this);
    return this.activityFeature;
  }

  async _initializeAuthFeature() {
    if (this.authFeature) return this.authFeature;
    const { initAuthFeature } = await import('./popup/features/auth/auth.controller.js');
    this.authFeature = initAuthFeature(this);
    return this.authFeature;
  }

  async _initializeProfileFeature() {
    if (this.profileFeature) return this.profileFeature;
    const { initProfileFeature } = await import('./popup/features/profile/profile.controller.js');
    this.profileFeature = initProfileFeature(this);
    return this.profileFeature;
  }

  async _initializeBillingFeature() {
    if (this.billingFeature) return this.billingFeature;
    const { initBillingFeature } = await import('./popup/features/billing/billing.controller.js');
    this.billingFeature = initBillingFeature(this);
    return this.billingFeature;
  }

  async _initializeSyncFeature() {
    if (this.syncFeature) return this.syncFeature;
    const { initSyncFeature } = await import('./popup/features/sync/sync.controller.js');
    this.syncFeature = initSyncFeature(this);
    return this.syncFeature;
  }

  async _initializeFilesFeature() {
    if (this.filesFeature) return this.filesFeature;
    const { initFilesFeature } = await import('./popup/features/files/files.controller.js');
    this.filesFeature = initFilesFeature(this);
    return this.filesFeature;
  }

  async _initImpl() {
    console.log('?? Initializing PasteCraft popup...');
    await this._initializeClipsFeature();
    await this._initializeCategoriesFeature();
    await this._initializeFilesFeature();
    await this._initializeNotesFeature();
    await this._initializeAiLabFeature();
    await this._initializeSettingsFeature();
    await this._initializeActivityFeature();
    await this._initializeAuthFeature();
    await this._initializeProfileFeature();
    await this._initializeBillingFeature();
    await this._initializeSyncFeature();

    // Setup auth modal events FIRST (before checking auth)
    this.setupAuthModalEvents();
    this._setupSupportFormEvents();

    // --- V2 MODE GATE: read local-mode flag FIRST, before any Supabase call ---
    let isLocalGuest = false;
    try {
      const { pc_freemium_guest } = await chrome.storage.local.get('pc_freemium_guest');
      isLocalGuest = !!pc_freemium_guest;
    } catch (_) {}

    if (isLocalGuest) {
      // Actively clear any stale cloud auth state so it can't interfere later
      try { await chrome.storage.local.remove(['pc_supabase_session_v1', 'oauth_callback', 'password_reset_callback']); } catch (_) {}
      try { pasteCraftSupabase.signOutFast().catch(() => {}); } catch (_) {}
      // Go straight to local mode � no cloud auth calls at all
      this._isFreemiumGuest = true;
      this.currentUser = null;
      this.userSubscription = null;
      document.getElementById('topBar').style.display = 'flex';
      await Promise.all([this.loadData(), this.loadSettings()]);
      this.updateTopBarIdentity();
      await this.setupEventListeners();
      this.renderChips();
      this.updateLastCapture();
      this.updatePreview();
      this.renderCategories();
      this.updateCategoryFilter();
      this.hideLoadingOverlay();
      this.setupVisibilityListener();
      Promise.resolve().then(() => this.cleanupOldClips()).catch(() => {});
      return;
    }

    // --- CLOUD AUTH PATH (only reached when NOT in local mode) ---

    // Check if this is a password reset callback from storage
    const resetCallback = await this.checkPasswordResetCallback();
    if (resetCallback) {
      console.log('?? Password reset callback detected from storage');
      this.hideLoadingOverlay();
      document.getElementById('newPasswordModal').style.display = 'flex';
      return;
    }
    
    // Check if this is a password reset callback from URL
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    console.log('?? URL check:', {
      search: window.location.search,
      hash: window.location.hash,
      type: hashParams.get('type'),
      accessToken: hashParams.get('access_token') ? 'present' : 'missing'
    });
    
    if (urlParams.get('reset') === 'true' || hashParams.get('type') === 'recovery' || hashParams.get('reset')) {
      console.log('?? Password reset callback detected from URL');
      const accessToken = hashParams.get('access_token') || hashParams.get('reset');
      const refreshToken = hashParams.get('refresh_token');
      if (accessToken) {
        await this.setPasswordResetSession(accessToken, refreshToken);
      }
      this.hideLoadingOverlay();
      document.getElementById('newPasswordModal').style.display = 'flex';
      return;
    }
    
    // Check for OAuth callback tokens
    await this.checkOAuthCallback();

    // Restore database auth before the signed-in check. After an OS/browser
    // restart, supabase-js may start empty while chrome.storage still has the
    // refresh token bridge needed to rehydrate the session.
    try {
      await this.clearLegacyAuthPrefs();
      await this.restoreSupabaseSessionFromBridge('startup');
    } catch (_) {}

    // Check if user is authenticated
    const currentUser = await pasteCraftSupabase.getCurrentUser();

    if (!currentUser) {
      // Show auth modal (no freemium fallback here � that's handled by the mode gate above)
      this.showAuthModal();
      return;
    }
    
    // User is authenticated, proceed with normal init
    console.log('? User authenticated:', currentUser.email);
    this.currentUser = currentUser;


    // Load subscription info
    // Do NOT block popup UI on slow network subscription fetch.
    // Use cached subscription if available, then refresh in background.
    try {
      this.userSubscription = await pasteCraftSupabase.getCachedSubscription(currentUser.id);
    } catch (_) {
      this.userSubscription = null;
    }
    console.log('?? Subscription tier (cached):', this.userSubscription?.subscription_tier);
    // Best-effort credits render from cached subscription snapshot.
    this.updateAiCreditsPills('cached');
    this.updateUpgradeUI();

    pasteCraftSupabase.getUserSubscription(currentUser.id).then((sub) => {
      this.userSubscription = sub;
      console.log('?? Subscription tier (fresh):', this.userSubscription?.subscription_tier);
      this.updateAiCreditsPills('fresh');
      this.updateUpgradeUI();
    }).catch(() => {});
    
    // Show top bar (with sign out button)
    document.getElementById('topBar').style.display = 'flex';
    
    this.setupLocalStorageListener();
    await this._ensureIndexedDbReadyAndMigrate();

    // Parallelize independent storage reads for faster startup
    await Promise.all([
      this.loadData(),
      this.loadSettings(),
      this.loadAiWorkflow(),
      this.loadUserProfile(),
      this.loadAnalysisHistory(),
      this.loadAiHistory(),
    ]);

    // If local profile is empty/incomplete (new device), fetch from Supabase immediately.
    // Profile is identity data � not gated by cloud sync tier. Timeout to prevent hanging.
    if (!this.userProfile?.userName && !this.userProfile?.aiGeneratedName && !this.userProfile?.profileImageUrl) {
      try {
        const remoteProfile = await Promise.race([
          pasteCraftSupabase.syncUserProfileFromSupabase(),
          new Promise((resolve) => setTimeout(() => resolve(null), 3000))
        ]);
        if (remoteProfile) {
          this.userProfile = { ...(this.userProfile || {}), ...remoteProfile };
          await chrome.storage.local.set({ userProfile: this.userProfile });
          console.log('✅ Profile hydrated from Supabase on fresh device');
        }
      } catch (_) {}
    }

    // Always update top bar name/image (even if no image saved yet)
    this.updateTopBarIdentity();
    
    if (this.userProfile?.profileImageUrl) {
      this.displayImageTopLeft(this.userProfile.profileImageUrl);
    }
    
    await this.setupEventListeners();
    this.renderChips();
    this.updateLastCapture();
    this.updatePreview();
    this.renderCategories();
    this.updateCategoryFilter();

    // ?? HIDE LOADING OVERLAY (local data loaded, ready to show).
    // Done BEFORE _restoreSessionState() so a slow Supabase call inside
    // the session-restore path (loadNotes/loadActivityLog/loadAiHistory)
    // cannot stall the visible UI behind the purple overlay.
    this.hideLoadingOverlay();

    // ?? RESTORE SESSION STATE (active tab, AI content, etc.) � fire and
    // forget. The restored tab shows its own lightweight inline loading
    // state while its data arrives.
    this._restoreSessionState().catch((e) => {
      console.warn('Session restore failed:', e);
    });

    // Run potentially heavy maintenance tasks in background (do not block popup render)
    Promise.resolve()
      .then(() => this.maybeCreateDailyRestorePoint('startup'))
      .catch(() => {});

    // Auto-delete cleanup can be slow with large clip sets; run in background.
    Promise.resolve()
      .then(() => this.cleanupOldClips())
      .catch(() => {});
    
    // ?? SYNC WITH SUPABASE IN BACKGROUND (don't await - let it happen naturally)
    this.performBackgroundSync();
    
    // ?? TIERED STORAGE MIGRATION (move excess data to cloud if needed)
    Promise.resolve()
      .then(() => this._maybeMigrateTieredStorage())
      .catch(e => console.warn('Tiered storage migration skipped:', e));
    
    // Reload data whenever popup becomes visible
    this.setupVisibilityListener();
    
    // Setup realtime data sync listeners
    this.setupRealtimeListeners();
    
    // Setup sync status listeners
    this.setupSyncStatusListeners();
    
    console.log('? PasteCraft popup initialized successfully');
  }

  _formatShortDate(isoOrDate) {
    try {
      const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
      if (Number.isNaN(d.getTime())) return null;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (_) {
      return null;
    }
  }

  _computeAiImageCreditsView(subscription) {
    return this.aiLabFeature.credits._computeAiImageCreditsView.call(this, subscription);
  }

  _computeAiTextCreditsView(subscription) {
    return this.aiLabFeature.credits._computeAiTextCreditsView.call(this, subscription);
  }

  /** Update the label text of a credit pill without destroying child elements (tooltips). */
  _setPillLabel(el, text) {
    return this.aiLabFeature.credits._setPillLabel.call(this, el, text);
  }

  /** Build provider-aware cost breakdown HTML for the text-credits tooltip. */
  _buildCreditCostHtml() {
    return this.aiLabFeature.credits._buildCreditCostHtml.call(this);
  }

  updateAiCreditsPills(source = '') {
    return this.aiLabFeature.credits.updateAiCreditsPills.call(this, source);
  }

  // Back-compat: older callsites.
  updateAiCreditsPill(source = '') {
    return this.aiLabFeature.credits.updateAiCreditsPill.call(this, source);
  }

  setupLocalStorageListener() {
    return this.authFeature.session.setupLocalStorageListener(this);
  }

  async _ensureIndexedDbReadyAndMigrate() {
    return this.syncFeature?.storage?.ensureIndexedDbReadyAndMigrate?.(this);
  }

  async _mirrorChangedLocalStateToIndexedDb(changes) {
    return this.syncFeature?.storage?.mirrorChangedLocalStateToIndexedDb?.(this, changes);
  }

  // =====================================================
  // RESTORE POINTS (Local daily snapshots)
  // =====================================================

  async maybeCreateDailyRestorePoint(reason = 'daily', localOverride = null) {
    return this.settingsFeature?.restore?.maybeCreateDailyRestorePoint?.(reason, localOverride);
  }

  async createManualRestorePoint(reason = 'manual') {
    return this.settingsFeature?.restore?.createManualRestorePoint?.(reason);
  }

  async previewRestore(windowKey) {
    return this.settingsFeature?.restore?.previewRestore?.(windowKey);
  }

  async applyRestoreFromPreview() {
    return this.settingsFeature?.restore?.applyRestoreFromPreview?.();
  }

  async syncRestoredDataToCloud() {
    return this.settingsFeature?.restore?.syncRestoredDataToCloud?.();
  }

  repairLocalClipIds(clipsRaw, searchOnlyRaw) {
    return this.syncFeature?.repair?.repairLocalClipIds?.(clipsRaw, searchOnlyRaw);
  }

  async performBackgroundSync(options) {
    return this.syncFeature?.listener?.performBackgroundSync?.(this, options);
  }
  
  hideLoadingOverlay() {
    return PasteCraftPopupUi.hideLoadingOverlay();
  }

  // -- Upgrade UI (Freemium ? Basic/Enhanced) --------------------------
  _isFreemiumUser() {
    return this.billingFeature?.upgradeUi?.isFreemiumUser?.(this) ?? true;
  }

  updateUpgradeUI() {
    return this.billingFeature?.upgradeUi?.updateUpgradeUI?.(this);
  }

  openUpgradeModal() {
    return this.billingFeature?.service?.openUpgradeModal?.(this);
  }

  closeUpgradeModal() {
    return this.billingFeature?.service?.closeUpgradeModal?.(this);
  }

  _openPricingPage() {
    return this.billingFeature?.service?.openPricingPage?.();
  }

  async _createCheckout(priceId) {
    return this.billingFeature?.service?.createCheckout?.(this, priceId);
  }

  setupVisibilityListener() {
    return this.syncFeature?.visibility?.setupVisibilityListener?.(this);
  }
  
  setupSyncStatusListeners() {
    return this.syncFeature?.listener?.setupSyncStatusListeners?.(this);
  }

  _clearSyncAutoRefresh() {
    return this.syncFeature?.listener?.clearSyncAutoRefresh?.(this);
  }

  _isSyncProgressVisible() {
    return this.syncFeature?.listener?.isSyncProgressVisible?.() ?? false;
  }

  _scheduleSyncAutoRefreshTick() {
    return this.syncFeature?.listener?.scheduleSyncAutoRefreshTick?.(this);
  }

  async _runSyncAutoRefreshTick() {
    return this.syncFeature?.listener?.runSyncAutoRefreshTick?.(this);
  }
  
  setupRealtimeListeners() {
    return this.syncFeature?.listener?.setupRealtimeListeners?.(this);
  }
  
  updateSyncIndicator(status, queueLength = 0) {
    return this.syncFeature?.listener?.updateSyncIndicator?.(this, status, queueLength);
  }
  
  updateSyncProgress(current, total, percentage) {
    return this.syncFeature?.listener?.updateSyncProgress?.(this, current, total, percentage);
  }

  async loadData() {
    return this.syncFeature?.loader?.loadData?.(this);
  }

  /**
   * Initialize tiered storage and get remote counts for lazy loading
   * @private
   */
  async _initializeTieredStorage() {
    return this.syncFeature?.storage?.initializeTieredStorage?.(this);
  }
  
  async enforceClipLimit() {
    return this.clipsFeature.service.enforceClipLimit(this);
  }
  
  async setupEventListeners() {
    const { registerPopupEventListeners } = await import('./popup/popup.events.js');
    registerPopupEventListeners(this);
  }
  
  // =====================================================
  // AUTHENTICATION METHODS
  // =====================================================
  
  async checkOAuthCallback() {
    try {
      const result = await chrome.storage.local.get('oauth_callback');
      if (result.oauth_callback) {
        const { access_token, refresh_token } = result.oauth_callback;
        console.log('?? Found OAuth callback tokens, completing sign in...');
        
        // Set session with tokens (timeout to prevent hang)
        try {
          const { error } = await Promise.race([
            pasteCraftSupabase.client.auth.setSession({ access_token, refresh_token }),
            new Promise((_, rej) => setTimeout(() => rej(new Error('setSession timeout')), 3000))
          ]);
          
          if (!error) {
            console.log('? OAuth sign in completed!');
            try {
              const { data: { user } } = await Promise.race([
                pasteCraftSupabase.client.auth.getUser(),
                new Promise((_, rej) => setTimeout(() => rej(new Error('getUser timeout')), 3000))
              ]);
              
              // Create subscription for new user
              if (user) {
                await pasteCraftSupabase.createUserSubscription(user.id, user.email);
              }
            } catch (_) {}
          } else {
            console.error('? Failed to set session:', error);
          }
        } catch (timeoutErr) {
          console.warn('?? setSession timed out, session bridge will handle auth');
        }
        
        // Clear the temporary tokens regardless
        await chrome.storage.local.remove('oauth_callback');
      }
    } catch (error) {
      console.error('? Error checking OAuth callback:', error);
    }
  }

  async checkPasswordResetCallback() {
    try {
      console.log('=================================');
      console.log('?? CHECKING PASSWORD RESET CALLBACK');
      console.log('=================================');
      console.log('?? Reading from chrome.storage.local...');
      
      const result = await chrome.storage.local.get('password_reset_callback');
      console.log('?? Storage result:', result);
      
      if (result.password_reset_callback) {
        const { access_token, refresh_token, type, timestamp } = result.password_reset_callback;
        console.log('? Password reset callback data found!');
        console.log('?? Data details:', {
          access_token_length: access_token?.length,
          refresh_token_length: refresh_token?.length,
          type: type,
          timestamp: new Date(timestamp).toISOString(),
          age_seconds: (Date.now() - timestamp) / 1000
        });
        
        if (type === 'recovery') {
          console.log('?? Type is "recovery" - setting database session...');
          
          // Set session with recovery tokens
          const { error } = await pasteCraftSupabase.client.auth.setSession({
            access_token,
            refresh_token
          });
          
          if (!error) {
            console.log('? Password reset session established successfully!');
            
            // Verify session
            const { data: { user } } = await pasteCraftSupabase.client.auth.getUser();
            console.log('?? Current user after session:', user?.email);
            
            // Clear the temporary tokens
            console.log('?? Clearing temporary tokens from storage...');
            await chrome.storage.local.remove('password_reset_callback');
            console.log('? Tokens cleared');
            
            return true;
          } else {
            console.error('? Failed to set password reset session:', error);
            console.error('Error details:', JSON.stringify(error, null, 2));
          }
        } else {
          console.warn('?? Type is not "recovery":', type);
        }
      } else {
        console.log('?? No password reset callback data in storage');
      }
    } catch (error) {
      console.error('? Error checking password reset callback:', error);
      console.error('Error stack:', error.stack);
    }
    return false;
  }

  async setPasswordResetSession(accessToken, refreshToken) {
    try {
      console.log('?? Setting password reset session from URL tokens');
      
      const { error } = await pasteCraftSupabase.client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      
      if (!error) {
        console.log('? Password reset session established from URL!');
      } else {
        console.error('? Failed to set password reset session:', error);
      }
    } catch (error) {
      console.error('? Error setting password reset session:', error);
    }
  }
  
  showAuthModal() {
    return this.authFeature.events.showAuthModal(this);
  }

  hideAuthModal() {
    return this.authFeature.events.hideAuthModal(this);
  }

  async _getSessionBridgePayload() {
    return this.authFeature.service._getSessionBridgePayload(this);
  }

  async _refreshSupabaseTokenViaBackground(refreshToken) {
    return this.authFeature.service._refreshSupabaseTokenViaBackground(this, refreshToken);
  }

  async restoreSupabaseSessionFromBridge(reason = 'unknown') {
    return this.authFeature.service.restoreSupabaseSessionFromBridge(this, reason);
  }

  
  setupAuthModalEvents() {
    return this.authFeature.events.setupAuthModalEvents(this);
  }

  _setupSupportFormEvents() {
    return this.billingFeature?.support?.initSupportEvents?.(this);
  }

  _openSupportFormSafely(type) {
    return this.billingFeature?.support?.openSupportFormSafely?.(this, type);
  }

  _wireSupportOpenButtons() {
    return this.billingFeature?.support?.initSupportEvents?.(this);
  }

  _isSupportModalBackdrop(e) {
    return !!(e && e.target && e.target.id === 'supportFormModal');
  }

  _wireSupportFormControls() {
    /* now part of initSupportEvents � no-op stub */
  }

  openSupportForm(type) {
    return this.billingFeature?.support?.openSupportForm?.(this, type);
  }

  closeSupportForm() {
    return this.billingFeature?.support?.closeSupportForm?.();
  }

  async submitSupportForm() {
    return this.billingFeature?.support?.submitSupportForm?.(this);
  }

  
  renderChips() {
    return this.clipsFeature.render.renderChips(this);
  }

  /**
   * Lazy load a page of clips from Supabase
   * @private
   */
  async _lazyLoadClipsPage(startIndex, pageSize, container) {
    return this.clipsFeature.render.lazyLoadClipsPage(this, startIndex, pageSize, container);
  }
  
  renderPagination() {
    return this.clipsFeature.render.renderPagination(this);
  }
  
  createChip(clip, index) {
    return this.clipsFeature.render.createChip(this, clip, index);
  }
  
  toggleChip(clipIdKey, chipElement) {
    return this.clipsFeature.state.toggleChip(this, clipIdKey, chipElement);
  }
  
  toggleSearchClip(clipId, itemElement) {
    return this.clipsFeature.state.toggleSearchClip(this, clipId, itemElement);
  }
  
  toggleCategoryClip(clipId, itemElement) {
    return this.clipsFeature.state.toggleCategoryClip(this, clipId, itemElement);
  }
  
  syncOptionToggles() {
    return this.clipsFeature.preview.syncOptionToggles(this);
  }
  
  async removeChip(clipIdKey) {
    return this.clipsFeature.service.removeChip(this, clipIdKey);
  }
  
  updateLastCapture() {
    return this.clipsFeature.render.updateLastCapture(this);
  }
  
  getTimeAgo(timestamp) {
    return this.clipsFeature.render.getTimeAgo(timestamp);
  }
  
  updatePreview() {
    return this.clipsFeature.preview.updatePreview(this);
  }

  updateDelimiterExample() {
    return this.clipsFeature.preview.updateDelimiterExample(this);
  }
  
  // Fallback clipboard method for extension popups (Clipboard API blocked by permissions policy)
  async copyToClipboardFallback(text) {
    return this.clipsFeature.service.copyToClipboardFallback(text);
  }
  
  async copyToClipboard() {
    return this.clipsFeature.service.copyToClipboard(this);
  }
  
  async handleQuickCopy() {
    return this.clipsFeature.service.handleQuickCopy(this);
  }

  async handleQuickDelete() {
    return this.clipsFeature.service.handleQuickDelete(this);
  }
  
  updateQuickCopyButton() {
    return this.clipsFeature.render.updateQuickCopyButton(this);
  }

  _getSelectedClipsText() {
    return this._getSelectedClipObjects().map(c => c.text).join('\n\n');
  }

  _getSelectedClipIdKeys() {
    return this.clipsFeature.state.getSelectedClipIdKeys(this);
  }

  _getSelectedClipObjects() {
    return this.clipsFeature.state.getSelectedClipObjects(this);
  }

  _getSelectedCategoryClipIdKeys() {
    return this.clipsFeature.state.getSelectedCategoryClipIdKeys(this);
  }

  _getSelectedCategoryClipObjects() {
    return this.clipsFeature.state.getSelectedCategoryClipObjects(this);
  }

  _getSelectedCategoryClipsText() {
    return this._getSelectedCategoryClipObjects().map(c => c.text).join('\n\n');
  }

  _wireBulkAiButtons(config) {
    return this.aiLabFeature?.bulk?.wireBulkAiButtons?.(this, config);
  }
  
  // --- Magic Button: Content Type Detection ---
  _detectContentType(text, meta) {
    return this.aiLabFeature.magic._detectContentType.call(this, text, meta);
  }

  // --- Magic Button: Category Suggestion ---
  _suggestCategory(contentType) {
    return this.aiLabFeature.magic._suggestCategory.call(this, contentType);
  }

  // --- Magic Button: Content Enhancement ---
  _enhanceContent(text, contentType) {
    return this.aiLabFeature.magic._enhanceContent.call(this, text, contentType);
  }

  // --- Magic Button: Type Labels (shared) ---
  _magicTypeLabels() {
    return this.aiLabFeature.magic._magicTypeLabels.call(this);
  }

  // --- Magic Button: Analyze All Clips ---
  _analyzeMagicClips() {
    return this.aiLabFeature.magic._analyzeMagicClips.call(this);
  }

  // --- Magic Button: Open Preview Modal ---
  magicFormat() {
    return this.aiLabFeature.magic.magicFormat.call(this);
  }

  // --- Magic Button: Render a Page of Clips in Modal ---
  _renderMagicPage(page) {
    return this.aiLabFeature.magic._renderMagicPage.call(this, page);
  }

  // --- Magic Button: Escape HTML helper ---
  _escHtml(str) {
    return this.aiLabFeature.magic._escHtml.call(this, str);
  }

  // --- Magic Button: Pagination Controls ---
  _renderMagicPagination() {
    return this.aiLabFeature.magic._renderMagicPagination.call(this);
  }

  // --- Magic Button: Update Selected Count ---
  _updateMagicSelectedCount() {
    return this.aiLabFeature.magic._updateMagicSelectedCount.call(this);
  }

  // --- Magic Button: Check if user has AI (premium) access ---
  _hasAiAccess() {
    const sub = this.userSubscription;
    if (!sub) return false;
    const tier = String(sub.subscription_tier || '').toLowerCase();
    const status = String(sub.subscription_status || '').toLowerCase();
    const expiresAtMs = sub.ai_access_expires_at ? Date.parse(sub.ai_access_expires_at) : NaN;
    const hasCouponAi = !!(sub.has_unlimited_ai === true || (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now()));
    const isPaidPremium = (tier === 'premium' || tier === 'admin') && (status === 'active' || status === 'past_due');
    return isPaidPremium || hasCouponAi;
  }

  // --- Magic Button: Content types that should skip AI formatting ---
  _skipAiFormatTypes() {
    return this.aiLabFeature.magic._skipAiFormatTypes.call(this);
  }

  // --- Magic Button: Apply Magic to Specific Clips ---
  async _craftMagic(clipIds) {
    return this.aiLabFeature.magic._craftMagic.call(this, clipIds);
  }

  // --- Magic Button: Craft All with Undo Snapshot ---
  async _craftAllMagic() {
    return this.aiLabFeature.magic._craftAllMagic.call(this);
  }

  // --- Magic Button: Undo Last Magic ---
  async _undoMagic() {
    return this.aiLabFeature.magic._undoMagic.call(this);
  }

  // --- Magic Button: Show Results Modal ---
  _showMagicResults(stats) {
    return this.aiLabFeature.magic._showMagicResults.call(this, stats);
  }

  
  showConfetti() {
    return PasteCraftPopupUi.showConfetti();
  }

  // Search and Filter Functions
  renderSearchResults() {
    return this.clipsFeature.render.renderSearchResults(this);
  }

  // Backwards-compat: older code paths still call this name
  performSearch() {
    return this.renderSearchResults();
  }

  filterClips() {
    return this.clipsFeature.render.filterClips(this);
  }

  createSearchResultItem(clip) {
    return this.clipsFeature.render.createSearchResultItem(this, clip);
  }

  // Category Management Functions
  renderCategories() {
    return this.categoriesFeature.render.renderCategories(this);
  }

  createCategoryItem(category) {
    return this.categoriesFeature.render.createCategoryItem(this, category);
  }

  showCreateCategoryDialog() {
    return this.categoriesFeature.render.showCreateCategoryDialog(this);
  }

  setActionButtonLoading(buttonId, isLoading, loadingText = 'Loading...') {
    return PasteCraftPopupUi.setActionButtonLoading(this, buttonId, isLoading, loadingText);
  }

  async createCategory(name, icon, options = {}) {
    return this.categoriesFeature.service.createCategory(this, name, icon, options);
  }

  async editCategory(category) {
    return this.categoriesFeature.service.editCategory(this, category);
  }

  async deleteCategory(category) {
    return this.categoriesFeature.service.deleteCategory(this, category);
  }

  updateCategoryFilter() {
    return this.categoriesFeature.render.updateCategoryFilter(this);
  }

  updateManualInputCategories() {
    return this.categoriesFeature.render.updateManualInputCategories(this);
  }

  // -- PDF Extraction ----------------------------------------------
  initPdfExtraction() {
    return this.clipsFeature?.pdf?.initPdfExtraction?.(this);
  }

  async openPdfExtractModal(file) {
    return this.clipsFeature?.pdf?.openPdfExtractModal?.(this, file);
  }

  async extractPdfText(arrayBuffer) {
    return this.clipsFeature?.pdf?.extractPdfText?.(arrayBuffer);
  }

  buildPdfPageTabs(pages) {
    return this.clipsFeature?.pdf?.buildPdfPageTabs?.(this, pages);
  }

  switchPdfTab(pageIndex) {
    return this.clipsFeature?.pdf?.switchPdfTab?.(this, pageIndex);
  }

  populatePdfCategoryDropdown() {
    return this.clipsFeature?.pdf?.populatePdfCategoryDropdown?.(this);
  }

  async savePdfClips() {
    return this.clipsFeature?.pdf?.savePdfClips?.(this);
  }

  closePdfModal() {
    return this.clipsFeature?.pdf?.closePdfModal?.(this);
  }

  // Utility Functions
  // getTimeAgo moved up to line ~1483 to avoid duplication

  async appendDeletedItems(storageKey, items) {
    if (!storageKey || !Array.isArray(items) || items.length === 0) {
      return;
    }

    try {
      const result = await chrome.storage.local.get([storageKey]);
      const existing = Array.isArray(result[storageKey]) ? result[storageKey] : [];
      const merged = [...existing, ...items];
      await chrome.storage.local.set({ [storageKey]: merged });
    } catch (error) {
      throw error;
    }
  }

  escapeHtml(text) {
    return PasteCraftPopupUi.escapeHtml(text);
  }

  async copyClipToClipboard(text) {
    return this.clipsFeature.service.copyClipToClipboard(this, text);
  }

  showToast(message, type) {
    return PasteCraftPopupUi.showToast(this, message, type);
  }

  // Category Modal Functions
  showCategoryModal(isReassignment = false) {
    return this.categoriesFeature.events.showCategoryModal(this, isReassignment);
  }

  hideCategoryModal() {
    return this.categoriesFeature.events.hideCategoryModal(this);
  }

  // Breakdown Modal Functions
  showBreakdownModalWithLevel(text, level) {
    this.currentBreakdownText = text;
    this.currentBreakdownLevel = level;
    this.breakdownCache = {}; // Cache explanations to avoid re-generating
    this._activeBreakdownHistoryId = null; // New breakdown conversation
    
    // Set original text
    document.getElementById('breakdownOriginalText').textContent = text;
    
    // Set text length
    const wordCount = text.trim().split(/\s+/).length;
    document.getElementById('breakdownTextLength').textContent = `${wordCount} words`;
    
    // Clear previous result
    document.getElementById('breakdownResult').innerHTML = '';
    
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
      console.log(`?? Breakdown Result Italics ${isActive ? 'ENABLED' : 'DISABLED'}`);
    } else {
      console.error('? Elements not found:', {breakdownResult, italicsBtn});
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
    let _premiumOk = true;
    if (this.currentUser) {
      _premiumOk = await pasteCraftSupabase.checkPremiumAccess(this.currentUser.id, 'breakdown');
    }
    if (!_premiumOk) return;

    // Check cache first
    if (this.breakdownCache[level]) {
      const resultEl = document.getElementById('breakdownResult');
      resultEl.innerHTML = await this._renderAiResponse(this.breakdownCache[level]);
      return;
    }

    const loadingEl = document.getElementById('breakdownLoading');
    const resultEl = document.getElementById('breakdownResult');

    try {
      // Show loading
      loadingEl.style.display = 'flex';
      resultEl.innerHTML = '';

      // Generate explanation
      const explanation = await pasteCraftSupabase.breakdownText(this.currentBreakdownText, level);

      // Cache the raw result (for copy + persistence)
      const formatted = this._formatAiOutput(explanation);
      this.breakdownCache[level] = formatted;

      // Render as rich HTML and display
      resultEl.innerHTML = await this._renderAiResponse(formatted);
      loadingEl.style.display = 'none';

      // Add to threads (store raw text)
      this.breakdownThreads.push({
        question: `Breakdown at ${level} level`,
        answer: formatted,
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

      // Persist breakdown modal state (results + threads)
      this._saveBreakdownModalState();

      // Save to AI history
      await this.saveAiHistory('breakdown', this.currentBreakdownText, this.breakdownThreads);

    } catch (error) {
      console.error('Failed to generate breakdown:', error);
      resultEl.innerHTML = 'Failed to generate explanation. Please check your OpenAI API key configuration.';
      loadingEl.style.display = 'none';
      this.showToast('Failed to generate explanation');
    }
  }

  copyBreakdownText() {
    const text = document.getElementById('breakdownResult').textContent;
    if (text) {
      this.copyToClipboardFallback(text)
        .then(() => this.showToast('Explanation copied to clipboard!'))
        .catch((error) => {
          console.error('Breakdown copy failed:', error);
          this.showToast('Failed to copy explanation', 'error');
        });
    }
  }

  // ==================== INLINE BREAKDOWN (AI Lab Page) ====================

  startInlineBreakdown(text, level) {
    this.currentBreakdownText = text;
    this.currentBreakdownLevel = level;
    this.inlineBreakdownCache = {};
    this.inlineBreakdownThreads = [];
    this.currentInlineBreakdownThreadIndex = 0;

    // Show the results section
    const resultsSection = document.getElementById('bdInlineResults');
    if (resultsSection) {
      resultsSection.style.display = 'block';
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Set active tab
    document.querySelectorAll('.bd-inline-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.inlineLevel === level);
    });

    // Update badge
    const levelNames = { eli5: 'Child', elementary: 'Elementary', highschool: 'High School', college: 'College', phd: 'PhD', wiseman: 'Wise Man' };
    const badge = document.getElementById('bdInlineLevelBadge');
    if (badge) badge.textContent = levelNames[level] || level;

    // Generate
    this.generateBreakdownInline(level);
  }

  async generateBreakdownInline(level) {
    return this.aiLabFeature.summary.generateBreakdownInline.call(this, level);
  }

  async sendInlineBreakdownFollowup(question) {
    return this.aiLabFeature.summary.sendInlineBreakdownFollowup.call(this, question);
  }

  renderInlineBreakdownPagination() {
    return this.aiLabFeature.summary.renderInlineBreakdownPagination.call(this);
  }

  showSummarySection(section) {
    return this.aiLabFeature.summary.showSummarySection.call(this, section);
  }

  async generateSummaryQuestions(text) {
    return this.aiLabFeature.summary.generateSummaryQuestions.call(this, text);
  }

  async generateSummary(text, question) {
    return this.aiLabFeature.summary.generateSummary.call(this, text, question);
  }

  _formatAiOutput(raw) {
    return this.aiLabFeature.summary._formatAiOutput.call(this, raw);
  }

  async _renderAiResponse(rawText) {
    return this.aiLabFeature.summary._renderAiResponse.call(this, rawText);
  }

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
    return this.aiLabFeature.summary.handleBreakdownFollowup.call(this, followupQuestion);
  }

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

    console.log('?? renderThreadPagination called:', { type, threadsLength: threads.length, containerFound: !!paginationContainer });

    if (!paginationContainer || threads.length < 2) {
      console.log('?? Early return:', { containerExists: !!paginationContainer, threadsLength: threads.length });
      return;
    }

    // Show pagination
    paginationContainer.style.display = 'flex';
    paginationContainer.style.gap = '8px';
    paginationContainer.innerHTML = '';

    console.log('? Rendering', threads.length, 'thread boxes for', type);

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
      console.log(`? Added thread box ${index + 1}, className: "${box.className}"`);
    });

    console.log('? Pagination rendered. Container display:', paginationContainer.style.display);
  }

  // Generate tooltip text for thread box
  generateThreadTooltip(thread, number) {
    // Extract first few words as summary title
    const question = thread.question || 'Response';
    const summaryTitle = question.length > 30 ? question.substring(0, 30) + '...' : question;
    return `${number}. "${summaryTitle}"`;
  }

  // Navigate to specific thread
  async navigateToThread(type, index) {
    const threads = type === 'summary' ? this.summaryThreads : this.breakdownThreads;
    if (index < 0 || index >= threads.length) return;

    const thread = threads[index];
    const contentEl = document.getElementById(type === 'summary' ? 'summaryResultContent' : 'breakdownResult');

    if (contentEl) {
      contentEl.innerHTML = await this._renderAiResponse(thread.answer);
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
    return this.categoriesFeature.render.populateCategoryOptions(this);
  }

  async handleClipDelete() {
    if (!this.pendingClipId) return;
    
    if (confirm('Delete this clip permanently?')) {
      const result = await this.deleteClipsByIdKeys([this.pendingClipId], {
        includeArchived: true,
        reason: 'delete:handleClipDelete',
        closeCategoryModal: true,
        clearSelection: true,
        rerender: true
      });
      this.showToast(`Deleted ${result.deleted} clip${result.deleted === 1 ? '' : 's'}`);
    }
  }

  async saveTextWithCategory() {
    return this.categoriesFeature.service.saveTextWithCategory(this);
  }

  showCreateCategoryFromModal() {
    return this.categoriesFeature.service.showCreateCategoryFromModal(this);
  }

  // Settings Management Functions � delegated to settingsFeature
  async loadSettings() {
    return this.settingsFeature.storage.loadSettings();
  }

  async saveSettings(silent = false, skipAuthPrefs = false) {
    return this.settingsFeature.storage.saveSettings(silent, skipAuthPrefs);
  }

  syncThemeToggles() {
    return this.settingsFeature.storage.syncThemeToggles();
  }

  async saveThemeOnly(nextTheme, silent = false) {
    return this.settingsFeature.storage.saveThemeOnly(nextTheme, silent);
  }

  async getCurrentProfileImageForWidget() {
    return this.settingsFeature.storage.getCurrentProfileImageForWidget();
  }

  async saveWidgetIconUseProfileImage(enabled, silent = false) {
    return this.settingsFeature.storage.saveWidgetIconUseProfileImage(enabled, silent);
  }

  async exportBackupToJson() {
    return this.settingsFeature.backup.exportBackupToJson();
  }

  async exportClipsToCsv() {
    return this.settingsFeature.backup.exportClipsToCsv();
  }

  async importBackupFromJsonMerge(file) {
    return this.settingsFeature.backup.importBackupFromJsonMerge(file);
  }

  async showSettingsModal() {
    return this.settingsFeature.render.showSettingsModal();
  }

  hideSettingsModal() {
    return this.settingsFeature.render.hideSettingsModal();
  }

  showHelpModal() {
    return this.settingsFeature.render.showHelpModal();
  }

  hideHelpModal() {
    return this.settingsFeature.render.hideHelpModal();
  }

  updateStorageStats() {
    return this.settingsFeature.render.updateStorageStats();
  }

  async cleanupOldClips() {
    return this.settingsFeature.storage.cleanupOldClips();
  }

  getCutoffTime(period) {
    return this.settingsFeature.storage.getCutoffTime(period);
  }

  // Category Dropdown Functions
  createCategoryClipsHTML(clips, categoryId) {
    return this.clipsFeature.render.createCategoryClipsHTML(this, clips, categoryId);
  }

  toggleCategoryDropdown(categoryItem, category) {
    return this.categoriesFeature.render.toggleCategoryDropdown(this, categoryItem, category);
  }

  /**
   * Category-page clip handlers are wired via a single delegated click listener
   * on `#categoriesList` (see `setupCategoryClipDelegation`). This method is
   * kept as a no-op stub so existing callers (`toggleCategoryDropdown`) stay
   * safe � delegation survives every `renderCategories()` re-render, unlike
   * the previous per-button listeners which detached whenever the list was
   * re-rendered while a dropdown was open.
   */
  attachClipHandlers(_dropdown, _category) {
    // Intentionally empty. Delegated handler on #categoriesList owns all
    // clicks for .category-clip rows and .category-clip-*-btn buttons.
  }

  /**
   * Mirrors the clips-page pattern (see `createChip`): one click handler on
   * the stable parent container resolves the action button via
   * `e.target.closest('.category-clip-*-btn')` at click time, so it keeps
   * working even when `renderCategories()` wipes and rebuilds the DOM while
   * a dropdown is open.
   *
   * Idempotent: guarded by `_categoryClipDelegationAttached` so repeat calls
   * from `setupEventListeners()` don't stack listeners.
   */
  setupCategoryClipDelegation() {
    return this.clipsFeature.events.setupCategoryClipDelegation(this);
  }

  toggleClipSelection(clipElement, category) {
    const clipId = this._clipIdKey(clipElement.dataset.clipId);
    const isSelected = clipElement.classList.contains('selected');
    
    console.log(`?? Toggling clip selection - ID: ${clipId} (${typeof clipId}), Currently selected: ${isSelected}`);
    
    if (isSelected) {
      clipElement.classList.remove('selected');
      console.log(`? Deselecting clip ${clipId}`);
      // Remove from selection tracking
      this.removeClipFromSelection(clipId);
    } else {
      clipElement.classList.add('selected');
      console.log(`? Selecting clip ${clipId}`);
      // Add to selection tracking
      this.addClipToSelection(clipId);
    }
    
    this.updatePreviewFromSelection();
  }

  addClipToSelection(clipId) {
    if (!this.selectedCategoryClips) {
      this.selectedCategoryClips = new Set();
    }
    this.selectedCategoryClips.add(this._clipIdKey(clipId));
    console.log(`? Added clip ${clipId} to selection. Total:`, Array.from(this.selectedCategoryClips));
  }

  removeClipFromSelection(clipId) {
    if (this.selectedCategoryClips) {
      this.selectedCategoryClips.delete(this._clipIdKey(clipId));
    }
    console.log(`??? Removed clip ${clipId} from selection. Remaining:`, Array.from(this.selectedCategoryClips));
  }

  _findClipLocationById(clipId) {
    return this.clipsFeature?.title?.findClipLocationById?.(this, clipId) ?? null;
  }

  promptEditClipTitle(clipId) {
    return this.clipsFeature?.title?.promptEditClipTitle?.(this, clipId);
  }

  async updateClipTitleById(clipId, title) {
    return this.clipsFeature?.title?.updateClipTitleById?.(this, clipId, title);
  }

  _updateNoteClipTitlesById(clipId, title, updatedAt) {
    return this.clipsFeature?.title?.updateNoteClipTitlesById?.(this, clipId, title, updatedAt) ?? [];
  }

  updatePreviewFromSelection() {
    return this.clipsFeature.state.updatePreviewFromSelection(this);
  }

  getSelectedCategoryClipIdsInUiOrder() {
    return this.clipsFeature.state.getSelectedCategoryClipIdsInUiOrder(this);
  }

  updateCategoryBulkActions() {
    return this.clipsFeature.render.updateCategoryBulkActions(this);
  }

  async handleCategoryBulkCopy() {
    return this.clipsFeature.service.handleCategoryBulkCopy(this);
  }

  async handleCategoryBulkDelete() {
    return this.clipsFeature.service.handleCategoryBulkDelete(this);
  }

  getSelectedSearchClipIdsInUiOrder() {
    return this.clipsFeature.state.getSelectedSearchClipIdsInUiOrder(this);
  }

  updatePreviewFromSearchSelection() {
    return this.clipsFeature.state.updatePreviewFromSearchSelection(this);
  }

  updateSearchBulkActions() {
    return this.clipsFeature.render.updateSearchBulkActions(this);
  }

  async handleSearchBulkCopy() {
    return this.clipsFeature.service.handleSearchBulkCopy(this);
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
    console.log(`?? Moved ${overflowClips.length} clips to search-only storage`);
    
    // ?? AUTO-SYNC TO DATABASE
    try {
      await pasteCraftSupabase.syncArchivedClipsToSupabase(this.searchOnlyClips);
      console.log('? Archived clips synced to database');
    } catch (error) {
      console.error('?? Failed to sync archived clips to database:', error);
    }
  }

  // Profile Management Functions
  async loadUserProfile() { return this.profileFeature.storage.loadUserProfile(this); }

  updateTopBarIdentity(imageUrlOverride = undefined) {
    return this.profileFeature?.render?.updateTopBarIdentity?.(this, imageUrlOverride);
  }

  async saveUserProfile() { return this.profileFeature.storage.saveUserProfile(this); }

  showProfileModal() {
    return this.profileFeature?.render?.showProfileModal?.(this);
  }
  
  updateAIGenerateButtonState() {
    return this.profileFeature?.render?.updateAIGenerateButtonState?.(this);
  }

  hideProfileModal() {
    return this.profileFeature?.render?.hideProfileModal?.();
  }

  setupProfileModalEvents() {
    return this.profileFeature?.events?.setupProfileModalEvents?.(this);
  }
  
  toggleSection(contentId, toggleBtnId) {
    return this.profileFeature?.render?.toggleSection?.(contentId, toggleBtnId);
  }

  async handleProfileImageUpload(file) {
    return this.profileFeature?.events?.handleProfileImageUpload?.(this, file);
  }

  async generateAnimalAvatar() {
    return this.profileFeature?.generators?.generateAnimalAvatar?.(this);
  }
  
  async generateMyCartoon() {
    return this.profileFeature?.generators?.generateMyCartoon?.(this);
  }

  async generateAIName() {
    return this.profileFeature?.generators?.generateAIName?.(this);
  }

  showUnsubscribeConfirmation() {
    if (confirm('Are you sure you want to unsubscribe from PasteCraft?\n\nThis will:\n- Delete all your clips\n- Remove all categories\n- Clear your profile data\n- This action cannot be undone.')) {
      if (confirm('FINAL WARNING: This will permanently delete ALL your data. Continue?')) {
        this.handleUnsubscribe();
      }
    }
  }

  async handleUnsubscribe() {
    try {
      this.showToast('Deleting all data…', 'info');

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

      this.showToast('All data deleted. You have been unsubscribed.', 'success');

      console.log('User unsubscribed - all local data cleared');

    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      this.showToast('Failed to unsubscribe', 'error');
    }
  }

  // Display image and funky name in top bar
  displayImageTopLeft(imageUrl) {
    return this.profileFeature?.render?.displayImageTopLeft?.(this, imageUrl);
  }

  // Auto-collapse profile name section after generation
  autoCollapseNameSection() {
    return this.profileFeature?.render?.autoCollapseNameSection?.();
  }

  // Start 10-second countdown with visible timer before collapsing name section
  startNameSectionCollapse() {
    return this.profileFeature?.render?.startNameSectionCollapse?.(this);
  }

  // Auto-collapse profile photo section after generation
  autoCollapsePhotoSection() {
    return this.profileFeature?.render?.autoCollapsePhotoSection?.();
  }

  // Start 10-second countdown with visible timer before collapsing profile image section
  startProfileImageCollapse() {
    return this.profileFeature?.render?.startProfileImageCollapse?.(this);
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
    
    // Check all requirements (matching Supabase settings)
    const hasLength = password.length >= 8;
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    // Update requirement indicators
    this.updateRequirement('req-length', hasLength);
    this.updateRequirement('req-lowercase', hasLowercase);
    this.updateRequirement('req-uppercase', hasUppercase);
    this.updateRequirement('req-number', hasNumber);
    this.updateRequirement('req-special', hasSpecial);
    
    // Calculate strength (20% each requirement)
    if (hasLength) strength += 20;
    if (hasLowercase) strength += 20;
    if (hasUppercase) strength += 20;
    if (hasNumber) strength += 20;
    if (hasSpecial) strength += 20;
    
    strengthBar.style.width = `${strength}%`;
    
    // Color based on strength
    if (strength < 60) {
      strengthBar.style.background = '#EF4444'; // Red
    } else if (strength < 100) {
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
      if (icon) icon.textContent = '\u2713';
    } else {
      element.classList.remove('valid');
      if (icon) icon.textContent = '\u2717';
    }
  }

  // Validate password meets all requirements (matching Supabase settings)
  validatePassword(password) {
    const hasLength = password.length >= 8;
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    return hasLength && hasLowercase && hasUppercase && hasNumber && hasSpecial;
  }

  // Update password strength for new password form (matching Supabase settings)
  updateNewPasswordStrength(password) {
    const strengthBar = document.querySelector('#newPasswordStrength .strength-bar');
    if (!strengthBar) return;

    let strength = 0;
    
    // Check all requirements
    const hasLength = password.length >= 8;
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    // Update requirement indicators
    this.updateRequirement('new-req-length', hasLength);
    this.updateRequirement('new-req-lowercase', hasLowercase);
    this.updateRequirement('new-req-uppercase', hasUppercase);
    this.updateRequirement('new-req-number', hasNumber);
    this.updateRequirement('new-req-special', hasSpecial);
    
    // Calculate strength (20% each requirement)
    if (hasLength) strength += 20;
    if (hasLowercase) strength += 20;
    if (hasUppercase) strength += 20;
    if (hasNumber) strength += 20;
    if (hasSpecial) strength += 20;
    
    strengthBar.style.width = `${strength}%`;
    
    if (strength < 60) {
      strengthBar.style.background = '#EF4444';
    } else if (strength < 100) {
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
        matchHint.textContent = 'Passwords match';
        matchHint.style.color = '#10B981';
        matchHint.style.display = 'block';
      } else {
        matchHint.textContent = 'Passwords do not match';
        matchHint.style.color = '#DC2626';
        matchHint.style.display = 'block';
      }
    } else {
      matchHint.style.display = 'none';
    }
  }

  static async handleMessage(message) {
    if (!PasteCraftPopup._messagingModule) {
      PasteCraftPopup._messagingModule = import('./popup/shared/popup-messaging.js');
    }
    const { handlePopupMessage } = await PasteCraftPopup._messagingModule;
    return handlePopupMessage(message);
  }

  // =====================================================
  // AI GALLERY & GENERATION METHODS
  // =====================================================

  async loadAIGallery() { return this.profileFeature.storage.loadAIGallery(this); }

  renderAIGallery(gallery) {
    return this.profileFeature?.gallery?.renderAIGallery?.(this, gallery);
  }

  setupGalleryEventListeners() {
    return this.profileFeature?.gallery?.setupGalleryEventListeners?.(this);
  }

  renderGalleryPagination(totalPages) {
    return this.profileFeature?.gallery?.renderGalleryPagination?.(this, totalPages);
  }

  setupPaginationEventListeners() {
    return this.profileFeature?.gallery?.setupPaginationEventListeners?.(this);
  }

  async goToGalleryPage(page) {
    return this.profileFeature?.gallery?.goToGalleryPage?.(this, page);
  }

  async setAsProfile(index) {
    return this.profileFeature?.gallery?.setAsProfile?.(this, index);
  }

  deleteFromGallery(index) { return this.profileFeature.storage.deleteFromGallery(this, index); }

  async generateAIImageFromProfile() {
    try {
      if (!this.userProfile?.aiGeneratedName) {
        this.showToast('Generate your funky name first in Profile!', 'error');
        return;
      }
      
      this.showToast('Generating AI image…', 'info');
      document.getElementById('aiGenerateFromProfileBtn').disabled = true;
      document.getElementById('aiGenerateFromProfileBtn').textContent = 'Generating…';
      
      const gen = await pasteCraftSupabase.generateProfileImage(null, null, this.userProfile.aiGeneratedName);
      const imageUrl = gen && typeof gen.imageUrl === 'string' ? gen.imageUrl : '';
      
      if (imageUrl) {
        // Add to gallery
        await this.addToGallery(imageUrl, 'profile');
        
        this.showToast('AI image generated!', 'success');
        this.showAIGenerationTimer();
        this.loadAIGallery();
        // Best-effort credits refresh after successful generation.
        try {
          this.userSubscription = await pasteCraftSupabase.getUserSubscription(this.currentUser.id);
        } catch (_) {}
        this.updateAiCreditsPills('post-gen');
      } else {
        this.showToast('Failed to generate AI image', 'error');
      }
    } catch (error) {
      console.error('Failed to generate AI image:', error);
      this.showToast('Failed to generate AI image', 'error');
    } finally {
      document.getElementById('aiGenerateFromProfileBtn').disabled = false;
      document.getElementById('aiGenerateFromProfileBtn').innerHTML = '<span class="ai-gen-icon" aria-hidden="true"></span><span>Generate from Profile</span>';
    }
  }

  async generateRandomAIImage() {
    try {
      this.showToast('Generating random avatar…', 'info');
      document.getElementById('aiGenerateRandomBtn').disabled = true;
      document.getElementById('aiGenerateRandomBtn').textContent = 'Generating…';
      
      // Generate a random animal name
      const animals = ['Tiger', 'Dragon', 'Fox', 'Wolf', 'Lion', 'Eagle', 'Phoenix', 'Panda', 'Bear', 'Owl'];
      const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
      const randomName = `Random${randomAnimal}`;
      
      const gen = await pasteCraftSupabase.generateProfileImage(null, null, randomName);
      const imageUrl = gen && typeof gen.imageUrl === 'string' ? gen.imageUrl : '';
      
      if (imageUrl) {
        // Add to gallery
        await this.addToGallery(imageUrl, 'random');
        
        this.showToast('Random avatar generated!', 'success');
        this.showAIGenerationTimer();
        this.loadAIGallery();
        // Best-effort credits refresh after successful generation.
        try {
          this.userSubscription = await pasteCraftSupabase.getUserSubscription(this.currentUser.id);
        } catch (_) {}
        this.updateAiCreditsPills('post-gen');
      } else {
        this.showToast('Failed to generate random avatar', 'error');
      }
    } catch (error) {
      console.error('Failed to generate random avatar:', error);
      this.showToast('Failed to generate random avatar', 'error');
    } finally {
      document.getElementById('aiGenerateRandomBtn').disabled = false;
      document.getElementById('aiGenerateRandomBtn').innerHTML = '<span class="ai-gen-icon" aria-hidden="true"></span><span>Random Avatar</span>';
    }
  }

  async addToGallery(url, type) { return this.profileFeature.storage.addToGallery(this, url, type); }

  async migrateProfileImageToGallery() { return this.profileFeature.storage.migrateProfileImageToGallery(this); }
  async saveUserName() { return this.profileFeature.storage.saveUserName(this); }
  async saveAiNameToProfile() { return this.profileFeature.storage.saveAiNameToProfile(this); }

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
      this.currentBreakdownText = text;
      this.currentBreakdownLevel = null;
      this.breakdownCache = {};
      this.breakdownThreads = [];
      this.currentBreakdownThreadIndex = 0;
      this._activeBreakdownHistoryId = null;
      this.selectedFollowupLevel = null;

      // Show FULL text, not truncated - let CSS handle scrolling
      breakdownOriginalText.textContent = text;
      
      if (breakdownTextLength) {
        const wordCount = text.trim().split(/\s+/).length;
        breakdownTextLength.textContent = `${wordCount} words`;
      }
      
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
      const loadingEl = document.getElementById('breakdownLoading');
      const followupContainer = document.getElementById('breakdownFollowupContainer');
      const paginationContainer = document.getElementById('breakdownThreadPagination');
      if (loadingEl) loadingEl.style.display = 'none';
      if (followupContainer) followupContainer.style.display = 'none';
      if (paginationContainer) paginationContainer.style.display = 'none';
      
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
        this.showToast(`${clipCount} clips ready for breakdown (scroll to see all)`);
      }
      
      // Save to history
      this.saveToAnalysisHistory(text, 'breakdown-initiated');

      // Persist breakdown page state (input prefilled from clip)
      this._saveBreakdownPageState();
      this._currentAiLabSubTab = 'breakdown';
      this._saveActiveTabState();
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
        this.showToast(`${clipCount} clips added to summary (scroll to see all)`);
      }
      
      // Save to history
      this.saveToAnalysisHistory(text, 'summary-initiated');

      // Persist summary state (input prefilled from clip)
      this._currentSummarySection = 'input';
      this._saveSummaryState();
      this._currentAiLabSubTab = 'summary';
      this._saveActiveTabState();
      
      // Clear selections and hide buttons
      this.clearAllSelections();
    }
  }

  openClipViewer(clip) {
    return this.clipsFeature.viewer.open(this, clip);
  }

  hideClipViewerModal() {
    return this.clipsFeature.viewer.hide(this);
  }

  async copyClipViewerText() {
    return this.clipsFeature.viewer.copyText(this);
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
      this.selectedChips.forEach(idKey => {
        const clip = this.clips.find(c => this._clipIdKey(c?.id) === String(idKey));
        if (clip) selectedTexts.push(clip.text);
      });
    } else if (source === 'search' && this.selectedSearchClips.size > 0) {
      // Get texts from selected search clips
      const allClips = [...this.clips, ...this.searchOnlyClips];
      this.selectedSearchClips.forEach(clipId => {
        const clip = allClips.find(c => this._clipIdKey(c?.id) === this._clipIdKey(clipId));
        if (clip) {
          selectedTexts.push(clip.text);
        }
      });
    } else if (source === 'categories' && this.selectedCategoryClips.size > 0) {
      // Get texts from selected category clips
      const allClips = [...this.clips, ...this.searchOnlyClips];
      this.selectedCategoryClips.forEach(clipId => {
        const clip = allClips.find(c => this._clipIdKey(c?.id) === this._clipIdKey(clipId));
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
    this.showBreakdownModal(text);
    this.currentBreakdownLevel = level;

    document.querySelectorAll('.breakdown-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.level === level);
    });
    this.updateLevelInfo(level);
    this.generateBreakdown(level);
  }
  
  // ==================== SESSION PERSISTENCE ====================

  async _saveActiveTabState() {
    return this.aiLabFeature?.sessionState?.saveActiveTabState?.(this);
  }

  async _getCurrentTabId() {
    return this.aiLabFeature?.sessionState?.getCurrentTabId?.();
  }

  async _saveBreakdownPageState() {
    return this.aiLabFeature?.sessionState?.saveBreakdownPageState?.(this);
  }

  async _saveBreakdownModalState() {
    return this.aiLabFeature?.sessionState?.saveBreakdownModalState?.(this);
  }

  async _saveSummaryState() {
    return this.aiLabFeature?.sessionState?.saveSummaryState?.(this);
  }

  _resetSummaryToEmpty() {
    return this.aiLabFeature?.sessionState?.resetSummaryToEmpty?.(this);
  }

  _resetBreakdownToEmpty() {
    return this.aiLabFeature?.sessionState?.resetBreakdownToEmpty?.(this);
  }

  async _renderOpenRecentConversation() {
    return this.aiLabFeature?.sessionState?.renderOpenRecentConversation?.(this);
  }

  async _renderOpenRecentConversationFallback() {
    return this.aiLabFeature?.sessionState?.renderOpenRecentConversationFallback?.(this);
  }

  /** Restore all persisted UI state on popup open */
  // Race a promise against a timer. Returns `fallback` if the promise throws
  // or exceeds `ms`. Keeps the underlying fetch alive in the background, so
  // the second call (or a visibility refresh) can use the warmed-up result.
  _withTimeout(promise, ms, fallback = undefined, label = '') {
    return PasteCraftAsyncUtils.withTimeout(promise, { ms, fallback, label });
  }

  async _restoreSessionState() {
    return this.authFeature.session._restoreSessionState(this);
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
    
    console.log('? Saved to analysis history:', historyEntry);
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
          <p style="font-size: 48px; margin: 0 0 16px 0; line-height: 1;" aria-hidden="true">\u2014</p>
          <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #6b7280;">No Analysis History</h3>
          <p style="margin: 0; font-size: 14px;">Start analyzing clips to see your history here</p>
        </div>
      `;
    }
    
    return history.map(entry => {
      const iconName = entry.type === 'breakdown' ? 'brain' : entry.type === 'summary' ? 'notebook-pen' : 'scroll-text';
      const timeAgo = this.getTimeAgo(entry.timestamp);
      const levelBadge = entry.level ? `<span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">${entry.level}</span>` : '';
      
      return `
        <div class="history-entry" style="padding: 16px; border-bottom: 1px solid #e5e7eb; cursor: pointer; transition: background 0.2s;" data-entry-id="${entry.id}">
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <span style="font-size: 24px;" aria-hidden="true"><i data-lucide="${iconName}"></i></span>
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

  // ==================== AI HISTORY SYSTEM ====================

  /** Load AI history entries from local + cloud (merged) */
  async loadAiHistory() {
    return this.aiLabFeature.history.loadAiHistory.call(this);
  }

  async _persistAiHistory() {
    return this.aiLabFeature.history._persistAiHistory.call(this);
  }

  async saveAiHistory(type, originalText, threads) {
    return this.aiLabFeature.history.saveAiHistory.call(this, type, originalText, threads);
  }

  async _generateAiHistoryTitle(entryId, originalText) {
    return this.aiLabFeature.history._generateAiHistoryTitle.call(this, entryId, originalText);
  }

  renderAiHistoryList() {
    return this.aiLabFeature.history.renderAiHistoryList.call(this);
  }

  async openAiHistoryModal(entry) {
    return this.aiLabFeature.history.openAiHistoryModal.call(this, entry);
  }

  _renderHistoryPagination() {
    return this.aiLabFeature.history._renderHistoryPagination.call(this);
  }

  async navigateHistoryThread(index) {
    return this.aiLabFeature.history.navigateHistoryThread.call(this, index);
  }

  copyHistoryContent() {
    return this.aiLabFeature.history.copyHistoryContent.call(this);
  }

  _startEditHistoryTitle() {
    return this.aiLabFeature.history._startEditHistoryTitle.call(this);
  }

  async _saveEditHistoryTitle() {
    return this.aiLabFeature.history._saveEditHistoryTitle.call(this);
  }

  _cancelEditHistoryTitle() {
    return this.aiLabFeature.history._cancelEditHistoryTitle.call(this);
  }

  async continueHistoryConversation() {
    return this.aiLabFeature.history.continueHistoryConversation.call(this);
  }

  /** Delete all AI history entries */
  async clearAllAiHistory() {
    return this.aiLabFeature.history.clearAllAiHistory.call(this);
  }

  async loadNotes() {
    return this.notesFeature.service.loadNotes(this);
  }

  async _initializeTieredNotesStorage() {
    return this.notesFeature.service.initializeTieredNotesStorage(this);
  }

  /**
   * Migrate excess local data to Supabase if storage is near quota
   * Only runs once per installation (tracked by flag)
   * @private
   */
  async _maybeMigrateTieredStorage() {
    return this.syncFeature?.storage?.maybeMigrateTieredStorage?.(this);
  }

  _getNoteContentForHash(note) {
    return this.notesFeature.service.getNoteContentForHash(note);
  }

  async saveNotes() {
    return this.notesFeature.service.saveNotes(this);
  }

  async saveNotesPrefs() {
    return this.notesFeature.service.saveNotesPrefs(this);
  }

  renderNotes() {
    return this.notesFeature.render.renderNotes(this);
  }

  async _lazyLoadNotesPage(startIndex, pageSize, container, paginationEl, pageCount) {
    return this.notesFeature.service.lazyLoadNotesPage(this, { startIndex, pageSize, container, paginationEl, pageCount });
  }

  _renderNoteCard(note) {
    return this.notesFeature.render.renderNoteCard(note, this);
  }

  _attachNoteCardListeners(container) {
    return this.notesFeature.render.attachNoteCardListeners(this, container);
  }

  updateNoteAiControls() {
    return this.notesFeature.render.updateNoteAiControls(this);
  }

  async generateNoteTitleFromContent() {
    return this.notesFeature.editor.generateNoteTitleFromContent(this);
  }

  async generateNoteDescriptionFromContent() {
    return this.notesFeature.editor.generateNoteDescriptionFromContent(this);
  }

  openNoteEditor(type = 'note', noteId = null, showBack = false) {
    return this.notesFeature.editor.openNoteEditor(this, type, noteId, showBack);
  }

  closeNoteEditor() {
    return this.notesFeature.editor.closeNoteEditor(this);
  }

  renderNoteAttachments() {
    return this.notesFeature.render.renderNoteAttachments(this);
  }

  async saveNote() {
    return this.notesFeature.editor.saveNote(this);
  }

  refreshAlbumsForNote(sourceNote) {
    return this.notesFeature.album.refreshAlbumsForNote(this, sourceNote);
  }

  showAlbumPicker() {
    return this.notesFeature.album.showAlbumPicker(this);
  }

  showAlbumPickerForNote(noteId) {
    return this.notesFeature.album.showAlbumPickerForNote(this, noteId);
  }

  closeAlbumPicker() {
    return this.notesFeature.album.closeAlbumPicker(this);
  }

  showBackToAlbumPicker() {
    return this.notesFeature.album.showBackToAlbumPicker(this);
  }

  hideBackToAlbumPicker() {
    return this.notesFeature.album.hideBackToAlbumPicker(this);
  }

  renderAlbumPicker(albums, selectedNoteId) {
    return this.notesFeature.album.renderAlbumPicker(this, albums, selectedNoteId);
  }

  filterAlbumPicker(searchTerm) {
    return this.notesFeature.album.filterAlbumPicker(this, searchTerm);
  }

  async addCurrentClipToNote(noteId) {
    return this.notesFeature.editor.addCurrentClipToNote(this, noteId);
  }

  async addNoteToAlbum(albumId) {
    return this.notesFeature.album.addNoteToAlbum(this, albumId);
  }

  openNoteViewer(noteId) { return this.notesFeature.album.openNoteViewer(this, noteId); }
  closeNoteViewer() { return this.notesFeature.album.closeNoteViewer(this); }
  getAlbumAttachmentOpenMode() { return this.notesFeature.album.getAlbumAttachmentOpenMode(this); }
  openAlbumAttachment(noteId, attachmentIndex) { return this.notesFeature.album.openAlbumAttachment(this, noteId, attachmentIndex); }
  openAlbumAttachmentInEdgePopup(noteId, attachmentIndex) { return this.notesFeature.album.openAlbumAttachmentInEdgePopup(this, noteId, attachmentIndex); }
  openAlbumAttachmentOverlay(note, att) { return this.notesFeature.album.openAlbumAttachmentOverlay(this, note, att); }
  closeAlbumAttachmentViewer() { return this.notesFeature.album.closeAlbumAttachmentViewer(this); }
  openAlbumSourceNoteOverlay(sourceNoteId, albumId) { return this.notesFeature.album.openAlbumSourceNoteOverlay(this, sourceNoteId, albumId); }
  closeAlbumSourceNoteOverlay() { return this.notesFeature.album.closeAlbumSourceNoteOverlay(this); }
  copyAllNoteAttachments() { return this.notesFeature.album.copyAllNoteAttachments(this); }

  deleteNote(noteId) { return this.notesFeature.service.deleteNote(this, noteId); }

  showClipPickerForNote() { return this.notesFeature.editor.showClipPickerForNote(this); }
  closeClipPicker() { return this.notesFeature.editor.closeClipPicker(this); }
  updateClipPickerFooter() { return this.notesFeature.editor.updateClipPickerFooter(this); }
  togglePickerClip(clipId, itemElement) { return this.notesFeature.editor.togglePickerClip(this, clipId, itemElement); }
  normalizePickerText(text) { return this.notesFeature.editor.normalizePickerText(text); }
  createPickerSearchRowHTML(clip) { return this.notesFeature.editor.createPickerSearchRowHTML(this, clip); }
  createPickerChipElement(clip) { return this.notesFeature.editor.createPickerChipElement(this, clip); }
  attachPickerSearchRowHandlers(container) { return this.notesFeature.editor.attachPickerSearchRowHandlers(this, container); }
  switchClipPickerTab(tabName) { return this.notesFeature.editor.switchClipPickerTab(this, tabName); }
  renderClipPickerRecentClips() { return this.notesFeature.editor.renderClipPickerRecentClips(this); }
  searchClipsInPicker(query) { return this.notesFeature.editor.searchClipsInPicker(this, query); }
  renderClipPickerSearchResults(results) { return this.notesFeature.editor.renderClipPickerSearchResults(this, results); }
  renderClipPickerCategories() { return this.notesFeature.editor.renderClipPickerCategories(this); }
  addSelectedClipsToNote() { return this.notesFeature.editor.addSelectedClipsToNote(this); }
  showImagePickerForNote() { return this.notesFeature.editor.showImagePickerForNote(this); }
  addURLToNote() { return this.notesFeature.editor.addURLToNote(this); }
  async exportNoteToPDF(noteId) { return this.notesFeature.editor.exportNoteToPDF(this, noteId); }

  async loadActivityLog() { return this.activityFeature.service.loadActivityLog(this); }
  async fetchActivityPage(append = false) { return this.activityFeature.service.fetchActivityPage(this, append); }
  renderActivityList() { return this.activityFeature.render.renderActivityList(this); }
  getActivityIcon(operation) { return this.activityFeature.render.getActivityIcon(operation); }
  getTableBadge(tableName) { return this.activityFeature.render.getTableBadge(tableName); }
  getActivitySummary(entry) { return this.activityFeature.render.getActivitySummary(entry); }
  formatTimeAgo(date) { return this.activityFeature.render.formatTimeAgo(date); }

}

// Lucide icon renderer - idempotent, safe to call many times.
// Replaces <i data-lucide="name"></i> placeholders with inline SVGs.
// Observes DOM mutations so dynamically-rendered templates also get icons.
window.renderLucideIcons = function renderLucideIcons() {
  try {
    if (typeof window.lucide === 'undefined' || !window.lucide.createIcons) return;
    window.lucide.createIcons({
      icons: window.lucide.icons || window.lucide,
      attrs: { 'stroke-width': 2, 'aria-hidden': 'true', focusable: 'false' }
    });
  } catch (e) {
    console.warn('Lucide render failed:', e);
  }
};

(function initLucideObserver() {
  if (window.__lucideObserverInstalled) return;
  window.__lucideObserverInstalled = true;
  const schedule = (() => {
    let pending = false;
    return () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        window.renderLucideIcons();
      });
    };
  })();
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1 && (node.matches?.('[data-lucide]') || node.querySelector?.('[data-lucide]'))) {
          schedule();
          return;
        }
      }
    }
  });
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    }, { once: true });
  }
})();

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('?? Popup script loaded');
  window.renderLucideIcons();
  try {
    window.pasteCraftPopup = new PasteCraftPopup();
  } catch (error) {
    console.error('? Popup initialization failed:', error);
    // Fallback simple interface
    document.body.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h2><i data-lucide="clipboard"></i> PasteCraft</h2>
        <div id="simpleClips"></div>
        <p style="color: #666; font-size: 12px;">Right-click selected text to save clips</p>
      </div>
    `;
    loadSimpleClips();
  }
  window.renderLucideIcons();
});

// Also boot immediately if DOMContentLoaded already fired (resilience for any non-blocking script load edge-cases)
if (document.readyState !== 'loading' && !window.pasteCraftPopup) {
  try {
    window.pasteCraftPopup = new PasteCraftPopup();
  } catch (error) {
    console.error('? Popup initialization failed (immediate boot):', error);
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
