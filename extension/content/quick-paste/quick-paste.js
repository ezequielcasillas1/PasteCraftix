import { safeRuntimeSendMessage, pastecraftGetURL, PASTECRAFT_PAGE_ORIGIN } from '../shared.js';
import { createClosedShadowHost } from '../safety/shadow-host.js';

export class QuickPasteInterface {
  constructor() {
    this.isVisible = false;
    this.clips = [];
    this.container = null;
    this.settingsModal = null;
    this.position = { x: 0, y: null }; // Default position - left side, CSS handles vertical centering
    this.settings = {
      theme: 'light', // Inherited from global theme, not user-configurable in Quick Paste
      autoHide: true,
      showTimestamps: true,
      maxClipsDisplay: 20,
      delimiter: 'comma',
      customDelimiter: ', ',
      persistOpen: true,  // Stay open when clicking on page
      options: {
        deduplicate: false,
        sort: false,
        uppercase: false
      }
    };
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    // selectedClips stores stable clip id keys (String(clip.id)), not indices.
    this.selectedClips = new Set(); // Track selected clips for multi-select

    // Serialize clip mutations to prevent races / double-click issues.
    this._clipOpQueue = Promise.resolve();
    
    this.init();
  }

  _clipIdKey(id) {
    return String(id);
  }

  _queueClipOp(fn) {
    const run = this._clipOpQueue.then(fn, fn);
    this._clipOpQueue = run.catch(() => {});
    return run;
  }

  _applyIncomingClip(rawClip) {
    if (!rawClip || typeof rawClip !== 'object') return false;
    const idKey = this._clipIdKey(rawClip.id);
    const idx = this.clips.findIndex((c) => this._clipIdKey(c?.id) === idKey);
    if (idx >= 0) {
      this.clips[idx] = rawClip;
    } else {
      this.clips.unshift(rawClip);
    }
    return true;
  }

  _scheduleClipsReload() {
    if (this._clipsReloadTimer) return;
    this._clipsReloadTimer = setTimeout(async () => {
      this._clipsReloadTimer = null;
      await this.loadClips();
      if (this.isVisible) this.updateInterface();
    }, 150);
  }

