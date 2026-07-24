/**
 * Quick View — panel actions (click, copy, delete, close, mini).
 * @forward-slice
 */
import { slimQuickViewClips } from '../../shared/quickview-clips.js';
import { injectQuickViewStyles } from './widget.styles.js';
import {
  normalizeLikedClipId,
  toggleClipLiked,
} from './widget.liked-clips.js';
import {
  ensureQvState,
  loadQuickViewClips,
} from './widget.quickview.load.js';
import { renderQuickViewList } from './widget.quickview.render.js';

export function showQvToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = 'pastecraft-qv-toast';
  toast.textContent = message;
  if (isError) toast.classList.add('is-error');
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

export function onQuickViewDelegatedClick(widget, e) {
  const actionEl = e.target?.closest?.('[data-action]');
  if (!actionEl || !document.getElementById('pastecraft-quickview-panel')?.contains(actionEl)) {
    return;
  }
  const action = actionEl.getAttribute('data-action');
  const state = ensureQvState(widget);

  if (action === 'toggle-liked') {
    state.likedFilterOn = !state.likedFilterOn;
    actionEl.classList.toggle('liked-active', state.likedFilterOn);
    actionEl.classList.toggle('active', state.likedFilterOn);
    actionEl.setAttribute('aria-pressed', state.likedFilterOn ? 'true' : 'false');
    renderQuickViewList(widget);
    return;
  }
  if (action === 'refresh') {
    loadQuickViewClips(widget).catch(() => {});
    return;
  }
  if (action === 'open-settings') {
    closeQuickViewPanel(widget);
    setTimeout(() => widget.openSettings(), 100);
    return;
  }
  if (action === 'open-mini-window') {
    openMiniQuickViewPanel(widget, 'window');
    return;
  }
  if (action === 'open-mini-corner') {
    openMiniQuickViewPanel(widget, 'corner');
    return;
  }

  const row = actionEl.closest('.pastecraft-qv-clip');
  if (!row) return;
  const clipId = row.getAttribute('data-clip-id') || '';
  const index = Number(row.getAttribute('data-index'));
  const archived = row.getAttribute('data-archived') === '1';

  if (action === 'toggle-like') {
    toggleClipLiked(clipId).then((result) => {
      state.likedIdSet = new Set(
        (result.ids || []).map((id) => normalizeLikedClipId(id)).filter(Boolean)
      );
      // #region agent log
      console.warn('[PasteCraft:debug:liked0711]', {
        runId: 'post-fix',
        hypothesisId: 'H3',
        location: 'widget.quickview.actions.js:toggle-like',
        message: 'qv heart toggled',
        data: { clipId, liked: !!result.liked, idCount: state.likedIdSet.size },
      });
      // #endregion
      renderQuickViewList(widget);
    });
    return;
  }
  if (action === 'copy') {
    copyQuickViewClip(widget, clipId);
    return;
  }
  if (action === 'delete') {
    deleteQuickViewClip(widget, clipId, index, archived);
  }
}

export async function copyQuickViewClip(widget, clipId) {
  const state = ensureQvState(widget);
  const clip = state.allClips.find((c) => String(c.id || '') === String(clipId));
  const text = clip?.text ? String(clip.text) : '';
  if (!text) {
    showQvToast('❌ Copy failed', true);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showQvToast('✓ Copied to clipboard!');
  } catch (_) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showQvToast('✓ Copied to clipboard!');
    } catch (_) {
      showQvToast('❌ Copy failed', true);
    }
  }
}

export async function deleteQuickViewClip(widget, clipId, index, archived) {
  if (!confirm('Delete this clip?')) return;
  const state = ensureQvState(widget);
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'pcDeleteQuickViewClip',
      clipId: String(clipId || ''),
      archived: archived === true,
      index,
    });
    if (response?.success && Array.isArray(response.clips)) {
      state.allClips = slimQuickViewClips(response.clips);
      renderQuickViewList(widget);
      chrome.runtime.sendMessage({ action: 'clipsUpdated' }).catch(() => {});
    } else {
      await loadQuickViewClips(widget);
    }
  } catch (_) {
    await loadQuickViewClips(widget);
  }
}

export function closeQuickViewPanel(widget) {
  const backdrop = document.getElementById('pastecraft-quickview-backdrop');
  const panel = document.getElementById('pastecraft-quickview-panel');

  if (widget._quickViewOutsidePointerDown) {
    document.removeEventListener('pointerdown', widget._quickViewOutsidePointerDown, true);
    widget._quickViewOutsidePointerDown = null;
  }

  if (widget._quickViewEscHandler) {
    document.removeEventListener('keydown', widget._quickViewEscHandler);
    widget._quickViewEscHandler = null;
  }

  if (backdrop) backdrop.classList.remove('visible');
  if (panel) panel.classList.remove('visible');

  if (backdrop || panel) {
    setTimeout(() => {
      if (backdrop) backdrop.remove();
      if (panel) panel.remove();
    }, 300);

    widget.openStates.quickView = false;

    if (!widget.openStates.popup && !widget.openStates.settings) {
      widget.widget.classList.remove('panel-open');
    }

    const quickViewButton = widget.widget.querySelector('.quick-view-button');
    if (quickViewButton) quickViewButton.classList.remove('active');

    if (widget._quickViewStorageListener) {
      chrome.storage.onChanged.removeListener(widget._quickViewStorageListener);
      widget._quickViewStorageListener = null;
    }

    if (widget._quickViewPanelClick && panel) {
      panel.removeEventListener('click', widget._quickViewPanelClick);
      widget._quickViewPanelClick = null;
    }

    if (widget._quickViewRuntimeListener) {
      try {
        chrome.runtime.onMessage.removeListener(widget._quickViewRuntimeListener);
      } catch (_) {}
      widget._quickViewRuntimeListener = null;
    }

    widget._refreshQuickViewClips = null;
    widget._qvState = null;
    widget.syncPageDocking();
  }
}

