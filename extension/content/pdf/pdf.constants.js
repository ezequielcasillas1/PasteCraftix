/** @forward-slice PDF viewer capture — timing and text limits. */

export const PDF_CLIPBOARD_MAX_TEXT = 30000;
export const PDF_READ_DELAY_MS = 60;
export const PDF_POLL_INTERVAL_MS = 700;
export const PDF_PERMISSION_DENIED_COOLDOWN_MS = 4000;

export const PDF_CAPTURE_HINT =
  ' PDF: select text, then Ctrl+C to save (highlight-release is blocked by the browser PDF viewer).';
