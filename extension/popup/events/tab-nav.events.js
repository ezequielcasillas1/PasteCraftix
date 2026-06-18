/** Tab navigation — instant UI switch, skip unchanged tabs, deferred render. */

import { switchMainTab } from '../features/app/tab-nav.helpers.js';
import { installTabNavProbeConsoleHelpers, pcTabPerfPush } from '../features/app/tab-nav.perf.js';

export function registerTabNavEvents(app) {
  installTabNavProbeConsoleHelpers();

  const nav = document.querySelector('.tab-nav');
  if (!nav) {
    pcTabPerfPush('tab-nav element missing at registerTabNavEvents', {
      hypothesisId: 'TAB-BOOT-FAIL',
      location: 'tab-nav.events:register',
    });
    return;
  }

  if (nav.dataset.pcTabNavBound === '1') {
    pcTabPerfPush('tab-nav listener already bound', {
      hypothesisId: 'TAB-BOOT',
      location: 'tab-nav.events:register',
    });
    return;
  }
  nav.dataset.pcTabNavBound = '1';

  nav.addEventListener('click', (e) => {
    const target = e.target;
    const tabBtn = (target && target.closest)
      ? target.closest('.tab-btn')
      : (target && target.classList && target.classList.contains('tab-btn') ? target : null);

    if (!tabBtn) return;

    const nextTab = tabBtn.dataset.tab;
    pcTabPerfPush(`tab click ${nextTab || '?'} (from ${app.currentTab || '?'})`, {
      hypothesisId: 'TAB-CLICK',
      location: 'tab-nav.events:click',
      nextTab,
      fromTab: app.currentTab,
    });

    switchMainTab(app, nextTab, tabBtn);
  });

  pcTabPerfPush('tab-nav click listener attached', {
    hypothesisId: 'TAB-BOOT',
    location: 'tab-nav.events:register',
    tabCount: nav.querySelectorAll('.tab-btn').length,
  });
}
