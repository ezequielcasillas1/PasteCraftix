// PasteCraft Shared Constants
// All app-wide constants. No magic strings anywhere else.

export const STORAGE_KEYS = {
  SESSION: 'pc_supabase_session_v1',
  SETTINGS: 'ext-settings',
  CLIPS: 'clips',
  SEARCH_ONLY_CLIPS: 'searchOnlyClips',
  CATEGORIES: 'categories',
  NOTES: 'notes',
  WIDGET_SETTINGS: 'widgetSettings',
  DEVICE_ID: 'pc_device_id_v1',
  LOCAL_UPDATED_AT: 'pc_local_updatedAt',
  FREEMIUM_GUEST: 'pc_freemium_guest',
  SUBSCRIPTION_CACHE: 'pc_subscription_cache_v1',
  AI_WORKFLOW: 'pc_ai_workflow_v1',
  PASSWORD_RESET_STATE: 'pc_password_reset_state_v1',
  IDB_MIGRATED: 'pc_idb_migrated_v1'
};

export const MESSAGE_TYPES = {
  // Auth
  AUTH_SIGN_IN: 'auth:sign-in',
  AUTH_SIGN_OUT: 'auth:sign-out',
  AUTH_CALLBACK: 'auth:callback',
  
  // Clips
  CLIP_SAVE: 'clip:save',
  CLIP_DELETE: 'clip:delete',
  CLIP_UPDATE: 'clip:update',
  CLIPS_REFRESH: 'clips:refresh',
  CLIPS_UPDATED: 'clips:updated',
  
  // Categories
  CATEGORY_CREATE: 'category:create',
  CATEGORY_DELETE: 'category:delete',
  CATEGORY_UPDATE: 'category:update',
  
  // Notes
  NOTE_CREATE: 'note:create',
  NOTE_DELETE: 'note:delete',
  NOTE_UPDATE: 'note:update',
  
  // UI
  OPEN_POPUP_PANEL: 'openPopupPanel',
  SHOW_QUICK_PASTE: 'showQuickPaste',
  CLIP_SAVED: 'clipSaved',
  
  // Checkout
  CHECKOUT: 'checkout',
  
  // Edge Functions
  FETCH_EDGE_FUNCTION: 'pcFetchEdgeFunction',
  REFRESH_TOKEN: 'pcRefreshSupabaseToken',
  OPEN_POPUP_WINDOW: 'pcOpenPopupWindow'
};

export const SUBSCRIPTION = {
  FREE: 'free',
  BASIC: 'basic',
  PREMIUM: 'premium',
  ACTIVE: 'active',
  CANCELED: 'canceled',
  PAST_DUE: 'past_due',
  TRIALING: 'trialing'
};

export const ENTITY_TYPES = {
  CLIP: 'clip',
  CATEGORY: 'category',
  NOTE: 'note',
  ALBUM: 'album',
  SETTING: 'setting'
};

export const DEFAULT_CATEGORY = 'Uncategorized';

export const LIMITS = {
  MAX_ACTIVE_CLIPS: 500,
  MAX_ARCHIVED_CLIPS: 1000,
  MAX_CLIPS_PER_CATEGORY: 150,
  MAX_TEXT_LENGTH: 30000,
  MAX_HTML_LENGTH: 50000,
  MAX_URL_LENGTH: 4000,
  MAX_DATAURL_CHARS: 900000
};

export const SUPABASE_TABLES = {
  CLIPS: 'clips',
  ARCHIVED_CLIPS: 'archived_clips',
  CATEGORIES: 'categories',
  NOTES: 'notes',
  NOTE_VERSIONS: 'note_versions',
  USER_PROFILES: 'user_profiles',
  USER_SUBSCRIPTIONS: 'user_subscriptions',
  SETTINGS: 'settings',
  AI_HISTORY: 'ai_history',
  AUDIT_LOG: 'audit_log',
  DEVICE_SYNC_STATE: 'device_sync_state',
  PASTECRAFT_DEVICES: 'pastecraft_devices'
};
