/** Vertical slice: sync-queue.js */
export const syncQueueMixin = {
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
},

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
},

_isMergeableQueueType(type) {
  return [
    'syncClips',
    'syncArchivedClips',
    'syncCategories',
    'syncNotes',
    'syncDeletedClips',
    'syncDeletedArchivedClips',
    'syncDeletedCategories',
    'syncDeletedNotes'
  ].includes(String(type || ''));
},

_getQueueEntityKey(type, item) {
  if (!item || typeof item !== 'object') return '';
  switch (String(type || '')) {
    case 'syncClips':
    case 'syncArchivedClips':
    case 'syncDeletedClips':
    case 'syncDeletedArchivedClips':
      return String(item.id ?? item.clip_id ?? item.clipId ?? '').trim();
    case 'syncCategories':
    case 'syncDeletedCategories':
      return String(item.id ?? item.category_id ?? item.categoryId ?? item.name ?? '').trim();
    case 'syncNotes':
    case 'syncDeletedNotes':
      return String(item.id ?? item.note_id ?? item.noteId ?? '').trim();
    default:
      return '';
  }
},

_getQueueEntityVersion(item) {
  if (!item || typeof item !== 'object') return 0;
  const candidates = [
    item.updatedAt,
    item.updated_at,
    item.deletedAt,
    item.deleted_at,
    item.timestamp,
    item.createdAt,
    item.created_at
  ];
  for (const value of candidates) {
    if (Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
},

_mergeQueueOperationData(type, existingData, incomingData) {
  const existing = Array.isArray(existingData) ? existingData : [];
  const incoming = Array.isArray(incomingData) ? incomingData : [];
  const merged = new Map();

  [...existing, ...incoming].forEach((item, index) => {
    const key = this._getQueueEntityKey(type, item) || `__idx_${index}`;
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, item);
      return;
    }
    const prevVersion = this._getQueueEntityVersion(previous);
    const nextVersion = this._getQueueEntityVersion(item);
    if (nextVersion >= prevVersion) {
      merged.set(key, item);
    }
  });

  return Array.from(merged.values());
},

_compactSyncQueue(queue) {
  const items = Array.isArray(queue) ? queue : [];
  const compacted = [];
  const mergeableIndexes = new Map();

  items.forEach((operation) => {
    if (!this._isMergeableQueueType(operation?.type)) {
      compacted.push(operation);
      return;
    }
    const existingIndex = mergeableIndexes.get(operation.type);
    if (existingIndex === undefined) {
      mergeableIndexes.set(operation.type, compacted.length);
      compacted.push({
        ...operation,
        data: this._mergeQueueOperationData(operation.type, [], operation.data)
      });
      return;
    }
    const existingOperation = compacted[existingIndex];
    compacted[existingIndex] = {
      ...existingOperation,
      timestamp: Math.max(Number(existingOperation?.timestamp || 0), Number(operation?.timestamp || 0)),
      data: this._mergeQueueOperationData(operation.type, existingOperation?.data, operation?.data)
    };
  });

  return compacted;
},

async loadSyncQueue() {
  try {
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['syncQueue'], resolve);
    });
    const loadedQueue = Array.isArray(result.syncQueue) ? result.syncQueue : [];
    this.syncQueue = this._compactSyncQueue(loadedQueue);
    if (this.syncQueue.length !== loadedQueue.length) {
      console.log(`🧹 Compacted sync queue on load: ${loadedQueue.length} -> ${this.syncQueue.length}`);
      await this.saveSyncQueue();
    }
    console.log(`📦 Loaded ${this.syncQueue.length} pending sync operations`);
    
    // Process queue if online
    if (this.isOnline && this.syncQueue.length > 0) {
      setTimeout(() => this.processSyncQueue(), 1000);
    }
  } catch (error) {
    console.error('❌ Failed to load sync queue:', error);
    this.syncQueue = [];
  }
},

async saveSyncQueue() {
  try {
    await new Promise((resolve) => {
      chrome.storage.local.set({ syncQueue: this.syncQueue }, resolve);
    });
  } catch (error) {
    console.error('❌ Failed to save sync queue:', error);
  }
},

