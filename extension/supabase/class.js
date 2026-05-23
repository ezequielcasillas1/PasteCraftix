// PasteCraftSupabase — constructor shell
export class PasteCraftSupabase {
  constructor() {
    this.client = null;
    this.initialized = false;
    this.isOnline = navigator.onLine;
    this.syncQueue = [];
    this.realtimeChannels = [];
    this.syncStatus = 'synced'; // 'offline', 'syncing', 'synced'
    this.BATCH_SIZE = 100; // Number of clips per batch
    this.syncProgress = { current: 0, total: 0, percentage: 0 };
    this._subscriptionCacheKey = 'pc_subscription_cache_v1';
    this._sessionBridgeKey = 'pc_supabase_session_v1';
    this._aiWorkflowKey = 'pc_ai_workflow_v1';
    this._deviceIdKey = 'pc_device_id_v1';
    this._aiWorkflowCache = { value: null, at: 0 };
    this._lastDeviceRegisterAt = 0;
    this._deviceRegisterCooldownMs = 60 * 1000; // avoid repeated upserts during rapid sync bursts
    // When true, prevent background sync/realtime work (e.g., after sign-out).
    this._pauseSync = false;
    this._fullSyncPromise = null;
    this._isFullSyncRunning = false;
    this._isProcessingSyncQueue = false;
    this._activeSyncTypes = new Set();
    // Cache flag to avoid repeated ensureUserProfileRow calls (quota optimization)
    this._profileRowEnsured = false;
    this._profileRowEnsuredUserId = null;
    // Sync flag for isAuthenticated(); updated from auth bridge + getSession.
    this._sessionBridgeActive = false;
    // Throttle realtime handlers to avoid exceeding Chrome storage quota (120 writes/min)
    this._realtimeThrottle = {};
    this._realtimeThrottleMs = 5000; // minimum 5 seconds between handling same event type
    this.init();
    this.setupConnectionMonitor();
  }
}
