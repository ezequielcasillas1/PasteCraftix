import { pastecraftGetURL } from '../shared.js';
import { injectOverlayStyles } from './widget.styles.js';
import {
  openQuickViewPanel,
  closeQuickViewPanel,
  openMiniQuickViewPanel,
} from './widget.quickview.js';
import {
  sanitizeWidgetSettings as sanitizeWidgetSettingsRecord,
  loadWidgetSettings,
  saveWidgetSettings,
  openSettingsPanel,
  closeSettingsPanel,
} from './widget.settings.js';
import {
  setupWidgetStorageSync,
  setupWidgetAutoCopyListener,
  toggleWidgetAutoCopy,
  updateWidgetAutoCopyUI,
  loadWidgetAutoCopyState,
} from './widget.events.js';
import {
  createWidgetShell,
  setupWidgetDrag,
  loadSavedWidgetPosition,
  saveWidgetPosition,
  initWidgetAsync,
} from './widget.core.js';

export class PasteCraftFloatingWidget {
  constructor() {
    console.log('🎨 PasteCraftFloatingWidget constructor called');
    this.widget = null;
    this._settingsLoaded = false;
    this.isExpanded = false;
    this.position = { top: 50 }; // Percentage from top (50 = center)
    this.settings = {
      // How the main app opens from the widget/icon
      // 'inPage' (slide-in panel) | 'edgePopup' (separate window)
      appOpenMode: 'inPage',
      keepPopupOpen: true,  // Default: popup stays open when clicking outside
      keepQuickViewOpen: true,  // Default: quick view stays open
      clickAndDragEnabled: false, // Default: click & drag dropbox is off
      // Widget icon preference (single flag; image comes from current profile image)
      widgetIconUseProfileImage: false
    };

    // Click & Drag capture UI state
    this._pcClickAndDragSetup = false;
    this._pcDropBoxEl = null;
    this._pcDropBoxVisible = false;
    this._pcDragActive = false;
    
    // Track open state of each component
    this.openStates = {
      popup: false,
      settings: false,
      quickView: false
    };

    this._settingsShadowMount = null;
    this._settingsPanelEl = null;
    
    // Auto-copy feature state
    this.autoCopyEnabled = false;
    this.autoCopyCount = 0;

    // In-page popup iframe warm-cache (avoids blank panel on cold tab)
    this._popupPreloadIframe = null;
    this._popupRevealTimer = null;
    
    console.log('🔨 Creating widget...');
    createWidgetShell(this);
    console.log('✅ Widget created successfully');
    injectOverlayStyles();
    loadSavedWidgetPosition(this);
    setupWidgetDrag(this);
    this.setupStorageSync();
    this.setupClickAndDragCapture();
    this._installLazyPopupWarmer();

    initWidgetAsync(this);
  }

  async initAsync() {
    return initWidgetAsync(this);
  }

  _installLazyPopupWarmer() {
    if (this._lazyWarmerInstalled) return;
    this._lazyWarmerInstalled = true;
    try {
      const logo = this.widget?.querySelector('.logo-button');
      const trigger = () => this.warmPopupIframe();
      const target = logo || this.widget;
      if (!target) return;
      target.addEventListener('pointerenter', trigger, { once: true });
      target.addEventListener('focusin', trigger, { once: true });
    } catch (_) {}
  }

  warmPopupIframe() {
    if (this._popupPreloadIframe?.isConnected) return;
    if (document.querySelector('[data-pastecraft-popup-preload="1"]')) return;

    const iframe = document.createElement('iframe');
    iframe.src = pastecraftGetURL('popup.html');
    iframe.setAttribute('data-pastecraft-popup-preload', '1');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;left:-9999px;top:0;';
    document.body.appendChild(iframe);
    this._popupPreloadIframe = iframe;
  }

  _isPopupIframeReady(iframe) {
    try {
      return iframe?.contentDocument?.readyState === 'complete';
    } catch (_) {
      return false;
    }
  }

  _applyPopupIframeHidden(iframe) {
    if (!iframe) return;
    iframe.classList.add('pastecraft-overlay-iframe-loading');
    iframe.style.opacity = '0';
    iframe.style.visibility = 'hidden';
    iframe.style.pointerEvents = 'none';
  }

  _revealPopupIframe(iframe) {
    if (!iframe) return;
    iframe.classList.remove('pastecraft-overlay-iframe-loading');
    iframe.style.removeProperty('opacity');
    iframe.style.removeProperty('visibility');
    iframe.style.removeProperty('pointer-events');
  }

