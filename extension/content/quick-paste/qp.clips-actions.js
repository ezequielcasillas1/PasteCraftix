/** @forward-slice — Quick Paste clear/select/copy/delete clip actions. */

import { clipIdKey } from './qp.helpers.js';
import {
  QP_STORAGE_KEYS,
  QP_CLASSES,
  QP_ELEMENT_IDS,
  QP_DELIMITER,
  resolveQuickPasteTheme,
} from './qp.constants.js';

const SELECTED_INLINE = Object.freeze({
  background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
  color: 'white',
  border: '4px solid #ff6b35',
  transform: 'scale(1.08)',
  boxShadow: '0 8px 25px rgba(255, 107, 53, 0.9)',
  outline: '3px solid rgba(255, 107, 53, 0.5)',
  outlineOffset: '2px',
  zIndex: '50',
  position: 'relative',
});

const CLEAR_INLINE = Object.freeze([
  'background',
  'color',
  'border',
  'transform',
  'boxShadow',
  'outline',
  'outlineOffset',
  'zIndex',
  'position',
]);

function buildClearAllConfirmHtml(qp) {
  const themeClass = resolveQuickPasteTheme(qp.settings.theme);
  return `
      <div class="${QP_CLASSES.MODAL_BACKDROP}"></div>
      <div class="${QP_CLASSES.MODAL_CONTENT}">
        <div class="pastecraft-modal-header">
          <h3>🗑️ Clear All Clips</h3>
        </div>
        <div class="${QP_CLASSES.MODAL_BODY}">
          <p>Are you sure you want to delete all ${qp.clips.length} clips?</p>
          <p><strong>This action cannot be undone.</strong></p>
        </div>
        <div class="${QP_CLASSES.MODAL_ACTIONS}">
          <button class="${QP_CLASSES.BTN_SECONDARY}" id="${QP_ELEMENT_IDS.CANCEL_CLEAR_ALL}">Cancel</button>
          <button class="pastecraft-btn-danger" id="${QP_ELEMENT_IDS.CONFIRM_CLEAR_ALL}">Delete All Clips</button>
        </div>
      </div>
    `;
}

function wireClearAllConfirmModal(qp, confirmModal) {
  confirmModal.querySelector(`#${QP_ELEMENT_IDS.CANCEL_CLEAR_ALL}`).addEventListener('click', () => {
    confirmModal.remove();
  });

  confirmModal.querySelector(`#${QP_ELEMENT_IDS.CONFIRM_CLEAR_ALL}`).addEventListener('click', async () => {
    await clearAllQuickPasteClips(qp);
    confirmModal.remove();
  });

  confirmModal.querySelector(`.${QP_CLASSES.MODAL_BACKDROP}`).addEventListener('click', () => {
    confirmModal.remove();
  });
}

/** Show clear-all confirmation modal in the Quick Paste shadow root. */
export function showQuickPasteClearAllConfirmation(qp) {
  const confirmModal = document.createElement('div');
  const themeClass = resolveQuickPasteTheme(qp.settings.theme);
  confirmModal.className = `${QP_CLASSES.CONFIRM_MODAL} ${themeClass}`;
  confirmModal.innerHTML = buildClearAllConfirmHtml(qp);

  const root = qp.shadowMount?.root || document.body;
  root.appendChild(confirmModal);
  wireClearAllConfirmModal(qp, confirmModal);
}

async function persistClearedClips() {
  await chrome.storage.local.set({
    [QP_STORAGE_KEYS.CLIPS]: [],
    [QP_STORAGE_KEYS.ARCHIVED]: [],
    [QP_STORAGE_KEYS.UPDATED_AT]: Date.now(),
  });
}

function notifyTabsClipsCleared() {
  try {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { action: 'clipsCleared' }).catch(() => {});
      });
    });
  } catch (error) {
    console.log('Could not notify other tabs about clear:', error);
  }
}

/** Clear all clips from storage + local UI state. */
export async function clearAllQuickPasteClips(qp) {
  try {
    console.log('🗑️ Clearing all clips...');
    await persistClearedClips();
    qp.clips = [];
    qp.updateInterface();
    qp.showToast('All clips deleted!', 'success');
    console.log('✅ All clips cleared successfully');
    notifyTabsClipsCleared();
  } catch (error) {
    console.error('❌ Failed to clear clips:', error);
    qp.showToast('Failed to clear clips', 'error');
  }
}

function clearSelectionInlineStyles(clipElement) {
  CLEAR_INLINE.forEach((prop) => {
    clipElement.style[prop] = '';
  });
}

function applySelectionInlineStyles(clipElement) {
  Object.assign(clipElement.style, SELECTED_INLINE);
}

function deselectClipElement(qp, clipId, clipElement) {
  qp.selectedClips.delete(clipId);
  clipElement.classList.remove(QP_CLASSES.SELECTED);
  clearSelectionInlineStyles(clipElement);
}

function selectClipElement(qp, clipId, clipElement) {
  qp.selectedClips.add(clipId);
  clipElement.classList.add(QP_CLASSES.SELECTED);
  applySelectionInlineStyles(clipElement);
}

/** Toggle multi-select for a clip by stable id key (or legacy index). */
export function toggleQuickPasteClipSelection(qp, index, clipElement) {
  const id = String(index);
  if (qp.selectedClips.has(id)) {
    deselectClipElement(qp, id, clipElement);
  } else {
    selectClipElement(qp, id, clipElement);
  }
  clipElement.offsetHeight;
  updateQuickPasteCopyMultipleButton(qp);
}

