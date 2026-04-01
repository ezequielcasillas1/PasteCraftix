// PasteCraft Content Script Entry Point
// Initializes content script modules and handles messaging

// Note: This is the new modular entry point.
// The legacy content-script.js remains functional during transition.

import { onBackgroundMessage, onStorageChange } from './modules/messaging.js';
import { showToast } from './modules/ui-injector.js';
import { copyToClipboard, pasteAtCursor } from './modules/clipboard.js';

// Debug logging control
const DEBUG = (() => {
  try {
    if (globalThis.PASTECRAFT_DEBUG === true) return true;
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('pastecraft_debug') === 'true';
    }
  } catch (_) {}
  return false;
})();

function log(...args) {
  if (DEBUG) console.log('[PasteCraft]', ...args);
}

/**
 * Initialize content script
 */
async function init() {
  log('Content script initializing...');

  // Listen for messages from background
  onBackgroundMessage((message) => {
    const action = message?.action;
    log('Message received:', action);

    switch (action) {
      case 'openPopupPanel':
        // Delegate to legacy Quick Paste for now
        if (window.pasteCraftQuickPaste) {
          window.pasteCraftQuickPaste.show();
        }
        break;

      case 'showQuickPaste':
        if (window.pasteCraftQuickPaste) {
          window.pasteCraftQuickPaste.show(message.x, message.y);
        }
        break;

      case 'clipSaved':
        if (message.clip && message.autoShow && window.pasteCraftQuickPaste) {
          window.pasteCraftQuickPaste.addClip(message.clip);
        }
        break;

      case 'clipsUpdated':
        if (window.pasteCraftQuickPaste) {
          window.pasteCraftQuickPaste.loadClips();
        }
        break;

      case 'pasteText':
        if (message.text) {
          pasteAtCursor(message.text);
        }
        break;

      case 'copyText':
        if (message.text) {
          copyToClipboard(message.text);
          if (message.showToast !== false) {
            showToast('Copied to clipboard', { type: 'success', duration: 2000 });
          }
        }
        break;
    }
  });

  // Listen for storage changes
  onStorageChange((changes) => {
    if (changes.clips && window.pasteCraftQuickPaste) {
      log('Clips storage changed, reloading...');
      window.pasteCraftQuickPaste.loadClips();
    }
  });

  log('Content script initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for potential module consumers
export { showToast, copyToClipboard, pasteAtCursor };
