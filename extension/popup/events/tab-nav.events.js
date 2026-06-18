/** Tab navigation — instant UI switch, render from memory, background refresh when needed. */

import {
  activateMainTabUI,
  paintTabIcons,
  refreshTabDataInBackground,
  renderTabFromCache,
} from '../features/app/tab-nav.helpers.js';

export function registerTabNavEvents(app) {
  document.querySelector('.tab-nav').addEventListener('click', (e) => {
    const target = e.target;
    const tabBtn = (target && target.closest)
      ? target.closest('.tab-btn')
      : (target && target.classList && target.classList.contains('tab-btn') ? target : null);

    if (!tabBtn) return;

    const nextTab = tabBtn.dataset.tab;
    if (!nextTab || nextTab === app.currentTab) return;

    window.__pcTabIconRendering = true;

    activateMainTabUI(app, nextTab, tabBtn);
    app._saveActiveTabState();

    renderTabFromCache(app, nextTab);

    requestAnimationFrame(() => {
      paintTabIcons(nextTab);
      window.__pcTabIconRendering = false;
    });

    refreshTabDataInBackground(app, nextTab);
  });
}
