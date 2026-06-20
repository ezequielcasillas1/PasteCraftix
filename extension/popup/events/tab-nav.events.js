/** Tab navigation — instant UI switch, deferred data refresh, perf probes. */

import {
  finishUxInteractionAfterPaint,
  startUxInteraction,
} from '../shared/ux-perf-capture.js';

async function refreshActiveTabData(app, tabName) {
  if (tabName === 'clips') {
    await app.loadData();
    app.renderChips();
    app.updateManualInputCategories();
  } else if (tabName === 'categories') {
    await app.loadData();
    app.renderCategories();
    app.updateCategoryBulkActions();
    app.updateManualInputCategories();
  } else if (tabName === 'search') {
    await app.loadData();
    app.renderSearchResults();
    app.updateSearchBulkActions();
  } else if (tabName === 'ai') {
    app.updateAiCreditsPills('ai-tab');
  } else if (tabName === 'notes') {
    await app.loadNotes();
    app.renderNotes();
  } else if (tabName === 'aiHistory') {
    await app.loadAiHistory();
    app.resetAiHistoryListPagination();
    app.renderAiHistoryList();
  } else if (tabName === 'activity') {
    await app.activityFeature.service.loadActivityLog(app);
    app.activityFeature.render.renderActivityList(app);
  }
}

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
    if (!nextTab || nextTab === app.currentTab) return;

    const fromTab = app.currentTab;
    const perf = startUxInteraction('nav-tab', `${fromTab || '?'}→${nextTab}`, { fromTab, nextTab });

    window.__pcTabIconRendering = true;

    document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((content) => content.classList.remove('active'));

    tabBtn.classList.add('active');
    app.currentTab = nextTab;
    document.getElementById(`${nextTab}Tab`)?.classList.add('active');
    app._saveActiveTabState();

    requestAnimationFrame(() => {
      refreshActiveTabData(app, nextTab)
        .catch(() => {})
        .finally(() => {
          window.renderLucideIconsForActiveTab?.(nextTab, 'tab-nav-click', { immediate: false });
          window.__pcTabIconRendering = false;
          finishUxInteractionAfterPaint(perf, {
            location: 'tab-nav.events:click',
          });
        });
    });
  });
}
