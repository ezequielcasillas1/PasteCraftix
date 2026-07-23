/** @forward-slice Detect native browser PDF viewer pages (Chrome/Edge/Brave). */

const PDF_EXT_RE = /\.pdf(?:$|[?#])/i;

export function isPdfUrl(rawUrl = '') {
  const url = String(rawUrl || '');
  if (!url) return false;
  if (PDF_EXT_RE.test(url)) return true;
  try {
    const u = new URL(url);
    const path = `${u.pathname || ''}${u.search || ''}`;
    return PDF_EXT_RE.test(path);
  } catch (_) {
    return false;
  }
}

export function isPdfContentType() {
  try {
    const ct = String(document.contentType || '').toLowerCase();
    return ct.includes('application/pdf') || ct.includes('application/x-google-chrome-pdf');
  } catch (_) {
    return false;
  }
}

export function hasPdfEmbed() {
  try {
    if (document.querySelector('embed[type*="pdf" i], object[type*="pdf" i]')) return true;
    if (document.querySelector('embed[src*=".pdf" i], object[data*=".pdf" i]')) return true;
    const embeds = document.querySelectorAll('embed, object');
    if (embeds.length === 1 && isPdfUrl(location.href)) return true;
  } catch (_) {}
  return false;
}

/** True when PasteCraft is running on a browser PDF viewer shell page. */
export function isPdfViewerPage(rawUrl = location.href) {
  if (isPdfUrl(rawUrl)) return true;
  if (isPdfContentType()) return true;
  if (hasPdfEmbed()) return true;
  return false;
}
