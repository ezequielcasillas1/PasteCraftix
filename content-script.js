// PasteCraft Quick Paste Content Script - Modern UI
class QuickPasteInterface {
  constructor() {
    this.isVisible = false;
    this.clips = [];
    this.container = null;
    this.position = { x: 20, y: 20 };
    this.selectedClips = new Set();
    this.categories = [];
    this.currentFilter = '';
    
    this.init();
  }
  
  async init() {
    await this.loadClips();
    this.createInterface();
    this.setupEventListeners();
    this.setupMessageListener();
    
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
    
    this.addStyles();
    this.container.style.display = 'none';
    document.body.appendChild(this.container);
  }
  
  renderClips() {
    if (this.clips.length === 0) {
      return `
        <div class="qp-empty-state">
          <div class="qp-empty-icon">📋</div>
          <h4>No clips saved yet</h4>
          <p>Right-click selected text and choose<br>"Copy to Quick Save" to start</p>
        </div>
      `;
    }
    
    let filteredClips = this.clips;
    if (this.currentFilter) {
      filteredClips = this.clips.filter(clip => (clip.category || 'Uncategorized') === this.currentFilter);
    }
    
    return filteredClips.slice(0, 20).map((clip, index) => {
      const text = clip.text || clip;
      const displayText = text.length > 60 ? text.substring(0, 60) + '...' : text;
      const category = clip.category || 'Uncategorized';
      const timeAgo = this.getTimeAgo(clip.timestamp);
      const clipId = clip.id || index;
      const isSelected = this.selectedClips.has(clipId.toString());
      
      return `
        <div class="qp-clip ${isSelected ? 'selected' : ''}" data-index="${index}" data-clip-id="${clipId}">
          <div class="qp-clip-checkbox">
            <input type="checkbox" ${isSelected ? 'checked' : ''} data-clip-id="${clipId}">
          </div>
          <div class="qp-clip-content">
            <div class="qp-clip-text" title="${this.escapeHtml(text)}">${this.escapeHtml(displayText)}</div>
            <div class="qp-clip-meta">
              <span class="qp-category-badge">${category}</span>
              <span class="qp-time-badge">${timeAgo}</span>
            </div>
          </div>
          <div class="qp-clip-actions">
            <button class="qp-paste-btn" data-index="${index}" title="Paste">📋</button>
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
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      
      #pastecraft-quick-paste {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 380px;
        max-height: 650px;
        background: #ffffff;
        border: none;
        border-radius: 20px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.5);
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        font-size: 14px;
        color: #1f2937;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: qp-slide-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        backdrop-filter: blur(20px) saturate(180%);
      }
      
      @keyframes qp-slide-in {
        from { 
          transform: translateX(100%) scale(0.9) rotate(5deg); 
          opacity: 0; 
        }
        to { 
          transform: translateX(0) scale(1) rotate(0deg); 
          opacity: 1; 
        }
      }
      
      /* Header */
      .qp-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 20px 20px 0 0;
        position: relative;
        overflow: hidden;
      }
      
      .qp-header::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
        pointer-events: none;
      }
      
      .qp-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 700;
        font-size: 18px;
        position: relative;
        z-index: 1;
      }
      
      .qp-icon {
        font-size: 22px;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
      }
      
      .qp-header-actions {
        display: flex;
        gap: 8px;
        position: relative;
        z-index: 1;
      }
      
      .qp-btn {
        background: rgba(255, 255, 255, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 12px;
        color: white;
        font-size: 14px;
        min-width: 40px;
        height: 40px;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        gap: 8px;
        padding: 0 16px;
        backdrop-filter: blur(10px);
      }
      
      .qp-btn:hover {
        background: rgba(255, 255, 255, 0.25);
        border-color: rgba(255, 255, 255, 0.4);
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(0,0,0,0.15);
      }
      
      .qp-btn:active {
        transform: translateY(0);
      }
      
      /* Filters */
      .qp-filters {
        padding: 20px 24px;
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        border-bottom: 1px solid rgba(226, 232, 240, 0.8);
      }
      
      .qp-filter-row {
        margin-bottom: 16px;
      }
      
      .qp-category-filter {
        width: 100%;
        padding: 14px 18px;
        border: 2px solid rgba(226, 232, 240, 0.8);
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.9);
        font-size: 15px;
        color: #374151;
        font-weight: 600;
        transition: all 0.3s ease;
        cursor: pointer;
        backdrop-filter: blur(10px);
      }
      
      .qp-category-filter:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
        background: white;
      }
      
      .qp-actions-row {
        display: flex;
        gap: 12px;
        animation: qp-fade-in 0.3s ease-out;
      }
      
      @keyframes qp-fade-in {
        from { opacity: 0; transform: translateY(-15px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      .qp-transport-btn {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
        color: white !important;
        font-size: 14px !important;
        font-weight: 700 !important;
        border: none !important;
        border-radius: 16px !important;
        padding: 12px 20px !important;
        flex: 1;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      }
      
      .qp-transport-btn:hover {
        background: linear-gradient(135deg, #059669 0%, #047857 100%) !important;
        box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
      }
      
      .qp-select-all-btn {
        background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%) !important;
        color: white !important;
        font-size: 14px !important;
        font-weight: 700 !important;
        border: none !important;
        border-radius: 16px !important;
        padding: 12px 20px !important;
        min-width: 120px;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      }
      
      .qp-select-all-btn:hover {
        background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%) !important;
        box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
      }
      
      #qpSelectedCount {
        background: rgba(255, 255, 255, 0.25);
        border-radius: 8px;
        padding: 4px 8px;
        font-size: 12px;
        font-weight: 800;
        margin-left: 6px;
      }
      
      /* Content */
      .qp-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      .qp-clips-container {
        padding: 20px 24px;
        overflow-y: auto;
        max-height: 450px;
        scrollbar-width: thin;
        scrollbar-color: rgba(203, 213, 225, 0.8) transparent;
      }
      
      .qp-clips-container::-webkit-scrollbar {
        width: 8px;
      }
      
      .qp-clips-container::-webkit-scrollbar-track {
        background: transparent;
      }
      
      .qp-clips-container::-webkit-scrollbar-thumb {
        background: rgba(203, 213, 225, 0.8);
        border-radius: 4px;
      }
      
      .qp-clips-container::-webkit-scrollbar-thumb:hover {
        background: rgba(148, 163, 184, 0.9);
      }
      
      .qp-clip {
        display: flex;
        align-items: center;
        padding: 16px;
        margin: 0 0 12px 0;
        background: rgba(255, 255, 255, 0.8);
        border: 2px solid rgba(241, 245, 249, 0.8);
        border-radius: 16px;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
        backdrop-filter: blur(10px);
      }
      
      .qp-clip::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: transparent;
        transition: all 0.3s ease;
      }
      
      .qp-clip.selected {
        background: rgba(240, 249, 255, 0.9);
        border-color: rgba(14, 165, 233, 0.5);
        transform: translateX(6px) scale(1.02);
        box-shadow: 0 8px 25px rgba(14, 165, 233, 0.15);
      }
      
      .qp-clip.selected::before {
        background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
      }
      
      .qp-clip:hover {
        background: rgba(248, 250, 252, 0.95);
        border-color: rgba(226, 232, 240, 0.8);
        transform: translateX(4px) translateY(-2px);
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08);
      }
      
      .qp-clip-checkbox {
        margin-right: 16px;
        position: relative;
      }
      
      .qp-clip-checkbox input {
        width: 20px;
        height: 20px;
        cursor: pointer;
        accent-color: #0ea5e9;
        border-radius: 6px;
      }
      
      .qp-clip-content {
        flex: 1;
        min-width: 0;
      }
      
      .qp-clip-text {
        font-size: 15px;
        color: #1f2937;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 8px;
        line-height: 1.4;
      }
      
      .qp-clip-meta {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 12px;
        color: #6b7280;
      }
      
      .qp-category-badge {
        background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
        color: #4338ca;
        padding: 4px 10px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 700;
        border: 1px solid rgba(67, 56, 202, 0.2);
      }
      
      .qp-time-badge {
        color: #9ca3af;
        font-size: 11px;
        font-weight: 500;
      }
      
      .qp-clip-actions {
        margin-left: 16px;
      }
      
      .qp-paste-btn {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
        border: none;
        border-radius: 12px;
        padding: 10px 16px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
      }
      
      .qp-paste-btn:hover {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
      }
      
      /* Footer */
      .qp-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 24px;
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        border-top: 1px solid rgba(226, 232, 240, 0.8);
        border-radius: 0 0 20px 20px;
      }
      
      .qp-stats {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      
      .qp-count {
        font-weight: 700;
        color: #374151;
        font-size: 14px;
      }
      
      .qp-refresh-btn {
        background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%) !important;
        color: white !important;
        border: none !important;
        border-radius: 12px !important;
        padding: 10px 16px !important;
        font-size: 13px !important;
        font-weight: 700 !important;
        box-shadow: 0 4px 12px rgba(107, 114, 128, 0.3);
      }
      
      .qp-refresh-btn:hover {
        background: linear-gradient(135deg, #4b5563 0%, #374151 100%) !important;
        box-shadow: 0 8px 20px rgba(107, 114, 128, 0.4);
      }
      
      /* Empty State */
      .qp-empty-state {
        text-align: center;
        padding: 80px 24px;
        color: #9ca3af;
      }
      
      .qp-empty-icon {
        font-size: 80px;
        margin-bottom: 20px;
        opacity: 0.6;
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));
      }
      
      .qp-empty-state h4 {
        margin: 0 0 12px 0;
        font-size: 20px;
        font-weight: 700;
        color: #6b7280;
      }
      
      .qp-empty-state p {
        margin: 0;
        font-size: 15px;
        line-height: 1.6;
        color: #9ca3af;
      }
    `;
    
    document.head.appendChild(styles);
  }
  
  setupEventListeners() {
    // Close button
    this.container.querySelector('.qp-close-btn').addEventListener('click', () => {
      this.hideInterface();
    });
    
    // Settings button
    this.container.querySelector('.qp-settings-btn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openPopup' });
      this.hideInterface();
    });
    
