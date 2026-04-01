// PasteCraft Clips Module
// Handles clips page logic

import { STORAGE_KEYS, LIMITS, DEFAULT_CATEGORY } from '../../shared/constants.js';
import { getStorageItems, setStorageItems, normalizeArray, touchLocalUpdatedAt } from '../../shared/storage-adapter.js';
import { toast } from '../components/toast.js';
import { confirm } from '../components/modal.js';

/**
 * Load clips from storage
 * @param {boolean} includeArchived - Include archived clips
 * @returns {Promise<{ clips: Array, archived: Array }>}
 */
export async function loadClips(includeArchived = false) {
  const result = await getStorageItems([STORAGE_KEYS.CLIPS, STORAGE_KEYS.SEARCH_ONLY_CLIPS]);
  const clips = normalizeArray(result[STORAGE_KEYS.CLIPS]);
  const archived = includeArchived ? normalizeArray(result[STORAGE_KEYS.SEARCH_ONLY_CLIPS]) : [];
  return { clips, archived };
}

/**
 * Save clips to storage
 * @param {Array} clips - Active clips
 * @param {Array} archived - Archived clips
 */
export async function saveClips(clips, archived) {
  await setStorageItems({
    [STORAGE_KEYS.CLIPS]: clips,
    [STORAGE_KEYS.SEARCH_ONLY_CLIPS]: archived
  });
  await touchLocalUpdatedAt();
}

/**
 * Delete a clip by ID
 * @param {string} clipId - Clip ID
 * @returns {Promise<boolean>} Success
 */
export async function deleteClip(clipId) {
  if (!clipId) return false;

  const { clips, archived } = await loadClips(true);
  
  const initialCount = clips.length + archived.length;
  const newClips = clips.filter(c => String(c.id) !== String(clipId));
  const newArchived = archived.filter(c => String(c.id) !== String(clipId));

  if (newClips.length + newArchived.length === initialCount) {
    return false; // Not found
  }

  await saveClips(newClips, newArchived);
  return true;
}

/**
 * Delete multiple clips
 * @param {Array<string>} clipIds - Array of clip IDs
 * @returns {Promise<number>} Number of deleted clips
 */
export async function deleteMultipleClips(clipIds) {
  if (!clipIds?.length) return 0;

  const idSet = new Set(clipIds.map(String));
  const { clips, archived } = await loadClips(true);

  const newClips = clips.filter(c => !idSet.has(String(c.id)));
  const newArchived = archived.filter(c => !idSet.has(String(c.id)));

  const deletedCount = (clips.length - newClips.length) + (archived.length - newArchived.length);

  if (deletedCount > 0) {
    await saveClips(newClips, newArchived);
  }

  return deletedCount;
}

/**
 * Move clip to category
 * @param {string} clipId - Clip ID
 * @param {string} category - Target category
 * @returns {Promise<boolean>} Success
 */
export async function moveToCategory(clipId, category) {
  if (!clipId) return false;

  const { clips, archived } = await loadClips(true);
  let found = false;

  const update = (arr) => arr.map(c => {
    if (String(c.id) === String(clipId)) {
      found = true;
      return { ...c, category };
    }
    return c;
  });

  const newClips = update(clips);
  const newArchived = update(archived);

  if (found) {
    await saveClips(newClips, newArchived);
  }

  return found;
}

/**
 * Clear all clips
 * @param {boolean} includeArchived - Also clear archived
 * @returns {Promise<number>} Number of clips cleared
 */
export async function clearAllClips(includeArchived = true) {
  const { clips, archived } = await loadClips(true);
  const count = clips.length + (includeArchived ? archived.length : 0);

  await saveClips([], includeArchived ? [] : archived);
  return count;
}

/**
 * Search clips
 * @param {string} query - Search query
 * @param {Object} options
 * @param {string} options.category - Filter by category
 * @param {boolean} options.includeArchived - Search archived too
 * @returns {Promise<Array>} Matching clips
 */
export async function searchClips(query, options = {}) {
  const { category, includeArchived = true } = options;
  const { clips, archived } = await loadClips(includeArchived);

  const allClips = includeArchived ? [...clips, ...archived] : clips;
  const q = String(query).toLowerCase().trim();

  return allClips.filter(clip => {
    // Category filter
    if (category && category !== DEFAULT_CATEGORY && clip.category !== category) {
      return false;
    }

    // Text search
    if (!q) return true;
    const text = String(clip.text || '').toLowerCase();
    return text.includes(q);
  });
}

/**
 * Get clips by category
 * @param {string} category - Category name
 * @returns {Promise<Array>}
 */
export async function getClipsByCategory(category) {
  const { clips } = await loadClips();
  return clips.filter(c => c.category === category);
}

/**
 * Format time ago string
 * @param {number} timestamp - Unix timestamp in ms
 * @returns {string}
 */
export function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  
  const now = Date.now();
  const diff = now - timestamp;
  
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;

  if (diff < minute) return 'just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < week) return `${Math.floor(diff / day)}d ago`;
  if (diff < month) return `${Math.floor(diff / week)}w ago`;
  
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (_) {
    return false;
  }
}

/**
 * Confirm and delete clip with UI feedback
 * @param {Object} clip - Clip to delete
 * @param {Function} onDelete - Callback after deletion
 */
export async function confirmDeleteClip(clip, onDelete) {
  const preview = String(clip.text || '').substring(0, 50) + '...';
  
  const confirmed = await confirm({
    title: 'Delete Clip',
    message: `Delete this clip?\n\n"${preview}"`,
    confirmText: 'Delete',
    confirmType: 'danger'
  });

  if (!confirmed) return;

  const success = await deleteClip(clip.id);
  
  if (success) {
    toast.success('Clip deleted');
    if (onDelete) onDelete(clip);
  } else {
    toast.error('Failed to delete clip');
  }
}
