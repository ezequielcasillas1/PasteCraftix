// PasteCraft Quick Paste Content Script
class QuickPasteInterface {
  constructor() {
    this.isVisible = false;
    this.clips = [];
    this.container = null;
    this.settingsModal = null;
    this.position = { x: 20, y: 20 }; // Default position
    this.settings = {
      theme: 'light',
      autoHide: true,
      showTimestamps: true,
      maxClipsDisplay: 20,
      delimiter: 'comma',
      customDelimiter: ', ',
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
      const result = await chrome.storage.local.get(['clips']);
      this.clips = result.clips || [];
      console.log('📋 Loaded clips for Quick Paste:', this.clips.length);
      console.log('📋 Clips data:', this.clips.slice(0, 3).map(clip => ({
        text: (clip.text || clip).substring(0, 30) + '...',
        category: clip.category || 'Uncategorized',
        timestamp: clip.timestamp
      })));
    } catch (error) {
      console.error('Failed to load clips:', error);
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
          <button class="pastecraft-btn pastecraft-debug" title="Debug Sticky Footer">🔧</button>
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
    if (document.getElementById(styleId)) return;
    
    const styles = document.createElement('style');
    styles.id = styleId;
    styles.textContent = `
      #pastecraft-quick-paste {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 320px;
        max-height: 500px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        border: 1px solid #e2e8f0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: 999999;
        overflow: hidden;
        overflow-x: hidden;
        backdrop-filter: blur(10px);
        animation: pastecraft-slide-in 0.3s ease;
      }
      
      @keyframes pastecraft-slide-in {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
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
    
    // Debug button
    const debugBtn = this.container.querySelector('.pastecraft-debug');
    if (debugBtn) {
      debugBtn.addEventListener('click', () => {
        this.runStickyFooterDebug();
      });
      console.log('✅ Debug button event listener added');
    }
    
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
      this.container.style.transform = 'none';
      
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
      if (this.isVisible && !this.container.contains(e.target)) {
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
        this.loadClips().then(() => {
          console.log('🔄 Auto-refreshed clips after new clip saved');
          this.updateInterface();
          if (!this.isVisible && this.clips.length > 0) {
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
    
    // Apply saved/calculated position
    this.container.style.left = this.position.x + 'px';
    this.container.style.top = this.position.y + 'px';
    this.container.style.right = 'auto';
    this.container.style.bottom = 'auto';
    this.container.style.transform = 'none';
    
    this.container.style.display = 'block';
    this.isVisible = true;
    
    // 🚨 COMPREHENSIVE DEBUG SYSTEM FOR STICKY FOOTER
    console.log('👁️ Quick Paste interface shown at position:', this.position);
    console.log('🔍 ===== STICKY FOOTER DEBUG SESSION START =====');
    
    const footer = this.container.querySelector('.pastecraft-footer');
    const content = this.container.querySelector('.pastecraft-content');
    const clipsContainer = this.container.querySelector('.pastecraft-clips-container');
    const mainContainer = this.container;
    
    // Step 1: Check if elements exist
    console.log('📋 STEP 1: Element Existence Check');
    console.log('  - Footer exists:', !!footer);
    console.log('  - Content exists:', !!content);
    console.log('  - Clips container exists:', !!clipsContainer);
    console.log('  - Main container exists:', !!mainContainer);
    
    if (!footer) {
      console.error('❌ CRITICAL: Footer element not found!');
      return;
    }
    
    // Step 2: Check DOM hierarchy
    console.log('📋 STEP 2: DOM Hierarchy Check');
    console.log('  - Footer parent:', footer.parentElement?.className || 'NO PARENT');
    console.log('  - Content parent:', content?.parentElement?.className || 'NO PARENT');
    console.log('  - Main container ID:', mainContainer.id);
    console.log('  - Main container classes:', mainContainer.className);
    
    // Step 3: Check initial computed styles
    console.log('📋 STEP 3: Initial Computed Styles');
    const footerStyles = window.getComputedStyle(footer);
    const contentStyles = content ? window.getComputedStyle(content) : null;
    const containerStyles = window.getComputedStyle(mainContainer);
    
    console.log('  🎨 Footer Styles:', {
      position: footerStyles.position,
      bottom: footerStyles.bottom,
      top: footerStyles.top,
      zIndex: footerStyles.zIndex,
      display: footerStyles.display,
      marginTop: footerStyles.marginTop,
      height: footerStyles.height,
      background: footerStyles.background
    });
    
    if (contentStyles) {
      console.log('  🎨 Content Styles:', {
        display: contentStyles.display,
        flexDirection: contentStyles.flexDirection,
        height: contentStyles.height,
        maxHeight: contentStyles.maxHeight,
        overflowY: contentStyles.overflowY,
        position: contentStyles.position
      });
    }
    
    console.log('  🎨 Main Container Styles:', {
      display: containerStyles.display,
      position: containerStyles.position,
      height: containerStyles.height,
      overflow: containerStyles.overflow
    });
    
    // Step 4: Check CSS rules applied
    console.log('📋 STEP 4: CSS Rules Analysis');
    const footerRules = [];
    for (let sheet of document.styleSheets) {
      try {
        for (let rule of sheet.cssRules || sheet.rules) {
          if (rule.selectorText && rule.selectorText.includes('pastecraft-footer')) {
            footerRules.push({
              selector: rule.selectorText,
              position: rule.style.position,
              bottom: rule.style.bottom,
              zIndex: rule.style.zIndex
            });
          }
        }
      } catch (e) {
        console.log('  ⚠️ Could not access stylesheet:', sheet.href);
      }
    }
    console.log('  📜 Footer CSS Rules Found:', footerRules);
    
    // Step 5: Force inline styles with verification
    console.log('📋 STEP 5: Applying Inline Style Fixes');
    
    // Fix footer
    footer.style.position = 'sticky';
    footer.style.bottom = '0px';
    footer.style.zIndex = '9999';
    footer.style.marginTop = 'auto';
    footer.style.backgroundColor = 'rgba(248, 250, 252, 0.98)';
    footer.style.backdropFilter = 'blur(12px)';
    footer.style.borderTop = '2px solid #e2e8f0';
    footer.style.boxShadow = '0 -6px 20px rgba(0, 0, 0, 0.15)';
    
    // Fix content container
    if (content) {
      content.style.display = 'flex';
      content.style.flexDirection = 'column';
      content.style.height = '400px'; // Fixed height instead of 100%
      content.style.minHeight = '300px';
      content.style.position = 'relative';
    }
    
    // Fix clips container
    if (clipsContainer) {
      clipsContainer.style.flex = '1';
      clipsContainer.style.overflowY = 'auto';
      clipsContainer.style.minHeight = '0';
      clipsContainer.style.paddingBottom = '8px';
    }
    
    // Step 6: Verify changes applied
    console.log('📋 STEP 6: Verification After Inline Styles');
    const newFooterStyles = window.getComputedStyle(footer);
    const newContentStyles = content ? window.getComputedStyle(content) : null;
    
    console.log('  ✅ Footer After Fix:', {
      position: newFooterStyles.position,
      bottom: newFooterStyles.bottom,
      zIndex: newFooterStyles.zIndex,
      marginTop: newFooterStyles.marginTop,
      background: newFooterStyles.background
    });
    
    if (newContentStyles) {
      console.log('  ✅ Content After Fix:', {
        display: newContentStyles.display,
        flexDirection: newContentStyles.flexDirection,
        height: newContentStyles.height,
        overflowY: newContentStyles.overflowY
      });
    }
    
    // Step 7: Test scroll behavior
    console.log('📋 STEP 7: Testing Scroll Behavior');
    if (clipsContainer) {
      const scrollHeight = clipsContainer.scrollHeight;
      const clientHeight = clipsContainer.clientHeight;
      console.log('  📏 Scroll Metrics:', {
        scrollHeight,
        clientHeight,
        isScrollable: scrollHeight > clientHeight,
        scrollTop: clipsContainer.scrollTop
      });
      
      // Test scroll
      if (scrollHeight > clientHeight) {
        console.log('  🧪 Testing scroll to bottom...');
        clipsContainer.scrollTop = scrollHeight;
        setTimeout(() => {
          const footerRect = footer.getBoundingClientRect();
          const containerRect = mainContainer.getBoundingClientRect();
          console.log('  📍 Footer Position After Scroll:', {
            footerBottom: footerRect.bottom,
            containerBottom: containerRect.bottom,
            isFooterVisible: footerRect.bottom <= containerRect.bottom + 10
          });
        }, 100);
      }
    }
    
    console.log('🔍 ===== STICKY FOOTER DEBUG SESSION END =====');
  }
  
  // 🔧 ON-DEMAND DEBUG METHOD
  runStickyFooterDebug() {
    console.log('🚨 ===== ON-DEMAND STICKY FOOTER DEBUG =====');
    
    const footer = this.container?.querySelector('.pastecraft-footer');
    const content = this.container?.querySelector('.pastecraft-content');
    const clipsContainer = this.container?.querySelector('.pastecraft-clips-container');
    
    if (!footer) {
      console.error('❌ Footer not found during debug!');
      return;
    }
    
    // Current state analysis
    console.log('📊 CURRENT STATE ANALYSIS:');
    const footerRect = footer.getBoundingClientRect();
    const contentRect = content?.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    
    console.log('  📍 Footer Position:', {
      top: footerRect.top,
      bottom: footerRect.bottom,
      left: footerRect.left,
      right: footerRect.right,
      width: footerRect.width,
      height: footerRect.height
    });
    
    console.log('  📍 Container Position:', {
      top: containerRect.top,
      bottom: containerRect.bottom,
      height: containerRect.height
    });
    
    console.log('  📍 Relative Position:', {
      footerRelativeToContainer: footerRect.bottom - containerRect.bottom,
      isFooterAtBottom: Math.abs(footerRect.bottom - containerRect.bottom) < 5
    });
    
    // Scroll test
    if (clipsContainer) {
      console.log('🧪 SCROLL TEST:');
      const originalScrollTop = clipsContainer.scrollTop;
      
      // Scroll to middle
      clipsContainer.scrollTop = clipsContainer.scrollHeight / 2;
      setTimeout(() => {
        const midFooterRect = footer.getBoundingClientRect();
        console.log('  📍 Footer at mid-scroll:', {
          bottom: midFooterRect.bottom,
          containerBottom: containerRect.bottom,
          isSticking: Math.abs(midFooterRect.bottom - containerRect.bottom) < 5
        });
        
        // Scroll to bottom
        clipsContainer.scrollTop = clipsContainer.scrollHeight;
        setTimeout(() => {
          const bottomFooterRect = footer.getBoundingClientRect();
          console.log('  📍 Footer at bottom-scroll:', {
            bottom: bottomFooterRect.bottom,
            containerBottom: containerRect.bottom,
            isSticking: Math.abs(bottomFooterRect.bottom - containerRect.bottom) < 5
          });
          
          // Restore original position
          clipsContainer.scrollTop = originalScrollTop;
        }, 50);
      }, 50);
    }
    
    // CSS override test
    console.log('🔧 APPLYING EMERGENCY CSS OVERRIDE:');
    footer.style.cssText = `
      position: sticky !important;
      bottom: 0px !important;
      z-index: 99999 !important;
      background: rgba(255, 0, 0, 0.9) !important;
      border-top: 3px solid red !important;
      margin-top: auto !important;
      width: 100% !important;
      left: 0 !important;
      right: 0 !important;
      display: flex !important;
      justify-content: flex-start !important;
      align-items: center !important;
      gap: 12px !important;
      padding: 12px 16px !important;
    `;
    
    if (content) {
      content.style.cssText = `
        display: flex !important;
        flex-direction: column !important;
        height: 400px !important;
        position: relative !important;
      `;
    }
    
    if (clipsContainer) {
      clipsContainer.style.cssText = `
        flex: 1 !important;
        overflow-y: auto !important;
        min-height: 0 !important;
      `;
    }
    
    console.log('✅ Emergency CSS applied - footer should now be RED and sticky!');
    console.log('🚨 ===== ON-DEMAND DEBUG COMPLETE =====');
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

// Initialize Quick Paste when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.pasteCraftQuickPaste = new QuickPasteInterface();
  });
} else {
  window.pasteCraftQuickPaste = new QuickPasteInterface();
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
