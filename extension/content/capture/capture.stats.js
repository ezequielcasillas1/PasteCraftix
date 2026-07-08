/** @forward-slice Capture Tools clip counter — mirrors auto-copy daily stats. */

import { CAPTURE_STORAGE_KEYS } from './capture.constants.js';

function todayKey() {
  return new Date().toDateString();
}

export async function loadCaptureToolsStats() {
  try {
    const keys = [
      CAPTURE_STORAGE_KEYS.TOOLS_COUNT,
      CAPTURE_STORAGE_KEYS.TOOLS_DATE,
      CAPTURE_STORAGE_KEYS.TOOLS_SPOT_COUNT,
      CAPTURE_STORAGE_KEYS.TOOLS_IMAGE_COUNT,
    ];
    const stored = await chrome.storage.local.get(keys);
    const date = stored[CAPTURE_STORAGE_KEYS.TOOLS_DATE];
    const today = todayKey();

    if (date !== today) {
      return { count: 0, spotCount: 0, imageCount: 0, date: today };
    }

    return {
      count: Number(stored[CAPTURE_STORAGE_KEYS.TOOLS_COUNT]) || 0,
      spotCount: Number(stored[CAPTURE_STORAGE_KEYS.TOOLS_SPOT_COUNT]) || 0,
      imageCount: Number(stored[CAPTURE_STORAGE_KEYS.TOOLS_IMAGE_COUNT]) || 0,
      date: today,
    };
  } catch (err) {
    console.error('[capture.stats:load]', err);
    return { count: 0, spotCount: 0, imageCount: 0, date: todayKey() };
  }
}

/**
 * @param {'spot' | 'image-picker'} source
 */
export async function incrementCaptureToolsStats(source) {
  const current = await loadCaptureToolsStats();
  const next = {
    count: current.count + 1,
    spotCount: current.spotCount + (source === 'spot' ? 1 : 0),
    imageCount: current.imageCount + (source === 'image-picker' ? 1 : 0),
    date: todayKey(),
  };

  await chrome.storage.local.set({
    [CAPTURE_STORAGE_KEYS.TOOLS_COUNT]: next.count,
    [CAPTURE_STORAGE_KEYS.TOOLS_DATE]: next.date,
    [CAPTURE_STORAGE_KEYS.TOOLS_SPOT_COUNT]: next.spotCount,
    [CAPTURE_STORAGE_KEYS.TOOLS_IMAGE_COUNT]: next.imageCount,
  });

  return next;
}

export function formatCaptureToolsCounter(stats) {
  const n = stats?.count || 0;
  return `${n} clip${n !== 1 ? 's' : ''}`;
}

export function formatCaptureToolsTooltip(stats) {
  const spot = stats?.spotCount || 0;
  const image = stats?.imageCount || 0;
  const total = stats?.count || 0;
  if (total === 0) return 'Capture Tools — Spot & Image Picker';
  return `Capture Tools — ${total} saved today (${spot} spot · ${image} image)`;
}
