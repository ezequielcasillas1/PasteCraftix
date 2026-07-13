/** @forward-slice — Quick Paste DOM / chrome message / storage-change listeners. */

import { QP_STORAGE_KEYS, QP_CLASSES, QP_DEFAULTS } from './qp.constants.js';

function bindHeaderButtons(qp) {
  qp.container.querySelector(`.${QP_CLASSES.CLOSE}`).addEventListener('click', () => {
    qp.hideInterface();
  });

  qp.container.querySelector(`.${QP_CLASSES.REFRESH}`).addEventListener('click', async () => {
    console.log('🗑️ Clear all clips button clicked');
    qp.showClearAllConfirmation();
  });

  const settingsBtn = qp.container.querySelector(`.${QP_CLASSES.SETTINGS}`);
  console.log('🔍 Settings button found:', settingsBtn);
  if (!settingsBtn) {
    console.error('❌ Settings button not found!');
    return;
  }

  settingsBtn.addEventListener('click', () => {
    console.log('🔧 Settings button clicked');
    try {
      qp.showSettingsModal();
      console.log('✅ Settings modal should be visible');
    } catch (error) {
      console.error('❌ Error showing settings modal:', error);
    }
  });
  console.log('✅ Settings button event listener added');
}

function onHeaderMouseDown(qp, e) {
  qp.isDragging = true;
  const rect = qp.container.getBoundingClientRect();
  qp.dragOffset.x = e.clientX - rect.left;
  qp.dragOffset.y = e.clientY - rect.top;
  e.preventDefault();
  document.body.style.userSelect = 'none';
}

function onDocumentMouseMove(qp, e) {
  if (!qp.isDragging) return;

  const newX = e.clientX - qp.dragOffset.x;
  const newY = e.clientY - qp.dragOffset.y;
  const maxX = window.innerWidth - qp.container.offsetWidth;
  const maxY = window.innerHeight - qp.container.offsetHeight;
  const clampedX = Math.max(0, Math.min(newX, maxX));
  const clampedY = Math.max(0, Math.min(newY, maxY));

  qp.container.style.left = clampedX + 'px';
  qp.container.style.top = clampedY + 'px';
  qp.container.style.right = 'auto';
  qp.container.style.bottom = 'auto';
  qp.container.style.transform = 'translateY(0)';
  qp.position.x = clampedX;
  qp.position.y = clampedY;
}

function onDocumentMouseUp(qp) {
  if (!qp.isDragging) return;
  qp.isDragging = false;
  document.body.style.userSelect = '';
  qp.savePosition();
}

function bindDragHandlers(qp) {
  const header = qp.container.querySelector(`.${QP_CLASSES.HEADER}`);
  header.style.cursor = 'move';
  header.addEventListener('mousedown', (e) => onHeaderMouseDown(qp, e));
  document.addEventListener('mousemove', (e) => onDocumentMouseMove(qp, e));
  document.addEventListener('mouseup', () => onDocumentMouseUp(qp));
}

function handleDeleteClick(qp, deleteBtn, e) {
  e.stopPropagation();
  const clipId = deleteBtn.dataset.clipId;
  if (clipId) {
    qp.deleteClipById(clipId);
    return;
  }
  qp.deleteClip(parseInt(deleteBtn.dataset.index, 10));
}

function handlePasteClick(qp, pasteBtn, e) {
  e.stopPropagation();
  const clipId = pasteBtn.dataset.clipId;
  if (clipId) {
    qp.pasteClipById(clipId);
    return;
  }
  qp.pasteClip(parseInt(pasteBtn.dataset.index, 10));
}

function handleClipContainerClick(qp, e) {
  const clipElement = e.target.closest(`.${QP_CLASSES.CLIP}`);
  const pasteBtn = e.target.closest(`.${QP_CLASSES.PASTE}`);
  const deleteBtn = e.target.closest(`.${QP_CLASSES.DELETE}`);
  const copyMultipleBtn = e.target.closest(`.${QP_CLASSES.COPY_MULTIPLE}`);

  if (deleteBtn) {
    handleDeleteClick(qp, deleteBtn, e);
    return;
  }
  if (pasteBtn) {
    handlePasteClick(qp, pasteBtn, e);
    return;
  }
  if (copyMultipleBtn) {
    e.stopPropagation();
    qp.copyMultipleClips();
    return;
  }
  if (clipElement) {
    e.stopPropagation();
    const clipId = clipElement.dataset.clipId;
    if (clipId) qp.toggleClipSelection(clipId, clipElement);
  }
}

function bindDismissHandlers(qp) {
  document.addEventListener('click', (e) => {
    if (qp.isVisible && !qp.container.contains(e.target) && !qp.settings.persistOpen) {
      qp.hideInterface();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && qp.isVisible) {
      qp.hideInterface();
    }
  });
}

/** Wire header, drag, clip delegation, and dismiss listeners. */
export function setupQuickPasteEventListeners(qp) {
  if (!qp.container) return;

  bindHeaderButtons(qp);
  bindDragHandlers(qp);
  qp.container.addEventListener('click', (e) => handleClipContainerClick(qp, e));
  bindDismissHandlers(qp);
}

