/** Internal chrome.runtime.onMessage action strings (service worker). */
export const INTERNAL_MESSAGE_ACTIONS = Object.freeze({
  PC_CAPTURE_REGION: 'pcCaptureRegion',
  PC_GET_PAGE_SELECTION: 'pcGetPageSelection',
  PC_COPY_TEXT: 'pcCopyText',
  PC_READ_CLIPBOARD: 'pcReadClipboard',
  PC_OPEN_POPUP_WINDOW: 'pcOpenPopupWindow',
  PC_REFRESH_SUPABASE_TOKEN: 'pcRefreshSupabaseToken',
  SAVE_CLIP: 'saveClip',
  PC_GET_QUICK_VIEW_CLIPS: 'pcGetQuickViewClips',
  PC_DELETE_QUICK_VIEW_CLIP: 'pcDeleteQuickViewClip',
  REFRESH_CLIPS: 'refreshClips',
  CLIPS_UPDATED: 'clipsUpdated',
  PC_CREATE_CHECKOUT: 'pcCreateCheckout',
});