async addToSyncQueue(operation) {
  const nextOperation = {
    ...operation,
    timestamp: Date.now(),
    id: Date.now() + Math.random()
  };
  this.syncQueue = this._compactSyncQueue([...this.syncQueue, nextOperation]);
  await this.saveSyncQueue();
  console.log(`➕ Added to sync queue: ${operation.type} (${this.syncQueue.length} pending)`);
},

async processSyncQueue() {
  if (this._pauseSync) return;
  if (this._isFullSyncRunning) return;
  if (this._isProcessingSyncQueue) return;
  if (!this.isOnline || this.syncQueue.length === 0) {
    return;
  }
  
  const compactedQueue = this._compactSyncQueue(this.syncQueue);
  if (compactedQueue.length !== this.syncQueue.length) {
    console.log(`🧹 Compacted sync queue before processing: ${this.syncQueue.length} -> ${compactedQueue.length}`);
    this.syncQueue = compactedQueue;
  }

  this._isProcessingSyncQueue = true;
  try {
    console.log(`🔄 Processing ${this.syncQueue.length} queued operations...`);
    this.updateSyncStatus('syncing');
    
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
    
    this.syncQueue = this._compactSyncQueue(this.syncQueue);
    await this.saveSyncQueue();
    this.updateSyncStatus(this.syncQueue.length > 0 ? 'syncing' : 'synced');
    console.log(`✅ Queue processed. ${this.syncQueue.length} operations remaining.`);
  } finally {
    this._isProcessingSyncQueue = false;
  }
},

async executeSyncOperation(operation) {
  let result = true;
  const type = String(operation?.type || '');
  this._activeSyncTypes.add(type);
  try {
  switch (operation.type) {
    case 'syncClips':
      result = await this.syncClipsToSupabase(operation.data);
      break;
    case 'syncDeletedClips':
      result = await this.syncDeletedClipsToSupabase(operation.data);
      break;
    case 'syncCategories':
      result = await this.syncCategoriesToSupabase(operation.data);
      break;
    case 'syncDeletedCategories':
      result = await this.syncDeletedCategoriesToSupabase(operation.data);
      break;
    case 'syncArchivedClips':
      result = await this.syncArchivedClipsToSupabase(operation.data);
      break;
    case 'syncDeletedArchivedClips':
      result = await this.syncDeletedArchivedClipsToSupabase(operation.data);
      break;
    case 'syncNotes':
      result = await this.syncNotesToSupabase(operation.data);
      break;
    case 'syncDeletedNotes':
      result = await this.syncDeletedNotesToSupabase(operation.data);
      break;
    case 'syncSettings':
      result = await this.syncSettingsToSupabase(operation.data);
      break;
    case 'syncProfile':
      result = await this.syncUserProfileToSupabase(operation.data);
      break;
    default:
      console.warn('Unknown sync operation type:', operation.type);
  }
  if (result === false) {
    throw new Error(`Sync operation returned false: ${operation.type}`);
  }
  } finally {
    this._activeSyncTypes.delete(type);
  }
},

updateSyncStatus(status) {
  this.syncStatus = status;
  // Emit event for UI to update
  window.dispatchEvent(new CustomEvent('syncStatusChanged', { 
    detail: { status, queueLength: this.syncQueue.length } 
  }));
},

updateSyncProgress(current, total, percentage) {
  this.syncProgress = { current, total, percentage };
  // Emit event for UI progress bar
  window.dispatchEvent(new CustomEvent('syncProgress', {
    detail: { current, total, percentage }
  }));
},

async syncWithQueue(type, data, syncMethod) {
  const op = { type, data };
  if (!this.isOnline) {
    // Offline: add to queue
    await this.addToSyncQueue(op);
    return false;
  }
  if (this._isFullSyncRunning || this._isProcessingSyncQueue || this._activeSyncTypes.has(String(type || ''))) {
    await this.addToSyncQueue(op);
    return false;
  }
  
  try {
    // Online: sync immediately
    this.updateSyncStatus('syncing');
    this._activeSyncTypes.add(String(type || ''));
    const result = await syncMethod.call(this, data);
    if (result === false) {
      throw new Error(`Sync method returned false: ${type}`);
    }
    this.updateSyncStatus('synced');
    return true;
  } catch (error) {
    console.error(`❌ Sync failed, adding to queue:`, error);
    await this.addToSyncQueue(op);
    return false;
  } finally {
    this._activeSyncTypes.delete(String(type || ''));
  }
}

// =====================================================
};
