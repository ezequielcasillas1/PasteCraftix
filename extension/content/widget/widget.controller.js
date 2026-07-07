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
import { showWidgetToast as renderWidgetToast } from './widget.toast.js';
import { applyWidgetIcon as applyWidgetProfileIcon } from './widget.profile-icon.js';

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
    this.initCaptureToolsMenu();
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

  initCaptureToolsMenu() {
    import('./widget.capture-menu.js')
      .then(({ initWidgetCaptureMenu }) => initWidgetCaptureMenu(this))
      .catch((err) => {
        console.warn('[PasteCraft] Capture Tools menu skipped:', err);
      });
  }

  setupStorageSync() {
    setupWidgetStorageSync(this);
  }

  async applyWidgetIcon() {
    return applyWidgetProfileIcon(this);
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
    renderWidgetToast(message);
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

