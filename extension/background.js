// PasteCraft Background Script

function isRepoLoaderBuild() {
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

function getExtensionPageUrl(pagePath) {
  const raw = String(pagePath || '').trim();
  const path = raw.startsWith('extension/') || !isRepoLoaderBuild() ? raw : `extension/${raw}`;
  return chrome.runtime.getURL(path);
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

async function getAppOpenMode() {
  try {
    const { widgetSettings = {} } = await chrome.storage.local.get(['widgetSettings']);
    const v = widgetSettings && typeof widgetSettings.appOpenMode === 'string' ? widgetSettings.appOpenMode : 'inPage';
    return v === 'edgePopup' ? 'edgePopup' : 'inPage';
  } catch (_) {
    return 'inPage';
  }
}

async function openAppPopupWindow() {
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
async function createContextMenus() {
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

// Multiple trigger points for menu creation
chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();
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
async function pasteClip(index, tab) {
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

function sanitizeClipMeta(meta) {
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

async function saveTextDirectly(text, category = 'Uncategorized', autoShow = true, meta = null) {
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
// EXTERNAL MESSAGE LISTENER (Password Reset from Web)
// =====================================================
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  // Never log secrets from external pages.
  const senderUrl = sender && sender.url ? String(sender.url) : '';
  let senderOrigin = '';
  try { senderOrigin = senderUrl ? (new URL(senderUrl)).origin : ''; } catch (_) { senderOrigin = ''; }
  console.log('📨 External message received:', {
    type: message?.type,
    from: senderOrigin,
    hasAccessToken: !!message?.access_token
  });

  const allowedOrigin = 'https://auth.pastecraft.com';
  if (senderOrigin !== allowedOrigin) {
    sendResponse({ success: false, error: 'unauthorized_origin' });
    return false;
  }
  
  // Strict schema check
  const type = message && typeof message.type === 'string' ? message.type : '';

  // Handle OAuth sign-in from website callback
  if (type === 'oauth_signin') {
    const accessToken = message && typeof message.access_token === 'string' ? message.access_token : '';
    const refreshToken = message && typeof message.refresh_token === 'string' ? message.refresh_token : '';

    if (!accessToken || accessToken.length > 4096 || (refreshToken && refreshToken.length > 4096)) {
      sendResponse({ success: false, error: 'invalid_payload' });
      return false;
    }

    // Store OAuth tokens for the popup to pick up on next open
    chrome.storage.local.set({
      oauth_callback: {
        access_token: accessToken,
        refresh_token: refreshToken,
        timestamp: Date.now()
      }
    }, () => {
      console.log('✅ OAuth tokens stored from website callback');
      sendResponse({ success: true });
    });
    return true; // keep channel open for async sendResponse
  }

  if (type === 'password_reset') {
    const accessToken = message && typeof message.access_token === 'string' ? message.access_token : '';
    const refreshToken = message && typeof message.refresh_token === 'string' ? message.refresh_token : '';
    const state = message && typeof message.state === 'string' ? message.state : '';

    if (!accessToken || accessToken.length > 4096 || (refreshToken && refreshToken.length > 4096) || (state && state.length > 256)) {
      sendResponse({ success: false, error: 'invalid_payload' });
      return false;
    }

    // Require one-time state match (prevents any allowed origin page from blindly injecting tokens).
    chrome.storage.local.get(['pc_password_reset_state_v1'], (res) => {
      const expected = res && res.pc_password_reset_state_v1 ? res.pc_password_reset_state_v1 : null;
      const expectedState = expected && typeof expected.state === 'string' ? expected.state : '';
      const createdAt = expected && typeof expected.createdAt === 'number' ? expected.createdAt : 0;
      const isFresh = !!createdAt && (Date.now() - createdAt) < (2 * 60 * 60 * 1000); // 2h

      if (!state || !expectedState || !isFresh || state !== expectedState) {
        sendResponse({ success: false, error: 'state_mismatch' });
        return;
      }

      // Consume the state so it can't be replayed.
      chrome.storage.local.remove(['pc_password_reset_state_v1'], () => {
        // Store the reset tokens for the extension's reset UI.
        chrome.storage.local.set({
          password_reset_callback: {
            access_token: accessToken,
            refresh_token: refreshToken,
            type: 'recovery',
            timestamp: Date.now()
          }
        }, () => {
          sendResponse({ success: true });
        });
      });
    });

    return true; // Keep message channel open for async response
  }
  
  sendResponse({ success: false, error: 'Unknown message type' });
});

// =====================================================
// INTERNAL MESSAGE LISTENER (Content Script Messages)
// =====================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Internal message received:', message.action);

  if (message.action === 'pcOpenPopupWindow') {
    try {
      const url = message && typeof message.url === 'string' ? message.url : '';
      const page = message && typeof message.page === 'string' ? message.page : '';
      const width = Number.isFinite(message?.width) ? Math.max(200, Math.round(message.width)) : 980;
      const height = Number.isFinite(message?.height) ? Math.max(200, Math.round(message.height)) : 720;

      const finalUrl = url || (page ? getExtensionPageUrl(page) : '');
      if (!finalUrl) {
        sendResponse({ success: false, error: 'missing_url' });
        return false;
      }

      chrome.windows.create({ url: finalUrl, type: 'popup', width, height, focused: true }, () => {
        const err = chrome.runtime.lastError;
        if (err) {
          sendResponse({ success: false, error: err.message || String(err) });
        } else {
          sendResponse({ success: true });
        }
      });
      return true; // async sendResponse
    } catch (e) {
      sendResponse({ success: false, error: e?.message || String(e) });
      return false;
    }
  }
  
  if (message.action === 'pcFetchEdgeFunction') {
    // Proxy fetch to avoid page-level CORS/network issues in content scripts.
    // Allowlist only Supabase Edge Functions we expect.
    (async () => {
      try {
        const url = String(message.url || '');
        const method = String(message.method || 'POST').toUpperCase();
        const accessToken = String(message.accessToken || '');
        const body = message.body ?? null;

        if (!url || !/^https:\/\/.+\.supabase\.co\/functions\/v1\/(ai-hint|ai-trends)(\b|\/|$)/i.test(url)) {
          sendResponse({ success: false, status: 400, error: 'Blocked URL' });
          return;
        }

        const headers = {
          'Content-Type': 'application/json',
        };
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const resp = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        const status = resp.status;
        const ok = resp.ok;
        const data = await resp.json().catch(() => ({}));

        sendResponse({ success: true, ok, status, data });
      } catch (error) {
        sendResponse({ success: false, status: 0, error: error?.message || String(error) });
      }
    })();

    return true; // Keep message channel open for async response
  }

  if (message.action === 'pcRefreshSupabaseToken') {
    (async () => {
      try {
        const supabaseUrl = String(message.supabaseUrl || '');
        const anonKey = String(message.anonKey || '');
        const refreshToken = String(message.refreshToken || '');
        if (!supabaseUrl || !anonKey || !refreshToken) {
          sendResponse({ success: false, status: 400, error: 'Missing token params' });
          return;
        }

        if (!/^https:\/\/.+\.supabase\.co$/i.test(supabaseUrl)) {
          sendResponse({ success: false, status: 400, error: 'Invalid supabaseUrl' });
          return;
        }

        const url = `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        const status = resp.status;
        const ok = resp.ok;
        const data = await resp.json().catch(() => ({}));
        sendResponse({ success: true, ok, status, data });
      } catch (error) {
        sendResponse({ success: false, status: 0, error: error?.message || String(error) });
      }
    })();

    return true;
  }

  if (message.action === 'saveClip') {
    // Handle auto-copy save from content script
    saveTextDirectly(
      message.text,
      message.category || 'Uncategorized',
      message.autoShow !== false,
      message.meta || null
    )
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('❌ Failed to save clip:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (message.action === 'refreshClips' || message.action === 'clipsUpdated') {
    // Broadcast to all tabs that clips were updated
    chrome.tabs.query({}, (tabs) => {
      normalizeArray(tabs).forEach(tab => {
        const tabId = tab && Number.isFinite(tab.id) ? tab.id : null;
        if (tabId == null) return;
        safeTabsSendMessage(tabId, { action: 'clipsUpdated' }).catch(() => {});
      });
    });
    sendResponse({ success: true });
    return false;
  }
  
  return false;
});