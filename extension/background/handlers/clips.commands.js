/**
 * @forward-slice Clips Command objects: sanitize / save / paste.
 * Invoked by clips.handler (Mediator) and menus.handler (context menu).
 */

import { peelImageDataUrlFromMeta, putClipImage, takePendingClipImage, clearPendingClipImage, pcDebugAf03f9 } from '../../shared/clip-images.js';
import { syncClipsToIndexedDb } from '../quickview/quickview.idb.js';
import { normalizeArray } from './bg-utils.js';

async function enqueueClipSyncOperation(clips) {
  const payload = Array.isArray(clips) ? clips : [];
  if (payload.length === 0) return;

  try {
    const result = await chrome.storage.local.get(['syncQueue']);
    const queue = Array.isArray(result?.syncQueue) ? result.syncQueue : [];
    queue.push({
      type: 'syncClips',
      data: payload,
      timestamp: Date.now(),
      id: Date.now() + Math.random(),
    });
    await chrome.storage.local.set({ syncQueue: queue });
  } catch (error) {
    console.warn('⚠️ Failed to enqueue clip sync:', error?.message || error);
  }
}

export function sanitizeClipMeta(meta) {
  if (!meta || typeof meta !== 'object') return null;

  const MAX_TEXT = 30000;
  const MAX_HTML = 50000;

  const trim = (s, max) => {
    const str = String(s ?? '');
    if (str.length <= max) return str;
    return str.slice(0, max) + '…';
  };

  const out = {};
  const kind = typeof meta.kind === 'string' ? meta.kind : 'text';
  out.kind = kind;

  if (meta.plainText != null) out.plainText = trim(meta.plainText, MAX_TEXT);
  if (meta.html != null) out.html = trim(meta.html, MAX_HTML);
  if (meta.url != null) out.url = trim(meta.url, 4000);
  if (meta.sourcePageUrl != null) out.sourcePageUrl = trim(meta.sourcePageUrl, 4000);
  if (typeof meta.capturedAt === 'number') out.capturedAt = meta.capturedAt;
  if (typeof meta.captureSource === 'string' && meta.captureSource.trim()) {
    out.captureSource = trim(meta.captureSource, 64);
  }

  if (meta.image && typeof meta.image === 'object') {
    const img = {};
    if (meta.image.mime != null) img.mime = trim(meta.image.mime, 128);
    if (meta.image.srcUrl != null) img.srcUrl = trim(meta.image.srcUrl, 4000);
    // Never embed large dataUrls in clip.meta — side-store via putClipImage.
    // Tiny thumbnails under the soft cap may stay inline for quick preview.
    if (meta.image.dataUrl != null) {
      const du = String(meta.image.dataUrl || '');
      if (du && du.length <= 12000 && du.startsWith('data:image/')) {
        img.dataUrl = du;
      }
      if (du.startsWith('data:image/')) img.hasImage = true;
      else if (du) img.tooLarge = true;
    }
    if (meta.image.hasImage === true) img.hasImage = true;
    if (typeof meta.image.size === 'number') img.size = meta.image.size;
    if (meta.image.tooLarge === true) img.tooLarge = true;
    if (meta.image.exportFailed === true) img.exportFailed = true;
    out.image = img;
  }

  // Ensure we don't persist a huge object
  try {
    const json = JSON.stringify(out);
    if (json.length > 140000) {
      // drop heavy fields first
      if (out.html) out.html = trim(out.html, 8000);
      if (out.image && out.image.dataUrl) {
        out.image.hasImage = true;
        out.image.dataUrl = '';
      }
      const json2 = JSON.stringify(out);
      if (json2.length > 140000) return null;
    }
  } catch (_) {
    return null;
  }

  return out;
}

export async function pasteClip(index, tab) {
  const result = await chrome.storage.local.get(['clips']);
  const clips = normalizeArray(result?.clips);
  const clip = clips[index];

  if (!clip) return;

  try {
    const tabId = tab && Number.isFinite(tab.id) ? tab.id : null;
    if (tabId == null) return;
    await chrome.scripting.executeScript({
      target: { tabId },
      function: (text) => {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
          if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
            const start = activeElement.selectionStart;
            const end = activeElement.selectionEnd;
            activeElement.value = activeElement.value.substring(0, start) + text + activeElement.value.substring(end);
            activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
          } else {
            document.execCommand('insertText', false, text);
          }
          activeElement.focus();
        }
      },
      args: [clip.text || clip]
    });

    console.log('📋 Pasted:', (clip.text || clip).substring(0, 30) + '...');
  } catch (error) {
    console.error('❌ Paste failed:', error);
  }
}

function archiveOldestInCategory(clips, searchOnlyClips, category) {
  const activeClipsInCategory = clips.filter((clip) => clip.category === category);
  if (activeClipsInCategory.length < 150) return;

  console.log(`⚠️ Category "${category}" is at limit (150 clips). Moving oldest to archive...`);

  let oldestClip = null;
  let oldestClipIndex = -1;
  let oldestTimestamp = Infinity;

  clips.forEach((clip, index) => {
    if (clip.category === category && clip.timestamp < oldestTimestamp) {
      oldestTimestamp = clip.timestamp;
      oldestClip = clip;
      oldestClipIndex = index;
    }
  });

  if (oldestClipIndex !== -1) {
    clips.splice(oldestClipIndex, 1);
    searchOnlyClips.unshift(oldestClip);
    console.log('📦 Moved ACTUAL oldest clip to archive (timestamp:', oldestClip.timestamp + '):', oldestClip.text ? (oldestClip.text.substring(0, 30) + '...') : 'NO TEXT');
  }
}

