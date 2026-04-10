// PasteCraft Quick Paste Content Script

const PASTECRAFT_LOGS_ENABLED = (() => {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.PASTECRAFT_DEBUG === true) {
      return true;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('pastecraft_debug') === 'true';
    }
  } catch (_) {
    // Ignore storage access errors.
  }
  return false;
})();

if (!PASTECRAFT_LOGS_ENABLED && typeof console !== 'undefined') {
  const pastecraftNoop = () => {};
  console.log = pastecraftNoop;
  console.debug = pastecraftNoop;
  console.info = pastecraftNoop;
}

async function safeRuntimeSendMessage(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (_) {
    return null;
  }
}

// Resource URL helper:
// - When loaded via repo root `manifest.json` ("Repo Loader"), assets live under `extension/*`.
// - When loaded via `/extension/manifest.json`, assets live at the extension root.
const __PASTECRAFT_MANIFEST =
  typeof chrome !== 'undefined' &&
  chrome.runtime &&
  typeof chrome.runtime.getManifest === 'function'
    ? chrome.runtime.getManifest()
    : null;
const __PASTECRAFT_IS_REPO_LOADER =
  !!__PASTECRAFT_MANIFEST &&
  (String(__PASTECRAFT_MANIFEST.name || '').includes('Repo Loader') ||
    String(__PASTECRAFT_MANIFEST.description || '').includes('repo root') ||
    String(__PASTECRAFT_MANIFEST.description || '').includes('Actual extension lives in /extension'));

