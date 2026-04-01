// PasteCraft Storage Adapter
// Provides chrome.storage adapter for Supabase auth persistence
// Reference: https://supabase.com/docs/guides/auth/sessions

import { STORAGE_KEYS } from './constants.js';

/**
 * Custom storage adapter for Supabase that uses chrome.storage.local
 * This allows session persistence across extension contexts
 */
export const chromeStorageAdapter = {
  /**
   * Get item from storage
   * @param {string} key - Storage key
   * @returns {Promise<string|null>}
   */
  async getItem(key) {
    try {
      const result = await chrome.storage.local.get([key]);
      return result[key] ?? null;
    } catch (err) {
      console.error('[StorageAdapter] getItem error:', err);
      return null;
    }
  },

  /**
   * Set item in storage
   * @param {string} key - Storage key
   * @param {string} value - Value to store
   */
  async setItem(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (err) {
      console.error('[StorageAdapter] setItem error:', err);
    }
  },

  /**
   * Remove item from storage
   * @param {string} key - Storage key
   */
  async removeItem(key) {
    try {
      await chrome.storage.local.remove([key]);
    } catch (err) {
      console.error('[StorageAdapter] removeItem error:', err);
    }
  }
};

/**
 * Helper to get multiple keys at once
 * @param {string[]} keys - Array of storage keys
 * @returns {Promise<Object>}
 */
export async function getStorageItems(keys) {
  try {
    return await chrome.storage.local.get(keys);
  } catch (err) {
    console.error('[StorageAdapter] getStorageItems error:', err);
    return {};
  }
}

/**
 * Helper to set multiple keys at once
 * @param {Object} items - Key-value pairs to store
 */
export async function setStorageItems(items) {
  try {
    await chrome.storage.local.set(items);
  } catch (err) {
    console.error('[StorageAdapter] setStorageItems error:', err);
  }
}

/**
 * Helper to remove multiple keys at once
 * @param {string[]} keys - Array of keys to remove
 */
export async function removeStorageItems(keys) {
  try {
    await chrome.storage.local.remove(keys);
  } catch (err) {
    console.error('[StorageAdapter] removeStorageItems error:', err);
  }
}

/**
 * Listen for storage changes
 * @param {Function} callback - (changes, areaName) => void
 * @returns {Function} Cleanup function
 */
export function onStorageChange(callback) {
  chrome.storage.onChanged.addListener(callback);
  return () => chrome.storage.onChanged.removeListener(callback);
}

/**
 * Get device ID, creating one if it doesn't exist
 * @returns {Promise<string>}
 */
export async function getOrCreateDeviceId() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.DEVICE_ID]);
    if (result[STORAGE_KEYS.DEVICE_ID]) {
      return String(result[STORAGE_KEYS.DEVICE_ID]);
    }
    
    const deviceId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    await chrome.storage.local.set({ [STORAGE_KEYS.DEVICE_ID]: deviceId });
    return deviceId;
  } catch (err) {
    console.error('[StorageAdapter] getOrCreateDeviceId error:', err);
    return `fallback_${Date.now()}`;
  }
}

/**
 * Update local timestamp for sync tracking
 */
export async function touchLocalUpdatedAt() {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.LOCAL_UPDATED_AT]: Date.now() });
  } catch (err) {
    console.error('[StorageAdapter] touchLocalUpdatedAt error:', err);
  }
}

/**
 * Normalize array from storage (handles null/undefined/non-array)
 * @param {any} value - Value from storage
 * @returns {Array}
 */
export function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}
