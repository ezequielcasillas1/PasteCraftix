/** Tab navigation — instant UI switch, skip unchanged tabs, deferred render. */

import { switchMainTab } from '../features/app/tab-nav.helpers.js';

export function registerTabNavEvents(app) {
  document.querySelector('.tab-nav').addEventListener('click', (e) => {
    const target = e.target;
    const tabBtn = (target && target.closest)
      ? target.closest('.tab-btn')
      : (target && target.classList && target.classList.contains('tab-btn') ? target : null);

    if (!tabBtn) return;
    switchMainTab(app, tabBtn.dataset.tab, tabBtn);
  });
}
