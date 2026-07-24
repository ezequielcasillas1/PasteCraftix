/**
 * Quick View — DOM chrome + clip list rendering.
 * @forward-slice
 */
import {
  normalizeLikedClipId,
} from './widget.liked-clips.js';
import { ensureQvState } from './widget.quickview.load.js';

export const HEART_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';

export function buildQuickViewChrome(widget) {
  const root = document.createElement('div');
  root.className = 'pastecraft-qv-chrome';

  const header = document.createElement('div');
  header.className = 'pastecraft-qv-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'pastecraft-qv-title';
  const titleText = document.createElement('span');
  titleText.textContent = '👁 Quick View';
  const count = document.createElement('span');
  count.className = 'pastecraft-qv-count';
  count.setAttribute('data-field', 'qv-count');
  count.textContent = '…';
  titleWrap.appendChild(titleText);
  titleWrap.appendChild(count);

  const controls = document.createElement('div');
  controls.className = 'pastecraft-qv-controls';

  const likedBtn = document.createElement('button');
  likedBtn.type = 'button';
  likedBtn.className = 'pastecraft-qv-btn';
  likedBtn.setAttribute('data-action', 'toggle-liked');
  likedBtn.title = 'Liked clips';
  likedBtn.setAttribute('aria-label', 'Show liked clips');
  likedBtn.setAttribute('aria-pressed', 'false');
  likedBtn.innerHTML = HEART_SVG;

  const miniWin = document.createElement('button');
  miniWin.type = 'button';
  miniWin.className = 'pastecraft-qv-btn';
  miniWin.setAttribute('data-action', 'open-mini-window');
  miniWin.title = 'Open mini Quick View (window)';
  miniWin.setAttribute('aria-label', 'Open mini Quick View window');
  miniWin.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 4v4"/><path d="M2 8h20"/><path d="M6 4v4"/></svg>';

  const miniCorner = document.createElement('button');
  miniCorner.type = 'button';
  miniCorner.className = 'pastecraft-qv-btn';
  miniCorner.setAttribute('data-action', 'open-mini-corner');
  miniCorner.title = 'Open mini Quick View (bottom-right)';
  miniCorner.setAttribute('aria-label', 'Dock mini Quick View to bottom-right');
  miniCorner.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 13V19H13"/><path d="M5 5L19 19"/></svg>';

  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'pastecraft-qv-btn';
  refreshBtn.setAttribute('data-action', 'refresh');
  refreshBtn.title = 'Refresh';
  refreshBtn.textContent = '🔄';

  const settingsBtn = document.createElement('button');
  settingsBtn.type = 'button';
  settingsBtn.className = 'pastecraft-qv-btn';
  settingsBtn.setAttribute('data-action', 'open-settings');
  settingsBtn.title = 'Settings';
  settingsBtn.textContent = '⚙️';

  controls.append(likedBtn, miniWin, miniCorner, refreshBtn, settingsBtn);
  header.append(titleWrap, controls);

  const content = document.createElement('div');
  content.className = 'pastecraft-qv-content';
  content.setAttribute('data-field', 'qv-content');
  content.innerHTML =
    '<div class="pastecraft-qv-empty"><div class="pastecraft-qv-empty-icon">✨</div><div class="pastecraft-qv-empty-text">Loading clips…</div><div class="pastecraft-qv-empty-hint">Fetching from PasteCraft storage</div></div>';

  root.append(header, content);
  return root;
}

export function renderQuickViewList(widget) {
  const panel = document.getElementById('pastecraft-quickview-panel');
  if (!panel) return;
  const state = ensureQvState(widget);
  const container = panel.querySelector('[data-field="qv-content"]');
  const counter = panel.querySelector('[data-field="qv-count"]');
  if (!container) return;

  const visible = state.likedFilterOn
    ? state.allClips.filter((c) => state.likedIdSet.has(normalizeLikedClipId(c.id)))
    : state.allClips;

  if (counter) {
    counter.textContent = state.likedFilterOn
      ? `${visible.length} liked`
      : `${visible.length} clip${visible.length !== 1 ? 's' : ''}`;
  }

  container.textContent = '';

  if (visible.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'pastecraft-qv-empty';
    const icon = document.createElement('div');
    icon.className = 'pastecraft-qv-empty-icon';
    icon.textContent = state.likedFilterOn ? '♡' : '✨';
    const text = document.createElement('div');
    text.className = 'pastecraft-qv-empty-text';
    text.textContent = state.likedFilterOn ? 'No liked clips yet' : 'No clips saved yet';
    const hint = document.createElement('div');
    hint.className = 'pastecraft-qv-empty-hint';
    hint.textContent = state.likedFilterOn
      ? 'Tap the heart on a clip to add it here'
      : 'Right-click selected text to save clips';
    empty.append(icon, text, hint);
    container.appendChild(empty);
    return;
  }

  visible.forEach((clip, index) => {
    container.appendChild(createQuickViewClipRow(clip, index, state.likedIdSet));
  });
}

export function createQuickViewClipRow(clip, index, likedIdSet) {
  const text = clip.text || '';
  const displayText = text.length > 60 ? `${text.substring(0, 60)}...` : text;
  const category = clip.category || 'Uncategorized';
  const clipId = normalizeLikedClipId(clip.id) || String(index);
  const isArchived = !!(clip.archived === true || clip.source === 'archived');
  const isLiked = likedIdSet.has(clipId);

  const row = document.createElement('div');
  row.className = 'pastecraft-qv-clip';
  row.setAttribute('data-clip-id', clipId);
  row.setAttribute('data-index', String(index));
  row.setAttribute('data-archived', isArchived ? '1' : '0');

  const likeBtn = document.createElement('button');
  likeBtn.type = 'button';
  likeBtn.className = `pastecraft-qv-like${isLiked ? ' liked' : ''}`;
  likeBtn.setAttribute('data-action', 'toggle-like');
  likeBtn.title = isLiked ? 'Remove from liked' : 'Add to liked';
  likeBtn.setAttribute('aria-label', likeBtn.title);
  likeBtn.setAttribute('aria-pressed', isLiked ? 'true' : 'false');
  likeBtn.innerHTML = HEART_SVG;

  const body = document.createElement('div');
  body.className = 'pastecraft-qv-clip-body';
  const txt = document.createElement('div');
  txt.className = 'pastecraft-qv-clip-text';
  txt.title = text;
  txt.textContent = displayText;
  const meta = document.createElement('div');
  meta.className = 'pastecraft-qv-clip-meta';
  const cat = document.createElement('span');
  cat.className = 'pastecraft-qv-clip-category';
  cat.textContent = category;
  meta.appendChild(cat);
  body.append(txt, meta);

  const actions = document.createElement('div');
  actions.className = 'pastecraft-qv-clip-actions';
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'pastecraft-qv-clip-btn';
  copyBtn.setAttribute('data-action', 'copy');
  copyBtn.title = 'Copy';
  copyBtn.textContent = '📋';
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'pastecraft-qv-clip-btn delete';
  delBtn.setAttribute('data-action', 'delete');
  delBtn.title = 'Delete';
  delBtn.textContent = '×';
  actions.append(copyBtn, delBtn);

  row.append(likeBtn, body, actions);
  return row;
}
