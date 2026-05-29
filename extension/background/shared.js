// PasteCraft Background Script

import { filterTombstonedClips, loadDeletedClipIdSets } from '../shared/clip-tombstones.js';

export function isRepoLoaderBuild() {
  try {
    const mf = chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest() : null;
    const name = mf && mf.name ? String(mf.name) : '';
    const desc = mf && mf.description ? String(mf.description) : '';
    return (
      name.includes('Repo Loader') ||
      desc.includes('repo root') ||
      desc.includes('Actual extension lives in /extension')
    );
  } catch (_) {
    return false;
  }
}

export function getExtensionPageUrl(pagePath) {
  const raw = String(pagePath || '').trim();
  const path = raw.startsWith('extension/') || !isRepoLoaderBuild() ? raw : `extension/${raw}`;
  return chrome.runtime.getURL(path);
}

export function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export async function safeTabsSendMessage(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch (_) {
    return false;
  }
}

export async function getAppOpenMode() {
  try {
    const { widgetSettings = {} } = await chrome.storage.local.get(['widgetSettings']);
    const v = widgetSettings && typeof widgetSettings.appOpenMode === 'string' ? widgetSettings.appOpenMode : 'inPage';
    return v === 'edgePopup' ? 'edgePopup' : 'inPage';
  } catch (_) {
    return 'inPage';
  }
}

export function hashTextForQuickView(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function normalizeQuickViewClip(clip, index, source) {
  if (typeof clip === 'string') {
    const timestamp = Date.now();
    return {
      id: `${timestamp}_${hashTextForQuickView(clip)}_${index}`,
      text: clip,
      category: 'Uncategorized',
      timestamp,
      source
    };
  }

  if (!clip || typeof clip !== 'object') return null;
  const text = clip.text ?? clip;
  if (!text) return null;
  const timestamp = typeof clip.timestamp === 'number' ? clip.timestamp : Date.now();
  const id = clip.id ?? clip.clip_id ?? clip.clipId ?? `${timestamp}_${hashTextForQuickView(text)}_${index}`;

  return {
    ...clip,
    id: String(id),
    text: String(text),
    category: clip.category || 'Uncategorized',
    timestamp,
    source
  };
}

export async function readIndexedDbPayloads(storeName) {
  if (typeof indexedDB === 'undefined') return [];

  return new Promise((resolve) => {
    const request = indexedDB.open('pastecraft_local_v1', 1);
    request.onerror = () => {
      resolve([]);
    };
    request.onupgradeneeded = () => {
      try { request.transaction.abort(); } catch (_) {}
      resolve([]);
    };
    request.onsuccess = () => {
      const db = request.result;
      try {
        if (!db.objectStoreNames.contains(storeName)) {
          db.close();
          resolve([]);
          return;
        }

        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const getAll = store.getAll();
        getAll.onsuccess = () => {
          const records = Array.isArray(getAll.result) ? getAll.result : [];
          db.close();
          resolve(records.map((record) => record && record.payload).filter(Boolean));
        };
        getAll.onerror = () => {
          db.close();
          resolve([]);
        };
      } catch (_) {
        try { db.close(); } catch (_) {}
        resolve([]);
      }
    };
  });
}

export async function getQuickViewClips() {
  const [storage, idbClips, deletedIds] = await Promise.all([
    chrome.storage.local.get(['clips', 'searchOnlyClips']),
    readIndexedDbPayloads('clips'),
    loadDeletedClipIdSets(),
  ]);

  const localActive = filterTombstonedClips(
    Array.isArray(storage?.clips) ? storage.clips : [],
    deletedIds.active,
  );
  const idbFiltered = filterTombstonedClips(
    Array.isArray(idbClips) ? idbClips : [],
    deletedIds.active,
  );
  const active = idbFiltered.length > 0 ? idbFiltered : localActive;
  const archived = filterTombstonedClips(
    Array.isArray(storage?.searchOnlyClips) ? storage.searchOnlyClips : [],
    deletedIds.archived,
  );

  const merged = [
    ...active.map((clip, index) => normalizeQuickViewClip(clip, index, 'active')).filter(Boolean),
    ...archived
      .map((clip, index) => normalizeQuickViewClip(clip, index, 'archived'))
      .filter(Boolean)
      .map((clip) => ({ ...clip, archived: true }))
  ];

  merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || String(b.id).localeCompare(String(a.id)));
  return merged.slice(0, 200);
}

