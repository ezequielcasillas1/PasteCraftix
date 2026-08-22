/**
 * @forward-slice
 * Header changelog link — opens the public pastecraft.com history page.
 */

import { CHANGELOG_LINK_ID, CHANGELOG_URL } from './header.changelog.constants.js';

export function openChangelogPage(createTab) {
  if (typeof createTab === 'function') {
    createTab({ url: CHANGELOG_URL, active: true });
    return;
  }
  if (typeof window !== 'undefined') {
    window.open(CHANGELOG_URL, '_blank', 'noopener,noreferrer');
  }
}

export function initHeaderChangelog() {
  const link = document.getElementById(CHANGELOG_LINK_ID);
  if (!link || link.dataset.pcChangelogBound === '1') return;
  link.dataset.pcChangelogBound = '1';
  link.addEventListener('click', (event) => {
    event.preventDefault();
    openChangelogPage(globalThis.chrome?.tabs?.create?.bind(globalThis.chrome.tabs));
  });
}