  _fnv1a36(str) {
    const s = String(str || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }
  
  async init() {
    await this.loadInitialData();
    this.createInterface();
    this.setupEventListeners();
    this.setupMessageListener();
    this.setupStorageSync();
    
    // Removed auto-show on right-click - now controlled by context menu
    
    console.log('🚀 PasteCraft Quick Paste initialized');
  }

  async loadInitialData() {
    try {
      const result = await chrome.storage.local.get([
        'clips',
        'quickPasteSettings',
        'quickPastePosition',
        'theme',
      ]);

      await this._applyLoadedClips(result.clips);
      this._applyLoadedSettings(result);
    } catch (error) {
      console.error('❌ DIAGNOSTIC [Quick Paste]: Failed to load initial data:', error);
      this.clips = [];
    }
  }

  async _applyLoadedClips(rawClips) {
    const raw = Array.isArray(rawClips) ? rawClips : [];
    let changed = false;

    const normalized = raw.map((clip, i) => {
      if (!clip || typeof clip !== 'object') {
        const text = String(clip || '');
        const id = `legacy_${this._fnv1a36(`${text}|${i}`)}`;
        changed = true;
        return { id, text, category: 'Uncategorized', timestamp: Date.now() };
      }

      if (clip.id == null) {
        const text = typeof clip.text === 'string' ? clip.text : String(clip.text || '');
        const ts = typeof clip.timestamp === 'number' ? clip.timestamp : 0;
        const bucket = Math.floor(ts / 3000);
        const id = `legacy_${this._fnv1a36(`${text}|${bucket}|${clip.category || ''}`)}`;
        changed = true;
        return { ...clip, id };
      }

      return clip;
    });

    this.clips = normalized;

    if (changed) {
      try {
        await chrome.storage.local.set({ clips: this.clips, pc_local_updatedAt: Date.now() });
      } catch (_) {}
    }
  }

  _applyLoadedSettings(result = {}) {
    if (result.quickPasteSettings) {
      this.settings = { ...this.settings, ...result.quickPasteSettings };
    }
    if (result.theme === 'dark' || result.theme === 'light') {
      this.settings.theme = result.theme;
    } else if (this.settings.theme !== 'dark') {
      this.settings.theme = 'light';
    }
    if (result.quickPastePosition) {
      this.position = { ...this.position, ...result.quickPastePosition };
    }
  }
  
  async loadClips() {
    try {
      const result = await chrome.storage.local.get(['clips']);
      await this._applyLoadedClips(result.clips);
    } catch (error) {
      console.error('❌ DIAGNOSTIC [Quick Paste]: Failed to load clips:', error);
      this.clips = [];
    }
  }
  
  createInterface() {
    if (this.container) {
      this.container.remove();
    }
    if (!this.shadowMount) {
      this.shadowMount = createClosedShadowHost('pc-quick-paste-host');
      this.shadowMount.host.style.pointerEvents = 'auto';
    }
    const root = this.shadowMount.root;

    this.container = document.createElement('div');
    this.container.className = 'pastecraft-quick-paste';
    this.container.setAttribute('data-field', 'pastecraft-quick-paste');
    this.container.innerHTML = `
      <div class="pastecraft-header">
        <div class="pastecraft-logo">📋 PasteCraft</div>
        <div class="pastecraft-controls">
          <button class="pastecraft-btn pastecraft-settings" title="Settings">⚙️</button>
          <button class="pastecraft-btn pastecraft-close" title="Close">×</button>
        </div>
      </div>
      <div class="pastecraft-content">
        <div class="pastecraft-clips-container">
          ${this.renderClips()}
        </div>
        <div class="pastecraft-footer">
          <button class="pastecraft-btn pastecraft-refresh" title="Clear all clips">🗑️</button>
          <span class="pastecraft-count">${this.clips.length} clips</span>
          <button class="pastecraft-btn pastecraft-copy-multiple" id="pastecraft-copy-multiple" disabled title="Copy multiple selected clips">Copy Multiple Clips</button>
        </div>
      </div>
    `;
    
    this.addStyles(root);
    
    // Initially hidden
    this.container.style.display = 'none';
    root.appendChild(this.container);
    this.applySettings();
  }
  
  renderClips() {
    if (this.clips.length === 0) {
      return `
        <div class="pastecraft-empty">
          <div class="pastecraft-empty-icon">✨</div>
          <p>No clips saved yet</p>
          <small>Right-click selected text to save</small>
        </div>
      `;
    }
    
    return this.clips.slice(0, this.settings.maxClipsDisplay).map((clip, index) => {
      const text = clip.text || clip;
      const displayText = text.length > 50 ? text.substring(0, 50) + '...' : text;
      const category = clip.category || 'Uncategorized';
      const timeAgo = this.settings.showTimestamps ? this.getTimeAgo(clip.timestamp) : '';
      const clipIdKey = this._clipIdKey(clip?.id != null ? clip.id : index);
      const qpBadge = this._detectQuickBadge(text);
      const qpFormatted = this._lightFormatPreview(displayText);
      
      return `
        <div class="pastecraft-clip" data-index="${index}" data-clip-id="${clipIdKey}" title="${this.escapeHtml(text)}">
          <div class="pastecraft-clip-content">
            <div class="pastecraft-clip-text">${qpBadge}${qpFormatted}</div>
            <div class="pastecraft-clip-meta">
              <span class="pastecraft-category">${this.escapeHtml(category)}</span>
              ${timeAgo ? `<span class="pastecraft-time">${timeAgo}</span>` : ''}
            </div>
          </div>
          <div class="pastecraft-clip-actions">
            <button class="pastecraft-btn pastecraft-paste" data-clip-id="${clipIdKey}" data-index="${index}" title="Paste">📋</button>
            <button class="pastecraft-btn pastecraft-delete" data-clip-id="${clipIdKey}" data-index="${index}" title="Delete">×</button>
          </div>
        </div>
      `;
    }).join('');
  }
  
  addStyles(root = this.shadowMount?.root) {
    if (!root) return;
    if (root.querySelector('[data-field="pastecraft-quick-paste-styles"]')) {
      return;
    }

    const styles = document.createElement('style');
    styles.setAttribute('data-field', 'pastecraft-quick-paste-styles');
    styles.textContent = `
      .pastecraft-quick-paste {
        position: fixed;
        top: 50%;
        left: 0;
        transform: translateY(-50%);
        width: 320px;
        max-height: 600px;
        background: white;
        border-radius: 0 12px 12px 0;
        box-shadow: 4px 0 60px rgba(0, 0, 0, 0.3);
        border: 1px solid #e2e8f0;
        border-left: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: 999999;
        overflow: hidden;
        overflow-x: hidden;
        backdrop-filter: blur(10px);
        animation: pastecraft-slide-in 0.3s ease;
      }
      
      @keyframes pastecraft-slide-in {
        from { transform: translate(-100%, -50%); opacity: 0; }
        to { transform: translate(0, -50%); opacity: 1; }
      }
      
      .pastecraft-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: #5797EF;
        color: white;
        font-size: 14px;
        font-weight: 600;
      }
      
      .pastecraft-logo {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .pastecraft-controls {
        display: flex;
        gap: 4px;
      }
      
      .pastecraft-btn {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        border-radius: 6px;
        padding: 4px 8px;
        color: white;
        cursor: pointer;
        font-size: 12px;
        transition: background 0.2s;
      }
      
      .pastecraft-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      
      .pastecraft-content {
        max-height: 400px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        position: relative;
      }
      
      .pastecraft-clips-container {
        padding: 8px;
        flex: 1;
        overflow-y: auto;
      }
      
      .pastecraft-clip {
        display: flex;
        align-items: center;
        padding: 10px;
        margin: 4px 0;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .pastecraft-clip:hover {
        background: #f1f5f9;
        border-color: #3b82f6;
        transform: translateX(2px);
      }
      
      .pastecraft-clip-content {
        flex: 1;
        min-width: 0;
      }
      
      .pastecraft-clip-text {
        font-size: 13px;
        color: #1f2937;
        margin-bottom: 4px;
        word-break: break-word;
      }
      
      .pastecraft-clip-meta {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: #6b7280;
      }
      
      .pastecraft-category {
        background: #e0e7ff;
        color: #3730a3;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 500;
      }
      
      .pastecraft-clip-actions {
        margin-left: 8px;
      }

      .pastecraft-btn > svg,
      .pastecraft-btn > svg *,
      .pastecraft-btn > img,
      .pastecraft-btn > span,
      .pastecraft-clip-actions button > svg,
      .pastecraft-clip-actions button > svg *,
      .pastecraft-clip-actions button > img,
      .pastecraft-clip-actions button > span {
        pointer-events: none;
      }
      
      .pastecraft-paste {
        background: #10b981 !important;
        color: white !important;
        padding: 6px !important;
        border-radius: 6px !important;
      }
      
      .pastecraft-paste:hover {
        background: #059669 !important;
      }
      
      .pastecraft-empty {
        text-align: center;
        padding: 40px 20px;
        color: #6b7280;
      }
      
      .pastecraft-empty-icon {
        font-size: 24px;
        margin-bottom: 8px;
      }
      
      /* Settings Modal Styles */
      .pastecraft-settings-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1000001;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .pastecraft-modal-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
      }
      
      .pastecraft-modal-content {
        position: relative;
        background: white;
        border-radius: 12px;
        width: 400px;
        max-width: 90vw;
        max-height: 80vh;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .pastecraft-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border-bottom: 1px solid #e5e7eb;
      }
      
      .pastecraft-modal-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #1f2937;
      }
      
      .pastecraft-modal-close {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #6b7280;
        padding: 4px;
        border-radius: 4px;
      }
      
      .pastecraft-modal-close:hover {
        background: #f3f4f6;
        color: #374151;
      }
      
      /* Help Modal Styles - Force proper centering */
      .pastecraft-help-modal {
        display: none;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        z-index: 10000 !important;
        justify-content: center !important;
        align-items: center !important;
        background: rgba(0, 0, 0, 0.5) !important;
      }
      
      .pastecraft-help-modal .pastecraft-modal-backdrop {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: rgba(0, 0, 0, 0.5) !important;
      }
      
      .pastecraft-help-modal .pastecraft-modal-content {
        position: relative !important;
        background: white !important;
        border-radius: 12px !important;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3) !important;
        max-width: 600px !important;
        max-height: 80vh !important;
        width: 90% !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
        margin: auto !important;
      }
      
      .pastecraft-modal-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      
      .pastecraft-help-btn, .pastecraft-back-btn {
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 36px;
        height: 36px;
      }
      
      .pastecraft-help-btn:hover, .pastecraft-back-btn:hover {
        background: #2563eb;
        transform: translateY(-1px);
      }
      
      .help-content {
        padding: 20px !important;
        color: #374151 !important;
      }
      
      .help-section {
        margin-bottom: 24px;
      }
      
      .help-section h4 {
        color: #1f2937 !important;
        margin-bottom: 12px;
        font-size: 16px;
        font-weight: 600;
        border-bottom: 2px solid #e5e7eb;
        padding-bottom: 8px;
      }
      
      .help-item {
        margin-bottom: 12px;
        padding: 12px;
        background: #f8fafc;
        border-radius: 8px;
        border-left: 4px solid #3b82f6;
        line-height: 1.5;
        color: #374151 !important;
      }
      
      .help-item strong {
        color: #1f2937 !important;
        font-weight: 600 !important;
      }
      
      .help-item ul {
        margin: 8px 0 0 20px;
        color: #374151 !important;
      }
      
      .help-item li {
        margin-bottom: 4px;
        color: #374151 !important;
      }
      
      .pastecraft-modal-body {
        padding: 0;
        max-height: 60vh;
        overflow-y: auto;
      }
      
      .pastecraft-setting {
        padding: 20px 24px;
        border-bottom: 1px solid #f3f4f6;
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 60px;
      }
      
      .pastecraft-setting:last-child {
        border-bottom: none;
      }
      
      .pastecraft-setting label {
        font-weight: 500;
        color: #374151;
        font-size: 14px;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .pastecraft-setting select,
      .pastecraft-setting input[type="number"] {
        padding: 8px 12px;
        border: 1.5px solid #d1d5db;
        border-radius: 8px;
        font-size: 14px;
        background: white;
        color: #374151;
        transition: all 0.2s ease;
        min-width: 120px;
      }
      
      .pastecraft-setting select:focus,
      .pastecraft-setting input[type="number"]:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      
      .pastecraft-setting input[type="checkbox"] {
        width: 18px;
        height: 18px;
        accent-color: #3b82f6;
        cursor: pointer;
      }
      
      
      .pastecraft-modal-actions {
        display: flex;
        gap: 12px;
        padding: 24px;
        background: #f8fafc;
        border-top: 1px solid #f1f5f9;
        justify-content: flex-end;
      }
      
      .pastecraft-btn-secondary {
        background: white;
        color: #6b7280;
        border: 1.5px solid #d1d5db;
        border-radius: 8px;
        padding: 12px 20px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
      }
      
      .pastecraft-btn-secondary:hover {
        background: #f9fafb;
        border-color: #9ca3af;
        color: #374151;
      }
      
      .pastecraft-btn-primary {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 12px 24px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.2s ease;
        box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
      }
      
      .pastecraft-btn-primary:hover {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
      }
      
      .pastecraft-btn-danger {
        background: #ef4444;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 10px 16px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      }
      
      .pastecraft-btn-danger:hover {
        background: #dc2626;
      }
      
      /* Settings Modal - Delimiter and Options Styles */
      .pastecraft-setting-group {
        margin: 0;
        padding: 24px;
        border-bottom: 1px solid #f3f4f6;
        background: white;
      }
      
      .pastecraft-setting-group:last-child {
        border-bottom: none;
      }
      
      .pastecraft-setting-label {
        display: block;
        font-weight: 600;
        margin-bottom: 16px;
        color: #1f2937;
        font-size: 15px;
        letter-spacing: -0.025em;
      }
      
      .pastecraft-segmented-control {
        display: flex;
        background: #f3f4f6;
        border-radius: 10px;
        padding: 4px;
        gap: 2px;
      }
      
      .pastecraft-segment-btn {
        flex: 1;
        padding: 10px 16px;
        border: none;
        background: transparent;
        color: #6b7280;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        border-radius: 6px;
        transition: all 0.2s ease;
      }
      
      .pastecraft-segment-btn.active {
        background: white;
        color: #1f2937;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
      
      .pastecraft-segment-btn:hover:not(.active) {
        background: rgba(255, 255, 255, 0.5);
        color: #374151;
      }
      
      .pastecraft-toggles {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      
      .pastecraft-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        padding: 12px 16px;
        background: #f8fafc;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
        transition: all 0.2s ease;
      }
      
      .pastecraft-toggle:hover {
        background: #f1f5f9;
        border-color: #cbd5e1;
      }
      
      .pastecraft-toggle input[type="checkbox"] {
        display: none;
      }
      
      .pastecraft-toggle-switch {
        width: 44px;
        height: 24px;
        background: #cbd5e1;
        border-radius: 12px;
        position: relative;
        transition: all 0.3s ease;
        flex-shrink: 0;
      }
      
      .pastecraft-toggle-switch::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 20px;
        height: 20px;
        background: white;
        border-radius: 50%;
        transition: all 0.3s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
      
      .pastecraft-toggle input:checked + .pastecraft-toggle-switch {
        background: #3b82f6;
      }
      
      .pastecraft-toggle input:checked + .pastecraft-toggle-switch::after {
        transform: translateX(20px);
      }
      
      .pastecraft-toggle span {
        font-weight: 500;
        color: #374151;
        font-size: 14px;
      }
      
      /* Custom delimiter input styling */
      #quickPasteCustomDelimiter {
        margin-top: 12px !important;
        padding: 10px 14px !important;
        border: 1.5px solid #d1d5db !important;
        border-radius: 8px !important;
        font-size: 14px !important;
        background: white !important;
        color: #374151 !important;
        transition: all 0.2s ease !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }
      
      #quickPasteCustomDelimiter:focus {
        outline: none !important;
        border-color: #3b82f6 !important;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
      }
      
      #quickPasteCustomDelimiter::placeholder {
        color: #64748b !important;
        font-style: italic !important;
      }
      
      
      .pastecraft-interface.dark .pastecraft-setting-group {
        background: #374151;
        border-color: #4b5563;
      }
      
      .pastecraft-interface.dark .pastecraft-setting-label {
        color: #f9fafb;
      }
      
      .pastecraft-interface.dark .pastecraft-segment-btn {
        background: #4b5563;
        color: #d1d5db;
        border-color: #6b7280;
      }
      
      .pastecraft-interface.dark .pastecraft-segment-btn:hover:not(.active) {
        background: #6b7280;
      }
      
      /* Confirmation modal uses same styles as settings modal */
      .pastecraft-confirm-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1000002;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      /* Dark theme support */
      .pastecraft-interface.dark {
        background: #1f2937;
        border-color: #374151;
        color: #f9fafb;
      }
      
      .pastecraft-interface.dark .pastecraft-header {
        background: #111827;
        border-color: #374151;
      }
      
      .pastecraft-interface.dark .pastecraft-clip {
        background: #374151;
        border-color: #4b5563;
      }
      
      .pastecraft-interface.dark .pastecraft-clip:hover {
        background: #4b5563;
      }
      
      .pastecraft-interface.dark .pastecraft-clip-text {
        color: #f9fafb;
      }
      
      .pastecraft-interface.dark .pastecraft-clip-meta {
        color: #cbd5e1;
      }
      
      .pastecraft-footer {
        position: sticky !important;
        bottom: 0 !important;
        z-index: 1000 !important;
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        padding: 12px 16px !important;
        background: rgba(248, 250, 252, 0.98) !important;
        backdrop-filter: blur(12px) !important;
        border-top: 2px solid #e2e8f0 !important;
        font-size: 12px !important;
        color: #6b7280 !important;
        box-shadow: 0 -6px 20px rgba(0, 0, 0, 0.15) !important;
        flex-wrap: nowrap !important;
        gap: 12px !important;
        margin: 0 !important;
        flex-shrink: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        left: 0 !important;
        overflow: hidden !important;
        min-width: 0 !important;
        right: 0 !important;
        box-sizing: border-box !important;
      }
      
      .pastecraft-count {
        font-weight: 500;
      }
      
      /* Custom scrollbar */
      .pastecraft-content::-webkit-scrollbar {
        width: 6px;
      }
      
      .pastecraft-content::-webkit-scrollbar-track {
        background: #f1f5f9;
      }
      
      .pastecraft-content::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
      }
      
      .pastecraft-content::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
      
      /* Delete button styling */
      .pastecraft-delete {
        background: #ef4444 !important;
        color: white !important;
        font-size: 16px !important;
        padding: 4px 8px !important;
        border-radius: 4px !important;
        margin-left: 4px !important;
      }
      
      .pastecraft-delete:hover {
        background: #dc2626 !important;
        transform: scale(1.1);
      }
      
      /* Multi-select functionality - NUCLEAR SPECIFICITY */
      .pastecraft-interface.pastecraft-interface .pastecraft-clip.selected.selected {
        background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%) !important;
        color: white !important;
        border: 4px solid #ff6b35 !important;
        box-shadow: 0 8px 25px rgba(255, 107, 53, 0.9) !important;
        transform: scale(1.08) !important;
        z-index: 50 !important;
        position: relative !important;
        outline: 3px solid rgba(255, 107, 53, 0.5) !important;
        outline-offset: 2px !important;
      }
      
      .pastecraft-interface.pastecraft-interface .pastecraft-clip.selected.selected * {
        color: white !important;
      }
      
      .pastecraft-interface.pastecraft-interface .pastecraft-clip.selected.selected .pastecraft-clip-text {
        color: white !important;
        font-weight: 900 !important;
        text-shadow: 0 2px 4px rgba(0,0,0,0.5) !important;
        font-size: 1.1em !important;
      }
      
      .pastecraft-interface.pastecraft-interface .pastecraft-clip.selected.selected .pastecraft-clip-meta {
        color: rgba(255, 255, 255, 1) !important;
      }
      
      .pastecraft-interface.pastecraft-interface .pastecraft-clip.selected.selected .pastecraft-category {
        background: rgba(255, 255, 255, 0.6) !important;
        color: #ff6b35 !important;
        border: 2px solid white !important;
        font-weight: 700 !important;
      }
      
      .pastecraft-interface.pastecraft-interface .pastecraft-clip.selected.selected .pastecraft-time {
        color: rgba(255, 255, 255, 1) !important;
        font-weight: 600 !important;
      }
      
      .pastecraft-interface.pastecraft-interface .pastecraft-clip.selected.selected .pastecraft-btn {
        background: rgba(255, 255, 255, 0.3) !important;
        color: white !important;
        border: 2px solid rgba(255, 255, 255, 0.8) !important;
      }
      
      /* Dark theme override for selection */
      .pastecraft-interface.dark.pastecraft-interface .pastecraft-clip.selected.selected {
        background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%) !important;
        border-color: #ff6b35 !important;
      }
      
      /* Copy Multiple button styling */
      .pastecraft-copy-multiple {
        background: #8b5cf6 !important;
        color: white !important;
        font-weight: 600 !important;
        padding: 6px 12px !important;
        border-radius: 6px !important;
        font-size: 12px !important;
        border: 1px solid #7c3aed !important;
        box-shadow: 0 2px 6px rgba(139, 92, 246, 0.3) !important;
        flex: none !important;
        min-width: auto !important;
        max-width: 140px !important;
        text-align: center !important;
        white-space: nowrap !important;
        margin-left: 0 !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }
      
      .pastecraft-copy-multiple:hover:not(:disabled) {
        background: #7c3aed !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.5) !important;
      }
      
      .pastecraft-copy-multiple:disabled {
        background: #e5e7eb !important;
        color: #6b7280 !important;
        cursor: not-allowed !important;
        transform: none !important;
        box-shadow: none !important;
        border-color: #d1d5db !important;
      }
      
      .pastecraft-interface.dark .pastecraft-footer {
        background: rgba(31, 41, 55, 0.98) !important;
        border-top-color: #374151 !important;
      }
      
      /* NUCLEAR STICKY FOOTER FIX */
      .pastecraft-quick-paste .pastecraft-footer {
        position: -webkit-sticky !important;
        position: sticky !important;
        bottom: 0px !important;
        z-index: 9999 !important;
        margin-top: auto !important;
      }
      
      .pastecraft-quick-paste .pastecraft-content {
        display: -webkit-flex !important;
        display: flex !important;
        -webkit-flex-direction: column !important;
        flex-direction: column !important;
        height: 100% !important;
        min-height: 300px !important;
      }
      
      .pastecraft-quick-paste .pastecraft-clips-container {
        -webkit-flex: 1 !important;
        flex: 1 !important;
        overflow-y: auto !important;
        min-height: 0 !important;
      }
    `;
    
    root.appendChild(styles);
  }
  
  setupEventListeners() {
    if (!this.container) return;
    if (this._eventListenersBound) return;
    this._eventListenersBound = true;

    this._clipsContainer = null;
    this._countElement = null;
    this._copyMultipleButton = null;
    this._dragBounds = { maxX: 0, maxY: 0 };
    this._dragRafId = 0;
    this._dragPendingEvent = null;
    
    // Close button
    this.container.querySelector('.pastecraft-close').addEventListener('click', () => {
      this.hideInterface();
    });
    
    // Refresh button (now clear all clips)
    this.container.querySelector('.pastecraft-refresh').addEventListener('click', async () => {
      console.log('🗑️ Clear all clips button clicked');
      this.showClearAllConfirmation();
    });
    
    // Settings button
    const settingsBtn = this.container.querySelector('.pastecraft-settings');
    console.log('🔍 Settings button found:', settingsBtn);
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        console.log('🔧 Settings button clicked');
        try {
          this.showSettingsModal();
          console.log('✅ Settings modal should be visible');
        } catch (error) {
          console.error('❌ Error showing settings modal:', error);
        }
      });
      console.log('✅ Settings button event listener added');
    } else {
      console.error('❌ Settings button not found!');
    }
    
    // Dragging functionality
    const header = this.container.querySelector('.pastecraft-header');
    header.style.cursor = 'move';
    
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.pastecraft-controls, .pastecraft-btn')) return;
      this.isDragging = true;
      const rect = this.container.getBoundingClientRect();
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;
      this._dragBounds.maxX = window.innerWidth - this.container.offsetWidth;
      this._dragBounds.maxY = window.innerHeight - this.container.offsetHeight;
      
      // Prevent text selection while dragging
      e.preventDefault();
      document.body.style.userSelect = 'none';
    });
    
    this._onDocumentMouseMove = (e) => {
      if (!this.isDragging) return;
      this._dragPendingEvent = e;
      if (this._dragRafId) return;
      this._dragRafId = requestAnimationFrame(() => {
        this._dragRafId = 0;
        const evt = this._dragPendingEvent;
        if (!evt || !this.isDragging) return;

        const newX = evt.clientX - this.dragOffset.x;
        const newY = evt.clientY - this.dragOffset.y;
        const clampedX = Math.max(0, Math.min(newX, this._dragBounds.maxX));
        const clampedY = Math.max(0, Math.min(newY, this._dragBounds.maxY));

        this.container.style.left = clampedX + 'px';
        this.container.style.top = clampedY + 'px';
        this.container.style.right = 'auto';
        this.container.style.bottom = 'auto';
        this.container.style.transform = 'translateY(0)';

        this.position.x = clampedX;
        this.position.y = clampedY;
      });
    };

    this._onDocumentMouseUp = () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      if (this._dragRafId) {
        cancelAnimationFrame(this._dragRafId);
        this._dragRafId = 0;
      }
      document.body.style.userSelect = '';
      this.savePosition();
    };

    document.addEventListener('mousemove', this._onDocumentMouseMove);
    document.addEventListener('mouseup', this._onDocumentMouseUp);

    // Clip click handlers
    this.container.addEventListener('click', (e) => {
      const clipElement = e.target.closest('.pastecraft-clip');
      const pasteBtn = e.target.closest('.pastecraft-paste');
      const deleteBtn = e.target.closest('.pastecraft-delete');
      const copyMultipleBtn = e.target.closest('.pastecraft-copy-multiple');
      
      if (deleteBtn) {
        // Delete individual clip
        e.stopPropagation();
        const clipId = deleteBtn.dataset.clipId;
        if (clipId) {
          this.deleteClipById(clipId);
        } else {
          const index = parseInt(deleteBtn.dataset.index);
          this.deleteClip(index);
        }
      } else if (pasteBtn) {
        // Paste individual clip
        e.stopPropagation();
        const clipId = pasteBtn.dataset.clipId;
        if (clipId) {
          this.pasteClipById(clipId);
        } else {
          const index = parseInt(pasteBtn.dataset.index);
          this.pasteClip(index);
        }
      } else if (copyMultipleBtn) {
        // Copy multiple selected clips
        e.stopPropagation();
        this.copyMultipleClips();
      } else if (clipElement) {
        // Toggle selection (NEW: multi-select functionality)
        e.stopPropagation();
        const clipId = clipElement.dataset.clipId;
        if (clipId) this.toggleClipSelection(clipId, clipElement);
      }
    });
    
    // Hide when clicking outside
    this._onDocumentClick = (e) => {
      if (!this.isVisible || this.settings.persistOpen) return;
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      const inside = path.includes(this.container) || path.includes(this.shadowMount?.host);
      if (!inside) {
        this.hideInterface();
      }
    };
    document.addEventListener('click', this._onDocumentClick);
    
    // Hide on escape key
    this._onDocumentKeydown = (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hideInterface();
      }
    };
    document.addEventListener('keydown', this._onDocumentKeydown);
  }
  
  setupMessageListener() {
    chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
      const action = message && typeof message.action === 'string' ? message.action : '';
      let handled = false;
      if (message.action === 'clipSaved') {
        handled = true;
        console.log('📨 Received clipSaved message:', message.clip);
        console.log('👁️ AutoShow flag:', message.autoShow);
        const refresh = this._applyIncomingClip(message.clip)
          ? Promise.resolve()
          : this.loadClips();
        refresh.then(() => {
          console.log('🔄 Refreshed clips after new clip saved');
          this.updateInterface();
          if (message.autoShow !== false && !this.isVisible && this.clips.length > 0) {
            this.showInterface();
          }
        });
        } else if (message.action === 'showQuickPaste') {
        handled = true;
        // Load latest clips before showing
        await this.loadClips();
        this.updateInterface();
        this.showInterface(message.x, message.y);
      } else if (message.action === 'settingsUpdated') {
        handled = true;
        // Update settings from popup
        this.settings = { ...this.settings, ...message.settings };
        this.applySettings();
        this.updateInterface();
        console.log('⚙️ Settings updated from popup:', this.settings);
      } else if (message.action === 'clipsUpdated') {
        handled = true;
        console.log('🔄 Received clipsUpdated - scheduling clip reload');
        this._scheduleClipsReload();
      } else if (message.action === 'clipsCleared') {
        handled = true;
        console.log('🗑️ Received clipsCleared message - scheduling clip reload');
        this._scheduleClipsReload();
      } else if (message.action === 'openPopupPanel') {
        handled = true;
        // Extension icon clicked - open the slide-in panel
        console.log('🎨 Received openPopupPanel message');
        if (window.pasteCraftFloatingWidget) {
          window.pasteCraftFloatingWidget.openPopupOverlay();
        } else {
          console.error('❌ Floating widget not initialized');
        }
      }
      if (handled) sendResponse(true);
      return handled;
    });
  }

  setupStorageSync() {
    // Keep settings/position in sync across all open tabs
    if (this._storageSyncListener) return;

    this._settingsReloadTimer = null;
    const scheduleSettingsReload = () => {
      if (this._settingsReloadTimer) return;
      this._settingsReloadTimer = setTimeout(() => {
        this._settingsReloadTimer = null;
        this.loadSettings().catch(() => {});
      }, 120);
    };

    this._storageSyncListener = (changes, area) => {
      if (area !== 'local') return;

      let settingsChanged = false;

      // Quick paste specific settings
      if (changes.quickPasteSettings) {
        const next = changes.quickPasteSettings.newValue;
        if (next && typeof next === 'object') {
          this.settings = { ...this.settings, ...next };
          settingsChanged = true;
        }
      }

      // Global theme (single source of truth)
      if (changes.theme) {
        const nextTheme = changes.theme.newValue;
        if (nextTheme === 'dark' || nextTheme === 'light') {
          this.settings.theme = nextTheme;
          settingsChanged = true;
        }
      }

      // General PasteCraft settings (autoDeletePeriod, albumAttachmentOpenMode)
      // These affect the quick paste interface behavior
      if (changes.autoDeletePeriod || changes.albumAttachmentOpenMode) {
        settingsChanged = true;
        scheduleSettingsReload();
      }

      if (changes.quickPastePosition) {
        const nextPos = changes.quickPastePosition.newValue;
        if (nextPos && typeof nextPos === 'object') {
          this.position = { ...this.position, ...nextPos };

          // Apply new position if UI exists
          if (this.container) {
            if (this.position.x && this.position.x !== 0) {
              this.container.style.left = this.position.x + 'px';
              this.container.style.right = 'auto';
            } else {
              this.container.style.left = '';
              this.container.style.right = '';
            }

            if (typeof this.position.y === 'number') {
              this.container.style.top = this.position.y + 'px';
              this.container.style.bottom = 'auto';
              this.container.style.transform = 'translateY(0)';
            } else {
              this.container.style.top = '';
              this.container.style.bottom = '';
              this.container.style.transform = '';
            }
          }
        }
      }

      if (settingsChanged) {
        this.applySettings();
        // Avoid heavy rerenders unless UI is open/visible
        if (this.isVisible) {
          this.updateInterface();
        }
      }
    };

    chrome.storage.onChanged.addListener(this._storageSyncListener);
  }
  
  showInterface(x, y) {
    if (!this.container) return;
    
    if (x && y) {
      // Position near cursor, but ensure it stays on screen
      const maxX = window.innerWidth - 340; // 320px width + 20px margin
      const maxY = window.innerHeight - 520; // 500px max height + 20px margin
      
      this.position.x = Math.min(x, maxX);
      this.position.y = Math.min(y, maxY);
    }
    
    // Apply saved/calculated position (don't override CSS positioning)
    // CSS handles left: 0 and vertical centering via transform
    // Only apply custom position if dragged by user
    if (this.position.x !== 0 && this.position.x !== null) {
      this.container.style.left = this.position.x + 'px';
      this.container.style.right = 'auto';
    }
    if (this.position.y !== null && typeof this.position.y === 'number') {
      this.container.style.top = this.position.y + 'px';
      this.container.style.bottom = 'auto';
      this.container.style.transform = 'translateY(0)';
    }
    
    this.container.style.display = 'block';
    this.isVisible = true;

    // Ensure clips container remains scrollable
    const clipsContainer = this.container.querySelector('.pastecraft-clips-container');
    if (clipsContainer) {
      clipsContainer.style.flex = '1';
      clipsContainer.style.overflowY = 'auto';
      clipsContainer.style.minHeight = '0';
      clipsContainer.style.paddingBottom = '8px';
    }
  }
  
  hideInterface() {
    if (!this.container) return;
    
    this.container.style.display = 'none';
    this.isVisible = false;
    
    console.log('🙈 Quick Paste interface hidden');
  }
  
  updateInterface() {
    if (!this.container) return;
    
    if (!this._clipsContainer || !this._clipsContainer.isConnected) {
      this._clipsContainer = this.container.querySelector('.pastecraft-clips-container');
    }
    if (!this._countElement || !this._countElement.isConnected) {
      this._countElement = this.container.querySelector('.pastecraft-count');
    }
    if (!this._copyMultipleButton || !this._copyMultipleButton.isConnected) {
      this._copyMultipleButton = this.container.querySelector('.pastecraft-copy-multiple');
    }
    
    const clipsContainer = this._clipsContainer;
    const countElement = this._countElement;
    if (!clipsContainer || !countElement) return;
    
    clipsContainer.innerHTML = this.renderClips();
    countElement.textContent = `${this.clips.length} clips`;
    
    // Reset selections and update button state (innerHTML rebuild drops prior selection DOM)
    this.selectedClips.clear();
    
    this.updateCopyMultipleButton();
  }
  
  async pasteClip(index) {
    const clip = this.clips[index];
    if (!clip) return;
    
    const text = clip.text || clip;
    
    try {
      // Find the active element (input field, textarea, etc.)
      const activeElement = document.activeElement;
      
      if (activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.contentEditable === 'true'
      )) {
        // Paste into the active element
        if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
          const start = activeElement.selectionStart;
          const end = activeElement.selectionEnd;
          const currentValue = activeElement.value;
          
          activeElement.value = currentValue.substring(0, start) + text + currentValue.substring(end);
          activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
          
          // Trigger input event
          activeElement.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (activeElement.contentEditable === 'true') {
          // For contentEditable elements
          document.execCommand('insertText', false, text);
        }
        
        this.showPasteSuccess();
        this.hideInterface();
      } else {
        // Copy to clipboard as fallback
        await navigator.clipboard.writeText(text);
        this.showPasteSuccess('Copied to clipboard');
      }
      
    } catch (error) {
      console.error('Paste failed:', error);
      this.showPasteError();
    }
  }
  
  showPasteSuccess(message = 'Pasted successfully') {
    this.showToast(message, 'success');
  }
  
  showPasteError() {
    this.showToast('Paste failed', 'error');
  }
  
  showToast(message, type = 'info') {
    const TOAST_DURATION_MS = 3000;

    // Single-instance toast (no stacking) + safe auto-dismiss.
    this._toastState = this._toastState || {
      el: null,
      timerId: null,
      lastMessage: null,
      lastShownAt: 0
    };

    const now = Date.now();
    const msg = String(message ?? '');
    if (!msg) return;

    // Dedupe rapid repeats of the same message
    if (this._toastState.lastMessage === msg && (now - this._toastState.lastShownAt) < 1200) {
      return;
    }
    this._toastState.lastMessage = msg;
    this._toastState.lastShownAt = now;

    let toast = this._toastState.el;
    if (!toast || !toast.isConnected) {
      toast = document.createElement('div');
      toast.className = 'pastecraft-toast';
      this._toastState.el = toast;
      document.body.appendChild(toast);
    }

    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 1000003;
      animation: pastecraft-toast-in 0.3s ease;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      white-space: nowrap;
      max-width: 90vw;
    `;
    
    toast.textContent = msg;

    if (this._toastState.timerId) {
      clearTimeout(this._toastState.timerId);
      this._toastState.timerId = null;
    }

    this._toastState.timerId = setTimeout(() => {
      toast.style.animation = 'pastecraft-toast-out 0.3s ease forwards';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, TOAST_DURATION_MS);
  }
  
  getTimeAgo(timestamp) {
    if (!timestamp) return 'Unknown';
    
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /** Lightweight markup type detector for Quick Paste badges (no heavy libs). */
  _detectQuickBadge(text) {
    if (!text || typeof text !== 'string') return '';
    const t = text.trim();
    if (!t) return '';
    const badgeStyle = 'display:inline-block;font-size:9px;font-weight:700;padding:1px 4px;border-radius:3px;margin-right:4px;vertical-align:middle;line-height:1;';
    // JSON
    if ((t[0] === '{' || t[0] === '[') && (t[t.length-1] === '}' || t[t.length-1] === ']')) {
      try { JSON.parse(t); return `<span style="${badgeStyle}background:#f59e0b;color:#fff;">JSON</span>`; } catch(_) {}
    }
    // XML
    if (/^<\?xml/i.test(t)) return `<span style="${badgeStyle}background:#f97316;color:#fff;">XML</span>`;
    // LaTeX
    if (/\\begin\{|\\frac\{|\$\$.+\$\$/s.test(t)) return `<span style="${badgeStyle}background:#008080;color:#fff;">LaTeX</span>`;
    // Markdown
    if (/^#{1,6}\s/m.test(t) || (/\*\*[^*]+\*\*/m.test(t) && /^[-*+]\s/m.test(t))) return `<span style="${badgeStyle}background:#3b82f6;color:#fff;">MD</span>`;
    // HTML tags
    if (/<(?:div|p|table|ul|ol|h[1-6])[^>]*>/i.test(t)) return `<span style="${badgeStyle}background:#e34c26;color:#fff;">HTML</span>`;
    // YAML
    if (/^---\s*\n/.test(t)) return `<span style="${badgeStyle}background:#cb171e;color:#fff;">YAML</span>`;
    // Code block
    if (/^```[\w-]*\s*\n/m.test(t)) return `<span style="${badgeStyle}background:#1e293b;color:#10b981;">Code</span>`;
    // MediaWiki
    if (/^={2,5}\s*.+?\s*={2,5}\s*$/m.test(t) && /\[\[.+?\]\]/.test(t)) return `<span style="${badgeStyle}background:#006699;color:#fff;">Wiki</span>`;
    // Textile
    if (/^h[1-6]\.\s/m.test(t) && (/\*[^*]+\*/.test(t) || /_[^_]+_/.test(t))) return `<span style="${badgeStyle}background:#c7254e;color:#fff;">Textile</span>`;
    // JIRA/Confluence
    if (/\{code(?::[^}]*)?\}/i.test(t) || (/^h[1-6]\.\s/m.test(t) && /\{[a-z]+\}/i.test(t))) return `<span style="${badgeStyle}background:#0052cc;color:#fff;">JIRA</span>`;
    // Raw unfenced code (lightweight check for Quick Paste)
    if (t.split('\n').length >= 3) {
      let cs = 0;
      if (/\b(?:const|let|var|function|=>|import\s+\{|export\s|require\(|console\.log)\b/.test(t)) cs += 3;
      if (/\b(?:def\s+\w+\(|class\s+\w+[:(]|from\s+\w+\s+import|print\(|self\.)\b/.test(t)) cs += 3;
      if (/\b(?:public\s+(?:static|class|void)|#include\s*[<"]|int\s+main\s*\(|func\s+\w+\(|fn\s+\w+)\b/.test(t)) cs += 3;
      if (/\b(?:return\s|if\s*\(|for\s*\(|while\s*\()\b/.test(t)) cs += 2;
      if (/[{};]\s*$/m.test(t)) cs++;
      if (cs >= 5) return `<span style="${badgeStyle}background:#1e293b;color:#10b981;">Code</span>`;
    }
    return '';
  }

  /** Light inline formatting for Quick Paste previews (bold, code, headers via regex). */
  _lightFormatPreview(text) {
    if (!text || typeof text !== 'string') return '';
    let html = this.escapeHtml(text);
    // Bold **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    // Inline code `text`
    html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.06);padding:0 3px;border-radius:3px;font-size:0.9em;">$1</code>');
    // Markdown heading (# at start)
    html = html.replace(/^(#{1,3})\s+(.+)/m, (_, hashes, title) => `<b>${title}</b>`);
    return html;
  }
  
  // Settings Management
  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['quickPasteSettings', 'quickPastePosition', 'theme']);
      this._applyLoadedSettings(result);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }
  
  async savePosition() {
    try {
      await chrome.storage.local.set({ quickPastePosition: this.position });
      console.log('📍 Position saved:', this.position);
    } catch (error) {
      console.error('Failed to save position:', error);
    }
  }
  
  async saveSettings() {
    try {
      // Do not persist theme here (theme is global and controlled by the popup/profile).
      const { theme, ...rest } = this.settings || {};
      await chrome.storage.local.set({ quickPasteSettings: rest });
      console.log('💾 Settings saved:', rest);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }
  
  showSettingsModal() {
    console.log('🔧 showSettingsModal called');
    if (this.settingsModal) {
      console.log('🗑️ Removing existing settings modal');
      this.settingsModal.remove();
    }
    
    console.log('📝 Creating new settings modal');
    this.settingsModal = document.createElement('div');
    this.settingsModal.className = 'pastecraft-settings-modal';
    this.settingsModal.innerHTML = `
      <div class="pastecraft-modal-backdrop"></div>
      <div class="pastecraft-modal-content">
        <div class="pastecraft-modal-header">
          <h3>⚙️ Quick Paste Settings</h3>
          <div class="pastecraft-modal-actions">
            <button class="pastecraft-help-btn" title="Help & Information">❓</button>
            <button class="pastecraft-modal-close">×</button>
          </div>
        </div>
        <div class="pastecraft-modal-body">
          <div class="pastecraft-setting">
            <label>
              <input type="checkbox" id="quickPasteAutoHide" ${this.settings.autoHide ? 'checked' : ''}>
              Auto-hide after paste
            </label>
          </div>
          <div class="pastecraft-setting">
            <label>
              <input type="checkbox" id="quickPasteShowTimestamps" ${this.settings.showTimestamps ? 'checked' : ''}>
              Show timestamps
            </label>
          </div>
          <div class="pastecraft-setting">
            <label>Max clips to display</label>
            <input type="number" id="quickPasteMaxClips" value="${this.settings.maxClipsDisplay}" min="5" max="50">
          </div>
          
          <!-- Delimiter Settings -->
          <div class="pastecraft-setting-group">
            <label class="pastecraft-setting-label">Delimiter</label>
            <div class="pastecraft-segmented-control" id="quickPasteDelimiterControl">
              <button class="pastecraft-segment-btn ${this.settings.delimiter === 'comma' ? 'active' : ''}" data-delimiter="comma">Comma</button>
              <button class="pastecraft-segment-btn ${this.settings.delimiter === 'newline' ? 'active' : ''}" data-delimiter="newline">Newline</button>
              <button class="pastecraft-segment-btn ${this.settings.delimiter === 'space' ? 'active' : ''}" data-delimiter="space">Space</button>
              <button class="pastecraft-segment-btn ${this.settings.delimiter === 'custom' ? 'active' : ''}" data-delimiter="custom">Custom</button>
            </div>
            <input type="text" id="quickPasteCustomDelimiter" value="${this.settings.customDelimiter}" 
                   style="display: ${this.settings.delimiter === 'custom' ? 'block' : 'none'}; margin-top: 8px; padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px;" 
                   placeholder="Enter custom delimiter">
          </div>
          
          <!-- Options Settings -->
          <div class="pastecraft-setting-group">
            <label class="pastecraft-setting-label">Options</label>
            <div class="pastecraft-toggles">
              <label class="pastecraft-toggle">
                <input type="checkbox" id="quickPasteDeduplicate" ${this.settings.options.deduplicate ? 'checked' : ''}>
                <div class="pastecraft-toggle-switch"></div>
                <span>🔄 Deduplicate</span>
              </label>
              <label class="pastecraft-toggle">
                <input type="checkbox" id="quickPasteSort" ${this.settings.options.sort ? 'checked' : ''}>
                <div class="pastecraft-toggle-switch"></div>
                <span>⬆️ Sort A→Z</span>
              </label>
              <label class="pastecraft-toggle">
                <input type="checkbox" id="quickPasteUppercase" ${this.settings.options.uppercase ? 'checked' : ''}>
                <div class="pastecraft-toggle-switch"></div>
                <span>Aa UPPERCASE</span>
              </label>
            </div>
          </div>
        </div>
        <div class="pastecraft-modal-actions">
          <button class="pastecraft-btn-secondary" id="cancelQuickSettings">Cancel</button>
          <button class="pastecraft-btn-primary" id="saveQuickSettings">Save</button>
        </div>
      </div>
    `;
    
    // Create help page modal
    this.helpModal = document.createElement('div');
    this.helpModal.className = 'pastecraft-help-modal';
    this.helpModal.innerHTML = `
      <div class="pastecraft-modal-backdrop"></div>
      <div class="pastecraft-modal-content">
        <div class="pastecraft-modal-header">
          <h3>❓ Quick Paste Help & Information</h3>
          <div class="pastecraft-modal-actions">
            <button class="pastecraft-back-btn" title="Back to Settings">←</button>
            <button class="pastecraft-modal-close">×</button>
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
          <button class="pastecraft-btn-primary" id="backToSettings">← Back to Settings</button>
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
    this.helpModal.querySelector('.pastecraft-modal-close').addEventListener('click', () => {
      this.hideHelpModal();
    });
    
    // Back button
    this.helpModal.querySelector('.pastecraft-back-btn').addEventListener('click', () => {
      this.hideHelpModal();
    });
    
    // Back to settings button
    this.helpModal.querySelector('#backToSettings').addEventListener('click', () => {
      this.hideHelpModal();
    });
    
    // Backdrop click
    this.helpModal.querySelector('.pastecraft-modal-backdrop').addEventListener('click', () => {
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
    const modalContent = this.settingsModal.querySelector('.pastecraft-modal-content');
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
    const modalBody = this.settingsModal.querySelector('.pastecraft-modal-body');
    if (modalBody) {
      modalBody.style.cssText = `
        padding: 0 !important;
        max-height: 60vh !important;
        overflow-y: auto !important;
      `;
    }
    
    // Settings
    const settings = this.settingsModal.querySelectorAll('.pastecraft-setting');
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
    const settingGroups = this.settingsModal.querySelectorAll('.pastecraft-setting-group');
    settingGroups.forEach(group => {
      group.style.cssText = `
        margin: 0 !important;
        padding: 24px !important;
        border-bottom: 1px solid #f3f4f6 !important;
        background: white !important;
      `;
      
      const label = group.querySelector('.pastecraft-setting-label');
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
      const segmentedControl = group.querySelector('.pastecraft-segmented-control');
      if (segmentedControl) {
        segmentedControl.style.cssText = `
          display: flex !important;
          background: #f3f4f6 !important;
          border-radius: 10px !important;
          padding: 4px !important;
          gap: 2px !important;
        `;
        
        const buttons = segmentedControl.querySelectorAll('.pastecraft-segment-btn');
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
          
          if (btn.classList.contains('active')) {
            btn.style.cssText += `
              background: white !important;
              color: #1f2937 !important;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
            `;
          }
        });
      }
      
      // Toggles
      const toggles = group.querySelectorAll('.pastecraft-toggle');
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
        
        const toggleSwitch = toggle.querySelector('.pastecraft-toggle-switch');
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
    const modalActions = this.settingsModal.querySelector('.pastecraft-modal-actions');
    if (modalActions) {
      modalActions.style.cssText = `
        display: flex !important;
        gap: 12px !important;
        padding: 24px !important;
        background: #f8fafc !important;
        border-top: 1px solid #f1f5f9 !important;
        justify-content: flex-end !important;
      `;
      
      const secondaryBtn = modalActions.querySelector('.pastecraft-btn-secondary');
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
      
      const primaryBtn = modalActions.querySelector('.pastecraft-btn-primary');
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
    const customDelimiter = this.settingsModal.querySelector('#quickPasteCustomDelimiter');
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
    this.settingsModal.querySelector('.pastecraft-modal-close').addEventListener('click', () => {
      this.hideSettingsModal();
    });
    
    // Help button
    this.settingsModal.querySelector('.pastecraft-help-btn').addEventListener('click', () => {
      this.showHelpModal();
    });
    
    // Backdrop click
    this.settingsModal.querySelector('.pastecraft-modal-backdrop').addEventListener('click', () => {
      this.hideSettingsModal();
    });
    
    // Cancel button
    this.settingsModal.querySelector('#cancelQuickSettings').addEventListener('click', () => {
      this.hideSettingsModal();
    });
    
    // Save button
    this.settingsModal.querySelector('#saveQuickSettings').addEventListener('click', () => {
      this.saveSettingsFromModal();
    });
    
    // Delimiter control
    this.settingsModal.querySelector('#quickPasteDelimiterControl').addEventListener('click', (e) => {
      if (e.target.classList.contains('pastecraft-segment-btn')) {
        // Remove active class from all buttons
        this.settingsModal.querySelectorAll('.pastecraft-segment-btn').forEach(btn => btn.classList.remove('active'));
        // Add active class to clicked button
        e.target.classList.add('active');
        
        // Show/hide custom delimiter input
        const customInput = this.settingsModal.querySelector('#quickPasteCustomDelimiter');
        if (e.target.dataset.delimiter === 'custom') {
          customInput.style.display = 'block';
          customInput.focus();
        } else {
          customInput.style.display = 'none';
        }
      }
    });
    
    // Options toggles
    this.settingsModal.querySelectorAll('.pastecraft-toggle').forEach(toggle => {
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
    
    this.settings.autoHide = this.settingsModal.querySelector('#quickPasteAutoHide').checked;
    this.settings.showTimestamps = this.settingsModal.querySelector('#quickPasteShowTimestamps').checked;
    this.settings.maxClipsDisplay = parseInt(this.settingsModal.querySelector('#quickPasteMaxClips').value);
    
    // Save delimiter settings
    const activeDelimiterBtn = this.settingsModal.querySelector('.pastecraft-segment-btn.active');
    if (activeDelimiterBtn) {
      this.settings.delimiter = activeDelimiterBtn.dataset.delimiter;
    }
    this.settings.customDelimiter = this.settingsModal.querySelector('#quickPasteCustomDelimiter').value;
    
    // Save options settings
    this.settings.options.deduplicate = this.settingsModal.querySelector('#quickPasteDeduplicate').checked;
    this.settings.options.sort = this.settingsModal.querySelector('#quickPasteSort').checked;
    this.settings.options.uppercase = this.settingsModal.querySelector('#quickPasteUppercase').checked;
    
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
    
    // Apply theme
    this.container.className = `pastecraft-interface ${this.settings.theme}`;
    
    // Ensure container is positioned properly for dragging
    this.container.style.position = 'fixed';
    this.container.style.zIndex = '1000000';
  }
  
  showClearAllConfirmation() {
    // Create confirmation modal
    const confirmModal = document.createElement('div');
    confirmModal.className = 'pastecraft-confirm-modal';
    confirmModal.innerHTML = `
      <div class="pastecraft-modal-backdrop"></div>
      <div class="pastecraft-modal-content">
        <div class="pastecraft-modal-header">
          <h3>🗑️ Clear All Clips</h3>
        </div>
        <div class="pastecraft-modal-body">
          <p>Are you sure you want to delete all ${this.clips.length} clips?</p>
          <p><strong>This action cannot be undone.</strong></p>
        </div>
        <div class="pastecraft-modal-actions">
          <button class="pastecraft-btn-secondary" id="cancelClearAll">Cancel</button>
          <button class="pastecraft-btn-danger" id="confirmClearAll">Delete All Clips</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(confirmModal);
    
    // Setup event listeners
    confirmModal.querySelector('#cancelClearAll').addEventListener('click', () => {
      confirmModal.remove();
    });
    
    confirmModal.querySelector('#confirmClearAll').addEventListener('click', async () => {
      await this.clearAllClips();
      confirmModal.remove();
    });
    
    // Close on backdrop click
    confirmModal.querySelector('.pastecraft-modal-backdrop').addEventListener('click', () => {
      confirmModal.remove();
    });
  }
  
  async clearAllClips() {
    try {
      console.log('🗑️ Clearing all clips...');
      
      // Clear from storage
      await chrome.storage.local.set({ 
        clips: [],
        searchOnlyClips: [], // Also clear archived clips
        pc_local_updatedAt: Date.now()
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
      clipElement.classList.remove('selected');
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
      clipElement.classList.add('selected');
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
    
    this.updateCopyMultipleButton();
  }
  
  updateCopyMultipleButton() {
    if (!this._copyMultipleButton || !this._copyMultipleButton.isConnected) {
      this._copyMultipleButton = this.container?.querySelector('.pastecraft-copy-multiple') || null;
    }
    const button = this._copyMultipleButton;
    if (!button) return;
    
    const selectedCount = this.selectedClips.size;
    console.log(`🔘 Updating Copy Multiple Button - Selected: ${selectedCount}`);
    
    if (selectedCount >= 2) {
      button.disabled = false;
      button.textContent = `Copy ${selectedCount} Clips`;
      button.style.background = '#8b5cf6';
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
    const domClips = this.container ? this.container.querySelectorAll('.pastecraft-clip') : [];
    if (domClips && domClips.length > 0) {
      domClips.forEach(el => {
        const id = el?.dataset?.clipId;
        if (id && selected.has(id)) orderedIds.push(id);
      });
    }
    if (orderedIds.length === 0) {
      this.clips.forEach(c => {
        const id = this._clipIdKey(c?.id);
        if (selected.has(id)) orderedIds.push(id);
      });
    }

    let selectedClipsData = orderedIds
      .map(id => this.clips.find(c => this._clipIdKey(c?.id) === id))
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
    let delimiter = '\n\n'; // Default
    switch (this.settings.delimiter) {
      case 'comma':
        delimiter = ', ';
        break;
      case 'newline':
        delimiter = '\n';
        break;
      case 'space':
        delimiter = ' ';
        break;
      case 'custom':
        delimiter = this.settings.customDelimiter || ', ';
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
      const selectedElements = this.container.querySelectorAll('.pastecraft-clip.selected');
      selectedElements.forEach(el => el.classList.remove('selected'));
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
    await this.deleteClipById(this._clipIdKey(clip?.id));
  }

  async deleteClipById(clipIdKey) {
    const id = String(clipIdKey || '');
    if (!id) return;

    return this._queueClipOp(async () => {
      const before = this.clips.length;
      const clip = this.clips.find(c => this._clipIdKey(c?.id) === id);

      // Compute next state
      this.clips = this.clips.filter(c => this._clipIdKey(c?.id) !== id);
      const deleted = before - this.clips.length;

      // Idempotent no-op
      if (deleted === 0) {
        this.selectedClips.delete(id);
        this.updateCopyMultipleButton();
        return;
      }

      // Persist once
      await chrome.storage.local.set({ clips: this.clips, pc_local_updatedAt: Date.now() });

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

  async pasteClipById(clipIdKey) {
    const id = String(clipIdKey || '');
    if (!id) return;
    const clip = this.clips.find(c => this._clipIdKey(c?.id) === id);
    if (!clip) return;
    const index = this.clips.indexOf(clip);
    if (index >= 0) return this.pasteClip(index);
  }
}

// PasteCraft Floating Widget (Monica.ai Style)
