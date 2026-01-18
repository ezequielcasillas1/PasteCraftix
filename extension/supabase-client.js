// Supabase Client for PasteCraft
// This file initializes the Supabase client for the extension

class PasteCraftSupabase {
  constructor() {
    this.client = null;
    this.initialized = false;
    this.isOnline = navigator.onLine;
    this.syncQueue = [];
    this.realtimeChannels = [];
    this.syncStatus = 'synced'; // 'offline', 'syncing', 'synced'
    this.BATCH_SIZE = 100; // Number of clips per batch
    this.syncProgress = { current: 0, total: 0, percentage: 0 };
    this.init();
    this.setupConnectionMonitor();
  }
  
  async init() {
    try {
      if (typeof PASTECRAFT_CONFIG === 'undefined') {
        console.error('❌ Config not loaded. Make sure config.js is included before supabase-client.js');
        return;
      }
      
      // Check for placeholder API keys
      if (PASTECRAFT_CONFIG.supabase.anonKey.includes('YOUR_SUPABASE_ANON_KEY_HERE')) {
        console.warn('⚠️ Supabase key not configured - using placeholder');
        this.initialized = true; // Still mark as initialized for OpenAI-only features
        return;
      }
      
      // Check if Supabase is loaded from CDN
      if (typeof supabase === 'undefined' || !supabase.createClient) {
        console.warn('⚠️ Supabase library not loaded from CDN - Supabase features disabled, but OpenAI features will work');
        this.initialized = true; // Still mark as initialized for OpenAI-only features
        return;
      }
      
      // Initialize Supabase client
      this.client = supabase.createClient(
        PASTECRAFT_CONFIG.supabase.url,
        PASTECRAFT_CONFIG.supabase.anonKey
      );
      
      this.initialized = true;
      console.log('✅ Supabase client initialized');
      
      // Setup realtime subscriptions after initialization
      await this.setupRealtimeSubscriptions();
      
    } catch (error) {
      console.error('❌ Failed to initialize Supabase:', error);
      this.initialized = true; // Still allow OpenAI features to work
    }
  }
  
  // =====================================================
  // CONNECTION & OFFLINE MODE
  // =====================================================
  
  setupConnectionMonitor() {
    // Load sync queue from storage
    this.loadSyncQueue();
    
    // Monitor online/offline events
    window.addEventListener('online', () => {
      console.log('🟢 Connection restored');
      this.isOnline = true;
      this.updateSyncStatus('syncing');
      this.processSyncQueue();
    });
    
    window.addEventListener('offline', () => {
      console.log('🔴 Connection lost');
      this.isOnline = false;
      this.updateSyncStatus('offline');
    });
    
    // Initial status update
    this.updateSyncStatus(this.isOnline ? 'synced' : 'offline');
  }
  
