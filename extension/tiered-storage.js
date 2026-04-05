/**
 * TieredStorage - Manager for hot/cold storage with lazy loading
 * 
 * Handles the logic of keeping recent data locally (hot) and
 * lazy loading older data from Supabase (cold) on demand.
 */

class TieredStorage {
  /**
   * @param {string} entityType - 'clips', 'notes', or 'archived'
   * @param {Object} options - Configuration options
   */
  constructor(entityType, options = {}) {
    this.entityType = entityType;
    this.options = {
      pageSize: options.pageSize || 10,
      localStorageKey: options.localStorageKey || entityType,
      supabaseTable: options.supabaseTable || entityType,
      timestampField: options.timestampField || 'timestamp',
      idField: options.idField || 'id',
      ...options
    };
    
    // State
    this.localBudget = null;
    this.totalCount = null;
    this.localCount = 0;
    this.isInitialized = false;
    this.cachedPages = new Map(); // pageIndex -> items
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache
  }

  /**
   * Initialize the tiered storage - calculate budgets and counts
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Calculate local budget based on storage meter
      const budgets = await StorageMeter.calculateLocalBudgets();
      
      switch (this.entityType) {
        case 'clips':
          this.localBudget = budgets.clips;
          break;
        case 'notes':
          this.localBudget = budgets.notes;
          break;
        case 'archived':
          this.localBudget = budgets.archived;
          break;
        default:
          this.localBudget = 500; // Default fallback
      }
      
      // Get local count
      const localData = await chrome.storage.local.get([this.options.localStorageKey]);
      const items = localData[this.options.localStorageKey];
      this.localCount = Array.isArray(items) ? items.length : 0;
      
      this.isInitialized = true;
    } catch (e) {
      console.error(`TieredStorage [${this.entityType}]: Initialization failed:`, e);
      this.localBudget = 500; // Fallback
      this.isInitialized = true;
    }
  }

  /**
   * Get total count from Supabase (cached)
   * @param {Function} countFetcher - Async function that returns count from Supabase
   * @returns {Promise<number>}
   */
  async getTotalCount(countFetcher) {
    // Return cached count if available and not expired
    if (this.totalCount !== null && this._countFetchedAt && 
        Date.now() - this._countFetchedAt < this.cacheExpiry) {
      return this.totalCount;
    }
    
    try {
      // Check if user is authenticated (has Supabase access)
      if (typeof pasteCraftSupabase !== 'undefined' && pasteCraftSupabase.isAuthenticated?.()) {
        this.totalCount = await countFetcher();
        this._countFetchedAt = Date.now();
      } else {
        // No Supabase - use local count only
        this.totalCount = this.localCount;
      }
    } catch (e) {
      console.warn(`TieredStorage [${this.entityType}]: Failed to get remote count, using local:`, e);
      this.totalCount = this.localCount;
    }
    
    return this.totalCount;
  }

  /**
   * Check if a page is available locally
   * @param {number} pageIndex - 0-based page index
   * @param {number} pageSize - Items per page
   * @returns {boolean}
   */
  isPageLocal(pageIndex, pageSize) {
    const startIndex = pageIndex * pageSize;
    const endIndex = startIndex + pageSize;
    return endIndex <= this.localCount;
  }

  /**
   * Check if we need to lazy load (data exists beyond local storage)
   * @returns {boolean}
   */
  needsLazyLoading() {
    return this.totalCount !== null && this.totalCount > this.localCount;
  }

  /**
   * Load a specific page of data
   * @param {number} pageIndex - 0-based page index
   * @param {number} pageSize - Items per page
   * @param {Object} options - { localItems, remoteFetcher }
   * @returns {Promise<{items: Array, source: 'local'|'remote'|'mixed', isLoading: boolean}>}
   */
  async loadPage(pageIndex, pageSize, { localItems, remoteFetcher }) {
    await this.initialize();
    
    const startIndex = pageIndex * pageSize;
    const endIndex = startIndex + pageSize;
    
    // Check cache first
    const cacheKey = `${pageIndex}-${pageSize}`;
    const cached = this.cachedPages.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < this.cacheExpiry) {
      return { items: cached.items, source: cached.source, isLoading: false };
    }
    
    // If page is fully within local data
    if (endIndex <= localItems.length) {
      const items = localItems.slice(startIndex, endIndex);
      this.cachedPages.set(cacheKey, { items, source: 'local', fetchedAt: Date.now() });
      return { items, source: 'local', isLoading: false };
    }
    
    // If page starts within local but extends beyond
    if (startIndex < localItems.length && endIndex > localItems.length) {
      // Partial local, need to fetch remainder from remote
      const localPart = localItems.slice(startIndex);
      const remoteNeeded = pageSize - localPart.length;
      
      try {
        if (remoteFetcher && this._hasSupabaseAccess()) {
          const remoteItems = await remoteFetcher(localItems.length, remoteNeeded);
          const items = [...localPart, ...remoteItems];
          this.cachedPages.set(cacheKey, { items, source: 'mixed', fetchedAt: Date.now() });
          return { items, source: 'mixed', isLoading: false };
        }
      } catch (e) {
        console.warn(`TieredStorage [${this.entityType}]: Remote fetch failed, returning partial:`, e);
      }
      
      // Fallback to just local part
      return { items: localPart, source: 'local', isLoading: false };
    }
    
