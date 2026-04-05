/**
 * StorageMeter - Utility for measuring storage usage and calculating budgets
 * 
 * Handles dynamic calculation of how much data can fit in Chrome storage
 * and IndexedDB before needing to lazy load from Supabase.
 */

class StorageMeter {
  // Chrome storage limits
  static CHROME_QUOTA_PER_ITEM = 5 * 1024 * 1024; // 5MB per item
  static CHROME_QUOTA_TOTAL = 10 * 1024 * 1024; // 10MB total (can request unlimited)
  static IDB_SOFT_LIMIT = 50 * 1024 * 1024; // 50MB soft target for IDB
  
  // Safety margins - don't fill storage completely
  static SAFETY_MARGIN = 0.8; // Use max 80% of quota
  static WARNING_THRESHOLD = 0.7; // Warn at 70%
  
  // Default average sizes (will be calculated dynamically)
  static DEFAULT_AVG_CLIP_SIZE = 500; // bytes
  static DEFAULT_AVG_NOTE_SIZE = 2000; // bytes
  static DEFAULT_AVG_ARCHIVED_SIZE = 500; // bytes

  /**
   * Measure the size of any JavaScript object in bytes
   * @param {any} obj - Object to measure
   * @returns {number} Size in bytes
   */
  static measureBytes(obj) {
    if (obj === null || obj === undefined) return 0;
    try {
      return new Blob([JSON.stringify(obj)]).size;
    } catch (e) {
      // Fallback for objects that can't be stringified
      return JSON.stringify(obj)?.length || 0;
    }
  }

  /**
   * Measure average item size from an array of items
   * @param {Array} items - Array of items to measure
   * @param {number} sampleSize - Number of items to sample (default 50)
   * @returns {number} Average size in bytes
   */
  static measureAverageItemSize(items, sampleSize = 50) {
    if (!Array.isArray(items) || items.length === 0) {
      return 0;
    }
    
    // Sample items evenly distributed
    const step = Math.max(1, Math.floor(items.length / sampleSize));
    let totalSize = 0;
    let count = 0;
    
    for (let i = 0; i < items.length && count < sampleSize; i += step) {
      totalSize += this.measureBytes(items[i]);
      count++;
    }
    
    return count > 0 ? Math.ceil(totalSize / count) : 0;
  }

  /**
   * Get current storage usage for a specific entity key
   * @param {string} entityKey - Storage key (e.g., 'clips', 'notes')
   * @returns {Promise<{bytes: number, count: number, avgSize: number}>}
   */
  static async getEntityUsage(entityKey) {
    try {
      const data = await chrome.storage.local.get([entityKey]);
      const items = data[entityKey];
      
      if (!Array.isArray(items)) {
        return { bytes: 0, count: 0, avgSize: 0 };
      }
      
      const bytes = this.measureBytes(items);
      const count = items.length;
      const avgSize = count > 0 ? Math.ceil(bytes / count) : 0;
      
      return { bytes, count, avgSize };
    } catch (e) {
      console.error(`StorageMeter: Failed to get usage for ${entityKey}:`, e);
      return { bytes: 0, count: 0, avgSize: 0 };
    }
  }

  /**
   * Get total Chrome storage usage
   * @returns {Promise<{used: number, quota: number, percentage: number}>}
   */
  static async getTotalUsage() {
    try {
      // Get all storage data
      const allData = await chrome.storage.local.get(null);
      const used = this.measureBytes(allData);
      const quota = this.CHROME_QUOTA_TOTAL;
      const percentage = used / quota;
      
      return { used, quota, percentage };
    } catch (e) {
      console.error('StorageMeter: Failed to get total usage:', e);
      return { used: 0, quota: this.CHROME_QUOTA_TOTAL, percentage: 0 };
    }
  }

  /**
   * Calculate how many items can fit within a byte budget
   * @param {Array} items - Sample items to measure
   * @param {number} maxBytes - Maximum bytes allowed
   * @param {number} defaultAvgSize - Fallback average size if no items
   * @returns {{budget: number, avgSize: number}}
   */
  static calculateItemBudget(items, maxBytes, defaultAvgSize = 500) {
    const avgSize = items && items.length > 0 
      ? this.measureAverageItemSize(items)
      : defaultAvgSize;
    
    // Apply safety margin
    const safeMaxBytes = maxBytes * this.SAFETY_MARGIN;
    const budget = Math.floor(safeMaxBytes / Math.max(avgSize, 1));
    
    return { budget, avgSize };
  }

