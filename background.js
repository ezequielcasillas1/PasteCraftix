// PasteCraft Background Script - Deep Diagnostic Mode
console.log('🚀 PasteCraft v2.0 loaded - DIAGNOSTIC MODE');

// Force create context menus immediately
async function createContextMenus() {
  console.log('🔧 DIAGNOSTIC: Force creating context menus');
  
  // Clear all existing menus first
  chrome.contextMenus.removeAll(() => {
    console.log('🧹 DIAGNOSTIC: Cleared existing menus');
    
    // Create separate menu items instead of parent-child structure
    // This approach is more reliable across different Chrome versions
    
    chrome.contextMenus.create({
      id: 'pastecraft-separator-1',
      type: 'separator',
      contexts: ['selection', 'editable', 'page']
    });
    
    chrome.contextMenus.create({
      id: 'copy-to-quick-save',
      title: '📋 PasteCraft: Copy to Quick Save',
      contexts: ['selection', 'editable', 'page']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('❌ DIAGNOSTIC: Copy to Quick Save menu failed:', chrome.runtime.lastError);
      } else {
        console.log('✅ DIAGNOSTIC: Copy to Quick Save menu created successfully');
      }
    });
    
    chrome.contextMenus.create({
      id: 'view-quick-saved-clips',
      title: '📋 PasteCraft: View Quick Saved',
      contexts: ['selection', 'editable', 'page']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('❌ DIAGNOSTIC: View Quick Saved menu failed:', chrome.runtime.lastError);
      } else {
        console.log('✅ DIAGNOSTIC: View Quick Saved menu created successfully');
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
  console.log('🚀 DIAGNOSTIC: onInstalled triggered');
  createContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('🚀 DIAGNOSTIC: onStartup triggered');
  createContextMenus();
});

// Force create immediately
console.log('🚀 DIAGNOSTIC: Creating menus immediately on script load');
createContextMenus();

// Handle menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('🖱️ Context menu clicked:', info.menuItemId);
  
  if (info.menuItemId === 'pastecraft-main') {
    // Main menu clicked - show appropriate action based on context
    if (info.selectionText) {
      // If text is selected, save it
      await saveTextDirectly(info.selectionText, 'Uncategorized');
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
    console.log('🖱️ Copy to Quick Save clicked - selectionText:', info.selectionText);
    
    if (info.selectionText && info.selectionText.trim().length > 0) {
      // Save directly to Quick Save (Uncategorized) and show Quick Paste interface
      await saveTextDirectly(info.selectionText, 'Uncategorized');
      
      // Show Quick Paste interface near cursor
      chrome.tabs.sendMessage(tab.id, {
        action: 'showQuickPaste',
        x: info.pageX || 100,
        y: info.pageY || 100
      }).catch(() => {
        console.log('Could not show Quick Paste interface');
      });
    } else {
      // No text selected - show feedback message
      console.log('⚠️ Copy to Quick Save clicked but no text selected or empty');
      // Just show the interface
      chrome.tabs.sendMessage(tab.id, {
        action: 'showQuickPaste',
        x: info.pageX || 100,
        y: info.pageY || 100
      }).catch(() => {
        console.log('Could not show Quick Paste interface');
      });
    }
    
  } else if (info.menuItemId === 'view-quick-saved-clips') {
    // Show Quick Paste interface for viewing/pasting clips
    console.log('🎯 DIAGNOSTIC: Attempting to show Quick Paste interface on tab:', tab.id);
    chrome.tabs.sendMessage(tab.id, {
      action: 'showQuickPaste',
      x: info.pageX || 100,
      y: info.pageY || 100
    }).then(() => {
      console.log('✅ DIAGNOSTIC: Quick Paste message sent successfully');
    }).catch((error) => {
      console.error('❌ DIAGNOSTIC: Could not show Quick Paste interface:', error.message || error);
      console.log('🔧 DIAGNOSTIC: Tab info:', {id: tab.id, url: tab.url, title: tab.title});
      
      // Check if this is a restricted page (browser internal pages)
      if (tab.url.startsWith('edge://') || tab.url.startsWith('chrome://') || tab.url.startsWith('moz-extension://')) {
        console.log('⚠️ DIAGNOSTIC: Cannot show Quick Paste on browser internal pages. Try on a regular website.');
        // Fallback: Open extension popup instead
        chrome.action.openPopup().catch(() => {
          console.log('💡 DIAGNOSTIC: Could not open popup. User should navigate to a regular webpage.');
        });
        return;
      }
      
      // Try to inject content script manually if it's not loaded
      console.log('🔧 DIAGNOSTIC: Attempting to inject content script manually...');
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-script.js']
      }).then(() => {
        console.log('✅ DIAGNOSTIC: Content script injected manually');
        // Try sending message again after injection
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'showQuickPaste',
            x: info.pageX || 100,
            y: info.pageY || 100
          }).then(() => {
            console.log('✅ DIAGNOSTIC: Quick Paste message sent after manual injection');
          }).catch((retryError) => {
            console.error('❌ DIAGNOSTIC: Still failed after manual injection:', retryError);
          });
        }, 500);
      }).catch((injectError) => {
        console.error('❌ DIAGNOSTIC: Failed to inject content script:', injectError);
      });
    });
    
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

