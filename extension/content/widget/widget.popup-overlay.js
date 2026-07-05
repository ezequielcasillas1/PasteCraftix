import { pastecraftGetURL } from '../shared.js';
import { injectOverlayStyles } from './widget.styles.js';

export function warmPopupIframe(widget) {
  if (widget._popupPreloadIframe?.isConnected) return;
  if (document.querySelector('[data-pastecraft-popup-preload="1"]')) return;

  const iframe = document.createElement('iframe');
  iframe.src = pastecraftGetURL('popup.html');
  iframe.setAttribute('data-pastecraft-popup-preload', '1');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.tabIndex = -1;
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;left:-9999px;top:0;';
  document.body.appendChild(iframe);
  widget._popupPreloadIframe = iframe;
}

export function installLazyPopupWarmer(widget) {
  if (widget._lazyWarmerInstalled) return;
  widget._lazyWarmerInstalled = true;
  try {
    const logo = widget.widget?.querySelector('.logo-button');
    const trigger = () => {
      try {
        warmPopupIframe(widget);
      } catch (_) {}
    };
    const target = logo || widget.widget;
    if (!target) return;
    target.addEventListener('pointerenter', trigger, { once: true });
    target.addEventListener('focusin', trigger, { once: true });
  } catch (_) {}
}

export function isPopupIframeReady(widget, iframe) {
  try {
    return iframe?.contentDocument?.readyState === 'complete';
  } catch (_) {
    return false;
  }
}

export function applyPopupIframeHidden(widget, iframe) {
  if (!iframe) return;
  iframe.classList.add('pastecraft-overlay-iframe-loading');
  iframe.style.opacity = '0';
  iframe.style.visibility = 'hidden';
  iframe.style.pointerEvents = 'none';
}

export function revealPopupIframe(widget, iframe) {
  if (!iframe) return;
  iframe.classList.remove('pastecraft-overlay-iframe-loading');
  iframe.style.removeProperty('opacity');
  iframe.style.removeProperty('visibility');
  iframe.style.removeProperty('pointer-events');
}

export function applyPopupLoadingShellStyles(widget, container) {
  if (!container) return;
  container.style.background = 'linear-gradient(135deg, #2563eb 0%, #1a1f5e 100%)';
  container.style.transform = 'translateX(0)';
}

export function takePopupIframe(widget) {
  const preloaded = widget._popupPreloadIframe;
  if (preloaded?.isConnected) {
    preloaded.removeAttribute('data-pastecraft-popup-preload');
    preloaded.removeAttribute('aria-hidden');
    preloaded.removeAttribute('tabindex');
    preloaded.className = 'pastecraft-overlay-iframe';
    preloaded.setAttribute('allowtransparency', 'true');
    // Keep iframe hidden until reveal — never flash the white popup document.
    preloaded.style.cssText = 'width:100%;height:100%;border:none;flex:1;min-height:0;opacity:0;visibility:hidden;pointer-events:none;';
    preloaded.classList.add('pastecraft-overlay-iframe-loading');
    widget._popupPreloadIframe = null;
    // Re-warm intentionally NOT scheduled here — caused popup init contention
    // across tabs. User opens panel again will be a cold cycle (still fast).
    return preloaded;
  }

  const iframe = document.createElement('iframe');
  iframe.src = pastecraftGetURL('popup.html');
  iframe.className = 'pastecraft-overlay-iframe pastecraft-overlay-iframe-loading';
  iframe.setAttribute('allowtransparency', 'true');
  iframe.style.cssText = 'width:100%;height:100%;border:none;flex:1;min-height:0;opacity:0;visibility:hidden;pointer-events:none;';
  return iframe;
}

export function clearPopupRevealTimer(widget) {
  if (widget._popupRevealTimer) {
    clearTimeout(widget._popupRevealTimer);
    widget._popupRevealTimer = null;
  }
}

export function forceRemovePopupOverlayDom(widget) {
  clearPopupRevealTimer(widget);
  const backdrop = document.getElementById('pastecraft-popup-backdrop');
  const container = document.getElementById('pastecraft-popup-overlay');
  if (backdrop) backdrop.remove();
  if (container) container.remove();
}

