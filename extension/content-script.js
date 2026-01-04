// PasteCraft Quick Paste Content Script
class QuickPasteInterface {
  constructor() {
    this.isVisible = false;
    this.clips = [];
    this.container = null;
    this.settingsModal = null;
    this.position = { x: 0, y: null }; // Default position - left side, CSS handles vertical centering
    this.settings = {
      theme: 'light',
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
    this.selectedClips = new Set(); // Track selected clips for multi-select
    
    this.init();
  }
  
  async init() {
    await this.loadClips();
    await this.loadSettings();
    this.createInterface();
    this.setupEventListeners();
    this.setupMessageListener();
    
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
      
      this.clips = result.clips || [];
      console.log('✅ DIAGNOSTIC [Quick Paste]: Loaded clips count:', this.clips.length);
      
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
      
      return `
        <div class="pastecraft-clip" data-index="${index}" title="${text}">
          <div class="pastecraft-clip-content">
            <div class="pastecraft-clip-text">${this.escapeHtml(displayText)}</div>
            <div class="pastecraft-clip-meta">
              <span class="pastecraft-category">${category}</span>
              ${timeAgo ? `<span class="pastecraft-time">${timeAgo}</span>` : ''}
            </div>
          </div>
          <div class="pastecraft-clip-actions">
            <button class="pastecraft-btn pastecraft-paste" data-index="${index}" title="Paste">📋</button>
            <button class="pastecraft-btn pastecraft-delete" data-index="${index}" title="Delete">×</button>
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
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
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
        const index = parseInt(deleteBtn.dataset.index);
        this.deleteClip(index);
      } else if (pasteBtn) {
        // Paste individual clip
        e.stopPropagation();
        const index = parseInt(pasteBtn.dataset.index);
        this.pasteClip(index);
      } else if (copyMultipleBtn) {
        // Copy multiple selected clips
        e.stopPropagation();
        this.copyMultipleClips();
      } else if (clipElement) {
        // Toggle selection (NEW: multi-select functionality)
        e.stopPropagation();
        const index = parseInt(clipElement.dataset.index);
        this.toggleClipSelection(index, clipElement);
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
      if (message.action === 'clipSaved') {
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
        // Load latest clips before showing
        await this.loadClips();
        this.updateInterface();
        this.showInterface(message.x, message.y);
      } else if (message.action === 'settingsUpdated') {
        // Update settings from popup
        this.settings = { ...this.settings, ...message.settings };
        this.applySettings();
        this.updateInterface();
        console.log('⚙️ Settings updated from popup:', this.settings);
      } else if (message.action === 'clipsCleared') {
        // Another tab cleared all clips - refresh our interface
        console.log('🗑️ Received clipsCleared message - refreshing interface');
        await this.loadClips();
        this.updateInterface();
      } else if (message.action === 'openPopupPanel') {
        // Extension icon clicked - open the slide-in panel
        console.log('🎨 Received openPopupPanel message');
        if (window.pasteCraftFloatingWidget) {
          window.pasteCraftFloatingWidget.openPopupOverlay();
        } else {
          console.error('❌ Floating widget not initialized');
        }
      }
      
      sendResponse(true);
    });
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
    const toast = document.createElement('div');
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
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'pastecraft-toast-out 0.3s ease forwards';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 2000);
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
  
  // Settings Management
  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['quickPasteSettings', 'quickPastePosition']);
      if (result.quickPasteSettings) {
        this.settings = { ...this.settings, ...result.quickPasteSettings };
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
      await chrome.storage.local.set({ quickPasteSettings: this.settings });
      console.log('💾 Settings saved:', this.settings);
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
              <label>Theme</label>
            <select id="quickPasteTheme">
              <option value="light" ${this.settings.theme === 'light' ? 'selected' : ''}>Light</option>
              <option value="dark" ${this.settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
            </select>
          </div>
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
            <h4>🎨 Theme Settings</h4>
            <div class="help-item">
              <strong>Light Theme:</strong> Clean, bright interface perfect for well-lit environments
            </div>
            <div class="help-item">
              <strong>Dark Theme:</strong> Easy on the eyes, ideal for low-light conditions and extended use
            </div>
          </div>
          
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
    
    this.settings.theme = this.settingsModal.querySelector('#quickPasteTheme').value;
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
        searchOnlyClips: [] // Also clear archived clips
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
      isSelected: this.selectedClips.has(index)
    });
    
    if (this.selectedClips.has(index)) {
      // Deselect - remove inline styles
      this.selectedClips.delete(index);
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
      this.selectedClips.add(index);
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
    
    // Get selected clips text
    let selectedClipsData = Array.from(this.selectedClips)
      .sort((a, b) => a - b) // Sort by index
      .map(index => this.clips[index])
      .filter(clip => clip) // Remove any undefined clips
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
    const clip = this.clips[index];
    if (!clip) return;
    
    try {
      // Remove from clips array
      this.clips.splice(index, 1);
      
      // Save to storage
      await chrome.storage.local.set({ clips: this.clips });
      
      // Update interface
      this.updateInterface();
      
      // Show success toast
      this.showToast(`🗑️ Deleted clip: "${clip.text.substring(0, 30)}..."`, 'success');
      
      console.log(`✅ Deleted clip at index ${index}`);
      
      // Notify other tabs about the change
      chrome.runtime.sendMessage({ action: 'clipsUpdated' });
    } catch (error) {
      console.error('❌ Failed to delete clip:', error);
      this.showToast('❌ Failed to delete clip', 'error');
    }
  }
}

// PasteCraft Floating Widget (Monica.ai Style)
class PasteCraftFloatingWidget {
  constructor() {
    console.log('🎨 PasteCraftFloatingWidget constructor called');
    this.widget = null;
    this.isExpanded = false;
    this.position = { top: 50 }; // Percentage from top (50 = center)
    this.settings = {
      keepPopupOpen: true,  // Default: popup stays open when clicking outside
      keepQuickViewOpen: true  // Default: quick view stays open
    };
    
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
    
    // Then load settings asynchronously
    this.initAsync();
  }
  
  async initAsync() {
    await this.loadSettings();
    await this.loadAutoCopyState();
    this.setupAutoCopyListener();
    console.log('🎨 PasteCraft Floating Widget initialized with settings:', this.settings);
  }
  
  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['widgetSettings']);
      if (result.widgetSettings) {
        this.settings = { ...this.settings, ...result.widgetSettings };
      }
      console.log('📝 Widget settings loaded:', this.settings);
    } catch (error) {
      console.error('Error loading widget settings:', error);
    }
  }
  
  async saveSettings() {
    try {
      await chrome.storage.local.set({ widgetSettings: this.settings });
      console.log('💾 Widget settings saved:', this.settings);
    } catch (error) {
      console.error('Error saving widget settings:', error);
    }
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
          <img src="${chrome.runtime.getURL('logo.svg')}" alt="PasteCraft" class="widget-logo">
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
        background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 50%, #1d4ed8 100%);
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
  
  openPopupOverlay() {
    console.log('🎨 Opening popup overlay (slide-in from right)');
    
    // Check if overlay already exists
    if (document.getElementById('pastecraft-popup-overlay')) {
      console.log('⚠️ Overlay already exists');
      return;
    }
    
    // Set open state
    this.openStates.popup = true;
    
    // Slide widget to the left (attached to panel)
    this.widget.classList.add('panel-open');
    
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
    iframe.src = chrome.runtime.getURL('popup.html');
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
    
    // Animate in
    setTimeout(() => {
      backdrop.classList.add('visible');
      panel.classList.add('visible');
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
    document.addEventListener('copy', async (e) => {
      if (!this.autoCopyEnabled) return;
      
      // Get the selected text
      const selectedText = window.getSelection().toString().trim();
      if (!selectedText || selectedText.length === 0) return;
      
      console.log('📋 Auto-copy detected:', selectedText.substring(0, 50) + '...');
      
      try {
        // Save to PasteCraft via background script
        await chrome.runtime.sendMessage({
          action: 'saveClip',
          text: selectedText,
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
    });
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
      
      // Update UI
      const toggle = this.widget.querySelector('.auto-copy-toggle');
      const label = toggle?.querySelector('.toggle-label');
      if (toggle && label) {
        toggle.setAttribute('data-state', this.autoCopyEnabled ? 'on' : 'off');
        label.textContent = this.autoCopyEnabled ? 'ON' : 'OFF';
      }
      
      this.updateAutoCopyCounter();
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
          
          function deleteClip(index) {
            if (confirm('Delete this clip?')) {
              window.parent.postMessage({ type: 'quickview-delete-clip', index }, '*');
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
                    <button class="clip-btn delete" onclick="deleteClip(\${index})" title="Delete">×</button>
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
    
    // Listen for storage changes to auto-refresh clips
    const storageListener = (changes, area) => {
      if (area === 'local' && changes.clips && iframe.contentWindow) {
        const clips = changes.clips.newValue || [];
        iframe.contentWindow.postMessage({ type: 'quickview-clips-data', clips }, '*');
      }
    };
    chrome.storage.onChanged.addListener(storageListener);
    
    // Store listener reference for cleanup
    this._quickViewStorageListener = storageListener;
    
    // Listen for messages from iframe
    const messageHandler = (e) => {
      if (e.data.type === 'quickview-get-clips') {
        // Get clips from storage and send to iframe (using 'clips' key like popup.js does)
        chrome.storage.local.get(['clips'], (result) => {
          const clips = result.clips || [];
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'quickview-clips-data', clips }, '*');
          }
        });
      } else if (e.data.type === 'quickview-delete-clip') {
        // Handle clip deletion
        chrome.storage.local.get(['clips'], (result) => {
          const clips = result.clips || [];
          clips.splice(e.data.index, 1);
          chrome.storage.local.set({ clips: clips }, () => {
            // Send updated clips back
            if (iframe.contentWindow) {
              iframe.contentWindow.postMessage({ type: 'quickview-clips-data', clips }, '*');
            }
            // Notify popup to refresh if it's open
            chrome.runtime.sendMessage({ action: 'refreshClips' }).catch(() => {});
          });
        });
      } else if (e.data.type === 'quickview-open-settings') {
        // Open settings from quick view
        this.closeQuickView();
        setTimeout(() => this.openSettings(), 100);
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
      
      console.log('✅ Quick View panel closed');
    }
  }
  
  loadSavedPosition() {
    chrome.storage.local.get(['widgetPosition'], (result) => {
      if (result.widgetPosition && this.widget) {
        this.position = result.widgetPosition;
        this.widget.style.top = this.position.top + '%';
        console.log('📍 Widget position loaded:', this.position.top + '%');
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
