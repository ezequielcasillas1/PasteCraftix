import { safeRuntimeSendMessage, pastecraftGetURL, PASTECRAFT_PAGE_ORIGIN } from '../shared.js';
import { createClosedShadowHost } from '../safety/shadow-host.js';
import {
  clipIdKey,
} from './qp.helpers.js';
import {
  QP_STORAGE_KEYS,
  QP_DEFAULT_SETTINGS,
  QP_DEFAULT_POSITION,
  QP_HOST,
  QP_CLASSES,
  QP_ELEMENT_IDS,
  QP_DELIMITER,
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
    // Create confirmation modal
    const confirmModal = document.createElement('div');
    const themeClass = resolveQuickPasteTheme(this.settings.theme);
    confirmModal.className = `${QP_CLASSES.CONFIRM_MODAL} ${themeClass}`;
    confirmModal.innerHTML = `
      <div class="${QP_CLASSES.MODAL_BACKDROP}"></div>
      <div class="${QP_CLASSES.MODAL_CONTENT}">
        <div class="pastecraft-modal-header">
          <h3>🗑️ Clear All Clips</h3>
        </div>
        <div class="${QP_CLASSES.MODAL_BODY}">
          <p>Are you sure you want to delete all ${this.clips.length} clips?</p>
          <p><strong>This action cannot be undone.</strong></p>
        </div>
        <div class="${QP_CLASSES.MODAL_ACTIONS}">
          <button class="${QP_CLASSES.BTN_SECONDARY}" id="${QP_ELEMENT_IDS.CANCEL_CLEAR_ALL}">Cancel</button>
          <button class="pastecraft-btn-danger" id="${QP_ELEMENT_IDS.CONFIRM_CLEAR_ALL}">Delete All Clips</button>
        </div>
      </div>
    `;
    
    const root = this.shadowMount?.root || document.body;
    root.appendChild(confirmModal);
    
    // Setup event listeners
    confirmModal.querySelector(`#${QP_ELEMENT_IDS.CANCEL_CLEAR_ALL}`).addEventListener('click', () => {
      confirmModal.remove();
    });
    
    confirmModal.querySelector(`#${QP_ELEMENT_IDS.CONFIRM_CLEAR_ALL}`).addEventListener('click', async () => {
      await this.clearAllClips();
      confirmModal.remove();
    });
    
    // Close on backdrop click
    confirmModal.querySelector(`.${QP_CLASSES.MODAL_BACKDROP}`).addEventListener('click', () => {
      confirmModal.remove();
    });
  }
  
  async clearAllClips() {
    try {
      console.log('🗑️ Clearing all clips...');
      
      // Clear from storage
      await chrome.storage.local.set({ 
        [QP_STORAGE_KEYS.CLIPS]: [],
        [QP_STORAGE_KEYS.ARCHIVED]: [], // Also clear archived clips
        [QP_STORAGE_KEYS.UPDATED_AT]: Date.now()
      });
      
      // Update local state
      this.clips = [];
      
      // Update interface
      this.updateInterface();
      
      // Show success message
      this.showToast('All clips deleted!', 'success');
      
      console.log('✅ All clips cleared successfully');
      
      // Notify other tabs about the clear
      try {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'clipsCleared'
            }).catch(() => {}); // Ignore errors for tabs without content script
          });
        });
      } catch (error) {
        console.log('Could not notify other tabs about clear:', error);
      }
      
    } catch (error) {
      console.error('❌ Failed to clear clips:', error);
      this.showToast('Failed to clear clips', 'error');
    }
  }
  
  // NEW: Multi-select functionality methods
  toggleClipSelection(index, clipElement) {
    console.log('🎯 TOGGLE SELECTION START:', {
      index,
      element: clipElement,
      currentClasses: clipElement.className,
      isSelected: this.selectedClips.has(String(index))
    });
    
    const clipIdKey = String(index);
    if (this.selectedClips.has(clipIdKey)) {
      // Deselect - remove inline styles
      this.selectedClips.delete(clipIdKey);
      clipElement.classList.remove(QP_CLASSES.SELECTED);
      clipElement.style.background = '';
      clipElement.style.color = '';
      clipElement.style.border = '';
      clipElement.style.transform = '';
      clipElement.style.boxShadow = '';
      clipElement.style.outline = '';
      clipElement.style.outlineOffset = '';
      clipElement.style.zIndex = '';
      clipElement.style.position = '';
      console.log(`❌ DESELECTED clip ${index} - REMOVED INLINE STYLES`);
    } else {
      // Select - add class twice for nuclear specificity
      this.selectedClips.add(clipIdKey);
      clipElement.classList.add(QP_CLASSES.SELECTED);
      // Force immediate style application
      clipElement.style.background = 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)';
      clipElement.style.color = 'white';
      clipElement.style.border = '4px solid #ff6b35';
      clipElement.style.transform = 'scale(1.08)';
      clipElement.style.boxShadow = '0 8px 25px rgba(255, 107, 53, 0.9)';
      clipElement.style.outline = '3px solid rgba(255, 107, 53, 0.5)';
      clipElement.style.outlineOffset = '2px';
      clipElement.style.zIndex = '50';
      clipElement.style.position = 'relative';
      console.log(`✅ SELECTED clip ${index} with INLINE STYLES`);
    }
    
    console.log('🎨 FINAL CLASSES:', clipElement.className);
    console.log('📊 SELECTED CLIPS SET:', Array.from(this.selectedClips));
    
    // Force a style recalculation
    clipElement.offsetHeight;
    
    this.updateCopyMultipleButton();
  }
  
  updateCopyMultipleButton() {
    const button = this.container.querySelector(`.${QP_CLASSES.COPY_MULTIPLE}`);
    if (!button) return;
    
    const selectedCount = this.selectedClips.size;
    console.log(`🔘 Updating Copy Multiple Button - Selected: ${selectedCount}`);
    
    if (selectedCount >= 2) {
      button.disabled = false;
      button.textContent = `Copy ${selectedCount} Clips`;
      button.style.background = '#2563eb';
      console.log('✅ Copy Multiple Button ENABLED');
    } else {
      button.disabled = true;
      button.textContent = 'Copy Multiple Clips';
      button.style.background = '#d1d5db';
      console.log('❌ Copy Multiple Button DISABLED');
    }
  }
  
  async copyMultipleClips() {
    if (this.selectedClips.size < 2) return;
    
    // Get selected clips text (preserve UI order)
    const selected = this.selectedClips;
    const orderedIds = [];
    const domClips = this.container ? this.container.querySelectorAll(`.${QP_CLASSES.CLIP}`) : [];
    if (domClips && domClips.length > 0) {
      domClips.forEach(el => {
        const id = el?.dataset?.clipId;
        if (id && selected.has(id)) orderedIds.push(id);
      });
    }
    if (orderedIds.length === 0) {
      this.clips.forEach(c => {
        const id = clipIdKey(c?.id);
        if (selected.has(id)) orderedIds.push(id);
      });
    }

    let selectedClipsData = orderedIds
      .map(id => this.clips.find(c => clipIdKey(c?.id) === id))
      .filter(Boolean)
      .map(clip => clip.text);
    
    // Apply formatting options
    if (this.settings.options.deduplicate) {
      selectedClipsData = [...new Set(selectedClipsData)]; // Remove duplicates
    }
    
    if (this.settings.options.sort) {
      selectedClipsData.sort(); // Sort alphabetically
    }
    
    if (this.settings.options.uppercase) {
      selectedClipsData = selectedClipsData.map(text => text.toUpperCase());
    }
    
    // Apply delimiter
    let delimiter = QP_DELIMITER.FALLBACK_JOIN; // Default
    switch (this.settings.delimiter) {
      case QP_DELIMITER.COMMA:
        delimiter = QP_DELIMITER.VALUES.comma;
        break;
      case QP_DELIMITER.NEWLINE:
        delimiter = QP_DELIMITER.VALUES.newline;
        break;
      case QP_DELIMITER.SPACE:
        delimiter = QP_DELIMITER.VALUES.space;
        break;
      case QP_DELIMITER.CUSTOM:
        delimiter = this.settings.customDelimiter || QP_DELIMITER.VALUES.comma;
        break;
    }
    
    const formattedText = selectedClipsData.join(delimiter);
    
    try {
      await navigator.clipboard.writeText(formattedText);
      
      // Show success toast
      this.showToast(`📋 Copied ${this.selectedClips.size} clips!`, 'success');
      
      // Clear selections
      this.selectedClips.clear();
      
      // Update UI
      const selectedElements = this.container.querySelectorAll(`.${QP_CLASSES.CLIP}.${QP_CLASSES.SELECTED}`);
      selectedElements.forEach(el => el.classList.remove(QP_CLASSES.SELECTED));
      this.updateCopyMultipleButton();
      
      console.log(`✅ Successfully copied ${this.selectedClips.size} clips`);
    } catch (error) {
      console.error('❌ Failed to copy multiple clips:', error);
      this.showToast('❌ Failed to copy clips', 'error');
    }
  }
  
  // NEW: Delete individual clip functionality
  async deleteClip(index) {
    // Back-compat wrapper: delete by visible index
    const clip = this.clips?.[index];
    if (!clip) return;
    await this.deleteClipById(clipIdKey(clip?.id));
  }

  async deleteClipById(rawClipId) {
    const id = String(rawClipId || '');
    if (!id) return;

    return this._queueClipOp(async () => {
      const before = this.clips.length;
      const clip = this.clips.find(c => clipIdKey(c?.id) === id);

      // Compute next state
      this.clips = this.clips.filter(c => clipIdKey(c?.id) !== id);
      const deleted = before - this.clips.length;

      // Idempotent no-op
      if (deleted === 0) {
        this.selectedClips.delete(id);
        this.updateCopyMultipleButton();
        return;
      }

      // Persist once
      await chrome.storage.local.set({
        [QP_STORAGE_KEYS.CLIPS]: this.clips,
        [QP_STORAGE_KEYS.UPDATED_AT]: Date.now(),
      });

      // Update UI
      this.updateInterface();

      // Show success toast
      const preview = clip && clip.text ? String(clip.text).substring(0, 30) : 'clip';
      this.showToast(`🗑️ Deleted clip: "${preview}..."`, 'success');

      console.log(`✅ Deleted clip ${id}`);

      // Notify other tabs about the change
      try {
        chrome.runtime.sendMessage({ action: 'clipsUpdated' });
      } catch (_) {}
    });
  }

  async pasteClipById(rawClipId) {
    const id = String(rawClipId || '');
    if (!id) return;
    const clip = this.clips.find(c => clipIdKey(c?.id) === id);
    if (!clip) return;
    const index = this.clips.indexOf(clip);
    if (index >= 0) return this.pasteClip(index);
  }
}

// PasteCraft Floating Widget (Monica.ai Style)
