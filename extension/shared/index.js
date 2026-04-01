// PasteCraft Shared Modules - Barrel Export
// Import all shared utilities from this single entry point

// Constants
export * from './constants.js';

// State Store
export { 
  createStore, 
  appStore, 
  createSelector, 
  createPersistedStore 
} from './store.js';

// Messaging
export {
  sendToBackground,
  sendToTab,
  safeSendToTab,
  broadcastToAllTabs,
  onMessage,
  onExternalMessage,
  createTypedSender,
  createMessageRouter,
  messages
} from './messaging.js';

// Storage Adapter
export {
  chromeStorageAdapter,
  getStorageItems,
  setStorageItems,
  removeStorageItems,
  onStorageChange,
  getOrCreateDeviceId,
  touchLocalUpdatedAt,
  normalizeArray
} from './storage-adapter.js';

// API
export {
  initSupabase,
  getSupabase,
  isSupabaseAvailable,
  getSession,
  getUserId,
  getAccessToken,
  getSupabaseUrl,
  callEdgeFunction,
  fetchWithTimeout,
  subscriptionCache,
  SUPABASE_TABLES
} from './api.js';

// Auth
export {
  isAuthenticated,
  getUserProfile,
  signInWithPassword,
  signUp,
  signOut,
  resetPassword,
  updatePassword,
  onAuthStateChange,
  refreshSession,
  setSession,
  isFreemiumMode,
  setFreemiumMode
} from './auth.js';