function enforceActiveClipCap(clips, searchOnlyClips) {
  const maxClips = 500;
  if (clips.length <= maxClips) return;

  clips.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const overflowClips = clips.splice(maxClips);
  searchOnlyClips.unshift(...overflowClips);

  if (searchOnlyClips.length > 1000) {
    searchOnlyClips.splice(1000);
  }

  console.log(`📦 Pagination: Moved ${overflowClips.length} clips beyond limit (${maxClips}) to searchOnlyClips`);
}

function notifyClipSaved(newClip, autoShow) {
  try {
    chrome.tabs.query({}, (tabs) => {
      normalizeArray(tabs).forEach((tab) => {
        const tabId = tab && Number.isFinite(tab.id) ? tab.id : null;
        if (tabId == null) return;
        chrome.tabs.sendMessage(tabId, {
          action: 'clipSaved',
          clip: newClip,
          autoShow,
        }).catch(() => {});
      });
    });

    chrome.runtime.sendMessage({
      action: 'clipSaved',
      clip: newClip,
      autoShow,
    }).catch(() => {});
  } catch (error) {
    console.log('Could not notify about new clip:', error);
  }
}

export async function saveTextDirectly(text, category = 'Uncategorized', autoShow = true, meta = null, pendingImageKey = '') {
  // Keep logs lightweight (this runs in a service worker).
  console.log('📝 Saving clip:', {
    category,
    autoShow,
    preview: text ? (text.substring(0, 50) + '...') : 'EMPTY'
  });

  // Safety check: Don't save empty/undefined text
  if (!text || text.trim().length === 0) {
    console.log('⚠️ Attempted to save empty/undefined text - ABORTED');
    throw new Error('empty_text');
  }

  const result = await chrome.storage.local.get(['clips', 'searchOnlyClips']);

  let clips;
  let searchOnlyClips;
  try {
    clips = normalizeArray(result?.clips);
    searchOnlyClips = normalizeArray(result?.searchOnlyClips);
  } catch (error) {
    throw error;
  }

  const peeled = peelImageDataUrlFromMeta(meta);
  const safeMeta = sanitizeClipMeta(peeled.meta);
  const now = Date.now();
  const newClip = {
    id: now + Math.random(),
    text: text,
    category: category,
    timestamp: now,
    updatedAt: now,
    ...(safeMeta ? { meta: safeMeta } : {})
  };

  let imageDataUrl = peeled.dataUrl;
  let imageMime = peeled.mime;
  if (!imageDataUrl && pendingImageKey) {
    try {
      const pending = await takePendingClipImage(pendingImageKey);
      // #region agent log
      await pcDebugAf03f9('H6', 'clips.commands.js:saveTextDirectly', 'pending image take', {
        pendingKeySuffix: String(pendingImageKey).slice(-20),
        found: !!(pending?.dataUrl),
        dataUrlLen: pending?.dataUrl ? pending.dataUrl.length : 0,
      });
      // #endregion
      if (pending?.dataUrl) {
        imageDataUrl = pending.dataUrl;
        imageMime = pending.mime;
      }
    } catch (err) {
      // #region agent log
      await pcDebugAf03f9('H6', 'clips.commands.js:saveTextDirectly', 'pending image take failed', {
        error: String(err?.message || err).slice(0, 120),
      });
      // #endregion
    }
  }

  if (imageDataUrl) {
    try {
      await putClipImage(newClip.id, imageDataUrl, imageMime);
      if (!newClip.meta || typeof newClip.meta !== 'object') newClip.meta = { kind: 'image' };
      if (!newClip.meta.image || typeof newClip.meta.image !== 'object') newClip.meta.image = {};
      newClip.meta.image.hasImage = true;
      delete newClip.meta.image.dataUrl;
      delete newClip.meta.image.tooLarge;
    } catch (imgErr) {
      console.warn('[saveTextDirectly] clip image store failed:', imgErr?.message || imgErr);
      if (newClip.meta?.image) newClip.meta.image.tooLarge = true;
    }
    await clearPendingClipImage(pendingImageKey);
  }

  console.log('📦 New clip id:', newClip.id);

  // Check category limit (Uncategorized = unlimited, others = 150 max per category in ACTIVE storage)
  if (category !== 'Uncategorized') {
    archiveOldestInCategory(clips, searchOnlyClips, category);
  }

  clips.unshift(newClip);
  console.log('📊 Clips count (active):', clips.length);

  // Pagination system: enforce 500 clip limit (50 pages × 10 clips)
  enforceActiveClipCap(clips, searchOnlyClips);

  try {
    await chrome.storage.local.set({ clips, searchOnlyClips, pc_local_updatedAt: Date.now() });
  } catch (error) {
    throw error;
  }

  // Respond to callers before slow/non-critical work (MV3 message port + IndexedDB).
  void syncClipsToIndexedDb(clips).catch((err) => {
    console.warn('[saveTextDirectly] IndexedDB sync deferred failure:', err?.message || err);
  });
  void enqueueClipSyncOperation([newClip]);

  console.log('✅ Saved to local storage:', { active: clips.length, archived: searchOnlyClips.length });

  notifyClipSaved(newClip, autoShow);

  console.log('💾 ✅ SAVE COMPLETE - Saved text to', category + ':', text ? (text.substring(0, 30) + '...') : 'NO TEXT');
}
