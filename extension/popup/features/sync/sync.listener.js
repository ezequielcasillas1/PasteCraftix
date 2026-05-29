/**
 * Sync Listener Module
 * Handles background sync orchestration and UI listener logic
 */

export async function performBackgroundSync(app, { force = false, reason = 'background-sync' } = {}) {
  try {
    const localTestRes = await chrome.storage.local.get([
      'pc_local_test_account_v1',
      'pc_freemium_test_sandbox_v1',
    ]);
    if (localTestRes?.pc_local_test_account_v1 === true
      || localTestRes?.pc_freemium_test_sandbox_v1 === true) {
      console.log('⏸️ Skipping background sync (local test account)');
      return;
    }

    if (!force) {
      try {
        const res = await chrome.storage.local.get([app._lastRestoreAtKey]);
        const lastRestoreAt = typeof res?.[app._lastRestoreAtKey] === 'number' ? res[app._lastRestoreAtKey] : 0;
        if (lastRestoreAt && (Date.now() - lastRestoreAt) < app._restoreSkipCloudSyncWindowMs) {
          console.log('⏸️ Skipping background sync (recent restore):', { reason, lastRestoreAt });
          return;
        }
      } catch (_) {}
    }

    console.log('🔄 Starting background sync with database...', { reason, force });
    const syncResult = await pasteCraftSupabase.performFullSync();
    
    if (syncResult.success) {
      console.log('✅ Background sync complete:', syncResult.stats);
      await app.loadData();
      app.renderChips();
      app.renderCategories();
      app.updateCategoryFilter();
      app.updateManualInputCategories();
      
      await app.loadUserProfile();
      app.updateTopBarIdentity(app.userProfile?.profileImageUrl || undefined);
    } else {
      console.warn('⚠️ Background sync failed:', syncResult.message);
    }
  } catch (error) {
    console.error('❌ Background sync error:', error);
  }
}

export function setupSyncStatusListeners(app) {
  window.addEventListener('syncStatusChanged', (event) => {
    const { status, queueLength } = event.detail;
    app.updateSyncIndicator(status, queueLength);
  });
  
  window.addEventListener('syncProgress', (event) => {
    const { current, total, percentage } = event.detail;
    app.updateSyncProgress(current, total, percentage);
  });
}

export function clearSyncAutoRefresh(app) {
  if (app._syncAutoRefreshTimeout) {
    clearTimeout(app._syncAutoRefreshTimeout);
    app._syncAutoRefreshTimeout = null;
  }
}

export function isSyncProgressVisible() {
  const el = document.getElementById('syncProgressContainer');
  if (!el) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

export function scheduleSyncAutoRefreshTick(app) {
  if (app._syncAutoRefreshTimeout) return;
  app._syncAutoRefreshTimeout = setTimeout(() => {
    runSyncAutoRefreshTick(app).catch(() => {});
  }, app._syncAutoRefreshIntervalMs);
}

export async function runSyncAutoRefreshTick(app) {
  app._syncAutoRefreshTimeout = null;

  if (!isSyncProgressVisible()) return;
  if (app._syncAutoRefreshInFlight) {
    scheduleSyncAutoRefreshTick(app);
    return;
  }

  app._syncAutoRefreshInFlight = true;
  try {
    await app.loadData();
    await app.loadUserProfile();
    app.renderChips();
    app.updateLastCapture();
    app.updatePreview();
    app.renderCategories();
    app.updateCategoryFilter();
    app.renderSearchResults();
    app.updateTopBarIdentity(app.userProfile?.profileImageUrl || undefined);
  } finally {
    app._syncAutoRefreshInFlight = false;
  }

  if (isSyncProgressVisible()) {
    scheduleSyncAutoRefreshTick(app);
  }
}

export function setupRealtimeListeners(app) {
  window.addEventListener('dataChanged', async (event) => {
    const { type } = event.detail;
    console.log(`🔔 Realtime change detected: ${type}`);
    
    if (type === 'clips' || type === 'archivedClips') {
      await app.loadData();
      app.renderChips();
      app.updateLastCapture();
      app.renderSearchResults();
    } else if (type === 'categories') {
      await app.loadData();
      app.renderCategories();
      app.updateCategoryFilter();
    } else if (type === 'settings') {
      await app.loadSettings();
    } else if (type === 'profile') {
      await app.loadUserProfile();
      app.updateTopBarIdentity(app.userProfile?.profileImageUrl || undefined);
    }
  });
}

export function updateSyncIndicator(app, status, queueLength = 0) {
  const indicator = document.getElementById('syncIndicator');
  const statusText = document.getElementById('syncStatusText');
  const queueCount = document.getElementById('syncQueueCount');
  
  if (!indicator || !statusText) return;

  if (status !== 'syncing') {
    clearSyncAutoRefresh(app);
  }
  
  indicator.className = `sync-indicator ${status}`;
  
  const statusMessages = {
    'synced': 'Synced',
    'syncing': 'Syncing...',
    'offline': 'Offline'
  };
  
  statusText.textContent = statusMessages[status] || status;
  
  if (queueLength > 0 && queueCount) {
    queueCount.textContent = `${queueLength} pending`;
    queueCount.style.display = 'inline-block';
  } else if (queueCount) {
    queueCount.style.display = 'none';
  }
}

export function updateSyncProgress(app, current, total, percentage) {
  const progressContainer = document.getElementById('syncProgressContainer');
  const progressFill = document.getElementById('syncProgressFill');
  const progressText = document.getElementById('syncProgressText');
  
  if (!progressContainer || !progressFill || !progressText) return;
  
  if (total > 100 && current < total) {
    progressContainer.style.display = 'block';
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${current} / ${total} (${percentage}%)`;
    scheduleSyncAutoRefreshTick(app);
  } else {
    progressContainer.style.display = 'none';
    clearSyncAutoRefresh(app);
  }
}
