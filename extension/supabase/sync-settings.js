/** Vertical slice: sync-settings.js */
export const syncSettingsMixin = {
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

    // Handle nested quickPasteSettings structure
    const quickPaste = localSettings.quickPasteSettings || {};
    const dbSettings = {
      user_id: userId,
      auto_delete_period: localSettings.autoDeletePeriod || 'never',
      // Single source of truth: global theme (Quick Paste follows this)
      theme: localSettings.theme || quickPaste.theme || 'light',
      auto_hide: quickPaste.autoHide !== undefined ? quickPaste.autoHide : (localSettings.autoHide !== false),
      show_timestamps: quickPaste.showTimestamps !== undefined ? quickPaste.showTimestamps : (localSettings.showTimestamps !== false),
      max_clips_display: quickPaste.maxClipsDisplay || localSettings.maxClipsDisplay || 20,
      album_attachment_open_mode: localSettings.albumAttachmentOpenMode || 'edgePopup',
      delimiter: quickPaste.delimiter || localSettings.delimiter || 'comma',
      custom_delimiter: quickPaste.customDelimiter || localSettings.customDelimiter || ', ',
      deduplicate: quickPaste.deduplicate || localSettings.deduplicate || false,
      sort: quickPaste.sort || localSettings.sort || false,
      uppercase: quickPaste.uppercase || localSettings.uppercase || false
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

    // Return settings in nested structure matching popup.js expectations
    // Handle missing fields gracefully (for older database schemas)
    const localSettings = {
      autoDeletePeriod: data.auto_delete_period || 'never',
      theme: data.theme || 'light',
      quickPasteSettings: {
        autoHide: data.auto_hide !== undefined ? data.auto_hide : true,
        showTimestamps: data.show_timestamps !== undefined ? data.show_timestamps : true,
        maxClipsDisplay: data.max_clips_display || 20,
        delimiter: data.delimiter || 'comma',
        customDelimiter: data.custom_delimiter || ', ',
        deduplicate: data.deduplicate || false,
        sort: data.sort || false,
        uppercase: data.uppercase || false
      },
      albumAttachmentOpenMode: data.album_attachment_open_mode || 'edgePopup' // Falls back if field doesn't exist
    };

    console.log('✅ Fetched settings from Supabase');
    return localSettings;
  } catch (error) {
    console.error('❌ Failed to fetch settings from Supabase:', error);
    return null;
  }
}

// =====================================================
};