export async function openAppPopupWindow() {
  const url = getExtensionPageUrl('popup.html');
  return chrome.windows.create({
    url,
    type: 'popup',
    width: 520,
    height: 760,
    focused: true
  });
}

// Force create context menus immediately
export async function createContextMenus() {
  // Clear all existing menus first
  chrome.contextMenus.removeAll(() => {
    // Create separate menu items instead of parent-child structure
    // This approach is more reliable across different Chrome versions
    
    chrome.contextMenus.create({
      id: 'pastecraft-separator-1',
      type: 'separator',
      contexts: ['selection', 'editable', 'page']
    });
    
    chrome.contextMenus.create({
      id: 'copy-to-quick-save',
      title: '📋 Copy to PasteCraft',
      contexts: ['selection', 'editable', 'page']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('❌ Copy to PasteCraft menu failed:', chrome.runtime.lastError);
      }
    });

    chrome.contextMenus.create({
      id: 'copy-image-to-pastecraft',
      title: '🖼️ Copy Image to PasteCraft',
      contexts: ['image']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('❌ Copy Image to PasteCraft menu failed:', chrome.runtime.lastError);
      }
    });

    chrome.contextMenus.create({
      id: 'copy-image-link-to-pastecraft',
      title: '🔗 Copy Image Link to PasteCraft',
      contexts: ['image']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('❌ Copy Image Link to PasteCraft menu failed:', chrome.runtime.lastError);
      }
    });
    
    chrome.contextMenus.create({
      id: 'view-quick-saved-clips',
      title: '📋 View Quick Menu',
      contexts: ['selection', 'editable', 'page']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('❌ View Quick Menu failed:', chrome.runtime.lastError);
      }
    });
    
    chrome.contextMenus.create({
      id: 'pastecraft-separator-2',
      type: 'separator',
      contexts: ['selection', 'editable', 'page']
    });
  });
}

// Storage schema version + migration registry.
// See .cursor/rules/production-publishing-safety.mdc Sections D and E.
const SCHEMA_VERSION = 1;
const SCHEMA_VERSION_KEY = '__schemaVersion';
const migrations = {
  // Example: 1: async () => { /* migrate from v1 to v2 */ }
};

export async function runStorageMigrations(previousVersion) {
  try {
    const stored = await chrome.storage.local.get(SCHEMA_VERSION_KEY);
    const from = typeof stored[SCHEMA_VERSION_KEY] === 'number' ? stored[SCHEMA_VERSION_KEY] : 0;
    if (from >= SCHEMA_VERSION) {
      return { ok: true, from, to: SCHEMA_VERSION, ran: [] };
    }
    const ran = [];
    for (let v = from; v < SCHEMA_VERSION; v++) {
      const step = migrations[v];
      if (typeof step === 'function') {
        await step();
        ran.push(v);
      }
    }
    await chrome.storage.local.set({ [SCHEMA_VERSION_KEY]: SCHEMA_VERSION });
    console.log(`[migration] ok previousVersion=${previousVersion || 'unknown'} from=${from} to=${SCHEMA_VERSION} ran=${JSON.stringify(ran)}`);
    return { ok: true, from, to: SCHEMA_VERSION, ran };
  } catch (e) {
    // Never wipe local data on failure. Flag cloud re-hydration via Supabase on next login.
    console.error('[migration] failed — will fall back to cloud rehydrate on next login', e);
    try {
      await chrome.storage.local.set({ __migrationFailed: true, __migrationFailedAt: Date.now() });
    } catch (_) {}
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  createContextMenus();
  if (details.reason === 'install') {
    console.log('🎉 PasteCraft installed — welcome!');
    try {
      await chrome.storage.local.set({ [SCHEMA_VERSION_KEY]: SCHEMA_VERSION });
    } catch (_) {}
    return;
  }
  if (details.reason === 'update') {
    console.log('✅ PasteCraft updated — user data preserved (chrome.storage.local, chrome.storage.sync, IndexedDB intact).');
    await runStorageMigrations(details.previousVersion);
  }
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenus();
});

// Force create immediately
createContextMenus();

// Handle extension icon click - open slide-in panel instead of popup
chrome.action.onClicked.addListener(async (tab) => {
  try {
    const mode = await getAppOpenMode();
    if (mode === 'edgePopup') {
      console.log('🎨 Extension icon clicked, opening popup window');
      await openAppPopupWindow();
      return;
    }

    console.log('🎨 Extension icon clicked, opening slide-in panel');
    await chrome.tabs.sendMessage(tab.id, { action: 'openPopupPanel' });
  } catch (error) {
    console.error('❌ Could not open PasteCraft UI:', error);
    // Fallback: open separate window if in-page injection is blocked (e.g. browser internal pages)
    try {
      await openAppPopupWindow();
    } catch (_) {}
  }
});

