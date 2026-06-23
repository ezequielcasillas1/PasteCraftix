/**
 * Spot (#29) — Merchant content hook (Phase 1 placeholder).
 * Field detection, preset lists, and fill actions ship in Phase 2+.
 */

let _spotActive = false;

export function isSpotActive() {
  return _spotActive;
}

/** Phase 1: toggle visual state only; no page scanning yet. */
export function activateSpotPlaceholder() {
  _spotActive = true;
  return {
    ok: true,
    phase: 1,
    message: 'Spot foundation ready — field detection ships in Phase 2.',
  };
}

export function deactivateSpotPlaceholder() {
  _spotActive = false;
}

export function getSpotStatusLabel() {
  return _spotActive ? 'Spot active (preview)' : 'Spot idle';
}