  async loadSyncQueue() {
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['syncQueue'], resolve);
      });
      this.syncQueue = result.syncQueue || [];
      console.log(`📦 Loaded ${this.syncQueue.length} pending sync operations`);
      
      // Process queue if online
      if (this.isOnline && this.syncQueue.length > 0) {
        setTimeout(() => this.processSyncQueue(), 1000);
      }
    } catch (error) {
      console.error('❌ Failed to load sync queue:', error);
      this.syncQueue = [];
    }
  }
  
  async saveSyncQueue() {
    try {
      await new Promise((resolve) => {
        chrome.storage.local.set({ syncQueue: this.syncQueue }, resolve);
      });
    } catch (error) {
      console.error('❌ Failed to save sync queue:', error);
    }
  }
  
  async addToSyncQueue(operation) {
    this.syncQueue.push({
      ...operation,
      timestamp: Date.now(),
      id: Date.now() + Math.random()
    });
    await this.saveSyncQueue();
    console.log(`➕ Added to sync queue: ${operation.type} (${this.syncQueue.length} pending)`);
  }
  
  async processSyncQueue() {
    if (!this.isOnline || this.syncQueue.length === 0) {
      return;
    }
    
    console.log(`🔄 Processing ${this.syncQueue.length} queued operations...`);
    this.updateSyncStatus('syncing');
    
    const queue = [...this.syncQueue];
    this.syncQueue = [];
    
    for (const operation of queue) {
      try {
        await this.executeSyncOperation(operation);
        console.log(`✅ Processed: ${operation.type}`);
      } catch (error) {
        console.error(`❌ Failed to process ${operation.type}:`, error);
        // Re-queue failed operations
        this.syncQueue.push(operation);
      }
    }
    
    await this.saveSyncQueue();
    this.updateSyncStatus(this.syncQueue.length > 0 ? 'syncing' : 'synced');
    console.log(`✅ Queue processed. ${this.syncQueue.length} operations remaining.`);
  }
  
  async executeSyncOperation(operation) {
    switch (operation.type) {
      case 'syncClips':
        await this.syncClipsToSupabase(operation.data);
        break;
      case 'syncCategories':
        await this.syncCategoriesToSupabase(operation.data);
        break;
      case 'syncArchivedClips':
        await this.syncArchivedClipsToSupabase(operation.data);
        break;
      case 'syncSettings':
        await this.syncSettingsToSupabase(operation.data);
        break;
      case 'syncProfile':
        await this.syncUserProfileToSupabase(operation.data);
        break;
      default:
        console.warn('Unknown sync operation type:', operation.type);
    }
  }
  
  updateSyncStatus(status) {
    this.syncStatus = status;
    // Emit event for UI to update
    window.dispatchEvent(new CustomEvent('syncStatusChanged', { 
      detail: { status, queueLength: this.syncQueue.length } 
    }));
  }
  
  updateSyncProgress(current, total, percentage) {
    this.syncProgress = { current, total, percentage };
    // Emit event for UI progress bar
    window.dispatchEvent(new CustomEvent('syncProgress', {
      detail: { current, total, percentage }
    }));
  }
  
  async syncWithQueue(type, data, syncMethod) {
    if (!this.isOnline) {
      // Offline: add to queue
      await this.addToSyncQueue({ type, data });
      return false;
    }
    
    try {
      // Online: sync immediately
      this.updateSyncStatus('syncing');
      await syncMethod.call(this, data);
      this.updateSyncStatus('synced');
      return true;
    } catch (error) {
      console.error(`❌ Sync failed, adding to queue:`, error);
      await this.addToSyncQueue({ type, data });
      return false;
    }
  }
  
  // =====================================================
  // REALTIME SUBSCRIPTIONS
  // =====================================================
  
  async setupRealtimeSubscriptions() {
    if (!this.client || !this.isOnline) {
      console.warn('⚠️ Skipping realtime subscriptions - offline or not initialized');
      return;
    }
    
    try {
      console.log('🔔 Setting up realtime subscriptions...');
      const userId = await this.getSyncUserId();
      
      // Subscribe to clips changes
      const clipsChannel = this.client
        .channel('clips-changes')
        .on('postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'clips',
            filter: `user_id=eq.${userId}`
          },
          (payload) => this.handleClipsChange(payload)
        )
        .subscribe();
      
      // Subscribe to categories changes
      const categoriesChannel = this.client
        .channel('categories-changes')
        .on('postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'categories',
            filter: `user_id=eq.${userId}`
          },
          (payload) => this.handleCategoriesChange(payload)
        )
        .subscribe();
      
      // Subscribe to archived clips changes
      const archivedChannel = this.client
        .channel('archived-clips-changes')
        .on('postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'archived_clips',
            filter: `user_id=eq.${userId}`
          },
          (payload) => this.handleArchivedClipsChange(payload)
        )
        .subscribe();
      
      // Subscribe to settings changes
      const settingsChannel = this.client
        .channel('settings-changes')
        .on('postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'user_settings',
            filter: `user_id=eq.${userId}`
          },
          (payload) => this.handleSettingsChange(payload)
        )
        .subscribe();
      
      // Subscribe to profile changes
      const profileChannel = this.client
        .channel('profile-changes')
        .on('postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'user_profiles',
            filter: `user_id=eq.${userId}`
          },
          (payload) => this.handleProfileChange(payload)
        )
        .subscribe();
      
      this.realtimeChannels = [
        clipsChannel, 
        categoriesChannel, 
        archivedChannel, 
        settingsChannel, 
        profileChannel
      ];
      
      console.log('✅ Realtime subscriptions active');
    } catch (error) {
      console.error('❌ Failed to setup realtime subscriptions:', error);
    }
  }
  
  async handleClipsChange(payload) {
    console.log('🔔 Clips changed:', payload.eventType);
    
    // Refresh clips from Supabase
    const remoteClips = await this.syncClipsFromSupabase();
    if (remoteClips) {
      const localData = await new Promise((resolve) => {
        chrome.storage.local.get(['clips'], resolve);
      });
      const mergedClips = await this.mergeClips(localData.clips || [], remoteClips);
      await new Promise((resolve) => {
        chrome.storage.local.set({ clips: mergedClips }, resolve);
      });
      
      // Notify UI to refresh
      window.dispatchEvent(new CustomEvent('dataChanged', { 
        detail: { type: 'clips' } 
      }));
    }
  }
  
  async handleCategoriesChange(payload) {
    console.log('🔔 Categories changed:', payload.eventType);
    
    const remoteCategories = await this.syncCategoriesFromSupabase();
    if (remoteCategories) {
      const localData = await new Promise((resolve) => {
        chrome.storage.local.get(['categories'], resolve);
      });
      const mergedCategories = await this.mergeCategories(localData.categories || [], remoteCategories);
      await new Promise((resolve) => {
        chrome.storage.local.set({ categories: mergedCategories }, resolve);
      });
      
      window.dispatchEvent(new CustomEvent('dataChanged', { 
        detail: { type: 'categories' } 
      }));
    }
  }
  
  async handleArchivedClipsChange(payload) {
    console.log('🔔 Archived clips changed:', payload.eventType);
    
    const remoteArchivedClips = await this.syncArchivedClipsFromSupabase();
    if (remoteArchivedClips) {
      const localData = await new Promise((resolve) => {
        chrome.storage.local.get(['searchOnlyClips'], resolve);
      });
      const mergedArchivedClips = await this.mergeArchivedClips(localData.searchOnlyClips || [], remoteArchivedClips);
      await new Promise((resolve) => {
        chrome.storage.local.set({ searchOnlyClips: mergedArchivedClips }, resolve);
      });
      
      window.dispatchEvent(new CustomEvent('dataChanged', { 
        detail: { type: 'archivedClips' } 
      }));
    }
  }
  
  async handleSettingsChange(payload) {
    console.log('🔔 Settings changed:', payload.eventType);
    
    const remoteSettings = await this.syncSettingsFromSupabase();
    if (remoteSettings) {
      await new Promise((resolve) => {
        chrome.storage.local.set({ settings: remoteSettings }, resolve);
      });
      
      window.dispatchEvent(new CustomEvent('dataChanged', { 
        detail: { type: 'settings' } 
      }));
    }
  }
  
  async handleProfileChange(payload) {
    console.log('🔔 Profile changed:', payload.eventType);
    
    const remoteProfile = await this.syncUserProfileFromSupabase();
    if (remoteProfile) {
      await new Promise((resolve) => {
        chrome.storage.local.set({ userProfile: remoteProfile }, resolve);
      });
      
      window.dispatchEvent(new CustomEvent('dataChanged', { 
        detail: { type: 'profile' } 
      }));
    }
  }
  
  unsubscribeAll() {
    this.realtimeChannels.forEach(channel => {
      this.client.removeChannel(channel);
    });
    this.realtimeChannels = [];
    console.log('🔕 All realtime subscriptions removed');
  }
  
  // User Profile Methods
  async getUserProfile(userId) {
    if (!this.initialized) {
      console.error('❌ Supabase not initialized');
      return null;
    }
    
    try {
      const { data, error } = await this.client
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return null;
    }
  }
  
  async createUserProfile(profileData) {
    if (!this.initialized) {
      console.error('❌ Supabase not initialized');
      return null;
    }
    
    try {
      const { data, error } = await this.client
        .from('user_profiles')
        .insert([profileData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to create user profile:', error);
      return null;
    }
  }
  
  async updateUserProfile(userId, updates) {
    if (!this.initialized) {
      console.error('❌ Supabase not initialized');
      return null;
    }
    
    try {
      const { data, error } = await this.client
        .from('user_profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to update user profile:', error);
      return null;
    }
  }
  
  async uploadProfileImage(userId, imageFile) {
    if (!this.initialized) {
      console.error('❌ Supabase not initialized');
      return null;
    }
    
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `profile-images/${fileName}`;
      
      const { data, error } = await this.client.storage
        .from('profile-images')
        .upload(filePath, imageFile);
      
      if (error) throw error;
      
      // Get public URL
      const { data: urlData } = this.client.storage
        .from('profile-images')
        .getPublicUrl(filePath);
      
      return urlData.publicUrl;
    } catch (error) {
      console.error('Failed to upload profile image:', error);
      return null;
    }
  }
  
  /**
   * Download image from temporary URL and upload to Supabase Storage
   * @param {string} imageUrl - Temporary image URL (e.g., from OpenAI DALL-E)
   * @param {string} userId - User identifier for storage path
   * @returns {string} Permanent Supabase Storage URL
   */
  async downloadAndUploadImage(imageUrl, userId) {
    if (!this.initialized || !this.client) {
      console.warn('⚠️ Supabase not initialized - returning original URL');
      return imageUrl; // Fallback to original URL if Supabase not available
    }
    
    try {
      console.log('📥 Downloading image from temporary URL:', imageUrl);
      
      // Download image as blob
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log('✅ Image downloaded, size:', blob.size, 'bytes');
      
      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `${userId}-${timestamp}.png`;
      const filePath = `${fileName}`;
      
      console.log('📤 Uploading to Supabase Storage:', filePath);
      
      // Upload to Supabase Storage
      const { data, error } = await this.client.storage
        .from('profile-images')
        .upload(filePath, blob, {
          contentType: 'image/png',
          upsert: false
        });
      
      if (error) {
        console.error('❌ Upload error:', error);
        throw error;
      }
      
      console.log('✅ Upload successful:', data);
      
      // Get permanent public URL
      const { data: urlData } = this.client.storage
        .from('profile-images')
        .getPublicUrl(filePath);
      
      console.log('✅ Permanent URL obtained:', urlData.publicUrl);
      return urlData.publicUrl;
      
    } catch (error) {
      console.error('❌ Failed to convert temporary URL to permanent:', error);
      console.warn('⚠️ Returning original temporary URL as fallback');
      return imageUrl; // Return original URL as fallback
    }
  }
  
  // OpenAI Integration Methods
  async generateAIName(userName) {
    try {
      const response = await fetch(`${PASTECRAFT_CONFIG.supabase.url}/functions/v1/generate-ai-name`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PASTECRAFT_CONFIG.supabase.anonKey}`
        },
        body: JSON.stringify({ userName })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'AI name generation failed');
      }
      
      const data = await response.json();
      console.log('✅ Generated AI name:', data.aiName);
      return data.aiName;
      
    } catch (error) {
      console.error('Failed to generate AI name:', error);
      return null;
    }
  }
  
  async analyzePhotoWithVision(imageBase64) {
    try {
      if (typeof PASTECRAFT_CONFIG === 'undefined' || !PASTECRAFT_CONFIG.openai.apiKey || PASTECRAFT_CONFIG.openai.apiKey.includes('YOUR_OPENAI_API_KEY_HERE')) {
        console.error('❌ OpenAI API key not configured');
        throw new Error('OpenAI API key not configured.');
      }

      console.log('🔍 Analyzing photo with GPT-4 Vision...');
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PASTECRAFT_CONFIG.openai.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Describe this person in detail for creating a cartoon avatar. Focus on: face shape, hair style and color, eye color, glasses/facial hair if any, skin tone, distinctive features, and overall vibe. Be specific and descriptive. Keep it under 100 words.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageBase64
                  }
                }
              ]
            }
          ],
          max_tokens: 200
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Vision API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const description = data.choices[0].message.content;
      console.log('✅ Photo analysis complete:', description);
      return description;

    } catch (error) {
      console.error('Failed to analyze photo:', error);
      throw error;
    }
  }

  async breakdownText(text, level = 'child') {
    try {
      console.log(`🧠 Breaking down text at ${level} level...`);

      const response = await fetch(`${PASTECRAFT_CONFIG.supabase.url}/functions/v1/explain-at-level`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PASTECRAFT_CONFIG.supabase.anonKey}`
        },
        body: JSON.stringify({ text, level })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Breakdown failed');
      }

      const data = await response.json();
      console.log('✅ Text breakdown complete');
      return data.breakdown;

    } catch (error) {
      console.error('Failed to breakdown text:', error);
      throw error;
    }
  }

  async generateSummaryQuestions(text) {
    try {
      console.log('🤔 Generating summary questions...');

      const response = await fetch(`${PASTECRAFT_CONFIG.supabase.url}/functions/v1/summarize-or-qa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PASTECRAFT_CONFIG.supabase.anonKey}`
        },
        body: JSON.stringify({ text: text.substring(0, 3000), generateQuestions: true })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate questions');
      }

      const data = await response.json();
      console.log('✅ Generated', data.questions.length, 'questions');
      return data.questions;

    } catch (error) {
      console.error('Failed to generate questions:', error);
      throw error;
    }
  }

  async generateSummary(text, question) {
    try {
      console.log('📝 Generating summary for question:', question);

      const response = await fetch(`${PASTECRAFT_CONFIG.supabase.url}/functions/v1/summarize-or-qa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PASTECRAFT_CONFIG.supabase.anonKey}`
        },
        body: JSON.stringify({ text, question })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate summary');
      }

      const data = await response.json();
      console.log('✅ Summary generated');
      return data.summary;

    } catch (error) {
      console.error('Failed to generate summary:', error);
      throw error;
    }
  }

  async generateProfileImage(description, userImageBase64 = null, aiGeneratedName = null) {
    try {
      let requestBody = {};
      
      // Extract animal type from aiGeneratedName if provided
      let animalType = null;
      if (aiGeneratedName) {
        const animalMatch = aiGeneratedName.match(/(Rabbit|Tiger|Dragon|Fox|Wolf|Bear|Panda|Lion|Eagle|Phoenix|Unicorn|Owl|Cat|Dog|Monkey|Penguin|Koala|Racoon|Shark|Dolphin|Cheetah|Leopard|Panther|Otter|Lynx|Jaguar|Cougar|Sloth|Badger|Moose|Bison|Rhino|Elephant|Giraffe|Zebra|Kangaroo|Platypus|Hamster|Ferret|Squirrel|Chipmunk|Hawk|Falcon|Raven|Crow|Parrot|Toucan|Flamingo|Peacock|Swan|Hummingbird|Octopus|Whale|Orca|Seal|Walrus|Seahorse|Stingray|Snake|Gecko|Chameleon|Turtle|Crocodile|Alligator|Griffin|Hydra|Pegasus|Kraken)$/i);
        if (animalMatch) {
          animalType = animalMatch[1];
        }
      }

      // Check if this is an animal avatar request (explicit 'animal' flag OR just aiGeneratedName with animal)
      if ((userImageBase64 === 'animal' && aiGeneratedName) || (!userImageBase64 && animalType)) {
        console.log(`🐾 Creating ${animalType} avatar from AI name...`);
        requestBody = { type: 'animal', animalType };
      }
      // If user uploaded a photo, create cartoon from it
      else if (userImageBase64 && userImageBase64 !== 'animal') {
        console.log('📸 Creating cartoon from uploaded photo...');
        requestBody = { type: 'cartoon', imageBase64: userImageBase64 };
      }
      // Fallback to generic prompt
      else if (description) {
        console.log('🎨 Creating image from description...');
        requestBody = { prompt: `Create a single funky cartoon avatar portrait. Style: vibrant, colorful, modern cartoon art with bold outlines. Show only ONE person, centered, portrait style. Theme: ${description}` };
      } else {
        throw new Error('No valid input provided for image generation. Please provide a description, photo, or AI name with animal.');
      }

      const response = await fetch(`${PASTECRAFT_CONFIG.supabase.url}/functions/v1/avatar-generator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PASTECRAFT_CONFIG.supabase.anonKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Image generation failed');
      }

      const data = await response.json();
      const temporaryImageUrl = data.imageUrl;
      console.log('✅ Image generated! Converting to permanent URL...');

      // Convert temporary URL to permanent Supabase Storage URL
      const userId = await this.getSyncUserId();
      const permanentImageUrl = await this.downloadAndUploadImage(temporaryImageUrl, userId);

      return permanentImageUrl;

    } catch (error) {
      console.error('Failed to generate profile image:', error);
      throw error;
    }
  }

  // =====================================================
  // REAL-TIME DATA SYNC METHODS
  // =====================================================

  /**
   * Get Chrome user ID for syncing
   */
  async getChromeUserId() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['chromeUserId'], (result) => {
        if (result.chromeUserId) {
          resolve(result.chromeUserId);
        } else {
          // Generate new user ID
          const newUserId = `chrome_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          chrome.storage.local.set({ chromeUserId: newUserId }, () => {
            resolve(newUserId);
          });
        }
      });
    });
  }

  /**
   * Get a stable user id for cloud sync.
   * - Prefer a stored cross-device id in chrome.storage.sync (if browser sync is enabled)
   * - Otherwise fall back to existing chrome.storage.local chromeUserId (legacy behavior)
   * - If neither exists: generate a new id (if authed, derive from auth UUID; else random chrome_*)
   *
   * This preserves legacy cloud data (keyed by chromeUserId) while allowing new devices
   * to recover the same id via chrome.storage.sync once at least one device writes it.
   */
  async getSyncUserId() {
    // If authenticated, always use auth user UUID as the stable cross-device sync key.
    // If this device has legacy data keyed by chromeUserId, we can migrate it to auth id here.
    let authUserId = null;
    if (this.client) {
      try {
        const { data: { session } } = await this.client.auth.getSession();
        authUserId = session?.user?.id || null;
      } catch (_) {}
    }

    if (authUserId) {
      // If the user previously synced using a different (legacy) id on this same device,
      // migrate its remote data to the auth id once.
      let localChromeUserId = null;
      try {
        const localResult = await new Promise((resolve) => chrome.storage.local.get(['chromeUserId'], resolve));
        localChromeUserId = localResult?.chromeUserId || null;
      } catch (_) {}

      // Persist the stable id for other devices (browser sync)
      try { await new Promise((resolve) => chrome.storage.sync.set({ accountUserId: authUserId }, resolve)); } catch (_) {}
      try { await new Promise((resolve) => chrome.storage.local.set({ chromeUserId: authUserId }, resolve)); } catch (_) {}

      // Migrate legacy remote clips if we have a different legacy id available
      if (localChromeUserId && localChromeUserId !== authUserId) {
        try {
          const legacyRemote = await this.syncClipsFromSupabase(localChromeUserId);
          if (legacyRemote && legacyRemote.length > 0) {
            await this.syncClipsToSupabaseForUser(legacyRemote, authUserId);
          }
        } catch (_) {
          // Best-effort migration only
        }
      }

      await this.ensureUserProfileRow(authUserId);
      return authUserId;
    }

    // Not authenticated: fall back to any stored accountUserId (sync) or legacy local chromeUserId
    let syncStoredId = null;
    try {
      const syncResult = await new Promise((resolve) => chrome.storage.sync.get(['accountUserId'], resolve));
      syncStoredId = syncResult?.accountUserId || null;
    } catch (_) {}

    if (syncStoredId) {
      await this.ensureUserProfileRow(syncStoredId);
      return syncStoredId;
    }

    const chromeUserId = await this.getChromeUserId();
    await this.ensureUserProfileRow(chromeUserId);
    return chromeUserId;
  }

  async ensureUserProfileRow(userId) {
    if (!this.client) return;
    try {
      await this.setUserContext(userId);
      await this.client
        .from('user_profiles')
        .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: false });
    } catch (_) {
      // Don't block sync if profile row can't be ensured
    }
  }

  /**
   * Set RLS context for user
   */
  async setUserContext(userId) {
    if (!this.client) return;
    
    try {
      await this.client.rpc('set_config', {
        setting: 'app.current_user_id',
        value: userId
      });
      console.log('✅ User context set:', userId);
    } catch (error) {
      console.warn('⚠️ Could not set user context (RLS may not be configured):', error.message);
    }
  }

  // =====================================================
  // CLIPS SYNC METHODS
  // =====================================================

  /**
   * Sync local clips to Supabase (with batch support for large datasets)
   */
  async syncClipsToSupabase(localClips) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping clip sync');
      return false;
    }

    try {
      const userId = await this.getSyncUserId();
      await this.setUserContext(userId);
      await this.ensureUserProfileRow(userId);

      const totalClips = Array.isArray(localClips) ? localClips.length : 0;
      console.log(`📤 Syncing ${totalClips} clips to Supabase...`);

      // Use batch processing for large datasets (>100 clips)
      if (totalClips > this.BATCH_SIZE) {
        const ok = await this.syncClipsToSupabaseBatch(localClips, userId);
        if (ok) {
          await this.deleteRemoteClipsNotInLocal(localClips, userId);
        }
        return ok;
      }

      // Standard sync for small datasets
      const dbClips = this.buildDbClipsForUpsert(localClips, userId);
      const stats = dbClips && dbClips._pcStats ? dbClips._pcStats : null;

      const { data, error } = await this.client
        .from('clips')
        .upsert(dbClips, {
          onConflict: 'user_id,clip_id',
          ignoreDuplicates: false
        })
        .select();

      if (error) throw error;

      console.log(`✅ Synced ${data.length} clips to Supabase`);
      await this.deleteRemoteClipsNotInLocal(localClips, userId);
      return true;
    } catch (error) {
      console.error('❌ Failed to sync clips to Supabase:', error);
      return false;
    }
  }

  async deleteRemoteClipsNotInLocal(localClips, userId) {
    if (!this.client) return;

    try {
      const dbClips = this.buildDbClipsForUpsert(localClips, userId);
      const keepIds = new Set((Array.isArray(dbClips) ? dbClips : []).map(x => x?.clip_id).filter(Boolean));

      // Fetch all remote clip ids (paged)
      const remoteIds = [];
      const pageSize = 10000;
      for (let from = 0; ; from += pageSize) {
        const to = from + pageSize - 1;
        const { data, error } = await this.client
          .from('clips')
          .select('clip_id')
          .eq('user_id', userId)
          .range(from, to);

        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        rows.forEach(r => { if (r?.clip_id != null) remoteIds.push(String(r.clip_id)); });
        if (rows.length < pageSize) break;
      }

      const idsToDelete = remoteIds.filter(id => !keepIds.has(id));

      if (idsToDelete.length === 0) return;

      // Delete in manageable batches
      const batchSize = 200;
      for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize);
        const { error } = await this.client
          .from('clips')
          .delete()
          .eq('user_id', userId)
          .in('clip_id', batch);
        if (error) throw error;
      }
    } catch (e) {
      // Don't block user flows if remote cleanup fails
      console.warn('⚠️ Remote clip cleanup failed:', e?.message || e);
    }
  }

  /**
   * Sync local clips to Supabase for a specific userId (used for legacy→auth migration).
   */
  async syncClipsToSupabaseForUser(localClips, userId) {
    if (!this.client) return false;
    try {
      await this.setUserContext(userId);
      await this.ensureUserProfileRow(userId);

      const dbClips = this.buildDbClipsForUpsert(localClips, userId);

      const { error } = await this.client
        .from('clips')
        .upsert(dbClips, { onConflict: 'user_id,clip_id', ignoreDuplicates: false });

      if (error) throw error;
      return true;
    } catch (_) {
      return false;
    }
  }

  buildDbClipsForUpsert(localClips, userId) {
    const arr = Array.isArray(localClips) ? localClips : [];

    // Stable-ish hash for legacy clips without ids (avoid undefined clip_id collisions)
    const hash = (s) => {
      const str = String(s || '');
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return (h >>> 0).toString(36);
    };

    const seen = new Map(); // clip_id -> dbClip (keep newest)
    const dupCounter = new Map(); // baseId -> count
    let droppedNoText = 0;
    let droppedInvalid = 0;
    let inferredIds = 0;

    for (let i = 0; i < arr.length; i++) {
      const clip = arr[i];
      const text = typeof clip === 'string' ? clip : (clip?.text ?? clip);
      if (!text) { droppedNoText++; continue; }

      const ts = typeof clip === 'object' && clip ? (clip.timestamp ?? null) : null;
      const rawId =
        (typeof clip === 'object' && clip ? (clip.id ?? clip.clip_id ?? clip.clipId ?? null) : null) ??
        `legacy_${hash(text)}_${Number.isFinite(ts) ? ts : 0}`;
      if (!(typeof clip === 'object' && clip && (clip.id ?? clip.clip_id ?? clip.clipId))) inferredIds++;

      const baseId = String(rawId);
      const count = (dupCounter.get(baseId) || 0) + 1;
      dupCounter.set(baseId, count);
      const clipId = count === 1 ? baseId : `${baseId}__dup${count}`;

      const db = {
        user_id: userId,
        clip_id: clipId,
        text: String(text),
        category: (typeof clip === 'object' && clip && clip.category) ? clip.category : 'Uncategorized',
        timestamp: Number.isFinite(ts) ? ts : Date.now()
      };

      const existing = seen.get(clipId);
      if (!existing || (db.timestamp || 0) > (existing.timestamp || 0)) {
        seen.set(clipId, db);
      }
    }

    const out = Array.from(seen.values());
    out._pcStats = { inputCount: arr.length, outCount: out.length, droppedNoText, droppedInvalid, inferredIds };
    return out;
  }

  /**
   * Batch sync clips to Supabase (for large datasets)
   */
  async syncClipsToSupabaseBatch(localClips, userId) {
    const totalClips = localClips.length;
    const batches = Math.ceil(totalClips / this.BATCH_SIZE);
    let syncedCount = 0;

    console.log(`📦 Using batch sync: ${batches} batches of ${this.BATCH_SIZE} clips`);

    // Reset progress
    this.updateSyncProgress(0, totalClips, 0);

    for (let i = 0; i < batches; i++) {
      const start = i * this.BATCH_SIZE;
      const end = Math.min(start + this.BATCH_SIZE, totalClips);
      const batchClips = localClips.slice(start, end);

      // Transform to DB format (and dedupe/normalize ids)
      const dbClips = this.buildDbClipsForUpsert(batchClips, userId);

      try {
        const { data, error } = await this.client
          .from('clips')
          .upsert(dbClips, {
            onConflict: 'user_id,clip_id',
            ignoreDuplicates: false
          })
          .select();

        if (error) throw error;

        syncedCount += data.length;
        const percentage = Math.round((syncedCount / totalClips) * 100);
        
        // Update progress
        this.updateSyncProgress(syncedCount, totalClips, percentage);
        console.log(`📤 Batch ${i + 1}/${batches}: Synced ${syncedCount}/${totalClips} clips (${percentage}%)`);

      } catch (error) {
        console.error(`❌ Batch ${i + 1} failed:`, error);
        throw error;
      }
    }

    console.log(`✅ Batch sync complete: ${syncedCount} clips synced`);
    return true;
  }

  /**
   * Sync clips from Supabase to local storage (with batch support for large datasets)
   */
  async syncClipsFromSupabase(userIdOverride = null) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping clip sync');
      return null;
    }

    try {
      const userId = userIdOverride || await this.getSyncUserId();
      await this.setUserContext(userId);

      console.log('📥 Fetching clips from Supabase...');

      // First, get total count
      const { count, error: countError } = await this.client
        .from('clips')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) throw countError;

      const totalClips = count || 0;
      console.log(`📊 Total clips to fetch: ${totalClips}`);

      // Use batch fetching for large datasets (>100 clips)
      if (totalClips > this.BATCH_SIZE) {
        return await this.syncClipsFromSupabaseBatch(userId, totalClips);
      }

      // Standard fetch for small datasets
      const { data, error } = await this.client
        .from('clips')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Transform DB format to local format
      const localClips = data.map(clip => ({
        id: clip.clip_id,
        text: clip.text,
        category: clip.category,
        timestamp: clip.timestamp
      }));

      console.log(`✅ Fetched ${localClips.length} clips from Supabase`);
      return localClips;
    } catch (error) {
      console.error('❌ Failed to fetch clips from Supabase:', error);
      return null;
    }
  }

  /**
   * Batch fetch clips from Supabase (for large datasets)
   */
  async syncClipsFromSupabaseBatch(userId, totalClips) {
    const batches = Math.ceil(totalClips / this.BATCH_SIZE);
    let allClips = [];
    let fetchedCount = 0;

    console.log(`📦 Using batch fetch: ${batches} batches of ${this.BATCH_SIZE} clips`);

    // Reset progress
    this.updateSyncProgress(0, totalClips, 0);

    for (let i = 0; i < batches; i++) {
      const start = i * this.BATCH_SIZE;
      const end = start + this.BATCH_SIZE - 1;

      try {
        const { data, error } = await this.client
          .from('clips')
          .select('*')
          .eq('user_id', userId)
          .order('timestamp', { ascending: false })
          .range(start, end);

        if (error) throw error;

        // Transform DB format to local format
        const localClips = data.map(clip => ({
          id: clip.clip_id,
          text: clip.text,
          category: clip.category,
          timestamp: clip.timestamp
        }));

        allClips = allClips.concat(localClips);
        fetchedCount += localClips.length;
        const percentage = Math.round((fetchedCount / totalClips) * 100);

        // Update progress
        this.updateSyncProgress(fetchedCount, totalClips, percentage);
        console.log(`📥 Batch ${i + 1}/${batches}: Fetched ${fetchedCount}/${totalClips} clips (${percentage}%)`);

      } catch (error) {
        console.error(`❌ Batch ${i + 1} failed:`, error);
        throw error;
      }
    }

    console.log(`✅ Batch fetch complete: ${allClips.length} clips fetched`);
    return allClips;
  }

  /**
   * Merge local and remote clips (newest wins)
   */
  async mergeClips(localClips, remoteClips) {
    const contentMerged = new Map();

    const hashText = (t) => {
      const s = String(t || '');
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      return (h >>> 0).toString(36);
    };

    const contentKey = (clip) => {
      if (!clip) return '';
      const text = String(clip.text || '');
      const ts = typeof clip.timestamp === 'number' ? clip.timestamp : 0;
      const bucket = Math.floor(ts / 3000); // 3s bucket to collapse accidental dupes
      const cat = clip.category != null ? String(clip.category) : '';
      return `${hashText(text)}:${bucket}:${cat}`;
    };

    const add = (clip) => {
      if (!clip || !clip.text) return;
      const k = contentKey(clip);
      const prev = contentMerged.get(k);
      if (!prev || (clip.timestamp || 0) > (prev.timestamp || 0)) {
        contentMerged.set(k, clip);
      }
    };

    localClips.forEach(add);
    remoteClips.forEach(add);

    return Array.from(contentMerged.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }

  /**
   * Merge local and remote categories (newest wins by ID)
   */
  async mergeCategories(localCategories, remoteCategories) {
    const merged = new Map();

    // Add all local categories
    localCategories.forEach(cat => {
      merged.set(cat.id, cat);
    });

    // Add/update with remote categories (newer ID wins - later creation)
    remoteCategories.forEach(remoteCat => {
      const localCat = merged.get(remoteCat.id);
      if (!localCat) {
        // New category from remote, add it
        merged.set(remoteCat.id, remoteCat);
      }
      // If exists locally, keep local (categories don't update after creation)
    });

    // Sort by name for consistent display
    return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Merge local and remote archived clips (newest wins)
   */
  async mergeArchivedClips(localArchivedClips, remoteArchivedClips) {
    const contentMerged = new Map();

    const hashText = (t) => {
      const s = String(t || '');
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      return (h >>> 0).toString(36);
    };

    const contentKey = (clip) => {
      if (!clip) return '';
      const text = String(clip.text || '');
      const ts = typeof clip.timestamp === 'number' ? clip.timestamp : 0;
      const bucket = Math.floor(ts / 3000);
      const cat = clip.category != null ? String(clip.category) : '';
      return `${hashText(text)}:${bucket}:${cat}`;
    };

    const add = (clip) => {
      if (!clip || !clip.text) return;
      const k = contentKey(clip);
      const prev = contentMerged.get(k);
      if (!prev || (clip.timestamp || 0) > (prev.timestamp || 0)) {
        contentMerged.set(k, clip);
      }
    };

    localArchivedClips.forEach(add);
    remoteArchivedClips.forEach(add);

    // Sort by timestamp descending, then limit to 1000 most recent
    const sortedClips = Array.from(contentMerged.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return sortedClips.slice(0, 1000); // Keep only 1000 most recent locally
  }

  // =====================================================
  // CATEGORIES SYNC METHODS
  // =====================================================

  /**
   * Sync categories to Supabase
   */
  async syncCategoriesToSupabase(localCategories) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping category sync');
      return false;
    }

    try {
      const userId = await this.getSyncUserId();
      await this.setUserContext(userId);

      console.log(`📤 Syncing ${localCategories.length} categories to Supabase...`);

      const dbCategories = localCategories.map(cat => ({
        user_id: userId,
        category_id: cat.id,
        name: cat.name,
        icon: cat.icon || '📁'
      }));

      const { data, error } = await this.client
        .from('categories')
        .upsert(dbCategories, {
          onConflict: 'user_id,category_id',
          ignoreDuplicates: false
        })
        .select();

      if (error) throw error;

      console.log(`✅ Synced ${data.length} categories to Supabase`);
      return true;
    } catch (error) {
      console.error('❌ Failed to sync categories to Supabase:', error);
      return false;
    }
  }

  /**
   * Sync categories from Supabase
   */
  async syncCategoriesFromSupabase() {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping category sync');
      return null;
    }

    try {
      const userId = await this.getSyncUserId();
      await this.setUserContext(userId);

      console.log('📥 Fetching categories from Supabase...');

      const { data, error } = await this.client
        .from('categories')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const localCategories = data.map(cat => ({
        id: cat.category_id,
        name: cat.name,
        icon: cat.icon
      }));

      console.log(`✅ Fetched ${localCategories.length} categories from Supabase`);
      return localCategories;
    } catch (error) {
      console.error('❌ Failed to fetch categories from Supabase:', error);
      return null;
    }
  }

  // =====================================================
  // ARCHIVED CLIPS SYNC METHODS
  // =====================================================

  /**
   * Sync archived clips (searchOnlyClips) to Supabase
   */
  async syncArchivedClipsToSupabase(localArchivedClips) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping archived clips sync');
      return false;
    }

    try {
      const userId = await this.getSyncUserId();
      await this.setUserContext(userId);

      console.log(`📤 Syncing ${localArchivedClips.length} archived clips to Supabase...`);

      // Transform local archived clips to DB format (and dedupe/normalize ids)
      const dbArchivedClips = this.buildDbClipsForUpsert(localArchivedClips, userId);

      // Upsert archived clips (insert or update on conflict)
      const { data, error } = await this.client
        .from('archived_clips')
        .upsert(dbArchivedClips, {
          onConflict: 'user_id,clip_id',
          ignoreDuplicates: false
        })
        .select();

      if (error) throw error;

      console.log(`✅ Synced ${data.length} archived clips to Supabase`);
      return true;
    } catch (error) {
      console.error('❌ Failed to sync archived clips to Supabase:', error);
      return false;
    }
  }

  /**
   * Sync archived clips from Supabase to local storage
   */
  async syncArchivedClipsFromSupabase() {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping archived clips sync');
      return null;
    }

    try {
      const userId = await this.getSyncUserId();
      await this.setUserContext(userId);

      console.log('📥 Fetching archived clips from Supabase...');

      // Fetch all archived clips (unlimited cloud storage)
      const { data, error } = await this.client
        .from('archived_clips')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(100000); // Effectively unlimited - high limit for pagination

      if (error) throw error;

      // Transform DB format to local format
      const localArchivedClips = data.map(clip => ({
        id: clip.clip_id,
        text: clip.text,
        category: clip.category,
        timestamp: clip.timestamp
      }));

      console.log(`✅ Fetched ${localArchivedClips.length} archived clips from Supabase`);
      return localArchivedClips;
    } catch (error) {
      console.error('❌ Failed to fetch archived clips from Supabase:', error);
      return null;
    }
  }

  // =====================================================
  // SETTINGS SYNC METHODS
  // =====================================================

  /**
   * Sync settings to Supabase
   */
  async syncSettingsToSupabase(localSettings) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping settings sync');
      return false;
    }

    try {
      const userId = await this.getSyncUserId();
      await this.setUserContext(userId);

      console.log('📤 Syncing settings to Supabase...');

      const dbSettings = {
        user_id: userId,
        auto_delete_period: localSettings.autoDeletePeriod || 'never',
        theme: localSettings.theme || 'light',
        auto_hide: localSettings.autoHide !== false,
        show_timestamps: localSettings.showTimestamps !== false,
        max_clips_display: localSettings.maxClipsDisplay || 20,
        delimiter: localSettings.delimiter || 'comma',
        custom_delimiter: localSettings.customDelimiter || ', ',
        deduplicate: localSettings.deduplicate || false,
        sort: localSettings.sort || false,
        uppercase: localSettings.uppercase || false
      };

      const { data, error } = await this.client
        .from('settings')
        .upsert(dbSettings, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })
        .select();

      if (error) throw error;

      console.log('✅ Settings synced to Supabase');
      return true;
    } catch (error) {
      console.error('❌ Failed to sync settings to Supabase:', error);
      return false;
    }
  }

  /**
   * Sync settings from Supabase
   */
  async syncSettingsFromSupabase() {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping settings sync');
      return null;
    }

    try {
      const userId = await this.getSyncUserId();
      await this.setUserContext(userId);

      console.log('📥 Fetching settings from Supabase...');

      const { data, error } = await this.client
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('ℹ️ No settings found in Supabase (first sync)');
          return null;
        }
        throw error;
      }

      const localSettings = {
        autoDeletePeriod: data.auto_delete_period,
        theme: data.theme,
        autoHide: data.auto_hide,
        showTimestamps: data.show_timestamps,
        maxClipsDisplay: data.max_clips_display,
        delimiter: data.delimiter,
        customDelimiter: data.custom_delimiter,
        deduplicate: data.deduplicate,
        sort: data.sort,
        uppercase: data.uppercase
      };

      console.log('✅ Fetched settings from Supabase');
      return localSettings;
    } catch (error) {
      console.error('❌ Failed to fetch settings from Supabase:', error);
      return null;
    }
  }

  // =====================================================
  // USER PROFILE SYNC METHODS
  // =====================================================

  /**
   * Sync user profile to Supabase
   */
  async syncUserProfileToSupabase(localProfile) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping profile sync');
      return false;
    }

    try {
      const userId = await this.getSyncUserId();
      await this.setUserContext(userId);

      console.log('📤 Syncing user profile to Supabase...');

      const dbProfile = {
        user_id: userId,
        user_name: localProfile.userName || null,
        ai_generated_name: localProfile.aiGeneratedName || null,
        profile_image_url: localProfile.profileImageUrl || null,
        profile_image_base64: localProfile.profileImageBase64 || null,
        generated_image_url: localProfile.generatedImageUrl || null,
        ai_generated_image: localProfile.aiGeneratedImage || false
      };

      const { data, error } = await this.client
        .from('user_profiles')
        .upsert(dbProfile, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })
        .select();

      if (error) throw error;

      console.log('✅ User profile synced to Supabase');
      return true;
    } catch (error) {
      console.error('❌ Failed to sync user profile to Supabase:', error);
      return false;
    }
  }

  /**
   * Sync user profile from Supabase
   */
  async syncUserProfileFromSupabase() {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping profile sync');
      return null;
    }

    try {
      const userId = await this.getSyncUserId();
      await this.setUserContext(userId);

      console.log('📥 Fetching user profile from Supabase...');

      const { data, error } = await this.client
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('ℹ️ No profile found in Supabase (first sync)');
          return null;
        }
        throw error;
      }

      const localProfile = {
        userName: data.user_name,
        aiGeneratedName: data.ai_generated_name,
        profileImageUrl: data.profile_image_url,
        profileImageBase64: data.profile_image_base64,
        generatedImageUrl: data.generated_image_url,
        aiGeneratedImage: data.ai_generated_image
      };

      console.log('✅ Fetched user profile from Supabase');
      return localProfile;
    } catch (error) {
      console.error('❌ Failed to fetch user profile from Supabase:', error);
      return null;
    }
  }

  // =====================================================
  // REALTIME SUBSCRIPTIONS
  // =====================================================

  /**
   * Subscribe to real-time clip changes
   */
  subscribeToClipChanges(callback) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - cannot subscribe to realtime');
      return null;
    }

    const channel = this.client
      .channel('clips-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'clips' }, 
        (payload) => {
          console.log('🔔 Realtime clip change:', payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    return channel;
  }

  /**
   * Subscribe to real-time category changes
   */
  subscribeToCategoryChanges(callback) {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - cannot subscribe to realtime');
      return null;
    }

    const channel = this.client
      .channel('categories-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'categories' }, 
        (payload) => {
          console.log('🔔 Realtime category change:', payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    return channel;
  }

  /**
   * Unsubscribe from channel
   */
  unsubscribe(channel) {
    if (channel) {
      this.client.removeChannel(channel);
      console.log('🔇 Unsubscribed from realtime channel');
    }
  }

  // =====================================================
  // AUTHENTICATION METHODS
  // =====================================================

  /**
   * Sign up with email and password
   */
  async signUpWithEmail(email, password) {
    if (!this.client) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('📝 Signing up user:', email);
      
      const { data, error } = await this.client.auth.signUp({
        email: email,
        password: password,
        options: {
          emailRedirectTo: chrome.runtime.getURL('popup.html')
        }
      });

      if (error) throw error;

      // Create user subscription record (default free tier)
      if (data.user) {
        await this.createUserSubscription(data.user.id, email, 'free');
      }

      console.log('✅ User signed up successfully');
      return { success: true, user: data.user };
    } catch (error) {
      console.error('❌ Sign up failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email) {
    if (!this.client) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('📧 Resending verification email to:', email);
      
      const { data, error } = await this.client.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: chrome.runtime.getURL('popup.html')
        }
      });

      if (error) throw error;

      console.log('✅ Verification email resent');
      return { success: true };
    } catch (error) {
      console.error('❌ Resend failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Request password reset email
   */
  async resetPassword(email) {
    if (!this.client) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('🔑 Requesting password reset for:', email);
      
      // Use auth.pastecraft.com - the hosted callback page
      const callbackUrl = 'https://auth.pastecraft.com';
      console.log('🔗 Reset redirect URL:', callbackUrl);
      
      const { data, error } = await this.client.auth.resetPasswordForEmail(email, {
        redirectTo: callbackUrl
      });

      if (error) throw error;

      console.log('✅ Password reset email sent');
      console.log('💡 User will receive email with link to:', callbackUrl);
      return { success: true };
    } catch (error) {
      console.error('❌ Password reset failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update user password (after reset)
   */
  async updatePassword(newPassword) {
    if (!this.client) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('🔑 Updating user password...');
      
      const { data, error } = await this.client.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      console.log('✅ Password updated successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Password update failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email, password) {
    if (!this.client) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('🔐 Signing in user:', email);
      
      const { data, error } = await this.client.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) throw error;

      console.log('✅ User signed in successfully');
      return { success: true, user: data.user, session: data.session };
    } catch (error) {
      console.error('❌ Sign in failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign in with Google OAuth
   */
  async signInWithGoogle() {
    if (!this.client) {
      return { success: false, error: 'Supabase not initialized' };
    }

    try {
      console.log('🔐 Initiating Google sign in...');
      
      // For extensions, redirect to callback page
      const callbackUrl = chrome.runtime.getURL('callback.html');
      console.log('🔗 Callback URL:', callbackUrl);
      
      const { data, error } = await this.client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          skipBrowserRedirect: false,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) {
        console.error('❌ Google OAuth error:', error);
        return { success: false, error: error.message };
      }

      if (data?.url) {
        console.log('✅ Opening Google OAuth...');
        // Open in new window - user completes auth there
        window.open(data.url, '_blank', 'width=500,height=600');
        return { 
          success: true, 
          message: 'Complete sign in in the new window, then close this popup and reopen' 
        };
      }

      return { success: false, error: 'No OAuth URL generated' };
    } catch (error) {
      console.error('❌ Google sign in failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign out current user
   */
  async signOut() {
    if (!this.client) {
      throw new Error('Supabase not initialized');
    }

    try {
      console.log('👋 Signing out user...');
      
      const { error } = await this.client.auth.signOut();

      if (error) throw error;

      console.log('✅ User signed out successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Sign out failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current user session
   */
  async getCurrentUser() {
    if (!this.client) {
      return null;
    }

    try {
      const { data: { session }, error } = await this.client.auth.getSession();

      if (error) throw error;

      return session?.user || null;
    } catch (error) {
      console.error('❌ Get current user failed:', error);
      return null;
    }
  }

  /**
   * Create user subscription record
   */
  async createUserSubscription(userId, email, tier = 'free') {
    if (!this.client) return false;

    try {
      const { error } = await this.client
        .from('user_subscriptions')
        .insert([{
          user_id: userId,
          email: email,
          subscription_tier: tier,
          subscription_status: 'active'
        }]);

      if (error) throw error;

      console.log('✅ User subscription created');
      return true;
    } catch (error) {
      console.error('❌ Failed to create subscription:', error);
      return false;
    }
  }

  /**
   * Get user subscription info
   */
  async getUserSubscription(userId) {
    if (!this.client) return null;

    try {
      const { data, error } = await this.client
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('❌ Failed to get subscription:', error);
      return null;
    }
  }

  /**
   * Check if user has premium access
   */
  async isPremiumUser(userId) {
    const subscription = await this.getUserSubscription(userId);
    const isPaidPremium = !!(subscription &&
      (subscription.subscription_tier === 'premium' || subscription.subscription_tier === 'admin') &&
      subscription.subscription_status === 'active'
    );

    // Coupon-based AI access (DEV4EVER / months_free) should also grant premium AI gating access.
    const expiresAtMs = subscription?.ai_access_expires_at ? Date.parse(subscription.ai_access_expires_at) : NaN;
    const hasCouponAiAccess = !!(subscription && (
      subscription.has_unlimited_ai === true ||
      (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now())
    ));

    const isPremium = isPaidPremium || hasCouponAiAccess;
    return isPremium;
  }

  /**
   * Check premium access and redirect to upgrade page if not premium
   * @param {string} userId - User ID to check
   * @param {string} featureName - Feature being accessed (breakdown, summary, image, avatar, cartoon, name)
   * @returns {boolean} - True if user has premium access, false if redirected
   */
  async checkPremiumAccess(userId, featureName = 'feature') {
    const isPremium = await this.isPremiumUser(userId);
    
    if (!isPremium) {
      // Redirect to upgrade page with feature context
      const upgradeUrl = `https://pastecraft.com/upgrade.html?feature=${encodeURIComponent(featureName)}`;
      window.open(upgradeUrl, '_blank');
      return false;
    }
    
    return true;
  }

  /**
   * Admin sign in (checks for admin tier)
   */
  async signInAsAdmin(email, password) {
    const result = await this.signInWithEmail(email, password);
    
    if (result.success) {
      const subscription = await this.getUserSubscription(result.user.id);
      
      if (subscription && subscription.subscription_tier === 'admin') {
        return { success: true, user: result.user, isAdmin: true };
      } else {
        await this.signOut();
        return { success: false, error: 'Unauthorized: Admin access required' };
      }
    }
    
    return result;
  }

  // =====================================================
  // FULL SYNC METHOD (Call on startup)
  // =====================================================

  /**
   * Perform full bidirectional sync on extension startup
   */
  async performFullSync() {
    if (!this.client) {
      console.warn('⚠️ Supabase not initialized - skipping full sync');
      return {
        success: false,
        message: 'Supabase not configured'
      };
    }

    try {
      console.log('🔄 Starting full bidirectional sync...');

      // Get local data from Chrome storage
      const localData = await new Promise((resolve) => {
        chrome.storage.local.get(['clips', 'categories', 'searchOnlyClips', 'settings', 'userProfile'], resolve);
      });

      const localClips = localData.clips || [];
      const localCategories = localData.categories || [];
      const localArchivedClips = localData.searchOnlyClips || [];
      const localSettings = localData.settings || {};
      const localProfile = localData.userProfile || {};

      // Sync clips
      await this.syncClipsToSupabase(localClips);
      const remoteClips = await this.syncClipsFromSupabase();
      if (remoteClips) {
        const mergedClips = await this.mergeClips(localClips, remoteClips);
        await new Promise((resolve) => {
          chrome.storage.local.set({ clips: mergedClips }, resolve);
        });
        console.log(`✅ Clips merged: ${mergedClips.length} total`);
      }

      // Sync categories
      await this.syncCategoriesToSupabase(localCategories);
      const remoteCategories = await this.syncCategoriesFromSupabase();
      if (remoteCategories) {
        const mergedCategories = await this.mergeCategories(localCategories, remoteCategories);
        await new Promise((resolve) => {
          chrome.storage.local.set({ categories: mergedCategories }, resolve);
        });
        console.log(`✅ Categories merged: ${mergedCategories.length} total`);
      }

      // Sync archived clips (searchOnlyClips)
      await this.syncArchivedClipsToSupabase(localArchivedClips);
      const remoteArchivedClips = await this.syncArchivedClipsFromSupabase();
      if (remoteArchivedClips) {
        const mergedArchivedClips = await this.mergeArchivedClips(localArchivedClips, remoteArchivedClips);
        await new Promise((resolve) => {
          chrome.storage.local.set({ searchOnlyClips: mergedArchivedClips }, resolve);
        });
        console.log(`✅ Archived clips merged: ${mergedArchivedClips.length} total (limited to 1000 locally)`);
      }

      // Sync settings
      await this.syncSettingsToSupabase(localSettings);
      const remoteSettings = await this.syncSettingsFromSupabase();
      if (remoteSettings) {
        await new Promise((resolve) => {
          chrome.storage.local.set({ settings: remoteSettings }, resolve);
        });
        console.log('✅ Settings updated');
      }

      // Sync user profile
      await this.syncUserProfileToSupabase(localProfile);
      const remoteProfile = await this.syncUserProfileFromSupabase();
      if (remoteProfile) {
        // Merge profiles (remote takes precedence for images, local for text)
        const mergedProfile = {
          ...localProfile,
          ...remoteProfile
        };
        await new Promise((resolve) => {
          chrome.storage.local.set({ userProfile: mergedProfile }, resolve);
        });
        console.log('✅ User profile updated');
      }

      console.log('✅ Full sync complete!');
      return {
        success: true,
        message: 'All data synced successfully',
        stats: {
          clips: remoteClips?.length || 0,
          categories: remoteCategories?.length || 0,
          archivedClips: remoteArchivedClips?.length || 0
        }
      };

    } catch (error) {
      console.error('❌ Full sync failed:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

// Initialize global instance
const pasteCraftSupabase = new PasteCraftSupabase();

