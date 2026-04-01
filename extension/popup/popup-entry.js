// PasteCraft Popup Entry Point
// Modular popup initialization

// Components
export { showToast, toast, clearToasts } from './components/toast.js';
export { showModal, closeModal, confirm, alert } from './components/modal.js';

// Modules
export * from './modules/clips.js';
export * from './modules/categories.js';
export * from './modules/notes.js';
export * from './modules/settings.js';
export * from './modules/search.js';

// Shared utilities
export {
  STORAGE_KEYS,
  MESSAGE_TYPES,
  SUBSCRIPTION,
  ENTITY_TYPES,
  DEFAULT_CATEGORY,
  LIMITS,
  SUPABASE_TABLES
} from '../shared/constants.js';

export {
  sendToBackground,
  onMessage
} from '../shared/messaging.js';

export {
  getStorageItems,
  setStorageItems,
  normalizeArray,
  onStorageChange
} from '../shared/storage-adapter.js';

export {
  isAuthenticated,
  getUserProfile,
  signInWithPassword,
  signUp,
  signOut,
  getUserId
} from '../shared/auth.js';

/**
 * Initialize popup UI
 * Call this after DOM is ready
 */
export async function initPopup() {
  // Import dynamically to avoid circular dependencies
  const { loadSettings, applyTheme } = await import('./modules/settings.js');
  
  // Apply saved theme
  const settings = await loadSettings();
  applyTheme(settings.theme || 'light');

  // Listen for storage changes
  const { onStorageChange } = await import('../shared/storage-adapter.js');
  onStorageChange((changes) => {
    // Handle real-time updates
    if (changes.clips) {
      window.dispatchEvent(new CustomEvent('pc:clips-updated'));
    }
    if (changes.categories) {
      window.dispatchEvent(new CustomEvent('pc:categories-updated'));
    }
    if (changes.notes) {
      window.dispatchEvent(new CustomEvent('pc:notes-updated'));
    }
  });

  console.log('[Popup] Initialized');
}

// Auto-initialize if DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPopup);
  } else {
    initPopup();
  }
}