    // Page is entirely beyond local data - need remote fetch
    if (startIndex >= localItems.length) {
      try {
        if (remoteFetcher && this._hasSupabaseAccess()) {
          const items = await remoteFetcher(startIndex, pageSize);
          this.cachedPages.set(cacheKey, { items, source: 'remote', fetchedAt: Date.now() });
          return { items, source: 'remote', isLoading: false };
        }
      } catch (e) {
        console.warn(`TieredStorage [${this.entityType}]: Remote fetch failed:`, e);
      }
      
      // No remote access or failed - return empty
      return { items: [], source: 'remote', isLoading: false };
    }
    
    return { items: [], source: 'local', isLoading: false };
  }

  /**
   * Save items with tiered storage - keep recent locally, push older to cloud
   * @param {Array} items - All items (should be sorted newest first)
   * @param {Object} options - { localSaver, remotePusher }
   * @returns {Promise<{localCount: number, cloudOnlyCount: number}>}
   */
  async save(items, { localSaver, remotePusher }) {
    await this.initialize();
    
    if (!Array.isArray(items)) {
      return { localCount: 0, cloudOnlyCount: 0 };
    }
    
    // Split by budget
    const { local, cloudOnly } = StorageMeter.splitByBudget(items, this.localBudget);
    
    // Save local portion
    try {
      await localSaver(local);
      this.localCount = local.length;
    } catch (e) {
      // If local save fails due to quota, try with smaller budget
      if (e.message?.includes('QUOTA') || e.message?.includes('quota')) {
        const reducedBudget = Math.floor(this.localBudget * 0.5);
        const reducedLocal = items.slice(0, reducedBudget);
        const additionalCloudOnly = items.slice(reducedBudget, this.localBudget);
        
        await localSaver(reducedLocal);
        this.localCount = reducedLocal.length;
        cloudOnly.unshift(...additionalCloudOnly);
        
        console.warn(`TieredStorage [${this.entityType}]: Reduced local budget to ${reducedBudget} due to quota`);
      } else {
        throw e;
      }
    }
    
    // Push cloud-only items to Supabase (if available)
    if (cloudOnly.length > 0 && remotePusher && this._hasSupabaseAccess()) {
      try {
        await remotePusher(cloudOnly);
      } catch (e) {
        console.warn(`TieredStorage [${this.entityType}]: Failed to push ${cloudOnly.length} items to cloud:`, e);
      }
    }
    
    // Update total count
    this.totalCount = items.length;
    
    // Clear cache since data changed
    this.cachedPages.clear();
    
    return { localCount: local.length, cloudOnlyCount: cloudOnly.length };
  }

  /**
   * Clear the page cache
   */
  clearCache() {
    this.cachedPages.clear();
    this._countFetchedAt = null;
  }

  /**
   * Invalidate total count (force refresh on next access)
   */
  invalidateCount() {
    this.totalCount = null;
    this._countFetchedAt = null;
  }

  /**
   * Check if Supabase access is available
   * @private
   */
  _hasSupabaseAccess() {
    return typeof pasteCraftSupabase !== 'undefined' && 
           typeof pasteCraftSupabase.isAuthenticated === 'function' &&
           pasteCraftSupabase.isAuthenticated();
  }

  /**
   * Check if browser is online
   * @private
   */
  _isOnline() {
    return typeof navigator !== 'undefined' && navigator.onLine !== false;
  }

  /**
   * Check if remote fetching is possible (online + authenticated)
   * @returns {boolean}
   */
  canFetchRemote() {
    return this._isOnline() && this._hasSupabaseAccess();
  }

  /**
   * Get storage status
   * @returns {Object}
   */
  getStatus() {
    return {
      entityType: this.entityType,
      localBudget: this.localBudget,
      localCount: this.localCount,
      totalCount: this.totalCount,
      needsLazyLoading: this.needsLazyLoading(),
      cachedPages: this.cachedPages.size,
      hasSupabaseAccess: this._hasSupabaseAccess()
    };
  }
}

/**
 * TieredStorageManager - Singleton manager for all entity types
 */
class TieredStorageManager {
  constructor() {
    this.stores = new Map();
  }

  /**
   * Get or create a tiered storage instance for an entity type
   * @param {string} entityType 
   * @param {Object} options 
   * @returns {TieredStorage}
   */
  getStore(entityType, options = {}) {
    if (!this.stores.has(entityType)) {
      this.stores.set(entityType, new TieredStorage(entityType, options));
    }
    return this.stores.get(entityType);
  }

  /**
   * Initialize all stores
   */
  async initializeAll() {
    const promises = [];
    for (const store of this.stores.values()) {
      promises.push(store.initialize());
    }
    await Promise.all(promises);
  }

  /**
   * Clear all caches
   */
  clearAllCaches() {
    for (const store of this.stores.values()) {
      store.clearCache();
    }
  }

  /**
   * Get combined status
   */
  getStatus() {
    const status = {};
    for (const [type, store] of this.stores.entries()) {
      status[type] = store.getStatus();
    }
    return status;
  }
}

// Create singleton instance
const tieredStorageManager = new TieredStorageManager();

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.TieredStorage = TieredStorage;
  window.TieredStorageManager = TieredStorageManager;
  window.tieredStorageManager = tieredStorageManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TieredStorage, TieredStorageManager, tieredStorageManager };
}