export function openPopupOverlayPanel(widget) {
  console.log('🎨 Opening popup overlay (slide-in from right)');
  injectOverlayStyles();

  const existingOverlay = document.getElementById('pastecraft-popup-overlay');
  if (existingOverlay) {
    const existingIframe = existingOverlay.querySelector('.pastecraft-overlay-iframe');
    if (existingOverlay.classList.contains('visible') && isPopupIframeReady(widget, existingIframe)) {
      return;
    }
    forceRemovePopupOverlayDom(widget);
  }

  widget.openStates.popup = true;
  widget.widget.classList.add('panel-open');
  widget.syncPageDocking();

  const logoButton = widget.widget.querySelector('.logo-button');
  if (logoButton) {
    logoButton.classList.add('active');
  }

  const backdrop = document.createElement('div');
  backdrop.id = 'pastecraft-popup-backdrop';
  backdrop.className = 'pastecraft-overlay-backdrop';

  const container = document.createElement('div');
  container.id = 'pastecraft-popup-overlay';
  container.className = 'pastecraft-overlay-panel pastecraft-overlay-panel-loading';
  applyPopupLoadingShellStyles(widget, container);

  const closeButton = document.createElement('button');
  closeButton.className = 'pastecraft-overlay-close';
  closeButton.innerHTML = '×';
  closeButton.setAttribute('aria-label', 'Close');

  const loader = document.createElement('div');
  loader.className = 'pastecraft-overlay-loader';
  loader.setAttribute('role', 'status');
  loader.setAttribute('aria-live', 'polite');
  loader.innerHTML = '<div class="pastecraft-overlay-loader-spinner"></div><div class="pastecraft-overlay-loader-text">Loading PasteCraft…</div>';

  const iframe = takePopupIframe(widget);
  const iframeReady = isPopupIframeReady(widget, iframe);

  container.appendChild(closeButton);
  if (!iframeReady) {
    container.appendChild(loader);
  }
  document.body.appendChild(backdrop);
  document.body.appendChild(container);
  container.appendChild(iframe);

  const revealPopupPanel = () => {
    if (!container.isConnected) return;
    clearPopupRevealTimer(widget);
    loader.remove();
    revealPopupIframe(widget, iframe);
    container.classList.remove('pastecraft-overlay-panel-loading');
    container.style.removeProperty('background');
    container.style.removeProperty('transform');
    backdrop.classList.add('visible');
    container.classList.add('visible');
    widget.syncPageDocking();
  };

  closeButton.addEventListener('click', () => closePopupOverlayPanel(widget));

  if (widget._popupMessageHandler) {
    window.removeEventListener('message', widget._popupMessageHandler);
    widget._popupMessageHandler = null;
  }
  widget._popupMessageHandler = (event) => {
    if (event.source !== iframe.contentWindow) return;
    if (event.data && event.data.type === 'PASTECRAFT_CLOSE_POPUP') {
      closePopupOverlayPanel(widget);
    }
  };
  window.addEventListener('message', widget._popupMessageHandler);

  if (widget._popupOutsidePointerDown) {
    document.removeEventListener('pointerdown', widget._popupOutsidePointerDown, true);
    widget._popupOutsidePointerDown = null;
  }
  if (!widget.settings.keepPopupOpen) {
    widget._popupOutsidePointerDown = (e) => {
      const currentContainer = document.getElementById('pastecraft-popup-overlay');
      if (!currentContainer) return;
      const target = e.target;
      if (currentContainer.contains(target)) return;
      if (widget.widget && widget.widget.contains(target)) return;
      closePopupOverlayPanel(widget);
    };
    document.addEventListener('pointerdown', widget._popupOutsidePointerDown, true);
  }

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closePopupOverlayPanel(widget);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  if (iframeReady) {
    revealPopupPanel();
  } else {
    iframe.addEventListener('load', revealPopupPanel, { once: true });
    widget._popupRevealTimer = setTimeout(revealPopupPanel, 12000);
  }

  console.log('✅ Popup overlay opened');
}

export function closePopupOverlayPanel(widget) {
  clearPopupRevealTimer(widget);

  const backdrop = document.getElementById('pastecraft-popup-backdrop');
  const container = document.getElementById('pastecraft-popup-overlay');

  // Cleanup outside click handler
  if (widget._popupOutsidePointerDown) {
    document.removeEventListener('pointerdown', widget._popupOutsidePointerDown, true);
    widget._popupOutsidePointerDown = null;
  }
  if (widget._popupMessageHandler) {
    window.removeEventListener('message', widget._popupMessageHandler);
    widget._popupMessageHandler = null;
  }

  if (backdrop) backdrop.classList.remove('visible');
  if (container) container.classList.remove('visible');
  if (backdrop || container) {
    // Remove after animation
    setTimeout(() => {
      if (backdrop) backdrop.remove();
      if (container) container.remove();
    }, 300);

    // Update open state
    widget.openStates.popup = false;

    // Slide widget back to right edge (if no other panels open)
    if (!widget.openStates.settings && !widget.openStates.quickView) {
      widget.widget.classList.remove('panel-open');
    }

    // Remove active class from logo button
    const logoButton = widget.widget.querySelector('.logo-button');
    if (logoButton) {
      logoButton.classList.remove('active');
    }

    // Update docked page push based on remaining panels
    widget.syncPageDocking();

    // Re-warm intentionally NOT scheduled — see installLazyPopupWarmer comment.

    console.log('✅ Popup overlay closed');
  }
}

export function isPointerInsideWidget(widget, e) {
  const widgetHost = widget.shadowMount?.host;
  if (!widgetHost) return false;

  const target = e?.target;
  if (target === widgetHost) return true;

  const path = typeof e?.composedPath === 'function' ? e.composedPath() : [];
  return path.includes(widgetHost) || (widget.widget && path.includes(widget.widget));
}
