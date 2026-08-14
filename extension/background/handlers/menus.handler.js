/**
 * @forward-slice Context menus + action icon click (Command entrypoints).
 * Side-effect module: registers chrome.contextMenus / action / lifecycle listeners.
 */

import {
  getAppOpenMode,
  openAppPopupWindow,
  safeTabsSendMessage,
} from './bg-utils.js';
import { saveTextDirectly, pasteClip } from './clips.commands.js';
import { ensureClipImagesMigrated } from '../../shared/clip-images.js';
import {
  SCHEMA_VERSION,
  SCHEMA_VERSION_KEY,
  runStorageMigrations,
} from '../migrations/storage-migrations.js';

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

async function handlePastecraftMainMenu(info, tabId) {
  if (info.selectionText) {
    await saveTextDirectly(info.selectionText, 'Uncategorized', false);
  }
  if (tabId != null) {
    await safeTabsSendMessage(tabId, {
      action: 'showQuickPaste',
      x: info.pageX || 100,
      y: info.pageY || 100
    });
  }
}

async function handleCopyToQuickSave(info) {
  console.log('🖱️ Copy to PasteCraft clicked - selectionText:', info.selectionText);

  if (info.selectionText && info.selectionText.trim().length > 0) {
    await saveTextDirectly(info.selectionText, 'Uncategorized', false);
    console.log('✅ Text saved to PasteCraft (no UI shown)');
  } else {
    console.log('⚠️ Copy to PasteCraft clicked but no text selected or empty');
  }
}

async function handleViewQuickSavedClips(info, tabId, tabUrl) {
  const ok = tabId != null
    ? await safeTabsSendMessage(tabId, {
        action: 'showQuickPaste',
        x: info.pageX || 100,
        y: info.pageY || 100
      })
    : false;

  if (!ok) {
    console.error('❌ Could not show Quick Paste interface: content script not available');

    if (tabUrl.startsWith('edge://') || tabUrl.startsWith('chrome://') || tabUrl.startsWith('moz-extension://')) {
      chrome.action.openPopup().catch(() => {
        console.log('Could not open popup. Navigate to a regular webpage.');
      });
      return;
    }

    if (tabId != null) {
      chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-script.js']
      }).then(() => {
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
}

async function handleCopyImageMenu(info, tab) {
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
  void ensureClipImagesMigrated();
});

// Force create immediately
createContextMenus();
void ensureClipImagesMigrated();

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
    await handlePastecraftMainMenu(info, tabId);
  } else if (info.menuItemId === 'copy-to-quick-save') {
    await handleCopyToQuickSave(info);
  } else if (info.menuItemId === 'view-quick-saved-clips') {
    await handleViewQuickSavedClips(info, tabId, tabUrl);
  } else if (info.menuItemId === 'copy-image-to-pastecraft' || info.menuItemId === 'copy-image-link-to-pastecraft') {
    await handleCopyImageMenu(info, tab);
  } else if (info.menuItemId.startsWith('paste-')) {
    const clipIndex = parseInt(info.menuItemId.replace('paste-', ''));
    await pasteClip(clipIndex, tab);
  }
});
