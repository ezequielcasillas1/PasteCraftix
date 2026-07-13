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
  QP_LIMITS,
  QP_DELIMITER,
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
  applyQuickPasteTheme,
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
    console.log('🔧 showSettingsModal called');
    if (this.settingsModal) {
      console.log('🗑️ Removing existing settings modal');
      this.settingsModal.remove();
    }
    
    console.log('📝 Creating new settings modal');
    this.settingsModal = document.createElement('div');
    this.settingsModal.className = QP_CLASSES.SETTINGS_MODAL;
    const d = QP_DELIMITER;
    const active = QP_CLASSES.ACTIVE;
    this.settingsModal.innerHTML = `
      <div class="${QP_CLASSES.MODAL_BACKDROP}"></div>
      <div class="${QP_CLASSES.MODAL_CONTENT}">
        <div class="pastecraft-modal-header">
          <h3>⚙️ Quick Paste Settings</h3>
          <div class="${QP_CLASSES.MODAL_ACTIONS}">
            <button class="${QP_CLASSES.HELP_BTN}" title="Help & Information">❓</button>
            <button class="${QP_CLASSES.MODAL_CLOSE}">×</button>
          </div>
        </div>
        <div class="${QP_CLASSES.MODAL_BODY}">
          <div class="${QP_CLASSES.SETTING}">
            <label>
              <input type="checkbox" id="${QP_ELEMENT_IDS.AUTO_HIDE}" ${this.settings.autoHide ? 'checked' : ''}>
              Auto-hide after paste
            </label>
          </div>
          <div class="${QP_CLASSES.SETTING}">
            <label>
              <input type="checkbox" id="${QP_ELEMENT_IDS.SHOW_TIMESTAMPS}" ${this.settings.showTimestamps ? 'checked' : ''}>
              Show timestamps
            </label>
          </div>
          <div class="${QP_CLASSES.SETTING}">
            <label>Max clips to display</label>
            <input type="number" id="${QP_ELEMENT_IDS.MAX_CLIPS}" value="${this.settings.maxClipsDisplay}" min="${QP_LIMITS.MAX_CLIPS_MIN}" max="${QP_LIMITS.MAX_CLIPS_MAX}">
          </div>
          
          <!-- Delimiter Settings -->
          <div class="${QP_CLASSES.SETTING_GROUP}">
            <label class="${QP_CLASSES.SETTING_LABEL}">Delimiter</label>
            <div class="${QP_CLASSES.SEGMENTED_CONTROL}" id="${QP_ELEMENT_IDS.DELIMITER_CONTROL}">
              <button class="${QP_CLASSES.SEGMENT_BTN} ${this.settings.delimiter === d.COMMA ? active : ''}" data-delimiter="${d.COMMA}">Comma</button>
              <button class="${QP_CLASSES.SEGMENT_BTN} ${this.settings.delimiter === d.NEWLINE ? active : ''}" data-delimiter="${d.NEWLINE}">Newline</button>
              <button class="${QP_CLASSES.SEGMENT_BTN} ${this.settings.delimiter === d.SPACE ? active : ''}" data-delimiter="${d.SPACE}">Space</button>
              <button class="${QP_CLASSES.SEGMENT_BTN} ${this.settings.delimiter === d.CUSTOM ? active : ''}" data-delimiter="${d.CUSTOM}">Custom</button>
            </div>
            <input type="text" id="${QP_ELEMENT_IDS.CUSTOM_DELIMITER}" value="${this.settings.customDelimiter}" 
                   style="display: ${this.settings.delimiter === d.CUSTOM ? 'block' : 'none'}; margin-top: 8px; padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px;" 
                   placeholder="Enter custom delimiter">
          </div>
          
          <!-- Options Settings -->
          <div class="${QP_CLASSES.SETTING_GROUP}">
            <label class="${QP_CLASSES.SETTING_LABEL}">Options</label>
            <div class="pastecraft-toggles">
              <label class="${QP_CLASSES.TOGGLE}">
                <input type="checkbox" id="${QP_ELEMENT_IDS.DEDUPLICATE}" ${this.settings.options.deduplicate ? 'checked' : ''}>
                <div class="${QP_CLASSES.TOGGLE_SWITCH}"></div>
                <span>🔄 Deduplicate</span>
              </label>
              <label class="${QP_CLASSES.TOGGLE}">
                <input type="checkbox" id="${QP_ELEMENT_IDS.SORT}" ${this.settings.options.sort ? 'checked' : ''}>
                <div class="${QP_CLASSES.TOGGLE_SWITCH}"></div>
                <span>⬆️ Sort A→Z</span>
              </label>
              <label class="${QP_CLASSES.TOGGLE}">
                <input type="checkbox" id="${QP_ELEMENT_IDS.UPPERCASE}" ${this.settings.options.uppercase ? 'checked' : ''}>
                <div class="${QP_CLASSES.TOGGLE_SWITCH}"></div>
                <span>Aa UPPERCASE</span>
              </label>
            </div>
          </div>
        </div>
        <div class="${QP_CLASSES.MODAL_ACTIONS}">
          <button class="${QP_CLASSES.BTN_SECONDARY}" id="${QP_ELEMENT_IDS.CANCEL_SETTINGS}">Cancel</button>
          <button class="${QP_CLASSES.BTN_PRIMARY}" id="${QP_ELEMENT_IDS.SAVE_SETTINGS}">Save</button>
        </div>
      </div>
    `;
    
    // Create help page modal
    this.helpModal = document.createElement('div');
    this.helpModal.className = QP_CLASSES.HELP_MODAL;
    this.helpModal.innerHTML = `
      <div class="${QP_CLASSES.MODAL_BACKDROP}"></div>
      <div class="${QP_CLASSES.MODAL_CONTENT}">
        <div class="pastecraft-modal-header">
          <h3>❓ Quick Paste Help & Information</h3>
          <div class="${QP_CLASSES.MODAL_ACTIONS}">
            <button class="${QP_CLASSES.BACK_BTN}" title="Back to Settings">←</button>
            <button class="${QP_CLASSES.MODAL_CLOSE}">×</button>
          </div>
        </div>
        <div class="pastecraft-modal-body help-content">
          <div class="help-section">
            <h4>⚡ Interface Behavior</h4>
            <div class="help-item">
              <strong>Auto-hide after paste:</strong> Automatically closes the Quick Paste interface after pasting a clip, keeping your screen clean
            </div>
            <div class="help-item">
              <strong>Show timestamps:</strong> Displays how long ago each clip was saved (e.g., '2m ago', '1h ago') for better organization
            </div>
            <div class="help-item">
              <strong>Max clips to display:</strong> Controls how many clips appear in the interface (5-50). Fewer clips = faster loading
            </div>
          </div>
          
          <div class="help-section">
            <h4>📝 Text Processing Options</h4>
            <div class="help-item">
              <strong>Delimiter:</strong> Choose how to separate multiple clips when copying them together:
              <ul>
                <li><strong>Comma:</strong> "clip1, clip2, clip3"</li>
                <li><strong>Newline:</strong> Each clip on a new line</li>
                <li><strong>Space:</strong> "clip1 clip2 clip3"</li>
                <li><strong>Custom:</strong> Define your own separator</li>
              </ul>
            </div>
            <div class="help-item">
              <strong>🔄 Deduplicate:</strong> Automatically removes duplicate clips when copying multiple selections, preventing repetition
            </div>
            <div class="help-item">
              <strong>⬆️ Sort A→Z:</strong> Alphabetically sorts clips when copying multiple selections for consistent organization
            </div>
            <div class="help-item">
              <strong>Aa UPPERCASE:</strong> Converts all text to uppercase when copying multiple selections for emphasis
            </div>
          </div>
          
          <div class="help-section">
            <h4>💡 Pro Tips</h4>
            <div class="help-item">
              • Drag the interface header to move it anywhere on the page
            </div>
            <div class="help-item">
              • Use keyboard shortcuts for faster access (configure in main settings)
            </div>
            <div class="help-item">
              • Organize clips into categories for better management
            </div>
            <div class="help-item">
              • Enable auto-hide to keep your workflow uninterrupted
            </div>
          </div>
        </div>
        <div class="pastecraft-modal-actions">
          <button class="${QP_CLASSES.BTN_PRIMARY}" id="${QP_ELEMENT_IDS.BACK_TO_SETTINGS}">← Back to Settings</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.settingsModal);
    document.body.appendChild(this.helpModal);
    console.log('✅ Settings and help modals added to DOM');
    
    // 🎨 FORCE BEAUTIFUL STYLES WITH INLINE CSS
    console.log('🎨 Applying beautiful inline styles...');
    this.applyBeautifulSettingsStyles();
    
    this.setupSettingsModalEvents();
    console.log('✅ Settings modal events setup complete');
    
    // Setup help modal events
    this.setupHelpModalEvents();
  }
  
  setupHelpModalEvents() {
    if (!this.helpModal) return;
    
    // Close button
    this.helpModal.querySelector(`.${QP_CLASSES.MODAL_CLOSE}`).addEventListener('click', () => {
      this.hideHelpModal();
    });
    
    // Back button
    this.helpModal.querySelector(`.${QP_CLASSES.BACK_BTN}`).addEventListener('click', () => {
      this.hideHelpModal();
    });
    
    // Back to settings button
    this.helpModal.querySelector(`#${QP_ELEMENT_IDS.BACK_TO_SETTINGS}`).addEventListener('click', () => {
      this.hideHelpModal();
    });
    
    // Backdrop click
    this.helpModal.querySelector(`.${QP_CLASSES.MODAL_BACKDROP}`).addEventListener('click', () => {
      this.hideHelpModal();
    });
    
    console.log('✅ Help modal events setup complete');
  }
  
  showHelpModal() {
    console.log('🔍 Help modal requested');
    if (this.helpModal) {
      this.helpModal.style.display = 'flex';
      console.log('✅ Help modal shown');
    }
  }
  
  hideHelpModal() {
    console.log('🙈 Help modal hidden');
    if (this.helpModal) {
      this.helpModal.style.display = 'none';
    }
  }
  
  applyBeautifulSettingsStyles() {
    if (!this.settingsModal) return;
    
    console.log('🎨 Forcing beautiful settings modal styles...');
    
    // Modal content
    const modalContent = this.settingsModal.querySelector(`.${QP_CLASSES.MODAL_CONTENT}`);
    if (modalContent) {
      modalContent.style.cssText = `
        background: white !important;
        border-radius: 12px !important;
        width: 450px !important;
        max-width: 90vw !important;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3) !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        overflow: hidden !important;
      `;
    }
    
    // Modal body
    const modalBody = this.settingsModal.querySelector(`.${QP_CLASSES.MODAL_BODY}`);
    if (modalBody) {
      modalBody.style.cssText = `
        padding: 0 !important;
        max-height: 60vh !important;
        overflow-y: auto !important;
      `;
    }
    
    // Settings
    const settings = this.settingsModal.querySelectorAll(`.${QP_CLASSES.SETTING}`);
    settings.forEach(setting => {
      setting.style.cssText = `
        padding: 20px 24px !important;
        border-bottom: 1px solid #f3f4f6 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        min-height: 60px !important;
        margin: 0 !important;
      `;
      
      const label = setting.querySelector('label');
      if (label) {
        label.style.cssText = `
          font-weight: 500 !important;
          color: #374151 !important;
          font-size: 14px !important;
          margin: 0 !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        `;
      }
      
      const select = setting.querySelector('select');
      if (select) {
        select.style.cssText = `
          padding: 8px 12px !important;
          border: 1.5px solid #d1d5db !important;
          border-radius: 8px !important;
          font-size: 14px !important;
          background: white !important;
          color: #374151 !important;
          min-width: 120px !important;
        `;
      }
      
      const numberInput = setting.querySelector('input[type="number"]');
      if (numberInput) {
        numberInput.style.cssText = `
          padding: 8px 12px !important;
          border: 1.5px solid #d1d5db !important;
          border-radius: 8px !important;
          font-size: 14px !important;
          background: white !important;
          color: #374151 !important;
          min-width: 120px !important;
        `;
      }
      
      const checkbox = setting.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.style.cssText = `
          width: 18px !important;
          height: 18px !important;
          accent-color: #3b82f6 !important;
          cursor: pointer !important;
        `;
      }
    });
    
    // Setting groups
    const settingGroups = this.settingsModal.querySelectorAll(`.${QP_CLASSES.SETTING_GROUP}`);
    settingGroups.forEach(group => {
      group.style.cssText = `
        margin: 0 !important;
        padding: 24px !important;
        border-bottom: 1px solid #f3f4f6 !important;
        background: white !important;
      `;
      
      const label = group.querySelector(`.${QP_CLASSES.SETTING_LABEL}`);
      if (label) {
        label.style.cssText = `
          display: block !important;
          font-weight: 600 !important;
          margin-bottom: 16px !important;
          color: #1f2937 !important;
          font-size: 15px !important;
          letter-spacing: -0.025em !important;
        `;
      }
      
      // Segmented control
      const segmentedControl = group.querySelector(`.${QP_CLASSES.SEGMENTED_CONTROL}`);
      if (segmentedControl) {
        segmentedControl.style.cssText = `
          display: flex !important;
          background: #f3f4f6 !important;
          border-radius: 10px !important;
          padding: 4px !important;
          gap: 2px !important;
        `;
        
        const buttons = segmentedControl.querySelectorAll(`.${QP_CLASSES.SEGMENT_BTN}`);
        buttons.forEach(btn => {
          btn.style.cssText = `
            flex: 1 !important;
            padding: 10px 16px !important;
            border: none !important;
            background: transparent !important;
            color: #6b7280 !important;
            cursor: pointer !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            border-radius: 6px !important;
            transition: all 0.2s ease !important;
          `;
          
          if (btn.classList.contains(QP_CLASSES.ACTIVE)) {
            btn.style.cssText += `
              background: white !important;
              color: #1f2937 !important;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
            `;
          }
        });
      }
      
      // Toggles
      const toggles = group.querySelectorAll(`.${QP_CLASSES.TOGGLE}`);
      toggles.forEach(toggle => {
        toggle.style.cssText = `
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          cursor: pointer !important;
          padding: 12px 16px !important;
          background: #f8fafc !important;
          border-radius: 10px !important;
          border: 1px solid #e2e8f0 !important;
          margin-bottom: 16px !important;
        `;
        
        const toggleSwitch = toggle.querySelector(`.${QP_CLASSES.TOGGLE_SWITCH}`);
        if (toggleSwitch) {
          toggleSwitch.style.cssText = `
            width: 44px !important;
            height: 24px !important;
            background: #cbd5e1 !important;
            border-radius: 12px !important;
            position: relative !important;
            transition: all 0.3s ease !important;
            flex-shrink: 0 !important;
          `;
          
          const checkbox = toggle.querySelector('input[type="checkbox"]');
          if (checkbox && checkbox.checked) {
            toggleSwitch.style.background = '#3b82f6 !important';
          }
        }
        
        const span = toggle.querySelector('span');
        if (span) {
          span.style.cssText = `
            font-weight: 500 !important;
            color: #374151 !important;
            font-size: 14px !important;
          `;
        }
      });
    });
    
    // Modal actions
    const modalActions = this.settingsModal.querySelector(`.${QP_CLASSES.MODAL_ACTIONS}`);
    if (modalActions) {
      modalActions.style.cssText = `
        display: flex !important;
        gap: 12px !important;
        padding: 24px !important;
        background: #f8fafc !important;
        border-top: 1px solid #f1f5f9 !important;
        justify-content: flex-end !important;
      `;
      
      const secondaryBtn = modalActions.querySelector(`.${QP_CLASSES.BTN_SECONDARY}`);
      if (secondaryBtn) {
        secondaryBtn.style.cssText = `
          background: white !important;
          color: #6b7280 !important;
          border: 1.5px solid #d1d5db !important;
          border-radius: 8px !important;
          padding: 12px 20px !important;
          cursor: pointer !important;
          font-size: 14px !important;
          font-weight: 500 !important;
        `;
      }
      
      const primaryBtn = modalActions.querySelector(`.${QP_CLASSES.BTN_PRIMARY}`);
      if (primaryBtn) {
        primaryBtn.style.cssText = `
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
          color: white !important;
          border: none !important;
          border-radius: 8px !important;
          padding: 12px 24px !important;
          cursor: pointer !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2) !important;
        `;
      }
    }
    
    // Custom delimiter input
    const customDelimiter = this.settingsModal.querySelector(`#${QP_ELEMENT_IDS.CUSTOM_DELIMITER}`);
    if (customDelimiter) {
      customDelimiter.style.cssText = `
        margin-top: 12px !important;
        padding: 10px 14px !important;
        border: 1.5px solid #d1d5db !important;
        border-radius: 8px !important;
        font-size: 14px !important;
        background: white !important;
        color: #374151 !important;
        width: 100% !important;
        box-sizing: border-box !important;
      `;
    }
    
    console.log('✅ Beautiful styles applied with inline CSS!');
  }
  
  setupSettingsModalEvents() {
    if (!this.settingsModal) return;
    
    // Close button
    this.settingsModal.querySelector(`.${QP_CLASSES.MODAL_CLOSE}`).addEventListener('click', () => {
      this.hideSettingsModal();
    });
    
    // Help button
    this.settingsModal.querySelector(`.${QP_CLASSES.HELP_BTN}`).addEventListener('click', () => {
      this.showHelpModal();
    });
    
    // Backdrop click
    this.settingsModal.querySelector(`.${QP_CLASSES.MODAL_BACKDROP}`).addEventListener('click', () => {
      this.hideSettingsModal();
    });
    
    // Cancel button
    this.settingsModal.querySelector(`#${QP_ELEMENT_IDS.CANCEL_SETTINGS}`).addEventListener('click', () => {
      this.hideSettingsModal();
    });
    
    // Save button
    this.settingsModal.querySelector(`#${QP_ELEMENT_IDS.SAVE_SETTINGS}`).addEventListener('click', () => {
      this.saveSettingsFromModal();
    });
    
    // Delimiter control
    this.settingsModal.querySelector(`#${QP_ELEMENT_IDS.DELIMITER_CONTROL}`).addEventListener('click', (e) => {
      if (e.target.classList.contains(QP_CLASSES.SEGMENT_BTN)) {
        // Remove active class from all buttons
        this.settingsModal.querySelectorAll(`.${QP_CLASSES.SEGMENT_BTN}`).forEach(btn => btn.classList.remove(QP_CLASSES.ACTIVE));
        // Add active class to clicked button
        e.target.classList.add(QP_CLASSES.ACTIVE);
        
        // Show/hide custom delimiter input
        const customInput = this.settingsModal.querySelector(`#${QP_ELEMENT_IDS.CUSTOM_DELIMITER}`);
        if (e.target.dataset.delimiter === QP_DELIMITER.CUSTOM) {
          customInput.style.display = 'block';
          customInput.focus();
        } else {
          customInput.style.display = 'none';
        }
      }
    });
    
    // Options toggles
    this.settingsModal.querySelectorAll(`.${QP_CLASSES.TOGGLE}`).forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        
        const checkbox = toggle.querySelector('input[type="checkbox"]');
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
          
          // Trigger change event to update visual state
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
          
          console.log(`🔄 Toggle clicked: ${checkbox.id} = ${checkbox.checked}`);
        }
      });
      
      // Also handle direct checkbox clicks
      const checkbox = toggle.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          console.log(`✅ Checkbox changed: ${e.target.id} = ${e.target.checked}`);
        });
      }
    });
    
  }
  
  
  async saveSettingsFromModal() {
    if (!this.settingsModal) return;
    
    this.settings.autoHide = this.settingsModal.querySelector(`#${QP_ELEMENT_IDS.AUTO_HIDE}`).checked;
    this.settings.showTimestamps = this.settingsModal.querySelector(`#${QP_ELEMENT_IDS.SHOW_TIMESTAMPS}`).checked;
    this.settings.maxClipsDisplay = parseInt(this.settingsModal.querySelector(`#${QP_ELEMENT_IDS.MAX_CLIPS}`).value);
    
    // Save delimiter settings
    const activeDelimiterBtn = this.settingsModal.querySelector(`.${QP_CLASSES.SEGMENT_BTN}.${QP_CLASSES.ACTIVE}`);
    if (activeDelimiterBtn) {
      this.settings.delimiter = activeDelimiterBtn.dataset.delimiter;
    }
    this.settings.customDelimiter = this.settingsModal.querySelector(`#${QP_ELEMENT_IDS.CUSTOM_DELIMITER}`).value;
    
    // Save options settings
    this.settings.options.deduplicate = this.settingsModal.querySelector(`#${QP_ELEMENT_IDS.DEDUPLICATE}`).checked;
    this.settings.options.sort = this.settingsModal.querySelector(`#${QP_ELEMENT_IDS.SORT}`).checked;
    this.settings.options.uppercase = this.settingsModal.querySelector(`#${QP_ELEMENT_IDS.UPPERCASE}`).checked;
    
    await this.saveSettings();
    this.applySettings();
    this.updateInterface();
    this.hideSettingsModal();
    
    // Show success feedback
    this.showToast('Settings saved!', 'success');
  }
  
  hideSettingsModal() {
    if (this.settingsModal) {
      this.settingsModal.remove();
      this.settingsModal = null;
    }
  }
  
  applySettings() {
    if (!this.container) return;
    applyQuickPasteTheme(this.container, this.settings.theme);
  }
  
  showClearAllConfirmation() {
    // Create confirmation modal
    const confirmModal = document.createElement('div');
    confirmModal.className = QP_CLASSES.CONFIRM_MODAL;
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
    
    document.body.appendChild(confirmModal);
    
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
    return pasteQuickPasteClipById(this, rawClipId);
  }
}

// PasteCraft Floating Widget (Monica.ai Style)
