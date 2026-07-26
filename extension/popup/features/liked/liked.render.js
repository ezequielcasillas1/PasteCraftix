import {
  filterLikedClips,
  getLikedClipIds,
  setClipLiked,
} from '../../../shared/liked-clips.js';
import { showTabLoadingState } from '../../shared/tab-loading.js';
import { getClipIdKey, getClipTitle, getClipFallbackTitle } from '../clips/clips.state.js';
import { LIKED_SELECTORS, LIKED_TAB } from './liked.constants.js';

function byId(id) {
  return document.getElementById(id);
}

function getLikedElements() {
  return {
    container: byId(LIKED_SELECTORS.CONTAINER),
    countEl: byId(LIKED_SELECTORS.COUNT),
    copyAllBtn: byId(LIKED_SELECTORS.COPY_ALL),
    clearAllBtn: byId(LIKED_SELECTORS.CLEAR_ALL),
  };
}

function collectCandidateClips(app) {
  const active = Array.isArray(app.clips) ? app.clips : [];
  const archived = Array.isArray(app.searchOnlyClips) ? app.searchOnlyClips : [];
  return [...active, ...archived];
}

export function getLikedClipsForApp(app) {
  const likedIds = app.likedClipIds instanceof Set
    ? [...app.likedClipIds]
    : [];
  return filterLikedClips(collectCandidateClips(app), likedIds);
}

/** When memory join misses, re-read clips from chrome.storage.local. */
export async function resolveLikedClipsForApp(app) {
  const likedIds = app.likedClipIds instanceof Set ? [...app.likedClipIds] : [];
  let matched = filterLikedClips(collectCandidateClips(app), likedIds);
  if (matched.length > 0 || likedIds.length === 0) return matched;

  try {
    const result = await chrome.storage.local.get(['clips', 'searchOnlyClips']);
    const stored = [
      ...(Array.isArray(result?.clips) ? result.clips : []),
      ...(Array.isArray(result?.searchOnlyClips) ? result.searchOnlyClips : []),
    ];
    matched = filterLikedClips(stored, likedIds);
  } catch (_) {
    /* keep memory result */
  }
  return matched;
}

function escapeHtml(app, text) {
  if (typeof app.escapeHtml === 'function') return app.escapeHtml(text);
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}

function getTimeAgo(app, timestamp) {
  if (typeof app.getTimeAgo === 'function') return app.getTimeAgo(timestamp);
  return '';
}

function paintIcons(root) {
  window.renderLucideIconsSync?.(root);
}

export async function hydrateLikedTab(app) {
  try {
    const ids = await getLikedClipIds();
    const existing = app.likedClipIds instanceof Set ? app.likedClipIds : new Set();
    // Merge so an in-flight like is not wiped by a stale hydrate read.
    app.likedClipIds = new Set([...existing, ...ids]);
    return [...app.likedClipIds];
  } catch (error) {
    if (!(app.likedClipIds instanceof Set)) app.likedClipIds = new Set();
    throw error;
  }
}