/** Enable/disable the Copy Multiple button from selection size. */
export function updateQuickPasteCopyMultipleButton(qp) {
  const button = qp.container?.querySelector(`.${QP_CLASSES.COPY_MULTIPLE}`);
  if (!button) return;

  const selectedCount = qp.selectedClips.size;
  if (selectedCount >= 2) {
    button.disabled = false;
    button.textContent = `Copy ${selectedCount} Clips`;
    button.style.background = '#2563eb';
    return;
  }

  button.disabled = true;
  button.textContent = 'Copy Multiple Clips';
  button.style.background = '#d1d5db';
}

function orderedSelectedClipIds(qp) {
  const selected = qp.selectedClips;
  const orderedIds = [];
  const domClips = qp.container ? qp.container.querySelectorAll(`.${QP_CLASSES.CLIP}`) : [];

  if (domClips && domClips.length > 0) {
    domClips.forEach((el) => {
      const id = el?.dataset?.clipId;
      if (id && selected.has(id)) orderedIds.push(id);
    });
  }

  if (orderedIds.length === 0) {
    qp.clips.forEach((c) => {
      const id = clipIdKey(c?.id);
      if (selected.has(id)) orderedIds.push(id);
    });
  }

  return orderedIds;
}

function textsForOrderedIds(qp, orderedIds) {
  return orderedIds
    .map((id) => qp.clips.find((c) => clipIdKey(c?.id) === id))
    .filter(Boolean)
    .map((clip) => clip.text);
}

function applyCopyFormatOptions(texts, options) {
  let next = texts;
  if (options.deduplicate) next = [...new Set(next)];
  if (options.sort) next = [...next].sort();
  if (options.uppercase) next = next.map((text) => text.toUpperCase());
  return next;
}

function resolveCopyDelimiter(settings) {
  switch (settings.delimiter) {
    case QP_DELIMITER.COMMA:
      return QP_DELIMITER.VALUES.comma;
    case QP_DELIMITER.NEWLINE:
      return QP_DELIMITER.VALUES.newline;
    case QP_DELIMITER.SPACE:
      return QP_DELIMITER.VALUES.space;
    case QP_DELIMITER.CUSTOM:
      return settings.customDelimiter || QP_DELIMITER.VALUES.comma;
    default:
      return QP_DELIMITER.FALLBACK_JOIN;
  }
}

function clearDomSelections(qp) {
  qp.selectedClips.clear();
  const selectedElements = qp.container.querySelectorAll(`.${QP_CLASSES.CLIP}.${QP_CLASSES.SELECTED}`);
  selectedElements.forEach((el) => el.classList.remove(QP_CLASSES.SELECTED));
  updateQuickPasteCopyMultipleButton(qp);
}

/** Copy selected clips to clipboard with delimiter + format options. */
export async function copyMultipleQuickPasteClips(qp) {
  if (qp.selectedClips.size < 2) return;

  const orderedIds = orderedSelectedClipIds(qp);
  let selectedTexts = textsForOrderedIds(qp, orderedIds);
  selectedTexts = applyCopyFormatOptions(selectedTexts, qp.settings.options || {});
  const formattedText = selectedTexts.join(resolveCopyDelimiter(qp.settings));
  const selectedCount = qp.selectedClips.size;

  try {
    await navigator.clipboard.writeText(formattedText);
    qp.showToast(`📋 Copied ${selectedCount} clips!`, 'success');
    clearDomSelections(qp);
    console.log(`✅ Successfully copied ${selectedCount} clips`);
  } catch (error) {
    console.error('❌ Failed to copy multiple clips:', error);
    qp.showToast('❌ Failed to copy clips', 'error');
  }
}

/** Delete clip by visible list index (back-compat). */
export async function deleteQuickPasteClip(qp, index) {
  const clip = qp.clips?.[index];
  if (!clip) return;
  await deleteQuickPasteClipById(qp, clipIdKey(clip?.id));
}

async function persistClipsAfterDelete(qp) {
  await chrome.storage.local.set({
    [QP_STORAGE_KEYS.CLIPS]: qp.clips,
    [QP_STORAGE_KEYS.UPDATED_AT]: Date.now(),
  });
}

function notifyClipsUpdated() {
  try {
    chrome.runtime.sendMessage({ action: 'clipsUpdated' });
  } catch (_) {}
}

async function runDeleteClipById(qp, id) {
  const before = qp.clips.length;
  const clip = qp.clips.find((c) => clipIdKey(c?.id) === id);
  qp.clips = qp.clips.filter((c) => clipIdKey(c?.id) !== id);
  const deleted = before - qp.clips.length;

  if (deleted === 0) {
    qp.selectedClips.delete(id);
    updateQuickPasteCopyMultipleButton(qp);
    return;
  }

  await persistClipsAfterDelete(qp);
  qp.updateInterface();
  const preview = clip && clip.text ? String(clip.text).substring(0, 30) : 'clip';
  qp.showToast(`🗑️ Deleted clip: "${preview}..."`, 'success');
  console.log(`✅ Deleted clip ${id}`);
  notifyClipsUpdated();
}

/** Delete one clip by stable id key (queued). */
export async function deleteQuickPasteClipById(qp, rawClipId) {
  const id = String(rawClipId || '');
  if (!id) return;
  return qp._queueClipOp(() => runDeleteClipById(qp, id));
}
