// PasteCraft Quick Paste Content Script
class QuickPasteInterface {
  constructor() {
    this.isVisible = false;
    this.clips = [];
    this.container = null;
    this.position = { x: 20, y: 20 }; // Default position
    
    this.init();
  }
  
  async init() {
    await this.loadClips();
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
          <button class="pastecraft-btn pastecraft-settings" title="Settings">⚙️</button>
          <button class="pastecraft-btn pastecraft-close" title="Close">×</button>
        </div>
      </div>
      <div class="pastecraft-content">
        <div class="pastecraft-clips-container">
          ${this.renderClips()}
        </div>
        <div class="pastecraft-footer">
          <button class="pastecraft-btn pastecraft-refresh" title="Refresh clips">🔄</button>
          <span class="pastecraft-count">${this.clips.length} clips</span>
        </div>
      </div>
    `;
    
    // Add styles
    this.addStyles();
    
    // Initially hidden
    this.container.style.display = 'none';
    document.body.appendChild(this.container);
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
    
    return this.clips.slice(0, 20).map((clip, index) => {
      const text = clip.text || clip;
      const displayText = text.length > 50 ? text.substring(0, 50) + '...' : text;
      const category = clip.category || 'Uncategorized';
      const timeAgo = this.getTimeAgo(clip.timestamp);
      
      return `
        <div class="pastecraft-clip" data-index="${index}" title="${text}">
          <div class="pastecraft-clip-content">
            <div class="pastecraft-clip-text">${this.escapeHtml(displayText)}</div>
            <div class="pastecraft-clip-meta">
              <span class="pastecraft-category">${category}</span>
              <span class="pastecraft-time">${timeAgo}</span>
            </div>
          </div>
          <div class="pastecraft-clip-actions">
            <button class="pastecraft-btn pastecraft-paste" data-index="${index}" title="Paste">📋</button>
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
      }
      
      .pastecraft-clips-container {
        padding: 8px;
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
      
      .pastecraft-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 16px;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        font-size: 12px;
        color: #6b7280;
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
    `;
    
    document.head.appendChild(styles);
  }
  
  setupEventListeners() {
    if (!this.container) return;
    
    // Close button
    this.container.querySelector('.pastecraft-close').addEventListener('click', () => {
      this.hideInterface();
    });
    
    // Refresh button
    this.container.querySelector('.pastecraft-refresh').addEventListener('click', async () => {
      await this.loadClips();
      this.updateInterface();
    });
    
    // Settings button
    this.container.querySelector('.pastecraft-settings').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openPopup' });
    });
    
    // Clip click handlers
    this.container.addEventListener('click', (e) => {
      const clipElement = e.target.closest('.pastecraft-clip');
      const pasteBtn = e.target.closest('.pastecraft-paste');
      
      if (pasteBtn) {
        e.stopPropagation();
        const index = parseInt(pasteBtn.dataset.index);
        this.pasteClip(index);
      } else if (clipElement) {
        const index = parseInt(clipElement.dataset.index);
        this.pasteClip(index);
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
        this.loadClips().then(() => {
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
      }
      
      sendResponse(true);
    });
  }
  
  showInterface(x, y) {
    if (!this.container) return;
    
    if (x && y) {
      // Position near cursor, but ensure it stays on screen
      const rect = this.container.getBoundingClientRect();
      const maxX = window.innerWidth - 340; // 320px width + 20px margin
      const maxY = window.innerHeight - 520; // 500px max height + 20px margin
      
      this.container.style.left = Math.min(x, maxX) + 'px';
      this.container.style.top = Math.min(y, maxY) + 'px';
      this.container.style.right = 'auto';
    }
    
    this.container.style.display = 'block';
    this.isVisible = true;
    
    console.log('👁️ Quick Paste interface shown');
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
      right: 20px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 1000000;
      animation: pastecraft-toast-in 0.3s ease;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
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
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
`;
document.head.appendChild(toastStyles);