function pastecraftGetURL(path) {
  const normalized = String(path || '').replace(/^\/+/, '');
  const finalPath = __PASTECRAFT_IS_REPO_LOADER ? `extension/${normalized}` : normalized;
  return chrome.runtime.getURL(finalPath);
}
class QuickPasteInterface {
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
    try {
      console.log('🚀 DIAGNOSTIC [Quick Paste]: loadClips() called at', new Date().toISOString());
      const result = await chrome.storage.local.get(['clips']);
      console.log('🔍 DIAGNOSTIC [Quick Paste]: RAW storage result:', result);
      console.log('🔍 DIAGNOSTIC [Quick Paste]: Clips array exists?', !!result.clips);
      console.log('🔍 DIAGNOSTIC [Quick Paste]: Clips length:', result.clips?.length || 0);
      
      const raw = Array.isArray(result.clips) ? result.clips : [];
      let changed = false;

      // Normalize clip shape + ensure stable ids (avoid index-based bugs in selection/deletion)
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
      console.log('✅ DIAGNOSTIC [Quick Paste]: Loaded clips count:', this.clips.length);

      // Persist repaired ids so other UIs (popup/sync) stay consistent.
      if (changed) {
        try {
          await chrome.storage.local.set({ clips: this.clips, pc_local_updatedAt: Date.now() });
        } catch (_) {}
      }
      
      if (this.clips.length > 0) {
        console.log('📋 First 3 clips:', this.clips.slice(0, 3).map(clip => ({
          text: (clip.text || clip).substring(0, 30) + '...',
          category: clip.category || 'Uncategorized',
          timestamp: clip.timestamp,
          fullClip: clip
        })));
      } else {
        console.log('⚠️ DIAGNOSTIC [Quick Paste]: NO CLIPS FOUND IN STORAGE!');
      }
    } catch (error) {
      console.error('❌ DIAGNOSTIC [Quick Paste]: Failed to load clips:', error);
      this.clips = [];
    }
  }
  
  createInterface() {
    // Remove existing interface if any
    if (this.container) {
      this.container.remove();
    }
    
    this.container = document.createElement('div');
    this.container.id = 'pastecraft-quick-paste';
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
    
    // Add styles
    this.addStyles();
    
    // Initially hidden
    this.container.style.display = 'none';
    document.body.appendChild(this.container);
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
              <span class="pastecraft-category">${category}</span>
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
  
  addStyles() {
    const styleId = 'pastecraft-quick-paste-styles';
    // Remove old styles if they exist to allow updates
    const existingStyles = document.getElementById(styleId);
    if (existingStyles) {
      existingStyles.remove();
    }
    
    const styles = document.createElement('style');
    styles.id = styleId;
    styles.textContent = `
      #pastecraft-quick-paste {
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
        color: #9ca3af !important;
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
        color: #9ca3af;
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
        background: #d1d5db !important;
        color: #9ca3af !important;
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
      #pastecraft-quick-paste .pastecraft-footer {
        position: -webkit-sticky !important;
        position: sticky !important;
        bottom: 0px !important;
        z-index: 9999 !important;
        margin-top: auto !important;
      }
      
      #pastecraft-quick-paste .pastecraft-content {
        display: -webkit-flex !important;
        display: flex !important;
        -webkit-flex-direction: column !important;
        flex-direction: column !important;
        height: 100% !important;
        min-height: 300px !important;
      }
      
      #pastecraft-quick-paste .pastecraft-clips-container {
        -webkit-flex: 1 !important;
        flex: 1 !important;
        overflow-y: auto !important;
        min-height: 0 !important;
      }
    `;
    
    document.head.appendChild(styles);
  }
  
  setupEventListeners() {
    if (!this.container) return;
    
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
      this.isDragging = true;
      const rect = this.container.getBoundingClientRect();
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;
      
      // Prevent text selection while dragging
      e.preventDefault();
      document.body.style.userSelect = 'none';
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      
      const newX = e.clientX - this.dragOffset.x;
      const newY = e.clientY - this.dragOffset.y;
      
      // Keep interface within screen bounds
      const maxX = window.innerWidth - this.container.offsetWidth;
      const maxY = window.innerHeight - this.container.offsetHeight;
      
      const clampedX = Math.max(0, Math.min(newX, maxX));
      const clampedY = Math.max(0, Math.min(newY, maxY));
      
      this.container.style.left = clampedX + 'px';
      this.container.style.top = clampedY + 'px';
      this.container.style.right = 'auto';
      this.container.style.bottom = 'auto';
      this.container.style.transform = 'translateY(0)';
      
      // Save position
      this.position.x = clampedX;
      this.position.y = clampedY;
    });
    
    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        document.body.style.userSelect = '';
        
        // Save position to storage
        this.savePosition();
      }
    });

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
    document.addEventListener('click', (e) => {
      // Only hide on outside click if persistOpen is disabled
      if (this.isVisible && !this.container.contains(e.target) && !this.settings.persistOpen) {
        this.hideInterface();
      }
    });
    
    // Hide on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hideInterface();
      }
    });
  }
  
  setupMessageListener() {
    chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
      const action = message && typeof message.action === 'string' ? message.action : '';
      let handled = false;
      if (message.action === 'clipSaved') {
        handled = true;
        console.log('📨 Received clipSaved message:', message.clip);
        console.log('👁️ AutoShow flag:', message.autoShow);
        this.loadClips().then(() => {
          console.log('🔄 Auto-refreshed clips after new clip saved');
          this.updateInterface();
          // Only auto-show if autoShow flag is true (default behavior)
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
        // Another tab updated clips (delete/move/etc) - refresh our interface
        console.log('🔄 Received clipsUpdated - refreshing clips');
        await this.loadClips();
        if (this.isVisible) {
          this.updateInterface();
        }
      } else if (message.action === 'clipsCleared') {
        handled = true;
        // Another tab cleared all clips - refresh our interface
        console.log('🗑️ Received clipsCleared message - refreshing interface');
        await this.loadClips();
        this.updateInterface();
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
        // Reload settings to get latest values
        this.loadSettings().catch(() => {});
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
    
    const clipsContainer = this.container.querySelector('.pastecraft-clips-container');
    const countElement = this.container.querySelector('.pastecraft-count');
    
    clipsContainer.innerHTML = this.renderClips();
    countElement.textContent = `${this.clips.length} clips`;
    
    // Reset selections and update button state
    this.selectedClips.clear();
    
    // Clear any inline selection styles
    const selectedElements = this.container.querySelectorAll('.pastecraft-clip.selected');
    selectedElements.forEach(el => {
      el.classList.remove('selected');
      el.style.background = '';
      el.style.color = '';
      el.style.border = '';
      el.style.transform = '';
      el.style.boxShadow = '';
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.style.zIndex = '';
      el.style.position = '';
    });
    
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
      if (result.quickPasteSettings) {
        this.settings = { ...this.settings, ...result.quickPasteSettings };
      }
      // Single source of truth: global theme (Quick Paste follows this)
      if (result.theme === 'dark' || result.theme === 'light') {
        this.settings.theme = result.theme;
      } else if (this.settings.theme !== 'dark') {
        this.settings.theme = 'light';
      }
      if (result.quickPastePosition) {
        this.position = { ...this.position, ...result.quickPastePosition };
      }
      console.log('⚙️ Loaded settings:', this.settings);
      console.log('📍 Loaded position:', this.position);
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
    
    // Force a style recalculation
    clipElement.offsetHeight;
    
    this.updateCopyMultipleButton();
  }
  
  updateCopyMultipleButton() {
    const button = this.container.querySelector('.pastecraft-copy-multiple');
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
class PasteCraftFloatingWidget {
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
        <div class="widget-component quick-view-button" data-tooltip="Quick View Menu">
          <span class="widget-icon">👁️</span>
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
      .quick-view-button .widget-icon {
        font-size: 24px;
      }
      
      /* Tooltips - appear on LEFT side since widget is to left of popup */
      .widget-component[data-tooltip]::before {
        content: attr(data-tooltip);
        position: absolute;
        right: calc(100% + 12px);
        top: 50%;
        transform: translateY(-50%) translateX(10px);
        background: rgba(30, 64, 175, 0.95);
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        z-index: 1;
      }
      
      .widget-component[data-tooltip]::after {
        content: '';
        position: absolute;
        right: calc(100% + 6px);
        top: 50%;
        transform: translateY(-50%);
        border: 6px solid transparent;
        border-left-color: rgba(30, 64, 175, 0.95);
        opacity: 0;
        pointer-events: none;
        transition: all 0.3s ease;
      }
      
      .widget-component:hover[data-tooltip]::before,
      .widget-component:hover[data-tooltip]::after {
        opacity: 1;
        transform: translateY(-50%) translateX(0);
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
      quickViewButton.addEventListener('click', () => {
        console.log('👁️ Quick View button clicked!');
        if (this.openStates.quickView) {
          this.closeQuickView();
        } else {
          this.openQuickView();
        }
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
    
    // Listen for close messages from iframe
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'PASTECRAFT_CLOSE_POPUP') {
        this.closePopupOverlay();
      }
    });
    
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
          .quickview-btn.placeholder {
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          .quickview-btn.placeholder .placeholder-box {
            width: 14px;
            height: 14px;
            border-radius: 3px;
            background: rgba(255, 255, 255, 0.55);
            box-shadow:
              inset 0 0 0 1px rgba(30, 64, 175, 0.25),
              0 1px 2px rgba(0, 0, 0, 0.12);
            display: inline-block;
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
            <span>👁️</span>
            <span>Quick View</span>
            <span class="clip-count" id="clip-count">0 clips</span>
          </div>
          <div class="quickview-controls">
            <button class="quickview-btn placeholder" onclick="openMiniWindow()" title="Open mini Quick View (window)"><span class="placeholder-box" aria-hidden="true"></span></button>
            <button class="quickview-btn placeholder" onclick="dockMiniBottomRight()" title="Open mini Quick View (bottom-right)"><span class="placeholder-box" aria-hidden="true"></span></button>
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
      closeBtn.addEventListener('click', () => el.remove());

      controls.appendChild(closeBtn);
      header.appendChild(title);
      header.appendChild(controls);

      const body = document.createElement('div');
      body.className = 'pastecraft-mini-quickview-body';
      el.appendChild(header);
      el.appendChild(body);
      document.body.appendChild(el);

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
        // Convert docked (bottom/right) into absolute left/top for smooth drag.
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
  
  loadSavedPosition() {
    chrome.storage.local.get(['widgetPosition'], (result) => {
      if (result.widgetPosition && this.widget) {
        this.position = result.widgetPosition;
        this.widget.style.top = this.position.top + '%';
        console.log('📍 Widget position loaded:', this.position.top + '%');
      }
      // Show widget now that position is resolved (prevents flash at default spot)
      if (this.widget) {
        this.widget.style.visibility = 'visible';
      }
    });
  }
  
  savePosition() {
    chrome.storage.local.set({ widgetPosition: this.position });
  }
}

// Initialize Quick Paste when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.pasteCraftQuickPaste = new QuickPasteInterface();
    window.pasteCraftFloatingWidget = new PasteCraftFloatingWidget();
  });
} else {
  window.pasteCraftQuickPaste = new QuickPasteInterface();
  window.pasteCraftFloatingWidget = new PasteCraftFloatingWidget();
}

// Add toast animation styles
const toastStyles = document.createElement('style');
toastStyles.textContent = `
  @keyframes pastecraft-toast-in {
    from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
    to { transform: translateX(-50%) translateY(0); opacity: 1; }
  }
  
  @keyframes pastecraft-toast-out {
    from { transform: translateX(-50%) translateY(0); opacity: 1; }
    to { transform: translateX(-50%) translateY(-100%); opacity: 0; }
  }
`;
document.head.appendChild(toastStyles);