function paintLikedEmpty(container, { orphanCount = 0 } = {}) {
  if (orphanCount > 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="heart"></i></div>
        <h3>${orphanCount} liked id${orphanCount === 1 ? '' : 's'} not in local clips</h3>
        <p>Hearts were saved, but those clips are not loaded in this popup yet. Open Clips/Search or sync, then reopen Liked.</p>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="heart"></i></div>
        <h3>No liked clips yet</h3>
        <p>Tap the heart on any clip to save it here</p>
        <div class="demo-hint">
          <span class="demo-step">♡ Like on Clips</span>
          <span class="demo-step">♡ Open Liked</span>
          <span class="demo-step">📋 Copy favorites fast</span>
        </div>
      </div>
    `;
  }
  paintIcons(container);
}

function paintLikedRows(app, container, likedClips) {
  container.innerHTML = '';
  likedClips.forEach((clip) => {
    const clipIdKey = getClipIdKey(clip?.id);
    const title = getClipTitle(clip) || getClipFallbackTitle(clip, 64);
    const preview = String(clip?.text || '').replace(/\s+/g, ' ').trim();
    const shortPreview = preview.length > 120 ? `${preview.slice(0, 120)}…` : preview;
    const timeAgo = getTimeAgo(app, clip?.timestamp);

    const row = document.createElement('div');
    row.className = 'liked-clip-row';
    row.dataset.clipId = clipIdKey;
    row.innerHTML = `
      <button class="liked-unlike-btn liked" type="button" title="Remove from liked" aria-label="Unlike clip" aria-pressed="true">
        <i data-lucide="heart"></i>
      </button>
      <div class="liked-clip-body">
        <div class="liked-clip-title">${escapeHtml(app, title)}</div>
        <div class="liked-clip-preview" title="${escapeHtml(app, preview)}">${escapeHtml(app, shortPreview)}</div>
      </div>
      <span class="liked-clip-time">${escapeHtml(app, timeAgo)}</span>
      <div class="liked-clip-actions">
        <button class="liked-open-btn" type="button" title="Open" aria-label="Open clip"><i data-lucide="search"></i></button>
        <button class="liked-copy-btn" type="button" title="Copy" aria-label="Copy clip"><i data-lucide="clipboard"></i></button>
      </div>
    `;

    row.querySelector('.liked-unlike-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await setClipLiked(clipIdKey, false);
      if (app.likedClipIds instanceof Set) app.likedClipIds.delete(clipIdKey);
      void renderLikedPage(app);
      if (typeof app.renderChips === 'function') app.renderChips();
    });

    row.querySelector('.liked-copy-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (typeof app.copyClipToClipboard === 'function') {
        await app.copyClipToClipboard(clip || '');
      }
    });

    row.querySelector('.liked-open-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof app.openClipViewer === 'function') app.openClipViewer(clip, 'liked');
    });

    row.addEventListener('click', async (e) => {
      if (e.target.closest('button')) return;
      if (app.quickPasteSettings?.oneClickCopy && typeof app.copyClipToClipboard === 'function') {
        await app.copyClipToClipboard(clip || '');
      }
    });

    container.appendChild(row);
  });

  paintIcons(container);
}

export function renderLikedPage(app) {
  const { container, countEl, copyAllBtn, clearAllBtn } = getLikedElements();
  if (!container) return;

  if (!(app.likedClipIds instanceof Set)) {
    showTabLoadingState(LIKED_TAB);
    return;
  }

  const likedIdCount = app.likedClipIds.size;
  const likedClips = getLikedClipsForApp(app);

  if (countEl) {
    countEl.textContent = `${likedClips.length} liked`;
  }
  if (copyAllBtn) copyAllBtn.disabled = likedClips.length === 0;
  if (clearAllBtn) clearAllBtn.disabled = likedClips.length === 0;

  if (likedClips.length === 0) {
    paintLikedEmpty(container, { orphanCount: likedIdCount });
    if (likedIdCount > 0) {
      void resolveLikedClipsForApp(app).then((resolved) => {
        if (app.currentTab !== 'liked') return;
        if (!Array.isArray(resolved) || resolved.length === 0) return;
        if (countEl) countEl.textContent = `${resolved.length} liked`;
        if (copyAllBtn) copyAllBtn.disabled = false;
        if (clearAllBtn) clearAllBtn.disabled = false;
        paintLikedRows(app, container, resolved);
      });
    }
    return;
  }

  paintLikedRows(app, container, likedClips);
}

export async function copyAllLiked(app) {
  let likedClips = getLikedClipsForApp(app);
  if (likedClips.length === 0) {
    likedClips = await resolveLikedClipsForApp(app);
  }
  if (likedClips.length === 0) return false;
  const delimiter = app.quickPasteSettings?.delimiter || '\n\n';
  const text = likedClips.map((c) => c?.text || '').filter(Boolean).join(delimiter);
  if (!text) return false;
  if (typeof app.copyClipToClipboard === 'function') {
    await app.copyClipToClipboard(text);
    return true;
  }
  return false;
}

export async function clearAllLiked(app) {
  const likedIds = app.likedClipIds instanceof Set ? [...app.likedClipIds] : [];
  if (likedIds.length === 0) return 0;
  for (const id of likedIds) {
    await setClipLiked(id, false);
  }
  app.likedClipIds = new Set();
  renderLikedPage(app);
  if (typeof app.renderChips === 'function') app.renderChips();
  return likedIds.length;
}

export function setupLikedPageEvents(app) {
  const { copyAllBtn, clearAllBtn } = getLikedElements();
  if (copyAllBtn && !copyAllBtn.dataset.likedBound) {
    copyAllBtn.dataset.likedBound = '1';
    copyAllBtn.addEventListener('click', async () => {
      const ok = await copyAllLiked(app);
      if (ok && typeof app.showToast === 'function') {
        app.showToast('Copied all liked clips', 'success');
      }
    });
  }
  if (clearAllBtn && !clearAllBtn.dataset.likedBound) {
    clearAllBtn.dataset.likedBound = '1';
    clearAllBtn.addEventListener('click', async () => {
      if (!confirm('Remove all clips from Liked?')) return;
      const n = await clearAllLiked(app);
      if (n > 0 && typeof app.showToast === 'function') {
        app.showToast(`Cleared ${n} liked clip${n === 1 ? '' : 's'}`, 'success');
      }
    });
  }
}
