/**
 * @forward-slice Quick clip search on the Clips tab (under One-click copy).
 * It does not build its own search: the first keystroke hands the query to the
 * existing Search tab (#searchInput + app.searchQuery + renderSearchResults) and
 * moves focus there so typing continues without a break.
 */
import { activatePopupTab } from '../app/popup.tab-lifecycle.js';

export const QUICK_SEARCH_INPUT_ID = 'clipsQuickSearchInput';

export async function handoffQuickSearch(app, value, doc = document) {
  const query = String(value ?? '');
  const target = doc.getElementById('searchInput');
  if (target) target.value = query;
  app.searchQuery = query;
  await activatePopupTab(app, 'search', { source: 'clips-quick-search' }).catch(() => {});
  app.renderSearchResults?.();
  app.updateSearchBulkActions?.();
  if (target) {
    target.focus();
    try { target.setSelectionRange(query.length, query.length); } catch (_) {}
  }
  return query;
}

export function registerClipsQuickSearch(app, doc = document) {
  const input = doc.getElementById(QUICK_SEARCH_INPUT_ID);
  if (!input || input.dataset.bound === '1') return false;
  input.dataset.bound = '1';
  const go = () => {
    const value = input.value;
    if (!value.trim()) return;
    input.value = '';
    handoffQuickSearch(app, value, doc);
  };
  input.addEventListener('input', go);
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') go(); });
  return true;
}
