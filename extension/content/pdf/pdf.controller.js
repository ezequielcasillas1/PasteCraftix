/** @forward-slice PDF viewer capture controller — clipboard bridge for plugin selections. */

import { isPdfViewerPage } from './pdf.detect.js';
import {
  subscribePdfClipboardCapture,
  getPdfCaptureHint,
} from './pdf.capture.js';
import {
  readClipboardPlainText,
  setClipboardPermissionDeniedHandler,
} from './pdf.clipboard.js';

/**
 * Register PDF capture facade on PDF viewer pages (and no-op bridge elsewhere).
 * Widget Spot / auto-copy subscribe via imports or `window.__pasteCraftPdf`.
 */
export async function initPdfLayer() {
  if (window.__pasteCraftPdf?.isMounted?.()) {
    return window.__pasteCraftPdf;
  }

  const activePage = isPdfViewerPage();

  window.__pasteCraftPdf = {
    isPdfViewerPage,
    subscribePdfClipboardCapture,
    getPdfCaptureHint,
    readClipboardPlainText,
    setClipboardPermissionDeniedHandler,
    isActivePage() {
      return activePage;
    },
    isMounted() {
      return true;
    },
  };

  return window.__pasteCraftPdf;
}
