#!/usr/bin/env node
/**
 * SEO Keyword Research Script for PasteCraft
 * 
 * Supports multiple free APIs:
 * 1. qequals.com - Google Autocomplete A-Z (8 free requests/day)
 * 2. fetchSERP - Keyword suggestions (250 free credits on signup)
 * 3. Google Suggest - Direct autocomplete (unlimited, basic)
 * 
 * Usage: node scripts/seo-research.js [keyword]
 * Example: node scripts/seo-research.js "clipboard manager"
 */

const QEQUALS_API = 'https://api.qequals.com/v1/google-autocomplete';
const GOOGLE_SUGGEST_API = 'https://suggestqueries.google.com/complete/search';

const PASTECRAFT_KEYWORDS = [
  'clipboard manager',
  'clipboard history',
  'copy paste tool',
  'text snippet manager',
  'clipboard app',
  'paste manager',
  'clipboard organizer',
  'multi clipboard',
];

async function fetchFromQequals(keyword) {
  const url = `${QEQUALS_API}?q=${encodeURIComponent(keyword)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`qequals: HTTP ${response.status}`);
  return await response.json();
}

async function fetchFromGoogleSuggest(keyword) {
  // Google Suggest returns JSONP, we need to parse it
  const url = `${GOOGLE_SUGGEST_API}?client=firefox&q=${encodeURIComponent(keyword)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google: HTTP ${response.status}`);
  const data = await response.json();
  // Google returns [query, [suggestions]]
  return data[1] || [];
}

async function fetchKeywordsAZ(keyword) {
  // Fetch A-Z variations using Google Suggest
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const results = {};
  
  for (const letter of alphabet) {
    const query = `${keyword} ${letter}`;
    try {
      const suggestions = await fetchFromGoogleSuggest(query);
      if (suggestions.length > 0) {
        results[letter] = suggestions;
      }
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      // Skip failed letters
    }
  }
  
  return results;
}

async function fetchKeywords(keyword) {
  console.log(`\n🔍 Researching: "${keyword}"\n`);
  
  // Try qequals first (better A-Z coverage in single request)
  try {
    console.log('  Trying qequals.com API...');
    const data = await fetchFromQequals(keyword);
    console.log('  ✅ qequals.com responded');
    return { source: 'qequals', data };
  } catch (error) {
    console.log(`  ⚠️ qequals unavailable: ${error.message}`);
  }
  
  // Fallback to Google Suggest with A-Z queries
  try {
    console.log('  Trying Google Suggest API (A-Z)...');
    const data = await fetchKeywordsAZ(keyword);
    console.log('  ✅ Google Suggest responded');
    return { source: 'google', data };
  } catch (error) {
    console.error(`❌ All APIs failed: ${error.message}`);
    return null;
  }
}

function displayResults(keyword, result) {
  if (!result) return [];
  
  const { source, data } = result;
  
  console.log('━'.repeat(60));
  console.log(`📊 Results for: "${keyword}" (via ${source})`);
  console.log('━'.repeat(60));
  
  let totalCount = 0;
  const allKeywords = [];
  
  for (const [letter, suggestions] of Object.entries(data)) {
    if (Array.isArray(suggestions) && suggestions.length > 0) {
      totalCount += suggestions.length;
      allKeywords.push(...suggestions);
      console.log(`\n${letter.toUpperCase()} (${suggestions.length}):`);
      suggestions.forEach(s => console.log(`  • ${s}`));
    }
  }
  
  console.log('\n' + '━'.repeat(60));
  console.log(`📈 Total suggestions: ${totalCount}`);
  console.log('━'.repeat(60));
  
  return allKeywords;
}

function showRecommendations(allKeywords) {
  console.log('\n' + '═'.repeat(60));
  console.log('🎯 SEO RECOMMENDATIONS FOR PASTECRAFT');
  console.log('═'.repeat(60));
  
  const relevantTerms = ['clipboard', 'copy', 'paste', 'snippet', 'manager', 'history', 'sync', 'cloud'];
  const relevant = allKeywords.filter(k => 
    relevantTerms.some(term => k.toLowerCase().includes(term))
  );
  
  console.log('\n✅ High-relevance keywords to consider:');
  [...new Set(relevant)].slice(0, 25).forEach(k => console.log(`  → ${k}`));
  
  console.log('\n📝 Suggested meta keywords for PasteCraft:');
  const suggested = [
    'clipboard manager',
    'clipboard history',
    'copy paste tool',
    'text snippets',
    'cloud sync clipboard',
    'browser extension clipboard',
    'organize clipboard',
    'multi-device clipboard',
    'AI clipboard assistant',
    'productivity tool',
  ];
  suggested.forEach(k => console.log(`  ✓ ${k}`));
}

async function main() {
  const args = process.argv.slice(2);
  
  console.log('═'.repeat(60));
  console.log('🔬 PASTECRAFT SEO KEYWORD RESEARCH');
  console.log('   Using qequals.com Google Autocomplete A-Z API');
  console.log('   Free tier: 8 requests/day');
  console.log('═'.repeat(60));
  
  if (args.length > 0) {
    // Single keyword mode
    const keyword = args.join(' ');
    const data = await fetchKeywords(keyword);
    if (data) {
      const allKeywords = displayResults(keyword, data);
      showRecommendations(allKeywords);
    }
  } else {
    // Show suggested keywords
    console.log('\n📋 Suggested seed keywords for PasteCraft SEO:');
    PASTECRAFT_KEYWORDS.forEach((k, i) => console.log(`  ${i + 1}. ${k}`));
    
    console.log('\n💡 Usage:');
    console.log('  node scripts/seo-research.js "clipboard manager"');
    console.log('  node scripts/seo-research.js "paste tool"');
    
    console.log('\n⚠️  Note: Free API limit is 8 requests/day.');
    console.log('   Each request returns A-Z suggestions (26 letter variants).');
    
    // Demo with first keyword
    console.log('\n🚀 Running demo with "clipboard manager"...');
    const data = await fetchKeywords('clipboard manager');
    if (data) {
      const allKeywords = displayResults('clipboard manager', data);
      showRecommendations(allKeywords);
    }
  }
}

main().catch(console.error);
