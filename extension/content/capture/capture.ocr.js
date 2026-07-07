/** @forward-slice OCR orchestration — Phase 1 stub. */

import { CAPTURE_OCR_PHASE } from './capture.constants.js';

export async function extractTextFromImageDataUrl(_dataUrl) {
  return {
    ok: true,
    text: '',
    phase: CAPTURE_OCR_PHASE,
    message: 'Edit text below, then save — full OCR ships in Phase 2.',
  };
}
