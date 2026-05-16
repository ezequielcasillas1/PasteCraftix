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

function bindRecoverBtns(app) {
  const container = document.getElementById(ACTIVITY_SELECTORS.LIST);
  if (!container) return;
  
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('.activity-recover-btn');
    if (!btn || btn.disabled) return;
    
    const id = btn.dataset.id;
    if (!id) return;
    
    // Find the entry in app.activityEntries
    const entry = app.activityEntries?.find(en => en.id === id);
    if (!entry || !entry.row_old) return;
    
    try {
      btn.disabled = true;
      btn.textContent = 'Recovering...';
      
      const tableName = entry.table_name;
      const payload = entry.row_old;
      
      if (tableName === 'clips') {
        app.clips = [payload, ...app.clips];
        await chrome.storage.local.set({ clips: app.clips });
        app.renderChips();
        app.renderSearchResults();
        app.renderCategories();
        if (typeof pasteCraftSupabase !== 'undefined' && pasteCraftSupabase.syncWithQueue) {
          pasteCraftSupabase.syncWithQueue('syncClips', app.clips, pasteCraftSupabase.syncClipsToSupabase).catch(()=>{});
        }
      } else if (tableName === 'categories') {
        app.categories = [...app.categories, payload];
        await chrome.storage.local.set({ categories: app.categories });
        app.renderCategories();
        if (typeof pasteCraftSupabase !== 'undefined' && pasteCraftSupabase.syncWithQueue) {
          pasteCraftSupabase.syncWithQueue('syncCategories', app.categories, pasteCraftSupabase.syncCategoriesToSupabase).catch(()=>{});
        }
      } else if (tableName === 'notes') {
        app.notes = [payload, ...app.notes];
        await chrome.storage.local.set({ notes: app.notes });
        app.renderNotes();
        if (typeof pasteCraftSupabase !== 'undefined' && pasteCraftSupabase.syncWithQueue) {
          pasteCraftSupabase.syncWithQueue('syncNotes', app.notes, pasteCraftSupabase.syncNotesToSupabase).catch(()=>{});
        }
      }
      
      if (entry.is_local_delete && app.idb && typeof app.idb.removeDeletedItem === 'function') {
        const pk = `deleted:${tableName}:${payload.id}`;
        await app.idb.removeDeletedItem(pk).catch(()=>{});
      }
      
      app.showToast?.('Item recovered successfully', 'success');
      await refreshActivity(app);
    } catch (error) {
      console.error('Failed to recover item:', error);
      app.showToast?.('Failed to recover item', 'error');
      btn.disabled = false;
      btn.textContent = 'Recover';
    }
  });
}

export function initActivityEventListeners(app) {
  bindRefreshBtn(app);
  bindFilterChips(app);
  bindDateFilters(app);
  bindLoadMore(app);
  bindRecoverBtns(app);
}
