// PasteCraft Search Module
// Handles search functionality across clips, notes, categories

import { searchClips } from './clips.js';
import { searchNotes } from './notes.js';
import { loadCategories } from './categories.js';

/**
 * Global search across all content types
 * @param {string} query - Search query
 * @param {Object} options
 * @param {boolean} options.includeClips
 * @param {boolean} options.includeNotes
 * @param {boolean} options.includeCategories
 * @param {boolean} options.includeArchived
 * @returns {Promise<Object>} { clips, notes, categories }
 */
export async function globalSearch(query, options = {}) {
  const {
    includeClips = true,
    includeNotes = true,
    includeCategories = true,
    includeArchived = true
  } = options;

  const q = String(query).toLowerCase().trim();
  const results = {
    clips: [],
    notes: [],
    categories: []
  };

  if (!q) return results;

  const promises = [];

  if (includeClips) {
    promises.push(
      searchClips(q, { includeArchived }).then(clips => {
        results.clips = clips;
      })
    );
  }

  if (includeNotes) {
    promises.push(
      searchNotes(q).then(notes => {
        results.notes = notes;
      })
    );
  }

  if (includeCategories) {
    promises.push(
      loadCategories().then(categories => {
        results.categories = categories.filter(cat => 
          cat.name.toLowerCase().includes(q)
        );
      })
    );
  }

  await Promise.all(promises);
  return results;
}

/**
 * Search with debounce
 * @param {Function} searchFn - Search function
 * @param {number} delay - Debounce delay in ms
 * @returns {Function} Debounced search function
 */
export function createDebouncedSearch(searchFn, delay = 300) {
  let timeoutId = null;

  return (query, ...args) => {
    return new Promise((resolve) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        const results = await searchFn(query, ...args);
        resolve(results);
      }, delay);
    });
  };
}

/**
 * Highlight search matches in text
 * @param {string} text - Text to highlight
 * @param {string} query - Search query
 * @param {string} highlightClass - CSS class for highlights
 * @returns {string} HTML with highlights
 */
export function highlightMatches(text, query, highlightClass = 'pc-search-highlight') {
  if (!query || !text) return escapeHtml(text);

  const q = String(query).toLowerCase();
  const t = String(text);
  const escaped = escapeHtml(t);
  
  // Find all matches (case insensitive)
  const regex = new RegExp(`(${escapeRegex(q)})`, 'gi');
  
  return escaped.replace(regex, `<mark class="${highlightClass}">$1</mark>`);
}

/**
 * Calculate search relevance score
 * @param {Object} item - Item to score
 * @param {string} query - Search query
 * @returns {number} Score (higher = more relevant)
 */
export function calculateRelevance(item, query) {
  if (!query || !item) return 0;

  const q = String(query).toLowerCase();
  let score = 0;

  // Check title/name
  const title = String(item.title || item.name || '').toLowerCase();
  if (title === q) score += 100; // Exact match
  else if (title.startsWith(q)) score += 50;
  else if (title.includes(q)) score += 25;

  // Check text/body
  const text = String(item.text || item.body || '').toLowerCase();
  if (text.includes(q)) {
    score += 10;
    // Bonus for multiple occurrences
    const count = (text.match(new RegExp(escapeRegex(q), 'g')) || []).length;
    score += Math.min(count * 2, 20);
  }

  // Check category
  const category = String(item.category || '').toLowerCase();
  if (category.includes(q)) score += 15;

  // Recency bonus
  const age = Date.now() - (item.timestamp || item.createdAt || 0);
  const dayMs = 24 * 60 * 60 * 1000;
  if (age < dayMs) score += 5; // Within last day
  else if (age < 7 * dayMs) score += 2; // Within last week

  return score;
}

/**
 * Sort results by relevance
 * @param {Array} items - Items to sort
 * @param {string} query - Search query
 * @returns {Array} Sorted items
 */
export function sortByRelevance(items, query) {
  return [...items].sort((a, b) => {
    const scoreA = calculateRelevance(a, query);
    const scoreB = calculateRelevance(b, query);
    return scoreB - scoreA;
  });
}

/**
 * Filter recent items
 * @param {Array} items - Items to filter
 * @param {number} days - Number of days
 * @returns {Array}
 */
export function filterRecent(items, days = 7) {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  return items.filter(item => {
    const timestamp = item.timestamp || item.createdAt || 0;
    return timestamp >= cutoff;
  });
}

/**
 * Group items by date
 * @param {Array} items - Items to group
 * @returns {Object} { today: [], yesterday: [], thisWeek: [], older: [] }
 */
export function groupByDate(items) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;
  const weekAgo = today - 7 * 24 * 60 * 60 * 1000;

  return items.reduce((groups, item) => {
    const timestamp = item.timestamp || item.createdAt || 0;
    
    if (timestamp >= today) {
      groups.today.push(item);
    } else if (timestamp >= yesterday) {
      groups.yesterday.push(item);
    } else if (timestamp >= weekAgo) {
      groups.thisWeek.push(item);
    } else {
      groups.older.push(item);
    }
    
    return groups;
  }, { today: [], yesterday: [], thisWeek: [], older: [] });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
