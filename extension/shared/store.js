// PasteCraft Observer-based State Store
// Reference: https://www.patterns.dev/vanilla/observer-pattern/

import { SUBSCRIPTION } from './constants.js';

/**
 * Creates an observable store with subscription support.
 * @param {Object} initialState - Initial state object
 * @returns {Object} Store with getState, setState, subscribe methods
 */
export function createStore(initialState) {
  let state = structuredClone(initialState);
  const subscribers = new Set();

  return {
    /**
     * Get a deep clone of current state (prevents external mutation)
     */
    getState() {
      return structuredClone(state);
    },

    /**
     * Update state with partial object or updater function
     * @param {Object|Function} updater - Partial state or (prevState) => partialState
     */
    setState(updater) {
      const prev = state;
      state = typeof updater === 'function'
        ? { ...state, ...updater(state) }
        : { ...state, ...updater };
      
      subscribers.forEach(fn => {
        try {
          fn(state, prev);
        } catch (err) {
          console.error('[Store] Subscriber error:', err);
        }
      });
    },

    /**
     * Subscribe to state changes
     * @param {Function} fn - Callback (newState, prevState) => void
     * @returns {Function} Unsubscribe function
     */
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },

    /**
     * Get subscriber count (for debugging)
     */
    getSubscriberCount() {
      return subscribers.size;
    }
  };
}

/**
 * Default app store with common state shape
 */
export const appStore = createStore({
  user: null,
  subscription: SUBSCRIPTION.FREE,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  syncStatus: 'synced', // 'offline' | 'syncing' | 'synced' | 'error'
  clips: [],
  categories: [],
  notes: [],
  settings: null
});

/**
 * Selector helper - derive computed values from state
 * @param {Object} store - Store instance
 * @param {Function} selector - (state) => derivedValue
 * @returns {Function} () => derivedValue
 */
export function createSelector(store, selector) {
  return () => selector(store.getState());
}

/**
 * Create a store that persists to chrome.storage
 * @param {string} storageKey - Key for chrome.storage.local
 * @param {Object} initialState - Default state if not in storage
 */
export async function createPersistedStore(storageKey, initialState) {
  const store = createStore(initialState);
  
  // Load from storage
  try {
    const result = await chrome.storage.local.get([storageKey]);
    if (result[storageKey]) {
      store.setState(result[storageKey]);
    }
  } catch (err) {
    console.error('[PersistedStore] Load error:', err);
  }

  // Persist on changes (debounced)
  let saveTimeout = null;
  store.subscribe((state) => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      try {
        await chrome.storage.local.set({ [storageKey]: state });
      } catch (err) {
        console.error('[PersistedStore] Save error:', err);
      }
    }, 100);
  });

  return store;
}