function onClipSavedMessage(qp, message) {
  console.log('📨 Received clipSaved message:', message.clip);
  console.log('👁️ AutoShow flag:', message.autoShow);
  qp.loadClips().then(() => {
    console.log('🔄 Auto-refreshed clips after new clip saved');
    qp.updateInterface();
    if (message.autoShow !== false && !qp.isVisible && qp.clips.length > 0) {
      qp.showInterface();
    }
  });
}

async function onShowQuickPasteMessage(qp, message) {
  await qp.loadClips();
  qp.updateInterface();
  qp.showInterface(message.x, message.y);
}

function onSettingsUpdatedMessage(qp, message) {
  qp.settings = { ...qp.settings, ...message.settings };
  qp.applySettings();
  qp.updateInterface();
  console.log('⚙️ Settings updated from popup:', qp.settings);
}

async function onClipsUpdatedMessage(qp) {
  console.log('🔄 Received clipsUpdated - refreshing clips');
  await qp.loadClips();
  if (qp.isVisible) {
    qp.updateInterface();
  }
}

async function onClipsClearedMessage(qp) {
  console.log('🗑️ Received clipsCleared message - refreshing interface');
  await qp.loadClips();
  qp.updateInterface();
}

function onOpenPopupPanelMessage() {
  console.log('🎨 Received openPopupPanel message');
  if (window.pasteCraftFloatingWidget) {
    window.pasteCraftFloatingWidget.openPopupOverlay();
    return;
  }
  console.error('❌ Floating widget not initialized');
}

async function dispatchQuickPasteMessage(qp, message) {
  const action = message && typeof message.action === 'string' ? message.action : '';
  if (action === 'clipSaved') {
    onClipSavedMessage(qp, message);
    return true;
  }
  if (action === 'showQuickPaste') {
    await onShowQuickPasteMessage(qp, message);
    return true;
  }
  if (action === 'settingsUpdated') {
    onSettingsUpdatedMessage(qp, message);
    return true;
  }
  if (action === 'clipsUpdated') {
    await onClipsUpdatedMessage(qp);
    return true;
  }
  if (action === 'clipsCleared') {
    await onClipsClearedMessage(qp);
    return true;
  }
  if (action === 'openPopupPanel') {
    onOpenPopupPanelMessage();
    return true;
  }
  return false;
}

/** chrome.runtime.onMessage listener for Quick Paste actions. */
export function setupQuickPasteMessageListener(qp) {
  chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    const handled = await dispatchQuickPasteMessage(qp, message);
    if (handled) sendResponse(true);
    return handled;
  });
}

function mergeSettingsFromChanges(qp, changes) {
  let settingsChanged = false;

  if (changes[QP_STORAGE_KEYS.SETTINGS]) {
    const next = changes[QP_STORAGE_KEYS.SETTINGS].newValue;
    if (next && typeof next === 'object') {
      qp.settings = { ...qp.settings, ...next };
      settingsChanged = true;
    }
  }

  if (changes[QP_STORAGE_KEYS.THEME]) {
    const nextTheme = changes[QP_STORAGE_KEYS.THEME].newValue;
    if (nextTheme === QP_DEFAULTS.THEME_DARK || nextTheme === QP_DEFAULTS.THEME_LIGHT) {
      qp.settings.theme = nextTheme;
      settingsChanged = true;
    }
  }

  if (changes.autoDeletePeriod || changes.albumAttachmentOpenMode) {
    settingsChanged = true;
    qp.loadSettings().catch(() => {});
  }

  return settingsChanged;
}

function applyPositionFromChanges(qp, changes) {
  // Same key as legacy `quickPastePosition` (QP_STORAGE_KEYS.POSITION).
  if (!changes[QP_STORAGE_KEYS.POSITION]) return;

  const nextPos = changes[QP_STORAGE_KEYS.POSITION].newValue;
  if (!nextPos || typeof nextPos !== 'object') return;

  qp.position = { ...qp.position, ...nextPos };
  if (!qp.container) return;

  if (qp.position.x && qp.position.x !== 0) {
    qp.container.style.left = qp.position.x + 'px';
    qp.container.style.right = 'auto';
  } else {
    qp.container.style.left = '';
    qp.container.style.right = '';
  }

  if (typeof qp.position.y === 'number') {
    qp.container.style.top = qp.position.y + 'px';
    qp.container.style.bottom = 'auto';
    qp.container.style.transform = 'translateY(0)';
  } else {
    qp.container.style.top = '';
    qp.container.style.bottom = '';
    qp.container.style.transform = '';
  }
}

function createStorageSyncListener(qp) {
  return (changes, area) => {
    if (area !== 'local') return;

    const settingsChanged = mergeSettingsFromChanges(qp, changes);
    applyPositionFromChanges(qp, changes);

    if (settingsChanged) {
      qp.applySettings();
      if (qp.isVisible) {
        qp.updateInterface();
      }
    }
  };
}

/** chrome.storage.onChanged sync for settings/position across tabs. */
export function setupQuickPasteStorageSync(qp) {
  if (qp._storageSyncListener) return;
  qp._storageSyncListener = createStorageSyncListener(qp);
  chrome.storage.onChanged.addListener(qp._storageSyncListener);
}