// Handle menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('🖱️ Context menu clicked:', info.menuItemId);
  const tabId = tab && Number.isFinite(tab.id) ? tab.id : null;
  const tabUrl = tab && tab.url ? String(tab.url) : '';
  
  if (info.menuItemId === 'pastecraft-main') {
    // Main menu clicked - show appropriate action based on context
    if (info.selectionText) {
      // If text is selected, save it (but don't auto-show since we explicitly show below)
      await saveTextDirectly(info.selectionText, 'Uncategorized', false);
    }
    // Always show Quick Paste interface
    if (tabId != null) {
      await safeTabsSendMessage(tabId, {
        action: 'showQuickPaste',
        x: info.pageX || 100,
        y: info.pageY || 100
      });
    }
    
  } else if (info.menuItemId === 'copy-to-quick-save') {
    console.log('🖱️ Copy to PasteCraft clicked - selectionText:', info.selectionText);
    
    if (info.selectionText && info.selectionText.trim().length > 0) {
      // Save directly to Quick Save (Uncategorized) without auto-showing interface
      await saveTextDirectly(info.selectionText, 'Uncategorized', false); // false = don't auto-show
      
      // Don't show Quick Paste interface - user just wants to save
      console.log('✅ Text saved to PasteCraft (no UI shown)');
    } else {
      // No text selected - show feedback message
      console.log('⚠️ Copy to PasteCraft clicked but no text selected or empty');
    }
    
  } else if (info.menuItemId === 'view-quick-saved-clips') {
    // Show Quick Paste interface for viewing/pasting clips
    const ok = tabId != null
      ? await safeTabsSendMessage(tabId, {
          action: 'showQuickPaste',
          x: info.pageX || 100,
          y: info.pageY || 100
        })
      : false;
    
    if (!ok) {
      console.error('❌ Could not show Quick Paste interface: content script not available');
      
      // Check if this is a restricted page (browser internal pages)
      if (tabUrl.startsWith('edge://') || tabUrl.startsWith('chrome://') || tabUrl.startsWith('moz-extension://')) {
        // Fallback: Open extension popup instead
        chrome.action.openPopup().catch(() => {
          console.log('Could not open popup. Navigate to a regular webpage.');
        });
        return;
      }
      
      // Try to inject content script manually if it's not loaded
      if (tabId != null) {
        chrome.scripting.executeScript({
          target: { tabId },
          files: ['content-script.js']
        }).then(() => {
          // Try sending message again after injection
          setTimeout(() => {
            safeTabsSendMessage(tabId, {
              action: 'showQuickPaste',
              x: info.pageX || 100,
              y: info.pageY || 100
            }).catch(() => {});
          }, 500);
        }).catch((injectError) => {
          console.error('❌ Failed to inject content script:', injectError);
        });
      }
    }
    
  } else if (info.menuItemId === 'copy-image-to-pastecraft' || info.menuItemId === 'copy-image-link-to-pastecraft') {
    const srcUrl = (info && info.srcUrl) ? String(info.srcUrl) : '';
    if (!srcUrl) {
      console.log('⚠️ Copy image clicked but srcUrl missing');
      return;
    }

    const sourcePageUrl = (tab && tab.url) ? String(tab.url) : '';
    const capturedAt = Date.now();

    // IMPORTANT:
    // - "Copy Image Link" should behave like a URL clip (copy/paste shows a URL, not an image).
    // - "Copy Image" should behave like an image clip (previewable in Clips).
    const meta = (info.menuItemId === 'copy-image-link-to-pastecraft')
      ? {
          kind: 'url',
          plainText: srcUrl,
          html: '',
          url: srcUrl,
          sourcePageUrl,
          capturedAt
        }
      : {
          kind: 'image',
          plainText: '',
          html: '',
          url: '',
          image: { mime: '', dataUrl: '', srcUrl },
          sourcePageUrl,
          capturedAt
        };

    await saveTextDirectly(srcUrl, 'Uncategorized', false, meta);
    console.log('✅ Image copied to PasteCraft:', srcUrl);

  } else if (info.menuItemId.startsWith('paste-')) {
    // Legacy paste functionality (if needed)
    const clipIndex = parseInt(info.menuItemId.replace('paste-', ''));
    await pasteClip(clipIndex, tab);
  }
});

