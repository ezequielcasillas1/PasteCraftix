/** Internal chrome.runtime.onMessage action strings (service worker). */
export const INTERNAL_MESSAGE_ACTIONS = Object.freeze({
  PC_COPY_TEXT: 'pcCopyText',
  PC_OPEN_POPUP_WINDOW: 'pcOpenPopupWindow',
  PC_REFRESH_SUPABASE_TOKEN: 'pcRefreshSupabaseToken',
  SAVE_CLIP: 'saveClip',
  PC_GET_QUICK_VIEW_CLIPS: 'pcGetQuickViewClips',
  PC_DELETE_QUICK_VIEW_CLIP: 'pcDeleteQuickViewClip',
  REFRESH_CLIPS: 'refreshClips',
  CLIPS_UPDATED: 'clipsUpdated',
  PC_CREATE_CHECKOUT: 'pcCreateCheckout',
});
