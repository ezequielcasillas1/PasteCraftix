// PasteCraft Quick Paste Content Script
class QuickPasteInterface {
  constructor() {
    this.isVisible = false;
    this.clips = [];
    this.container = null;
    this.position = { x: 20, y: 20 }; // Default position
    this.selectedClips = new Set(); // Track selected clips for transport
    this.categories = []; // Available categories
    this.currentFilter = ''; // Current category filter
    
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
      const result = await chrome.storage.local.get(['clips', 'categories']);
      this.clips = result.clips || [];
      this.categories = result.categories || [];
      console.log('📋 Loaded clips for Quick Paste:', this.clips.length);
      console.log('📁 Loaded categories for Quick Paste:', this.categories.length);
    } catch (error) {
      console.error('Failed to load clips:', error);
      this.clips = [];
      this.categories = [];
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
      <div class="qp-header">
        <div class="qp-title">
          <span class="qp-icon">📋</span>
          <span class="qp-text">Quick Paste</span>
        </div>
        <div class="qp-header-actions">
          <button class="qp-btn qp-settings-btn" title="Open Settings">⚙️</button>
          <button class="qp-btn qp-close-btn" title="Close">✕</button>
        </div>
      </div>
      
      <div class="qp-filters">
        <div class="qp-filter-row">
          <select class="qp-category-filter" id="quickPasteCategoryFilter">
            <option value="">🗂️ All Categories</option>
          </select>
        </div>
        <div class="qp-actions-row" id="qpActionsRow" style="display: none;">
          <button class="qp-btn qp-transport-btn" id="qpTransportBtn" title="Move selected clips to category">
            📦 Transport <span id="qpSelectedCount">0</span>
          </button>
          <button class="qp-btn qp-select-all-btn" id="qpSelectAllBtn" title="Select/deselect all">
            📋 Toggle All
          </button>
        </div>
      </div>
      
      <div class="qp-content">
        <div class="qp-clips-container" id="qpClipsContainer">
          ${this.renderClips()}
        </div>
      </div>
      
      <div class="qp-footer">
        <div class="qp-stats">
          <span class="qp-count" id="qpCount">${this.clips.length} clips</span>
        </div>
        <div class="qp-footer-actions">
          <button class="qp-btn qp-refresh-btn" title="Refresh clips">🔄</button>
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
    
    // Filter clips by category if filter is set
    let filteredClips = this.clips;
    if (this.currentFilter) {
      filteredClips = this.clips.filter(clip => (clip.category || 'Uncategorized') === this.currentFilter);
    }
    
    return filteredClips.slice(0, 20).map((clip, index) => {
      const text = clip.text || clip;
      const displayText = text.length > 50 ? text.substring(0, 50) + '...' : text;
      const category = clip.category || 'Uncategorized';
      const timeAgo = this.getTimeAgo(clip.timestamp);
      const clipId = clip.id || index;
      const isSelected = this.selectedClips.has(clipId);
      
      return `
        <div class="pastecraft-clip ${isSelected ? 'selected' : ''}" data-index="${index}" data-clip-id="${clipId}" title="${text}">
          <div class="pastecraft-clip-checkbox">
            <input type="checkbox" ${isSelected ? 'checked' : ''} data-clip-id="${clipId}">
          </div>
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
      
      .pastecraft-filters {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }
      
      .pastecraft-category-filter {
        flex: 1;
        padding: 6px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        background: white;
        font-size: 12px;
        color: #374151;
      }
      
      .pastecraft-transport {
        background: #10b981 !important;
        color: white !important;
        font-size: 12px !important;
        padding: 6px 12px !important;
      }
      
      .pastecraft-transport:hover {
        background: #059669 !important;
      }
      
      .pastecraft-select-all {
        background: #6366f1 !important;
        color: white !important;
        font-size: 11px !important;
        padding: 4px 8px !important;
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
      
      .pastecraft-clip.selected {
        background: #eff6ff;
        border-color: #3b82f6;
      }
      
      .pastecraft-clip-checkbox {
        margin-right: 8px;
      }
      
      .pastecraft-clip-checkbox input {
        width: 16px;
        height: 16px;
        cursor: pointer;
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
    
    // Category filter
    this.container.querySelector('.pastecraft-category-filter').addEventListener('change', (e) => {
      this.currentFilter = e.target.value;
      this.updateInterface();
    });
    
    // Transport button
    this.container.querySelector('.pastecraft-transport').addEventListener('click', () => {
      this.showTransportModal();
    });
    
    // Select all button
    this.container.querySelector('.pastecraft-select-all').addEventListener('click', () => {
      this.toggleSelectAll();
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
      } else if (message.action === 'show20ClipPrompt') {
        this.show20ClipLimitPrompt(message.totalClips);
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
    const transportBtn = this.container.querySelector('.pastecraft-transport');
    const categoryFilter = this.container.querySelector('.pastecraft-category-filter');
    
    // Update clips display
    clipsContainer.innerHTML = this.renderClips();
    countElement.textContent = `${this.clips.length} clips`;
    
    // Update transport button visibility
    transportBtn.style.display = this.selectedClips.size > 0 ? 'block' : 'none';
    
    // Update category filter options
    this.updateCategoryFilter(categoryFilter);
    
    // Re-attach event listeners for checkboxes
    this.attachCheckboxListeners();
  }
  
  updateCategoryFilter(selectElement) {
    const currentValue = selectElement.value;
    selectElement.innerHTML = '<option value="">All Categories</option>';
    
    // Add Uncategorized option
    selectElement.innerHTML += '<option value="Uncategorized">Uncategorized</option>';
    
    // Add custom categories
    this.categories.forEach(category => {
      selectElement.innerHTML += `<option value="${category.name}">${category.name}</option>`;
    });
    
    // Restore previous selection
    selectElement.value = currentValue;
  }
  
  attachCheckboxListeners() {
    const checkboxes = this.container.querySelectorAll('.pastecraft-clip-checkbox input');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const clipId = e.target.dataset.clipId;
        if (e.target.checked) {
          this.selectedClips.add(clipId);
        } else {
          this.selectedClips.delete(clipId);
        }
        
        // Update transport button visibility
        const transportBtn = this.container.querySelector('.pastecraft-transport');
        transportBtn.style.display = this.selectedClips.size > 0 ? 'block' : 'none';
        
        // Update clip visual state
        const clipElement = e.target.closest('.pastecraft-clip');
        if (e.target.checked) {
          clipElement.classList.add('selected');
        } else {
          clipElement.classList.remove('selected');
        }
      });
    });
  }
  
  toggleSelectAll() {
    const checkboxes = this.container.querySelectorAll('.pastecraft-clip-checkbox input');
    const allSelected = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(checkbox => {
      checkbox.checked = !allSelected;
      const clipId = checkbox.dataset.clipId;
      const clipElement = checkbox.closest('.pastecraft-clip');
      
      if (!allSelected) {
        this.selectedClips.add(clipId);
        clipElement.classList.add('selected');
      } else {
        this.selectedClips.delete(clipId);
        clipElement.classList.remove('selected');
      }
    });
    
    // Update transport button
    const transportBtn = this.container.querySelector('.pastecraft-transport');
    transportBtn.style.display = this.selectedClips.size > 0 ? 'block' : 'none';
  }
  
  showTransportModal() {
    const selectedCount = this.selectedClips.size;
    if (selectedCount === 0) return;
    
    const categoryOptions = this.categories.map(cat => 
      `<option value="${cat.name}">${cat.icon} ${cat.name}</option>`
    ).join('');
    
    const modal = document.createElement('div');
    modal.className = 'pastecraft-transport-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000000;
    `;
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 24px; min-width: 300px; max-width: 400px;">
        <h3 style="margin: 0 0 16px 0; color: #1f2937;">Transport ${selectedCount} clips</h3>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151;">Select destination category:</label>
          <select id="transportCategorySelect" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; background: white;">
            <option value="">Choose category...</option>
            <option value="Uncategorized">📄 Uncategorized</option>
            ${categoryOptions}
          </select>
        </div>
        <div style="margin-bottom: 16px;">
          <input type="text" id="newCategoryName" placeholder="Or create new category..." style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;">
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button id="cancelTransport" style="padding: 8px 16px; border: 1px solid #d1d5db; background: white; border-radius: 6px; cursor: pointer;">Cancel</button>
          <button id="confirmTransport" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;">Transport</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    modal.querySelector('#cancelTransport').addEventListener('click', () => {
      modal.remove();
    });
    
    modal.querySelector('#confirmTransport').addEventListener('click', () => {
      this.executeTransport(modal);
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }
  
  async executeTransport(modal) {
    const categorySelect = modal.querySelector('#transportCategorySelect');
    const newCategoryInput = modal.querySelector('#newCategoryName');
    
    let targetCategory = categorySelect.value;
    
    // Create new category if specified
    if (newCategoryInput.value.trim()) {
      targetCategory = newCategoryInput.value.trim();
      // Add to categories if it doesn't exist
      if (!this.categories.find(cat => cat.name === targetCategory)) {
        const newCategory = {
          id: Date.now(),
          name: targetCategory,
          icon: '📁',
          created: Date.now()
        };
        this.categories.push(newCategory);
        await chrome.storage.local.set({ categories: this.categories });
      }
    }
    
    if (!targetCategory) {
      alert('Please select or create a category');
      return;
    }
    
    // Update selected clips
    const selectedClipIds = Array.from(this.selectedClips);
    this.clips.forEach(clip => {
      if (selectedClipIds.includes(clip.id.toString())) {
        clip.category = targetCategory;
      }
    });
    
    // Save updated clips
    await chrome.storage.local.set({ clips: this.clips });
    
    // Clear selection
    this.selectedClips.clear();
    
    // Update interface
    await this.loadClips();
    this.updateInterface();
    
    // Close modal
    modal.remove();
    
    this.showToast(`Transported ${selectedClipIds.length} clips to ${targetCategory}!`);
  }
  
  show20ClipLimitPrompt(totalClips) {
    const modal = document.createElement('div');
    modal.className = 'pastecraft-limit-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000001;
    `;
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 16px; padding: 32px; max-width: 500px; text-align: center; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
        <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
        <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 24px;">Clipboard Limit Reached!</h2>
        <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 16px; line-height: 1.5;">
          You've reached ${totalClips} saved clips. What would you like to do?
        </p>
        
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
          <button id="saveToCategory" style="padding: 12px 20px; background: #10b981; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 500;">
            💾 Save to Category & Continue
          </button>
          <button id="refreshClips" style="padding: 12px 20px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 500;">
            🔄 Refresh & Start Fresh
          </button>
          <button id="continueAnyway" style="padding: 12px 20px; background: #6b7280; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 500;">
            ➡️ Continue (Move Old to Archive)
          </button>
        </div>
        
        <p style="margin: 0; color: #9ca3af; font-size: 14px;">
          New clips will replace old ones if you continue without action.
        </p>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    modal.querySelector('#saveToCategory').addEventListener('click', () => {
      modal.remove();
      // Show Quick Paste interface for transport
      this.showInterface();
      this.showToast('Select clips and use Transport button to save to category');
      chrome.runtime.sendMessage({
        action: 'handle20ClipResponse',
        response: 'save'
      });
    });
    
    modal.querySelector('#refreshClips').addEventListener('click', () => {
      modal.remove();
      chrome.runtime.sendMessage({
        action: 'handle20ClipResponse',
        response: 'refresh'
      });
      this.showToast('Clips refreshed! Starting fresh with empty clipboard.');
    });
    
    modal.querySelector('#continueAnyway').addEventListener('click', () => {
      modal.remove();
      chrome.runtime.sendMessage({
        action: 'handle20ClipResponse',
        response: 'continue'
      });
      this.showToast('Continuing - older clips moved to search archive.');
    });
    
    // Prevent closing by clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        // Don't close automatically - force user to choose
      }
    });
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
