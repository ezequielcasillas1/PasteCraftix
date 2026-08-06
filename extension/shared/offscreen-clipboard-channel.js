/**
 * Shared keys/channel for popup ↔ offscreen clipboard image writes.
 * Prefer chrome.storage handshake — runtime sendMessage replies are flaky.
 */

export const OFFSCREEN_CLIPBOARD_CHANNEL = 'pastecraft-offscreen-clipboard';

export const OFFSCREEN_CLIPBOARD_MSG = Object.freeze({
  WRITE_REQ: 'write-image',
  WRITE_RES: 'write-image-result',
  PING_REQ: 'ping',
  PING_RES: 'pong',
});

/** chrome.storage.local keys for popup ↔ offscreen write handshake. */
export const CLIPBOARD_STORAGE_BRIDGE = Object.freeze({
  REQ: 'pc_clipboard_write_req',
  RES: 'pc_clipboard_write_res',
  READY: 'pc_clipboard_offscreen_ready',
});

/** chrome.storage.local keys for popup ↔ focused writer-window job handshake. */
export const CLIPBOARD_WRITER_BRIDGE = Object.freeze({
  JOB: 'pc_clipboard_writer_job',
  RESULT: 'pc_clipboard_writer_result',
});

export function createOffscreenClipboardChannel() {
  return new BroadcastChannel(OFFSCREEN_CLIPBOARD_CHANNEL);
}
