// PasteCraft Advanced Popup Script
console.log('🟢 popup.js LOADED at', new Date().toISOString());

class PasteCraftPopup {
  constructor() {
    console.log('🟢 PasteCraftPopup constructor called');
    this.clips = [];
    this.categories = [];
    this.selectedChips = new Set();
    this.delimiter = 'comma';
    this.currentTab = 'clips';
    this.searchQuery = '';
    this.selectedCategory = '';
    this.selectedDateFilter = '';
    this.pendingText = null;
    this.selectedCategoryForSave = 'Uncategorized';
    this.autoDeletePeriod = 'never';
    this.searchOnlyClips = [];
    this.selectedCategoryClips = new Set();
    this.options = {
      deduplicate: false,
      sort: false,
      uppercase: false
    };
    this.userProfile = null;
    
    this.init();
  }
  
  async init() {
    console.log('🚀 Initializing PasteCraft popup...');
    
    // Setup auth modal events FIRST (before checking auth)
    this.setupAuthModalEvents();
    
    // Check for OAuth callback tokens
    await this.checkOAuthCallback();
    
    // Check if user is authenticated
    const currentUser = await pasteCraftSupabase.getCurrentUser();
    
    if (!currentUser) {
      // Show auth modal
      this.showAuthModal();
      return;
    }
    
    // User is authenticated, proceed with normal init
    console.log('✅ User authenticated:', currentUser.email);
    this.currentUser = currentUser;
    
    // Load subscription info
    this.userSubscription = await pasteCraftSupabase.getUserSubscription(currentUser.id);
    console.log('💎 Subscription tier:', this.userSubscription?.subscription_tier);
    
    // Show sign out button
    document.getElementById('signOutContainer').style.display = 'block';
    
    await this.loadData();
    await this.loadSettings();
    await this.loadUserProfile();
    
    // ✅ DISPLAY SAVED PROFILE IMAGE
    console.log('🔍 Checking for saved profile image...');
    if (this.userProfile?.profileImageUrl) {
      console.log('✅ Saved profile image found, displaying in top-left...');
      this.displayImageTopLeft(this.userProfile.profileImageUrl);
    } else {
      console.log('ℹ️ No saved profile image found');
    }
    
    await this.cleanupOldClips();
    this.setupEventListeners();
    this.renderChips();
    this.updateLastCapture();
    this.updatePreview();
    this.renderCategories();
    this.updateCategoryFilter();
    
    // Reload data whenever popup becomes visible
    this.setupVisibilityListener();
    console.log('✅ PasteCraft popup initialized successfully');
  }
  
