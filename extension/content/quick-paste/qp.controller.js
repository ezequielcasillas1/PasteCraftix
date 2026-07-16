/** @forward-slice — Quick Paste class shell + thin delegates to qp.* modules. */

import { createClosedShadowHost } from '../safety/shadow-host.js';
import {
  QP_DEFAULT_SETTINGS,
  QP_DEFAULT_POSITION,
  QP_HOST,
  resolveQuickPasteTheme,
} from './qp.constants.js';
import { addQuickPasteStyles } from './qp.styles.js';
import {
  loadQuickPasteClips,
  loadQuickPasteSettings,
  saveQuickPastePosition,
  saveQuickPasteSettings,
} from './qp.storage.js';
import {
  renderQuickPasteClips,
  buildQuickPasteShellHtml,
  clampQuickPastePosition,
  applyQuickPastePositionStyles,
  ensureClipsContainerScroll,
  clearQuickPasteSelectionStyles,
  refreshQuickPasteClipsDom,
} from './qp.render.js';
import {
  setupQuickPasteEventListeners,
  setupQuickPasteMessageListener,
  setupQuickPasteStorageSync,
} from './qp.events.js';
import {
  pasteQuickPasteClip,
  pasteQuickPasteClipById,
  showQuickPasteToast,
} from './qp.paste.js';
import {
  showQuickPasteSettingsModal,
  setupQuickPasteHelpModalEvents,
  showQuickPasteHelpModal,
  hideQuickPasteHelpModal,
  applyQuickPasteSettingsModalShellStyles,
  setupQuickPasteSettingsModalEvents,
  saveQuickPasteSettingsFromModal,
  hideQuickPasteSettingsModal,
} from './qp.settings-modal.js';
import {
  showQuickPasteClearAllConfirmation,
  clearAllQuickPasteClips,
  toggleQuickPasteClipSelection,
  updateQuickPasteCopyMultipleButton,
  copyMultipleQuickPasteClips,
  deleteQuickPasteClip,
  deleteQuickPasteClipById,
} from './qp.clips-actions.js';

export class QuickPasteInterface {
  constructor() {
    this.isVisible = false;
    this.clips = [];
    this.container = null;
    this.settingsModal = null;
    this.position = { ...QP_DEFAULT_POSITION }; // Default position - left side, CSS handles vertical centering
    this.settings = {
      ...QP_DEFAULT_SETTINGS,
      options: { ...QP_DEFAULT_SETTINGS.options },
    };
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    // selectedClips stores stable clip id keys (String(clip.id)), not indices.
    this.selectedClips = new Set(); // Track selected clips for multi-select

    // Serialize clip mutations to prevent races / double-click issues.
    this._clipOpQueue = Promise.resolve();
    
    this.init();
  }

  _queueClipOp(fn) {
    const run = this._clipOpQueue.then(fn, fn);
    this._clipOpQueue = run.catch(() => {});
    return run;
  }

  async init() {
    await this.loadClips();
    await this.loadSettings();
    this.createInterface();
    this.setupEventListeners();
    this.setupMessageListener();
    this.setupStorageSync();
    
    // Removed auto-show on right-click - now controlled by context menu
    
    console.log('🚀 PasteCraft Quick Paste initialized');
  }
  
  async loadClips() {
    this.clips = await loadQuickPasteClips();
  }
  
  createInterface() {
    if (this.container) {
      this.container.remove();
    }
    if (!this.shadowMount) {
      this.shadowMount = createClosedShadowHost(QP_HOST.SHADOW_HOST_ID);
      this.shadowMount.host.style.pointerEvents = 'auto';
    }
    const root = this.shadowMount.root;

    this.container = document.createElement('div');
    this.container.className = QP_HOST.ROOT_CLASS;
    this.container.setAttribute('data-field', QP_HOST.ROOT_FIELD);
    this.container.innerHTML = buildQuickPasteShellHtml(
      this.renderClips(),
      this.clips.length,
    );
    
    this.addStyles(root);
    
    // Initially hidden
    this.container.style.display = 'none';
    root.appendChild(this.container);
    this.applySettings();
  }
  