    // Refresh button
    this.container.querySelector('.qp-refresh-btn').addEventListener('click', async () => {
      await this.loadClips();
      this.updateInterface();
    });
    
    // Category filter
    this.container.querySelector('.qp-category-filter').addEventListener('change', (e) => {
      this.currentFilter = e.target.value;
      this.selectedClips.clear();
      this.updateInterface();
    });
    
    // Transport button
    this.container.querySelector('#qpTransportBtn').addEventListener('click', () => {
      this.showTransportModal();
    });
    
    // Select all button
    this.container.querySelector('#qpSelectAllBtn').addEventListener('click', () => {
      this.toggleSelectAll();
    });
    
    // Close on outside click
    document.addEventListener('mousedown', (e) => {
      if (this.isVisible && this.container && !this.container.contains(e.target)) {
        this.hideInterface();
      }
    });
    
    // Close on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hideInterface();
      }
    });
  }
  
  setupMessageListener() {
    chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
      if (message.action === 'clipSaved') {
        await this.loadClips();
        this.updateInterface();
        if (!this.isVisible && this.clips.length > 0) {
          this.showInterface();
        }
      } else if (message.action === 'showQuickPaste') {
        await this.loadClips();
        this.updateInterface();
        this.showInterface(message.x, message.y);
      } else if (message.action === 'show20ClipPrompt') {
        this.show20ClipLimitPrompt(message.totalClips);
      }
      
      sendResponse(true);
    });
  }
  
  updateInterface() {
    if (!this.container) return;
    
    const clipsContainer = this.container.querySelector('#qpClipsContainer');
    const countElement = this.container.querySelector('#qpCount');
    const actionsRow = this.container.querySelector('#qpActionsRow');
    const selectedCountElement = this.container.querySelector('#qpSelectedCount');
    const categoryFilter = this.container.querySelector('.qp-category-filter');
    
    // Update clips display
    clipsContainer.innerHTML = this.renderClips();
    countElement.textContent = `${this.clips.length} clips`;
    
    // Update actions row visibility and selected count
    const hasSelected = this.selectedClips.size > 0;
    actionsRow.style.display = hasSelected ? 'flex' : 'none';
    if (selectedCountElement) {
      selectedCountElement.textContent = this.selectedClips.size;
    }
    
    // Update category filter options
    this.updateCategoryFilter(categoryFilter);
    
    // Re-attach event listeners for checkboxes and paste buttons
    this.attachClipEventListeners();
  }
  
  updateCategoryFilter(selectElement) {
    const currentValue = selectElement.value;
    selectElement.innerHTML = '<option value="">🗂️ All Categories</option>';
    
    // Add Uncategorized option
    selectElement.innerHTML += '<option value="Uncategorized">📄 Uncategorized</option>';
    
    // Add custom categories
    this.categories.forEach(category => {
      const icon = category.icon || '📁';
      selectElement.innerHTML += `<option value="${category.name}">${icon} ${category.name}</option>`;
    });
    
    // Restore previous selection
    selectElement.value = currentValue;
  }
  
  attachClipEventListeners() {
    // Checkbox listeners
    const checkboxes = this.container.querySelectorAll('.qp-clip-checkbox input');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const clipId = e.target.dataset.clipId;
        const clipElement = e.target.closest('.qp-clip');
        
        if (e.target.checked) {
          this.selectedClips.add(clipId);
          clipElement.classList.add('selected');
        } else {
          this.selectedClips.delete(clipId);
          clipElement.classList.remove('selected');
        }
        
        this.updateSelectionUI();
      });
    });
    
    // Paste button listeners
    const pasteButtons = this.container.querySelectorAll('.qp-paste-btn');
    pasteButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(e.target.dataset.index);
        this.pasteClip(index);
        this.hideInterface();
      });
    });
  }
  
  updateSelectionUI() {
    const actionsRow = this.container.querySelector('#qpActionsRow');
    const selectedCountElement = this.container.querySelector('#qpSelectedCount');
    
    const hasSelected = this.selectedClips.size > 0;
    actionsRow.style.display = hasSelected ? 'flex' : 'none';
    if (selectedCountElement) {
      selectedCountElement.textContent = this.selectedClips.size;
    }
  }
  
  toggleSelectAll() {
    const checkboxes = this.container.querySelectorAll('.qp-clip-checkbox input');
    const allSelected = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(checkbox => {
      const clipId = checkbox.dataset.clipId;
      const clipElement = checkbox.closest('.qp-clip');
      
      checkbox.checked = !allSelected;
      
      if (!allSelected) {
        this.selectedClips.add(clipId);
        clipElement.classList.add('selected');
      } else {
        this.selectedClips.delete(clipId);
        clipElement.classList.remove('selected');
      }
    });
    
    this.updateSelectionUI();
  }
  
  showTransportModal() {
    const selectedCount = this.selectedClips.size;
    if (selectedCount === 0) return;
    
    const categoryOptions = this.categories.map(cat => 
      `<option value="${cat.name}">${cat.icon || '📁'} ${cat.name}</option>`
    ).join('');
    
    const modal = document.createElement('div');
    modal.className = 'pastecraft-transport-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000000;
      backdrop-filter: blur(8px);
    `;
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 20px; padding: 32px; min-width: 400px; max-width: 500px; box-shadow: 0 25px 50px rgba(0,0,0,0.3);">
        <h3 style="margin: 0 0 20px 0; color: #1f2937; font-size: 24px; font-weight: 700;">📦 Transport ${selectedCount} clips</h3>
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 12px; font-weight: 600; color: #374151; font-size: 16px;">Choose destination category:</label>
          <select id="transportCategorySelect" style="width: 100%; padding: 14px 18px; border: 2px solid #e5e7eb; border-radius: 12px; background: white; font-size: 15px; font-weight: 500;">
            <option value="">Select category...</option>
            <option value="Uncategorized">📄 Uncategorized</option>
            ${categoryOptions}
          </select>
        </div>
        <div style="margin-bottom: 24px;">
          <input type="text" id="newCategoryName" placeholder="Or create a new category..." style="width: 100%; padding: 14px 18px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 15px;">
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button id="cancelTransport" style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 14px; color: #6b7280; transition: all 0.2s;">Cancel</button>
          <button id="confirmTransport" style="padding: 12px 24px; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 700; font-size: 14px; transition: all 0.2s;">Transport Clips</button>
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
    
    if (newCategoryInput.value.trim()) {
      targetCategory = newCategoryInput.value.trim();
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
    
    await chrome.storage.local.set({ clips: this.clips });
    
    this.selectedClips.clear();
    await this.loadClips();
    this.updateInterface();
    
    modal.remove();
    this.showToast(`✅ Transported ${selectedClipIds.length} clips to ${targetCategory}!`);
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
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000001;
      backdrop-filter: blur(12px);
    `;
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 24px; padding: 40px; max-width: 550px; text-align: center; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.4);">
        <div style="font-size: 64px; margin-bottom: 20px;">📋</div>
        <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 28px; font-weight: 800;">Clipboard Limit Reached!</h2>
        <p style="margin: 0 0 32px 0; color: #6b7280; font-size: 18px; line-height: 1.6;">
          You've reached <strong>${totalClips} saved clips</strong>. What would you like to do?
        </p>
        
        <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px;">
          <button id="saveToCategory" style="padding: 16px 24px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 16px; cursor: pointer; font-size: 18px; font-weight: 700; transition: all 0.2s;">
            💾 Save to Category & Continue
          </button>
          <button id="refreshClips" style="padding: 16px 24px; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; border-radius: 16px; cursor: pointer; font-size: 18px; font-weight: 700; transition: all 0.2s;">
            🔄 Refresh & Start Fresh
          </button>
          <button id="continueAnyway" style="padding: 16px 24px; background: linear-gradient(135deg, #6b7280, #4b5563); color: white; border: none; border-radius: 16px; cursor: pointer; font-size: 18px; font-weight: 700; transition: all 0.2s;">
            ➡️ Continue (Archive Old Clips)
          </button>
        </div>
        
        <p style="margin: 0; color: #9ca3af; font-size: 16px;">
          New clips will replace old ones if you continue without action.
        </p>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    modal.querySelector('#saveToCategory').addEventListener('click', () => {
      modal.remove();
      this.showInterface();
      this.showToast('💡 Select clips and use Transport button to save to category');
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
      this.showToast('🔄 Clips refreshed! Starting fresh with empty clipboard.');
    });
    
    modal.querySelector('#continueAnyway').addEventListener('click', () => {
      modal.remove();
      chrome.runtime.sendMessage({
        action: 'handle20ClipResponse',
        response: 'continue'
      });
      this.showToast('➡️ Continuing - older clips moved to search archive.');
    });
  }
  
  async pasteClip(index) {
    const clip = this.clips[index];
    if (!clip) return;
    
    try {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
        if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
          const start = activeElement.selectionStart;
          const end = activeElement.selectionEnd;
          const text = clip.text || clip;
          activeElement.value = activeElement.value.substring(0, start) + text + activeElement.value.substring(end);
          activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
        } else {
          document.execCommand('insertText', false, clip.text || clip);
        }
        activeElement.focus();
        this.showToast('✅ Pasted successfully!');
      } else {
        await navigator.clipboard.writeText(clip.text || clip);
        this.showToast('📋 Copied to clipboard (no active input found)!');
      }
    } catch (error) {
      console.error('Failed to paste:', error);
      this.showToast('❌ Failed to paste!');
    }
  }
  
  showInterface(x = this.position.x, y = this.position.y) {
    if (!this.container) return;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const interfaceWidth = 380;
    const interfaceHeight = 650;
    
    let finalX = x;
    let finalY = y;
    
    if (finalX + interfaceWidth > viewportWidth - 20) {
      finalX = viewportWidth - interfaceWidth - 20;
    }
    if (finalY + interfaceHeight > viewportHeight - 20) {
      finalY = viewportHeight - interfaceHeight - 20;
    }
    if (finalX < 20) finalX = 20;
    if (finalY < 20) finalY = 20;
    
    this.container.style.left = `${finalX}px`;
    this.container.style.top = `${finalY}px`;
    this.container.style.display = 'flex';
    this.isVisible = true;
    
    console.log('✨ Quick Paste interface shown at', finalX, finalY);
  }
  
  hideInterface() {
    if (!this.container) return;
    this.container.style.display = 'none';
    this.isVisible = false;
    this.selectedClips.clear();
    console.log('🙈 Quick Paste interface hidden');
  }
  
  showToast(message) {
    let toast = document.getElementById('pastecraft-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pastecraft-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 16px;
        font-size: 15px;
        font-weight: 600;
        z-index: 1000000;
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
        backdrop-filter: blur(10px);
      `;
      document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
    }, 3000);
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

// Initialize when DOM loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.quickPasteInterface = new QuickPasteInterface();
  });
} else {
  window.quickPasteInterface = new QuickPasteInterface();
}