// Paste function
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

// Removed updatePasteMenu - using Quick Paste interface instead

// Removed old saveText function - using saveTextDirectly instead

export function sanitizeClipMeta(meta) {
  if (!meta || typeof meta !== 'object') return null;

  const MAX_TEXT = 30000;
  const MAX_HTML = 50000;
  const MAX_DATAURL_CHARS = 900000; // ~900KB of base64-ish chars

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

  if (meta.image && typeof meta.image === 'object') {
    const img = {};
    if (meta.image.mime != null) img.mime = trim(meta.image.mime, 128);
    if (meta.image.srcUrl != null) img.srcUrl = trim(meta.image.srcUrl, 4000);
    if (meta.image.dataUrl != null) {
      const du = String(meta.image.dataUrl || '');
      img.dataUrl = du.length <= MAX_DATAURL_CHARS ? du : '';
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
      // drop heavy fields first
      if (out.html) out.html = trim(out.html, 8000);
      if (out.image && out.image.dataUrl) out.image.dataUrl = '';
      const json2 = JSON.stringify(out);
      if (json2.length > 140000) return null;
    }
  } catch (_) {
    return null;
  }

  return out;
}

export async function saveTextDirectly(text, category = 'Uncategorized', autoShow = true, meta = null) {
  // Keep logs lightweight (this runs in a service worker).
  console.log('📝 Saving clip:', {
    category,
    autoShow,
    preview: text ? (text.substring(0, 50) + '...') : 'EMPTY'
  });
  
  // Safety check: Don't save empty/undefined text
  if (!text || text.trim().length === 0) {
    console.log('⚠️ Attempted to save empty/undefined text - ABORTED');
    return;
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
  
  const safeMeta = sanitizeClipMeta(meta);
  const newClip = {
    id: Date.now() + Math.random(),
    text: text,
    category: category,
    timestamp: Date.now(),
    ...(safeMeta ? { meta: safeMeta } : {})
  };
  
  console.log('📦 New clip id:', newClip.id);
  
  // Check category limit (Uncategorized = unlimited, others = 150 max per category in ACTIVE storage)
  if (category !== 'Uncategorized') {
    const activeClipsInCategory = clips.filter(clip => clip.category === category);
    
    if (activeClipsInCategory.length >= 150) {
      console.log(`⚠️ Category "${category}" is at limit (150 clips). Moving oldest to archive...`);
      
      // Find ACTUAL oldest clip in this category by timestamp and move to search-only storage
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
  }
  
  clips.unshift(newClip);
  console.log('📊 Clips count (active):', clips.length);
  
  // Pagination system: enforce 500 clip limit (50 pages × 10 clips)
  const maxClips = 500;
  if (clips.length > maxClips) {
    // Sort by timestamp (newest first)
    clips.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    const overflowClips = clips.splice(maxClips);
    searchOnlyClips.unshift(...overflowClips);
    
    // Keep search storage reasonable (max 1000 total archived clips)
    if (searchOnlyClips.length > 1000) {
      searchOnlyClips.splice(1000);
    }
    
    console.log(`📦 Pagination: Moved ${overflowClips.length} clips beyond limit (${maxClips}) to searchOnlyClips`);
  }
  
  try {
    await chrome.storage.local.set({ clips, searchOnlyClips, pc_local_updatedAt: Date.now() });
  } catch (error) {
    throw error;
  }

  console.log('✅ Saved to local storage:', { active: clips.length, archived: searchOnlyClips.length });
  
  // Notify content scripts and popup about new clip
  try {
    // Notify all tabs (content scripts)
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'clipSaved',
          clip: newClip,
          autoShow: autoShow // Pass the autoShow flag
        }).catch(() => {}); // Ignore errors for tabs without content script
      });
    });
    
    // Also notify popup via runtime messaging
    chrome.runtime.sendMessage({
      action: 'clipSaved',
      clip: newClip,
      autoShow: autoShow
    }).catch(() => {
      // Popup might not be open, that's OK
      console.log('Popup not open, skipping runtime message');
    });
  } catch (error) {
    console.log('Could not notify about new clip:', error);
  }
  
  console.log('💾 ✅ SAVE COMPLETE - Saved text to', category + ':', text ? (text.substring(0, 30) + '...') : 'NO TEXT');
}

// =====================================================
