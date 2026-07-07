/**
 * Image → Text (#21) — Merchant content hook.
 * Uses shared region capture + OCR; Merchant sink = listing dock (Phase 2+).
 */

import { isRegionCaptureActive, capturePageRegion } from '../capture/capture.region.js';
import { extractTextFromImageDataUrl } from '../capture/capture.ocr.js';

let _captureArmed = false;

export function isImageToTextArmed() {
  return _captureArmed;
}

/** Toggle arm state; when armed, next activation runs region capture. */
export function toggleImageToTextPlaceholder() {
  _captureArmed = !_captureArmed;
  return {
    ok: true,
    armed: _captureArmed,
    phase: 1,
    message: _captureArmed
      ? 'Image → Text armed — click again to capture a region.'
      : 'Image → Text disarmed.',
  };
}

export function disarmImageToText() {
  _captureArmed = false;
}

/** Run capture when armed — stages to dock when OCR + dock integration ships. */
export async function runImageToTextCapture() {
  if (!_captureArmed) {
    return toggleImageToTextPlaceholder();
  }

  if (isRegionCaptureActive()) {
    return { ok: false, armed: true, message: 'Capture already in progress.' };
  }

  const capture = await capturePageRegion();
  if (!capture.ok) {
    return {
      ok: false,
      armed: _captureArmed,
      message: capture.error || 'Capture cancelled.',
    };
  }

  const ocr = await extractTextFromImageDataUrl(capture.dataUrl);
  _captureArmed = false;

  const dock = window.__pasteCraftMerchant?.dock;
  dock?.open();

  return {
    ok: true,
    armed: false,
    phase: ocr.phase,
    message: ocr.text
      ? 'Text extracted — dock integration ships in Phase 2.'
      : ocr.message || 'Region captured — OCR preview ships in Phase 2.',
    dataUrl: capture.dataUrl,
    text: ocr.text,
  };
}
