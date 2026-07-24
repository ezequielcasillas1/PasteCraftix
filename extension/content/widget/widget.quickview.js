/**
 * Quick View — DOM panel facade (open/refresh + public API).
 * Avoids host CSP and Comet blocking chrome-extension:// iframes.
 * @forward-slice
 */
import { injectQuickViewStyles } from './widget.styles.js';
import {
  ensureQvState,
  loadQuickViewClips,
  qvDebug,
} from './widget.quickview.load.js';
import { buildQuickViewChrome } from './widget.quickview.render.js';
import {
  closeQuickViewPanel,
  onQuickViewDelegatedClick,
  openMiniQuickViewPanel,
  populateMiniQuickViewBody,
} from './widget.quickview.actions.js';

export { closeQuickViewPanel, openMiniQuickViewPanel, populateMiniQuickViewBody };

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
