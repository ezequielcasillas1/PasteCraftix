/**
 * Quick View — DOM panel in the content-script page (no iframe / srcdoc).
 * Avoids host CSP and Comet blocking chrome-extension:// iframes.
 */
import { slimQuickViewClips } from '../../shared/quickview-clips.js';
import { injectQuickViewStyles } from './widget.styles.js';
import {
  getLikedClipIds,
  normalizeLikedClipId,
  toggleClipLiked,
} from './widget.liked-clips.js';

const DEBUG_QV = 'qv-sync-0711';
const HEART_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';

function qvDebug(hypothesisId, location, message, data) {
  // #region agent log
  console.warn(
    `[PasteCraft:debug:${DEBUG_QV}] ${hypothesisId} ${message} | ${JSON.stringify(data || {})}`,
    { runId: 'post-fix', hypothesisId, location, message, data }
  );
  // #endregion
}

function ensureQvState(widget) {
  if (!widget._qvState) {
    widget._qvState = {
      allClips: [],
      likedIdSet: new Set(),
      likedFilterOn: false,
    };
  }
  return widget._qvState;
}

function showQvToast(message, isError = false) {
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

/** Refresh alias — kept name for widget.events.js callers. */
export async function pushQuickViewClipsToIframe(_ignored) {
  const panel = document.getElementById('pastecraft-quickview-panel');
  if (!panel) return;
  const widget = panel._pastecraftWidget;
  if (!widget) return;
  await loadQuickViewClips(widget);
}

export function openQuickViewPanel(widget) {
  try {
    const existing = document.getElementById('pastecraft-quickview-panel');
    if (existing) {
      if (typeof widget._refreshQuickViewClips === 'function') {
        widget._refreshQuickViewClips();
      } else {
        pushQuickViewClipsToIframe().catch(() => {});
      }
      return;
    }

    widget.openStates.quickView = true;
    widget.widget.classList.add('panel-open');
    widget.syncPageDocking();

    const quickViewButton = widget.widget.querySelector('.quick-view-button');
    if (quickViewButton) quickViewButton.classList.add('active');

    ensureQvState(widget);

    const backdrop = document.createElement('div');
    backdrop.id = 'pastecraft-quickview-backdrop';
    backdrop.className = 'pastecraft-quickview-backdrop';

    const panel = document.createElement('div');
    panel.id = 'pastecraft-quickview-panel';
    panel.className = 'pastecraft-quickview-panel';
    panel._pastecraftWidget = widget;

    const closeButton = document.createElement('button');
    closeButton.className = 'pastecraft-overlay-close pastecraft-qv-close';
    closeButton.type = 'button';
    closeButton.textContent = '×';
    closeButton.setAttribute('aria-label', 'Close');

    const qvChrome = buildQuickViewChrome(widget);
    panel.appendChild(closeButton);
    panel.appendChild(qvChrome);
    document.body.appendChild(backdrop);
    document.body.appendChild(panel);

    injectQuickViewStyles();

    widget._refreshQuickViewClips = () => loadQuickViewClips(widget);

    const onPanelClick = (e) => onQuickViewDelegatedClick(widget, e);
    panel.addEventListener('click', onPanelClick);
    widget._quickViewPanelClick = onPanelClick;

    const storageListener = (changes, area) => {
      if (area !== 'local') return;
      if (!changes.clips && !changes.searchOnlyClips && !changes.likedClipIds) return;
      if (!document.getElementById('pastecraft-quickview-panel')) return;
      loadQuickViewClips(widget).catch(() => {});
    };
    chrome.storage.onChanged.addListener(storageListener);
    widget._quickViewStorageListener = storageListener;

    const runtimeListener = (message) => {
      if (message?.action === 'clipsUpdated' || message?.action === 'clipSaved') {
        loadQuickViewClips(widget).catch(() => {});
      }
    };
    chrome.runtime.onMessage.addListener(runtimeListener);
    widget._quickViewRuntimeListener = runtimeListener;

    closeButton.addEventListener('click', () => closeQuickViewPanel(widget));

    if (widget._quickViewOutsidePointerDown) {
      document.removeEventListener('pointerdown', widget._quickViewOutsidePointerDown, true);
      widget._quickViewOutsidePointerDown = null;
    }
    if (!widget.settings.keepQuickViewOpen) {
      widget._quickViewOutsidePointerDown = (e) => {
        const currentPanel = document.getElementById('pastecraft-quickview-panel');
        if (!currentPanel) return;
        const target = e.target;
        if (currentPanel.contains(target)) return;
        if (widget.widget && widget.widget.contains(target)) return;
        closeQuickViewPanel(widget);
      };
      document.addEventListener('pointerdown', widget._quickViewOutsidePointerDown, true);
    }

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeQuickViewPanel(widget);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
    widget._quickViewEscHandler = escHandler;

    setTimeout(() => {
      backdrop.classList.add('visible');
      panel.classList.add('visible');
      widget.syncPageDocking();
    }, 10);

    loadQuickViewClips(widget).catch(() => {});
    qvDebug('H7', 'widget.quickview.js:openQuickViewPanel', 'opened DOM Quick View', {});
  } catch (error) {
    console.error('❌ Error opening Quick View:', error);
    alert('Error opening Quick View. Check console for details.');
  }
}

function buildQuickViewChrome(widget) {
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

async function loadQuickViewClips(widget) {
  const state = ensureQvState(widget);
  try {
    const response = await chrome.runtime.sendMessage({ action: 'pcGetQuickViewClips' });
    const clips = response?.success && Array.isArray(response.clips) ? response.clips : [];
    state.allClips = slimQuickViewClips(clips);
    state.likedIdSet = new Set(await getLikedClipIds());
    qvDebug('H7', 'widget.quickview.js:loadQuickViewClips', 'DOM path loaded', {
      ok: !!response?.success,
      count: state.allClips.length,
    });
    renderQuickViewList(widget);
  } catch (err) {
    qvDebug('H7', 'widget.quickview.js:loadQuickViewClips', 'DOM path failed', {
      error: String(err?.message || err),
    });
    state.allClips = [];
    renderQuickViewList(widget);
  }
}

function renderQuickViewList(widget) {
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

function createQuickViewClipRow(clip, index, likedIdSet) {
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

function onQuickViewDelegatedClick(widget, e) {
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
        location: 'widget.quickview.js:toggle-like',
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

async function copyQuickViewClip(widget, clipId) {
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

async function deleteQuickViewClip(widget, clipId, index, archived) {
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
