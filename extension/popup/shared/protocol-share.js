/** Open mailto: from popup without blank tabs (Windows). */

export function openProtocolUrl(url) {
  const href = String(url);
  try {
    const link = document.createElement('a');
    link.href = href;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  } catch (_) {}
  try {
    window.location.href = href;
  } catch (e) {
    console.error('[protocol-share] Failed to open protocol URL:', e);
  }
}

export function openEmailShare({ subject = '', body = '' }) {
  openProtocolUrl(
    `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  );
}
