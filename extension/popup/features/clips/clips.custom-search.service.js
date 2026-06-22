import { CUSTOM_SEARCH_MAX_QUERY_LENGTH } from './clips.custom-search.constants.js';

const UNSAFE_SCHEME_RE = /(?:javascript|data|vbscript):/gi;
const CONTROL_CHAR_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(CONTROL_CHAR_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeCustomSearchQuery(query) {
  const cleaned = normalizeWhitespace(String(query || '').replace(UNSAFE_SCHEME_RE, ''));
  return cleaned.slice(0, CUSTOM_SEARCH_MAX_QUERY_LENGTH);
}

export function buildCombinedSearchQuery(highlight, question) {
  const parts = [
    sanitizeCustomSearchQuery(highlight),
    sanitizeCustomSearchQuery(question),
  ].filter(Boolean);
  return parts.join(' ').trim();
}

export function buildGoogleSearchUrl(query) {
  const safeQuery = sanitizeCustomSearchQuery(query);
  if (!safeQuery) return '';
  return `https://www.google.com/search?q=${encodeURIComponent(safeQuery)}`;
}

export function isCustomSearchQueryValid(highlight, question) {
  return Boolean(buildCombinedSearchQuery(highlight, question));
}

export async function navigateToGoogleSearch(query) {
  const url = buildGoogleSearchUrl(query);
  if (!url) return false;

  try {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs?.[0]?.id;
      if (tabId != null) {
        chrome.tabs.update(tabId, { url }, () => {
          if (chrome.runtime.lastError) {
            window.open(url, '_blank', 'noopener,noreferrer');
          }
        });
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    });
  } catch (error) {
    console.error('[custom-search] Failed to navigate active tab:', error);
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (_) {
      return false;
    }
  }
  return true;
}
