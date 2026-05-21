/** Vertical slice: realtime.js */
export const realtimeMixin = {
// REALTIME SUBSCRIPTIONS
// =====================================================

async setupRealtimeSubscriptions() {
  if (!this.client || !this.isOnline) {
    console.warn('⚠️ Skipping realtime subscriptions - offline or not initialized');
    return;
  }
  if (this._pauseSync) {
    console.warn('⚠️ Skipping realtime subscriptions - sync paused');
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

    const notesChannel = this.client
      .channel('notes-changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${userId}`
        },
        (payload) => this.handleNotesChange(payload)
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
      notesChannel,
      settingsChannel,
      profileChannel
    ];
    
    console.log('✅ Realtime subscriptions active');
  } catch (error) {
    console.error('❌ Failed to setup realtime subscriptions:', error);
  }
}

_shouldThrottleRealtime(eventType) {
  const now = Date.now();
  const lastAt = this._realtimeThrottle[eventType] || 0;
  if (now - lastAt < this._realtimeThrottleMs) {
    console.log(`⏳ Throttling realtime ${eventType} (${now - lastAt}ms since last)`);
    return true;
  }
  this._realtimeThrottle[eventType] = now;
  return false;
}

async handleClipsChange(payload) {
  if (this._shouldThrottleRealtime('clips')) return;
  console.log('🔔 Clips changed:', payload.eventType);
  
  // Refresh clips from Supabase
  const remoteClips = await this.syncClipsFromSupabase();
  if (remoteClips) {
    const localData = await new Promise((resolve) => {
      chrome.storage.local.get(['clips'], resolve);
    });
    const localBeforeLen = Array.isArray(localData?.clips) ? localData.clips.length : 0;
    const mergedClips = await this.mergeClips(localData.clips || [], remoteClips);
    await this._safeStorageSet({ clips: mergedClips });

    // Notify UI to refresh
    window.dispatchEvent(new CustomEvent('dataChanged', { 
      detail: { type: 'clips' } 
    }));
  }
}

async handleCategoriesChange(payload) {
  if (this._shouldThrottleRealtime('categories')) return;
  console.log('🔔 Categories changed:', payload.eventType);
  
  const remoteCategories = await this.syncCategoriesFromSupabase();
  if (remoteCategories) {
    const localData = await new Promise((resolve) => {
      chrome.storage.local.get(['categories'], resolve);
    });
    const mergedCategories = await this.mergeCategories(localData.categories || [], remoteCategories);
    await this._safeStorageSet({ categories: mergedCategories });
    
    window.dispatchEvent(new CustomEvent('dataChanged', { 
      detail: { type: 'categories' } 
    }));
  }
}

async handleArchivedClipsChange(payload) {
  if (this._shouldThrottleRealtime('archivedClips')) return;
  console.log('🔔 Archived clips changed:', payload.eventType);
  
  const remoteArchivedClips = await this.syncArchivedClipsFromSupabase();
  if (remoteArchivedClips) {
    const localData = await new Promise((resolve) => {
      chrome.storage.local.get(['searchOnlyClips'], resolve);
    });
    const mergedArchivedClips = await this.mergeArchivedClips(localData.searchOnlyClips || [], remoteArchivedClips);
    await this._safeStorageSet({ searchOnlyClips: mergedArchivedClips });
    
    window.dispatchEvent(new CustomEvent('dataChanged', { 
      detail: { type: 'archivedClips' } 
    }));
  }
}

async handleNotesChange(payload) {
  if (this._shouldThrottleRealtime('notes')) return;
  console.log('🔔 Notes changed:', payload.eventType);

  const remoteNotes = await this.syncNotesFromSupabase();
  if (remoteNotes) {
    const localData = await new Promise((resolve) => {
      chrome.storage.local.get(['notes'], resolve);
    });
    const mergedNotes = await this.mergeNotes(localData.notes || [], remoteNotes);
    await this._safeStorageSet({ notes: mergedNotes });

    window.dispatchEvent(new CustomEvent('dataChanged', {
      detail: { type: 'notes' }
    }));
  }
}

async handleSettingsChange(payload) {
  if (this._shouldThrottleRealtime('settings')) return;
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
  if (this._shouldThrottleRealtime('profile')) return;
  console.log('🔔 Profile changed:', payload.eventType);
  
  const remoteProfile = await this.syncUserProfileFromSupabase();
  if (remoteProfile) {
    // Merge with local profile to avoid overwriting stable images with temporary/expired ones.
    let currentLocal = {};
    try {
      const existing = await new Promise((resolve) => chrome.storage.local.get(['userProfile'], resolve));
      currentLocal = existing?.userProfile || {};
    } catch (_) {}

    const pickUrl = (localUrl, remoteUrl) => {
      const l = typeof localUrl === 'string' ? localUrl : '';
      const r = typeof remoteUrl === 'string' ? remoteUrl : '';
      if (!l && !r) return '';
      const supaHost = this._pcGetSupabaseHost();
      const isSupa = (x) => {
        const o = this._pcTryParseUrl(x);
        return !!(o && supaHost && o.hostname === supaHost);
      };
      const isTemp = (x) => {
        const o = this._pcTryParseUrl(x);
        if (!o) return false;
        const az = o.hostname.includes('blob.core.windows.net');
        const hasSig = o.searchParams.has('sig');
        return az || hasSig || this._pcIsExpiredSas(x);
      };
      if (isSupa(r)) return r;
      if (isSupa(l)) return l;
      if (l && isTemp(r)) return l;
      return r || l;
    };

    const mergedProfile = {
      ...currentLocal,
      ...remoteProfile,
      profileImageUrl: pickUrl(currentLocal?.profileImageUrl, remoteProfile?.profileImageUrl),
      profileImageBase64: (remoteProfile?.profileImageBase64 ? remoteProfile.profileImageBase64 : (currentLocal?.profileImageBase64 || null))
    };

    await new Promise((resolve) => {
      chrome.storage.local.set({ userProfile: mergedProfile }, resolve);
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
    // Path must live under a `{userId}/` folder so the Storage RLS policy
    // `(storage.foldername(name))[1] = auth.uid()::text` passes.
    const filePath = `${userId}/${Date.now()}.${fileExt}`;

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

  if (this._pcIsDataImageUrl(imageUrl)) {
    const uploaded = await this.uploadDataUrlToProfileImages(imageUrl, userId);
    return uploaded || imageUrl;
  }
  
  try {
    console.log('📥 Downloading image from temporary URL:', imageUrl);
    
    // Download image as blob
    const response = await this._fetchWithTimeout(
      imageUrl,
      {},
      30000,
      'Image download timed out'
    );
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    console.log('✅ Image downloaded, size:', blob.size, 'bytes');

    // Path must live under a `{userId}/` folder so the Storage RLS policy
    // `(storage.foldername(name))[1] = auth.uid()::text` passes.
    const timestamp = Date.now();
    const filePath = `${userId}/${timestamp}.png`;

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

// =====================================================
};
