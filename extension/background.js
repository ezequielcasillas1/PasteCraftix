// PasteCraft Background Script

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
  console.log('🎨 Extension icon clicked, opening slide-in panel');
  
  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: 'openPopupPanel'
    });
    console.log('✅ Message sent to open popup panel');
  } catch (error) {
    console.error('❌ Could not open popup panel:', error);
  }
});

// Handle menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('🖱️ Context menu clicked:', info.menuItemId);
  
  if (info.menuItemId === 'pastecraft-main') {
    // Main menu clicked - show appropriate action based on context
    if (info.selectionText) {
      // If text is selected, save it (but don't auto-show since we explicitly show below)
      await saveTextDirectly(info.selectionText, 'Uncategorized', false);
    }
    // Always show Quick Paste interface
    chrome.tabs.sendMessage(tab.id, {
      action: 'showQuickPaste',
      x: info.pageX || 100,
      y: info.pageY || 100
    }).catch(() => {
      console.log('Could not show Quick Paste interface');
    });
    
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
    chrome.tabs.sendMessage(tab.id, {
      action: 'showQuickPaste',
      x: info.pageX || 100,
      y: info.pageY || 100
    }).then(() => {
    }).catch((error) => {
      console.error('❌ Could not show Quick Paste interface:', error.message || error);
      
      // Check if this is a restricted page (browser internal pages)
      if (tab.url.startsWith('edge://') || tab.url.startsWith('chrome://') || tab.url.startsWith('moz-extension://')) {
        // Fallback: Open extension popup instead
        chrome.action.openPopup().catch(() => {
          console.log('Could not open popup. Navigate to a regular webpage.');
        });
        return;
      }
      
      // Try to inject content script manually if it's not loaded
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-script.js']
      }).then(() => {
        // Try sending message again after injection
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'showQuickPaste',
            x: info.pageX || 100,
            y: info.pageY || 100
          }).then(() => {
          }).catch((retryError) => {
            console.error('❌ Still failed after manual injection:', retryError);
          });
        }, 500);
      }).catch((injectError) => {
        console.error('❌ Failed to inject content script:', injectError);
      });
    });
    
  } else if (info.menuItemId === 'copy-image-to-pastecraft' || info.menuItemId === 'copy-image-link-to-pastecraft') {
    const srcUrl = (info && info.srcUrl) ? String(info.srcUrl) : '';
    if (!srcUrl) {
      console.log('⚠️ Copy image clicked but srcUrl missing');
      return;
    }

    // For now both actions save the image URL + meta so it shows and previews in Clips.
    const meta = {
      kind: 'image',
      plainText: '',
      html: '',
      url: '',
      image: { mime: '', dataUrl: '', srcUrl },
      sourcePageUrl: (tab && tab.url) ? String(tab.url) : '',
      capturedAt: Date.now()
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
  const { clips = [] } = await chrome.storage.local.get(['clips']);
  const clip = clips[index];
  
  if (!clip) return;
  
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
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
  console.log('📝 Text to save:', text ? (text.substring(0, 50) + '...') : 'UNDEFINED/EMPTY');
  console.log('📁 Category:', category);
  console.log('👁️ Auto-show interface:', autoShow);
  
  // Safety check: Don't save empty/undefined text
  if (!text || text.trim().length === 0) {
    console.log('⚠️ Attempted to save empty/undefined text - ABORTED');
    return;
  }
  
  const result = await chrome.storage.local.get(['clips', 'searchOnlyClips']);
  const { clips = [], searchOnlyClips = [] } = result;
  
  const safeMeta = sanitizeClipMeta(meta);
  const newClip = {
    id: Date.now() + Math.random(),
    text: text,
    category: category,
    timestamp: Date.now(),
    ...(safeMeta ? { meta: safeMeta } : {})
  };
  
  console.log('📦 New clip object:', newClip);
  
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
  
  console.log('🔄 BEFORE unshift - clips array:', clips);
  clips.unshift(newClip);
  console.log('📊 AFTER unshift - clips length:', clips.length);
  console.log('📊 AFTER unshift - clips array:', clips);
  console.log('📊 First clip:', clips[0]?.text?.substring(0, 30));
  console.log('📊 Second clip:', clips[1]?.text?.substring(0, 30) || 'NONE');
  
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
  
  console.log('💾 ABOUT TO SAVE TO STORAGE - clips array length:', clips.length);
  console.log('💾 ABOUT TO SAVE TO STORAGE - full clips array:', clips);
  console.log('💾 ABOUT TO SAVE TO STORAGE - searchOnly array length:', searchOnlyClips.length);
  
  await chrome.storage.local.set({ clips, searchOnlyClips, pc_local_updatedAt: Date.now() });
  
  console.log('✅ SAVE COMPLETE - verifying...');
  
  // Verify save worked
  const verification = await chrome.storage.local.get(['clips', 'searchOnlyClips']);
  console.log('🔍 VERIFICATION - Storage now has:');
  console.log('   - Active clips:', verification.clips?.length || 0);
  console.log('   - Archived clips:', verification.searchOnlyClips?.length || 0);
  console.log('🔍 FULL clips array in storage:', verification.clips);
  console.log('🔍 First clip:', verification.clips?.[0]?.text?.substring(0, 30) || 'NONE');
  console.log('🔍 Second clip:', verification.clips?.[1]?.text?.substring(0, 30) || 'NONE');
  
  // Notify content scripts and popup about new clip
  try {
    // Notify all tabs (content scripts)
    chrome.tabs.query({}, (tabs) => {
      console.log('📢 Notifying', tabs.length, 'tabs about new clip');
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
  console.log('📨 External message received:', message);
  console.log('📨 From:', sender);
  
  if (message.type === 'password_reset' && message.access_token) {
    console.log('🔑 Password reset token received from web');
    
    // Store the reset tokens
    chrome.storage.local.set({
      password_reset_callback: {
        access_token: message.access_token,
        refresh_token: message.refresh_token,
        type: 'recovery',
        timestamp: Date.now()
      }
    }, () => {
      console.log('✅ Password reset tokens stored successfully');
      sendResponse({ success: true });
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
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { action: 'clipsUpdated' }).catch(() => {});
      });
    });
    sendResponse({ success: true });
    return false;
  }
  
  return false;
});