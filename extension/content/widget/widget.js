import { safeRuntimeSendMessage, pastecraftGetURL, PASTECRAFT_PAGE_ORIGIN } from '../shared.js';

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
    
    // Auto-copy feature state
    this.autoCopyEnabled = false;
    this.autoCopyCount = 0;
    
    // Initialize synchronously first
    console.log('🔨 Creating widget...');
    this.createWidget();
    console.log('✅ Widget created successfully');
    this.loadSavedPosition();
    this.setupWidgetDrag();
    this.setupStorageSync();
    this.setupClickAndDragCapture();
    
    // Then load settings asynchronously
    this.initAsync();
  }
  
  async initAsync() {
    await this.loadSettings();
    // Apply widget icon after settings load
    try { await this.applyWidgetIcon(); } catch (_) {}
    await this.loadAutoCopyState();
    this.setupAutoCopyListener();
    console.log('🎨 PasteCraft Floating Widget initialized with settings:', this.settings);
  }

  setupStorageSync() {
    // Keep widget settings/state in sync across all open tabs
    if (this._storageSyncListener) return;

    this._storageSyncListener = (changes, area) => {
      if (area !== 'local') return;

      let settingsRefreshNeeded = false;

      // Widget-specific settings
      if (changes.widgetSettings) {
        const next = this.sanitizeWidgetSettings(changes.widgetSettings.newValue);
        if (next && typeof next === 'object') {
          this.settings = { ...this.settings, ...next };
        }
        // Apply widget icon on any widgetSettings update
        try { this.applyWidgetIcon(); } catch (_) {}
        if (this.settings && this.settings.clickAndDragEnabled === false) {
          this.hideClickAndDragDropBox(true);
        }
        settingsRefreshNeeded = true;
      }

      // General PasteCraft settings (autoDeletePeriod, quickPasteSettings, albumAttachmentOpenMode)
      if (changes.autoDeletePeriod || changes.quickPasteSettings || changes.albumAttachmentOpenMode) {
        settingsRefreshNeeded = true;
        // Reload settings if settings panel is open
        if (this.openStates.settings) {
          this.loadSettings().catch(() => {});
        }
      }

      // Profile changes (if using profile image as widget icon)
      if (changes.userProfile && this.settings && this.settings.widgetIconUseProfileImage) {
        try { this.applyWidgetIcon(); } catch (_) {}
      }

      // Refresh quick view widget if clips changed and quick view is open
      if ((changes.clips || changes.searchOnlyClips) && this.openStates.quickView) {
        const quickViewIframe = this.widget?.querySelector('#pastecraft-quickview-iframe');
        if (quickViewIframe && quickViewIframe.contentWindow) {
          // Trigger refresh in quick view
          chrome.storage.local.get(['clips', 'searchOnlyClips'], (result) => {
            const allClips = [...(result.clips || []), ...(result.searchOnlyClips || [])];
            const recentClips = allClips
              .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
              .slice(0, 200);
            if (quickViewIframe.contentWindow) {
              quickViewIframe.contentWindow.postMessage(
                { type: 'quickview-clips-data', clips: recentClips },
                '*'
              );
            }
          });
        }
      }

      if (changes.widgetPosition) {
        const nextPos = changes.widgetPosition.newValue;
        if (nextPos && typeof nextPos === 'object') {
          this.position = nextPos;
          if (this.widget && typeof this.position.top === 'number') {
            this.widget.style.top = this.position.top + '%';
          }
        }
      }

      let autoCopyUiChanged = false;

      if (changes.autoCopyEnabled) {
        this.autoCopyEnabled = !!changes.autoCopyEnabled.newValue;
        autoCopyUiChanged = true;
      }

      if (changes.autoCopyCount || changes.autoCopyDate) {
        const today = new Date().toDateString();
        const nextDate = changes.autoCopyDate ? changes.autoCopyDate.newValue : undefined;
        const nextCount = changes.autoCopyCount ? changes.autoCopyCount.newValue : undefined;

        // Reset across tabs on day rollover
        if (nextDate && nextDate !== today) {
          this.autoCopyCount = 0;
        } else if (typeof nextCount === 'number') {
          this.autoCopyCount = nextCount;
        }
        autoCopyUiChanged = true;
      }

      if (autoCopyUiChanged) {
        this.updateAutoCopyUI();
      }

      // Refresh settings UI if settings panel is open and settings changed
      if (settingsRefreshNeeded && this.openStates.settings) {
        // Settings will be refreshed via loadSettings() call above
      }
    };

    chrome.storage.onChanged.addListener(this._storageSyncListener);
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
    if (!this.widget) return;

    const toggle = this.widget.querySelector('.auto-copy-toggle');
    const label = toggle?.querySelector('.toggle-label');
    if (toggle && label) {
      toggle.setAttribute('data-state', this.autoCopyEnabled ? 'on' : 'off');
      label.textContent = this.autoCopyEnabled ? 'ON' : 'OFF';
    }

    this.updateAutoCopyCounter();
  }
  
  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['widgetSettings']);
      if (result.widgetSettings) {
        this.settings = { ...this.settings, ...this.sanitizeWidgetSettings(result.widgetSettings) };
      }
      console.log('📝 Widget settings loaded:', this.settings);
    } catch (error) {
      console.error('Error loading widget settings:', error);
    } finally {
      this._settingsLoaded = true;
    }
  }
  
  async saveSettings() {
    try {
      const nextSettings = this.sanitizeWidgetSettings(this.settings);
      this.settings = { ...nextSettings };
      await chrome.storage.local.set({ widgetSettings: nextSettings });
      console.log('💾 Widget settings saved:', this.settings);
    } catch (error) {
      console.error('Error saving widget settings:', error);
    }
  }

  sanitizeWidgetSettings(rawSettings) {
    const settings = (rawSettings && typeof rawSettings === 'object') ? { ...rawSettings } : {};

    delete settings.aiHelperEnabled;
    delete settings.aiHelperRuleTipsEnabled;
    delete settings.aiHelperAiTipsEnabled;
    delete settings.aiHelperShowOnCopyOnly;
    delete settings.aiHelperMode;
    delete settings.aiHelperPlacement;
    delete settings.aiHelperUserPositioned;
    delete settings.aiHelperUserPosition;

    return settings;
  }
  
  createWidget() {
    // Create main widget container
    this.widget = document.createElement('div');
    this.widget.id = 'pastecraft-floating-widget';
    this.widget.className = 'pastecraft-widget';
    
    // Add widget HTML structure
    this.widget.innerHTML = `
      <div class="pastecraft-widget-inner">
        <!-- Component 1: Logo Button -->
        <div class="widget-component logo-button" data-tooltip="Open PasteCraft">
          <img src="${pastecraftGetURL('logo.svg')}" alt="PasteCraft" class="widget-logo">
        </div>
        
        <!-- Component 2: Settings Button -->
        <div class="widget-component settings-button" data-tooltip="Settings">
          <span class="widget-icon">⚙️</span>
        </div>
        
        <!-- Component 3: Auto Copy Toggle -->
        <div class="widget-component auto-copy-section" data-tooltip="Auto Copy">
          <div class="auto-copy-toggle" data-state="off">
            <span class="toggle-label">OFF</span>
          </div>
          <div class="auto-copy-counter">0 clips</div>
        </div>
        
        <!-- Component 4: Quick View Button -->
        <div class="widget-component quick-view-button" data-tooltip="Quick View Menu" role="button" tabindex="0" aria-label="Open Quick View Menu">
          <div class="eye-icon-wrap">
            <svg class="eye-svg" xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <g class="eye-drawing">
                <path class="eye-outline" d="M5 32C11 20 20 14 32 14s21 6 27 18c-6 12-15 18-27 18S11 44 5 32Z"/>
                <circle class="eye-pupil" cx="32" cy="32" r="10"/>
              </g>
            </svg>
          </div>
        </div>
      </div>
    `;
    
    // Add styles
    this.addStyles();
    
    // Hide widget until saved position is loaded (prevents flash at default position)
    this.widget.style.visibility = 'hidden';
    
    // Append to body
    document.body.appendChild(this.widget);

    // Debug: Test if ANY clicks work on the widget
    this.widget.addEventListener('click', (e) => {
      console.log('🖱️ Widget clicked! Target:', e.target.className);
    });
    
    // Setup event listeners
    this.setupEventListeners();
  }
  
  addStyles() {
    // Remove old styles if they exist to ensure updates take effect
    const existingStyles = document.getElementById('pastecraft-floating-widget-styles');
    if (existingStyles) {
      existingStyles.remove();
    }
    
    const styles = document.createElement('style');
    styles.id = 'pastecraft-floating-widget-styles';
    styles.textContent = `
      /* Main Widget Container - starts at right edge, slides left when panel opens */
      .pastecraft-widget {
        position: fixed;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 60px;
        /* 70% transparent background (alpha 0.3) */
        background: linear-gradient(135deg, rgba(30, 64, 175, 0.3) 0%, rgba(30, 58, 138, 0.3) 50%, rgba(29, 78, 216, 0.3) 100%);
        border-radius: 12px 0 0 12px;
        box-shadow: 
          -4px 0 16px rgba(0, 0, 0, 0.15),
          0 4px 24px rgba(30, 64, 175, 0.3);
        z-index: 2147483647;
        padding: 8px 6px;
        transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      /* Widget slides left when any panel is open */
      .pastecraft-widget.panel-open {
        right: 476px;
      }
      
      .pastecraft-widget-inner {
        display: flex;
        flex-direction: column;
        gap: 12px;
        align-items: center;
      }
      
      /* Widget Components */
      .widget-component {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.2s ease;
        position: relative;
      }
      
      .widget-component:hover {
        background: rgba(96, 165, 250, 0.2);
        box-shadow: 0 0 16px rgba(96, 165, 250, 0.5);
      }
      
      /* Active state - when panel is open */
      .widget-component.active {
        background: rgba(96, 165, 250, 0.3);
        box-shadow: 0 0 20px rgba(96, 165, 250, 0.7);
        border: 2px solid rgba(96, 165, 250, 0.8);
      }
      
      /* Component 1: Logo Button */
      .logo-button {
        background: rgba(255, 255, 255, 0.1);
      }
      
      .widget-logo {
        width: 36px;
        height: 36px;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
      }

      .widget-logo.is-profile-icon {
        border-radius: 50%;
        object-fit: cover;
        object-position: center;
        border: 2px solid rgba(255, 255, 255, 0.35);
        box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.25);
      }
      
      /* Component 2: Settings Button */
      .settings-button .widget-icon {
        font-size: 24px;
        transition: transform 0.3s ease;
      }
      
      .settings-button:hover .widget-icon {
        transform: rotate(90deg);
      }
      
      /* Component 3: Auto Copy Toggle - Circular Button */
      .auto-copy-section {
        flex-direction: column;
        height: auto;
        padding: 8px 4px;
        gap: 6px;
      }
      
      .auto-copy-toggle {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #374151;
        border: 2px solid #4b5563;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }
      
      .auto-copy-toggle:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      }
      
      .auto-copy-toggle[data-state="on"] {
        background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
        border-color: #15803d;
        box-shadow: 0 0 12px rgba(34, 197, 94, 0.5);
      }
      
      .toggle-label {
        font-size: 10px;
        font-weight: 700;
        color: white;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        pointer-events: none;
      }
      
      .auto-copy-counter {
        font-size: 10px;
        color: #e0f2fe;
        text-align: center;
        white-space: nowrap;
        transition: transform 0.2s ease;
      }
      
      /* Component 4: Quick View Button */
      .quick-view-button {
        background: transparent;
        box-shadow: none;
      }
      .quick-view-button .eye-icon-wrap {
        position: relative;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      }
      .quick-view-button .eye-svg {
        display: block;
        width: 34px;
        height: 34px;
        overflow: visible;
        transition: transform 0.15s ease;
      }
      .quick-view-button .eye-drawing {
        transform-box: fill-box;
        transform-origin: center;
      }
      .quick-view-button .eye-outline,
      .quick-view-button .eye-pupil {
        fill: none;
        stroke: rgba(255, 255, 255, 0.96);
        stroke-width: 6;
        stroke-linecap: round;
        stroke-linejoin: round;
        filter: drop-shadow(0 1px 2px rgba(15, 23, 42, 0.35));
      }
      .quick-view-button .eye-pupil {
        stroke-width: 7;
        transform-box: fill-box;
        transform-origin: center;
      }
      .quick-view-button:hover,
      .quick-view-button:focus-visible {
        background: rgba(96, 165, 250, 0.18);
        box-shadow: 0 0 16px rgba(56, 189, 248, 0.55);
      }

      .widget-component > svg,
      .widget-component > svg *,
      .widget-component > img,
      .widget-component .widget-icon,
      .widget-component .widget-logo,
      .widget-component .eye-icon-wrap,
      .widget-component .eye-icon-wrap *,
      .quickview-btn > svg,
      .quickview-btn > svg *,
      .quickview-btn > span,
      .clip-btn > svg,
      .clip-btn > svg *,
      .clip-btn > span {
        pointer-events: none;
      }

      .quick-view-button:hover .eye-svg,
      .quick-view-button:focus-visible .eye-svg {
        transform: scale(1.04);
      }
      .quick-view-button:hover .eye-drawing,
      .quick-view-button:focus-visible .eye-drawing {
        animation: pastecraft-eye-blink 1.15s ease-in-out infinite;
      }
      .quick-view-button:hover .eye-pupil,
      .quick-view-button:focus-visible .eye-pupil {
        animation: pastecraft-eye-pupil 1.15s ease-in-out infinite;
      }

      @keyframes pastecraft-eye-blink {
        0%, 38%, 68%, 100% {
          transform: scaleY(1);
        }
        50% {
          transform: scaleY(0.14);
        }
      }

      @keyframes pastecraft-eye-pupil {
        0%, 100% {
          transform: translateX(0);
        }
        25% {
          transform: translateX(-5px);
        }
        65% {
          transform: translateX(5px);
        }
      }
      
      /* Tooltips - appear on LEFT; hardened against host page CSS (chess.com etc.) */
      .widget-component[data-tooltip]::before {
        all: initial !important;
        content: attr(data-tooltip) !important;
        position: absolute !important;
        right: calc(100% + 10px) !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        background: rgba(15, 23, 42, 0.92) !important;
        color: #e2e8f0 !important;
        padding: 5px 10px !important;
        border-radius: 6px !important;
        font-size: 11px !important;
        font-family: system-ui, sans-serif !important;
        font-weight: 500 !important;
        line-height: 1.4 !important;
        white-space: nowrap !important;
        letter-spacing: 0.02em !important;
        opacity: 0 !important;
        pointer-events: none !important;
        transition: opacity 0.18s ease !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35) !important;
        z-index: 10 !important;
      }

      .widget-component[data-tooltip]::after {
        all: initial !important;
        content: '' !important;
        position: absolute !important;
        right: calc(100% + 4px) !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        border: 5px solid transparent !important;
        border-left-color: rgba(15, 23, 42, 0.92) !important;
        opacity: 0 !important;
        pointer-events: none !important;
        transition: opacity 0.18s ease !important;
        z-index: 10 !important;
      }

      .widget-component:hover[data-tooltip]::before,
      .widget-component:hover[data-tooltip]::after {
        opacity: 1 !important;
      }
      
      /* Animations - slides in from right */
      @keyframes widget-fade-in {
        from {
          opacity: 0;
          transform: translateY(-50%) translateX(20px);
        }
        to {
          opacity: 1;
          transform: translateY(-50%) translateX(0);
        }
      }
      
      .pastecraft-widget {
        animation: widget-fade-in 0.4s ease-out;
        cursor: grab;
      }

      /* While dragging the widget */
      .pastecraft-widget.pc-dragging {
        cursor: grabbing;
        transition: none !important;
      }

      /* Keep pointer cursor on interactive components */
      .pastecraft-widget .widget-component {
        cursor: pointer;
      }
    `;
    
    document.head.appendChild(styles);
  }
  
  setupEventListeners() {
    console.log('🎯 Setting up widget event listeners...');
    console.log('🔍 Widget element:', this.widget);
    console.log('🔍 Widget innerHTML sample:', this.widget?.innerHTML?.substring(0, 200));
    
    // Component 1: Logo Button - Toggle popup
    const logoButton = this.widget.querySelector('.logo-button');
    if (logoButton) {
      logoButton.addEventListener('click', () => {
        console.log('🎨 Logo button clicked!');
        if (String(this.settings?.appOpenMode || 'inPage') === 'edgePopup') {
          try {
            chrome.runtime.sendMessage({
              action: 'pcOpenPopupWindow',
              page: 'popup.html',
              width: 520,
              height: 760
            });
          } catch (_) {}
          return;
        }
        if (this.openStates.popup) {
          this.closePopupOverlay();
        } else {
          this.openPopupOverlay();
        }
      });
      console.log('✅ Logo button listener attached');
    } else {
      console.error('❌ Logo button not found!');
    }
    
    // Component 2: Settings Button - Toggle settings
    const settingsButton = this.widget.querySelector('.settings-button');
    if (settingsButton) {
      settingsButton.addEventListener('click', () => {
        console.log('⚙️ Settings button clicked!');
        if (this.openStates.settings) {
          this.closeSettings();
        } else {
          this.openSettings();
        }
      });
      console.log('✅ Settings button listener attached');
    }
    
    // Component 3: Auto Copy Toggle
    const autoToggle = this.widget.querySelector('.auto-copy-toggle');
    if (autoToggle) {
      autoToggle.addEventListener('click', () => {
        console.log('🔄 Toggle clicked!');
        this.toggleAutoCopy();
      });
      console.log('✅ Auto toggle listener attached');
    }
    
    // Component 4: Quick View Button - Toggle quick view
    const quickViewButton = this.widget.querySelector('.quick-view-button');
    if (quickViewButton) {
      const toggleQuickView = () => {
        console.log('👁️ Quick View button clicked!');
        if (this.openStates.quickView) {
          this.closeQuickView();
        } else {
          this.openQuickView();
        }
      };

      quickViewButton.addEventListener('click', toggleQuickView);
      quickViewButton.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toggleQuickView();
      });
      console.log('✅ Quick View button listener attached');
    }
    
    console.log('🎯 All event listeners setup complete!');
  }

  /**
   * Makes the widget draggable from its free space (gaps/padding between buttons).
   * Clicking directly on a .widget-component still triggers that button's action.
   */
  setupWidgetDrag() {
    if (!this.widget) return;
    if (this._widgetDragBound) return;
    this._widgetDragBound = true;

    let dragging = false;
    let pointerStartY = 0;
    let startTopPct = 0;
    const DRAG_THRESHOLD = 4; // px – distinguishes click from drag
    let moved = false;

    const onMove = (e) => {
      if (!dragging) return;
      const dy = e.clientY - pointerStartY;
      if (!moved && Math.abs(dy) < DRAG_THRESHOLD) return;
      moved = true;
      this.widget.classList.add('pc-dragging');

      // Convert dy pixels to viewport-height percentage
      const vh = window.innerHeight || 1;
      let nextPct = startTopPct + (dy / vh) * 100;
      // Clamp so the widget stays fully visible
      const widgetH = this.widget.offsetHeight || 0;
      const minPct = (widgetH / 2 / vh) * 100;
      const maxPct = 100 - minPct;
      nextPct = Math.max(minPct, Math.min(nextPct, maxPct));

      this.widget.style.top = nextPct + '%';
      this.position.top = nextPct;
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      this.widget.classList.remove('pc-dragging');
      document.body.style.userSelect = '';
      if (moved) {
        this.savePosition();
      }
    };

    this.widget.addEventListener('pointerdown', (e) => {
      // Only initiate drag from free space — skip if target is a button/component
      if (e.target.closest('.widget-component')) return;
      if (e.button !== 0) return; // left click only

      dragging = true;
      moved = false;
      pointerStartY = e.clientY;
      startTopPct = this.position.top ?? 50;

      try { this.widget.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
      document.body.style.userSelect = 'none';
    });

    this.widget.addEventListener('pointermove', onMove);
    this.widget.addEventListener('pointerup', onUp);
    this.widget.addEventListener('pointercancel', onUp);
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
      { open: this.openStates?.settings, el: document.getElementById('pastecraft-settings-panel') },
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
    
    // Check if overlay already exists
    const existingOverlay = document.getElementById('pastecraft-popup-overlay');
    if (existingOverlay) {
      console.log('⚠️ Overlay already exists');
      return;
    }
    
    // Set open state
    this.openStates.popup = true;
    
    // Slide widget to the left (attached to panel)
    this.widget.classList.add('panel-open');

    // Push the website content left (docked mode)
    this.syncPageDocking();
    
    // Add active class to logo button
    const logoButton = this.widget.querySelector('.logo-button');
    if (logoButton) {
      logoButton.classList.add('active');
    }
    
    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'pastecraft-popup-backdrop';
    backdrop.className = 'pastecraft-overlay-backdrop';
    
    // Create container (slide-in panel like settings)
    const container = document.createElement('div');
    container.id = 'pastecraft-popup-overlay';
    container.className = 'pastecraft-overlay-panel';
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'pastecraft-overlay-close';
    closeButton.innerHTML = '×';
    closeButton.setAttribute('aria-label', 'Close');
    
    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.src = pastecraftGetURL('popup.html');
    iframe.className = 'pastecraft-overlay-iframe';
    iframe.setAttribute('allowtransparency', 'true');
    
    // Assemble overlay
    container.appendChild(closeButton);
    container.appendChild(iframe);
    document.body.appendChild(backdrop);
    document.body.appendChild(container);
    
    // Add overlay styles
    this.addOverlayStyles();
    
    // Setup close handlers
    closeButton.addEventListener('click', () => this.closePopupOverlay());
    
    // Listen for close messages from the overlay iframe only
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
    
    // Close on outside click (without blocking page interaction) if setting allows
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
    
    // ESC key to close
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.closePopupOverlay();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
    
    // Animate in
    setTimeout(() => {
      backdrop.classList.add('visible');
      container.classList.add('visible');
      // Recompute width once visible (responsive cases)
      this.syncPageDocking();
    }, 10);
    
    console.log('✅ Popup overlay opened');
  }
  
  closePopupOverlay() {
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
      
      console.log('✅ Popup overlay closed');
    }
  }
  
  addOverlayStyles() {
    // Check if styles already exist
    if (document.getElementById('pastecraft-overlay-styles')) {
      return;
    }
    
    const styles = document.createElement('style');
    styles.id = 'pastecraft-overlay-styles';
    styles.textContent = `
      /* Backdrop */
      .pastecraft-overlay-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: transparent;
        z-index: 2147483645;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
      }
      
      .pastecraft-overlay-backdrop.visible {
        opacity: 1;
      }
      
      /* Panel - Slides in from right (wider for better UX) */
      .pastecraft-overlay-panel {
        position: fixed;
        top: 0;
        right: 0;
        width: 476px;
        max-width: 90vw;
        height: 100vh;
        background: white;
        box-shadow: -4px 0 16px rgba(0, 0, 0, 0.2);
        z-index: 2147483646;
        transform: translateX(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      .pastecraft-overlay-panel.visible {
        transform: translateX(0);
      }
      
      /* Close Button - HIDDEN per user request */
      .pastecraft-overlay-close {
        display: none !important;
      }
      
      /* Iframe */
      .pastecraft-overlay-iframe {
        width: 100%;
        height: 100%;
        border: none;
        background: white;
      }
      
      /* Responsive - Full width on mobile */
      @media (max-width: 480px) {
        .pastecraft-overlay-panel {
          width: 100%;
        }
      }
    `;
    
    document.head.appendChild(styles);
  }
  
  openSettings() {
    console.log('⚙️ Opening settings panel');
    
    // Check if panel already exists
    if (document.getElementById('pastecraft-settings-panel')) {
      return;
    }
    
    // Set open state
    this.openStates.settings = true;
    
    // Slide widget to the left (attached to panel)
    this.widget.classList.add('panel-open');

    // Push the website content left (docked mode)
    this.syncPageDocking();
    
    // Add active class to settings button
    const settingsButton = this.widget.querySelector('.settings-button');
    if (settingsButton) {
      settingsButton.classList.add('active');
    }
    
    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'pastecraft-settings-backdrop';
    backdrop.className = 'pastecraft-settings-backdrop';
    
    // Create panel
    const panel = document.createElement('div');
    panel.id = 'pastecraft-settings-panel';
    panel.className = 'pastecraft-settings-panel';
    
    // Panel content
    panel.innerHTML = `
      <div class="settings-header">
        <h3>Widget Settings</h3>
        <button class="settings-close" aria-label="Close">×</button>
      </div>
      
      <div class="settings-content">
        <div class="settings-section">
          <h4>Open Mode</h4>
          
          <div class="setting-item">
            <div class="setting-info">
              <label>Open PasteCraft in</label>
              <p class="setting-desc">Choose between the in-page panel or a separate popup window</p>
            </div>
            <select id="appOpenMode" class="pc-settings-select">
              <option value="inPage" ${String(this.settings.appOpenMode || 'inPage') === 'inPage' ? 'selected' : ''}>In-page panel (default)</option>
              <option value="edgePopup" ${String(this.settings.appOpenMode || '') === 'edgePopup' ? 'selected' : ''}>Popup window (separate)</option>
            </select>
          </div>
        </div>

        <div class="settings-section">
          <h4>Popup Behavior</h4>
          
          <div class="setting-item">
            <div class="setting-info">
              <label>Keep popup open when clicking pages</label>
              <p class="setting-desc">Popup stays open even when you interact with websites</p>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="keepPopupOpen" ${this.settings.keepPopupOpen ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          
          <div class="setting-item">
            <div class="setting-info">
              <label>Keep Quick View open when clicking pages</label>
              <p class="setting-desc">Quick View menu stays visible during page interaction</p>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="keepQuickViewOpen" ${this.settings.keepQuickViewOpen ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div class="settings-section">
          <h4>Capture</h4>

          <div class="setting-item">
            <div class="setting-info">
              <label>Enable Click & Drag capture</label>
              <p class="setting-desc">Drag text, links, or images into a drop box to save to Clips</p>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="clickAndDragEnabled" ${this.settings.clickAndDragEnabled ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
    `;
    
    // Add settings styles
    this.addSettingsStyles();
    
    // Append to body
    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
    
    // Setup event listeners
    const closeBtn = panel.querySelector('.settings-close');
    closeBtn.addEventListener('click', () => this.closeSettings());
    
    // Close on outside click (without blocking page interaction)
    if (this._settingsOutsidePointerDown) {
      document.removeEventListener('pointerdown', this._settingsOutsidePointerDown, true);
      this._settingsOutsidePointerDown = null;
    }
    this._settingsOutsidePointerDown = (e) => {
      const currentPanel = document.getElementById('pastecraft-settings-panel');
      if (!currentPanel) return;
      const target = e.target;
      if (currentPanel.contains(target)) return;
      if (this.widget && this.widget.contains(target)) return;
      this.closeSettings();
    };
    document.addEventListener('pointerdown', this._settingsOutsidePointerDown, true);
    
    // Toggle handlers
    const keepPopupToggle = panel.querySelector('#keepPopupOpen');
    const keepQuickViewToggle = panel.querySelector('#keepQuickViewOpen');
    const clickAndDragToggle = panel.querySelector('#clickAndDragEnabled');

    const appOpenModeSelect = panel.querySelector('#appOpenMode');

    appOpenModeSelect?.addEventListener('change', (e) => {
      const v = String(e.target.value || 'inPage');
      this.settings.appOpenMode = v === 'edgePopup' ? 'edgePopup' : 'inPage';
      this.saveSettings();
      this.showWidgetToast(this.settings.appOpenMode === 'edgePopup' ? 'Open: Popup window' : 'Open: In-page panel');
    });
    
    keepPopupToggle.addEventListener('change', (e) => {
      this.settings.keepPopupOpen = e.target.checked;
      this.saveSettings();
      console.log('📝 Keep popup open:', this.settings.keepPopupOpen);
    });
    
    keepQuickViewToggle.addEventListener('change', (e) => {
      this.settings.keepQuickViewOpen = e.target.checked;
      this.saveSettings();
      console.log('📝 Keep Quick View open:', this.settings.keepQuickViewOpen);
    });

    clickAndDragToggle.addEventListener('change', (e) => {
      this.settings.clickAndDragEnabled = e.target.checked;
      this.saveSettings();
      console.log('📝 Click & Drag enabled:', this.settings.clickAndDragEnabled);
      this.showWidgetToast(this.settings.clickAndDragEnabled ? 'Click & Drag ON' : 'Click & Drag OFF');
    });

    // Animate in
    setTimeout(() => {
      backdrop.classList.add('visible');
      panel.classList.add('visible');
      // Recompute width once visible (responsive cases)
      this.syncPageDocking();
    }, 10);
  }
  
  closeSettings() {
    const backdrop = document.getElementById('pastecraft-settings-backdrop');
    const panel = document.getElementById('pastecraft-settings-panel');
    
    if (this._settingsOutsidePointerDown) {
      document.removeEventListener('pointerdown', this._settingsOutsidePointerDown, true);
      this._settingsOutsidePointerDown = null;
    }
    
    if (backdrop) backdrop.classList.remove('visible');
    if (panel) panel.classList.remove('visible');
    
    if (backdrop || panel) {
      setTimeout(() => {
        if (backdrop) backdrop.remove();
        if (panel) panel.remove();
      }, 300);
      
      // Update open state
      this.openStates.settings = false;
      
      // Slide widget back to right edge (if no other panels open)
      if (!this.openStates.popup && !this.openStates.quickView) {
        this.widget.classList.remove('panel-open');
      }
      
      // Remove active class from settings button
      const settingsButton = this.widget.querySelector('.settings-button');
      if (settingsButton) {
        settingsButton.classList.remove('active');
      }

      // Update docked page push based on remaining panels
      this.syncPageDocking();
    }
  }
  
  addSettingsStyles() {
    if (document.getElementById('pastecraft-settings-styles')) {
      return;
    }
    
    const styles = document.createElement('style');
    styles.id = 'pastecraft-settings-styles';
    styles.textContent = `
      /* Settings Backdrop */
      .pastecraft-settings-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: transparent;
        z-index: 2147483645;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
      }
      
      .pastecraft-settings-backdrop.visible {
        opacity: 1;
      }
      
      /* Settings Panel - same size as popup (wide) */
      .pastecraft-settings-panel {
        position: fixed;
        top: 0;
        right: 0;
        width: 476px;
        max-width: 90vw;
        height: 100vh;
        background: white;
        box-shadow: -4px 0 16px rgba(0, 0, 0, 0.2);
        z-index: 2147483646;
        transform: translateX(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        flex-direction: column;
      }
      
      .pastecraft-settings-panel.visible {
        transform: translateX(0);
      }
      
      /* Settings Header */
      .settings-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border-bottom: 1px solid #e5e7eb;
        background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
        color: white;
      }
      
      .settings-header h3 {
        font-size: 20px;
        font-weight: 600;
        margin: 0;
      }
      
      .settings-close {
        width: 32px;
        height: 32px;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        border-radius: 50%;
        font-size: 24px;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }
      
      .settings-close:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.1);
      }
      
      /* Settings Content */
      .settings-content {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
      }

      .pc-settings-select {
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid #e5e7eb;
        background: #ffffff;
        color: #0f172a;
        font-size: 13px;
        outline: none;
        min-width: 140px;
      }

      .pc-settings-select:focus {
        border-color: rgba(59, 130, 246, 0.75);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.20);
      }
      
      .settings-section {
        margin-bottom: 32px;
      }
      
      .settings-section h4 {
        font-size: 14px;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0 0 16px 0;
      }
      
      /* Setting Item */
      .setting-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 0;
        border-bottom: 1px solid #f1f5f9;
      }
      
      .setting-item:last-child {
        border-bottom: none;
      }
      
      .setting-info {
        flex: 1;
        margin-right: 16px;
      }
      
      .setting-info label {
        font-size: 14px;
        font-weight: 500;
        color: #1f2937;
        display: block;
        margin-bottom: 4px;
        cursor: pointer;
      }
      
      .setting-desc {
        font-size: 13px;
        color: #64748b;
        margin: 0;
        line-height: 1.4;
      }
      
      /* Toggle Switch */
      .toggle-switch {
        position: relative;
        width: 48px;
        height: 24px;
        display: inline-block;
        cursor: pointer;
      }
      
      .toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      
      .toggle-switch .toggle-slider {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: #cbd5e1;
        border-radius: 24px;
        transition: all 0.3s ease;
      }
      
      .toggle-switch .toggle-slider::before {
        content: '';
        position: absolute;
        width: 20px;
        height: 20px;
        left: 2px;
        bottom: 2px;
        background: white;
        border-radius: 50%;
        transition: all 0.3s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
      
      .toggle-switch input:checked + .toggle-slider {
        background: #60a5fa;
      }
      
      .toggle-switch input:checked + .toggle-slider::before {
        transform: translateX(24px);
      }
      
      /* Responsive */
      @media (max-width: 480px) {
        .pastecraft-settings-panel {
          width: 100%;
        }
      }
    `;
    
    document.head.appendChild(styles);
  }
  
  toggleAutoCopy() {
    const toggle = this.widget.querySelector('.auto-copy-toggle');
    const label = toggle.querySelector('.toggle-label');
    const currentState = toggle.getAttribute('data-state');
    const newState = currentState === 'on' ? 'off' : 'on';
    
    toggle.setAttribute('data-state', newState);
    label.textContent = newState.toUpperCase();
    this.autoCopyEnabled = newState === 'on';
    
    // Save state to storage
    chrome.storage.local.set({ autoCopyEnabled: this.autoCopyEnabled });
    
    console.log(`🔄 Auto Copy: ${newState.toUpperCase()}`);
    
    // Show feedback toast
    if (this.autoCopyEnabled) {
      this.showWidgetToast('Auto-copy ON - copied text will be saved');
    } else {
      this.showWidgetToast('Auto-copy OFF');
    }
  }
  
  // Listen for copy events to auto-save copied text
  setupAutoCopyListener() {
    const handler = async (e) => {
      if (!this.autoCopyEnabled) return;
      
      const MAX_TEXT = 30000;
      const MAX_HTML = 50000;
      const MAX_IMAGE_BYTES = 600 * 1024; // ~600KB max for dataURL capture

      const cd = e && e.clipboardData ? e.clipboardData : null;

      const safeTrim = (s, max) => {
        const str = String(s ?? '');
        if (str.length <= max) return str;
        return str.slice(0, max) + '…';
      };

      const isProbablyUrl = (s) => {
        const t = String(s || '').trim();
        if (!t) return false;
        try {
          const u = new URL(t);
          return u.protocol === 'http:' || u.protocol === 'https:';
        } catch (_) {
          return false;
        }
      };

      // Prefer clipboardData payloads (more reliable for rich copy)
      const plain = cd ? (cd.getData('text/plain') || '') : '';
      const html = cd ? (cd.getData('text/html') || '') : '';
      const selection = window.getSelection ? String(window.getSelection().toString() || '') : '';

      let textToSave = (plain || selection || '').trim();

      const meta = {
        kind: 'text',
        plainText: safeTrim(textToSave, MAX_TEXT),
        html: html ? safeTrim(html, MAX_HTML) : '',
        url: isProbablyUrl(textToSave) ? textToSave.trim() : '',
        image: null,
        sourcePageUrl: (typeof location !== 'undefined' && location.href) ? location.href : '',
        capturedAt: Date.now()
      };

      if (meta.url) meta.kind = 'url';
      if (meta.html && !meta.url) meta.kind = 'html';

      // Attempt to capture an image item (when browser provides it on copy)
      try {
        if (cd && cd.items && cd.items.length) {
          for (let i = 0; i < cd.items.length; i++) {
            const it = cd.items[i];
            const type = String(it && it.type ? it.type : '');
            if (type.startsWith('image/')) {
              const file = it.getAsFile ? it.getAsFile() : null;
              if (!file) continue;
              if (typeof file.size === 'number' && file.size > MAX_IMAGE_BYTES) {
                meta.image = { mime: type, dataUrl: '', srcUrl: '', tooLarge: true, size: file.size };
                meta.kind = 'image';
                if (!textToSave) textToSave = '[Image]';
                break;
              }

              const dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => resolve('');
                reader.readAsDataURL(file);
              });

              if (dataUrl) {
                meta.image = { mime: type, dataUrl, srcUrl: '' };
                meta.kind = 'image';
                // Ensure we save something searchable even when copy had no text
                if (!textToSave) textToSave = '[Image]';
                meta.plainText = safeTrim(textToSave, MAX_TEXT);
              }
              break;
            }
          }
        }
      } catch (err) {
        // Non-fatal: text capture still works
        console.warn('⚠️ Auto-copy image capture failed:', err?.message || err);
      }

      // If nothing textual and no image payload, nothing to save.
      if (!textToSave && !(meta && meta.kind === 'image')) return;

      console.log('📋 Auto-copy detected:', textToSave.substring(0, 50) + '...');

      try {
        // Save to PasteCraft via background script
        await safeRuntimeSendMessage({
          action: 'saveClip',
          text: safeTrim(textToSave, MAX_TEXT),
          meta,
          category: 'Uncategorized',
          autoShow: false // Don't auto-show popup for auto-copied clips
        });
        
        // Update counter
        this.autoCopyCount++;
        this.updateAutoCopyCounter();
        
        // Save counter to storage (resets daily)
        chrome.storage.local.set({ 
          autoCopyCount: this.autoCopyCount,
          autoCopyDate: new Date().toDateString()
        });
        
        console.log('✅ Auto-copied to PasteCraft!');
      } catch (error) {
        console.error('❌ Auto-copy failed:', error);
      }
    };

    // Use capture phase: some native copy actions don’t bubble.
    document.addEventListener('copy', handler, true);
  }

  updateAutoCopyCounter() {
    const counter = this.widget.querySelector('.auto-copy-counter');
    if (counter) {
      counter.textContent = `${this.autoCopyCount} clip${this.autoCopyCount !== 1 ? 's' : ''}`;
      // Brief scale animation
      counter.style.transform = 'scale(1.2)';
      setTimeout(() => {
        counter.style.transform = 'scale(1)';
      }, 200);
    }
  }
  
  async loadAutoCopyState() {
    try {
      const result = await chrome.storage.local.get(['autoCopyEnabled', 'autoCopyCount', 'autoCopyDate']);
      
      // Check if counter should reset (new day)
      const today = new Date().toDateString();
      if (result.autoCopyDate !== today) {
        this.autoCopyCount = 0;
      } else {
        this.autoCopyCount = result.autoCopyCount || 0;
      }
      
      this.autoCopyEnabled = result.autoCopyEnabled || false;

      this.updateAutoCopyUI();
      console.log('📋 Auto-copy state loaded:', this.autoCopyEnabled, 'Count:', this.autoCopyCount);
    } catch (error) {
      console.error('Failed to load auto-copy state:', error);
    }
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
    try {
      console.log('👁️ ===== OPENING QUICK VIEW =====');
      console.log('👁️ Opening Quick View (slide-in panel from right)');
      console.log('👁️ Current open states:', this.openStates);
      
      // Check if panel already exists
      if (document.getElementById('pastecraft-quickview-panel')) {
        console.log('⚠️ Quick View panel already exists');
        return;
      }
      
      console.log('👁️ Creating Quick View panel elements...');
      
      // Set open state
      this.openStates.quickView = true;
      
      // Slide widget to the left (attached to panel)
      this.widget.classList.add('panel-open');

      // Push the website content left (docked mode)
      this.syncPageDocking();
      
      // Add active class to quick view button
      const quickViewButton = this.widget.querySelector('.quick-view-button');
      if (quickViewButton) {
        quickViewButton.classList.add('active');
      }
      
      // Create backdrop
      const backdrop = document.createElement('div');
      backdrop.id = 'pastecraft-quickview-backdrop';
      backdrop.className = 'pastecraft-quickview-backdrop';
      
      // Create panel
      const panel = document.createElement('div');
      panel.id = 'pastecraft-quickview-panel';
      panel.className = 'pastecraft-quickview-panel';
      
      // Create close button
      const closeButton = document.createElement('button');
      closeButton.className = 'pastecraft-overlay-close';
      closeButton.innerHTML = '×';
      closeButton.setAttribute('aria-label', 'Close');
      
      // Create iframe to load the Quick Paste interface
      const iframe = document.createElement('iframe');
      iframe.className = 'pastecraft-quickview-iframe';
      iframe.setAttribute('allowtransparency', 'true');
      
      // Assemble panel
      panel.appendChild(closeButton);
      panel.appendChild(iframe);
      document.body.appendChild(backdrop);
      document.body.appendChild(panel);
      
      // Add styles
      this.addQuickViewStyles();
      
      // Load Quick Paste content into iframe
      this.loadQuickViewContent(iframe);
      
      // Setup close handlers
      closeButton.addEventListener('click', () => this.closeQuickView());
      // Close on outside click (without blocking page interaction) if setting allows
      if (this._quickViewOutsidePointerDown) {
        document.removeEventListener('pointerdown', this._quickViewOutsidePointerDown, true);
        this._quickViewOutsidePointerDown = null;
      }
      if (!this.settings.keepQuickViewOpen) {
        this._quickViewOutsidePointerDown = (e) => {
          const currentPanel = document.getElementById('pastecraft-quickview-panel');
          if (!currentPanel) return;
          const target = e.target;
          if (currentPanel.contains(target)) return;
          if (this.widget && this.widget.contains(target)) return;
          this.closeQuickView();
        };
        document.addEventListener('pointerdown', this._quickViewOutsidePointerDown, true);
      }
      
      // ESC key to close
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          this.closeQuickView();
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
    
      // Animate in
      setTimeout(() => {
        backdrop.classList.add('visible');
        panel.classList.add('visible');
        // Recompute width once visible (responsive cases)
        this.syncPageDocking();
      }, 10);
      
      console.log('✅ Quick View panel opened');
    } catch (error) {
      console.error('❌ Error opening Quick View:', error);
      console.error('❌ Error stack:', error.stack);
      alert('Error opening Quick View. Check console for details.');
    }
  }
  
  loadQuickViewContent(iframe) {
    // Create a custom HTML content for the Quick View
    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: white;
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .quickview-header {
            background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 50%, #1d4ed8 100%);
            color: white;
            padding: 16px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .quickview-title {
            font-size: 18px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .clip-count {
            font-size: 13px;
            font-weight: 500;
            background: rgba(255, 255, 255, 0.2);
            padding: 4px 10px;
            border-radius: 12px;
            color: rgba(255, 255, 255, 0.9);
          }
          .quickview-controls {
            display: flex;
            gap: 8px;
          }
          .quickview-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            border-radius: 6px;
            padding: 6px 10px;
            color: white;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
          }
          .quickview-btn:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: scale(1.05);
          }
          .quickview-btn svg,
          .quickview-btn svg *,
          .quickview-btn span {
            pointer-events: none;
          }
          .quickview-content {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
          }
          .clip-item {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 8px;
            transition: all 0.2s;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
          }
          .clip-item:hover {
            background: #e0f2fe;
            border-color: #3b82f6;
            transform: translateX(-4px);
          }
          .clip-content {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .clip-text {
            font-size: 14px;
            color: #1f2937;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            line-height: 1.5;
          }
          .clip-meta {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .clip-category {
            font-size: 11px;
            color: #3b82f6;
            background: rgba(59, 130, 246, 0.1);
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 500;
          }
          .clip-actions {
            display: flex;
            gap: 4px;
          }
          .clip-btn {
            background: #3b82f6;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            color: white;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
          }
          .clip-btn:hover {
            background: #2563eb;
          }
          .clip-btn.delete {
            background: #ef4444;
          }
          .clip-btn.delete:hover {
            background: #dc2626;
          }
          .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #64748b;
          }
          .empty-icon {
            font-size: 48px;
            margin-bottom: 16px;
          }
          .empty-text {
            font-size: 16px;
            margin-bottom: 8px;
          }
          .empty-hint {
            font-size: 14px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="quickview-header">
          <div class="quickview-title">
            <span><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.2em"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg></span>
            <span>Quick View</span>
            <span class="clip-count" id="clip-count">0 clips</span>
          </div>
          <div class="quickview-controls">
            <button class="quickview-btn" onclick="openMiniWindow()" title="Open mini Quick View (window)" aria-label="Open mini Quick View window"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 4v4"/><path d="M2 8h20"/><path d="M6 4v4"/></svg></button>
            <button class="quickview-btn" onclick="dockMiniBottomRight()" title="Open mini Quick View (bottom-right)" aria-label="Dock mini Quick View to bottom-right"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 13V19H13"/><path d="M5 5L19 19"/></svg></button>
            <button class="quickview-btn" onclick="refreshClips()" title="Refresh">🔄</button>
            <button class="quickview-btn" onclick="openSettings()" title="Settings">⚙️</button>
          </div>
        </div>
        <div class="quickview-content" id="quickview-content">
          <div class="empty-state">
            <div class="empty-icon">✨</div>
            <div class="empty-text">No clips saved yet</div>
            <div class="empty-hint">Right-click selected text to save clips</div>
          </div>
        </div>
        <script>
          function loadClips() {
            // This will communicate with parent to get clips
            window.parent.postMessage({ type: 'quickview-get-clips' }, '*');
          }
          
          function refreshClips() {
            loadClips();
          }
          
          function openSettings() {
            window.parent.postMessage({ type: 'quickview-open-settings' }, '*');
          }

          function openMiniWindow() {
            window.parent.postMessage({ type: 'quickview-open-mini', mode: 'window' }, '*');
          }

          function dockMiniBottomRight() {
            window.parent.postMessage({ type: 'quickview-open-mini', mode: 'corner' }, '*');
          }

          function isFromExtension(e) {
            return e && e.data && e.source === window.parent;
          }
          
          function copyClip(text, index) {
            // Decode HTML entities
            const textarea = document.createElement('textarea');
            textarea.innerHTML = text;
            const decodedText = textarea.value;
            
            navigator.clipboard.writeText(decodedText).then(() => {
              showToast('✓ Copied to clipboard!');
            }).catch(err => {
              console.error('Copy failed:', err);
              showToast('❌ Copy failed', true);
            });
          }
          
          function deleteClip(clipId, index, archived) {
            if (confirm('Delete this clip?')) {
              window.parent.postMessage({ type: 'quickview-delete-clip', clipId: String(clipId), index: index, archived: !!archived }, '*');
            }
          }
          
          function showToast(message, isError = false) {
            // Simple toast notification
            const toast = document.createElement('div');
            toast.textContent = message;
            const bgColor = isError ? '#ef4444' : '#10b981';
            toast.style.cssText = \`position:fixed;top:20px;left:50%;transform:translateX(-50%);background:\${bgColor};color:white;padding:10px 20px;border-radius:8px;z-index:9999;font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.15);animation:slideDown 0.3s ease\`;
            document.body.appendChild(toast);
            setTimeout(() => {
              toast.style.opacity = '0';
              toast.style.transform = 'translateX(-50%) translateY(-10px)';
              toast.style.transition = 'all 0.3s ease';
              setTimeout(() => toast.remove(), 300);
            }, 2000);
          }
          
          // Listen for clip data from parent
          window.addEventListener('message', (e) => {
            if (!e || !e.data) return;
            if (e.source !== window.parent) return;
            if (e.data.type === 'quickview-clips-data') {
              renderClips(e.data.clips);
            }
          });
          
          function renderClips(clips) {
            const container = document.getElementById('quickview-content');
            const counter = document.getElementById('clip-count');
            
            // Update counter
            if (counter) {
              counter.textContent = \`\${clips.length} clip\${clips.length !== 1 ? 's' : ''}\`;
            }
            
            if (!clips || clips.length === 0) {
              container.innerHTML = \`
                <div class="empty-state">
                  <div class="empty-icon">✨</div>
                  <div class="empty-text">No clips saved yet</div>
                  <div class="empty-hint">Right-click selected text to save clips</div>
                </div>
              \`;
              return;
            }
            
            container.innerHTML = clips.map((clip, index) => {
              const text = clip.text || clip;
              const displayText = text.length > 60 ? text.substring(0, 60) + '...' : text;
              const category = clip.category || 'Uncategorized';
              const escapedText = escapeHtml(text).replace(/'/g, '&apos;');
              const clipId = (clip && clip.id != null) ? String(clip.id) : String(index);
              const clipIdArg = JSON.stringify(clipId);
              const isArchived = !!(clip && (clip.archived === true || clip.source === 'archived'));
              const archivedArg = isArchived ? 'true' : 'false';
              
              return \`
                <div class="clip-item">
                  <div class="clip-content">
                    <div class="clip-text" title="\${escapeHtml(text)}">\${escapeHtml(displayText)}</div>
                    <div class="clip-meta">
                      <span class="clip-category">\${escapeHtml(category)}</span>
                    </div>
                  </div>
                  <div class="clip-actions">
                    <button class="clip-btn" onclick="copyClip('\${escapedText}', \${index})" title="Copy">📋</button>
                    <button class="clip-btn delete" onclick="deleteClip(\${clipIdArg}, \${index}, \${archivedArg})" title="Delete">×</button>
                  </div>
                </div>
              \`;
            }).join('');
          }
          
          function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
          }
          
          // Load clips on startup
          loadClips();
        </script>
      </body>
      </html>
    `;
    
    iframe.srcdoc = content;
    
    const hashText = (s) => {
      const str = String(s || '');
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return (h >>> 0).toString(36);
    };

    const normalizeClip = (clip, index, source) => {
      if (typeof clip === 'string') {
        const ts = Date.now();
        return {
          id: `${ts}_${hashText(clip)}_${index}`,
          text: clip,
          category: 'Uncategorized',
          timestamp: ts,
          source
        };
      }
      if (!clip || typeof clip !== 'object') return null;
      const text = clip.text ?? clip;
      if (!text) return null;
      const ts = (typeof clip.timestamp === 'number') ? clip.timestamp : Date.now();
      const id = clip.id ?? clip.clip_id ?? clip.clipId ?? `${ts}_${hashText(text)}_${index}`;
      return {
        ...clip,
        id: String(id),
        text: String(text),
        category: clip.category || 'Uncategorized',
        timestamp: ts,
        source
      };
    };

    const getQuickViewClips = async () => {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'pcGetQuickViewClips' });
        if (response?.success && Array.isArray(response.clips)) {
          return response.clips;
        }
      } catch (_) {}

      const result = await new Promise((resolve) => chrome.storage.local.get(['clips', 'searchOnlyClips'], resolve));
      const active = Array.isArray(result?.clips) ? result.clips : [];
      const archived = Array.isArray(result?.searchOnlyClips) ? result.searchOnlyClips : [];

      const merged = [
        ...active.map((c, i) => normalizeClip(c, i, 'active')).filter(Boolean),
        ...archived.map((c, i) => normalizeClip(c, i, 'archived')).filter(Boolean).map(c => ({ ...c, archived: true }))
      ];

      // Newest-first, stable fallback (id) for tie-break.
      merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || String(b.id).localeCompare(String(a.id)));

      // Keep panel fast: Quick View is for “recent”, not infinite scroll.
      return merged.slice(0, 200);
    };

    // Listen for storage changes to auto-refresh clips
    const storageListener = (changes, area) => {
      if (area !== 'local' || !iframe.contentWindow) return;
      if (!changes.clips && !changes.searchOnlyClips) return;
      getQuickViewClips()
        .then((clips) => {
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'quickview-clips-data', clips }, '*');
          }
        })
        .catch(() => {});
    };
    chrome.storage.onChanged.addListener(storageListener);
    
    // Store listener reference for cleanup
    this._quickViewStorageListener = storageListener;
    
    // Listen for messages from iframe
    const messageHandler = (e) => {
      if (!e || !e.data) return;
      if (iframe.contentWindow && e.source !== iframe.contentWindow) return;

      if (e.data.type === 'quickview-get-clips') {
        getQuickViewClips().then((clips) => {
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'quickview-clips-data', clips }, '*');
          }
        }).catch(() => {});
      } else if (e.data.type === 'quickview-delete-clip') {
        // Handle clip deletion (active + archived)
        const clipIdKey = String(e.data.clipId || '');
        const isArchived = e.data.archived === true;

        chrome.storage.local.get(['clips', 'searchOnlyClips'], (result) => {
          const clips = Array.isArray(result?.clips) ? result.clips : [];
          const archived = Array.isArray(result?.searchOnlyClips) ? result.searchOnlyClips : [];

          const filterOutById = (arr) => arr.filter(c => String(c?.id ?? c?.clip_id ?? c?.clipId ?? '') !== clipIdKey);

          let nextClips = clips;
          let nextArchived = archived;

          if (clipIdKey) {
            if (isArchived) {
              nextArchived = filterOutById(archived);
            } else {
              nextClips = filterOutById(clips);
            }
          }

          // If we couldn't delete by id (legacy/missing), fall back to index within the merged view:
          // recompute merged list, find target at index, then delete from correct source.
          const idDeleteWorked = (isArchived ? nextArchived.length !== archived.length : nextClips.length !== clips.length);
          if (!idDeleteWorked && Number.isFinite(e.data.index)) {
            const idx = parseInt(e.data.index, 10);
            if (!Number.isNaN(idx) && idx >= 0) {
              const merged = [
                ...clips.map((c, i) => normalizeClip(c, i, 'active')).filter(Boolean),
                ...archived.map((c, i) => normalizeClip(c, i, 'archived')).filter(Boolean).map(c => ({ ...c, archived: true }))
              ].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || String(b.id).localeCompare(String(a.id)));

              const target = merged[idx];
              if (target && target.source === 'archived') {
                nextArchived = archived.filter(c => String(c?.id ?? c?.clip_id ?? c?.clipId ?? '') !== String(target.id));
              } else if (target && target.source === 'active') {
                nextClips = clips.filter(c => String(c?.id ?? c?.clip_id ?? c?.clipId ?? '') !== String(target.id));
              }
            }
          }

          chrome.storage.local.set({ clips: nextClips, searchOnlyClips: nextArchived, pc_local_updatedAt: Date.now() }, () => {
            getQuickViewClips().then((merged) => {
              if (iframe.contentWindow) {
                iframe.contentWindow.postMessage({ type: 'quickview-clips-data', clips: merged }, '*');
              }
              chrome.runtime.sendMessage({ action: 'clipsUpdated' }).catch(() => {});
            }).catch(() => {});
          });
        });
      } else if (e.data.type === 'quickview-open-settings') {
        // Open settings from quick view
        this.closeQuickView();
        setTimeout(() => this.openSettings(), 100);
      } else if (e.data.type === 'quickview-open-mini') {
        const mode = String(e.data.mode || 'window');
        this.openMiniQuickView(mode === 'corner' ? 'corner' : 'window');
      }
    };
    
    window.addEventListener('message', messageHandler);
    // Store reference for cleanup
    this._quickViewMessageHandler = messageHandler;
  }
  
  addQuickViewStyles() {
    // Check if styles already exist
    if (document.getElementById('pastecraft-quickview-styles')) {
      return;
    }
    
    const styles = document.createElement('style');
    styles.id = 'pastecraft-quickview-styles';
    styles.textContent = `
      /* Quick View Backdrop */
      .pastecraft-quickview-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: transparent;
        z-index: 2147483645;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
      }
      
      .pastecraft-quickview-backdrop.visible {
        opacity: 1;
      }
      
      /* Quick View Panel - same size as popup (wide) */
      .pastecraft-quickview-panel {
        position: fixed;
        top: 0;
        right: 0;
        width: 476px;
        max-width: 90vw;
        height: 100vh;
        background: white;
        box-shadow: -4px 0 16px rgba(0, 0, 0, 0.2);
        z-index: 2147483646;
        transform: translateX(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      .pastecraft-quickview-panel.visible {
        transform: translateX(0);
      }
      
      /* Quick View Iframe */
      .pastecraft-quickview-iframe {
        width: 100%;
        height: 100%;
        border: none;
        background: white;
      }
      
      /* Responsive - Full width on mobile */
      @media (max-width: 480px) {
        .pastecraft-quickview-panel {
          width: 100%;
        }
      }

      /* Mini Quick View (placeholder) */
      .pastecraft-mini-quickview {
        position: fixed;
        width: 360px;
        height: 460px;
        max-width: 92vw;
        max-height: 85vh;
        background: white;
        border: 1px solid rgba(148, 163, 184, 0.55);
        border-radius: 12px;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
        z-index: 2147483647;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .pastecraft-mini-quickview-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 50%, #1d4ed8 100%);
        color: white;
        cursor: grab;
        user-select: none;
      }

      .pastecraft-mini-quickview-header:active {
        cursor: grabbing;
      }

      .pastecraft-mini-quickview-title {
        font-size: 14px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .pastecraft-mini-quickview-controls {
        display: inline-flex;
        gap: 8px;
        align-items: center;
      }

      .pastecraft-mini-quickview-btn {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        border-radius: 8px;
        width: 28px;
        height: 28px;
        color: white;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
      }

      .pastecraft-mini-quickview-btn:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.05);
      }

      .pastecraft-mini-quickview-body {
        flex: 1;
        background: rgba(241, 245, 249, 0.65);
        overflow-y: auto;
        padding: 8px;
      }

      .pastecraft-mini-quickview-empty {
        text-align: center;
        color: #64748b;
        font-size: 13px;
        padding: 32px 16px;
      }

      .pastecraft-mini-quickview-clip {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 10px 12px;
        margin-bottom: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .pastecraft-mini-quickview-clip:hover {
        background: #eff6ff;
        border-color: #3b82f6;
      }

      .pastecraft-mini-quickview-clip-text {
        font-size: 13px;
        color: #1f2937;
        line-height: 1.4;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .pastecraft-mini-quickview-clip-category {
        font-size: 11px;
        color: #3b82f6;
        background: rgba(59, 130, 246, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 500;
        align-self: flex-start;
      }

      .pastecraft-mini-quickview.docked {
        right: 20px;
        bottom: 20px;
      }
    `;
    
    document.head.appendChild(styles);
  }
  
  closeQuickView() {
    const backdrop = document.getElementById('pastecraft-quickview-backdrop');
    const panel = document.getElementById('pastecraft-quickview-panel');
    
    if (this._quickViewOutsidePointerDown) {
      document.removeEventListener('pointerdown', this._quickViewOutsidePointerDown, true);
      this._quickViewOutsidePointerDown = null;
    }
    
    if (backdrop) backdrop.classList.remove('visible');
    if (panel) panel.classList.remove('visible');
    
    if (backdrop || panel) {
      // Remove after animation
      setTimeout(() => {
        if (backdrop) backdrop.remove();
        if (panel) panel.remove();
      }, 300);
      
      // Update open state
      this.openStates.quickView = false;
      
      // Slide widget back to right edge (if no other panels open)
      if (!this.openStates.popup && !this.openStates.settings) {
        this.widget.classList.remove('panel-open');
      }
      
      // Remove active class from quick view button
      const quickViewButton = this.widget.querySelector('.quick-view-button');
      if (quickViewButton) {
        quickViewButton.classList.remove('active');
      }
      
      // Clean up storage listener
      if (this._quickViewStorageListener) {
        chrome.storage.onChanged.removeListener(this._quickViewStorageListener);
        this._quickViewStorageListener = null;
      }
      
      // Clean up message handler
      if (this._quickViewMessageHandler) {
        window.removeEventListener('message', this._quickViewMessageHandler);
        this._quickViewMessageHandler = null;
      }

      // Update docked page push based on remaining panels
      this.syncPageDocking();
      
      console.log('✅ Quick View panel closed');
    }
  }

  openMiniQuickView(mode = 'window') {
    try {
      // Ensure base styles exist
      this.addQuickViewStyles();

      const existing = document.getElementById('pastecraft-mini-quickview');
      if (existing) {
        existing.classList.toggle('docked', mode === 'corner');
        // Bring to front
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

      this._populateMiniQuickView(body);

      const storageListener = (changes, area) => {
        if (area !== 'local') return;
        if (!changes.clips && !changes.searchOnlyClips) return;
        if (!document.body.contains(el)) return;
        this._populateMiniQuickView(body);
      };
      chrome.storage.onChanged.addListener(storageListener);

      const closeMini = () => {
        try { chrome.storage.onChanged.removeListener(storageListener); } catch (_) {}
        el.remove();
      };
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeMini();
      });

      // Initial position (window mode): place it slightly left of the Quick View panel.
      if (mode !== 'corner') {
        const w = el.getBoundingClientRect().width || 360;
        const viewportW = Math.max(320, window.innerWidth || 0);
        const left = Math.max(12, viewportW - 476 - w - 16);
        el.style.left = `${left}px`;
        el.style.top = '90px';
      }

      // Draggable header
      const dragState = { dragging: false, dx: 0, dy: 0 };
      const onPointerMove = (e) => {
        if (!dragState.dragging) return;
        const nextLeft = Math.max(0, (e.clientX - dragState.dx));
        const nextTop = Math.max(0, (e.clientY - dragState.dy));
        el.style.left = `${nextLeft}px`;
        el.style.top = `${nextTop}px`;
      };
      const onPointerUp = () => {
        dragState.dragging = false;
        try { header.releasePointerCapture?.(dragState.pointerId); } catch (_) {}
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
        try { header.setPointerCapture?.(e.pointerId); } catch (_) {}
        window.addEventListener('pointermove', onPointerMove, true);
        window.addEventListener('pointerup', onPointerUp, true);
      });
    } catch (err) {
      console.error('❌ Error opening mini Quick View:', err);
    }
  }

  async _populateMiniQuickView(body) {
    if (!body) return;
    body.textContent = '';

    let active = [];
    let archived = [];
    try {
      const res = await new Promise((resolve) => chrome.storage.local.get(['clips', 'searchOnlyClips'], resolve));
      active = Array.isArray(res?.clips) ? res.clips : [];
      archived = Array.isArray(res?.searchOnlyClips) ? res.searchOnlyClips : [];
    } catch (_) {
      // ignore — render empty state below
    }

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
        card.style.borderColor = '#10b981';
        setTimeout(() => {
          txt.textContent = original;
          card.style.borderColor = originalColor;
        }, 800);
        try { window.pasteCraftQuickPaste?.showToast?.('Copied!', 'success'); } catch (_) {}
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
          } catch (e) {
            try { window.pasteCraftQuickPaste?.showToast?.('Copy failed', 'error'); } catch (_) {}
          }
        }
      });

      body.appendChild(card);
    });
  }

  loadSavedPosition() {
    const revealWidget = () => {
      if (this.widget) {
        this.widget.style.visibility = 'visible';
      }
    };

    chrome.storage.local.get(['widgetPosition'], (result) => {
      if (result.widgetPosition && this.widget) {
        this.position = result.widgetPosition;
        this.widget.style.top = this.position.top + '%';
        console.log('📍 Widget position loaded:', this.position.top + '%');
      }
      revealWidget();
    });

    // Fallback: never leave widget hidden if storage callback is delayed
    setTimeout(revealWidget, 800);
  }
  
  savePosition() {
    chrome.storage.local.set({ widgetPosition: this.position });
  }
}

