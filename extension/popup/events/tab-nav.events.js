/** Delegates popup tab activation to the app lifecycle coordinator. */

import { activatePopupTab } from '../features/app/popup.tab-lifecycle.js';

export function registerTabNavEvents(app) {
  document.querySelector('.tab-nav').addEventListener('click', (event) => {
    const target = event.target;
    const tabButton = target?.closest?.('.tab-btn')
      || (target?.classList?.contains('tab-btn') ? target : null);
    if (!tabButton?.dataset?.tab) return;

    activatePopupTab(app, tabButton.dataset.tab, { source: 'tab-nav-click' }).catch(() => {});
  });
}