  _applyPopupLoadingShellStyles(container) {
    if (!container) return;
    container.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    container.style.transform = 'translateX(0)';
  }

  _takePopupIframe() {
    const preloaded = this._popupPreloadIframe;
    if (preloaded?.isConnected) {
      preloaded.removeAttribute('data-pastecraft-popup-preload');
      preloaded.removeAttribute('aria-hidden');
      preloaded.removeAttribute('tabindex');
      preloaded.className = 'pastecraft-overlay-iframe';
      preloaded.setAttribute('allowtransparency', 'true');
      // Keep iframe hidden until reveal — never flash the white popup document.
      preloaded.style.cssText = 'width:100%;height:100%;border:none;flex:1;min-height:0;opacity:0;visibility:hidden;pointer-events:none;';
      preloaded.classList.add('pastecraft-overlay-iframe-loading');
      this._popupPreloadIframe = null;
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

  _clearPopupRevealTimer() {
    if (this._popupRevealTimer) {
      clearTimeout(this._popupRevealTimer);
      this._popupRevealTimer = null;
    }
  }

  _forceRemovePopupOverlayDom() {
    this._clearPopupRevealTimer();
    const backdrop = document.getElementById('pastecraft-popup-backdrop');
    const container = document.getElementById('pastecraft-popup-overlay');
    if (backdrop) backdrop.remove();
    if (container) container.remove();
  }

  setupStorageSync() {
    setupWidgetStorageSync(this);
  }

  async _getProfileImageForWidget() {
    try {
      const res = await chrome.storage.local.get(['userProfile']);
      const p = res ? res.userProfile : null;
      const url = p && typeof p.profileImageUrl === 'string' ? p.profileImageUrl : '';
      if (url) return url;
      const b64 = p && typeof p.profileImageBase64 === 'string' ? p.profileImageBase64 : '';
      if (b64 && b64.startsWith('data:image/') && b64.length <= 250000) return b64;
      return '';
    } catch (_) {
      return '';
    }
  }

  async applyWidgetIcon() {
    if (!this.widget) return;
    const logoImg = this.widget.querySelector('.widget-logo');
    if (!logoImg) return;

    const defaultSrc = pastecraftGetURL('logo.svg');
    const useProfile = !!(this.settings && this.settings.widgetIconUseProfileImage);

    if (!useProfile) {
      if (logoImg.src !== defaultSrc) logoImg.src = defaultSrc;
      logoImg.classList.remove('is-profile-icon');
      return;
    }

    const src = await this._getProfileImageForWidget();
    if (!src) {
      // Fallback to default logo if profile image is missing
      logoImg.src = defaultSrc;
      logoImg.classList.remove('is-profile-icon');
      return;
    }

    // Set and fallback on error
    logoImg.classList.add('is-profile-icon');
    logoImg.onerror = () => {
      try {
        logoImg.src = defaultSrc;
        logoImg.classList.remove('is-profile-icon');
      } catch (_) {}
    };
    logoImg.src = src;
  }

  updateAutoCopyUI() {
    updateWidgetAutoCopyUI(this);
  }

  async loadSettings() {
    return loadWidgetSettings(this);
  }

  async saveSettings() {
    return saveWidgetSettings(this);
  }

  sanitizeWidgetSettings(rawSettings) {
    return sanitizeWidgetSettingsRecord(rawSettings);
  }

  ensurePageDockStyles() {
    // Inject once per page/tab
    if (document.getElementById('pastecraft-page-dock-styles')) return;

    const style = document.createElement('style');
    style.id = 'pastecraft-page-dock-styles';
    style.textContent = `
      /* PasteCraft: "docked" mode - push page content left when panel is open */
      html.pastecraft-page-pushed body {
        margin-right: var(--pastecraft-panel-width, 476px) !important;
        transition: margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }

      /* On small screens panels become full-width; don't push page */
      @media (max-width: 480px) {
        html.pastecraft-page-pushed body {
          margin-right: 0 !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  getActivePanelWidthPx() {
    // Prefer the currently-open & visible panel, fall back to 476px.
    const candidates = [
      { open: this.openStates?.popup, el: document.getElementById('pastecraft-popup-overlay') },
      { open: this.openStates?.settings, el: this._settingsPanelEl },
      { open: this.openStates?.quickView, el: document.getElementById('pastecraft-quickview-panel') }
    ];

    const pick =
      candidates.find(c => c.open && c.el && c.el.classList.contains('visible')) ||
      candidates.find(c => c.open && c.el);

    const width = pick?.el?.getBoundingClientRect?.().width;
    if (typeof width === 'number' && Number.isFinite(width) && width > 0) return width;
    return 476;
  }

  syncPageDocking() {
    this.ensurePageDockStyles();

    const shouldPush = !!(this.openStates?.popup || this.openStates?.settings || this.openStates?.quickView);
    const root = document.documentElement;
    if (!root) return;

    if (!shouldPush) {
      root.classList.remove('pastecraft-page-pushed');
      root.style.removeProperty('--pastecraft-panel-width');
      return;
    }

    const widthPx = this.getActivePanelWidthPx();
    root.style.setProperty('--pastecraft-panel-width', `${Math.round(widthPx)}px`);
    root.classList.add('pastecraft-page-pushed');
  }

  openPopupOverlay() {
    console.log('🎨 Opening popup overlay (slide-in from right)');
    injectOverlayStyles();

    const existingOverlay = document.getElementById('pastecraft-popup-overlay');
    if (existingOverlay) {
      const existingIframe = existingOverlay.querySelector('.pastecraft-overlay-iframe');
      if (existingOverlay.classList.contains('visible') && this._isPopupIframeReady(existingIframe)) {
        return;
      }
      this._forceRemovePopupOverlayDom();
    }

    this.openStates.popup = true;
    this.widget.classList.add('panel-open');
    this.syncPageDocking();

    const logoButton = this.widget.querySelector('.logo-button');
    if (logoButton) {
      logoButton.classList.add('active');
    }

    const backdrop = document.createElement('div');
    backdrop.id = 'pastecraft-popup-backdrop';
    backdrop.className = 'pastecraft-overlay-backdrop';

    const container = document.createElement('div');
    container.id = 'pastecraft-popup-overlay';
    container.className = 'pastecraft-overlay-panel pastecraft-overlay-panel-loading';
    this._applyPopupLoadingShellStyles(container);

    const closeButton = document.createElement('button');
    closeButton.className = 'pastecraft-overlay-close';
    closeButton.innerHTML = '×';
    closeButton.setAttribute('aria-label', 'Close');

    const loader = document.createElement('div');
    loader.className = 'pastecraft-overlay-loader';
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-live', 'polite');
    loader.innerHTML = '<div class="pastecraft-overlay-loader-spinner"></div><div class="pastecraft-overlay-loader-text">Loading PasteCraft…</div>';

    const iframe = this._takePopupIframe();
    const iframeReady = this._isPopupIframeReady(iframe);

    container.appendChild(closeButton);
    if (!iframeReady) {
      container.appendChild(loader);
    }
    document.body.appendChild(backdrop);
    document.body.appendChild(container);
    container.appendChild(iframe);

    const revealPopupPanel = () => {
      if (!container.isConnected) return;
      this._clearPopupRevealTimer();
      loader.remove();
      this._revealPopupIframe(iframe);
      container.classList.remove('pastecraft-overlay-panel-loading');
      container.style.removeProperty('background');
      container.style.removeProperty('transform');
      backdrop.classList.add('visible');
      container.classList.add('visible');
      this.syncPageDocking();
    };

    closeButton.addEventListener('click', () => this.closePopupOverlay());

    if (this._popupMessageHandler) {
      window.removeEventListener('message', this._popupMessageHandler);
      this._popupMessageHandler = null;
    }
    this._popupMessageHandler = (event) => {
      if (event.source !== iframe.contentWindow) return;
      if (event.data && event.data.type === 'PASTECRAFT_CLOSE_POPUP') {
        this.closePopupOverlay();
      }
    };
    window.addEventListener('message', this._popupMessageHandler);

    if (this._popupOutsidePointerDown) {
      document.removeEventListener('pointerdown', this._popupOutsidePointerDown, true);
      this._popupOutsidePointerDown = null;
    }
    if (!this.settings.keepPopupOpen) {
      this._popupOutsidePointerDown = (e) => {
        const currentContainer = document.getElementById('pastecraft-popup-overlay');
        if (!currentContainer) return;
        const target = e.target;
        if (currentContainer.contains(target)) return;
        if (this.widget && this.widget.contains(target)) return;
        this.closePopupOverlay();
      };
      document.addEventListener('pointerdown', this._popupOutsidePointerDown, true);
    }

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.closePopupOverlay();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    if (iframeReady) {
      revealPopupPanel();
    } else {
      iframe.addEventListener('load', revealPopupPanel, { once: true });
      this._popupRevealTimer = setTimeout(revealPopupPanel, 12000);
    }

    console.log('✅ Popup overlay opened');
  }
  
  closePopupOverlay() {
    this._clearPopupRevealTimer();

    const backdrop = document.getElementById('pastecraft-popup-backdrop');
    const container = document.getElementById('pastecraft-popup-overlay');
    
    // Cleanup outside click handler
    if (this._popupOutsidePointerDown) {
      document.removeEventListener('pointerdown', this._popupOutsidePointerDown, true);
      this._popupOutsidePointerDown = null;
    }
    if (this._popupMessageHandler) {
      window.removeEventListener('message', this._popupMessageHandler);
      this._popupMessageHandler = null;
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
      this.openStates.popup = false;
      
      // Slide widget back to right edge (if no other panels open)
      if (!this.openStates.settings && !this.openStates.quickView) {
        this.widget.classList.remove('panel-open');
      }
      
      // Remove active class from logo button
      const logoButton = this.widget.querySelector('.logo-button');
      if (logoButton) {
        logoButton.classList.remove('active');
      }

      // Update docked page push based on remaining panels
      this.syncPageDocking();

      // Re-warm intentionally NOT scheduled — see _installLazyPopupWarmer comment.

      console.log('✅ Popup overlay closed');
    }
  }
  
  
  _isPointerInsideWidget(e) {
    const widgetHost = this.shadowMount?.host;
    if (!widgetHost) return false;

    const target = e?.target;
    if (target === widgetHost) return true;

    const path = typeof e?.composedPath === 'function' ? e.composedPath() : [];
    return path.includes(widgetHost) || (this.widget && path.includes(this.widget));
  }

  openSettings() {
    openSettingsPanel(this);
  }

  closeSettings() {
    closeSettingsPanel(this);
  }

  toggleAutoCopy() {
    toggleWidgetAutoCopy(this);
  }

  setupAutoCopyListener() {
    setupWidgetAutoCopyListener(this);
  }

  async loadAutoCopyState() {
    return loadWidgetAutoCopyState(this);
  }

  showWidgetToast(message) {
    // Create a simple toast near the widget
    const existing = document.querySelector('.pastecraft-widget-toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'pastecraft-widget-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      right: 70px;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(30, 64, 175, 0.95);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      z-index: 2147483647;
      animation: fadeInOut 2s ease forwards;
    `;
    
    // Add animation styles if not exists
    if (!document.querySelector('#pastecraft-toast-styles')) {
      const style = document.createElement('style');
      style.id = 'pastecraft-toast-styles';
      style.textContent = `
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(-50%) translateX(10px); }
          15% { opacity: 1; transform: translateY(-50%) translateX(0); }
          85% { opacity: 1; transform: translateY(-50%) translateX(0); }
          100% { opacity: 0; transform: translateY(-50%) translateX(10px); }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  setupClickAndDragCapture() {
    if (this._pcClickAndDragSetup) return;
    this._pcClickAndDragSetup = true;

    this.ensureClickAndDragDropBox();

    // Show drop box only during active drags, and only if enabled.
    this._pcOnDragStart = (e) => {
      if (!this.settings || this.settings.clickAndDragEnabled !== true) return;
      // Ignore drags that originate from our own UI.
      const t = e && e.target ? e.target : null;
      if (t && (t.closest?.('#pastecraft-click-drag-dropbox') || t.closest?.('#pastecraft-floating-widget'))) return;

      this._pcDragActive = true;
      this.showClickAndDragDropBox();
    };

    this._pcOnDragEnd = () => {
      if (!this._pcDragActive) return;
      this._pcDragActive = false;
      this.hideClickAndDragDropBox();
    };

    document.addEventListener('dragstart', this._pcOnDragStart, true);
    document.addEventListener('dragend', this._pcOnDragEnd, true);
  }

  ensureClickAndDragDropBox() {
    if (this._pcDropBoxEl && document.body.contains(this._pcDropBoxEl)) return;

    if (!document.getElementById('pastecraft-click-drag-dropbox-styles')) {
      const iconUrl = pastecraftGetURL('assets/distribute-spacing-vertical.svg');
      const style = document.createElement('style');
      style.id = 'pastecraft-click-drag-dropbox-styles';
      style.textContent = `
        #pastecraft-click-drag-dropbox {
          position: fixed;
          width: 64px;
          height: 64px;
          border-radius: 14px;
          z-index: 2147483647;
          opacity: 0;
          transform: scale(0.92);
          pointer-events: none;
          transition: opacity 140ms ease, transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
          border: 2px solid rgba(96, 165, 250, 0.25);
          box-shadow: -6px 0 24px rgba(0,0,0,0.18), 0 6px 26px rgba(30, 64, 175, 0.22);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }

        #pastecraft-click-drag-dropbox.pc-visible {
          opacity: 1;
          transform: scale(1);
          pointer-events: auto;
        }

        #pastecraft-click-drag-dropbox .pc-dropbox-inner {
          width: 100%;
          height: 100%;
          border-radius: 12px;
          /* 70% transparent background (alpha 0.3) */
          background: linear-gradient(135deg, rgba(30, 64, 175, 0.3) 0%, rgba(30, 58, 138, 0.3) 55%, rgba(29, 78, 216, 0.3) 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          user-select: none;
        }

        #pastecraft-click-drag-dropbox .pc-dropbox-icon {
          width: 26px;
          height: 26px;
          background: linear-gradient(135deg, #fbbf24 0%, #60a5fa 45%, #2563eb 100%);
          -webkit-mask: url("${iconUrl}") center / contain no-repeat;
          mask: url("${iconUrl}") center / contain no-repeat;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35));
        }

