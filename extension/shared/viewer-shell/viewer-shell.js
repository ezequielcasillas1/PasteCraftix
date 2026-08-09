/**
 * Public API for the shared viewer shell (wrap + expand + pop-out).
 * @forward-slice shared/viewer-shell
 */

export { mountAll } from './viewer-shell.mount.js';
export { openViewerShellPopout, loadViewerPopoutPayload } from './viewer-shell.popout.js';
export {
  VIEWER_SHELL_ACTION,
  VIEWER_SHELL_CLASS,
  VIEWER_SHELL_EXPANDED_CLASS,
} from './viewer-shell.constants.js';
