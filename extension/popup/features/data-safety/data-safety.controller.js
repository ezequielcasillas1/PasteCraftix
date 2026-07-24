/** @forward-slice Data-safety feature init for freemium / local-only sessions. */

import { wireDataSafetyBanner, showDataSafetyBanner, hideDataSafetyBanner } from './data-safety.banner.js';
import {
  probeStoragePersistence,
  writeSafetyMeta,
  readSafetyMeta,
  clearUnhealthyFlag,
  isMarkedUnhealthy,
} from './data-safety.persistence.js';
import { assessDataLossRisk, maybeRecoverLocalData } from './data-safety.recover.js';

async function _isCloudSyncActive(app) {
  if (app?._isFreemiumGuest || !app?.currentUser?.id) return false;
  try {
    return !!(await pasteCraftSupabase?.hasCloudSyncAccess?.(app.currentUser.id));
  } catch (_) {
    return false;
  }
}

function _pickBannerMode({ unhealthy, risk, forceGuestBanner, isGuest }) {
  if (unhealthy) return 'unhealthy';
  if (risk.suspiciousEmpty || (risk.emptyNow && risk.hint?.hadData)) return 'lost';
  if (isGuest || forceGuestBanner) return 'guest';
  return null;
}

async function _handleRecoverySuccess(app, recovery) {
  showDataSafetyBanner('recovered', recovery.source || '');
  const label = recovery.source === 'idb' ? 'IndexedDB' : 'a restore point';
  app.showToast?.(`♻️ Recovered local data from ${label}`, 'success');
  await writeSafetyMeta(app, { lastHealthyAt: Date.now(), recoveredFrom: recovery.source });
}

async function _finalizeLocalCheck(app, { probe, recovery, forceGuestBanner }) {
  const risk = recovery.risk || await assessDataLossRisk(app);
  const unhealthy = !probe.ok || (await isMarkedUnhealthy());
  const mode = _pickBannerMode({
    unhealthy,
    risk,
    forceGuestBanner,
    isGuest: !!app._isFreemiumGuest,
  });
  if (mode) showDataSafetyBanner(mode);
  else hideDataSafetyBanner();

  const prevMeta = await readSafetyMeta();
  await writeSafetyMeta(app, {
    lastHealthyAt: probe.ok ? Date.now() : (prevMeta?.lastHealthyAt || 0),
    persistenceOk: probe.ok,
  });
  return { skipped: false, probe, recovery, risk, unhealthy };
}

/**
 * Run durability checks for guest / free-local users.
 * Paid cloud-sync users rely on Supabase rehydrate instead.
 */
export async function runDataSafetyCheck(app, options = {}) {
  const { forceGuestBanner = false } = options;
  wireDataSafetyBanner(app);

  if ((await _isCloudSyncActive(app)) && !forceGuestBanner) {
    hideDataSafetyBanner();
    await writeSafetyMeta(app, { cloudSync: true });
    return { skipped: true, reason: 'cloud-sync' };
  }

  const probe = await probeStoragePersistence();
  if (probe.ok) await clearUnhealthyFlag();

  const recovery = await maybeRecoverLocalData(app);
  if (recovery.recovered) {
    await _handleRecoverySuccess(app, recovery);
    return { skipped: false, probe, recovery };
  }

  return _finalizeLocalCheck(app, { probe, recovery, forceGuestBanner });
}

export function initDataSafetyFeature(app) {
  return {
    runCheck: (options) => runDataSafetyCheck(app, options),
    showBanner: showDataSafetyBanner,
    hideBanner: hideDataSafetyBanner,
  };
}
