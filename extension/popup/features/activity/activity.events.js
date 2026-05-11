import { ACTIVITY_SELECTORS } from './activity.constants.js';
import { fetchActivityPage } from './activity.service.js';
import { renderActivityList } from './activity.render.js';

async function refreshActivity(app) {
  app.activityOffset = 0;
  await fetchActivityPage(app);
  renderActivityList(app);
}

function bindRefreshBtn(app) {
  document.getElementById(ACTIVITY_SELECTORS.REFRESH_BTN)?.addEventListener('click', async () => {
    await refreshActivity(app);
    app.showToast?.('Activity refreshed');
  });
}

function bindFilterChips(app) {
  document.querySelectorAll(ACTIVITY_SELECTORS.FILTER_CHIP).forEach(chip => {
    chip.addEventListener('click', async () => {
      document.querySelectorAll(ACTIVITY_SELECTORS.FILTER_CHIP).forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      app.activityFilter = chip.dataset.filter;
      app.activityOffset = 0;
      await fetchActivityPage(app);
      renderActivityList(app);
    });
  });
}

function bindDateFilters(app) {
  const onDateChange = async () => {
    app.activityOffset = 0;
    await fetchActivityPage(app);
    renderActivityList(app);
  };

  document.getElementById(ACTIVITY_SELECTORS.DATE_FROM)?.addEventListener('change', onDateChange);
  document.getElementById(ACTIVITY_SELECTORS.DATE_TO)?.addEventListener('change', onDateChange);
}

function bindLoadMore(app) {
  document.getElementById(ACTIVITY_SELECTORS.LOAD_MORE_BTN)?.addEventListener('click', async () => {
    await fetchActivityPage(app, true);
    renderActivityList(app);
  });
}

export function initActivityEventListeners(app) {
  bindRefreshBtn(app);
  bindFilterChips(app);
  bindDateFilters(app);
  bindLoadMore(app);
}