  renderClips() {
    return renderQuickPasteClips(this.clips, this.settings);
  }
  
  addStyles(root = this.shadowMount?.root) {
    addQuickPasteStyles(root);
  }
  
  setupEventListeners() {
    setupQuickPasteEventListeners(this);
  }

  setupMessageListener() {
    setupQuickPasteMessageListener(this);
  }

  setupStorageSync() {
    setupQuickPasteStorageSync(this);
  }
  
  showInterface(x, y) {
    if (!this.container) return;

    clampQuickPastePosition(this.position, x, y);
    applyQuickPastePositionStyles(this.container, this.position);

    this.container.style.display = 'block';
    this.isVisible = true;
    ensureClipsContainerScroll(this.container);
  }
  
  hideInterface() {
    if (!this.container) return;
    
    this.container.style.display = 'none';
    this.isVisible = false;
    
    console.log('🙈 Quick Paste interface hidden');
  }
  
  updateInterface() {
    if (!this.container) return;

    refreshQuickPasteClipsDom(this.container, this.renderClips(), this.clips.length);
    this.selectedClips.clear();
    clearQuickPasteSelectionStyles(this.container);
    this.updateCopyMultipleButton();
  }
  
  async pasteClip(index) {
    await pasteQuickPasteClip(this, index);
  }

  showPasteSuccess(message = 'Pasted successfully') {
    this.showToast(message, 'success');
  }

  showPasteError() {
    this.showToast('Paste failed', 'error');
  }

  showToast(message, type = 'info') {
    showQuickPasteToast(this, message, type);
  }
  
  // Settings Management
  async loadSettings() {
    const { settings, position } = await loadQuickPasteSettings(this.settings, this.position);
    this.settings = settings;
    this.position = position;
  }
  
  async savePosition() {
    await saveQuickPastePosition(this.position);
  }
  
  async saveSettings() {
    await saveQuickPasteSettings(this.settings);
  }

  showSettingsModal() {
    showQuickPasteSettingsModal(this);
  }

  setupHelpModalEvents() {
    setupQuickPasteHelpModalEvents(this);
  }

  showHelpModal() {
    showQuickPasteHelpModal(this);
  }

  hideHelpModal() {
    hideQuickPasteHelpModal(this);
  }

  applySettingsModalShellStyles() {
    applyQuickPasteSettingsModalShellStyles(this);
  }

  setupSettingsModalEvents() {
    setupQuickPasteSettingsModalEvents(this);
  }

  async saveSettingsFromModal() {
    await saveQuickPasteSettingsFromModal(this);
  }

  hideSettingsModal() {
    hideQuickPasteSettingsModal(this);
  }

  applySettings() {
    if (!this.container) return;
    
    // Keep ROOT_CLASS so Shadow DOM token vars + shell styles stay attached
    const themeClass = resolveQuickPasteTheme(this.settings.theme);
    this.settings.theme = themeClass;
    this.container.className = `${QP_HOST.ROOT_CLASS} ${QP_HOST.INTERFACE_CLASS} ${themeClass}`;
    
    // Ensure container is positioned properly for dragging
    this.container.style.position = 'fixed';
    this.container.style.zIndex = '1000000';
  }
  
  showClearAllConfirmation() {
    showQuickPasteClearAllConfirmation(this);
  }

  async clearAllClips() {
    await clearAllQuickPasteClips(this);
  }

  toggleClipSelection(index, clipElement) {
    toggleQuickPasteClipSelection(this, index, clipElement);
  }

  updateCopyMultipleButton() {
    updateQuickPasteCopyMultipleButton(this);
  }

  async copyMultipleClips() {
    await copyMultipleQuickPasteClips(this);
  }

  async deleteClip(index) {
    await deleteQuickPasteClip(this, index);
  }

  async deleteClipById(rawClipId) {
    await deleteQuickPasteClipById(this, rawClipId);
  }

  async pasteClipById(rawClipId) {
    await pasteQuickPasteClipById(this, rawClipId);
  }
}