  setupVisibilityListener() {
    // Reload data when popup is shown
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 Popup became visible - reloading data...');
        await this.loadData();
        this.renderChips();
        this.updateLastCapture();
        this.updatePreview();
        this.renderCategories();
        this.updateCategoryFilter();
        console.log('✅ Data reloaded successfully');
      }
    });
    
    // Also listen for storage changes in real-time
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && (changes.clips || changes.categories || changes.searchOnlyClips)) {
        console.log('🔄 Storage changed - reloading data...');
        this.loadData().then(() => {
          this.renderChips();
          this.updateLastCapture();
          this.updatePreview();
          this.renderCategories();
          this.updateCategoryFilter();
          console.log('✅ Data reloaded after storage change');
        });
      }
    });
  }
  
  async loadData() {
    console.log('🚀 DIAGNOSTIC: loadData() called at', new Date().toISOString());
    
    const result = await chrome.storage.local.get(['clips', 'categories', 'searchOnlyClips']);
    console.log('🔍 RAW STORAGE DATA:', {
      clipsCount: result.clips?.length || 0,
      categoriesCount: result.categories?.length || 0,
      searchOnlyClipsCount: result.searchOnlyClips?.length || 0,
      firstClip: result.clips?.[0] || 'NONE',
      firstClipText: result.clips?.[0]?.text?.substring(0, 30) || 'N/A'
    });
    
    const { clips = [], categories = [], searchOnlyClips = [] } = result;
    
    // Load active clips (max 20, shown in clips tab and quick paste)
    this.clips = clips.map(clip => {
      // Handle both old string format and new object format
      if (typeof clip === 'string') {
        return {
          id: Date.now() + Math.random(),
          text: clip,
          category: 'Uncategorized',
          timestamp: Date.now()
        };
      } else {
        return {
          id: clip.id || Date.now() + Math.random(),
          text: clip.text || clip,
          category: clip.category || 'Uncategorized',
          timestamp: clip.timestamp || Date.now()
        };
      }
    });
    
    // Load search-only clips (archived clips, only shown in search)
    this.searchOnlyClips = searchOnlyClips.map(clip => {
      if (typeof clip === 'string') {
        return {
          id: Date.now() + Math.random(),
          text: clip,
          category: 'Uncategorized',
          timestamp: Date.now()
        };
      } else {
        return {
          id: clip.id || Date.now() + Math.random(),
          text: clip.text || clip,
          category: clip.category || 'Uncategorized',
          timestamp: clip.timestamp || Date.now()
        };
      }
    });
    
    this.categories = categories;
    
    // Debug logging
    console.log('✅ DIAGNOSTIC: Loaded active clips:', this.clips.length);
    console.log('✅ DIAGNOSTIC: Loaded archived clips:', this.searchOnlyClips.length);
    console.log('✅ DIAGNOSTIC: Categories:', this.categories.length);
    console.log('✅ DIAGNOSTIC: First clip after processing:', this.clips[0] || 'NONE');
  }
  
  setupEventListeners() {
    // Tab navigation
    document.querySelector('.tab-nav').addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-btn')) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        e.target.classList.add('active');
        this.currentTab = e.target.dataset.tab;
        document.getElementById(this.currentTab + 'Tab').classList.add('active');
        
        // Format controls, preview, and magic wand are always visible across all tabs
        
        if (this.currentTab === 'search') {
          this.renderSearchResults();
        }
      }
    });

    // Search functionality
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.renderSearchResults();
    });

    document.getElementById('clearSearch').addEventListener('click', () => {
      document.getElementById('searchInput').value = '';
      this.searchQuery = '';
      this.renderSearchResults();
    });

    document.getElementById('categoryFilter').addEventListener('change', (e) => {
      this.selectedCategory = e.target.value;
      this.renderSearchResults();
    });

    document.getElementById('dateFilter').addEventListener('change', (e) => {
      this.selectedDateFilter = e.target.value;
      this.renderSearchResults();
    });

    // Category management
    document.getElementById('createCategoryBtn').addEventListener('click', () => {
      this.showCreateCategoryDialog();
    });

    // Category modal events
    document.getElementById('closeCategoryModal').addEventListener('click', () => {
      this.hideCategoryModal();
    });

    document.getElementById('cancelCategorization').addEventListener('click', () => {
      this.hideCategoryModal();
    });

    document.getElementById('createNewCategory').addEventListener('click', () => {
      this.showCreateCategoryFromModal();
    });

    document.getElementById('categoryOptions').addEventListener('click', (e) => {
      const option = e.target.closest('.category-option');
      if (option && !option.classList.contains('category-full')) {
        document.querySelectorAll('.category-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        this.selectedCategoryForSave = option.dataset.category;
        
        // Auto-save after selection
        setTimeout(() => {
          this.saveTextWithCategory();
        }, 300);
      } else if (option && option.classList.contains('category-full')) {
        // Show feedback for full categories
        this.showToast('This category is full (10 clips max). Remove some clips first.');
      }
    });

    // Modal overlay click to close
    document.getElementById('categoryModal').addEventListener('click', (e) => {
      if (e.target.id === 'categoryModal') {
        this.hideCategoryModal();
      }
    });

    // Profile modal events
    document.getElementById('profileBtn').addEventListener('click', () => {
      this.showProfileModal();
    });

    document.getElementById('closeProfileModal').addEventListener('click', () => {
      this.hideProfileModal();
    });

    // Settings modal events
    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.showSettingsModal();
    });

    document.getElementById('closeSettingsModal').addEventListener('click', () => {
      this.hideSettingsModal();
    });
    
    // Help button
    document.getElementById('helpBtn').addEventListener('click', () => {
      this.showHelpModal();
    });

    document.getElementById('cancelSettings').addEventListener('click', () => {
      this.hideSettingsModal();
    });

    document.getElementById('saveSettings').addEventListener('click', () => {
      this.saveSettings();
    });
    
    // Help modal events
    document.getElementById('closeHelpModal').addEventListener('click', () => {
      this.hideHelpModal();
    });
    
    document.getElementById('backBtn').addEventListener('click', () => {
      this.hideHelpModal();
    });
    
    document.getElementById('backToSettingsFromHelp').addEventListener('click', () => {
      this.hideHelpModal();
    });

    // Help modal overlay click to close
    document.getElementById('helpModal').addEventListener('click', (e) => {
      if (e.target.id === 'helpModal') {
        this.hideHelpModal();
      }
    });

    document.getElementById('settingsModal').addEventListener('click', (e) => {
      if (e.target.id === 'settingsModal') {
        this.hideSettingsModal();
      }
    });

    // Delimiter controls
    document.getElementById('delimiterControl').addEventListener('click', (e) => {
      if (e.target.classList.contains('segment-btn')) {
        document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        this.delimiter = e.target.dataset.delimiter;
        this.updatePreview();
        this.updatePreviewFromSelection(); // Also update category selection preview
        
        // Handle custom delimiter
        const customInput = document.getElementById('customDelimiter');
        if (this.delimiter === 'custom') {
          customInput.style.display = 'block';
          customInput.focus();
        } else {
          customInput.style.display = 'none';
        }
      }
    });
    
    // Toggle controls
    document.getElementById('deduplicateToggle').addEventListener('change', (e) => {
      this.options.deduplicate = e.target.checked;
      this.updatePreview();
      this.updatePreviewFromSelection(); // Also update category selection preview
    });
    
    document.getElementById('sortToggle').addEventListener('change', (e) => {
      this.options.sort = e.target.checked;
      this.updatePreview();
      this.updatePreviewFromSelection(); // Also update category selection preview
    });
    
    document.getElementById('uppercaseToggle').addEventListener('change', (e) => {
      this.options.uppercase = e.target.checked;
      this.updatePreview();
      this.updatePreviewFromSelection(); // Also update category selection preview
    });
    
    // Copy button
    document.getElementById('copyBtn').addEventListener('click', () => {
      this.copyToClipboard();
    });
    
    // Magic wand
    document.getElementById('magicWand').addEventListener('click', () => {
      this.magicFormat();
    });
  }
  
  // =====================================================
  // AUTHENTICATION METHODS
  // =====================================================
  
  async checkOAuthCallback() {
    try {
      const result = await chrome.storage.local.get('oauth_callback');
      if (result.oauth_callback) {
        const { access_token, refresh_token } = result.oauth_callback;
        console.log('🔐 Found OAuth callback tokens, completing sign in...');
        
        // Set session with tokens
        const { error } = await pasteCraftSupabase.client.auth.setSession({
          access_token,
          refresh_token
        });
        
        if (!error) {
          console.log('✅ OAuth sign in completed!');
          const { data: { user } } = await pasteCraftSupabase.client.auth.getUser();
          
          // Create subscription for new user
          if (user) {
            await pasteCraftSupabase.createUserSubscription(user.id, user.email);
          }
          
          // Clear the temporary tokens
          await chrome.storage.local.remove('oauth_callback');
        } else {
          console.error('❌ Failed to set session:', error);
        }
      }
    } catch (error) {
      console.error('❌ Error checking OAuth callback:', error);
    }
  }
  
  showAuthModal() {
    console.log('🔐 Showing auth modal...');
    document.getElementById('authModal').style.display = 'flex';
  }
  
  hideAuthModal() {
    document.getElementById('authModal').style.display = 'none';
  }
  
  setupAuthModalEvents() {
    console.log('🔧 Setting up auth modal event listeners...');
    // Tab switching - support both old and new tab classes
    document.querySelectorAll('.auth-tab, .auth-tab-new').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.auth-tab, .auth-tab-new').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        const targetTab = e.target.dataset.authTab;
        document.getElementById('signinForm').style.display = targetTab === 'signin' ? 'flex' : 'none';
        document.getElementById('signupForm').style.display = targetTab === 'signup' ? 'flex' : 'none';
      });
    });

    // Password strength indicator
    const signupPassword = document.getElementById('signupPassword');
    if (signupPassword) {
      signupPassword.addEventListener('input', (e) => {
        this.updatePasswordStrength(e.target.value);
      });
    }

    // Sign In
    document.getElementById('signinBtn').addEventListener('click', async () => {
      console.log('🔐 Sign In button clicked');
      const email = document.getElementById('signinEmail').value;
      const password = document.getElementById('signinPassword').value;
      
      if (!email || !password) {
        this.showToast('⚠️ Please fill in all fields', 'error');
        return;
      }
      
      const result = await pasteCraftSupabase.signInWithEmail(email, password);
      
      if (result.success) {
        this.showToast('✅ Welcome back!', 'success');
        this.hideAuthModal();
        // Reload page to initialize with authenticated user
        window.location.reload();
      } else {
        this.showToast(`❌ ${result.error}`, 'error');
      }
    });

    // Sign Up
    document.getElementById('signupBtn').addEventListener('click', async () => {
      console.log('📝 Sign Up button clicked');
      const email = document.getElementById('signupEmail').value;
      const password = document.getElementById('signupPassword').value;
      const confirmPassword = document.getElementById('signupPasswordConfirm').value;
      const agreeTerms = document.getElementById('agreeTerms').checked;
      
      if (!email || !password || !confirmPassword) {
        this.showToast('⚠️ Please fill in all fields', 'error');
        return;
      }
      
      if (password !== confirmPassword) {
        this.showToast('⚠️ Passwords do not match', 'error');
        return;
      }
      
      if (password.length < 8) {
        this.showToast('⚠️ Password must be at least 8 characters', 'error');
        return;
      }
      
      if (!agreeTerms) {
        this.showToast('⚠️ Please agree to terms and conditions', 'error');
        return;
      }
      
      const result = await pasteCraftSupabase.signUpWithEmail(email, password);
      
      if (result.success) {
        this.showToast('✅ Account created! Please check your email to verify.', 'success');
        // Switch to sign in tab
        document.querySelector('[data-auth-tab="signin"]').click();
      } else {
        this.showToast(`❌ ${result.error}`, 'error');
      }
    });

    // Google Sign In
    document.getElementById('googleSigninBtn').addEventListener('click', async () => {
      console.log('🔵 Google Sign In button clicked');
      this.showToast('🔵 Opening Google sign in...', 'info');
      
      const result = await pasteCraftSupabase.signInWithGoogle();
      
      if (result.success) {
        this.showToast('✅ Complete sign in in the new window!', 'success');
        // Don't reload - user will close and reopen popup after OAuth
      } else {
        this.showToast(`❌ ${result.error}`, 'error');
      }
    });

    // Google Sign Up
    document.getElementById('googleSignupBtn').addEventListener('click', async () => {
      console.log('🔵 Google Sign Up button clicked');
      this.showToast('🔵 Opening Google sign up...', 'info');
      
      const result = await pasteCraftSupabase.signInWithGoogle();
      
      if (result.success) {
        this.showToast('✅ Complete sign up in the new window!', 'success');
        // Don't reload - user will close and reopen popup after OAuth
      } else {
        this.showToast(`❌ ${result.error}`, 'error');
      }
    });

    // Admin Sign In Link
    document.getElementById('adminSignInLink').addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('authModal').style.display = 'none';
      document.getElementById('adminAuthModal').style.display = 'flex';
    });

    // Close Admin Modal
    document.getElementById('closeAdminAuthModal').addEventListener('click', () => {
      document.getElementById('adminAuthModal').style.display = 'none';
      document.getElementById('authModal').style.display = 'flex';
    });

    // Back to User Auth
    document.getElementById('backToUserAuth').addEventListener('click', () => {
      document.getElementById('adminAuthModal').style.display = 'none';
      document.getElementById('authModal').style.display = 'flex';
    });

    // Admin Sign In
    document.getElementById('adminSigninBtn').addEventListener('click', async () => {
      const email = document.getElementById('adminEmail').value;
      const password = document.getElementById('adminPassword').value;
      
      if (!email || !password) {
        this.showToast('⚠️ Please fill in all fields', 'error');
        return;
      }
      
      const result = await pasteCraftSupabase.signInAsAdmin(email, password);
      
      if (result.success && result.isAdmin) {
        this.showToast('✅ Admin access granted!', 'success');
        document.getElementById('adminAuthModal').style.display = 'none';
        // Reload page to initialize with authenticated admin user
        window.location.reload();
      } else {
        this.showToast(`❌ ${result.error || 'Admin access denied'}`, 'error');
      }
    });

    // Sign Out
    document.getElementById('signOutBtn').addEventListener('click', async () => {
      if (confirm('Are you sure you want to sign out?')) {
        const result = await pasteCraftSupabase.signOut();
        
        if (result.success) {
          this.showToast('👋 Signed out successfully', 'success');
          // Clear local state
          this.currentUser = null;
          this.userSubscription = null;
          // Reload page to show auth modal
          window.location.reload();
        } else {
          this.showToast(`❌ ${result.error}`, 'error');
        }
      }
    });
  }
  
  renderChips() {
    const container = document.getElementById('chipContainer');
    
    if (this.clips.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✨</div>
          <h3>No clips yet</h3>
          <p>Right-click selected text to save it here</p>
          <div class="demo-hint">
            <span class="demo-step">1️⃣ Select text</span>
            <span class="demo-step">2️⃣ Right-click</span>
            <span class="demo-step">3️⃣ Save to PasteCraft</span>
          </div>
        </div>
      `;
      return;
    }
    
    container.innerHTML = '';
    this.clips.forEach((clip, index) => {
      const chip = this.createChip(clip, index);
      container.appendChild(chip);
    });
  }
  
  createChip(clip, index) {
    const chip = document.createElement('div');
    chip.className = 'chip animate-slide-in';
    chip.dataset.index = index;
    
    const text = clip.text.length > 30 ? clip.text.substring(0, 30) + '...' : clip.text;
    
    const clipCategory = clip.category || 'Uncategorized';
    
    chip.innerHTML = `
      <span class="chip-text" title="${clip.text}">${text}</span>
      <div class="chip-actions">
        <button class="chip-category-btn" title="Add to category">📁</button>
        <button class="chip-remove" title="Remove clip">×</button>
      </div>
    `;

    // Add category indicator if not Uncategorized
    if (clipCategory !== 'Uncategorized') {
      const categoryIndicator = document.createElement('span');
      categoryIndicator.className = 'chip-category-indicator';
      categoryIndicator.style.cssText = `
        font-size: 10px;
        background: rgba(0,0,0,0.1);
        padding: 2px 6px;
        border-radius: 8px;
        margin-left: 4px;
      `;
      categoryIndicator.textContent = clipCategory;
      chip.querySelector('.chip-text').appendChild(categoryIndicator);
    }
    
    // Click to select/deselect
    chip.addEventListener('click', (e) => {
      if (e.target.classList.contains('chip-remove')) {
        this.removeChip(index);
      } else if (e.target.classList.contains('chip-category-btn')) {
        this.pendingText = clip.text;
        this.pendingClipIndex = index;
        this.showCategoryModal(true);
      } else {
        this.toggleChip(index, chip);
      }
    });
    
    return chip;
  }
  
  toggleChip(index, chipElement) {
    if (this.selectedChips.has(index)) {
      this.selectedChips.delete(index);
      chipElement.classList.remove('selected');
    } else {
      this.selectedChips.add(index);
      chipElement.classList.add('selected');
    }
    this.updatePreview();
  }
  
  async removeChip(index) {
    this.clips.splice(index, 1);
    await chrome.storage.local.set({ clips: this.clips });
    this.selectedChips.clear();
    this.renderChips();
    this.updatePreview();
  }
  
  updateLastCapture() {
    const lastCaptureEl = document.getElementById('lastCapture');
    if (this.clips.length > 0) {
      const lastClip = this.clips[0];
      const timeAgo = this.getTimeAgo(lastClip.date);
      lastCaptureEl.textContent = `Last: ${timeAgo}`;
    } else {
      lastCaptureEl.textContent = 'No recent captures';
    }
  }
  
  getTimeAgo(dateString) {
    const now = new Date();
    const clipDate = new Date(dateString);
    const diffMs = now - clipDate;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
  
  updatePreview() {
    const previewArea = document.getElementById('previewArea');
    const selectedTexts = Array.from(this.selectedChips)
      .map(index => this.clips[index]?.text)
      .filter(Boolean);
    
    if (selectedTexts.length === 0) {
      previewArea.value = '';
      return;
    }
    
    let processedTexts = [...selectedTexts];
    
    // Apply transformations
    if (this.options.deduplicate) {
      processedTexts = [...new Set(processedTexts)];
    }
    
    if (this.options.sort) {
      processedTexts.sort();
    }
    
    if (this.options.uppercase) {
      processedTexts = processedTexts.map(t => t.toUpperCase());
    }
    
    // Apply delimiter
    const delimiters = {
      comma: ', ',
      newline: '\n',
      space: ' ',
      custom: document.getElementById('customDelimiter')?.value || ', '
    };
    
    const output = processedTexts.join(delimiters[this.delimiter] || ', ');
    previewArea.value = output;
  }
  
  async copyToClipboard() {
    const previewArea = document.getElementById('previewArea');
    const copyBtn = document.getElementById('copyBtn');
    
    if (!previewArea.value) return;
    
    try {
      await navigator.clipboard.writeText(previewArea.value);
      
      // Success feedback
      copyBtn.textContent = 'Copied! ✓';
      copyBtn.classList.add('success');
      
      // Confetti for large copies
      if (this.selectedChips.size >= 5) {
        this.showConfetti();
      }
      
      setTimeout(() => {
        copyBtn.textContent = 'Copy Crafted Output';
        copyBtn.classList.remove('success');
      }, 2000);
      
    } catch (error) {
      console.error('Copy failed:', error);
      copyBtn.textContent = 'Copy Failed';
      setTimeout(() => {
        copyBtn.textContent = 'Copy Crafted Output';
      }, 2000);
    }
  }
  
  magicFormat() {
    // Select all clips
    this.clips.forEach((_, index) => {
      this.selectedChips.add(index);
      const chip = document.querySelector(`[data-index="${index}"]`);
      if (chip) chip.classList.add('selected');
    });
    
    // Enable all options
    document.getElementById('deduplicateToggle').checked = true;
    document.getElementById('sortToggle').checked = true;
    this.options.deduplicate = true;
    this.options.sort = true;
    
    // Set comma delimiter
    document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-delimiter="comma"]').classList.add('active');
    this.delimiter = 'comma';
    
    this.updatePreview();
    
    // Magic wand animation
    const wand = document.getElementById('magicWand');
    wand.style.transform = 'scale(1.2) rotate(360deg)';
    setTimeout(() => {
      wand.style.transform = '';
    }, 500);
  }
  
  showConfetti() {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const container = document.body;
    
    for (let i = 0; i < 30; i++) {
      setTimeout(() => {
        const confetti = document.createElement('div');
        confetti.style.cssText = `
          position: fixed;
          width: 6px;
          height: 6px;
          background: ${colors[Math.floor(Math.random() * colors.length)]};
          left: ${Math.random() * 100}vw;
          top: -10px;
          border-radius: 50%;
          pointer-events: none;
          z-index: 9999;
          animation: confetti 3s linear forwards;
        `;
        
        container.appendChild(confetti);
        setTimeout(() => confetti.remove(), 3000);
      }, i * 50);
    }
  }

  // Search and Filter Functions
  renderSearchResults() {
    const container = document.getElementById('searchResults');
    
    if (!this.searchQuery && !this.selectedCategory && !this.selectedDateFilter) {
      container.innerHTML = `
        <div class="empty-search">
          <div class="empty-search-icon">🔍</div>
          <h3>Start searching</h3>
          <p>Type in the search bar to find your clips</p>
        </div>
      `;
      return;
    }

    const filteredClips = this.filterClips();
    
    if (filteredClips.length === 0) {
      container.innerHTML = `
        <div class="empty-search">
          <div class="empty-search-icon">😔</div>
          <h3>No results found</h3>
          <p>Try adjusting your search criteria</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    filteredClips.forEach(clip => {
      const resultItem = this.createSearchResultItem(clip);
      container.appendChild(resultItem);
    });
  }

  filterClips() {
    // Combine active clips and search-only clips for search functionality
    const allClips = [...this.clips, ...this.searchOnlyClips];
    
    return allClips.filter(clip => {
      // Text search
      if (this.searchQuery && !clip.text.toLowerCase().includes(this.searchQuery.toLowerCase())) {
        return false;
      }

      // Category filter
      if (this.selectedCategory && clip.category !== this.selectedCategory) {
        return false;
      }

      // Date filter
      if (this.selectedDateFilter) {
        const clipDate = new Date(clip.timestamp);
        const now = new Date();
        
        switch (this.selectedDateFilter) {
          case 'today':
            if (clipDate.toDateString() !== now.toDateString()) return false;
            break;
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (clipDate < weekAgo) return false;
            break;
          case 'month':
            const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            if (clipDate < monthAgo) return false;
            break;
        }
      }

      return true;
    });
  }

  createSearchResultItem(clip) {
    const item = document.createElement('div');
    item.className = 'search-result-item';

    const truncatedText = clip.text.length > 100 ? clip.text.substring(0, 100) + '...' : clip.text;
    const timeAgo = this.getTimeAgo(clip.timestamp);

    item.innerHTML = `
      <div class="search-result-content">
        <div class="search-result-text">${this.escapeHtml(truncatedText)}</div>
        <div class="search-result-meta">
          <span class="search-result-category">${clip.category}</span>
          <span>${timeAgo}</span>
        </div>
      </div>
      <div class="search-result-actions">
        <button class="chip-category-btn" title="Add to category">📁</button>
        <button class="btn-copy" title="Copy to clipboard">📋</button>
      </div>
    `;

    // Copy functionality
    item.querySelector('.btn-copy').addEventListener('click', (e) => {
      e.stopPropagation();
      this.copyClipToClipboard(clip.text);
    });

    // Category assignment
    item.querySelector('.chip-category-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const clipIndex = this.clips.findIndex(c => c.id === clip.id);
      this.pendingText = clip.text;
      this.pendingClipIndex = clipIndex;
      this.showCategoryModal(true);
    });

    return item;
  }

  // Category Management Functions
  renderCategories() {
    const container = document.getElementById('categoriesList');
    
    if (this.categories.length === 0) {
      container.innerHTML = `
        <div class="empty-categories">
          <div class="empty-categories-icon">📁</div>
          <h3>No categories yet</h3>
          <p>Create your first category to organize clips</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    this.categories.forEach(category => {
      const categoryItem = this.createCategoryItem(category);
      container.appendChild(categoryItem);
    });
  }

  createCategoryItem(category) {
    const item = document.createElement('div');
    item.className = 'category-item';

    // Get clips in this category (from both active and archived)
    const allClips = [...this.clips, ...this.searchOnlyClips];
    const clipsInCategory = allClips.filter(clip => clip.category === category.name);
    const clipCount = clipsInCategory.length;
    
    console.log(`📊 Category "${category.name}" has ${clipCount} clips`);

    item.innerHTML = `
      <div class="category-header">
        <div class="category-info">
          <div class="category-icon">${category.icon}</div>
          <div class="category-details">
            <h4>${this.escapeHtml(category.name)}</h4>
            <p>${clipCount} clips</p>
          </div>
        </div>
        <div class="category-header-actions">
          <button class="category-btn edit-category" data-action="edit" title="Edit category">✏️</button>
          <button class="category-btn delete-category" data-action="delete" title="Delete category">🗑️</button>
          <span class="category-expand-icon">▶</span>
        </div>
      </div>
      <div class="category-dropdown" id="dropdown-${category.id}">
        ${this.createCategoryClipsHTML(clipsInCategory, category.id)}
      </div>
    `;

    // Add click handler for expand/collapse
    const header = item.querySelector('.category-header');
    header.addEventListener('click', (e) => {
      // Don't trigger if clicking on action buttons
      if (e.target.closest('.category-header-actions button')) return;
      
      this.toggleCategoryDropdown(item, category);
    });

    // Add event listeners for category actions
    item.querySelector('.edit-category').addEventListener('click', (e) => {
      e.stopPropagation();
      this.editCategory(category);
    });

    item.querySelector('.delete-category').addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteCategory(category);
    });

    return item;
  }

  showCreateCategoryDialog() {
    const name = prompt('Enter category name:');
    if (name && name.trim()) {
      const icon = prompt('Enter category icon (emoji):') || '📁';
      this.createCategory(name.trim(), icon);
    }
  }

  async createCategory(name, icon) {
    const category = {
      id: Date.now(),
      name,
      icon,
      created: Date.now()
    };

    this.categories.push(category);
    await chrome.storage.local.set({ categories: this.categories });
    
    this.renderCategories();
    this.updateCategoryFilter();
  }

  async editCategory(category) {
    const newName = prompt('Enter new category name:', category.name);
    if (newName && newName.trim()) {
      const newIcon = prompt('Enter new category icon:', category.icon) || category.icon;
      
      const oldName = category.name;
      category.name = newName.trim();
      category.icon = newIcon;

      // Update clips that use this category
      this.clips.forEach(clip => {
        if (clip.category === oldName) {
          clip.category = newName.trim();
        }
      });

      await chrome.storage.local.set({ 
        categories: this.categories,
        clips: this.clips 
      });
      
      this.renderCategories();
      this.updateCategoryFilter();
      this.renderChips();
    }
  }

  async deleteCategory(category) {
    if (confirm(`Delete category "${category.name}"? Clips will be moved to "Uncategorized".`)) {
      // Move clips to Uncategorized
      this.clips.forEach(clip => {
        if (clip.category === category.name) {
          clip.category = 'Uncategorized';
        }
      });

      // Remove category
      this.categories = this.categories.filter(cat => cat.id !== category.id);
      
      await chrome.storage.local.set({ 
        categories: this.categories,
        clips: this.clips 
      });
      
      this.renderCategories();
      this.updateCategoryFilter();
      this.renderChips();
    }
  }

  updateCategoryFilter() {
    const select = document.getElementById('categoryFilter');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">All Categories</option>';
    
    // Include categories from both active and archived clips
    const allClips = [...this.clips, ...this.searchOnlyClips];
    const uniqueCategories = [...new Set(allClips.map(clip => clip.category))];
    console.log('🎯 Unique categories found in all clips:', uniqueCategories);
    
    uniqueCategories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      select.appendChild(option);
    });
    
    select.value = currentValue;
  }

  // Utility Functions
  getTimeAgo(timestamp) {
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

  async copyClipToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  showToast(message) {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 2000);
  }

  // Category Modal Functions
  showCategoryModal(isReassignment = false) {
    this.populateCategoryOptions();
    document.getElementById('categoryModal').style.display = 'flex';
    
    // Update modal text for reassignment vs new save
    const modalText = document.querySelector('.modal-text');
    if (isReassignment) {
      modalText.textContent = 'Choose a new category for this clip:';
    } else {
      modalText.textContent = 'Where would you like to save this clip?';
    }
  }

  hideCategoryModal() {
    document.getElementById('categoryModal').style.display = 'none';
    this.pendingText = null;
    this.pendingClipIndex = null;
    this.selectedCategoryForSave = 'Uncategorized';
  }

  populateCategoryOptions() {
    const container = document.getElementById('categoryOptions');
    const allClips = [...this.clips, ...this.searchOnlyClips];
    
    // Count clips in Uncategorized
    const uncategorizedCount = allClips.filter(clip => clip.category === 'Uncategorized').length;
    const uncategorizedFull = uncategorizedCount >= 10;
    
    container.innerHTML = `
      <div class="category-option ${uncategorizedFull ? 'category-full' : ''}" data-category="Uncategorized">
        <div class="category-option-icon">📄</div>
        <span>Uncategorized (${uncategorizedCount}/10)</span>
        ${uncategorizedFull ? '<span class="full-indicator">FULL</span>' : ''}
      </div>
    `;

    this.categories.forEach(category => {
      const clipsInCategory = allClips.filter(clip => clip.category === category.name).length;
      const isFull = clipsInCategory >= 10;
      
      const option = document.createElement('div');
      option.className = `category-option ${isFull ? 'category-full' : ''}`;
      option.dataset.category = category.name;
      option.innerHTML = `
        <div class="category-option-icon">${category.icon}</div>
        <span>${this.escapeHtml(category.name)} (${clipsInCategory}/10)</span>
        ${isFull ? '<span class="full-indicator">FULL</span>' : ''}
      `;
      container.appendChild(option);
    });
  }

  async saveTextWithCategory() {
    if (!this.pendingText) return;

    if (this.pendingClipIndex !== null) {
      // Reassigning existing clip - check category limit first
      const currentClip = this.clips[this.pendingClipIndex];
      if (currentClip.category !== this.selectedCategoryForSave) {
        // Only check limit if moving to a different category
        const allClips = [...this.clips, ...this.searchOnlyClips];
        const clipsInTargetCategory = allClips.filter(clip => 
          clip.category === this.selectedCategoryForSave && clip.id !== currentClip.id
        );
        
        if (clipsInTargetCategory.length >= 10) {
          this.showToast(`Category "${this.selectedCategoryForSave}" is full (10 clips max). Remove some clips first.`);
          return;
        }
      }
      
      this.clips[this.pendingClipIndex].category = this.selectedCategoryForSave;
      await chrome.storage.local.set({ clips: this.clips });
      this.renderChips();
      this.renderSearchResults();
      this.updateCategoryFilter();
      this.showToast(`Moved to ${this.selectedCategoryForSave}!`);
    } else {
      // New clip save - check category limit first
      const allClips = [...this.clips, ...this.searchOnlyClips];
      const clipsInCategory = allClips.filter(clip => clip.category === this.selectedCategoryForSave);
      
      if (clipsInCategory.length >= 10) {
        this.showToast(`Category "${this.selectedCategoryForSave}" is full (10 clips max). Remove some clips first.`);
        return;
      }

      const newClip = {
        id: Date.now() + Math.random(),
        text: this.pendingText,
        category: this.selectedCategoryForSave,
        timestamp: Date.now()
      };

      this.clips.unshift(newClip);
      
      // Move clips beyond 20th to search-only storage
      if (this.clips.length > 20) {
        const overflowClips = this.clips.splice(20);
        await this.moveToSearchStorage(overflowClips);
      }

      await chrome.storage.local.set({ clips: this.clips });
      
      // Notify content scripts about new clip
      try {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'clipSaved',
              clip: newClip
            }).catch(() => {}); // Ignore errors for tabs without content script
          });
        });
      } catch (error) {
        console.log('Could not notify content scripts:', error);
      }
      
      this.renderChips();
      this.updateCategoryFilter();
      this.showToast(`Saved to ${this.selectedCategoryForSave}!`);
    }

    this.hideCategoryModal();
  }

  showCreateCategoryFromModal() {
    const name = prompt('Enter category name:');
    if (name && name.trim()) {
      const icon = prompt('Enter category icon (emoji):') || '📁';
      this.createCategory(name.trim(), icon).then(() => {
        this.populateCategoryOptions();
      });
    }
  }

  // Settings Management Functions
  async loadSettings() {
    const { autoDeletePeriod = 'never', quickPasteSettings = {} } = await chrome.storage.local.get(['autoDeletePeriod', 'quickPasteSettings']);
    this.autoDeletePeriod = autoDeletePeriod;
    this.quickPasteSettings = {
      theme: 'light',
      autoHide: true,
      showTimestamps: true,
      maxClipsDisplay: 20,
      ...quickPasteSettings
    };
  }

  async saveSettings() {
    const newAutoDeletePeriod = document.getElementById('autoDeletePeriod').value;
    this.autoDeletePeriod = newAutoDeletePeriod;
    
    // Update quick paste settings
    this.quickPasteSettings.theme = document.getElementById('quickPasteThemePopup').value;
    this.quickPasteSettings.autoHide = document.getElementById('quickPasteAutoHidePopup').checked;
    this.quickPasteSettings.showTimestamps = document.getElementById('quickPasteShowTimestampsPopup').checked;
    this.quickPasteSettings.maxClipsDisplay = parseInt(document.getElementById('quickPasteMaxClipsPopup').value);
    
    await chrome.storage.local.set({ 
      autoDeletePeriod: newAutoDeletePeriod,
      quickPasteSettings: this.quickPasteSettings
    });
    
    this.showToast('Settings saved!');
    this.hideSettingsModal();
    
    // Run cleanup after changing settings
    await this.cleanupOldClips();
    this.renderChips();
    this.updateCategoryFilter();
    
    // Notify content scripts about settings change
    try {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'settingsUpdated',
            settings: this.quickPasteSettings
          }).catch(() => {}); // Ignore errors for tabs without content script
        });
      });
    } catch (error) {
      console.log('Could not notify content scripts about settings:', error);
    }
  }

  showSettingsModal() {
    // Update storage statistics
    this.updateStorageStats();
    
    // Set current auto-delete period
    document.getElementById('autoDeletePeriod').value = this.autoDeletePeriod;
    
    // Set current quick paste settings
    document.getElementById('quickPasteThemePopup').value = this.quickPasteSettings.theme;
    document.getElementById('quickPasteAutoHidePopup').checked = this.quickPasteSettings.autoHide;
    document.getElementById('quickPasteShowTimestampsPopup').checked = this.quickPasteSettings.showTimestamps;
    document.getElementById('quickPasteMaxClipsPopup').value = this.quickPasteSettings.maxClipsDisplay;
    
    document.getElementById('settingsModal').style.display = 'flex';
    
  }

  hideSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
  }
  
  showHelpModal() {
    console.log('🔍 Help modal requested');
    document.getElementById('helpModal').style.display = 'flex';
    console.log('✅ Help modal shown');
  }
  
  hideHelpModal() {
    console.log('🙈 Help modal hidden');
    document.getElementById('helpModal').style.display = 'none';
  }
  

  updateStorageStats() {
    const allClips = [...this.clips, ...this.searchOnlyClips];
    const totalClips = allClips.length;
    const categorizedClips = allClips.filter(clip => clip.category !== 'Uncategorized').length;
    const uncategorizedClips = totalClips - categorizedClips;

    document.getElementById('totalClipsCount').textContent = `${totalClips} (${this.clips.length} active, ${this.searchOnlyClips.length} archived)`;
    document.getElementById('categorizedClipsCount').textContent = categorizedClips;
    document.getElementById('uncategorizedClipsCount').textContent = uncategorizedClips;
  }

  // Auto-Delete Functions
  async cleanupOldClips() {
    if (this.autoDeletePeriod === 'never') return;

    const cutoffTime = this.getCutoffTime(this.autoDeletePeriod);
    const initialCount = this.clips.length;

    // Filter out old uncategorized clips
    this.clips = this.clips.filter(clip => {
      const isUncategorized = clip.category === 'Uncategorized';
      const isOld = clip.timestamp < cutoffTime;
      
      // Keep clip if it's categorized OR not old
      return !isUncategorized || !isOld;
    });

    const deletedCount = initialCount - this.clips.length;
    
    if (deletedCount > 0) {
      await chrome.storage.local.set({ clips: this.clips });
      console.log(`🗑️ Auto-deleted ${deletedCount} old uncategorized clips`);
    }
  }

  getCutoffTime(period) {
    const now = Date.now();
    const periods = {
      '1day': 24 * 60 * 60 * 1000,
      '1week': 7 * 24 * 60 * 60 * 1000,
      '1month': 30 * 24 * 60 * 60 * 1000,
      '3months': 90 * 24 * 60 * 60 * 1000,
      '6months': 180 * 24 * 60 * 60 * 1000,
      '1year': 365 * 24 * 60 * 60 * 1000
    };
    
    return now - (periods[period] || 0);
  }

  // Category Dropdown Functions
  createCategoryClipsHTML(clips, categoryId) {
    if (clips.length === 0) {
      return '<div class="category-clip" style="text-align: center; color: #9ca3af; padding: 16px;">No clips in this category</div>';
    }

    return clips.map(clip => {
      const truncatedText = clip.text.length > 60 ? clip.text.substring(0, 60) + '...' : clip.text;
      const timeAgo = this.getTimeAgo(clip.timestamp);
      
      const html = `
        <div class="category-clip" data-clip-id="${clip.id}">
          <div class="category-clip-text">${this.escapeHtml(truncatedText)}</div>
          <div class="category-clip-time">${timeAgo}</div>
        </div>
      `;
      console.log(`🏗️ Creating category clip with ID: ${clip.id} (type: ${typeof clip.id})`);
      return html;
    }).join('');
  }

  toggleCategoryDropdown(categoryItem, category) {
    const dropdown = categoryItem.querySelector('.category-dropdown');
    const isExpanded = categoryItem.classList.contains('expanded');
    
    // Close all other dropdowns
    document.querySelectorAll('.category-item.expanded').forEach(item => {
      if (item !== categoryItem) {
        item.classList.remove('expanded');
        item.querySelector('.category-dropdown').classList.remove('expanded');
      }
    });
    
    if (isExpanded) {
      // Collapse this dropdown
      categoryItem.classList.remove('expanded');
      dropdown.classList.remove('expanded');
    } else {
      // Expand this dropdown
      categoryItem.classList.add('expanded');
      dropdown.classList.add('expanded');
      
      // Add click handlers to clips in dropdown
      this.attachClipHandlers(dropdown, category);
    }
  }

  attachClipHandlers(dropdown, category) {
    const clips = dropdown.querySelectorAll('.category-clip');
    clips.forEach(clipElement => {
      clipElement.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleClipSelection(clipElement, category);
      });
    });
  }

  toggleClipSelection(clipElement, category) {
    const clipId = parseFloat(clipElement.dataset.clipId); // Convert string to number
    const isSelected = clipElement.classList.contains('selected');
    
    console.log(`🎯 Toggling clip selection - ID: ${clipId} (${typeof clipId}), Currently selected: ${isSelected}`);
    
    if (isSelected) {
      clipElement.classList.remove('selected');
      console.log(`❌ Deselecting clip ${clipId}`);
      // Remove from selection tracking
      this.removeClipFromSelection(clipId);
    } else {
      clipElement.classList.add('selected');
      console.log(`✅ Selecting clip ${clipId}`);
      // Add to selection tracking
      this.addClipToSelection(clipId);
    }
    
    this.updatePreviewFromSelection();
  }

  addClipToSelection(clipId) {
    if (!this.selectedCategoryClips) {
      this.selectedCategoryClips = new Set();
    }
    this.selectedCategoryClips.add(clipId);
    console.log(`✅ Added clip ${clipId} to selection. Total:`, Array.from(this.selectedCategoryClips));
  }

  removeClipFromSelection(clipId) {
    if (this.selectedCategoryClips) {
      this.selectedCategoryClips.delete(clipId);
    }
    console.log(`🗑️ Removed clip ${clipId} from selection. Remaining:`, Array.from(this.selectedCategoryClips));
  }

  updatePreviewFromSelection() {
    console.log('🔄 Updating preview from selection:', this.selectedCategoryClips?.size || 0, 'clips selected');
    
    if (!this.selectedCategoryClips || this.selectedCategoryClips.size === 0) {
      document.getElementById('previewArea').value = '';
      console.log('📄 Preview cleared - no clips selected');
      return;
    }

    // Get selected clips
    const allClips = [...this.clips, ...this.searchOnlyClips];
    console.log('🔍 All clips available:', allClips.map(c => ({id: c.id, text: c.text.substring(0, 20)})));
    console.log('🎯 Selected clip IDs:', Array.from(this.selectedCategoryClips));
    
    const selectedClips = Array.from(this.selectedCategoryClips)
      .map(clipId => {
        const found = allClips.find(clip => clip.id === clipId); // Use strict equality with numeric IDs
        console.log(`🔎 Looking for clip ${clipId} (${typeof clipId}), found:`, found ? found.text.substring(0, 20) : 'NOT FOUND');
        return found;
      })
      .filter(Boolean);

    console.log('📋 Found selected clips:', selectedClips.length);

    // Apply formatting
    let processedTexts = selectedClips.map(clip => clip.text);
    
    // Apply transformations
    if (this.options.deduplicate) {
      processedTexts = [...new Set(processedTexts)];
      console.log('🔄 Applied deduplication');
    }
    
    if (this.options.sort) {
      processedTexts.sort();
      console.log('⬆️ Applied sorting');
    }
    
    if (this.options.uppercase) {
      processedTexts = processedTexts.map(text => text.toUpperCase());
      console.log('🔤 Applied uppercase');
    }

    // Apply delimiter
    const delimiters = {
      comma: ', ',
      newline: '\n',
      space: ' ',
      custom: document.getElementById('customDelimiter')?.value || ', '
    };
    
    const delimiter = delimiters[this.delimiter] || delimiters.comma;
    const formattedText = processedTexts.join(delimiter);
    
    document.getElementById('previewArea').value = formattedText;
    console.log('✅ Preview updated with formatted text:', formattedText.substring(0, 50) + '...');
  }

  // Search-Only Storage Management
  async moveToSearchStorage(overflowClips) {
    const { searchOnlyClips = [] } = await chrome.storage.local.get(['searchOnlyClips']);
    searchOnlyClips.unshift(...overflowClips);
    
    // Keep search storage reasonable (max 1000 total archived clips)
    if (searchOnlyClips.length > 1000) {
      searchOnlyClips.splice(1000);
    }
    
    this.searchOnlyClips = searchOnlyClips;
    await chrome.storage.local.set({ searchOnlyClips });
    console.log(`📦 Moved ${overflowClips.length} clips to search-only storage`);
  }

  // Profile Management Functions
  async loadUserProfile() {
    try {
      console.log('🔄 Loading user profile from chrome.storage.local...');
      const { userProfile = null } = await chrome.storage.local.get(['userProfile']);
      this.userProfile = userProfile;
      console.log('✅ Loaded user profile:', this.userProfile);
      
      if (this.userProfile?.profileImageUrl) {
        console.log('✅ Profile image URL found:', this.userProfile.profileImageUrl);
      } else {
        console.log('ℹ️ No profile image URL in saved profile');
      }
    } catch (error) {
      console.error('❌ CRITICAL: Failed to load user profile:', error);
    }
  }

  async saveUserProfile() {
    try {
      console.log('💾 Attempting to save user profile:', this.userProfile);
      await chrome.storage.local.set({ userProfile: this.userProfile });
      console.log('✅ User profile saved successfully to chrome.storage.local');
      
      // Verify the save worked
      const verification = await chrome.storage.local.get(['userProfile']);
      console.log('🔍 Verification - Profile in storage:', verification.userProfile);
      
      if (!verification.userProfile || !verification.userProfile.profileImageUrl) {
        console.error('⚠️ WARNING: Profile saved but verification failed!');
      }
    } catch (error) {
      console.error('❌ CRITICAL: Failed to save user profile:', error);
      this.showToast('❌ Failed to save profile image', 'error');
    }
  }

  showProfileModal() {
    document.getElementById('profileModal').style.display = 'flex';
    
    // Load existing profile data
    if (this.userProfile) {
      if (this.userProfile.userName) {
        document.getElementById('userName').value = this.userProfile.userName;
      }
      if (this.userProfile.aiName) {
        document.getElementById('aiNameValue').textContent = this.userProfile.aiName;
        document.getElementById('aiNameDisplay').style.display = 'flex';
      }
      if (this.userProfile.profileImageUrl) {
        document.getElementById('profileImage').src = this.userProfile.profileImageUrl;
        document.getElementById('profileImage').style.display = 'block';
        document.getElementById('profileImagePlaceholder').style.display = 'none';
      }
    }

    // Update AI Generate button state based on uploaded photo
    this.updateAIGenerateButtonState();

    // Setup profile modal event listeners
    this.setupProfileModalEvents();
    
    // Add scroll listener for sticky profile image effect
    const modalBody = document.querySelector('#profileModal .modal-body');
    const imageContainer = document.querySelector('.profile-image-container');
    
    if (modalBody && imageContainer) {
      // Remove old listener if exists
      modalBody.removeEventListener('scroll', this.profileScrollHandler);
      
      // Create new handler
      this.profileScrollHandler = () => {
        if (modalBody.scrollTop > 50) {
          imageContainer.classList.add('scrolled');
        } else {
          imageContainer.classList.remove('scrolled');
        }
      };
      
      // Add listener
      modalBody.addEventListener('scroll', this.profileScrollHandler);
      console.log('✅ Profile image sticky scroll behavior enabled');
    }
  }
  
  updateAIGenerateButtonState() {
    const generateAnimalBtn = document.getElementById('generateAnimalBtn');
    const generateCartoonBtn = document.getElementById('generateCartoonBtn');
    
    console.log('🔄 Updating button states...');
    console.log('AI Generated Name:', this.userProfile?.aiGeneratedName);
    console.log('Photo uploaded:', !!this.userProfile?.profileImageBase64);
    
    // Enable Animal Avatar if AI name is generated
    if (this.userProfile && this.userProfile.aiGeneratedName) {
      const match = this.userProfile.aiGeneratedName.match(/(Rabbit|Tiger|Dragon|Fox|Wolf|Bear|Panda|Lion|Eagle|Phoenix|Unicorn|Owl|Cat|Dog|Monkey|Penguin|Koala|Racoon|Shark|Dolphin|Cheetah|Leopard|Panther)$/i);
      console.log('Animal match found:', match ? match[1] : 'none');
      if (match) {
        generateAnimalBtn.disabled = false;
        generateAnimalBtn.classList.remove('btn-disabled');
        generateAnimalBtn.textContent = `🐾 ${match[1]} Avatar`;
        generateAnimalBtn.title = `Generate funky ${match[1]} avatar`;
        console.log(`✅ Animal Avatar button enabled for ${match[1]}`);
      } else {
        generateAnimalBtn.disabled = true;
        generateAnimalBtn.classList.add('btn-disabled');
        generateAnimalBtn.title = 'No animal detected in AI name';
        console.log('⚠️ AI name has no animal type');
      }
    } else {
      generateAnimalBtn.disabled = true;
      generateAnimalBtn.classList.add('btn-disabled');
      generateAnimalBtn.title = 'Generate AI name first';
      console.log('⚠️ No AI name generated yet');
    }
    
    // Enable My Cartoon if photo is uploaded
    if (this.userProfile && this.userProfile.profileImageBase64) {
      generateCartoonBtn.disabled = false;
      generateCartoonBtn.classList.remove('btn-disabled');
      generateCartoonBtn.title = 'Generate cartoon from your photo';
    } else {
      generateCartoonBtn.disabled = true;
      generateCartoonBtn.classList.add('btn-disabled');
      generateCartoonBtn.title = 'Upload a photo first';
    }
  }

  hideProfileModal() {
    document.getElementById('profileModal').style.display = 'none';
  }

  setupProfileModalEvents() {
    // Prevent multiple event listener attachments
    const profileModal = document.getElementById('profileModal');
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const generateImageBtn = document.getElementById('generateImageBtn');
    const generateNameBtn = document.getElementById('generateNameBtn');
    const unsubscribeBtn = document.getElementById('unsubscribeBtn');
    const profileImageUpload = document.getElementById('profileImageUpload');
    const nameToggleBtn = document.getElementById('nameToggleBtn');
    const photoToggleBtn = document.getElementById('photoToggleBtn');
    const nameRegHeader = document.getElementById('nameRegHeader');
    const photoCreationHeader = document.getElementById('photoCreationHeader');

    // Get new buttons
    const generateAnimalBtn = document.getElementById('generateAnimalBtn');
    const generateCartoonBtn = document.getElementById('generateCartoonBtn');
    
    // Remove old listeners by cloning and replacing nodes
    const newUploadBtn = uploadImageBtn.cloneNode(true);
    uploadImageBtn.replaceWith(newUploadBtn);
    
    const newGenerateAnimalBtn = generateAnimalBtn.cloneNode(true);
    generateAnimalBtn.replaceWith(newGenerateAnimalBtn);
    
    const newGenerateCartoonBtn = generateCartoonBtn.cloneNode(true);
    generateCartoonBtn.replaceWith(newGenerateCartoonBtn);
    
    const newGenerateNameBtn = generateNameBtn.cloneNode(true);
    generateNameBtn.replaceWith(newGenerateNameBtn);
    
    const newUnsubscribeBtn = unsubscribeBtn.cloneNode(true);
    unsubscribeBtn.replaceWith(newUnsubscribeBtn);

    // Collapse/Expand handlers for Name Registration
    nameRegHeader.addEventListener('click', () => {
      this.toggleSection('nameRegContent', 'nameToggleBtn');
    });

    // Collapse/Expand handlers for Photo Creation
    photoCreationHeader.addEventListener('click', () => {
      this.toggleSection('photoCreationContent', 'photoToggleBtn');
    });

    // Loading exit button - allows user to skip waiting
    const loadingExitBtn = document.getElementById('loadingExitBtn');
    if (loadingExitBtn) {
      loadingExitBtn.addEventListener('click', () => {
        console.log('⏭️ User clicked exit button - hiding loading overlay');
        document.getElementById('profileImageLoading').style.display = 'none';
        // Show placeholder or existing image
        const profileImage = document.getElementById('profileImage');
        const placeholder = document.getElementById('profileImagePlaceholder');
        if (profileImage && profileImage.src) {
          profileImage.style.display = 'block';
        } else if (placeholder) {
          placeholder.style.display = 'flex';
        }
        // Generation continues in background
        console.log('✅ Loading screen closed - generation continues in background');
      });
    }

    // Upload image button - attach to NEW cloned button
    newUploadBtn.addEventListener('click', () => {
      profileImageUpload.click();
    });

    // Profile image upload
    profileImageUpload.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await this.handleProfileImageUpload(file);
      }
    });

    // Generate Animal Avatar - attach to NEW cloned button
    console.log('🔘 Attaching Generate Animal listener');
    newGenerateAnimalBtn.addEventListener('click', async () => {
      console.log('🖱️ Generate Animal Avatar button CLICKED!');
      await this.generateAnimalAvatar();
    });
    console.log('✅ Generate Animal event listener attached');
    
    // Generate Cartoon from Photo - attach to NEW cloned button
    console.log('🔘 Attaching Generate Cartoon listener');
    newGenerateCartoonBtn.addEventListener('click', async () => {
      console.log('🖱️ Generate My Cartoon button CLICKED!');
      await this.generateMyCartoon();
    });
    console.log('✅ Generate Cartoon event listener attached');

    // Generate AI name - attach to NEW cloned button
    newGenerateNameBtn.addEventListener('click', async () => {
      console.log('🖱️ Generate Name button CLICKED!');
      await this.generateAIName();
    });

    // Unsubscribe - attach to NEW cloned button
    newUnsubscribeBtn.addEventListener('click', () => {
      console.log('🖱️ Unsubscribe button CLICKED!');
      this.showUnsubscribeConfirmation();
    });

    // Modal overlay click to close
    profileModal.addEventListener('click', (e) => {
      if (e.target.id === 'profileModal') {
        this.hideProfileModal();
      }
    });
  }
  
  toggleSection(contentId, toggleBtnId) {
    const content = document.getElementById(contentId);
    const toggleBtn = document.getElementById(toggleBtnId);
    
    if (content.classList.contains('collapsed')) {
      // Expand
      content.classList.remove('collapsed');
      toggleBtn.classList.remove('collapsed');
      toggleBtn.textContent = '▼';
    } else {
      // Collapse
      content.classList.add('collapsed');
      toggleBtn.classList.add('collapsed');
      toggleBtn.textContent = '▶';
    }
  }

  async handleProfileImageUpload(file) {
    try {
      this.showToast('📤 Uploading image...', 'info');
      
      // Convert to base64 for preview
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageUrl = e.target.result;
        
        // Display image
        document.getElementById('profileImage').src = imageUrl;
        document.getElementById('profileImage').style.display = 'block';
        document.getElementById('profileImagePlaceholder').style.display = 'none';
        
        // Save to profile
        if (!this.userProfile) {
          this.userProfile = {};
        }
        this.userProfile.profileImageUrl = imageUrl;
        this.userProfile.profileImageBase64 = imageUrl;
        
        await this.saveUserProfile();
        
        // Update AI Generate button state (enable it now)
        this.updateAIGenerateButtonState();
        
        this.showToast('✅ Profile image uploaded! Now you can generate AI avatar!', 'success');
      };
      reader.readAsDataURL(file);
      
    } catch (error) {
      console.error('Failed to upload profile image:', error);
      this.showToast('❌ Failed to upload image', 'error');
    }
  }

  async generateAnimalAvatar() {
    console.log('🐾 generateAnimalAvatar() CALLED!');
    try {
      const userName = document.getElementById('userName').value.trim();
      const aiGeneratedName = this.userProfile?.aiGeneratedName;
      
      if (!userName || !aiGeneratedName) {
        this.showToast('⚠️ Please generate an AI name first', 'error');
        return;
      }
      
      // Extract animal type
      const match = aiGeneratedName.match(/(Rabbit|Tiger|Dragon|Fox|Wolf|Bear|Panda|Lion|Eagle|Phoenix|Unicorn|Owl|Cat|Dog|Monkey|Penguin|Koala|Racoon|Shark|Dolphin|Cheetah|Leopard|Panther)$/i);
      if (!match) {
        this.showToast('⚠️ No animal found in your AI name', 'error');
        return;
      }
      
      const animalType = match[1];
      
      // Show loading animation
      document.getElementById('profileImageLoading').style.display = 'flex';
      document.querySelector('.loading-text').textContent = `Creating your ${animalType}...`;
      document.getElementById('profileImage').style.display = 'none';
      document.getElementById('profileImagePlaceholder').style.display = 'none';
      
      this.showToast(`🐾 Creating your funky ${animalType}...`, 'info');
      document.getElementById('generateAnimalBtn').disabled = true;
      document.getElementById('generateAnimalBtn').textContent = `⏳ Creating...`;

      const description = `${userName} - ${animalType} avatar`;
      const imageUrl = await pasteCraftSupabase.generateProfileImage(description, 'animal', aiGeneratedName);

      if (imageUrl) {
        // Hide loading, display generated image
        document.getElementById('profileImageLoading').style.display = 'none';
        document.getElementById('profileImage').src = imageUrl;
        document.getElementById('profileImage').style.display = 'block';
        document.getElementById('profileImagePlaceholder').style.display = 'none';
        
        // ✅ AUTO-SAVE TO STORAGE
        if (!this.userProfile) {
          this.userProfile = {};
        }
        this.userProfile.generatedImageUrl = imageUrl;
        this.userProfile.profileImageUrl = imageUrl; // Set as active profile image
        await this.saveUserProfile();
        console.log('✅ Animal avatar auto-saved to storage');
        
        // ✅ DISPLAY TOP-LEFT
        this.displayImageTopLeft(imageUrl);
        
        // ✅ AUTO-COLLAPSE SECTION
        setTimeout(() => this.autoCollapsePhotoSection(), 2000);
        
        const animalType = match[1];
        this.showToast(`✅ ${animalType} avatar created and saved!`, 'success');
      }
      
    } catch (error) {
      console.error('Failed to generate animal avatar:', error);
      document.getElementById('profileImageLoading').style.display = 'none';
      document.getElementById('profileImagePlaceholder').style.display = 'flex';
      this.showToast('❌ Failed to generate animal avatar', 'error');
    } finally {
      document.getElementById('generateAnimalBtn').disabled = false;
      document.getElementById('generateAnimalBtn').textContent = '🐾 Animal Avatar';
    }
  }
  
  async generateMyCartoon() {
    console.log('🎨 generateMyCartoon() CALLED!');
    try {
      const userName = document.getElementById('userName').value.trim();
      const userImageBase64 = this.userProfile?.profileImageBase64;
      
      if (!userName) {
        this.showToast('⚠️ Please enter your name first', 'error');
        return;
      }
      
      if (!userImageBase64) {
        this.showToast('⚠️ Please upload a photo first', 'error');
        return;
      }

      // Show loading animation
      document.getElementById('profileImageLoading').style.display = 'flex';
      document.querySelector('.loading-text').textContent = 'Creating your cartoon...';
      document.getElementById('profileImage').style.display = 'none';
      document.getElementById('profileImagePlaceholder').style.display = 'none';
      
      this.showToast('🎨 Creating your cartoon avatar...', 'info');
      document.getElementById('generateCartoonBtn').disabled = true;
      document.getElementById('generateCartoonBtn').textContent = '⏳ Creating...';

      const description = `${userName} - cartoon avatar`;
      const imageUrl = await pasteCraftSupabase.generateProfileImage(description, userImageBase64, null);

      if (imageUrl) {
        // Hide loading, display generated image
        document.getElementById('profileImageLoading').style.display = 'none';
        document.getElementById('profileImage').src = imageUrl;
        document.getElementById('profileImage').style.display = 'block';
        document.getElementById('profileImagePlaceholder').style.display = 'none';

        // ✅ AUTO-SAVE TO STORAGE
        if (!this.userProfile) {
          this.userProfile = {};
        }
        this.userProfile.profileImageUrl = imageUrl;
        this.userProfile.aiGeneratedImage = true;
        await this.saveUserProfile();
        console.log('✅ Cartoon image auto-saved to storage');
        
        // ✅ DISPLAY TOP-LEFT
        this.displayImageTopLeft(imageUrl);
        
        // ✅ AUTO-COLLAPSE SECTION
        setTimeout(() => this.autoCollapsePhotoSection(), 2000);
        
        if (userImageBase64) {
          this.showToast('✅ Your funky cartoon remix is ready and saved!', 'success');
        } else {
          this.showToast('✅ AI image generated and saved!', 'success');
        }
      } else {
        document.getElementById('profileImageLoading').style.display = 'none';
        document.getElementById('profileImagePlaceholder').style.display = 'flex';
        this.showToast('❌ Failed to generate AI image', 'error');
      }

    } catch (error) {
      console.error('Failed to generate AI profile image:', error);
      
      // Hide loading on error
      document.getElementById('profileImageLoading').style.display = 'none';
      document.getElementById('profileImagePlaceholder').style.display = 'flex';
      
      // Show more helpful error message
      const errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('quota') || errorMessage.includes('billing')) {
        this.showToast('❌ OpenAI API quota exceeded. Check your billing.', 'error');
      } else if (errorMessage.includes('invalid')) {
        this.showToast('❌ Invalid API key. Check config.js', 'error');
      } else {
        this.showToast(`❌ Error: ${errorMessage}`, 'error');
      }
    } finally {
      document.getElementById('generateCartoonBtn').disabled = false;
      document.getElementById('generateCartoonBtn').textContent = '🎨 My Cartoon';
    }
  }

  async generateAIName() {
    try {
      const userName = document.getElementById('userName').value.trim();
      
      if (!userName) {
        this.showToast('⚠️ Please enter your name first', 'error');
        return;
      }

      this.showToast('🎭 Generating funky AI name...', 'info');
      document.getElementById('generateNameBtn').disabled = true;
      document.getElementById('generateNameBtn').textContent = '⏳ Generating...';

      const aiName = await pasteCraftSupabase.generateAIName(userName);

      if (aiName) {
        // Display AI name
        document.getElementById('aiNameValue').textContent = aiName;
        document.getElementById('aiNameDisplay').style.display = 'flex';

        // Save to profile
        if (!this.userProfile) {
          this.userProfile = {};
        }
        this.userProfile.userName = userName;
        this.userProfile.aiGeneratedName = aiName; // Fixed: was aiName, now aiGeneratedName
        
        await this.saveUserProfile();
        
        // Update button states to enable Animal Avatar
        this.updateAIGenerateButtonState();
        
        this.showToast('✅ Funky name generated!', 'success');
      } else {
        this.showToast('❌ Failed to generate AI name', 'error');
      }

    } catch (error) {
      console.error('Failed to generate AI name:', error);
      this.showToast('❌ Failed to generate AI name', 'error');
    } finally {
      document.getElementById('generateNameBtn').disabled = false;
      document.getElementById('generateNameBtn').textContent = 'Generate AI Name';
    }
  }

  showUnsubscribeConfirmation() {
    if (confirm('⚠️ Are you sure you want to unsubscribe from PasteCraft?\n\nThis will:\n• Delete all your clips\n• Remove all categories\n• Clear your profile data\n• This action cannot be undone!')) {
      if (confirm('🚨 FINAL WARNING: This will permanently delete ALL your data. Continue?')) {
        this.handleUnsubscribe();
      }
    }
  }

  async handleUnsubscribe() {
    try {
      this.showToast('🗑️ Deleting all data...', 'info');

      // Clear all storage
      await chrome.storage.local.clear();

      // Clear in-memory data
      this.clips = [];
      this.searchOnlyClips = [];
      this.categories = [];
      this.userProfile = null;

      // Update UI
      this.renderChips();
      this.renderCategories();
      this.updateCategoryFilter();
      this.hideProfileModal();

      this.showToast('✅ All data deleted. You have been unsubscribed.', 'success');

      console.log('🗑️ User unsubscribed - all data cleared');

    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      this.showToast('❌ Failed to unsubscribe', 'error');
    }
  }

  // Display image in top-left corner
  displayImageTopLeft(imageUrl) {
    console.log('🖼️ displayImageTopLeft() called with URL:', imageUrl);
    const topLeftContainer = document.getElementById('topLeftProfileImage');
    const topLeftImg = document.getElementById('topLeftProfileImg');
    
    if (!topLeftContainer) {
      console.error('❌ CRITICAL: #topLeftProfileImage container not found in DOM!');
      return;
    }
    
    if (!topLeftImg) {
      console.error('❌ CRITICAL: #topLeftProfileImg element not found in DOM!');
      return;
    }
    
    if (topLeftContainer && topLeftImg) {
      topLeftImg.src = imageUrl;
      topLeftContainer.style.display = 'block';
      
      // Add click handler to open profile modal
      topLeftContainer.onclick = () => {
        this.showProfileModal();
      };
      
      console.log('✅ Profile image displayed successfully in top-left corner');
      console.log('✅ Container visibility:', topLeftContainer.style.display);
      console.log('✅ Image source set to:', topLeftImg.src);
    }
  }

  // Auto-collapse profile photo section after generation
  autoCollapsePhotoSection() {
    const content = document.getElementById('photoCreationContent');
    const toggleBtn = document.getElementById('photoToggleBtn');
    
    if (content && toggleBtn && !content.classList.contains('collapsed')) {
      // Collapse the section
      content.classList.add('collapsed');
      toggleBtn.classList.add('collapsed');
      toggleBtn.textContent = '▶';
      
      console.log('✅ Photo section auto-collapsed');
    }
  }

  // Password strength indicator
  updatePasswordStrength(password) {
    const strengthBar = document.querySelector('.strength-bar');
    if (!strengthBar) return;

    let strength = 0;
    
    // Length check
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    
    // Complexity checks
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 12.5;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 12.5;
    
    strengthBar.style.width = `${strength}%`;
    
    // Color based on strength
    if (strength < 40) {
      strengthBar.style.background = '#EF4444'; // Red
    } else if (strength < 70) {
      strengthBar.style.background = '#F59E0B'; // Orange
    } else {
      strengthBar.style.background = '#10B981'; // Green
    }
  }

  // Global message handler for background script
  static handleMessage(message) {
    if (message.action === 'showCategoryModal' && message.text) {
      // This will be called from background script
      const popup = window.pasteCraftPopup;
      if (popup) {
        popup.pendingText = message.text;
        popup.showCategoryModal(false);
      }
    }
  }
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Popup script loaded');
  try {
    window.pasteCraftPopup = new PasteCraftPopup();
  } catch (error) {
    console.error('❌ Popup initialization failed:', error);
    // Fallback simple interface
    document.body.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h2>📋 PasteCraft</h2>
        <div id="simpleClips"></div>
        <p style="color: #666; font-size: 12px;">Right-click selected text to save clips</p>
      </div>
    `;
    loadSimpleClips();
  }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  PasteCraftPopup.handleMessage(message);
  sendResponse(true);
});

async function loadSimpleClips() {
  const { clips = [] } = await chrome.storage.local.get(['clips']);
  const container = document.getElementById('simpleClips');
  
  if (clips.length === 0) {
    container.innerHTML = '<p style="color: #999;">No clips yet</p>';
    return;
  }
  
  clips.forEach((clip, index) => {
    const div = document.createElement('div');
    div.style.cssText = 'background: #f0f0f0; margin: 8px 0; padding: 8px; border-radius: 4px; cursor: pointer;';
    div.textContent = clip.text.substring(0, 50) + (clip.text.length > 50 ? '...' : '');
    div.onclick = async () => {
      await navigator.clipboard.writeText(clip.text);
      div.style.background = '#90EE90';
      setTimeout(() => div.style.background = '#f0f0f0', 500);
    };
    container.appendChild(div);
  });
}
