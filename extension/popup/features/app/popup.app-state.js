/** @forward-slice Initial PasteCraftPopup instance fields (constructor peel). */

export function createPopupInitialState() {
  return {
    clips: [],
    categories: [],
    // NOTE: selectedChips stores stable clip id keys (String(clip.id)), not indices.
    selectedChips: new Set(),
    selectedPickerClips: new Set(),
    selectedPickerImages: new Set(),
    imagePickerCatalog: [],
    delimiter: 'comma',
    currentTab: 'clips',
    searchQuery: '',
    selectedCategory: '',
    selectedDateFilter: '',
    pendingText: null,
    selectedCategoryForSave: 'Uncategorized',
    autoDeletePeriod: 'never',
    // Global theme (single source of truth). Quick Paste follows this.
    // 'light' = default | 'blue' = Blue Dark Mode | 'dark' = gray dark (deferred)
    theme: 'light',
    // True gray dark theme remains deferred; Blue Dark Mode uses theme === 'blue'.
    darkModeComingSoon: false,
    _themeSyncing: false,
    searchOnlyClips: [],
    // These store stable clip id keys (String(clip.id)), not numbers.
    selectedCategoryClips: new Set(),
    selectedSearchClips: new Set(),
    expandedCategoryIds: new Set(),
    categoryUiOrderSelectedIds: [],
    // Pending clip reference for category modal actions (stable clip id key)
    pendingClipId: null,

    // Crafted Output (preview) editability
    previewIsManual: false,
    previewLastAutoValue: '',
    options: {
      deduplicate: false,
      sort: false,
      uppercase: false,
    },
    userProfile: null,

    // Pagination system
    currentPage: 0,
    clipsPerPage: 10,
    maxPages: 50,
    maxClips: 10 * 50, // clipsPerPage * maxPages

    // Tiered storage for lazy loading
    tieredClipsStore: null,
    tieredNotesStore: null,
    tieredArchivedStore: null,
    totalClipsCount: 0,
    totalNotesCount: 0,
    totalArchivedCount: 0,
    _isLazyLoading: false,

    // Magic preview state
    _magicAnalysis: [],
    _magicSelected: new Set(),
    _magicPage: 0,

    // Breakdown text cache
    currentBreakdownText: null,
    currentBreakdownLevel: null,
    breakdownCache: {},

    // Summary state
    currentSummaryText: null,
    generatedQuestions: [],
    currentSummaryQuestion: null,

    // Thread conversation state
    summaryThreads: [],
    breakdownThreads: [],
    currentSummaryThreadIndex: 0,
    currentBreakdownThreadIndex: 0,
    selectedFollowupLevel: null,

    // Session persistence state
    _currentAiLabSubTab: 'summary',
    _currentSummarySection: 'input',

    // Countdown timers
    profileCollapseInterval: null,
    nameCollapseInterval: null,

    // Auto-refresh while sync progress is visible
    _syncAutoRefreshTimeout: null,
    _syncAutoRefreshInFlight: false,
    _syncAutoRefreshIntervalMs: 5000,

    // Analysis history
    analysisHistory: [],

    // AI History (persistent conversation logs)
    aiHistoryEntries: [],
    currentHistoryEntry: null,
    currentHistoryThreadIndex: 0,
    _activeBreakdownHistoryId: null,
    _activeSummaryHistoryId: null,
    _aiHistorySearchQuery: '',
    _aiHistoryFilterType: 'all',
    _aiHistoryPageIndex: 0,

    // Notes system
    notes: [],
    currentNoteId: null,
    currentNoteType: 'note',
    currentNoteAttachments: [],
    pendingClipForNotes: null,
    pendingBulkClipsForNotes: null,
    pendingBulkClipIds: null,
    pendingNoteForAlbum: null,
    currentViewerNoteId: null,
    currentAlbumAttachmentContext: null,
    noteViewerParentAlbumId: null,
    notesViewMode: 'notes',
    notesPageIndex: 0,
    notesAiEnabled: false,
    pendingAiTaskOutputArtifact: null,
    albumAttachmentOpenMode: 'overlay',
    idb: (typeof window !== 'undefined' && window.pasteCraftIndexedDB) ? window.pasteCraftIndexedDB : null,
    _idbReady: false,
    _aiOutputBridge: null,

    // Serialize clip mutations to prevent races / double-click issues.
    _clipOpQueue: Promise.resolve(),

    // Auth preferences (local-only; never store passwords)
    _authPrefsKey: 'pc_auth_prefs_v1',

    // Freemium guest mode (skipped login)
    _isFreemiumGuest: false,

    // Restore points (local snapshots)
    _restorePointsKey: 'pc_restore_points_v1',
    _lastRestoreAtKey: 'pc_last_restore_at',
    _lastRestorePointIdKey: 'pc_last_restore_point_id',
    _restoreSkipCloudSyncWindowMs: 5 * 60 * 1000,
    _lastPreviewRestore: null,
    _lastAppliedRestore: null,

    // AI workflow override (provider + preset)
    _aiWorkflowKey: 'pc_ai_workflow_v1',
    aiWorkflow: {
      enabled: false,
      provider: 'openai',
      preset: 'default',
      updatedAt: 0,
    },

    // BroadcastChannel is initialized by settingsFeature during popup init
    _broadcastChannel: null,
  };
}
