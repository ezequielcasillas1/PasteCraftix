/**
 * SEO Keyword Research Utility using qequals.com Google Autocomplete A-Z API
 * Free tier: 8 requests/day, no signup required
 * 
 * Usage: Call fetchKeywordSuggestions('clipboard manager') to get A-Z suggestions
 */

const QEQUALS_API_BASE = 'https://api.qequals.com/v1/google-autocomplete';

/**
 * Fetch Google Autocomplete A-Z suggestions for a seed keyword
 * @param {string} keyword - The seed keyword to research
 * @returns {Promise<Object>} - A-Z suggestions object
 */
export async function fetchKeywordSuggestions(keyword) {
  if (!keyword || typeof keyword !== 'string') {
    throw new Error('Keyword must be a non-empty string');
  }

  const encodedKeyword = encodeURIComponent(keyword.trim());
  const url = `${QEQUALS_API_BASE}?q=${encodedKeyword}`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Free tier allows 8 requests/day.');
      }
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      keyword,
      timestamp: new Date().toISOString(),
      suggestions: data,
      totalCount: countSuggestions(data),
    };
  } catch (error) {
    return {
      success: false,
      keyword,
      timestamp: new Date().toISOString(),
      error: error.message,
      suggestions: null,
    };
  }
}

/**
 * Count total suggestions across all letters
 * @param {Object} suggestions - A-Z suggestions object
 * @returns {number} - Total count
 */
function countSuggestions(suggestions) {
  if (!suggestions || typeof suggestions !== 'object') return 0;
  return Object.values(suggestions).reduce((total, arr) => {
    return total + (Array.isArray(arr) ? arr.length : 0);
  }, 0);
}

/**
 * Extract flat list of all keywords from A-Z suggestions
 * @param {Object} suggestions - A-Z suggestions object from API
 * @returns {string[]} - Flat array of all keywords
 */
export function flattenSuggestions(suggestions) {
  if (!suggestions || typeof suggestions !== 'object') return [];
  return Object.values(suggestions).flat().filter(Boolean);
}

/**
 * Find keywords containing specific terms
 * @param {Object} suggestions - A-Z suggestions object
 * @param {string[]} terms - Terms to filter by
 * @returns {string[]} - Matching keywords
 */
export function filterByTerms(suggestions, terms) {
  const allKeywords = flattenSuggestions(suggestions);
  const lowerTerms = terms.map(t => t.toLowerCase());
  
  return allKeywords.filter(keyword => {
    const lower = keyword.toLowerCase();
    return lowerTerms.some(term => lower.includes(term));
  });
}

/**
 * PasteCraft-specific seed keywords for SEO research
 */
export const PASTECRAFT_SEED_KEYWORDS = [
  'clipboard manager',
  'clipboard history',
  'copy paste tool',
  'text snippet manager',
  'clipboard app',
  'paste manager',
  'clipboard organizer',
  'multi clipboard',
];

/**
 * Research multiple keywords and combine results
 * Note: Be mindful of the 8 requests/day free limit
 * @param {string[]} keywords - Array of seed keywords
 * @returns {Promise<Object>} - Combined results
 */
export async function researchMultipleKeywords(keywords) {
  const results = {
    timestamp: new Date().toISOString(),
    totalKeywordsResearched: keywords.length,
    allSuggestions: [],
    byKeyword: {},
    errors: [],
  };

  for (const keyword of keywords) {
    const result = await fetchKeywordSuggestions(keyword);
    
    if (result.success) {
      results.byKeyword[keyword] = result;
      results.allSuggestions.push(...flattenSuggestions(result.suggestions));
    } else {
      results.errors.push({ keyword, error: result.error });
    }
    
    // Small delay between requests to be respectful
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Deduplicate suggestions
  results.allSuggestions = [...new Set(results.allSuggestions)];
  results.uniqueCount = results.allSuggestions.length;

  return results;
}

/**
 * Generate SEO keyword report for PasteCraft
 * @param {Object} researchResults - Results from researchMultipleKeywords
 * @returns {Object} - Formatted report
 */
export function generateSEOReport(researchResults) {
  const { allSuggestions, byKeyword, errors, timestamp } = researchResults;

  // Categorize keywords by relevance to PasteCraft features
  const categories = {
    clipboardManagement: [],
    cloudSync: [],
    productivity: [],
    aiFeatures: [],
    browserExtension: [],
    other: [],
  };

  const categoryTerms = {
    clipboardManagement: ['clipboard', 'copy', 'paste', 'clip', 'snippet'],
    cloudSync: ['sync', 'cloud', 'backup', 'cross-device', 'storage'],
    productivity: ['productivity', 'workflow', 'organize', 'manager', 'tool'],
    aiFeatures: ['ai', 'summary', 'smart', 'auto', 'intelligent'],
    browserExtension: ['extension', 'browser', 'chrome', 'edge', 'firefox'],
  };

  allSuggestions.forEach(keyword => {
    const lower = keyword.toLowerCase();
    let categorized = false;

    for (const [category, terms] of Object.entries(categoryTerms)) {
      if (terms.some(term => lower.includes(term))) {
        categories[category].push(keyword);
        categorized = true;
        break;
      }
    }

    if (!categorized) {
      categories.other.push(keyword);
    }
  });

  return {
    generatedAt: timestamp,
    summary: {
      totalUniqueKeywords: allSuggestions.length,
      keywordsResearched: Object.keys(byKeyword).length,
      errorsEncountered: errors.length,
    },
    categorizedKeywords: categories,
    topKeywordsByCategory: Object.fromEntries(
      Object.entries(categories).map(([cat, keywords]) => [cat, keywords.slice(0, 20)])
    ),
    rawData: {
      allKeywords: allSuggestions.sort(),
      byKeyword,
      errors,
    },
  };
}