  /**
   * Calculate local storage budget for each entity type
   * @returns {Promise<{clips: number, notes: number, archived: number}>}
   */
  static async calculateLocalBudgets() {
    // Get current data to measure average sizes
    const data = await chrome.storage.local.get(['clips', 'notes', 'searchOnlyClips']);
    
    // Calculate average sizes (use defaults if no data)
    const clipAvgSize = data.clips?.length > 0 
      ? this.measureAverageItemSize(data.clips)
      : this.DEFAULT_AVG_CLIP_SIZE;
    
    const noteAvgSize = data.notes?.length > 0 
      ? this.measureAverageItemSize(data.notes)
      : this.DEFAULT_AVG_NOTE_SIZE;
    
    const archivedAvgSize = data.searchOnlyClips?.length > 0 
      ? this.measureAverageItemSize(data.searchOnlyClips)
      : this.DEFAULT_AVG_ARCHIVED_SIZE;
    
    // Per-item quota with safety margin
    const safeQuota = this.CHROME_QUOTA_PER_ITEM * this.SAFETY_MARGIN;
    
    // Calculate budgets
    const clipsBudget = Math.floor(safeQuota / Math.max(clipAvgSize, 1));
    const notesBudget = Math.floor(safeQuota / Math.max(noteAvgSize, 1));
    const archivedBudget = Math.floor(safeQuota / Math.max(archivedAvgSize, 1));
    
    // Cap at reasonable UX limits (don't want 10000 items even if they fit)
    const MAX_CLIPS_LOCAL = 2000;
    const MAX_NOTES_LOCAL = 1000;
    const MAX_ARCHIVED_LOCAL = 2000;
    
    return {
      clips: Math.min(clipsBudget, MAX_CLIPS_LOCAL),
      notes: Math.min(notesBudget, MAX_NOTES_LOCAL),
      archived: Math.min(archivedBudget, MAX_ARCHIVED_LOCAL),
      avgSizes: { clips: clipAvgSize, notes: noteAvgSize, archived: archivedAvgSize }
    };
  }

  /**
   * Check if storage is near quota
   * @param {number} threshold - Percentage threshold (0-1), default 0.8
   * @returns {Promise<{isNearQuota: boolean, percentage: number, recommendation: string}>}
   */
  static async isNearQuota(threshold = 0.8) {
    const usage = await this.getTotalUsage();
    const isNearQuota = usage.percentage >= threshold;
    
    let recommendation = '';
    if (usage.percentage >= 0.9) {
      recommendation = 'critical';
    } else if (usage.percentage >= 0.8) {
      recommendation = 'high';
    } else if (usage.percentage >= 0.7) {
      recommendation = 'moderate';
    } else {
      recommendation = 'healthy';
    }
    
    return {
      isNearQuota,
      percentage: usage.percentage,
      used: usage.used,
      quota: usage.quota,
      recommendation
    };
  }

  /**
   * Get detailed storage report
   * @returns {Promise<Object>}
   */
  static async getStorageReport() {
    const [total, clips, notes, archived, budgets] = await Promise.all([
      this.getTotalUsage(),
      this.getEntityUsage('clips'),
      this.getEntityUsage('notes'),
      this.getEntityUsage('searchOnlyClips'),
      this.calculateLocalBudgets()
    ]);
    
    return {
      total,
      entities: {
        clips: { ...clips, budget: budgets.clips },
        notes: { ...notes, budget: budgets.notes },
        archived: { ...archived, budget: budgets.archived }
      },
      budgets,
      isNearQuota: total.percentage >= this.SAFETY_MARGIN,
      recommendation: total.percentage >= 0.9 ? 'critical' 
        : total.percentage >= 0.8 ? 'high'
        : total.percentage >= 0.7 ? 'moderate' 
        : 'healthy'
    };
  }

  /**
   * Determine which items should stay local vs go to cloud only
   * @param {Array} items - All items (sorted newest first)
   * @param {number} localBudget - Number of items to keep locally
   * @returns {{local: Array, cloudOnly: Array}}
   */
  static splitByBudget(items, localBudget) {
    if (!Array.isArray(items)) {
      return { local: [], cloudOnly: [] };
    }
    
    const local = items.slice(0, localBudget);
    const cloudOnly = items.slice(localBudget);
    
    return { local, cloudOnly };
  }

  /**
   * Format bytes to human readable string
   * @param {number} bytes 
   * @returns {string}
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.StorageMeter = StorageMeter;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageMeter;
}