export function openMiniQuickViewPanel(widget, mode = 'window') {
  try {
    injectQuickViewStyles();

    const existing = document.getElementById('pastecraft-mini-quickview');
    if (existing) {
      existing.classList.toggle('docked', mode === 'corner');
      existing.style.zIndex = '2147483647';
      return;
    }

    const el = document.createElement('div');
    el.id = 'pastecraft-mini-quickview';
    el.className = `pastecraft-mini-quickview${mode === 'corner' ? ' docked' : ''}`;

    const header = document.createElement('div');
    header.className = 'pastecraft-mini-quickview-header';

    const title = document.createElement('div');
    title.className = 'pastecraft-mini-quickview-title';
    title.textContent = 'Quick View (Mini)';

    const controls = document.createElement('div');
    controls.className = 'pastecraft-mini-quickview-controls';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'pastecraft-mini-quickview-btn';
    closeBtn.type = 'button';
    closeBtn.title = 'Close';
    closeBtn.textContent = '×';

    controls.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(controls);

    const body = document.createElement('div');
    body.className = 'pastecraft-mini-quickview-body';
    el.appendChild(header);
    el.appendChild(body);
    document.body.appendChild(el);

    populateMiniQuickViewBody(body);

    const storageListener = (changes, area) => {
      if (area !== 'local') return;
      if (!changes.clips && !changes.searchOnlyClips) return;
      if (!document.body.contains(el)) return;
      populateMiniQuickViewBody(body);
    };
    chrome.storage.onChanged.addListener(storageListener);

    const closeMini = () => {
      try {
        chrome.storage.onChanged.removeListener(storageListener);
      } catch (_) {}
      el.remove();
    };
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeMini();
    });

    if (mode !== 'corner') {
      const w = el.getBoundingClientRect().width || 360;
      const viewportW = Math.max(320, window.innerWidth || 0);
      const left = Math.max(12, viewportW - 476 - w - 16);
      el.style.left = `${left}px`;
      el.style.top = '90px';
    }

    const dragState = { dragging: false, dx: 0, dy: 0 };
    const onPointerMove = (e) => {
      if (!dragState.dragging) return;
      el.style.left = `${Math.max(0, e.clientX - dragState.dx)}px`;
      el.style.top = `${Math.max(0, e.clientY - dragState.dy)}px`;
    };
    const onPointerUp = () => {
      dragState.dragging = false;
      try {
        header.releasePointerCapture?.(dragState.pointerId);
      } catch (_) {}
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerUp, true);
    };

    header.addEventListener('pointerdown', (e) => {
      if (!e || e.button !== 0) return;
      if (e.target?.closest?.('.pastecraft-mini-quickview-btn')) return;
      const rect = el.getBoundingClientRect();
      el.classList.remove('docked');
      el.style.right = '';
      el.style.bottom = '';
      el.style.left = `${rect.left}px`;
      el.style.top = `${rect.top}px`;

      dragState.dragging = true;
      dragState.pointerId = e.pointerId;
      dragState.dx = e.clientX - rect.left;
      dragState.dy = e.clientY - rect.top;
      try {
        header.setPointerCapture?.(e.pointerId);
      } catch (_) {}
      window.addEventListener('pointermove', onPointerMove, true);
      window.addEventListener('pointerup', onPointerUp, true);
    });
  } catch (err) {
    console.error('❌ Error opening mini Quick View:', err);
  }
}

export async function populateMiniQuickViewBody(body) {
  if (!body) return;
  body.textContent = '';

  let active = [];
  let archived = [];
  try {
    const res = await new Promise((resolve) =>
      chrome.storage.local.get(['clips', 'searchOnlyClips'], resolve)
    );
    active = Array.isArray(res?.clips) ? res.clips : [];
    archived = Array.isArray(res?.searchOnlyClips) ? res.searchOnlyClips : [];
  } catch (_) {}

  const merged = [...active, ...archived]
    .filter((c) => c && typeof c === 'object')
    .sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0))
    .slice(0, 100);

  if (merged.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'pastecraft-mini-quickview-empty';
    empty.textContent = 'No clips yet. Right-click selected text to save your first clip.';
    body.appendChild(empty);
    return;
  }

  merged.forEach((clip) => {
    const card = document.createElement('div');
    card.className = 'pastecraft-mini-quickview-clip';
    card.title = 'Click to copy';

    const text = String(clip.text ?? '').trim() || '(empty)';
    const category = String(clip.category ?? '').trim();

    if (category) {
      const cat = document.createElement('div');
      cat.className = 'pastecraft-mini-quickview-clip-category';
      cat.textContent = category;
      card.appendChild(cat);
    }

    const txt = document.createElement('div');
    txt.className = 'pastecraft-mini-quickview-clip-text';
    txt.textContent = text;
    card.appendChild(txt);

    const flashCopied = () => {
      const original = txt.textContent;
      const originalColor = card.style.borderColor;
      txt.textContent = '✓ Copied!';
      card.style.borderColor = '#2563eb';
      setTimeout(() => {
        txt.textContent = original;
        card.style.borderColor = originalColor;
      }, 800);
    };

    card.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
        flashCopied();
      } catch (_) {
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
          flashCopied();
        } catch (_) {}
      }
    });

    body.appendChild(card);
  });
}
