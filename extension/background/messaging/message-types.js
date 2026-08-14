/**
 * Internal chrome.runtime.onMessage action strings (service worker).
 * Routed actions → create*HandlerMap(); deferred → messages-internal.js;
 * swallow → another listener owns the reply (e.g. offscreen).
 */

/** Actions handled by Mediator router (capture / window / clips). */
export const ROUTED_INTERNAL_ACTIONS = Object.freeze({
  PC_CAPTURE_REGION: 'pcCaptureRegion',
  PC_GET_PAGE_SELECTION: 'pcGetPageSelection',
  PC_EXTRACT_PAGE_MATH_TEX: 'pcExtractPageMathTex',
  PC_COPY_TEXT: 'pcCopyText',
  PC_COPY_IMAGE: 'pcCopyImage',
  PC_ENSURE_CLIPBOARD_OFFSCREEN: 'pcEnsureClipboardOffscreen',
  PC_OPEN_CLIPBOARD_WRITER: 'pcOpenClipboardWriter',
  PC_FETCH_IMAGE_AS_DATA_URL: 'pcFetchImageAsDataUrl',
  PC_READ_CLIPBOARD: 'pcReadClipboard',
  PC_ENSURE_OPTIONAL_PERMISSIONS: 'pcEnsureOptionalPermissions',
  PC_OPEN_SITE_ACCESS_GRANT: 'pcOpenSiteAccessGrant',
  PC_OPEN_POPUP_WINDOW: 'pcOpenPopupWindow',
  SAVE_CLIP: 'saveClip',
  PC_GET_QUICK_VIEW_CLIPS: 'pcGetQuickViewClips',
  PC_DELETE_QUICK_VIEW_CLIP: 'pcDeleteQuickViewClip',
  REFRESH_CLIPS: 'refreshClips',
  CLIPS_UPDATED: 'clipsUpdated',
});

/** Auth/billing — stay in messages-internal until Phase 3+ owns them. */
export const DEFERRED_INTERNAL_ACTIONS = Object.freeze({
  PC_REFRESH_SUPABASE_TOKEN: 'pcRefreshSupabaseToken',
  PC_CREATE_CHECKOUT: 'pcCreateCheckout',
});

/** Known actions that must not be answered by the SW internal listener. */
export const SWALLOW_INTERNAL_ACTIONS = Object.freeze({
  PC_OFFSCREEN_READ_CLIPBOARD: 'pcOffscreenReadClipboard',
  PC_OFFSCREEN_WRITE_CLIPBOARD_IMAGE: 'pcOffscreenWriteClipboardImage',
  PC_OFFSCREEN_CLIPBOARD_PING: 'pcOffscreenClipboardPing',
});

/** Full catalog for coverage checks (routed + deferred). */
export const INTERNAL_MESSAGE_ACTIONS = Object.freeze({
  ...ROUTED_INTERNAL_ACTIONS,
  ...DEFERRED_INTERNAL_ACTIONS,
});

export function listInternalMessageActionValues() {
  return Object.values(INTERNAL_MESSAGE_ACTIONS);
}

export function listRoutedInternalActionValues() {
  return Object.values(ROUTED_INTERNAL_ACTIONS);
}

export function listDeferredInternalActionValues() {
  return Object.values(DEFERRED_INTERNAL_ACTIONS);
}

export function listSwallowInternalActionValues() {
  return Object.values(SWALLOW_INTERNAL_ACTIONS);
}

export function isRoutedInternalAction(action) {
  return listRoutedInternalActionValues().includes(action);
}

export function isDeferredInternalAction(action) {
  return listDeferredInternalActionValues().includes(action);
}

export function isSwallowInternalAction(action) {
  return listSwallowInternalActionValues().includes(action);
}

/**
 * Coverage meta: every INTERNAL_MESSAGE_ACTIONS value must appear in
 * routedHandlers or deferred in-file handling.
 */
export function getInternalActionCoverage(routedActionKeys = []) {
  const routed = new Set(routedActionKeys);
  const expectedRouted = listRoutedInternalActionValues();
  const missingFromRouter = expectedRouted.filter((a) => !routed.has(a));
  const unexpectedRouted = [...routed].filter(
    (a) => !expectedRouted.includes(a) && !listDeferredInternalActionValues().includes(a),
  );
  const deferred = listDeferredInternalActionValues();
  return {
    ok: missingFromRouter.length === 0,
    missingFromRouter,
    unexpectedRouted,
    deferred,
    swallow: listSwallowInternalActionValues(),
  };
}