async function saveTextDirectly(text, category = 'Uncategorized') {
  console.log('🚀 DIAGNOSTIC: saveTextDirectly() called');
  console.log('📝 Text to save:', text ? (text.substring(0, 50) + '...') : 'UNDEFINED/EMPTY');
  console.log('📁 Category:', category);
  
  // Safety check: Don't save empty/undefined text
  if (!text || text.trim().length === 0) {
    console.log('⚠️ Attempted to save empty/undefined text - ABORTED');
    return;
  }
  
  const result = await chrome.storage.local.get(['clips', 'searchOnlyClips']);
  console.log('🔍 Storage BEFORE save:', {
    clipsCount: result.clips?.length || 0,
    searchOnlyCount: result.searchOnlyClips?.length || 0
  });
  console.log('🔍 RAW clips array from storage:', result.clips);
  console.log('🔍 Type of clips from storage:', typeof result.clips, Array.isArray(result.clips));
  
  const { clips = [], searchOnlyClips = [] } = result;
  
  console.log('🔍 After destructuring - clips length:', clips.length);
  console.log('🔍 After destructuring - clips array:', clips);
  
  const newClip = {
    id: Date.now() + Math.random(),
    text: text,
    category: category,
    timestamp: Date.now()
  };
  
  console.log('📦 New clip object:', newClip);
  
  // Check category limit (10 clips max per category in ACTIVE storage)
  const activeClipsInCategory = clips.filter(clip => clip.category === category);
  
  if (activeClipsInCategory.length >= 10) {
    console.log(`⚠️ Category "${category}" is at limit (10 clips). Moving oldest to archive...`);
    
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
  
  console.log('🔄 BEFORE unshift - clips array:', clips);
  clips.unshift(newClip);
  console.log('📊 AFTER unshift - clips length:', clips.length);
  console.log('📊 AFTER unshift - clips array:', clips);
  console.log('📊 First clip:', clips[0]?.text?.substring(0, 30));
  console.log('📊 Second clip:', clips[1]?.text?.substring(0, 30) || 'NONE');
  
  // Move clips beyond 20th to search-only storage
  if (clips.length > 20) {
    const overflowClips = clips.splice(20);
    searchOnlyClips.unshift(...overflowClips);
    
    // Keep search storage reasonable (max 1000 total archived clips)
    if (searchOnlyClips.length > 1000) {
      searchOnlyClips.splice(1000);
    }
    
    console.log('📦 Moved overflow to searchOnlyClips:', overflowClips.length);
  }
  
  console.log('💾 ABOUT TO SAVE TO STORAGE - clips array length:', clips.length);
  console.log('💾 ABOUT TO SAVE TO STORAGE - full clips array:', clips);
  console.log('💾 ABOUT TO SAVE TO STORAGE - searchOnly array length:', searchOnlyClips.length);
  
  await chrome.storage.local.set({ clips, searchOnlyClips });
  
  console.log('✅ SAVE COMPLETE - verifying...');
  
  // Verify save worked
  const verification = await chrome.storage.local.get(['clips', 'searchOnlyClips']);
  console.log('🔍 VERIFICATION - Storage now has:');
  console.log('   - Active clips:', verification.clips?.length || 0);
  console.log('   - Archived clips:', verification.searchOnlyClips?.length || 0);
  console.log('🔍 FULL clips array in storage:', verification.clips);
  console.log('🔍 First clip:', verification.clips?.[0]?.text?.substring(0, 30) || 'NONE');
  console.log('🔍 Second clip:', verification.clips?.[1]?.text?.substring(0, 30) || 'NONE');
  
  // Notify content scripts about new clip
  try {
    chrome.tabs.query({}, (tabs) => {
      console.log('📢 Notifying', tabs.length, 'tabs about new clip');
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'clipSaved',
          clip: newClip
        }).catch(() => {}); // Ignore errors for tabs without content script
      });
    });
  } catch (error) {
    console.log('Could not notify content scripts:', error);
  }
  
  console.log('💾 ✅ SAVE COMPLETE - Saved text to', category + ':', text ? (text.substring(0, 30) + '...') : 'NO TEXT');
}
