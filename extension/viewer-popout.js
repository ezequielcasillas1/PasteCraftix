import { loadViewerPopoutPayload } from './shared/viewer-shell/viewer-shell.popout.js';

function qs(id) {
  return document.getElementById(id);
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}

async function main() {
  const closeBtn = qs('closeBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => window.close());

  const id = getParam('id');
  const titleEl = qs('viewerTitle');
  const metaEl = qs('viewerMeta');
  const bodyEl = qs('viewerBody');

  if (!id) {
    if (titleEl) titleEl.textContent = 'PasteCraft Viewer';
    if (metaEl) metaEl.textContent = 'Missing viewer payload.';
    if (bodyEl) bodyEl.innerHTML = '<pre>Could not load content.</pre>';
    return;
  }

  const payload = await loadViewerPopoutPayload(id);
  if (!payload) {
    if (metaEl) metaEl.textContent = 'Viewer content expired or was already opened.';
    if (bodyEl) bodyEl.innerHTML = '<pre>Could not load content.</pre>';
    return;
  }

  if (titleEl) titleEl.textContent = payload.title || 'PasteCraft Viewer';
  if (metaEl) metaEl.textContent = 'Pop-out view · close this window to return to PasteCraft.';

  if (bodyEl) {
    if (payload.html) {
      bodyEl.innerHTML = payload.html;
    } else {
      bodyEl.innerHTML = `<pre>${escapeHtml(payload.text || '')}</pre>`;
    }
  }
}

main().catch((err) => {
  const bodyEl = qs('viewerBody');
  const metaEl = qs('viewerMeta');
  if (metaEl) metaEl.textContent = 'Failed to load viewer.';
  if (bodyEl) {
    bodyEl.innerHTML = `<pre>${escapeHtml(err?.message || String(err))}</pre>`;
  }
});
