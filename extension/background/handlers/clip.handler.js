// PasteCraft Clip Handler
// Handles clip CRUD operations in the background service worker

import { 
  STORAGE_KEYS, 
  LIMITS, 
  DEFAULT_CATEGORY,
  MESSAGE_TYPES 
} from '../../shared/constants.js';
import { 
  getStorageItems, 
  setStorageItems, 
  normalizeArray,
  touchLocalUpdatedAt
} from '../../shared/storage-adapter.js';
import { broadcastToAllTabs } from '../../shared/messaging.js';

/**
 * Sanitize clip metadata to prevent storage bloat
 * @param {Object|null} meta - Raw metadata
 * @returns {Object|null} - Sanitized metadata
 */
function sanitizeClipMeta(meta) {
  if (!meta || typeof meta !== 'object') return null;

  const trim = (s, max) => {
    const str = String(s ?? '');
    return str.length <= max ? str : str.slice(0, max) + '…';
  };

  const out = {};
  out.kind = typeof meta.kind === 'string' ? meta.kind : 'text';

  if (meta.plainText != null) out.plainText = trim(meta.plainText, LIMITS.MAX_TEXT_LENGTH);
  if (meta.html != null) out.html = trim(meta.html, LIMITS.MAX_HTML_LENGTH);
  if (meta.url != null) out.url = trim(meta.url, LIMITS.MAX_URL_LENGTH);
  if (meta.sourcePageUrl != null) out.sourcePageUrl = trim(meta.sourcePageUrl, LIMITS.MAX_URL_LENGTH);
  if (typeof meta.capturedAt === 'number') out.capturedAt = meta.capturedAt;

  if (meta.image && typeof meta.image === 'object') {
    const img = {};
    if (meta.image.mime != null) img.mime = trim(meta.image.mime, 128);
    if (meta.image.srcUrl != null) img.srcUrl = trim(meta.image.srcUrl, LIMITS.MAX_URL_LENGTH);
    if (meta.image.dataUrl != null) {
      const du = String(meta.image.dataUrl || '');
      img.dataUrl = du.length <= LIMITS.MAX_DATAURL_CHARS ? du : '';
      if (!img.dataUrl && du) img.tooLarge = true;
    }
    if (typeof meta.image.size === 'number') img.size = meta.image.size;
    if (meta.image.tooLarge === true) img.tooLarge = true;
    out.image = img;
  }

  // Ensure we don't persist a huge object
  try {
    const json = JSON.stringify(out);
    if (json.length > 140000) {
      if (out.html) out.html = trim(out.html, 8000);
      if (out.image?.dataUrl) out.image.dataUrl = '';
      if (JSON.stringify(out).length > 140000) return null;
    }
  } catch (_) {
    return null;
  }

  return out;
}

/**
 * Save a new clip to storage
 * Note: ID is generated here for local storage. When syncing to server,
 * the server will assign a proper UUID and we'll update the local record.
 * @param {Object} options
 * @param {string} options.text - Clip text content
 * @param {string} options.category - Category name
 * @param {boolean} options.autoShow - Whether to auto-show UI
 * @param {Object|null} options.meta - Additional metadata
 * @returns {Promise<{ success: boolean, clip?: Object, error?: string }>}
 */
