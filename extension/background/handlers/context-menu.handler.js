// PasteCraft Context Menu Handler
// Handles context menu creation and click events

import { saveClip, pasteToTab, getClips } from './clip.handler.js';
import { safeSendToTab } from '../../shared/messaging.js';

// Re-export as safeSendToTab is already correctly named in messaging.js

const MENU_IDS = {
  SEPARATOR_1: 'pastecraft-separator-1',
  COPY_TO_QUICK_SAVE: 'copy-to-quick-save',
  COPY_IMAGE: 'copy-image-to-pastecraft',
  COPY_IMAGE_LINK: 'copy-image-link-to-pastecraft',
  VIEW_QUICK_MENU: 'view-quick-saved-clips',
  SEPARATOR_2: 'pastecraft-separator-2'
};

/**
 * Create all context menu items
 */
export function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_IDS.SEPARATOR_1,
      type: 'separator',
      contexts: ['selection', 'editable', 'page']
    });

    chrome.contextMenus.create({
      id: MENU_IDS.COPY_TO_QUICK_SAVE,
      title: '📋 Copy to PasteCraft',
      contexts: ['selection', 'editable', 'page']
    }, logError);

    chrome.contextMenus.create({
      id: MENU_IDS.COPY_IMAGE,
      title: '🖼️ Copy Image to PasteCraft',
      contexts: ['image']
    }, logError);

    chrome.contextMenus.create({
      id: MENU_IDS.COPY_IMAGE_LINK,
      title: '🔗 Copy Image Link to PasteCraft',
      contexts: ['image']
    }, logError);

    chrome.contextMenus.create({
      id: MENU_IDS.VIEW_QUICK_MENU,
      title: '📋 View Quick Menu',
      contexts: ['selection', 'editable', 'page']
    }, logError);

    chrome.contextMenus.create({
      id: MENU_IDS.SEPARATOR_2,
      type: 'separator',
      contexts: ['selection', 'editable', 'page']
    });
  });
}

function logError() {
  if (chrome.runtime.lastError) {
    console.error('[ContextMenu] Creation failed:', chrome.runtime.lastError);
  }
}

/**
 * Handle context menu click
 * @param {Object} info - Click info
 * @param {Object} tab - Tab info
 */
export async function handleContextMenuClick(info, tab) {
  const menuItemId = info.menuItemId;
  const tabId = tab?.id != null && Number.isFinite(tab.id) ? tab.id : null;
  const tabUrl = tab?.url ? String(tab.url) : '';

  console.log('[ContextMenu] Clicked:', menuItemId);

  switch (menuItemId) {
    case MENU_IDS.COPY_TO_QUICK_SAVE:
      await handleCopyToQuickSave(info);
      break;

    case MENU_IDS.VIEW_QUICK_MENU:
      await handleViewQuickMenu(info, tabId, tabUrl);
      break;

    case MENU_IDS.COPY_IMAGE:
      await handleCopyImage(info, tab, 'image');
      break;

    case MENU_IDS.COPY_IMAGE_LINK:
      await handleCopyImage(info, tab, 'url');
      break;

    default:
      // Legacy paste handling
      if (String(menuItemId).startsWith('paste-')) {
        const clipIndex = parseInt(String(menuItemId).replace('paste-', ''));
        await handleLegacyPaste(clipIndex, tabId);
      }
  }
}

/**
 * Handle "Copy to PasteCraft" menu click
 */
async function handleCopyToQuickSave(info) {
  const text = info.selectionText;
  
  if (!text || !text.trim()) {
    console.log('[ContextMenu] No text selected');
    return;
  }

  await saveClip({
    text,
    category: 'Uncategorized',
    autoShow: false
  });
  
  console.log('[ContextMenu] Text saved to PasteCraft');
}

/**
 * Handle "View Quick Menu" click
 */
async function handleViewQuickMenu(info, tabId, tabUrl) {
  if (!tabId) return;

  const ok = await safeSendToTab(tabId, {
    action: 'showQuickPaste',
    x: info.pageX || 100,
    y: info.pageY || 100
  });

  if (!ok) {
    console.log('[ContextMenu] Content script not available');

    // Check if restricted page
    if (tabUrl.startsWith('edge://') || tabUrl.startsWith('chrome://') || tabUrl.startsWith('moz-extension://')) {
      try {
        await chrome.action.openPopup();
      } catch (_) {
        console.log('[ContextMenu] Cannot open popup on restricted page');
      }
      return;
    }

    // Try injecting content script
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-script.js']
      });

      // Retry after injection
      setTimeout(() => {
        safeSendToTab(tabId, {
          action: 'showQuickPaste',
          x: info.pageX || 100,
          y: info.pageY || 100
        });
      }, 500);
    } catch (err) {
      console.error('[ContextMenu] Script injection failed:', err);
    }
  }
}

/**
 * Handle image copy to PasteCraft
 */
async function handleCopyImage(info, tab, kind) {
  const srcUrl = info.srcUrl ? String(info.srcUrl) : '';
  if (!srcUrl) {
    console.log('[ContextMenu] No image URL');
    return;
  }

  const sourcePageUrl = tab?.url ? String(tab.url) : '';
  const capturedAt = Date.now();

  const meta = kind === 'url'
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

  await saveClip({
    text: srcUrl,
    category: 'Uncategorized',
    autoShow: false,
    meta
  });

  console.log('[ContextMenu] Image saved:', kind);
}

/**
 * Handle legacy paste menu
 */
async function handleLegacyPaste(clipIndex, tabId) {
  if (!tabId) return;

  const { clips } = await getClips();
  const clip = clips[clipIndex];
  
  if (!clip) return;

  const text = clip.text || clip;
  await pasteToTab(tabId, text);
  
  console.log('[ContextMenu] Pasted clip:', clipIndex);
}

// Export menu IDs for reference
export { MENU_IDS };
