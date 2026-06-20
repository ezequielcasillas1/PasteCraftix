/** Tab navigation — instant UI switch, skip unchanged tabs, deferred render. */

import { switchMainTab } from '../features/app/tab-nav.helpers.js';

export function registerTabNavEvents(app) {
  const nav = document.querySelector('.tab-nav');
  if (!nav) return;

  if (nav.dataset.pcTabNavBound === '1') return;
  nav.dataset.pcTabNavBound = '1';

  nav.addEventListener('click', (e) => {
    const target = e.target;
    const tabBtn = (target && target.closest)
      ? target.closest('.tab-btn')
      : (target && target.classList && target.classList.contains('tab-btn') ? target : null);

    if (!tabBtn) return;

    const nextTab = tabBtn.dataset.tab;
    switchMainTab(app, nextTab, tabBtn);
  });
}
