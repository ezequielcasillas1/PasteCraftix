/**
 * Quick View panel — extension-page iframe (not srcdoc).
 * Self-loads clips via background so host-page CSP cannot block the UI script.
 */
import { getClipIdKey } from './shared/clip-id.js';
import { slimQuickViewClips } from './shared/quickview-clips.js';

const LIKED_KEY = 'likedClipIds';
const HEART_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';

const DEBUG = 'qv-sync-0711';
function qvDebug(hypothesisId, message, data) {
  // #region agent log
  console.warn(
    `[PasteCraft:debug:${DEBUG}] ${hypothesisId} ${message} | ${JSON.stringify(data || {})}`
  );
  // #endregion
}

let allClips = [];
let likedIdSet = new Set();
let likedFilterOn = false;

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function postToParent(msg) {
  try {
    window.parent.postMessage({ ...msg, source: 'pastecraft-quickview-panel' }, '*');
  } catch (_) {}
}

function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.textContent = message;
  const bgColor = isError ? '#ef4444' : '#2563eb';
  toast.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);background:${bgColor};color:white;padding:10px 20px;border-radius:8px;z-index:9999;font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.15)`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

function toLikedIdList(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const id = getClipIdKey(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

async function getLikedIds() {
  try {
    const result = await chrome.storage.local.get([LIKED_KEY]);
    return toLikedIdList(result?.[LIKED_KEY]);
  } catch (_) {
    return [];
  }
}

async function toggleLiked(clipId) {
  const id = getClipIdKey(clipId);
  if (!id) return;
  const current = await getLikedIds();
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  await chrome.storage.local.set({ [LIKED_KEY]: next });
  likedIdSet = new Set(next);
  render();
}

async function loadClips() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'pcGetQuickViewClips' });
    const clips = response?.success && Array.isArray(response.clips) ? response.clips : [];
    allClips = slimQuickViewClips(clips);
    likedIdSet = new Set(await getLikedIds());
    qvDebug('H5', 'panel self-load', { ok: !!response?.success, count: allClips.length });
    render();
    postToParent({ type: 'quickview-clips-ack', count: allClips.length, totalCount: allClips.length });
  } catch (err) {
    qvDebug('H5', 'panel self-load failed', { error: String(err?.message || err) });
    allClips = [];
    render();
  }
}

function render() {
  const container = document.getElementById('quickview-content');
  const counter = document.getElementById('clip-count');
  if (!container) return;

  const visible = likedFilterOn
    ? allClips.filter((c) => likedIdSet.has(getClipIdKey(c.id)))
    : allClips;

  if (counter) {
    counter.textContent = likedFilterOn
      ? `${visible.length} liked`
      : `${visible.length} clip${visible.length !== 1 ? 's' : ''}`;
  }

  if (visible.length === 0) {
    container.innerHTML = likedFilterOn
      ? `<div class="empty-state"><div class="empty-icon">♡</div><div class="empty-text">No liked clips yet</div><div class="empty-hint">Tap the heart on a clip to add it here</div></div>`
      : `<div class="empty-state"><div class="empty-icon">✨</div><div class="empty-text">No clips saved yet</div><div class="empty-hint">Right-click selected text to save clips</div></div>`;
    return;
  }

  container.innerHTML = visible
    .map((clip, index) => {
      const text = clip.text || '';
      const displayText = text.length > 60 ? `${text.substring(0, 60)}...` : text;
      const category = clip.category || 'Uncategorized';
      const clipId = getClipIdKey(clip.id) || String(index);
      const isArchived = !!(clip.archived === true || clip.source === 'archived');
      const isLiked = likedIdSet.has(clipId);
      const likeClass = isLiked ? ' liked' : '';
      const likeTitle = isLiked ? 'Remove from liked' : 'Add to liked';
      return `
        <div class="clip-item" data-clip-id="${escapeHtml(clipId)}" data-index="${index}" data-archived="${isArchived ? '1' : '0'}">
          <button type="button" class="clip-like-btn${likeClass}" data-action="toggle-like" title="${likeTitle}" aria-label="${likeTitle}" aria-pressed="${isLiked ? 'true' : 'false'}">${HEART_SVG}</button>
          <div class="clip-content">
            <div class="clip-text" title="${escapeHtml(text)}">${escapeHtml(displayText)}</div>
            <div class="clip-meta"><span class="clip-category">${escapeHtml(category)}</span></div>
          </div>
          <div class="clip-actions">
            <button type="button" class="clip-btn" data-action="copy" title="Copy">📋</button>
            <button type="button" class="clip-btn delete" data-action="delete" title="Delete">×</button>
          </div>
        </div>`;
    })
    .join('');
}

async function copyClip(clipId) {
  const clip = allClips.find((c) => String(c.id || '') === String(clipId));
  const text = clip?.text ? String(clip.text) : '';
  if (!text) {
    showToast('❌ Copy failed', true);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast('✓ Copied to clipboard!');
  } catch (_) {
    showToast('❌ Copy failed', true);
  }
}

async function deleteClip(clipId, index, archived) {
  if (!confirm('Delete this clip?')) return;
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'pcDeleteQuickViewClip',
      clipId: String(clipId || ''),
      archived: archived === true,
      index,
    });
    if (response?.success && Array.isArray(response.clips)) {
      allClips = slimQuickViewClips(response.clips);
      render();
      chrome.runtime.sendMessage({ action: 'clipsUpdated' }).catch(() => {});
    } else {
      await loadClips();
    }
  } catch (_) {
    await loadClips();
  }
}

function onDelegatedClick(e) {
  const actionEl = e.target?.closest?.('[data-action]');
  if (!actionEl) return;
  const action = actionEl.getAttribute('data-action');

  if (action === 'toggle-liked') {
    likedFilterOn = !likedFilterOn;
    actionEl.classList.toggle('liked-active', likedFilterOn);
    actionEl.classList.toggle('active', likedFilterOn);
    actionEl.setAttribute('aria-pressed', likedFilterOn ? 'true' : 'false');
    render();
    return;
  }
  if (action === 'refresh') {
    loadClips();
    return;
  }
  if (action === 'open-settings') {
    postToParent({ type: 'quickview-open-settings' });
    return;
  }
  if (action === 'open-mini-window') {
    postToParent({ type: 'quickview-open-mini', mode: 'window' });
    return;
  }
  if (action === 'open-mini-corner') {
    postToParent({ type: 'quickview-open-mini', mode: 'corner' });
    return;
  }

  const row = actionEl.closest('.clip-item');
  if (!row) return;
  const clipId = row.getAttribute('data-clip-id') || '';
  const index = Number(row.getAttribute('data-index'));
  const archived = row.getAttribute('data-archived') === '1';

  if (action === 'toggle-like') {
    toggleLiked(clipId);
    return;
  }
  if (action === 'copy') {
    copyClip(clipId);
    return;
  }
  if (action === 'delete') {
    deleteClip(clipId, index, archived);
  }
}

window.addEventListener('message', (e) => {
  if (!e?.data || e.data.source !== 'pastecraft-widget') return;
  if (e.data.type === 'quickview-parent-refresh') {
    loadClips();
  }
});

document.addEventListener('click', onDelegatedClick);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.clips || changes.searchOnlyClips || changes[LIKED_KEY]) {
    loadClips();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.action === 'clipsUpdated' || message?.action === 'clipSaved') {
    loadClips();
  }
});

loadClips();
qvDebug('H5', 'panel boot', { href: location.href });
