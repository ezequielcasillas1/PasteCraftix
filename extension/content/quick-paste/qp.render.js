/** @forward-slice — Quick Paste DOM/HTML render helpers (no storage writes). */

import {
  clipIdKey,
  getTimeAgo,
  escapeHtml,
  detectQuickBadge,
  lightFormatPreview,
} from './qp.helpers.js';
import {
  QP_HOST,
  QP_CLASSES,
  QP_ELEMENT_IDS,
  QP_LIMITS,
  QP_DEFAULTS,
} from './qp.constants.js';

function buildEmptyClipsHtml() {
  return `
        <div class="${QP_CLASSES.EMPTY}">
          <div class="${QP_CLASSES.EMPTY_ICON}">✨</div>
          <p>No clips saved yet</p>
          <small>Right-click selected text to save</small>
        </div>
      `;
}

function buildClipItemHtml(clip, index, settings) {
  const text = clip.text || clip;
  const previewLen = QP_LIMITS.PREVIEW_TEXT_CHARS;
  const displayText = text.length > previewLen ? text.substring(0, previewLen) + '...' : text;
  const category = clip.category || QP_DEFAULTS.CATEGORY;
  const timeAgo = settings.showTimestamps ? getTimeAgo(clip.timestamp) : '';
  const clipIdKeyValue = clipIdKey(clip?.id != null ? clip.id : index);
  const qpBadge = detectQuickBadge(text);
  const qpFormatted = lightFormatPreview(displayText);

  return `
        <div class="${QP_CLASSES.CLIP}" data-index="${index}" data-clip-id="${clipIdKeyValue}" title="${escapeHtml(text)}">
          <div class="${QP_CLASSES.CLIP_CONTENT}">
            <div class="${QP_CLASSES.CLIP_TEXT}">${qpBadge}${qpFormatted}</div>
            <div class="${QP_CLASSES.CLIP_META}">
              <span class="${QP_CLASSES.CATEGORY}">${escapeHtml(category)}</span>
              ${timeAgo ? `<span class="${QP_CLASSES.TIME}">${timeAgo}</span>` : ''}
            </div>
          </div>
          <div class="${QP_CLASSES.CLIP_ACTIONS}">
            <button class="${QP_CLASSES.BTN} ${QP_CLASSES.PASTE}" data-clip-id="${clipIdKeyValue}" data-index="${index}" title="Paste">📋</button>
            <button class="${QP_CLASSES.BTN} ${QP_CLASSES.DELETE}" data-clip-id="${clipIdKeyValue}" data-index="${index}" title="Delete">×</button>
          </div>
        </div>
      `;
}

/** Render clip list HTML for the Quick Paste panel. */
export function renderQuickPasteClips(clips, settings) {
  if (!clips.length) return buildEmptyClipsHtml();
  const max = settings.maxClipsDisplay;
  return clips.slice(0, max).map((clip, index) => buildClipItemHtml(clip, index, settings)).join('');
}

/** Shell markup for the Quick Paste shadow root container. */
export function buildQuickPasteShellHtml(clipsHtml, clipCount) {
  return `
      <div class="${QP_CLASSES.HEADER}">
        <div class="${QP_CLASSES.LOGO}">📋 PasteCraft</div>
        <div class="${QP_CLASSES.CONTROLS}">
          <button class="${QP_CLASSES.BTN} ${QP_CLASSES.SETTINGS}" title="Settings">⚙️</button>
          <button class="${QP_CLASSES.BTN} ${QP_CLASSES.CLOSE}" title="Close">×</button>
        </div>
      </div>
      <div class="${QP_CLASSES.CONTENT}">
        <div class="${QP_CLASSES.CLIPS_CONTAINER}">
          ${clipsHtml}
        </div>
        <div class="${QP_CLASSES.FOOTER}">
          <button class="${QP_CLASSES.BTN} ${QP_CLASSES.REFRESH}" title="Clear all clips">🗑️</button>
          <span class="${QP_CLASSES.COUNT}">${clipCount} clips</span>
          <button class="${QP_CLASSES.BTN} ${QP_CLASSES.COPY_MULTIPLE}" id="${QP_ELEMENT_IDS.COPY_MULTIPLE}" disabled title="Copy multiple selected clips">Copy Multiple Clips</button>
        </div>
      </div>
    `;
}

/** Clamp optional cursor coords into on-screen bounds; mutate position. */
export function clampQuickPastePosition(position, x, y) {
  if (!(x && y)) return position;
  const maxX = window.innerWidth - 340;
  const maxY = window.innerHeight - 520;
  position.x = Math.min(x, maxX);
  position.y = Math.min(y, maxY);
  return position;
}

/** Apply saved/dragged position styles onto the panel container. */
export function applyQuickPastePositionStyles(container, position) {
  if (position.x !== 0 && position.x !== null) {
    container.style.left = position.x + 'px';
    container.style.right = 'auto';
  }
  if (position.y !== null && typeof position.y === 'number') {
    container.style.top = position.y + 'px';
    container.style.bottom = 'auto';
    container.style.transform = 'translateY(0)';
  }
}

export function ensureClipsContainerScroll(container) {
  const clipsContainer = container.querySelector(`.${QP_CLASSES.CLIPS_CONTAINER}`);
  if (!clipsContainer) return;
  clipsContainer.style.flex = '1';
  clipsContainer.style.overflowY = 'auto';
  clipsContainer.style.minHeight = '0';
  clipsContainer.style.paddingBottom = '8px';
}

export function clearQuickPasteSelectionStyles(container) {
  const selectedElements = container.querySelectorAll(`.${QP_CLASSES.CLIP}.${QP_CLASSES.SELECTED}`);
  selectedElements.forEach((el) => {
    el.classList.remove(QP_CLASSES.SELECTED);
    el.style.background = '';
    el.style.color = '';
    el.style.border = '';
    el.style.transform = '';
    el.style.boxShadow = '';
    el.style.outline = '';
    el.style.outlineOffset = '';
    el.style.zIndex = '';
    el.style.position = '';
  });
}

/** Refresh clips list DOM + count text; returns clipsContainer for callers. */
export function refreshQuickPasteClipsDom(container, clipsHtml, clipCount) {
  const clipsContainer = container.querySelector(`.${QP_CLASSES.CLIPS_CONTAINER}`);
  const countElement = container.querySelector(`.${QP_CLASSES.COUNT}`);
  if (clipsContainer) clipsContainer.innerHTML = clipsHtml;
  if (countElement) countElement.textContent = `${clipCount} clips`;
}

/** Keep ROOT_CLASS so Shadow DOM token vars + shell styles stay attached. */
export function applyQuickPasteTheme(container, theme) {
  container.className = `${QP_HOST.ROOT_CLASS} ${QP_HOST.INTERFACE_CLASS} ${theme}`;
  container.style.position = 'fixed';
  container.style.zIndex = '1000000';
}
