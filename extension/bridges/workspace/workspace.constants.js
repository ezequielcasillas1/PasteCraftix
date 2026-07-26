/**
 * @forward-slice Workspace ownership — storage keys for hard account isolation.
 * Local library must match the signed-in Supabase user_id (Option 1).
 */

/** Durable stamp: which auth user owns chrome.storage.local library data. */
export const WORKSPACE_OWNER_KEY = 'workspaceOwnerUserId';

/**
 * User-scoped library / sync state cleared on account switch or owner mismatch.
 * Kept out of this list (global prefs): theme, quickPasteSettings, autoDeletePeriod,
 * albumAttachmentOpenMode, widgetSettings, auth prefs / verified emails, schema version.
 */
export const WORKSPACE_LIBRARY_KEYS = Object.freeze([
  'clips',
  'categories',
  'searchOnlyClips',
  'notes',
  'userProfile',
  'syncQueue',
  'pc_deleted_clips',
  'pc_deleted_archived_clips',
  'pc_deleted_categories',
  'pc_deleted_notes',
  'pc_local_updatedAt',
  'pc_aiHistory_v1',
  'pc_ai_workflow_v1',
  'pc_refactorLinks_v1',
  'pc_aiLabSubTab_v1',
  'pc_breakdownPageState_v1',
  'pc_breakdownModalState_v1',
  'pc_summaryState_v1',
  'likedClipIds',
  'pc_restore_points_v1',
  'pc_last_restore_at',
  'pc_last_restore_point_id',
  'pc_idb_migrated_v1',
]);

/** IndexedDB entity stores that mirror the local library. */
export const WORKSPACE_IDB_STORES = Object.freeze(['clips', 'categories', 'notes']);

export const WORKSPACE_OWNERSHIP_ACTIONS = Object.freeze({
  NONE: 'none',
  OK: 'ok',
  BIND_ONLY: 'bind-only',
  CLEAR_AND_BIND: 'clear-and-bind',
  CLEAR_UNBIND: 'clear-unbind',
});
