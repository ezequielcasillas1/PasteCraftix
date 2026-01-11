function qs(id) {
  return document.getElementById(id);
}

function getParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}

async function main() {
  const noteId = getParam('noteId');
  const indexStr = getParam('index');
  const idx = Number(indexStr);

  const titleEl = qs('viewerTitle');
  const metaEl = qs('viewerMeta');
  const bodyEl = qs('viewerBody');
  const closeBtn = qs('closeBtn');
  const openBtn = qs('openBtn');

  if (closeBtn) closeBtn.addEventListener('click', () => window.close());

  if (!noteId || Number.isNaN(idx)) {
    if (titleEl) titleEl.textContent = 'Attachment';
    if (metaEl) metaEl.textContent = 'Missing parameters.';
    if (bodyEl) bodyEl.innerHTML = '<pre>Could not load attachment.</pre>';
    return;
  }

  const { notes = [] } = await chrome.storage.local.get(['notes']);
  const note = (Array.isArray(notes) ? notes : []).find(n => String(n.id) === String(noteId));

  if (!note) {
    if (metaEl) metaEl.textContent = 'Album not found.';
    if (bodyEl) bodyEl.innerHTML = '<pre>Could not load attachment.</pre>';
    return;
  }

  const allAttachments = [
    ...((note.clips || []).map(c => ({ ...c, type: 'clip' }))),
    ...((note.images || []).map(i => ({ ...i, type: 'image' }))),
    ...((note.urls || []).map(u => ({ ...u, type: 'url' })))
  ];

  const att = allAttachments[idx];
  if (!att) {
    if (metaEl) metaEl.textContent = 'Attachment not found.';
    if (bodyEl) bodyEl.innerHTML = '<pre>Could not load attachment.</pre>';
    return;
  }

  const albumTitle = (note.title || '').trim() || 'Untitled Album';
  const typeLabel = att.type === 'clip' ? 'Clip' : att.type === 'image' ? 'Image' : 'Link';
  if (titleEl) titleEl.textContent = `${typeLabel} - ${albumTitle}`;
  if (metaEl) metaEl.textContent = 'Close this window to return to PasteCraft.';

  if (att.type === 'clip') {
    const text = att.text || '';
    if (bodyEl) bodyEl.innerHTML = `<pre>${escapeHtml(text)}</pre>`;
    return;
  }

  if (att.type === 'image') {
    const src = att.dataUrl || att.url || att.src || '';
    if (!src) {
      if (bodyEl) bodyEl.innerHTML = '<pre>Image attachment is missing a source.</pre>';
      return;
    }
    if (bodyEl) bodyEl.innerHTML = `<img src="${escapeHtml(src)}" alt="Album attachment" />`;
    return;
  }

  const url = att.url || '';
  if (bodyEl) {
    bodyEl.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px;">
        <div style="font-weight:700;">Link</div>
        <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a>
      </div>
    `;
  }
  if (openBtn) {
    openBtn.style.display = 'inline-flex';
    openBtn.addEventListener('click', () => {
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    });
  }
}

main().catch((e) => {
  console.error('Attachment viewer failed:', e);
  const metaEl = qs('viewerMeta');
  const bodyEl = qs('viewerBody');
  if (metaEl) metaEl.textContent = 'Failed to load attachment.';
  if (bodyEl) bodyEl.innerHTML = '<pre>Could not load attachment.</pre>';
});


