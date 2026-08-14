import { normalizeArray, safeTabsSendMessage } from './bg-utils.js';
import { saveTextDirectly } from './clips.commands.js';
import { putClipImage } from '../../shared/clip-images.js';
import { getQuickViewClips, deleteQuickViewClip } from '../quickview/quickview.service.js';
import { INTERNAL_MESSAGE_ACTIONS as A } from '../messaging/message-types.js';

/**
 * Clips save / Quick View / broadcast handlers.
 * Keep each helper CC ≤ 9.
 */

export function handleSaveClip(message, { sendResponse }) {
  saveTextDirectly(
    message.text,
    message.category || 'Uncategorized',
    message.autoShow !== false,
    message.meta || null,
    message.pendingImageKey || '',
    {
      dataUrl: message.imageDataUrl || '',
      mime: message.imageMime || '',
    },
  )
    .then((result) => {
      sendResponse({
        success: true,
        imageStored: result?.imageStored === true,
        clipId: result?.clipId ?? null,
      });
    })
    .catch((error) => {
      console.error('❌ Failed to save clip:', error);
      sendResponse({ success: false, error: error.message });
    });
  return true;
}

export function handlePutClipImage(message, { sendResponse }) {
  putClipImage(message.clipId, message.dataUrl, message.mime || 'image/png')
    .then((key) => {
      sendResponse({ success: true, key });
    })
    .catch((error) => {
      sendResponse({ success: false, error: error?.message || String(error) });
    });
  return true;
}

function respondQuickViewGetFailure(error, sendResponse) {
  console.error('❌ Failed to get Quick View clips:', error);
  sendResponse({
    success: false,
    error: error?.message || String(error),
    clips: [],
  });
}

export function handlePcGetQuickViewClips(_message, { sendResponse }) {
  getQuickViewClips()
    .then((clips) => {
      sendResponse({ success: true, clips });
    })
    .catch((error) => {
      respondQuickViewGetFailure(error, sendResponse);
    });
  return true;
}

export function handlePcDeleteQuickViewClip(message, { sendResponse }) {
  deleteQuickViewClip({
    clipId: message.clipId,
    archived: message.archived === true,
    index: message.index,
  })
    .then((clips) => {
      chrome.runtime.sendMessage({ action: 'clipsUpdated' }).catch(() => {});
      sendResponse({ success: true, clips });
    })
    .catch((error) => {
      console.error('❌ Failed to delete Quick View clip:', error);
      sendResponse({
        success: false,
        error: error?.message || String(error),
        clips: [],
      });
    });
  return true;
}

function broadcastClipsUpdatedToTabs() {
  chrome.tabs.query({}, (tabs) => {
    normalizeArray(tabs).forEach((tab) => {
      const tabId = tab && Number.isFinite(tab.id) ? tab.id : null;
      if (tabId == null) return;
      safeTabsSendMessage(tabId, { action: 'clipsUpdated' }).catch(() => {});
    });
  });
}

export function handleClipsBroadcast(_message, { sendResponse }) {
  broadcastClipsUpdatedToTabs();
  sendResponse({ success: true });
  return false;
}

export function createClipsHandlerMap() {
  return {
    [A.SAVE_CLIP]: handleSaveClip,
    [A.PC_PUT_CLIP_IMAGE]: handlePutClipImage,
    [A.PC_GET_QUICK_VIEW_CLIPS]: handlePcGetQuickViewClips,
    [A.PC_DELETE_QUICK_VIEW_CLIP]: handlePcDeleteQuickViewClip,
    [A.REFRESH_CLIPS]: handleClipsBroadcast,
    [A.CLIPS_UPDATED]: handleClipsBroadcast,
  };
}
