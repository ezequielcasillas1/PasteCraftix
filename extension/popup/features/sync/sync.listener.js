/**
 * Sync Listener Module
 * Handles background sync orchestration and UI listener logic
 */

async function shouldSkipCloudSync(app, force, reason) {
  if (force) return false;
  try {
    const res = await chrome.storage.local.get([app._lastRestoreAtKey]);
    const lastRestoreAt = typeof res?.[app._lastRestoreAtKey] === 'number' ? res[app._lastRestoreAtKey] : 0;
    const isRecent = lastRestoreAt && (Date.now() - lastRestoreAt) < app._restoreSkipCloudSyncWindowMs;
    if (!isRecent) return false;
    console.log('⏸️ Skipping background sync (recent restore):', { reason, lastRestoreAt });
    return true;
  } catch (_) {
    return false;
  }
}

function handleCloudSyncFailure(syncResult) {
  const message = String(syncResult?.message || '');
  const isSubscriptionSkip = message.includes('Cloud sync requires Basic or Enhanced subscription');
  if (isSubscriptionSkip) {
    console.info('ℹ️ Background sync skipped for free tier:', message);
    return 'ready';
  }
  console.warn('⚠️ Background sync failed:', message || 'Unknown sync error');
  return 'failed';
}

async function runLocalToCloudMigrate(app, reason) {
  try {
    const migrate = app.syncFeature?.localToCloud?.maybeMigrateLocalToCloud;
    if (typeof migrate !== 'function') return;
    await migrate(app, { reason: `pre-sync:${reason}` });
  } catch (error) {
    console.warn('Local→cloud migrate skipped:', error?.message || error);
  }
}

async function runCloudSync(app, force, reason) {
  console.log('🔄 Starting background sync with database...', { reason, force });
  // Push freemium/local library before cloud→local merge so upgrades do not leave data behind.
  await runLocalToCloudMigrate(app, reason);
  const syncResult = await pasteCraftSupabase.performFullSync();
  if (!syncResult.success) return handleCloudSyncFailure(syncResult);
  console.log('✅ Background sync complete:', syncResult.stats);
  await app.loadData();
  return 'ready';
}

export async function performBackgroundSync(app, { force = false, reason = 'background-sync' } = {}) {
  let cloudResolution = 'failed';
  try {
    const skipCloudSync = await shouldSkipCloudSync(app, force, reason);
    if (skipCloudSync) {
      // Still attempt one-shot upload when entitled (restore-skip only blocks pull).
      await runLocalToCloudMigrate(app, `skip-pull:${reason}`);
      cloudResolution = 'ready';
    } else {
      cloudResolution = await runCloudSync(app, force, reason);
    }
  } catch (error) {
    console.error('❌ Background sync error:', error);
  } finally {
    app.syncFeature?.loader?.finalizeCoreCloudHydration?.(app, cloudResolution);
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
  return el.classList.contains('is-visible');
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
    app.updateManualInputCategories();
    app.renderSearchResults();
    app.updateTopBarIdentity(app.userProfile?.profileImageUrl || undefined);
    app.maybeRefreshRefactorizationPanel?.();
  } finally {
    app._syncAutoRefreshInFlight = false;
  }

  if (isSyncProgressVisible()) {
    scheduleSyncAutoRefreshTick(app);
  }
}

async function refreshRealtimeClips(app) {
  await app.loadData();
  app.renderChips();
  app.updateLastCapture();
  app.renderSearchResults();
  app.maybeRefreshRefactorizationPanel?.();
}

async function refreshRealtimeCategories(app) {
  await app.loadData();
  app.renderCategories();
  app.updateCategoryFilter();
  app.updateManualInputCategories();
}

async function refreshRealtimeSettings(app) {
  await app.loadSettings();
}

async function refreshRealtimeProfile(app) {
  await app.loadUserProfile();
  app.updateTopBarIdentity(app.userProfile?.profileImageUrl || undefined);
}

const REALTIME_REFRESHERS = Object.freeze({
  clips: refreshRealtimeClips,
  archivedClips: refreshRealtimeClips,
  categories: refreshRealtimeCategories,
  settings: refreshRealtimeSettings,
  profile: refreshRealtimeProfile,
});

async function handleRealtimeDataChange(app, event) {
  const { type } = event.detail;
  console.log(`🔔 Realtime change detected: ${type}`);
  const refresh = REALTIME_REFRESHERS[type];
  if (refresh) await refresh(app);
}

export function setupRealtimeListeners(app) {
  window.addEventListener('dataChanged', (event) => handleRealtimeDataChange(app, event));
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

function shouldShowSyncProgress(current, total) {
  if (total <= 100) return false;
  return current < total;
}

function showSyncProgress(app, elements, progress) {
  const { progressContainer, progressFill, progressText } = elements;
  const { current, total, percentage } = progress;
  progressContainer.classList.add('is-visible');
  progressFill.style.width = `${percentage}%`;
  progressText.textContent = `${current} / ${total} (${percentage}%)`;
  scheduleSyncAutoRefreshTick(app);
}

function hideSyncProgress(app, elements) {
  const { progressContainer, progressFill, progressText } = elements;
  progressContainer.classList.remove('is-visible');
  progressFill.style.width = '0%';
  progressText.textContent = '0 / 0 (0%)';
  clearSyncAutoRefresh(app);
}

function hasSyncProgressElements(elements) {
  if (!elements.progressContainer) return false;
  if (!elements.progressFill) return false;
  return !!elements.progressText;
}

export function updateSyncProgress(app, current, total, percentage) {
  const elements = {
    progressContainer: document.getElementById('syncProgressContainer'),
    progressFill: document.getElementById('syncProgressFill'),
    progressText: document.getElementById('syncProgressText'),
  };
  
  if (!hasSyncProgressElements(elements)) return;
  
  if (shouldShowSyncProgress(current, total)) {
    showSyncProgress(app, elements, { current, total, percentage });
    return;
  }
  hideSyncProgress(app, elements);
}
