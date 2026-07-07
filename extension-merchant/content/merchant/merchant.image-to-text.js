/**
 * Image → Text (#21) — Merchant content hook (Phase 1 placeholder).
 * Snipping OCR, hybrid fallback, and clip save ship in Phase 2+.
 */

let _captureArmed = false;

export function isImageToTextArmed() {
  return _captureArmed;
}

/** Phase 1: arm/disarm stub only; no region capture yet. */
export function toggleImageToTextPlaceholder() {
  _captureArmed = !_captureArmed;
  return {
    ok: true,
    armed: _captureArmed,
    phase: 1,
    message: _captureArmed
      ? 'Image → Text armed — snipping capture ships in Phase 2.'
      : 'Image → Text disarmed.',
  };
}

export function disarmImageToText() {
  _captureArmed = false;
}
