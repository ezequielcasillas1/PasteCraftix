import { ensureSpotDefaults, readSpotPresets, saveSpotPresets } from './spot.service.js';

export function initSpotFeature(_app) {
  ensureSpotDefaults().catch((err) => {
    console.error('[spot.controller:init]', err);
  });

  return {
    readSpotPresets,
    saveSpotPresets,
    ensureSpotDefaults,
  };
}
