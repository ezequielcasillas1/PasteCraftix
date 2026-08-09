/** Shared viewer-shell constants (expand + wrap + pop-out). */

export const VIEWER_SHELL_CLASS = 'pc-viewer-shell';
export const VIEWER_SHELL_EXPANDED_CLASS = 'pc-viewer-shell--expanded';
export const VIEWER_SHELL_ACTIONS_CLASS = 'pc-viewer-shell-actions';
export const VIEWER_SHELL_MOUNTED_ATTR = 'data-pc-viewer-shell';

export const VIEWER_SHELL_ACTION = {
  EXPAND: 'viewer-shell-expand',
  POPOUT: 'viewer-shell-popout',
};

export const VIEWER_SHELL_STORAGE_KEY = 'pc_viewer_shell_expanded_v1';
export const VIEWER_POPOUT_STORAGE_PREFIX = 'pc_viewer_popout_payload_';

export const VIEWER_POPOUT_PAGE = 'viewer-popout.html';
export const VIEWER_POPOUT_WIDTH = 980;
export const VIEWER_POPOUT_HEIGHT = 720;

/** Overlay roots that are modules but not always `.modal-overlay`. */
export const VIEWER_SHELL_EXTRA_SELECTORS = [
  '.upgrade-modal-overlay',
  '.info-modal-overlay',
  '.image-viewer-modal',
  '#upgradeModal',
  '#clipJoinerModal',
  '#clipSettingsModal',
  '#imageViewerModal',
];

export const VIEWER_SHELL_OVERLAY_SELECTOR = [
  '.modal-overlay',
  ...VIEWER_SHELL_EXTRA_SELECTORS,
].join(', ');