        #pastecraft-click-drag-dropbox .pc-dropbox-label {
          font-size: 10px;
          line-height: 1;
          font-weight: 700;
          color: rgba(255,255,255,0.92);
          letter-spacing: 0.2px;
        }

        #pastecraft-click-drag-dropbox.pc-hover {
          border-color: rgba(96, 165, 250, 0.75);
          box-shadow:
            0 0 0 4px rgba(59, 130, 246, 0.20),
            0 0 0 8px rgba(245, 158, 11, 0.16),
            -6px 0 28px rgba(0,0,0,0.22),
            0 10px 30px rgba(30, 64, 175, 0.25);
        }

        #pastecraft-click-drag-dropbox.pc-success {
          border-color: rgba(245, 158, 11, 0.85);
          box-shadow:
            0 0 0 4px rgba(245, 158, 11, 0.22),
            0 0 0 8px rgba(59, 130, 246, 0.18),
            -6px 0 28px rgba(0,0,0,0.22),
            0 10px 30px rgba(30, 64, 175, 0.25);
        }
      `;
      document.head.appendChild(style);
    }

    const el = document.createElement('div');
    el.id = 'pastecraft-click-drag-dropbox';
    el.innerHTML = `
      <div class="pc-dropbox-inner" aria-hidden="true">
        <div class="pc-dropbox-icon"></div>
        <div class="pc-dropbox-label">Drop</div>
      </div>
    `;

    // Drag-over behavior (allow drop)
    el.addEventListener('dragenter', (e) => {
      e.preventDefault();
      el.classList.add('pc-hover');
    });
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      try {
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      } catch (_) {}
      el.classList.add('pc-hover');
    });
    el.addEventListener('dragleave', (e) => {
      // Only remove hover if actually leaving the element.
      const rt = e.relatedTarget;
      if (rt && el.contains(rt)) return;
      el.classList.remove('pc-hover');
    });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove('pc-hover');
      const dt = e.dataTransfer || null;
      (async () => {
        const saved = await this.saveClickAndDragFromDataTransfer(dt);
        if (saved) {
          this.flashClickAndDragDropBoxSuccess();
          this.showWidgetToast('Saved to Clips');
        } else {
          this.showWidgetToast('Nothing to save');
        }
      })();
    });

    document.body.appendChild(el);
    this._pcDropBoxEl = el;
  }

  positionClickAndDragDropBox() {
    const el = this._pcDropBoxEl;
    if (!el) return;

    const size = 64;
    const gap = 12;
    const rect = this.widget ? this.widget.getBoundingClientRect() : null;

    const x = rect
      ? Math.max(8, Math.round(rect.left - gap - size))
      : Math.max(8, window.innerWidth - 140);
    const y = rect
      ? Math.max(8, Math.round(rect.top + rect.height / 2 - size / 2))
      : Math.max(8, Math.round(window.innerHeight / 2 - size / 2));

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  showClickAndDragDropBox() {
    this.ensureClickAndDragDropBox();
    this.positionClickAndDragDropBox();
    if (!this._pcDropBoxEl) return;
    this._pcDropBoxEl.classList.add('pc-visible');
    this._pcDropBoxVisible = true;
  }

  hideClickAndDragDropBox(immediate = false) {
    if (!this._pcDropBoxEl) return;
    this._pcDropBoxEl.classList.remove('pc-hover');
    this._pcDropBoxEl.classList.remove('pc-success');
    this._pcDropBoxEl.classList.remove('pc-visible');
    this._pcDropBoxVisible = false;
    if (immediate) {
      // Force-hide immediately (some pages can keep transitions running).
      this._pcDropBoxEl.style.opacity = '0';
      this._pcDropBoxEl.style.pointerEvents = 'none';
      setTimeout(() => {
        if (!this._pcDropBoxVisible && this._pcDropBoxEl) {
          this._pcDropBoxEl.style.opacity = '';
          this._pcDropBoxEl.style.pointerEvents = '';
        }
      }, 0);
    }
  }

  flashClickAndDragDropBoxSuccess() {
    if (!this._pcDropBoxEl) return;
    this._pcDropBoxEl.classList.add('pc-success');
    clearTimeout(this._pcDropBoxSuccessTimer);
    this._pcDropBoxSuccessTimer = setTimeout(() => {
      if (this._pcDropBoxEl) this._pcDropBoxEl.classList.remove('pc-success');
    }, 650);
  }

  _pcSafeTrim(s, max) {
    const str = String(s ?? '');
    if (str.length <= max) return str;
    return str.slice(0, max) + '…';
  }

  _pcFirstUriFromUriList(uriList) {
    const raw = String(uriList || '').trim();
    if (!raw) return '';
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const l of lines) {
      if (l.startsWith('#')) continue;
      return l;
    }
    return '';
  }

  _pcTryParseUrl(s, baseUrl = '') {
    const t = String(s || '').trim();
    if (!t) return '';
    try {
      // Support relative URLs from dragged HTML (e.g., <img src="/img.png">).
      const u = baseUrl ? new URL(t, baseUrl) : new URL(t);
      return u.href;
    } catch (_) {
      return '';
    }
  }

  _pcTryParseAbsoluteHttpUrl(s) {
    const t = String(s || '').trim();
    if (!t) return '';
    // Treat "www." as URL-like for user intent, normalize to https.
    const normalized = /^www\./i.test(t) ? `https://${t}` : t;
    if (!/^https?:\/\//i.test(normalized)) return '';
    try {
      const u = new URL(normalized);
      return u.href;
    } catch (_) {
      return '';
    }
  }

  _pcLooksLikeImageUrl(u) {
    const s = String(u || '').trim();
    if (!s) return false;
    return /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(s);
  }

  _pcParseHtmlForImageOrLink(html) {
    const out = { imgSrc: '', linkHref: '' };
    const raw = String(html || '');
    if (!raw) return out;
    try {
      const doc = new DOMParser().parseFromString(raw, 'text/html');
      const img = doc.querySelector('img[src]');
      if (img) out.imgSrc = String(img.getAttribute('src') || '').trim();
      const a = doc.querySelector('a[href]');
      if (a) out.linkHref = String(a.getAttribute('href') || '').trim();
    } catch (_) {}
    return out;
  }

  _pcTextFromHtml(html) {
    const raw = String(html || '');
    if (!raw) return '';
    try {
      const doc = new DOMParser().parseFromString(raw, 'text/html');
      const t = String((doc && doc.body && (doc.body.innerText || doc.body.textContent)) || '').trim();
      return t;
    } catch (_) {
      return '';
    }
  }

  _pcSelectionText() {
    try {
      const s = window.getSelection ? window.getSelection() : null;
      const t = s ? String(s.toString() || '').trim() : '';
      return t;
    } catch (_) {
      return '';
    }
  }

  async saveClickAndDragFromDataTransfer(dt) {
    if (!dt) return false;
    if (!this.settings || this.settings.clickAndDragEnabled !== true) return false;

    const MAX_TEXT = 30000;
    const MAX_HTML = 50000;

    let plain = '';
    let html = '';
    let uriList = '';
    try { plain = dt.getData('text/plain') || ''; } catch (_) {}
    try { html = dt.getData('text/html') || ''; } catch (_) {}
    try { uriList = dt.getData('text/uri-list') || ''; } catch (_) {}

    const { imgSrc, linkHref } = this._pcParseHtmlForImageOrLink(html);
    const uriFromList = this._pcFirstUriFromUriList(uriList);

    const sourcePageUrl = String(location && location.href ? location.href : '');
    const capturedAt = Date.now();

    // Build best-effort text candidate early; used to prevent URL payloads overriding highlighted text.
    const fromPlain = String(plain || '').trim();
    const fromHtml = this._pcTextFromHtml(html);
    const fromSelection = this._pcSelectionText();
    const textCandidate = (fromPlain || fromHtml || fromSelection || '').trim();
    // IMPORTANT: do NOT treat arbitrary text as a URL just because it can be resolved as a relative URL.
    const textLooksUrl = !!this._pcTryParseAbsoluteHttpUrl(textCandidate);

    // 1) Image (match existing "Copy Image to PasteCraft": kind=image with srcUrl)
    const imgAbs = this._pcTryParseUrl(imgSrc, sourcePageUrl);
    const uriAbs = this._pcTryParseUrl(uriFromList, sourcePageUrl);
    const imageUrl = imgAbs || (this._pcLooksLikeImageUrl(uriAbs) ? uriAbs : '');

    if (imageUrl) {
      const meta = {
        kind: 'image',
        plainText: '',
        html: '',
        url: '',
        image: { mime: '', dataUrl: '', srcUrl: this._pcSafeTrim(imageUrl, 4000) },
        sourcePageUrl: this._pcSafeTrim(sourcePageUrl, 4000),
        capturedAt
      };

      await chrome.runtime.sendMessage({
        action: 'saveClip',
        text: this._pcSafeTrim(imageUrl, MAX_TEXT),
        meta,
        category: 'Uncategorized',
        autoShow: false
      });
      return true;
    }

    // 2) Text (prefer highlighted text over URL payloads, unless text is itself a URL)
    if (textCandidate && !textLooksUrl) {
      const meta = {
        kind: 'text',
        plainText: this._pcSafeTrim(textCandidate, MAX_TEXT),
        html: this._pcSafeTrim(html, MAX_HTML),
        url: '',
        sourcePageUrl: this._pcSafeTrim(sourcePageUrl, 4000),
        capturedAt
      };

      await chrome.runtime.sendMessage({
        action: 'saveClip',
        text: this._pcSafeTrim(textCandidate, MAX_TEXT),
        meta,
        category: 'Uncategorized',
        autoShow: false
      });
      return true;
    }

    // 3) URL
    const linkAbs = this._pcTryParseUrl(linkHref, sourcePageUrl);
    const url = uriAbs || linkAbs || (textLooksUrl ? this._pcTryParseAbsoluteHttpUrl(textCandidate) : '') || '';
    if (url) {
      const meta = {
        kind: 'url',
        plainText: this._pcSafeTrim(url, MAX_TEXT),
        html: '',
        url: this._pcSafeTrim(url, 4000),
        sourcePageUrl: this._pcSafeTrim(sourcePageUrl, 4000),
        capturedAt
      };

      await chrome.runtime.sendMessage({
        action: 'saveClip',
        text: this._pcSafeTrim(url, MAX_TEXT),
        meta,
        category: 'Uncategorized',
        autoShow: false
      });
      return true;
    }

    // 4) Text fallback (even if it looks like a URL, if we got here there's nothing else)
    if (textCandidate) {
      const meta = {
        kind: 'text',
        plainText: this._pcSafeTrim(textCandidate, MAX_TEXT),
        html: this._pcSafeTrim(html, MAX_HTML),
        url: '',
        sourcePageUrl: this._pcSafeTrim(sourcePageUrl, 4000),
        capturedAt
      };

      await chrome.runtime.sendMessage({
        action: 'saveClip',
        text: this._pcSafeTrim(textCandidate, MAX_TEXT),
        meta,
        category: 'Uncategorized',
        autoShow: false
      });
      return true;
    }

    return false;
  }

  openQuickView() {
    openQuickViewPanel(this);
  }

  closeQuickView() {
    closeQuickViewPanel(this);
  }

  openMiniQuickView(mode = 'window') {
    openMiniQuickViewPanel(this, mode);
  }


  loadSavedPosition() {
    loadSavedWidgetPosition(this);
  }

  savePosition() {
    saveWidgetPosition(this);
  }
}

