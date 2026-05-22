/** Vertical slice: profile-sync.js */
export const profileSyncMixin = {
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

    // Normalize profile image URL to a stable Supabase Storage URL when possible
    let stableProfileImageUrl = localProfile.profileImageUrl || null;
    if (stableProfileImageUrl) {
      stableProfileImageUrl = await this.convertToPermanentProfileImageUrl(stableProfileImageUrl, userId);
    }

    // Avoid syncing huge base64 blobs (can cause statement timeout / unreliable profile fetch)
    const rawBase64 = localProfile.profileImageBase64 || null;
    const safeBase64 = (typeof rawBase64 === 'string' && rawBase64.startsWith('data:image/') && rawBase64.length <= 250000)
      ? rawBase64
      : null;

    const dbProfile = {
      user_id: userId,
      user_name: localProfile.userName || null,
      ai_generated_name: localProfile.aiGeneratedName || null,
      profile_image_url: stableProfileImageUrl || null,
      profile_image_base64: safeBase64,
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

    // Fire a profile_update beacon for admin usage attribution.
    const changes = [];
    if (dbProfile.user_name)            changes.push('name');
    if (dbProfile.profile_image_url)    changes.push('image_url');
    if (dbProfile.profile_image_base64) changes.push('image_base64');
    if (dbProfile.ai_generated_name)    changes.push('ai_name');
    if (dbProfile.generated_image_url)  changes.push('generated_image');
    this.pcBeacon('profile_update', { fields: changes.join(',') || 'unknown' });

    return true;
  } catch (error) {
    console.error('❌ Failed to sync user profile to Supabase:', error);
    return false;
  }
},

/**
 * Fire a usage beacon event for admin attribution.
 * Silent-fail — never blocks the caller. Uses the current auth session if available.
 */
async pcBeacon(event, meta = {}) {
  try {
    if (!PASTECRAFT_CONFIG?.supabase?.url) return;
    let token = '';
    try {
      const { data } = await this.client.auth.getSession();
      token = data?.session?.access_token || '';
    } catch (_) { /* anon beacon still works */ }

    fetch(`${PASTECRAFT_CONFIG.supabase.url}/functions/v1/usage-beacon`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
      },
      body: JSON.stringify({ event, meta }),
      keepalive: true,
    }).catch(() => {});
  } catch (_) { /* silent */ }
},

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

    this.pcBeacon('profile_view');

    console.log('✅ Fetched user profile from Supabase');
    return localProfile;
  } catch (error) {
    console.error('❌ Failed to fetch user profile from Supabase:', error);
    return null;
  }
},

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
},

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
},

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
};
