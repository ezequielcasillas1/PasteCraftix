/** Shared first-load loading paint for popup tabs that hydrate async. */

const TAB_LOADING = Object.freeze({
  liked: {
    containerId: 'likedClipsContainer',
    icon: 'heart',
    heading: 'Loading liked',
    message: 'Fetching your favorite clips…',
  },
  notes: {
    containerId: 'notesContainer',
    icon: 'notebook-pen',
    heading: 'Loading notes',
    message: 'Reading your notes and albums…',
  },
  widgets: {
    containerId: 'widgetsGallery',
    icon: 'layout-dashboard',
    heading: 'Loading widgets',
    message: 'Opening your widget gallery…',
  },
  aiHistory: {
    containerId: 'aiHistoryList',
    icon: 'scroll-text',
    heading: 'Loading history',
    message: 'Fetching AI conversations…',
  },
  activity: {
    containerId: 'activityList',
    icon: 'bar-chart-3',
    heading: 'Loading activity',
    message: 'Fetching cloud activity…',
  },
  categories: {
    // Paint inside the track so #filesCarouselTrack survives for renderFiles.
    containerId: 'filesCarouselTrack',
    icon: 'folder',
    heading: 'Loading files',
    message: 'Preparing your files…',
    compact: true,
  },
});

function loadingMarkup({ icon, heading, message, compact }) {
  const compactClass = compact ? ' tab-loading-state--compact' : '';
  return `
    <div class="tab-loading-state${compactClass}" role="status" aria-live="polite" aria-busy="true">
      <div class="tab-loading-icon"><i data-lucide="${icon}"></i></div>
      <div class="tab-loading-spinner" aria-hidden="true"></div>
      <h3>${heading}</h3>
      <p>${message}</p>
    </div>
  `;
}

export function showTabLoadingState(tab) {
  const config = TAB_LOADING[tab];
  if (!config) return false;

  const container = document.getElementById(config.containerId);
  if (!container) return false;

  container.setAttribute('aria-busy', 'true');
  container.innerHTML = loadingMarkup(config);
  window.renderLucideIconsForActiveTab?.(tab, 'tab-loading', { immediate: true });
  return true;
}

export function getTabLoadingConfig(tab) {
  return TAB_LOADING[tab] || null;
}
