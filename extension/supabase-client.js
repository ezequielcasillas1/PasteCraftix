// Supabase Client for PasteCraft
// This file initializes the Supabase client for the extension

class PasteCraftSupabase {
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
    this.init();
    this.setupConnectionMonitor();
  }

  async _registerCurrentDeviceBestEffort(reason = '') {
    if (!this.client || this._pauseSync) return null;
    const now = Date.now();
    const cooldown = Number(this._deviceRegisterCooldownMs) || 60000;
    if (this._lastDeviceRegisterAt && (now - this._lastDeviceRegisterAt) < cooldown) return null;
    this._lastDeviceRegisterAt = now;
    try {
      return await this.registerCurrentSyncDevice();
    } catch (_) {
      return null;
    }
  }

  // =====================================================
  // AI WORKFLOW (provider + preset) - local-first read
  // =====================================================

  _normalizeAiWorkflow(raw) {
    const allowedProviders = new Set(['openai', 'google']);
    const presetsByProvider = {
      openai: new Set(['default', 'cheapest', 'gpt5_mini', 'latest']),
      google: new Set(['default', 'cheapest', 'gemini_pro', 'latest']),
    };

    const obj = (raw && typeof raw === 'object') ? raw : {};
    const enabled = obj.enabled === true;
    const provider = allowedProviders.has(String(obj.provider || 'openai')) ? String(obj.provider || 'openai') : 'openai';
    const allowedPresets = presetsByProvider[provider] || presetsByProvider.openai;
    const preset = allowedPresets.has(String(obj.preset || 'default')) ? String(obj.preset || 'default') : 'default';
    const updatedAt = Number.isFinite(Number(obj.updatedAt)) ? Number(obj.updatedAt) : 0;
    return { enabled, provider, preset, updatedAt };
  }

  async getAiWorkflowConfig() {
    // Cache for a few seconds to avoid storage overhead on rapid calls.
    try {
      const now = Date.now();
      if (this._aiWorkflowCache && (now - (this._aiWorkflowCache.at || 0)) < 5000) {
        return this._aiWorkflowCache.value;
      }

      const key = this._aiWorkflowKey;
      let local = null;
      try {
        local = await chrome.storage.local.get([key]);
      } catch (_) {
        local = null;
      }

      let cfg = this._normalizeAiWorkflow(local ? local[key] : null);
      if (!cfg.enabled) {
        // Fall back to sync only if local is missing/disabled (best-effort)
        try {
          const sync = await new Promise((resolve) => chrome.storage.sync.get([key], resolve));
          const fromSync = this._normalizeAiWorkflow(sync ? sync[key] : null);
          if (fromSync.enabled && fromSync.updatedAt >= cfg.updatedAt) cfg = fromSync;
        } catch (_) {}
      }

      const finalCfg = cfg && cfg.enabled ? { enabled: true, provider: cfg.provider, preset: cfg.preset, updatedAt: cfg.updatedAt } : null;
      this._aiWorkflowCache = { value: finalCfg, at: now };
      return finalCfg;
    } catch (_) {
      return null;
    }
  }

  /**
   * Directly set the in-memory AI workflow cache (bypasses storage read).
   * Call this after saving workflow from the UI so the next AI call
   * immediately reflects the user's selection.
   */
  setAiWorkflowConfigDirect(cfg) {
    if (!cfg || typeof cfg !== 'object') {
      this._aiWorkflowCache = { value: null, at: 0 };
      return;
    }
    const normalized = this._normalizeAiWorkflow(cfg);
    const finalCfg = normalized.enabled
      ? { enabled: true, provider: normalized.provider, preset: normalized.preset, updatedAt: normalized.updatedAt }
      : null;
    this._aiWorkflowCache = { value: finalCfg, at: Date.now() };
  }

  async _withAiWorkflow(body) {
    try {
      const base = (body && typeof body === 'object') ? body : {};
      const cfg = await this.getAiWorkflowConfig();
      if (!cfg) return base;
      return { ...base, aiWorkflow: cfg };
    } catch (_) {
      return body;
    }
  }
  
  // =====================================================
  // NETWORK HELPERS (avoid "hang forever")
  // =====================================================
  async _fetchWithTimeout(url, options = {}, timeoutMs = 30000, timeoutMessage = 'Request timed out') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
      if (err && err.name === 'AbortError') {
        throw new Error(timeoutMessage);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // =====================================================
  // SUBSCRIPTION CACHE (helps avoid slow/failing fetches)
  // =====================================================

  async getCachedSubscription(userId) {
    try {
      if (!userId) return null;
      const res = await chrome.storage.local.get([this._subscriptionCacheKey]);
      const payload = res?.[this._subscriptionCacheKey] || null;
      if (!payload || payload.userId !== userId) return null;
      const cachedAt = typeof payload.cachedAt === 'number' ? payload.cachedAt : 0;
      const subscription = payload.subscription || null;
      // Cache TTL: 6 hours (enough to survive transient network issues)
      if (!cachedAt || (Date.now() - cachedAt) > (6 * 60 * 60 * 1000)) return null;
      return subscription;
    } catch (_) {
      return null;
    }
  }

  async setCachedSubscription(userId, subscription) {
    try {
      if (!userId || !subscription) return;
      await chrome.storage.local.set({
        [this._subscriptionCacheKey]: {
          userId,
          subscription,
          cachedAt: Date.now()
        }
      });
    } catch (_) {
      // ignore
    }
  }

  async init() {
    try {
      if (typeof PASTECRAFT_CONFIG === 'undefined') {
        console.error('❌ Config not loaded. Make sure config.js is included before supabase-client.js');
        return;
      }
      
      // Check for placeholder API keys
      if (PASTECRAFT_CONFIG.supabase.anonKey.includes('YOUR_SUPABASE_ANON_KEY_HERE')) {
        console.warn('⚠️ Supabase key not configured - using placeholder');
        this.initialized = true; // Still mark as initialized for OpenAI-only features
        return;
      }
      
      // Check if Supabase is loaded from CDN
      if (typeof supabase === 'undefined' || !supabase.createClient) {
        console.warn('⚠️ Supabase library not loaded from CDN - Supabase features disabled, but OpenAI features will work');
        this.initialized = true; // Still mark as initialized for OpenAI-only features
        return;
      }
      
      // Initialize Supabase client
      this.client = supabase.createClient(
        PASTECRAFT_CONFIG.supabase.url,
        PASTECRAFT_CONFIG.supabase.anonKey
      );
      
      this.initialized = true;
      console.log('✅ Supabase client initialized');

      // Persist auth session into chrome.storage so content-script can use it for
      // authenticated Edge Function calls (e.g., premium AI tips in-page).
      this.setupAuthSessionBridge();
      
      // Setup realtime subscriptions after initialization
      await this.setupRealtimeSubscriptions();
      
    } catch (error) {
      console.error('❌ Failed to initialize Supabase:', error);
      this.initialized = true; // Still allow OpenAI features to work
    }
  }

  // =====================================================
  // AUTH SESSION BRIDGE (extension page -> content script)
  // =====================================================
  setupAuthSessionBridge() {
    if (!this.client || !this.client.auth) return;
    if (this._authBridgeSetup) return;
    this._authBridgeSetup = true;

    const writeSession = async (session) => {
      try {
        // ─── V2 GUARD: never write bridge if local/freemium mode is active ───
        const { pc_freemium_guest } = await chrome.storage.local.get('pc_freemium_guest');
        if (pc_freemium_guest) return; // local mode owns storage; do not touch

        if (!session || !session.access_token) {
          await chrome.storage.local.remove([this._sessionBridgeKey]);
          return;
        }
        await chrome.storage.local.set({
          [this._sessionBridgeKey]: {
            access_token: session.access_token,
            refresh_token: session.refresh_token || null,
            expires_at: session.expires_at || null,
            user_id: session.user?.id || null,
            updated_at: Date.now()
          }
        });
      } catch (_) {
        // ignore
      }
    };

    // Initial snapshot
    this.client.auth.getSession()
      .then(({ data }) => writeSession(data?.session))
      .catch(() => {});

    // Live updates
    try {
      this.client.auth.onAuthStateChange((_event, session) => {
        writeSession(session);
      });
    } catch (_) {
      // Back-compat: if onAuthStateChange is not available, we still wrote initial snapshot.
    }
  }

  async getStoredAccessToken() {
    try {
      const res = await chrome.storage.local.get([this._sessionBridgeKey]);
      const payload = res?.[this._sessionBridgeKey] || null;
      const tok = payload?.access_token ? String(payload.access_token) : '';
      return tok || '';
    } catch (_) {
      return '';
    }
  }

  async getAiHintsForCopySignal(signal) {
    // Premium-only helper: returns [{title, body}] or null.
    try {
      if (!this.client) return null;
      const { data: { session } } = await this.client.auth.getSession();
      const userId = session?.user?.id || null;
      const accessToken = session?.access_token || '';
      if (!userId || !accessToken) return null;

      const isPremium = await this.isPremiumUser(userId);
      if (!isPremium) return null;

      const url = `${PASTECRAFT_CONFIG.supabase.url}/functions/v1/ai-hint`;
      const response = await this._fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          kind: signal?.kind || 'text',
          text: String(signal?.text || '').slice(0, 5000),
          url: String(signal?.url || '').slice(0, 2000),
          pageUrl: String(signal?.pageUrl || '').slice(0, 2000)
        })
      }, 20000, 'AI hint request timed out');

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || response.statusText || 'AI hint failed');
      }

      const data = await response.json().catch(() => ({}));
      const tips = Array.isArray(data?.tips) ? data.tips : [];
      return tips
        .filter(t => t && typeof t.title === 'string' && typeof t.body === 'string')
        .slice(0, 3);
    } catch (error) {
      console.error('Failed to get AI hints:', error);
      return null;
    }
  }
  
  // =====================================================
  // CONNECTION & OFFLINE MODE
  // =====================================================
  
  setupConnectionMonitor() {
    // Load sync queue from storage
    this.loadSyncQueue();
    
    // Monitor online/offline events
    window.addEventListener('online', () => {
      console.log('🟢 Connection restored');
      this.isOnline = true;
      this.updateSyncStatus('syncing');
      this.processSyncQueue();
    });
    
    window.addEventListener('offline', () => {
      console.log('🔴 Connection lost');
      this.isOnline = false;
      this.updateSyncStatus('offline');
    });
    
    // Initial status update
    this.updateSyncStatus(this.isOnline ? 'synced' : 'offline');
  }

  async getDeviceId() {
    if (this.deviceId) return this.deviceId;
    let deviceId = '';
    try {
      const res = await chrome.storage.local.get([this._deviceIdKey]);
      deviceId = res?.[this._deviceIdKey] || '';
    } catch (_) {
      deviceId = '';
    }
    if (!deviceId) {
      const fallback = `pc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      deviceId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : fallback;
      try {
        await chrome.storage.local.set({ [this._deviceIdKey]: deviceId });
      } catch (_) {
        // ignore
      }
    }
    this.deviceId = deviceId;
    return deviceId;
  }
  
  async loadSyncQueue() {
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['syncQueue'], resolve);
      });
      this.syncQueue = result.syncQueue || [];
      console.log(`📦 Loaded ${this.syncQueue.length} pending sync operations`);
      
      // Process queue if online
      if (this.isOnline && this.syncQueue.length > 0) {
        setTimeout(() => this.processSyncQueue(), 1000);
      }
    } catch (error) {
      console.error('❌ Failed to load sync queue:', error);
      this.syncQueue = [];
    }
  }
  
  async saveSyncQueue() {
    try {
      await new Promise((resolve) => {
        chrome.storage.local.set({ syncQueue: this.syncQueue }, resolve);
      });
    } catch (error) {
      console.error('❌ Failed to save sync queue:', error);
    }
  }
  
  async addToSyncQueue(operation) {
    this.syncQueue.push({
      ...operation,
      timestamp: Date.now(),
      id: Date.now() + Math.random()
    });
    await this.saveSyncQueue();
    console.log(`➕ Added to sync queue: ${operation.type} (${this.syncQueue.length} pending)`);
  }
  
  async processSyncQueue() {
    if (this._pauseSync) return;
    if (!this.isOnline || this.syncQueue.length === 0) {
      return;
    }
    
    console.log(`🔄 Processing ${this.syncQueue.length} queued operations...`);
    this.updateSyncStatus('syncing');
    await this._registerCurrentDeviceBestEffort('processSyncQueue');
    
    const queue = [...this.syncQueue];
    this.syncQueue = [];
    
    for (const operation of queue) {
      try {
        await this.executeSyncOperation(operation);
        console.log(`✅ Processed: ${operation.type}`);
      } catch (error) {
        console.error(`❌ Failed to process ${operation.type}:`, error);
        // Re-queue failed operations
        this.syncQueue.push(operation);
      }
    }
    
    await this.saveSyncQueue();
    this.updateSyncStatus(this.syncQueue.length > 0 ? 'syncing' : 'synced');
    console.log(`✅ Queue processed. ${this.syncQueue.length} operations remaining.`);
  }
  
  async executeSyncOperation(operation) {
    switch (operation.type) {
      case 'syncClips':
        await this.syncClipsToSupabase(operation.data);
        break;
      case 'syncDeletedClips':
        await this.syncDeletedClipsToSupabase(operation.data);
        break;
      case 'syncCategories':
        await this.syncCategoriesToSupabase(operation.data);
        break;
      case 'syncDeletedCategories':
        await this.syncDeletedCategoriesToSupabase(operation.data);
        break;
      case 'syncArchivedClips':
        await this.syncArchivedClipsToSupabase(operation.data);
        break;
      case 'syncDeletedArchivedClips':
        await this.syncDeletedArchivedClipsToSupabase(operation.data);
        break;
      case 'syncNotes':
        await this.syncNotesToSupabase(operation.data);
        break;
      case 'syncDeletedNotes':
        await this.syncDeletedNotesToSupabase(operation.data);
        break;
      case 'syncSettings':
        await this.syncSettingsToSupabase(operation.data);
        break;
      case 'syncProfile':
        await this.syncUserProfileToSupabase(operation.data);
        break;
      default:
        console.warn('Unknown sync operation type:', operation.type);
    }
  }
  
  updateSyncStatus(status) {
    this.syncStatus = status;
    // Emit event for UI to update
    window.dispatchEvent(new CustomEvent('syncStatusChanged', { 
      detail: { status, queueLength: this.syncQueue.length } 
    }));
  }
  
  updateSyncProgress(current, total, percentage) {
    this.syncProgress = { current, total, percentage };
    // Emit event for UI progress bar
    window.dispatchEvent(new CustomEvent('syncProgress', {
      detail: { current, total, percentage }
    }));
  }
  
  async syncWithQueue(type, data, syncMethod) {
    if (!this.isOnline) {
      // Offline: add to queue
      await this.addToSyncQueue({ type, data });
      return false;
    }
    
    try {
      // Online: sync immediately
      await this._registerCurrentDeviceBestEffort(`syncWithQueue:${String(type || '')}`);
      this.updateSyncStatus('syncing');
      await syncMethod.call(this, data);
      this.updateSyncStatus('synced');
      return true;
    } catch (error) {
      console.error(`❌ Sync failed, adding to queue:`, error);
      await this.addToSyncQueue({ type, data });
      return false;
    }
  }
  
  // =====================================================
  // REALTIME SUBSCRIPTIONS
  // =====================================================
  
  async setupRealtimeSubscriptions() {
    if (!this.client || !this.isOnline) {
      console.warn('⚠️ Skipping realtime subscriptions - offline or not initialized');
      return;
    }
    if (this._pauseSync) {
      console.warn('⚠️ Skipping realtime subscriptions - sync paused');
      return;
    }
    
    try {
      console.log('🔔 Setting up realtime subscriptions...');
      const userId = await this.getSyncUserId();
      
      // Subscribe to clips changes
      const clipsChannel = this.client
        .channel('clips-changes')
        .on('postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'clips',
            filter: `user_id=eq.${userId}`
          },
          (payload) => this.handleClipsChange(payload)
        )
        .subscribe();
      
      // Subscribe to categories changes
      const categoriesChannel = this.client
        .channel('categories-changes')
        .on('postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'categories',
            filter: `user_id=eq.${userId}`
          },
          (payload) => this.handleCategoriesChange(payload)
        )
        .subscribe();
      
      // Subscribe to archived clips changes
      const archivedChannel = this.client
        .channel('archived-clips-changes')
        .on('postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'archived_clips',
            filter: `user_id=eq.${userId}`
          },
          (payload) => this.handleArchivedClipsChange(payload)
        )
        .subscribe();

      const notesChannel = this.client
        .channel('notes-changes')
        .on('postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notes',
            filter: `user_id=eq.${userId}`
          },
          (payload) => this.handleNotesChange(payload)
        )
        .subscribe();
      
      // Subscribe to settings changes
      const settingsChannel = this.client
        .channel('settings-changes')
        .on('postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'user_settings',
            filter: `user_id=eq.${userId}`
          },
          (payload) => this.handleSettingsChange(payload)
        )
        .subscribe();
      
      // Subscribe to profile changes
      const profileChannel = this.client
        .channel('profile-changes')
        .on('postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'user_profiles',
            filter: `user_id=eq.${userId}`
          },
          (payload) => this.handleProfileChange(payload)
        )
        .subscribe();

      this.realtimeChannels = [
        clipsChannel,
        categoriesChannel,
        archivedChannel,
        notesChannel,
        settingsChannel,
        profileChannel
      ];
      
      console.log('✅ Realtime subscriptions active');
    } catch (error) {
      console.error('❌ Failed to setup realtime subscriptions:', error);
    }
  }
  
  async handleClipsChange(payload) {
    console.log('🔔 Clips changed:', payload.eventType);
    
    // Refresh clips from Supabase
    const remoteClips = await this.syncClipsFromSupabase();
    if (remoteClips) {
      const localData = await new Promise((resolve) => {
        chrome.storage.local.get(['clips'], resolve);
      });
      const localBeforeLen = Array.isArray(localData?.clips) ? localData.clips.length : 0;
      const mergedClips = await this.mergeClips(localData.clips || [], remoteClips);
      await new Promise((resolve) => {
        chrome.storage.local.set({ clips: mergedClips }, resolve);
      });

      
      // Notify UI to refresh
      window.dispatchEvent(new CustomEvent('dataChanged', { 
        detail: { type: 'clips' } 
      }));
    }
  }
  
  async handleCategoriesChange(payload) {
    console.log('🔔 Categories changed:', payload.eventType);
    
    const remoteCategories = await this.syncCategoriesFromSupabase();
    if (remoteCategories) {
      const localData = await new Promise((resolve) => {
        chrome.storage.local.get(['categories'], resolve);
      });
      const mergedCategories = await this.mergeCategories(localData.categories || [], remoteCategories);
      await new Promise((resolve) => {
        chrome.storage.local.set({ categories: mergedCategories }, resolve);
      });
      
      window.dispatchEvent(new CustomEvent('dataChanged', { 
        detail: { type: 'categories' } 
      }));
    }
  }
  
  async handleArchivedClipsChange(payload) {
    console.log('🔔 Archived clips changed:', payload.eventType);
    
    const remoteArchivedClips = await this.syncArchivedClipsFromSupabase();
    if (remoteArchivedClips) {
      const localData = await new Promise((resolve) => {
        chrome.storage.local.get(['searchOnlyClips'], resolve);
      });
      const mergedArchivedClips = await this.mergeArchivedClips(localData.searchOnlyClips || [], remoteArchivedClips);
      await new Promise((resolve) => {
        chrome.storage.local.set({ searchOnlyClips: mergedArchivedClips }, resolve);
      });
      
      window.dispatchEvent(new CustomEvent('dataChanged', { 
        detail: { type: 'archivedClips' } 
      }));
    }
  }

  async handleNotesChange(payload) {
    console.log('🔔 Notes changed:', payload.eventType);

    const remoteNotes = await this.syncNotesFromSupabase();
    if (remoteNotes) {
      const localData = await new Promise((resolve) => {
        chrome.storage.local.get(['notes'], resolve);
      });
      const mergedNotes = await this.mergeNotes(localData.notes || [], remoteNotes);
      await new Promise((resolve) => {
        chrome.storage.local.set({ notes: mergedNotes }, resolve);
      });

      window.dispatchEvent(new CustomEvent('dataChanged', {
        detail: { type: 'notes' }
      }));
    }
  }
  
  async handleSettingsChange(payload) {
    console.log('🔔 Settings changed:', payload.eventType);
    
    const remoteSettings = await this.syncSettingsFromSupabase();
    if (remoteSettings) {
      await new Promise((resolve) => {
        chrome.storage.local.set({ settings: remoteSettings }, resolve);
      });
      
      window.dispatchEvent(new CustomEvent('dataChanged', { 
        detail: { type: 'settings' } 
      }));
    }
  }
  
  async handleProfileChange(payload) {
    console.log('🔔 Profile changed:', payload.eventType);
    
    const remoteProfile = await this.syncUserProfileFromSupabase();
    if (remoteProfile) {
      // Merge with local profile to avoid overwriting stable images with temporary/expired ones.
      let currentLocal = {};
      try {
        const existing = await new Promise((resolve) => chrome.storage.local.get(['userProfile'], resolve));
        currentLocal = existing?.userProfile || {};
      } catch (_) {}

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
        ...currentLocal,
        ...remoteProfile,
        profileImageUrl: pickUrl(currentLocal?.profileImageUrl, remoteProfile?.profileImageUrl),
        profileImageBase64: (remoteProfile?.profileImageBase64 ? remoteProfile.profileImageBase64 : (currentLocal?.profileImageBase64 || null))
      };

      await new Promise((resolve) => {
        chrome.storage.local.set({ userProfile: mergedProfile }, resolve);
      });
      
      window.dispatchEvent(new CustomEvent('dataChanged', { 
        detail: { type: 'profile' } 
      }));
    }
  }

  unsubscribeAll() {
    this.realtimeChannels.forEach(channel => {
      this.client.removeChannel(channel);
    });
    this.realtimeChannels = [];
    console.log('🔕 All realtime subscriptions removed');
  }
  
  // User Profile Methods
  async getUserProfile(userId) {
    if (!this.initialized) {
      console.error('❌ Supabase not initialized');
      return null;
    }
    
    try {
      const { data, error } = await this.client
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return null;
    }
  }
  
  async createUserProfile(profileData) {
    if (!this.initialized) {
      console.error('❌ Supabase not initialized');
      return null;
    }
    
    try {
      const { data, error } = await this.client
        .from('user_profiles')
        .insert([profileData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to create user profile:', error);
      return null;
    }
  }
  
  async updateUserProfile(userId, updates) {
    if (!this.initialized) {
      console.error('❌ Supabase not initialized');
      return null;
    }
    
    try {
      const { data, error } = await this.client
        .from('user_profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to update user profile:', error);
      return null;
    }
  }
  
  async uploadProfileImage(userId, imageFile) {
    if (!this.initialized) {
      console.error('❌ Supabase not initialized');
      return null;
    }
    
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `profile-images/${fileName}`;
      
      const { data, error } = await this.client.storage
        .from('profile-images')
        .upload(filePath, imageFile);
      
      if (error) throw error;
      
      // Get public URL
      const { data: urlData } = this.client.storage
        .from('profile-images')
        .getPublicUrl(filePath);
      
      return urlData.publicUrl;
    } catch (error) {
      console.error('Failed to upload profile image:', error);
      return null;
    }
  }
  
  /**
   * Download image from temporary URL and upload to Supabase Storage
   * @param {string} imageUrl - Temporary image URL (e.g., from OpenAI DALL-E)
   * @param {string} userId - User identifier for storage path
   * @returns {string} Permanent Supabase Storage URL
   */
  async downloadAndUploadImage(imageUrl, userId) {
    if (!this.initialized || !this.client) {
      console.warn('⚠️ Supabase not initialized - returning original URL');
      return imageUrl; // Fallback to original URL if Supabase not available
    }
    
    try {
      console.log('📥 Downloading image from temporary URL:', imageUrl);
      
      // Download image as blob
      const response = await this._fetchWithTimeout(
        imageUrl,
        {},
        30000,
        'Image download timed out'
      );
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log('✅ Image downloaded, size:', blob.size, 'bytes');
      
      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `${userId}-${timestamp}.png`;
      const filePath = `${fileName}`;
      
      console.log('📤 Uploading to Supabase Storage:', filePath);
      
      // Upload to Supabase Storage
      const { data, error } = await this.client.storage
        .from('profile-images')
        .upload(filePath, blob, {
          contentType: 'image/png',
          upsert: false
        });
      
      if (error) {
        console.error('❌ Upload error:', error);
        throw error;
      }
      
      console.log('✅ Upload successful:', data);
      
      // Get permanent public URL
      const { data: urlData } = this.client.storage
        .from('profile-images')
        .getPublicUrl(filePath);
      
      console.log('✅ Permanent URL obtained:', urlData.publicUrl);
      return urlData.publicUrl;
      
    } catch (error) {
      console.error('❌ Failed to convert temporary URL to permanent:', error);
      console.warn('⚠️ Returning original temporary URL as fallback');

      return imageUrl; // Return original URL as fallback
    }
  }
  
  // =====================================================
  // PROFILE IMAGE URL NORMALIZATION (avoid expiring URLs)
  // =====================================================
  _pcIsDataImageUrl(u) {
    return typeof u === 'string' && u.startsWith('data:image/');
  }

  _pcTryParseUrl(u) {
    try { return new URL(String(u || '')); } catch (_) { return null; }
  }

  _pcGetSupabaseHost() {
    try {
      const url = (typeof PASTECRAFT_CONFIG !== 'undefined' && PASTECRAFT_CONFIG?.supabase?.url)
        ? String(PASTECRAFT_CONFIG.supabase.url)
        : '';
      return url ? (new URL(url)).hostname : '';
    } catch (_) {
      return '';
    }
  }

  _pcIsExpiredSas(u) {
    const urlObj = this._pcTryParseUrl(u);
    if (!urlObj) return false;
    const se = urlObj.searchParams.get('se');
    if (!se) return false;
    const ms = Date.parse(se);
    if (!Number.isFinite(ms)) return false;
    return Date.now() > ms;
  }

  async uploadDataUrlToProfileImages(dataUrl, userId) {
    if (!this.client) return null;
    const u = typeof dataUrl === 'string' ? dataUrl : '';
    if (!this._pcIsDataImageUrl(u)) return null;
    try {
      const t0 = Date.now();
      // Avoid fetch(data:) (can be unreliable for very large data URLs in extension contexts).
      const comma = u.indexOf(',');
      const header = comma >= 0 ? u.slice(0, comma) : '';
      const b64 = comma >= 0 ? u.slice(comma + 1) : '';
      const m = header.match(/^data:([^;]+);base64$/i);
      const ct = m && m[1] ? m[1] : 'image/png';
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: ct });
      const t1 = Date.now();
      const ext =
        ct.includes('png') ? 'png' :
        ct.includes('jpeg') ? 'jpg' :
        ct.includes('webp') ? 'webp' :
        ct.includes('gif') ? 'gif' :
        'png';

      const timestamp = Date.now();
      const fileName = `${userId}-${timestamp}.${ext}`;
      const filePath = `${fileName}`;

      const { error } = await this.client.storage
        .from('profile-images')
        .upload(filePath, blob, { contentType: ct || 'image/png', upsert: false });
      const t2 = Date.now();
      if (error) throw error;

      const { data: urlData } = this.client.storage
        .from('profile-images')
        .getPublicUrl(filePath);
      const t3 = Date.now();

      return urlData?.publicUrl || null;
    } catch (_) {
      return null;
    }
  }

  async convertToPermanentProfileImageUrl(imageUrl, userId) {
    const u = typeof imageUrl === 'string' ? imageUrl : '';
    if (!u) return '';
    if (!this.client) return u;
    const t0 = Date.now();

    if (this._pcIsDataImageUrl(u)) {
      const uploaded = await this.uploadDataUrlToProfileImages(u, userId);
      return uploaded || u;
    }

    const urlObj = this._pcTryParseUrl(u);
    const supaHost = this._pcGetSupabaseHost();
    if (urlObj && supaHost && urlObj.hostname === supaHost) {
      return u;
    }

    const looksLikeAzureBlob = !!(urlObj && urlObj.hostname && urlObj.hostname.includes('blob.core.windows.net'));
    const hasSig = !!(urlObj && urlObj.searchParams && urlObj.searchParams.has('sig'));
    if (looksLikeAzureBlob || hasSig || this._pcIsExpiredSas(u)) {
      try {
        const perm = await this.downloadAndUploadImage(u, userId);
        return perm || u;
      } catch (_) {
        return u;
      }
    }

    return u;
  }

  // OpenAI Integration Methods
  async generateAIName(userName) {
    try {
      const baseUrl = `${PASTECRAFT_CONFIG.supabase.url}/functions/v1`;
      const candidates = [`${baseUrl}/ai-name`, `${baseUrl}/generate-ai-name`];
      const body = await this._withAiWorkflow({ userName });

      let response = null;
      for (const url of candidates) {
        response = await this._fetchWithTimeout(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${PASTECRAFT_CONFIG.supabase.anonKey}`
          },
          body: JSON.stringify(body)
        }, 30000, 'AI name generation timed out');

        // Back-compat: some deployments use a different function name
        if (response.status !== 404) break;
      }
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'AI name generation failed');
      }
      
      const data = await response.json();
      console.log('✅ Generated AI name:', data.aiName);
      return data.aiName;
      
    } catch (error) {
      console.error('Failed to generate AI name:', error);
      return null;
    }
  }
  
  async analyzePhotoWithVision(imageBase64) {
    try {
      if (!this.client) {
        throw new Error('Supabase not initialized');
      }

      const { data: { session } } = await this.client.auth.getSession();
      const accessToken = session?.access_token || '';
      if (!accessToken) {
        throw new Error('Please sign in to use Vision.');
      }

      const url = `${PASTECRAFT_CONFIG.supabase.url}/functions/v1/ai-vision`;
      const body = await this._withAiWorkflow({ imageBase64 });
      const response = await this._fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(body)
      }, 30000, 'Vision analysis timed out');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || response.statusText || 'Vision analysis failed');
      }

      const data = await response.json();
      const description = data?.description || '';
      return description;

    } catch (error) {
      console.error('Failed to analyze photo:', error);
      throw error;
    }
  }

  // ─── AI Smart Categorization (Magic Wand) ───
  async aiCategorize(clips) {
    try {
      if (!Array.isArray(clips) || clips.length === 0) return [];

      // Get access token for premium gating
      let accessToken = '';
      try {
        const s = await this.client?.auth?.getSession?.();
        accessToken = s?.data?.session?.access_token ? String(s.data.session.access_token) : '';
      } catch (_) {}

      const url = `${PASTECRAFT_CONFIG.supabase.url}/functions/v1/ai-categorize`;
      const body = { clips: clips.map(c => ({ text: String(c.text || '').slice(0, 200) })) };

      const response = await this._fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken
            ? `Bearer ${accessToken}`
            : `Bearer ${PASTECRAFT_CONFIG.supabase.anonKey}`
        },
        body: JSON.stringify(body)
      }, 20000, 'AI categorization timed out');

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'AI categorization failed');
      }

      const data = await response.json();
      return Array.isArray(data.categories) ? data.categories : [];
    } catch (error) {
      console.error('AI categorize failed:', error);
      return [];
    }
  }

  // ─── AI Smart Format (Magic Wand) ───
  async aiFormat(clips) {
    try {
      if (!Array.isArray(clips) || clips.length === 0) return [];

      let accessToken = '';
      try {
        const s = await this.client?.auth?.getSession?.();
        accessToken = s?.data?.session?.access_token ? String(s.data.session.access_token) : '';
      } catch (_) {}

      const url = `${PASTECRAFT_CONFIG.supabase.url}/functions/v1/ai-format`;
      const body = { clips: clips.map(c => ({ text: String(c.text || '').slice(0, 500) })) };

      const response = await this._fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken
            ? `Bearer ${accessToken}`
            : `Bearer ${PASTECRAFT_CONFIG.supabase.anonKey}`
        },
        body: JSON.stringify(body)
      }, 25000, 'AI format timed out');

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'AI format failed');
      }

      const data = await response.json();
      return Array.isArray(data.formatted) ? data.formatted : [];
    } catch (error) {
      console.error('AI format failed:', error);
      return [];
    }
  }

  async breakdownText(text, level = 'child') {
    try {
      console.log(`🧠 Breaking down text at ${level} level...`);

      const baseUrl = `${PASTECRAFT_CONFIG.supabase.url}/functions/v1`;
      const candidates = [`${baseUrl}/ai-breakdown`, `${baseUrl}/explain-at-level`];
      const body = await this._withAiWorkflow({ text, level });

      let response = null;
      for (const url of candidates) {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${PASTECRAFT_CONFIG.supabase.anonKey}`
          },
          body: JSON.stringify(body)
        });

        // Back-compat: some deployments use a different function name
        if (response.status !== 404) break;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Breakdown failed');
      }

      const data = await response.json();
      console.log('✅ Text breakdown complete');
      return data.breakdown;

    } catch (error) {
      console.error('Failed to breakdown text:', error);
      throw error;
    }
  }

  async generateSummaryQuestions(text) {
    try {
      console.log('🤔 Generating summary questions...');

      const baseUrl = `${PASTECRAFT_CONFIG.supabase.url}/functions/v1`;
      const candidates = [`${baseUrl}/ai-summary`, `${baseUrl}/summarize-or-qa`];
      const body = await this._withAiWorkflow({ text: text.substring(0, 3000), generateQuestions: true });

      let response = null;
      for (const url of candidates) {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${PASTECRAFT_CONFIG.supabase.anonKey}`
          },
          body: JSON.stringify(body)
        });

        // Back-compat: some deployments use a different function name
        if (response.status !== 404) break;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate questions');
      }

      const data = await response.json();
      console.log('✅ Generated', data.questions.length, 'questions');
      return data.questions;

    } catch (error) {
      console.error('Failed to generate questions:', error);
      throw error;
    }
  }

  async generateSummary(text, question) {
    try {
      console.log('📝 Generating summary for question:', question);

      const baseUrl = `${PASTECRAFT_CONFIG.supabase.url}/functions/v1`;
      const candidates = [`${baseUrl}/ai-summary`, `${baseUrl}/summarize-or-qa`];
      const body = await this._withAiWorkflow({ text, question });

      let response = null;
      for (const url of candidates) {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${PASTECRAFT_CONFIG.supabase.anonKey}`
          },
          body: JSON.stringify(body)
        });

        // Back-compat: some deployments use a different function name
        if (response.status !== 404) break;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate summary');
      }

      const data = await response.json();
      console.log('✅ Summary generated');
      return data.summary;

    } catch (error) {
      console.error('Failed to generate summary:', error);
      throw error;
    }
  }

  async generateProfileImage(description, userImageBase64 = null, aiGeneratedName = null) {
    try {
      let requestBody = {};

      
      // Extract animal type from aiGeneratedName if provided
      let animalType = null;
      if (aiGeneratedName) {
        const animalMatch = aiGeneratedName.match(/(Rabbit|Tiger|Dragon|Fox|Wolf|Bear|Panda|Lion|Eagle|Phoenix|Unicorn|Owl|Cat|Dog|Monkey|Penguin|Koala|Raccoon|Racoon|Shark|Dolphin|Cheetah|Leopard|Panther|Otter|Lynx|Jaguar|Cougar|Sloth|Badger|Moose|Bison|Rhino|Elephant|Giraffe|Zebra|Kangaroo|Platypus|Hamster|Ferret|Squirrel|Chipmunk|Hawk|Falcon|Raven|Crow|Parrot|Toucan|Flamingo|Peacock|Swan|Hummingbird|Octopus|Whale|Orca|Seal|Walrus|Seahorse|Stingray|Snake|Gecko|Chameleon|Turtle|Crocodile|Alligator|Griffin|Hydra|Pegasus|Kraken)$/i);
        if (animalMatch) {
          animalType = animalMatch[1];
        }
      }

      // Check if this is an animal avatar request (explicit 'animal' flag OR just aiGeneratedName with animal)
      if ((userImageBase64 === 'animal' && aiGeneratedName) || (!userImageBase64 && animalType)) {
        console.log(`🐾 Creating ${animalType} avatar from AI name...`);
        requestBody = { type: 'animal', animalType };
      }
      // If user uploaded a photo, create cartoon from it
      else if (userImageBase64 && userImageBase64 !== 'animal') {
        console.log('📸 Creating cartoon from uploaded photo...');
        requestBody = { type: 'cartoon', imageBase64: userImageBase64 };
      }
      // Fallback to generic prompt
      else if (description) {
        console.log('🎨 Creating image from description...');
        requestBody = { prompt: `Create a single funky cartoon avatar portrait. Style: vibrant, colorful, modern cartoon art with bold outlines. Show only ONE person, centered, portrait style. Theme: ${description}` };
      } else {
        throw new Error('No valid input provided for image generation. Please provide a description, photo, or AI name with animal.');
      }

      requestBody = await this._withAiWorkflow(requestBody);

      const baseUrl = `${PASTECRAFT_CONFIG.supabase.url}/functions/v1`;
      const candidates = [`${baseUrl}/ai-image`, `${baseUrl}/avatar-generator`];

      let response = null;
      for (const url of candidates) {
        // Use the authenticated user's JWT if available (server-side credit enforcement depends on it).
        let accessToken = '';
        try {
          const s = await this.client?.auth?.getSession?.();
          accessToken = s?.data?.session?.access_token ? String(s.data.session.access_token) : '';
        } catch (_) {}

        response = await this._fetchWithTimeout(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': `${PASTECRAFT_CONFIG.supabase.anonKey}`,
            'Authorization': accessToken
              ? `Bearer ${accessToken}`
              : `Bearer ${PASTECRAFT_CONFIG.supabase.anonKey}`
          },
          body: JSON.stringify(requestBody)
        }, 90000, 'Image generation timed out');

        // Back-compat: some deployments use a different function name
        if (response.status !== 404) break;
      }


      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Image generation failed');
      }

      const data = await response.json();
      const temporaryImageUrl = data.imageUrl;
      console.log('✅ Image generated! Converting to permanent URL...');

      // Convert temporary URL to permanent Supabase Storage URL
      const userId = await this.getSyncUserId();
      const permanentImageUrl = await this.downloadAndUploadImage(temporaryImageUrl, userId);
      
      return {
        imageUrl: permanentImageUrl,
        creditsRemaining: typeof data.creditsRemaining === 'number' ? data.creditsRemaining : null,
        creditsResetAt: data.creditsResetAt || null,
        creditsLimit: typeof data.creditsLimit === 'number' ? data.creditsLimit : null,
      };

    } catch (error) {
      console.error('Failed to generate profile image:', error);
      throw error;
    }
  }

  // =====================================================
  // REAL-TIME DATA SYNC METHODS
  // =====================================================

  /**
   * Get Chrome user ID for syncing
   */
  async getChromeUserId() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['chromeUserId'], (result) => {
        if (result.chromeUserId) {
          resolve(result.chromeUserId);
        } else {
          // Generate new user ID
          const newUserId = `chrome_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          chrome.storage.local.set({ chromeUserId: newUserId }, () => {
            resolve(newUserId);
          });
        }
      });
    });
  }

  /**
   * Get a stable user id for cloud sync.
   * - Prefer a stored cross-device id in chrome.storage.sync (if browser sync is enabled)
   * - Otherwise fall back to existing chrome.storage.local chromeUserId (legacy behavior)
   * - If neither exists: generate a new id (if authed, derive from auth UUID; else random chrome_*)
   *
   * This preserves legacy cloud data (keyed by chromeUserId) while allowing new devices
   * to recover the same id via chrome.storage.sync once at least one device writes it.
   */
  async getSyncUserId() {
    // If authenticated, always use auth user UUID as the stable cross-device sync key.
    // If this device has legacy data keyed by chromeUserId, we can migrate it to auth id here.
    let authUserId = null;
    if (this.client) {
      try {
        const { data: { session } } = await this.client.auth.getSession();
        authUserId = session?.user?.id || null;
      } catch (_) {}
    }

    if (authUserId) {
      // If the user previously synced using a different (legacy) id on this same device,
      // migrate its remote data to the auth id once.
      let localChromeUserId = null;
      try {
        const localResult = await new Promise((resolve) => chrome.storage.local.get(['chromeUserId'], resolve));
        localChromeUserId = localResult?.chromeUserId || null;
      } catch (_) {}

      // Persist the stable id for other devices (browser sync)
      try { await new Promise((resolve) => chrome.storage.sync.set({ accountUserId: authUserId }, resolve)); } catch (_) {}
      try { await new Promise((resolve) => chrome.storage.local.set({ chromeUserId: authUserId }, resolve)); } catch (_) {}

      // Migrate legacy remote clips if we have a different legacy id available
      if (localChromeUserId && localChromeUserId !== authUserId) {
        try {
          const legacyRemote = await this.syncClipsFromSupabase(localChromeUserId);
          if (legacyRemote && legacyRemote.length > 0) {
            await this.syncClipsToSupabaseForUser(legacyRemote, authUserId);
          }
        } catch (_) {
          // Best-effort migration only
        }
      }

      await this.ensureUserProfileRow(authUserId);
      return authUserId;
    }

    // Not authenticated: fall back to any stored accountUserId (sync) or legacy local chromeUserId
    let syncStoredId = null;
    try {
      const syncResult = await new Promise((resolve) => chrome.storage.sync.get(['accountUserId'], resolve));
      syncStoredId = syncResult?.accountUserId || null;
    } catch (_) {}

    if (syncStoredId) {
      await this.ensureUserProfileRow(syncStoredId);
      return syncStoredId;
    }

    const chromeUserId = await this.getChromeUserId();
    await this.ensureUserProfileRow(chromeUserId);
    return chromeUserId;
  }

  async ensureUserProfileRow(userId) {
    if (!this.client) return;
    try {
      await this.setUserContext(userId);
      await this.client
        .from('user_profiles')
        .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: false });
    } catch (_) {
      // Don't block sync if profile row can't be ensured
    }
  }

  /**
   * Set RLS context for user
   */
  async setUserContext(userId) {
    if (!this.client) return;
    
    try {
      if (!userId) return;
      const now = Date.now();
      if (this._userContextBackoffUntil && now < this._userContextBackoffUntil) return;

      const recent = this._lastUserContextId === userId && (now - this._lastUserContextAt) < (5 * 60 * 1000);
      if (recent) return;

      if (this._userContextInFlight && this._userContextInFlight.userId === userId) {
        await this._userContextInFlight.promise;
        return;
      }

      const rpcPromise = this.client.rpc('set_config', {
        setting: 'app.current_user_id',
        value: userId
      });
      this._userContextInFlight = { userId, promise: rpcPromise };

      await rpcPromise;
      this._lastUserContextId = userId;
      this._lastUserContextAt = Date.now();
      this._userContextBackoffUntil = 0;
      console.log('✅ User context set:', userId);
    } catch (error) {
      this._userContextBackoffUntil = Date.now() + 30000;
      console.warn('⚠️ Could not set user context (RLS may not be configured):', error.message);
    } finally {
      if (this._userContextInFlight && this._userContextInFlight.userId === userId) {
        this._userContextInFlight = null;
      }
    }
  }

  // =====================================================
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
      await this.ensureUserProfileRow(userId);

      const deviceId = await this.getDeviceId();
      const totalClips = Array.isArray(localClips) ? localClips.length : 0;
      console.log(`📤 Syncing ${totalClips} clips to Supabase...`);


      // Use batch processing for large datasets (>100 clips)
      if (totalClips > this.BATCH_SIZE) {
        return await this.syncClipsToSupabaseBatch(localClips, userId, deviceId);
      }

      // Standard sync for small datasets
      const _pcBuildStart = Date.now();
      const dbClips = this.buildDbClipsForUpsert(localClips, userId, deviceId);
      const _pcBuildMs = Date.now() - _pcBuildStart;
      const stats = dbClips && dbClips._pcStats ? dbClips._pcStats : null;


      const _pcUpsertStart = Date.now();
      const { data, error } = await this.client
        .from('clips')
        .upsert(dbClips, {
          onConflict: 'user_id,clip_id',
          ignoreDuplicates: false
        })
        .select();
      const _pcUpsertMs = Date.now() - _pcUpsertStart;

      if (error) throw error;


      console.log(`✅ Synced ${data.length} clips to Supabase`);
      return true;
    } catch (error) {
      console.error('❌ Failed to sync clips to Supabase:', error);
      return false;
    }
  }

  /**
   * Sync local clips to Supabase for a specific userId (used for legacy→auth migration).
   */
  async syncClipsToSupabaseForUser(localClips, userId) {
    if (!this.client) return false;
    try {
      await this.setUserContext(userId);
      await this.ensureUserProfileRow(userId);

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
  }

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
    let inferredIds = 0;

    for (let i = 0; i < arr.length; i++) {
      const clip = arr[i];
      const text = typeof clip === 'string' ? clip : (clip?.text ?? clip);
      if (!text) { droppedNoText++; continue; }

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
        content_hash: hash(text)
      };

      const existing = seen.get(clipId);
      if (!existing || (db.timestamp || 0) > (existing.timestamp || 0)) {
        seen.set(clipId, db);
      }
    }

    const out = Array.from(seen.values());
    out._pcStats = { inputCount: arr.length, outCount: out.length, droppedNoText, droppedInvalid, inferredIds };
    return out;
  }

  async insertAuditLogs(rows) {
    if (!this.client) return;
    if (!Array.isArray(rows) || rows.length === 0) return;
    try {
      await this.client.from('audit_log').insert(rows);
    } catch (error) {
      console.warn('⚠️ Audit log insert failed:', error?.message || error);
    }
  }

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
  }

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
  }

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

    for (let i = 0; i < batches; i++) {
      const start = i * this.BATCH_SIZE;
      const end = Math.min(start + this.BATCH_SIZE, totalClips);
      const batchClips = localClips.slice(start, end);

      // Transform to DB format (and dedupe/normalize ids)
      const dbClips = this.buildDbClipsForUpsert(batchClips, userId, deviceId);

      try {
        const { data, error } = await this.client
          .from('clips')
          .upsert(dbClips, {
            onConflict: 'user_id,clip_id',
            ignoreDuplicates: false
          })
          .select();

        if (error) throw error;

        syncedCount += data.length;
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
  }

  /**
   * Sync clips from Supabase to local storage (with batch support for large datasets)
   */
  async syncClipsFromSupabase(userIdOverride = null) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping clip sync');
      return null;
    }

    try {
      const userId = userIdOverride || await this.getSyncUserId();
      await this.setUserContext(userId);

      console.log('📥 Fetching clips from Supabase...');

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

      // Standard fetch for small datasets
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
        category: clip.category,
        timestamp: clip.timestamp,
        updatedAt: clip.updated_at ? Date.parse(clip.updated_at) : clip.timestamp,
        deletedAt: clip.deleted_at ? Date.parse(clip.deleted_at) : null,
        deviceId: clip.device_id || null
      }));

      console.log(`✅ Fetched ${localClips.length} clips from Supabase`);
      return localClips;
    } catch (error) {
      console.error('❌ Failed to fetch clips from Supabase:', error);
      return null;
    }
  }

  /**
   * Batch fetch clips from Supabase (for large datasets)
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
          category: clip.category,
          timestamp: clip.timestamp,
          updatedAt: clip.updated_at ? Date.parse(clip.updated_at) : clip.timestamp,
          deletedAt: clip.deleted_at ? Date.parse(clip.deleted_at) : null,
          deviceId: clip.device_id || null
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
  }

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
      if (deletedAt && deletedAt >= clipUpdatedAt) return;
      const k = contentKey(clip);
      const prev = contentMerged.get(k);
      if (!prev || (clip.timestamp || 0) > (prev.timestamp || 0)) {
        contentMerged.set(k, clip);
      }
    };

    localClips.forEach(add);
    remoteClips.forEach(add);

    return Array.from(contentMerged.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }

  /**
   * Merge local and remote categories (newest wins by ID)
   */
  async mergeCategories(localCategories, remoteCategories) {
    const merged = new Map();
    const deletedById = new Map();

    remoteCategories.forEach(cat => {
      const id = cat?.id != null ? String(cat.id) : '';
      if (!id || !cat?.deletedAt) return;
      deletedById.set(id, cat.deletedAt);
    });

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

    // Sort by name for consistent display
    return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

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
      if (!prev || (clip.timestamp || 0) > (prev.timestamp || 0)) {
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
  // CATEGORIES SYNC METHODS
  // =====================================================

  /**
   * Sync categories to Supabase
   */
  async syncCategoriesToSupabase(localCategories) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping category sync');
      return false;
    }

    try {
      const userId = await this.getSyncUserId();
      await this.setUserContext(userId);

      console.log(`📤 Syncing ${localCategories.length} categories to Supabase...`);

      const dbCategories = localCategories.map(cat => {
        const updatedAtMs = Number.isFinite(cat?.updatedAt) ? cat.updatedAt : Date.now();
        const deletedAtMs = Number.isFinite(cat?.deletedAt) ? cat.deletedAt : null;
        return {
          user_id: userId,
          category_id: cat.id,
          name: cat.name,
          icon: cat.icon || '📁',
          updated_at: new Date(updatedAtMs).toISOString(),
          deleted_at: Number.isFinite(deletedAtMs) ? new Date(deletedAtMs).toISOString() : null,
          device_id: deviceId || null
        };
      });

      const { data, error } = await this.client
        .from('categories')
        .upsert(dbCategories, {
          onConflict: 'user_id,category_id',
          ignoreDuplicates: false
        })
        .select();

      if (error) throw error;

      console.log(`✅ Synced ${data.length} categories to Supabase`);
      return true;
    } catch (error) {
      console.error('❌ Failed to sync categories to Supabase:', error);
      return false;
    }
  }

  async syncDeletedCategoriesToSupabase(deletedCategories) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping deleted categories sync');
      return false;
    }

    const items = Array.isArray(deletedCategories) ? deletedCategories : [];
    if (items.length === 0) return true;

    try {
      const userId = await this.getSyncUserId();
      await this.setUserContext(userId);
      const deviceId = await this.getDeviceId();

      const dbCategories = items.map(cat => {
        const updatedAtMs = Number.isFinite(cat?.updatedAt) ? cat.updatedAt : Date.now();
        const deletedAtMs = Number.isFinite(cat?.deletedAt) ? cat.deletedAt : Date.now();
        return {
          user_id: userId,
          category_id: cat.id,
          name: cat.name || 'Uncategorized',
          icon: cat.icon || '📁',
          updated_at: new Date(updatedAtMs).toISOString(),
          deleted_at: new Date(deletedAtMs).toISOString(),
          device_id: deviceId || null
        };
      });

      const { error } = await this.client
        .from('categories')
        .upsert(dbCategories, {
          onConflict: 'user_id,category_id',
          ignoreDuplicates: false
        });
      if (error) throw error;

      await this.insertAuditLogs(dbCategories.map(cat => ({
        user_id: userId,
        entity_type: 'category',
        entity_id: String(cat.category_id),
        action: 'soft_delete',
        data: { name: cat.name, icon: cat.icon },
        device_id: deviceId || null
      })));

      return true;
    } catch (error) {
      console.error('❌ Failed to sync deleted categories to Supabase:', error);
      return false;
    }
  }

  /**
   * Sync categories from Supabase
   */
  async syncCategoriesFromSupabase() {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping category sync');
      return null;
    }

    try {
      const userId = await this.getSyncUserId();
      await this.setUserContext(userId);

      console.log('📥 Fetching categories from Supabase...');

      const { data, error } = await this.client
        .from('categories')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const localCategories = data.map(cat => ({
        id: cat.category_id,
        name: cat.name,
        icon: cat.icon,
        updatedAt: cat.updated_at ? Date.parse(cat.updated_at) : Date.now(),
        deletedAt: cat.deleted_at ? Date.parse(cat.deleted_at) : null,
        deviceId: cat.device_id || null
      }));

      console.log(`✅ Fetched ${localCategories.length} categories from Supabase`);
      return localCategories;
    } catch (error) {
      console.error('❌ Failed to fetch categories from Supabase:', error);
      return null;
    }
  }

  /**
   * Soft-delete a category row from Supabase.
   */
  async deleteCategoryFromSupabase(categoryId) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping category delete');
      return false;
    }

    const category_id = categoryId != null ? String(categoryId) : '';
    if (!category_id) return false;

    try {
      const userId = await this.getSyncUserId();
      const deviceId = await this.getDeviceId();
      await this.setUserContext(userId);

      const deletedAt = new Date().toISOString();
      const { error } = await this.client
        .from('categories')
        .update({ deleted_at: deletedAt, device_id: deviceId || null })
        .eq('user_id', userId)
        .eq('category_id', category_id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('❌ Failed to delete category from Supabase:', error);
      return false;
    }
  }

  // =====================================================
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
      const deviceId = await this.getDeviceId();
      await this.setUserContext(userId);

      console.log(`📤 Syncing ${localArchivedClips.length} archived clips to Supabase...`);

      // Transform local archived clips to DB format (and dedupe/normalize ids)
      const dbArchivedClips = this.buildDbClipsForUpsert(localArchivedClips, userId, deviceId);

      // Upsert archived clips (insert or update on conflict)
      const { data, error } = await this.client
        .from('archived_clips')
        .upsert(dbArchivedClips, {
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
  }

  /**
   * Sync archived clips from Supabase to local storage
   */
  async syncArchivedClipsFromSupabase() {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping archived clips sync');
      return null;
    }

    try {
      const userId = await this.getSyncUserId();
      await this.setUserContext(userId);

      console.log('📥 Fetching archived clips from Supabase...');

      // Fetch all archived clips (unlimited cloud storage)
      const { data, error } = await this.client
        .from('archived_clips')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(100000); // Effectively unlimited - high limit for pagination

      if (error) throw error;

      // Transform DB format to local format
      const localArchivedClips = data.map(clip => ({
        id: clip.clip_id,
        text: clip.text,
        category: clip.category,
        timestamp: clip.timestamp,
        updatedAt: clip.updated_at ? Date.parse(clip.updated_at) : clip.timestamp,
        deletedAt: clip.deleted_at ? Date.parse(clip.deleted_at) : null,
        deviceId: clip.device_id || null
      }));

      console.log(`✅ Fetched ${localArchivedClips.length} archived clips from Supabase`);
      return localArchivedClips;
    } catch (error) {
      console.error('❌ Failed to fetch archived clips from Supabase:', error);
      return null;
    }
  }

  // =====================================================
  // NOTES SYNC METHODS
  // =====================================================

  buildDbNotesForUpsert(localNotes, userId, deviceId) {
    const notes = Array.isArray(localNotes) ? localNotes : [];
    const rows = [];
    const snapshots = [];

    const hash = (s) => {
      const str = String(s || '');
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
      return (h >>> 0).toString(36);
    };

    notes.forEach((note, index) => {
      const rawId = note?.id ?? note?.note_id ?? `note_${Date.now()}_${index}`;
      const noteId = String(rawId);
      const noteType = note?.type || note?.note_type || 'note';
      const createdAtMs = Number.isFinite(note?.createdAt) ? note.createdAt : Date.now();
      const updatedAtMs = Number.isFinite(note?.updatedAt) ? note.updatedAt : createdAtMs;
      const deletedAtMs = Number.isFinite(note?.deletedAt) ? note.deletedAt : null;

      let attachments = [];
      let noteRefs = [];
      let sourceNoteIds = [];

      const clips = Array.isArray(note?.clips) ? note.clips : [];
      const images = Array.isArray(note?.images) ? note.images : [];
      const urls = Array.isArray(note?.urls) ? note.urls : [];
      attachments = [
        ...clips.map(c => ({ ...c, type: 'clip' })),
        ...images.map(i => ({ ...i, type: 'image' })),
        ...urls.map(u => ({ ...u, type: 'url' }))
      ];

      if (noteType === 'album') {
        noteRefs = Array.isArray(note?.noteRefs) ? note.noteRefs : [];
        sourceNoteIds = Array.isArray(note?.sourceNoteIds) ? note.sourceNoteIds : [];
      }

      const contentHash = hash([
        note?.title || '',
        note?.description || '',
        note?.body || '',
        JSON.stringify(attachments),
        JSON.stringify(noteRefs)
      ].join('|'));

      const row = {
        user_id: userId,
        note_id: noteId,
        note_type: noteType,
        title: note?.title || '',
        description: note?.description || '',
        body: note?.body || '',
        attachments,
        note_refs: noteRefs,
        source_note_ids: sourceNoteIds,
        created_at: new Date(createdAtMs).toISOString(),
        updated_at: new Date(updatedAtMs).toISOString(),
        updated_ms: updatedAtMs,
        deleted_at: Number.isFinite(deletedAtMs) ? new Date(deletedAtMs).toISOString() : null,
        device_id: deviceId || null,
        content_hash: contentHash
      };

      rows.push(row);
      snapshots.push({
        user_id: userId,
        note_id: noteId,
        snapshot: {
          id: noteId,
          type: noteType,
          title: row.title,
          description: row.description,
          body: row.body,
          clips: Array.isArray(note?.clips) ? note.clips : [],
          images: Array.isArray(note?.images) ? note.images : [],
          urls: Array.isArray(note?.urls) ? note.urls : [],
          noteRefs,
          sourceNoteIds,
          createdAt: createdAtMs,
          updatedAt: updatedAtMs,
          deletedAt: Number.isFinite(deletedAtMs) ? deletedAtMs : null
        },
        device_id: deviceId || null
      });
    });

    return { rows, snapshots };
  }

  async syncNotesToSupabase(localNotes) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping notes sync');
      return false;
    }

    try {
      const userId = await this.getSyncUserId();
      const deviceId = await this.getDeviceId();
      await this.setUserContext(userId);

      const { rows, snapshots } = this.buildDbNotesForUpsert(localNotes, userId, deviceId);
      if (rows.length === 0) return true;

      const { error } = await this.client
        .from('notes')
        .upsert(rows, {
          onConflict: 'user_id,note_id',
          ignoreDuplicates: false
        });
      if (error) throw error;

      try {
        await this.client.from('note_versions').insert(snapshots);
      } catch (_) {
        // Versioning should not block core sync
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to sync notes to Supabase:', error);
      return false;
    }
  }

  async syncNotesFromSupabase() {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping notes sync');
      return null;
    }

    try {
      const userId = await this.getSyncUserId();
      await this.setUserContext(userId);

      const { data, error } = await this.client
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      if (error) throw error;

      const notes = data.map(row => {
        const noteType = row.note_type || 'note';
        const attachments = Array.isArray(row.attachments) ? row.attachments : [];
        const noteRefs = Array.isArray(row.note_refs) ? row.note_refs : [];
        const sourceNoteIds = Array.isArray(row.source_note_ids) ? row.source_note_ids : [];

        const clips = attachments.filter(a => a?.type === 'clip');
        const images = attachments.filter(a => a?.type === 'image');
        const urls = attachments.filter(a => a?.type === 'url');

        return {
          id: row.note_id,
          type: noteType,
          title: row.title || '',
          description: row.description || '',
          body: row.body || '',
          clips,
          images,
          urls,
          noteRefs,
          sourceNoteIds,
          createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
          updatedAt: Number.isFinite(row.updated_ms) ? row.updated_ms : (row.updated_at ? Date.parse(row.updated_at) : Date.now()),
          deletedAt: row.deleted_at ? Date.parse(row.deleted_at) : null,
          deviceId: row.device_id || null
        };
      });

      return notes;
    } catch (error) {
      console.error('❌ Failed to sync notes from Supabase:', error);
      return null;
    }
  }

  async mergeNotes(localNotes, remoteNotes) {
    const merged = new Map();
    const deletedById = new Map();

    remoteNotes.forEach(note => {
      const id = note?.id != null ? String(note.id) : '';
      if (!id || !note?.deletedAt) return;
      deletedById.set(id, note.deletedAt);
    });

    const shouldDrop = (note) => {
      if (!note) return true;
      const id = note?.id != null ? String(note.id) : '';
      const deletedAt = id ? deletedById.get(id) : null;
      const updatedAt = Number.isFinite(note?.updatedAt) ? note.updatedAt : 0;
      return deletedAt && deletedAt >= updatedAt;
    };

    localNotes.forEach(note => {
      if (!shouldDrop(note)) {
        merged.set(note.id, note);
      }
    });

    remoteNotes.forEach(remoteNote => {
      if (shouldDrop(remoteNote)) {
        merged.delete(remoteNote.id);
        return;
      }
      const localNote = merged.get(remoteNote.id);
      if (!localNote) {
        merged.set(remoteNote.id, remoteNote);
        return;
      }
      const localUpdatedAt = Number.isFinite(localNote?.updatedAt) ? localNote.updatedAt : 0;
      const remoteUpdatedAt = Number.isFinite(remoteNote?.updatedAt) ? remoteNote.updatedAt : 0;
      if (remoteUpdatedAt >= localUpdatedAt) {
        merged.set(remoteNote.id, remoteNote);
      }
    });

    return Array.from(merged.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async syncDeletedNotesToSupabase(deletedNotes) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping deleted notes sync');
      return false;
    }

    const items = Array.isArray(deletedNotes) ? deletedNotes : [];
    if (items.length === 0) return true;

    try {
      const userId = await this.getSyncUserId();
      const deviceId = await this.getDeviceId();
      await this.setUserContext(userId);

      const normalized = items.map(note => ({
        ...note,
        deletedAt: Number.isFinite(note?.deletedAt) ? note.deletedAt : Date.now()
      }));
      const { rows } = this.buildDbNotesForUpsert(normalized, userId, deviceId);

      const { error } = await this.client
        .from('notes')
        .upsert(rows, {
          onConflict: 'user_id,note_id',
          ignoreDuplicates: false
        });
      if (error) throw error;

      await this.insertAuditLogs(rows.map(note => ({
        user_id: userId,
        entity_type: 'note',
        entity_id: String(note.note_id),
        action: 'soft_delete',
        data: { title: note.title, note_type: note.note_type },
        device_id: deviceId || null
      })));

      return true;
    } catch (error) {
      console.error('❌ Failed to sync deleted notes to Supabase:', error);
      return false;
    }
  }

  // =====================================================
  // SETTINGS SYNC METHODS
  // =====================================================

  /**
   * Sync settings to Supabase
   */
  async syncSettingsToSupabase(localSettings) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping settings sync');
      return false;
    }

    try {
      const userId = await this.getSyncUserId();
      await this.setUserContext(userId);

      console.log('📤 Syncing settings to Supabase...');

      // Handle nested quickPasteSettings structure
      const quickPaste = localSettings.quickPasteSettings || {};
      const dbSettings = {
        user_id: userId,
        auto_delete_period: localSettings.autoDeletePeriod || 'never',
        // Single source of truth: global theme (Quick Paste follows this)
        theme: localSettings.theme || quickPaste.theme || 'light',
        auto_hide: quickPaste.autoHide !== undefined ? quickPaste.autoHide : (localSettings.autoHide !== false),
        show_timestamps: quickPaste.showTimestamps !== undefined ? quickPaste.showTimestamps : (localSettings.showTimestamps !== false),
        max_clips_display: quickPaste.maxClipsDisplay || localSettings.maxClipsDisplay || 20,
        album_attachment_open_mode: localSettings.albumAttachmentOpenMode || 'edgePopup',
        delimiter: quickPaste.delimiter || localSettings.delimiter || 'comma',
        custom_delimiter: quickPaste.customDelimiter || localSettings.customDelimiter || ', ',
        deduplicate: quickPaste.deduplicate || localSettings.deduplicate || false,
        sort: quickPaste.sort || localSettings.sort || false,
        uppercase: quickPaste.uppercase || localSettings.uppercase || false
      };

      const { data, error } = await this.client
        .from('settings')
        .upsert(dbSettings, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })
        .select();

      if (error) throw error;

      console.log('✅ Settings synced to Supabase');
      return true;
    } catch (error) {
      console.error('❌ Failed to sync settings to Supabase:', error);
      return false;
    }
  }

  /**
   * Sync settings from Supabase
   */
  async syncSettingsFromSupabase() {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping settings sync');
      return null;
    }

    try {
      const userId = await this.getSyncUserId();
      await this.setUserContext(userId);

      console.log('📥 Fetching settings from Supabase...');

      const { data, error } = await this.client
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('ℹ️ No settings found in Supabase (first sync)');
          return null;
        }
        throw error;
      }

      // Return settings in nested structure matching popup.js expectations
      // Handle missing fields gracefully (for older database schemas)
      const localSettings = {
        autoDeletePeriod: data.auto_delete_period || 'never',
        theme: data.theme || 'light',
        quickPasteSettings: {
          autoHide: data.auto_hide !== undefined ? data.auto_hide : true,
          showTimestamps: data.show_timestamps !== undefined ? data.show_timestamps : true,
          maxClipsDisplay: data.max_clips_display || 20,
          delimiter: data.delimiter || 'comma',
          customDelimiter: data.custom_delimiter || ', ',
          deduplicate: data.deduplicate || false,
          sort: data.sort || false,
          uppercase: data.uppercase || false
        },
        albumAttachmentOpenMode: data.album_attachment_open_mode || 'edgePopup' // Falls back if field doesn't exist
      };

      console.log('✅ Fetched settings from Supabase');
      return localSettings;
    } catch (error) {
      console.error('❌ Failed to fetch settings from Supabase:', error);
      return null;
    }
  }

  // =====================================================
  // USER PROFILE SYNC METHODS
  // =====================================================

  /**
   * Sync user profile to Supabase
   */
  async syncUserProfileToSupabase(localProfile) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping profile sync');
      return false;
    }

    try {
      const userId = await this.getSyncUserId();
      await this.setUserContext(userId);

      console.log('📤 Syncing user profile to Supabase...');

      // Normalize profile image URL to a stable Supabase Storage URL when possible
      let stableProfileImageUrl = localProfile.profileImageUrl || null;
      if (stableProfileImageUrl) {
        stableProfileImageUrl = await this.convertToPermanentProfileImageUrl(stableProfileImageUrl, userId);
      }

      // Avoid syncing huge base64 blobs (can cause statement timeout / unreliable profile fetch)
      const rawBase64 = localProfile.profileImageBase64 || null;
      const safeBase64 = (typeof rawBase64 === 'string' && rawBase64.startsWith('data:image/') && rawBase64.length <= 250000)
        ? rawBase64
        : null;

      const dbProfile = {
        user_id: userId,
        user_name: localProfile.userName || null,
        ai_generated_name: localProfile.aiGeneratedName || null,
        profile_image_url: stableProfileImageUrl || null,
        profile_image_base64: safeBase64,
        generated_image_url: localProfile.generatedImageUrl || null,
        ai_generated_image: localProfile.aiGeneratedImage || false
      };

      const { data, error } = await this.client
        .from('user_profiles')
        .upsert(dbProfile, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })
        .select();

      if (error) throw error;

      console.log('✅ User profile synced to Supabase');
      return true;
    } catch (error) {
      console.error('❌ Failed to sync user profile to Supabase:', error);
      return false;
    }
  }

  /**
   * Sync user profile from Supabase
   */
  async syncUserProfileFromSupabase() {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping profile sync');
      return null;
    }

    try {
      const userId = await this.getSyncUserId();
      await this.setUserContext(userId);

      console.log('📥 Fetching user profile from Supabase...');

      const { data, error } = await this.client
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('ℹ️ No profile found in Supabase (first sync)');
          return null;
        }
        throw error;
      }

      const localProfile = {
        userName: data.user_name,
        aiGeneratedName: data.ai_generated_name,
        profileImageUrl: data.profile_image_url,
        profileImageBase64: data.profile_image_base64,
        generatedImageUrl: data.generated_image_url,
        aiGeneratedImage: data.ai_generated_image
      };

      console.log('✅ Fetched user profile from Supabase');
      return localProfile;
    } catch (error) {
      console.error('❌ Failed to fetch user profile from Supabase:', error);
      return null;
    }
  }

  // =====================================================
  // REALTIME SUBSCRIPTIONS
  // =====================================================

  /**
   * Subscribe to real-time clip changes
   */
  subscribeToClipChanges(callback) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - cannot subscribe to realtime');
      return null;
    }

    const channel = this.client
      .channel('clips-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'clips' }, 
        (payload) => {
          console.log('🔔 Realtime clip change:', payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    return channel;
  }

  /**
   * Subscribe to real-time category changes
   */
  subscribeToCategoryChanges(callback) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - cannot subscribe to realtime');
      return null;
    }

    const channel = this.client
      .channel('categories-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'categories' }, 
        (payload) => {
          console.log('🔔 Realtime category change:', payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    return channel;
  }

  /**
   * Unsubscribe from channel
   */
  unsubscribe(channel) {
    if (channel) {
      this.client.removeChannel(channel);
      console.log('🔇 Unsubscribed from realtime channel');
    }
  }

  // =====================================================
  // AUTHENTICATION METHODS
  // =====================================================

  /**
   * Sign up with email and password
   */
  async signUpWithEmail(email, password) {
    if (!this.client) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('📝 Signing up user:', email);
      
      const { data, error } = await this.client.auth.signUp({
        email: email,
        password: password,
        options: {
          emailRedirectTo: chrome.runtime.getURL('popup.html')
        }
      });

      if (error) throw error;

      // Create user subscription record (default free tier)
      if (data.user) {
        await this.createUserSubscription(data.user.id, email, 'free');
      }

      console.log('✅ User signed up successfully');
      return { success: true, user: data.user };
    } catch (error) {
      console.error('❌ Sign up failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email) {
    if (!this.client) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('📧 Resending verification email to:', email);
      
      const { data, error } = await this.client.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: chrome.runtime.getURL('popup.html')
        }
      });

      if (error) throw error;

      console.log('✅ Verification email resent');
      return { success: true };
    } catch (error) {
      console.error('❌ Resend failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Request password reset email
   */
  async resetPassword(email) {
    if (!this.client) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('🔑 Requesting password reset for:', email);
      
      // Use auth.pastecraft.com - the hosted callback page
      // Include a one-time state value so the extension can validate the token handoff.
      let state = '';
      try {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        state = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
      } catch (_) {
        state = String(Date.now()) + String(Math.random()).slice(2);
      }

      try {
        await new Promise((resolve) => chrome.storage.local.set({
          pc_password_reset_state_v1: { state, createdAt: Date.now() }
        }, resolve));
      } catch (_) {}

      const callbackUrl = `https://auth.pastecraft.com/?state=${encodeURIComponent(state)}`;
      console.log('🔗 Reset redirect URL:', callbackUrl);
      
      const { data, error } = await this.client.auth.resetPasswordForEmail(email, {
        redirectTo: callbackUrl
      });

      if (error) throw error;

      console.log('✅ Password reset email sent');
      console.log('💡 User will receive email with link to:', callbackUrl);
      return { success: true };
    } catch (error) {
      console.error('❌ Password reset failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update user password (after reset)
   */
  async updatePassword(newPassword) {
    if (!this.client) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('🔑 Updating user password...');
      
      const { data, error } = await this.client.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      console.log('✅ Password updated successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Password update failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email, password) {
    if (!this.client) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('🔐 Signing in user:', email);
      
      const { data, error } = await this.client.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) throw error;

      console.log('✅ User signed in successfully');
      return { success: true, user: data.user, session: data.session };
    } catch (error) {
      console.error('❌ Sign in failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign in with Google OAuth
   */
  async signInWithGoogle() {
    if (!this.client) {
      return { success: false, error: 'Supabase not initialized' };
    }

    try {
      console.log('🔐 Initiating Google sign in...');
      
      // Use extension-owned identity callback to avoid website-to-extension relay failures.
      const callbackUrl = chrome.identity.getRedirectURL();
      console.log('🔗 Callback URL:', callbackUrl);
      
      const { data, error } = await this.client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account'
          }
        }
      });

      if (error) {
        console.error('❌ Google OAuth error:', error);
        return { success: false, error: error.message };
      }

      if (data?.url) {
        console.log('✅ Opening Google OAuth...');
        try {
          const responseUrl = await new Promise((resolve, reject) => {
            chrome.identity.launchWebAuthFlow(
              { url: data.url, interactive: true },
              (finalUrl) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve(finalUrl);
                }
              }
            );
          });

          const hashPart = String(responseUrl || '').split('#')[1] || '';
          const params = new URLSearchParams(hashPart);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          if (!access_token) {
            return { success: false, error: 'No tokens in OAuth response' };
          }

          let userId = null;
          let email = '';
          let expiresAt = null;
          try {
            const payload = JSON.parse(atob(access_token.split('.')[1]));
            userId = payload.sub || null;
            email = payload.email || '';
            expiresAt = payload.exp || null;
          } catch (_) {}

          await chrome.storage.local.set({
            oauth_callback: { access_token, refresh_token: refresh_token || '', timestamp: Date.now() },
            [this._sessionBridgeKey]: {
              access_token,
              refresh_token: refresh_token || '',
              expires_at: expiresAt,
              user_id: userId,
              email: email,
              updated_at: Date.now()
            }
          });
          return { success: true, message: 'Signed in with Google!' };
        } catch (launchError) {
          return { success: false, error: launchError.message };
        }
      }

      return { success: false, error: 'No OAuth URL generated' };
    } catch (error) {
      console.error('❌ Google sign in failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign out current user
   */
  async signOut() {
    if (!this.client) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('👋 Signing out user...');
      
      const { error } = await this.client.auth.signOut();

      if (error) throw error;

      console.log('✅ User signed out successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Sign out failed:', error);
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // FAST SIGN-OUT (local-first, non-blocking global revoke)
  // =====================================================

  _getSupabaseAuthStorageKey() {
    try {
      const url = (typeof PASTECRAFT_CONFIG !== 'undefined' && PASTECRAFT_CONFIG?.supabase?.url)
        ? String(PASTECRAFT_CONFIG.supabase.url)
        : '';
      const host = url ? (new URL(url)).hostname : '';
      const projectRef = host ? host.split('.')[0] : '';
      return projectRef ? `sb-${projectRef}-auth-token` : '';
    } catch (_) {
      return '';
    }
  }

  async _clearCachedAuthState() {
    // Best-effort: clear extension-side caches/ids without deleting user data.
    try {
      await new Promise((resolve) => chrome.storage.local.remove([this._subscriptionCacheKey], resolve));
    } catch (_) {}

    // Browser sync user id is only meaningful for signed-in sync; remove on sign-out.
    try {
      await new Promise((resolve) => chrome.storage.sync.remove(['accountUserId'], resolve));
    } catch (_) {}
  }

  _clearSupabaseLocalStorage() {
    try {
      const key = this._getSupabaseAuthStorageKey();
      if (key && typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (_) {}
  }

  async signOutFast() {
    if (!this.client) {
      return { success: true, localOnly: true };
    }

    // Stop background work immediately.
    this._pauseSync = true;
    try { this.unsubscribeAll(); } catch (_) {}
    try { this.updateSyncStatus('offline'); } catch (_) {}

    // Clear local caches/ids and local auth token storage (best-effort).
    await this._clearCachedAuthState();
    this._clearSupabaseLocalStorage();

    // Local sign-out should not require network and should be fast.
    try {
      const { error } = await this.client.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch (e) {
      // Back-compat: older supabase-js may not support scope option.
      try {
        const { error } = await this.client.auth.signOut();
        if (error) throw error;
      } catch (_) {
        // If this fails, we already cleared local storage; treat as signed-out locally.
      }
    }

    // Best-effort global sign-out in background (do not block UI).
    try {
      const p = this.client.auth.signOut({ scope: 'global' });
      await Promise.race([
        p,
        new Promise((resolve) => setTimeout(resolve, 1500))
      ]);
    } catch (_) {
      // ignore
    }

    return { success: true };
  }

  /**
   * Get current user session
   */
  async getCurrentUser() {
    if (!this.client) {
      return null;
    }

    try {
      // Fast path: if we have a recent auth bridge session, treat as signed-in
      // even if supabase-js session resolution is slow/hanging.
      try {
        const res = await chrome.storage.local.get([this._sessionBridgeKey]);
        const payload = res?.[this._sessionBridgeKey] || null;
        const userId = payload?.user_id ? String(payload.user_id) : '';
        const expiresAt = typeof payload?.expires_at === 'number' ? payload.expires_at : null; // seconds since epoch
        const nowSec = Math.floor(Date.now() / 1000);
        const notExpired = !expiresAt || expiresAt > (nowSec + 30);
        if (userId && notExpired) {
          return { id: userId, email: payload?.email ? String(payload.email) : '' };
        }
      } catch (_) {}

      // Guardrail: auth session resolution can hang (offline / browser issues). Never block popup indefinitely.
      const timeoutMs = 500;
      const sessionPromise = this.client.auth.getSession();
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ data: { session: null }, error: new Error('getSession timeout') }), timeoutMs));
      const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);

      if (error) throw error;
      return session?.user || null;
    } catch (error) {
      console.error('❌ Get current user failed:', error);
      return null;
    }
  }

  /**
   * Create user subscription record
   */
  async createUserSubscription(userId, email, tier = 'free') {
    if (!this.client) return false;

    try {
      const { error } = await this.client
        .from('user_subscriptions')
        .insert([{
          user_id: userId,
          email: email,
          subscription_tier: tier,
          subscription_status: 'active'
        }]);

      if (error) throw error;

      console.log('✅ User subscription created');
      return true;
    } catch (error) {
      console.error('❌ Failed to create subscription:', error);
      return false;
    }
  }

  /**
   * Get user subscription info
   */
  async getUserSubscription(userId) {
    if (!this.client) return null;

    try {
      // Guardrail: Supabase auth session can hang (same issue as getCurrentUser).
      // Race the query against a timeout, then fall back to direct REST call.
      const queryPromise = this.client
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      const timeoutMs = 3000;
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('getUserSubscription timeout') }), timeoutMs)
      );

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) {
        // On timeout, try direct REST fallback bypassing stuck auth client
        if (error.message === 'getUserSubscription timeout') {
          return await this._getUserSubscriptionDirect(userId);
        }
        throw error;
      }

      // Best-effort cache write (avoids slow/failing future fetches)
      this.setCachedSubscription(userId, data);

      return data;
    } catch (error) {
      console.error('❌ Failed to get subscription:', error);
      return null;
    }
  }

  /**
   * Direct REST fallback for getUserSubscription when Supabase auth client is stuck.
   * Bypasses the Supabase JS client entirely, using the stored access token from chrome.storage.
   */
  async _getUserSubscriptionDirect(userId) {
    try {
      const accessToken = await this.getStoredAccessToken();
      const headers = {
        'apikey': PASTECRAFT_CONFIG.supabase.anonKey,
        'Authorization': `Bearer ${accessToken || PASTECRAFT_CONFIG.supabase.anonKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.pgrst.object+json'
      };
      const url = `${PASTECRAFT_CONFIG.supabase.url}/rest/v1/user_subscriptions?user_id=eq.${userId}&select=*`;
      const res = await fetch(url, { headers });

      if (!res.ok) return null;
      const data = await res.json();
      if (data) this.setCachedSubscription(userId, data);
      return data;
    } catch (error) {
      console.error('❌ Direct subscription fetch failed:', error);
      return null;
    }
  }

  /**
   * Check if user has premium access
   */
  async isPremiumUser(userId) {
    const effectiveAccess = await this.getEffectiveAccessState(userId);
    if (effectiveAccess && typeof effectiveAccess.is_premium === 'boolean') {
      return !!effectiveAccess.is_premium;
    }

    // Fast path: cached subscription (avoid blocking UI on slow network)
    const cached = await this.getCachedSubscription(userId);
    if (cached) {
      const cachedExpiresAtMs = cached?.ai_access_expires_at ? Date.parse(cached.ai_access_expires_at) : NaN;
      const cachedIsPaidPremium = !!(cached &&
        (cached.subscription_tier === 'premium' || cached.subscription_tier === 'admin') &&
        cached.subscription_status === 'active'
      );
      const cachedHasCouponAiAccess = !!(cached && (
        cached.has_unlimited_ai === true ||
        (Number.isFinite(cachedExpiresAtMs) && cachedExpiresAtMs > Date.now())
      ));
      const cachedIsPremium = cachedIsPaidPremium || cachedHasCouponAiAccess;
      if (cachedIsPremium) {
        return true;
      }
    }

    const subscription = await this.getUserSubscription(userId);
    const isPaidPremium = !!(subscription &&
      (subscription.subscription_tier === 'premium' || subscription.subscription_tier === 'admin') &&
      subscription.subscription_status === 'active'
    );

    // Coupon-based AI access (DEV4EVER / months_free) should also grant premium AI gating access.
    const expiresAtMs = subscription?.ai_access_expires_at ? Date.parse(subscription.ai_access_expires_at) : NaN;
    const hasCouponAiAccess = !!(subscription && (
      subscription.has_unlimited_ai === true ||
      (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now())
    ));

    const isPremium = isPaidPremium || hasCouponAiAccess;
    return isPremium;
  }

  /**
   * Check if user has cloud sync access (basic or premium tier)
   * FREE tier = local storage only, no cloud sync
   * BASIC/PREMIUM tiers = cloud sync allowed
   */
  async hasCloudSyncAccess(userId) {
    const effectiveAccess = await this.getEffectiveAccessState(userId);
    if (effectiveAccess && typeof effectiveAccess.has_cloud_sync === 'boolean') {
      return !!effectiveAccess.has_cloud_sync;
    }

    const subscription = await this.getUserSubscription(userId);
    if (!subscription) {
      return false; // No subscription = free tier = no cloud sync
    }
    
    const tier = subscription.subscription_tier?.toLowerCase();
    const status = subscription.subscription_status?.toLowerCase();
    const expiresAtMs = subscription?.ai_access_expires_at ? Date.parse(subscription.ai_access_expires_at) : NaN;
    const hasCouponCloudAccess = !!(
      subscription.has_unlimited_ai === true ||
      (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now())
    );
    
    // Allow cloud sync for basic and premium tiers (active status)
    // Also allow past_due (grace period) for better UX
    const allowedTiers = ['basic', 'premium', 'admin'];
    const allowedStatuses = ['active', 'past_due'];
    const hasPaidTierAccess = allowedTiers.includes(tier) && allowedStatuses.includes(status);
    const hasAccess = hasPaidTierAccess || hasCouponCloudAccess;
    return hasAccess;
  }

  async getEffectiveAccessState(userId) {
    if (!this.client || !userId) return null;
    try {
      const { data, error } = await this.client.rpc('get_effective_access_state', {
        p_user_id: String(userId)
      });
      if (error) throw error;
      const row = Array.isArray(data) ? (data[0] || null) : data;
      if (!row) return null;
      return {
        is_owner: row.is_owner === true,
        is_premium: row.is_premium === true,
        has_cloud_sync: row.has_cloud_sync === true,
        source: String(row.source || '')
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Check cloud sync access and show upgrade prompt if not allowed
   * @param {string} userId - User ID to check
   * @returns {boolean} - True if user has cloud sync access
   */
  async checkCloudSyncAccess(userId) {
    const hasAccess = await this.hasCloudSyncAccess(userId);
    
    if (!hasAccess) {
      // Show upgrade prompt for cloud sync
      const upgradeUrl = `https://pastecraft.com/pricing.html`;
      if (confirm('Cloud sync requires a Basic or Enhanced subscription. Upgrade now?')) {
        window.open(upgradeUrl, '_blank');
      }
      return false;
    }
    
    return true;
  }

  /**
   * Check premium access and redirect to upgrade page if not premium
   * @param {string} userId - User ID to check
   * @param {string} featureName - Feature being accessed (breakdown, summary, image, avatar, cartoon, name)
   * @returns {boolean} - True if user has premium access, false if redirected
   */
  async checkPremiumAccess(userId, featureName = 'feature') {
    const isPremium = await this.isPremiumUser(userId);
    
    if (!isPremium) {
      // Redirect to upgrade page with feature context
      const upgradeUrl = `https://pastecraft.com/upgrade.html?feature=${encodeURIComponent(featureName)}`;
      window.open(upgradeUrl, '_blank');
      return false;
    }
    
    return true;
  }

  async registerCurrentSyncDevice() {
    if (!this.client) return null;
    try {
      const userId = await this.getSyncUserId();
      const hasAccess = await this.hasCloudSyncAccess(userId);
      if (!hasAccess) return null;
      await this.setUserContext(userId);
      await this.ensureUserProfileRow(userId);
      const deviceId = await this.getDeviceId();
      const now = new Date().toISOString();
      const { data, error } = await this.client
        .from('pastecraft_devices')
        .upsert({
          user_id: userId,
          device_id: deviceId,
          last_seen_at: now
        }, { onConflict: 'user_id,device_id', ignoreDuplicates: false })
        .select('id,user_id,device_id,display_name,last_seen_at,created_at,updated_at')
        .maybeSingle();
      if (error) throw error;
      return data || null;
    } catch (_) {
      return null;
    }
  }

  async listSyncDevices() {
    if (!this.client) return [];
    try {
      const userId = await this.getSyncUserId();
      const hasAccess = await this.hasCloudSyncAccess(userId);
      if (!hasAccess) return [];
      await this.setUserContext(userId);
      await this.ensureUserProfileRow(userId);
      const currentDeviceId = await this.getDeviceId();
      const { data, error } = await this.client
        .from('pastecraft_devices')
        .select('device_id,display_name,last_seen_at')
        .eq('user_id', userId)
        .neq('device_id', currentDeviceId)
        .order('last_seen_at', { ascending: false })
        .limit(9);
      if (error) throw error;
      return (Array.isArray(data) ? data : []).map((row) => ({
        deviceId: String(row.device_id || ''),
        displayName: String(row.display_name || ''),
        lastSeenAt: row.last_seen_at || null
      }));
    } catch (_) {
      return [];
    }
  }

  async getDeviceSyncMetadata(remoteDeviceId) {
    if (!this.client) return { clips: [], notes: [], categories: [] };
    const sourceDeviceId = String(remoteDeviceId || '').trim();
    if (!sourceDeviceId) return { clips: [], notes: [], categories: [] };
    try {
      const userId = await this.getSyncUserId();
      const hasAccess = await this.hasCloudSyncAccess(userId);
      if (!hasAccess) return { clips: [], notes: [], categories: [] };
      await this.setUserContext(userId);
      await this.ensureUserProfileRow(userId);
      const [clipRes, noteRes, categoryRes] = await Promise.all([
        this.client
          .from('clips')
          .select('clip_id,text,content_hash,updated_at,device_id')
          .eq('user_id', userId)
          .eq('device_id', sourceDeviceId)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(400),
        this.client
          .from('notes')
          .select('note_id,title,description,content_hash,updated_at,device_id')
          .eq('user_id', userId)
          .eq('device_id', sourceDeviceId)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(400),
        this.client
          .from('categories')
          .select('category_id,name,updated_at,device_id')
          .eq('user_id', userId)
          .eq('device_id', sourceDeviceId)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(400)
      ]);
      if (clipRes.error) throw clipRes.error;
      if (noteRes.error) throw noteRes.error;
      if (categoryRes.error) throw categoryRes.error;
      return {
        clips: (clipRes.data || []).map((row) => ({
          id: String(row.clip_id || ''),
          preview: String(row.text || '').slice(0, 220),
          content_hash: String(row.content_hash || ''),
          origin_device_id: String(row.device_id || sourceDeviceId),
          updated_at: row.updated_at || null
        })),
        notes: (noteRes.data || []).map((row) => ({
          id: String(row.note_id || ''),
          preview: String(row.title || row.description || '').slice(0, 220),
          content_hash: String(row.content_hash || ''),
          origin_device_id: String(row.device_id || sourceDeviceId),
          updated_at: row.updated_at || null
        })),
        categories: (categoryRes.data || []).map((row) => ({
          id: String(row.category_id || ''),
          preview: String(row.name || '').slice(0, 220),
          content_hash: '',
          origin_device_id: String(row.device_id || sourceDeviceId),
          updated_at: row.updated_at || null
        }))
      };
    } catch (_) {
      return { clips: [], notes: [], categories: [] };
    }
  }

  async getDeviceSyncData(remoteDeviceId, itemRefs = []) {
    if (!this.client) return { items: [] };
    const sourceDeviceId = String(remoteDeviceId || '').trim();
    if (!sourceDeviceId || !Array.isArray(itemRefs) || !itemRefs.length) return { items: [] };
    try {
      const userId = await this.getSyncUserId();
      const hasAccess = await this.hasCloudSyncAccess(userId);
      if (!hasAccess) return { items: [] };
      await this.setUserContext(userId);
      await this.ensureUserProfileRow(userId);

      const grouped = itemRefs.reduce((acc, ref) => {
        const type = String(ref?.itemType || '').trim();
        const id = String(ref?.itemId || '').trim();
        if (!type || !id) return acc;
        if (!acc[type]) acc[type] = [];
        acc[type].push(id);
        return acc;
      }, {});

      const resultItems = [];

      if (Array.isArray(grouped.clips) && grouped.clips.length > 0) {
        const { data, error } = await this.client
          .from('clips')
          .select('clip_id,text,category,timestamp,content_hash,device_id,updated_at')
          .eq('user_id', userId)
          .eq('device_id', sourceDeviceId)
          .in('clip_id', grouped.clips)
          .is('deleted_at', null);
        if (error) throw error;
        for (const row of (data || [])) {
          resultItems.push({
            itemType: 'clips',
            id: String(row.clip_id || ''),
            origin_device_id: String(row.device_id || sourceDeviceId),
            content_hash: String(row.content_hash || ''),
            payload: {
              id: String(row.clip_id || ''),
              text: String(row.text || ''),
              category: String(row.category || 'Uncategorized'),
              timestamp: Number(row.timestamp || Date.now()),
              updated_at: row.updated_at || null,
              contentHash: String(row.content_hash || ''),
              origin_device_id: String(row.device_id || sourceDeviceId)
            }
          });
        }
      }

      if (Array.isArray(grouped.notes) && grouped.notes.length > 0) {
        const { data, error } = await this.client
          .from('notes')
          .select('note_id,note_type,title,description,body,attachments,note_refs,source_note_ids,created_at,updated_at,content_hash,device_id')
          .eq('user_id', userId)
          .eq('device_id', sourceDeviceId)
          .in('note_id', grouped.notes)
          .is('deleted_at', null);
        if (error) throw error;
        for (const row of (data || [])) {
          resultItems.push({
            itemType: 'notes',
            id: String(row.note_id || ''),
            origin_device_id: String(row.device_id || sourceDeviceId),
            content_hash: String(row.content_hash || ''),
            payload: {
              id: String(row.note_id || ''),
              type: String(row.note_type || 'note'),
              title: String(row.title || ''),
              description: String(row.description || ''),
              body: String(row.body || ''),
              clips: Array.isArray(row.attachments) ? row.attachments.filter((x) => x && x.type === 'clip') : [],
              images: Array.isArray(row.attachments) ? row.attachments.filter((x) => x && x.type === 'image') : [],
              urls: Array.isArray(row.attachments) ? row.attachments.filter((x) => x && x.type === 'url') : [],
              noteRefs: Array.isArray(row.note_refs) ? row.note_refs : [],
              sourceNoteIds: Array.isArray(row.source_note_ids) ? row.source_note_ids : [],
              createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
              updatedAt: row.updated_at ? Date.parse(row.updated_at) : Date.now(),
              contentHash: String(row.content_hash || ''),
              origin_device_id: String(row.device_id || sourceDeviceId)
            }
          });
        }
      }

      if (Array.isArray(grouped.categories) && grouped.categories.length > 0) {
        const { data, error } = await this.client
          .from('categories')
          .select('category_id,name,icon,created_at,updated_at,device_id')
          .eq('user_id', userId)
          .eq('device_id', sourceDeviceId)
          .in('category_id', grouped.categories)
          .is('deleted_at', null);
        if (error) throw error;
        for (const row of (data || [])) {
          resultItems.push({
            itemType: 'categories',
            id: String(row.category_id || ''),
            origin_device_id: String(row.device_id || sourceDeviceId),
            content_hash: '',
            payload: {
              id: String(row.category_id || ''),
              name: String(row.name || ''),
              icon: String(row.icon || '📁'),
              createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
              updatedAt: row.updated_at ? Date.parse(row.updated_at) : Date.now(),
              origin_device_id: String(row.device_id || sourceDeviceId)
            }
          });
        }
      }

      return { items: resultItems };
    } catch (_) {
      return { items: [] };
    }
  }

  /**
   * Admin sign in (checks for admin tier)
   */
  async signInAsAdmin(email, password) {
    const result = await this.signInWithEmail(email, password);
    
    if (result.success) {
      const subscription = await this.getUserSubscription(result.user.id);
      
      if (subscription && subscription.subscription_tier === 'admin') {
        return { success: true, user: result.user, isAdmin: true };
      } else {
        await this.signOut();
        return { success: false, error: 'Unauthorized: Admin access required' };
      }
    }
    
    return result;
  }

  // =====================================================
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

    try {
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
          'pc_deleted_clips',
          'pc_deleted_archived_clips',
          'pc_deleted_categories',
          'pc_deleted_notes'
        ], resolve);
      });

      const localClips = localData.clips || [];
      const localCategories = localData.categories || [];
      const localArchivedClips = localData.searchOnlyClips || [];
      const localNotes = localData.notes || [];
      const localSettings = localData.settings || {};
      const localProfile = localData.userProfile || {};
      const deletedClips = localData.pc_deleted_clips || [];
      const deletedArchivedClips = localData.pc_deleted_archived_clips || [];
      const deletedCategories = localData.pc_deleted_categories || [];
      const deletedNotes = localData.pc_deleted_notes || [];

      // Sync soft deletions first (prevents resurrection)
      await this.syncDeletedClipsToSupabase(deletedClips);
      await this.syncDeletedArchivedClipsToSupabase(deletedArchivedClips);
      await this.syncDeletedCategoriesToSupabase(deletedCategories);
      await this.syncDeletedNotesToSupabase(deletedNotes);

      // Sync clips
      await this.syncClipsToSupabase(localClips);
      const remoteClips = await this.syncClipsFromSupabase();
      if (remoteClips) {
        const mergedClips = await this.mergeClips(localClips, remoteClips);
        await new Promise((resolve) => {
          chrome.storage.local.set({ clips: mergedClips }, resolve);
        });
        console.log(`✅ Clips merged: ${mergedClips.length} total`);
      }

      // Sync categories
      await this.syncCategoriesToSupabase(localCategories);
      const remoteCategories = await this.syncCategoriesFromSupabase();
      if (remoteCategories) {
        const mergedCategories = await this.mergeCategories(localCategories, remoteCategories);
        await new Promise((resolve) => {
          chrome.storage.local.set({ categories: mergedCategories }, resolve);
        });
        console.log(`✅ Categories merged: ${mergedCategories.length} total`);
      }

      // Sync archived clips (searchOnlyClips)
      await this.syncArchivedClipsToSupabase(localArchivedClips);
      const remoteArchivedClips = await this.syncArchivedClipsFromSupabase();
      if (remoteArchivedClips) {
        const mergedArchivedClips = await this.mergeArchivedClips(localArchivedClips, remoteArchivedClips);
        await new Promise((resolve) => {
          chrome.storage.local.set({ searchOnlyClips: mergedArchivedClips }, resolve);
        });
        console.log(`✅ Archived clips merged: ${mergedArchivedClips.length} total (limited to 1000 locally)`);
      }

      // Sync notes
      await this.syncNotesToSupabase(localNotes);
      const remoteNotes = await this.syncNotesFromSupabase();
      if (remoteNotes) {
        const mergedNotes = await this.mergeNotes(localNotes, remoteNotes);
        await new Promise((resolve) => {
          chrome.storage.local.set({ notes: mergedNotes }, resolve);
        });
        console.log(`✅ Notes merged: ${mergedNotes.length} total`);
      }

      // Sync settings
      await this.syncSettingsToSupabase(localSettings);
      const remoteSettings = await this.syncSettingsFromSupabase();
      if (remoteSettings) {
        await new Promise((resolve) => {
          chrome.storage.local.set({ settings: remoteSettings }, resolve);
        });
        console.log('✅ Settings updated');
      }

      // Sync user profile
      await this.syncUserProfileToSupabase(localProfile);
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
        await new Promise((resolve) => {
          chrome.storage.local.set({ userProfile: mergedProfile }, resolve);
        });
        console.log('✅ User profile updated');
      }

      console.log('✅ Full sync complete!');
      return {
        success: true,
        message: 'All data synced successfully',
        stats: {
          clips: remoteClips?.length || 0,
          categories: remoteCategories?.length || 0,
          archivedClips: remoteArchivedClips?.length || 0,
          notes: remoteNotes?.length || 0
        }
      };

    } catch (error) {
      console.error('❌ Full sync failed:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

// Initialize global instance
const pasteCraftSupabase = new PasteCraftSupabase();

