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
import {
  installLazyPopupWarmer,
  openPopupOverlayPanel,
  closePopupOverlayPanel,
  isPointerInsideWidget,
} from './widget.popup-overlay.js';
import {
  ensurePageDockStyles as ensureWidgetPageDockStyles,
  getActivePanelWidthPx as getWidgetActivePanelWidthPx,
  syncPageDocking as syncWidgetPageDocking,
} from './widget.docking.js';
import {
  setupClickAndDragCapture as setupWidgetClickAndDragCapture,
  ensureClickAndDragDropBox as ensureWidgetClickAndDragDropBox,
  positionClickAndDragDropBox as positionWidgetClickAndDragDropBox,
  showClickAndDragDropBox as showWidgetClickAndDragDropBox,
  hideClickAndDragDropBox as hideWidgetClickAndDragDropBox,
  flashClickAndDragDropBoxSuccess as flashWidgetClickAndDragDropBoxSuccess,
  saveClickAndDragFromDataTransfer as saveWidgetClickAndDragFromDataTransfer,
} from './widget.drag-capture.js';

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
    installLazyPopupWarmer(this);

    initWidgetAsync(this);
  }

  async initAsync() {
    return initWidgetAsync(this);
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
    ensureWidgetPageDockStyles(this);
  }

  getActivePanelWidthPx() {
    return getWidgetActivePanelWidthPx(this);
  }

  syncPageDocking() {
    syncWidgetPageDocking(this);
  }

  openPopupOverlay() {
    openPopupOverlayPanel(this);
  }

  closePopupOverlay() {
    closePopupOverlayPanel(this);
  }

  _isPointerInsideWidget(e) {
    return isPointerInsideWidget(this, e);
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
    setupWidgetClickAndDragCapture(this);
  }

  ensureClickAndDragDropBox() {
    ensureWidgetClickAndDragDropBox(this);
  }

  positionClickAndDragDropBox() {
    positionWidgetClickAndDragDropBox(this);
  }

  showClickAndDragDropBox() {
    showWidgetClickAndDragDropBox(this);
  }

  hideClickAndDragDropBox(immediate = false) {
    hideWidgetClickAndDragDropBox(this, immediate);
  }

  flashClickAndDragDropBoxSuccess() {
    flashWidgetClickAndDragDropBoxSuccess(this);
  }

  async saveClickAndDragFromDataTransfer(dt) {
    return saveWidgetClickAndDragFromDataTransfer(this, dt);
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

