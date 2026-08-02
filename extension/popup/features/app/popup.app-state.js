/** @forward-slice Initial PasteCraftPopup instance fields (constructor peel). */

import { AUTH_STORAGE_KEYS } from '../auth/auth.constants.js';
import { AI_STORAGE_KEYS } from '../ai-lab/ai-lab.constants.js';
import { RESTORE_STORAGE_KEYS } from '../settings/settings.constants.js';
import { getIndexedDb } from '../../../bridges/storage/indexeddb.facade.js';

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
    searchIncludeTitles: true,
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
    idb: getIndexedDb(),
    _idbReady: false,
    _aiOutputBridge: null,

    // Serialize clip mutations to prevent races / double-click issues.
    _clipOpQueue: Promise.resolve(),

    // Auth preferences (local-only; never store passwords)
    _authPrefsKey: AUTH_STORAGE_KEYS.AUTH_PREFS,

    // Freemium guest mode (skipped login)
    _isFreemiumGuest: false,

    // Restore points (local snapshots)
    _restorePointsKey: RESTORE_STORAGE_KEYS.POINTS,
    _lastRestoreAtKey: RESTORE_STORAGE_KEYS.LAST_AT,
    _lastRestorePointIdKey: RESTORE_STORAGE_KEYS.LAST_POINT_ID,
    _restoreSkipCloudSyncWindowMs: 5 * 60 * 1000,
    _lastPreviewRestore: null,
    _lastAppliedRestore: null,

    // AI workflow override (provider + preset)
    _aiWorkflowKey: AI_STORAGE_KEYS.WORKFLOW,
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