export async function saveClip({ text, category = DEFAULT_CATEGORY, autoShow = true, meta = null }) {
  // Validation
  if (!text || String(text).trim().length === 0) {
    console.log('[ClipHandler] Empty text - aborted');
    return { success: false, error: 'Empty text' };
  }

  try {
    const result = await getStorageItems([STORAGE_KEYS.CLIPS, STORAGE_KEYS.SEARCH_ONLY_CLIPS]);
    let clips = normalizeArray(result[STORAGE_KEYS.CLIPS]);
    let searchOnlyClips = normalizeArray(result[STORAGE_KEYS.SEARCH_ONLY_CLIPS]);

    const safeMeta = sanitizeClipMeta(meta);
    const timestamp = Date.now();
    
    // Local ID for immediate use - will be replaced by server UUID on sync
    // Format: timestamp_random to be unique locally
    const localId = `${timestamp}_${Math.random().toString(36).slice(2, 10)}`;
    
    const newClip = {
      id: localId,
      text: String(text),
      category: String(category),
      timestamp,
      ...(safeMeta ? { meta: safeMeta } : {})
    };

    // Category limit enforcement (Uncategorized = unlimited, others = 150 max)
    if (category !== DEFAULT_CATEGORY) {
      const activeClipsInCategory = clips.filter(c => c.category === category);
      
      if (activeClipsInCategory.length >= LIMITS.MAX_CLIPS_PER_CATEGORY) {
        // Find oldest clip in category and archive it
        let oldestIdx = -1;
        let oldestTimestamp = Infinity;
        
        clips.forEach((clip, idx) => {
          if (clip.category === category && clip.timestamp < oldestTimestamp) {
            oldestTimestamp = clip.timestamp;
            oldestIdx = idx;
          }
        });
        
        if (oldestIdx !== -1) {
          const [archived] = clips.splice(oldestIdx, 1);
          searchOnlyClips.unshift(archived);
        }
      }
    }

    // Add new clip at start
    clips.unshift(newClip);

    // Enforce max active clips limit
    if (clips.length > LIMITS.MAX_ACTIVE_CLIPS) {
      clips.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      const overflow = clips.splice(LIMITS.MAX_ACTIVE_CLIPS);
      searchOnlyClips.unshift(...overflow);
    }

    // Enforce max archived clips limit
    if (searchOnlyClips.length > LIMITS.MAX_ARCHIVED_CLIPS) {
      searchOnlyClips.splice(LIMITS.MAX_ARCHIVED_CLIPS);
    }

    // Persist
    await setStorageItems({
      [STORAGE_KEYS.CLIPS]: clips,
      [STORAGE_KEYS.SEARCH_ONLY_CLIPS]: searchOnlyClips
    });
    await touchLocalUpdatedAt();

    // Broadcast to all tabs
    broadcastToAllTabs({
      action: MESSAGE_TYPES.CLIP_SAVED,
      clip: newClip,
      autoShow
    });

    // Also notify popup
    try {
      chrome.runtime.sendMessage({
        action: MESSAGE_TYPES.CLIP_SAVED,
        clip: newClip,
        autoShow
      }).catch(() => {});
    } catch (_) {}

    console.log('[ClipHandler] Saved clip:', newClip.id);
    return { success: true, clip: newClip };

  } catch (error) {
    console.error('[ClipHandler] Save error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a clip by ID
 * @param {string} clipId - Clip ID to delete
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function deleteClip(clipId) {
  if (!clipId) {
    return { success: false, error: 'Invalid clip ID' };
  }

  try {
    const result = await getStorageItems([STORAGE_KEYS.CLIPS, STORAGE_KEYS.SEARCH_ONLY_CLIPS]);
    let clips = normalizeArray(result[STORAGE_KEYS.CLIPS]);
    let searchOnlyClips = normalizeArray(result[STORAGE_KEYS.SEARCH_ONLY_CLIPS]);

    const initialLength = clips.length + searchOnlyClips.length;
    clips = clips.filter(c => c.id !== clipId);
    searchOnlyClips = searchOnlyClips.filter(c => c.id !== clipId);

    if (clips.length + searchOnlyClips.length === initialLength) {
      return { success: false, error: 'Clip not found' };
    }

    await setStorageItems({
      [STORAGE_KEYS.CLIPS]: clips,
      [STORAGE_KEYS.SEARCH_ONLY_CLIPS]: searchOnlyClips
    });
    await touchLocalUpdatedAt();

    broadcastToAllTabs({ action: MESSAGE_TYPES.CLIPS_UPDATED });

    return { success: true };

  } catch (error) {
    console.error('[ClipHandler] Delete error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Paste clip into active element (via scripting)
 * @param {number} tabId - Tab ID
 * @param {string} text - Text to paste
 */
export async function pasteToTab(tabId, text) {
  if (!tabId || !text) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (pasteText) => {
        const el = document.activeElement;
        if (!el) return;
        
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          const start = el.selectionStart || 0;
          const end = el.selectionEnd || 0;
          el.value = el.value.substring(0, start) + pasteText + el.value.substring(end);
          el.selectionStart = el.selectionEnd = start + pasteText.length;
        } else if (el.isContentEditable) {
          document.execCommand('insertText', false, pasteText);
        }
        el.focus();
      },
      args: [text]
    });
  } catch (error) {
    console.error('[ClipHandler] Paste error:', error);
  }
}

/**
 * Get clips from storage
 * @param {boolean} includeArchived - Include archived clips
 * @returns {Promise<{ clips: Array, archived: Array }>}
 */
export async function getClips(includeArchived = false) {
  const result = await getStorageItems([STORAGE_KEYS.CLIPS, STORAGE_KEYS.SEARCH_ONLY_CLIPS]);
  const clips = normalizeArray(result[STORAGE_KEYS.CLIPS]);
  const archived = includeArchived ? normalizeArray(result[STORAGE_KEYS.SEARCH_ONLY_CLIPS]) : [];
  return { clips, archived };
}
