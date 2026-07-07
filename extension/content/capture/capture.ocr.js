/** @forward-slice OCR orchestration — Phase 1 stub; hybrid pipeline in Phase 2. */

import { CAPTURE_OCR_PHASE } from './capture.constants.js';

/**
 * Extract text from a cropped image data URL.
 * Phase 1: returns empty text for manual entry in preview modal.
 */
export async function extractTextFromImageDataUrl(_dataUrl) {
  return {
    ok: true,
    text: '',
    phase: CAPTURE_OCR_PHASE,
    message: 'Local OCR ships in Phase 2 — edit text in the preview before saving.',
  };
}
