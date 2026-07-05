import { pastecraftGetURL } from '../shared.js';

function pcSafeTrim(s, max) {
  const str = String(s ?? '');
  if (str.length <= max) return str;
  return str.slice(0, max) + '…';
}

function pcFirstUriFromUriList(uriList) {
  const raw = String(uriList || '').trim();
  if (!raw) return '';
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const l of lines) {
    if (l.startsWith('#')) continue;
    return l;
  }
  return '';
}

function pcTryParseUrl(s, baseUrl = '') {
  const t = String(s || '').trim();
  if (!t) return '';
  try {
    // Support relative URLs from dragged HTML (e.g., <img src="/img.png">).
    const u = baseUrl ? new URL(t, baseUrl) : new URL(t);
    return u.href;
  } catch (_) {
    return '';
  }
}

function pcTryParseAbsoluteHttpUrl(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  // Treat "www." as URL-like for user intent, normalize to https.
  const normalized = /^www\./i.test(t) ? `https://${t}` : t;
  if (!/^https?:\/\//i.test(normalized)) return '';
  try {
    const u = new URL(normalized);
    return u.href;
  } catch (_) {
    return '';
  }
}

function pcLooksLikeImageUrl(u) {
  const s = String(u || '').trim();
  if (!s) return false;
  return /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(s);
}

function pcParseHtmlForImageOrLink(html) {
  const out = { imgSrc: '', linkHref: '' };
  const raw = String(html || '');
  if (!raw) return out;
  try {
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    const img = doc.querySelector('img[src]');
    if (img) out.imgSrc = String(img.getAttribute('src') || '').trim();
    const a = doc.querySelector('a[href]');
    if (a) out.linkHref = String(a.getAttribute('href') || '').trim();
  } catch (_) {}
  return out;
}

function pcTextFromHtml(html) {
  const raw = String(html || '');
  if (!raw) return '';
  try {
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    const t = String((doc && doc.body && (doc.body.innerText || doc.body.textContent)) || '').trim();
    return t;
  } catch (_) {
    return '';
  }
}

function pcSelectionText() {
  try {
    const s = window.getSelection ? window.getSelection() : null;
    const t = s ? String(s.toString() || '').trim() : '';
    return t;
  } catch (_) {
    return '';
  }
}

export function setupClickAndDragCapture(widget) {
  if (widget._pcClickAndDragSetup) return;
  widget._pcClickAndDragSetup = true;

  ensureClickAndDragDropBox(widget);

  // Show drop box only during active drags, and only if enabled.
  widget._pcOnDragStart = (e) => {
    if (!widget.settings || widget.settings.clickAndDragEnabled !== true) return;
    // Ignore drags that originate from our own UI.
    const t = e && e.target ? e.target : null;
    if (t && (t.closest?.('#pastecraft-click-drag-dropbox') || t.closest?.('#pastecraft-floating-widget'))) return;

    widget._pcDragActive = true;
    showClickAndDragDropBox(widget);
  };

  widget._pcOnDragEnd = () => {
    if (!widget._pcDragActive) return;
    widget._pcDragActive = false;
    hideClickAndDragDropBox(widget);
  };

  document.addEventListener('dragstart', widget._pcOnDragStart, true);
  document.addEventListener('dragend', widget._pcOnDragEnd, true);
}

export function ensureClickAndDragDropBox(widget) {
  if (widget._pcDropBoxEl && document.body.contains(widget._pcDropBoxEl)) return;

  if (!document.getElementById('pastecraft-click-drag-dropbox-styles')) {
    const iconUrl = pastecraftGetURL('assets/distribute-spacing-vertical.svg');
    const style = document.createElement('style');
    style.id = 'pastecraft-click-drag-dropbox-styles';
    style.textContent = `
        #pastecraft-click-drag-dropbox {
          position: fixed;
          width: 64px;
          height: 64px;
          border-radius: 14px;
          z-index: 2147483647;
          opacity: 0;
          transform: scale(0.92);
          pointer-events: none;
          transition: opacity 140ms ease, transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
          border: 2px solid rgba(96, 165, 250, 0.25);
          box-shadow: -6px 0 24px rgba(0,0,0,0.18), 0 6px 26px rgba(30, 64, 175, 0.22);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }

        #pastecraft-click-drag-dropbox.pc-visible {
          opacity: 1;
          transform: scale(1);
          pointer-events: auto;
        }

        #pastecraft-click-drag-dropbox .pc-dropbox-inner {
          width: 100%;
          height: 100%;
          border-radius: 12px;
          /* 70% transparent background (alpha 0.3) */
          background: linear-gradient(135deg, rgba(30, 64, 175, 0.3) 0%, rgba(30, 58, 138, 0.3) 55%, rgba(29, 78, 216, 0.3) 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          user-select: none;
        }

        #pastecraft-click-drag-dropbox .pc-dropbox-icon {
          width: 26px;
          height: 26px;
          background: linear-gradient(135deg, #fbbf24 0%, #60a5fa 45%, #2563eb 100%);
          -webkit-mask: url("${iconUrl}") center / contain no-repeat;
          mask: url("${iconUrl}") center / contain no-repeat;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35));
        }

        #pastecraft-click-drag-dropbox .pc-dropbox-label {
          font-size: 10px;
          line-height: 1;
          font-weight: 700;
          color: rgba(255,255,255,0.92);
          letter-spacing: 0.2px;
        }

        #pastecraft-click-drag-dropbox.pc-hover {
          border-color: rgba(96, 165, 250, 0.75);
          box-shadow:
            0 0 0 4px rgba(59, 130, 246, 0.20),
            0 0 0 8px rgba(245, 158, 11, 0.16),
            -6px 0 28px rgba(0,0,0,0.22),
            0 10px 30px rgba(30, 64, 175, 0.25);
        }

        #pastecraft-click-drag-dropbox.pc-success {
          border-color: rgba(245, 158, 11, 0.85);
          box-shadow:
            0 0 0 4px rgba(245, 158, 11, 0.22),
            0 0 0 8px rgba(59, 130, 246, 0.18),
            -6px 0 28px rgba(0,0,0,0.22),
            0 10px 30px rgba(30, 64, 175, 0.25);
        }
      `;
    document.head.appendChild(style);
  }

  const el = document.createElement('div');
  el.id = 'pastecraft-click-drag-dropbox';
  el.innerHTML = `
      <div class="pc-dropbox-inner" aria-hidden="true">
        <div class="pc-dropbox-icon"></div>
        <div class="pc-dropbox-label">Drop</div>
      </div>
    `;

  // Drag-over behavior (allow drop)
  el.addEventListener('dragenter', (e) => {
    e.preventDefault();
    el.classList.add('pc-hover');
  });
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    try {
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    } catch (_) {}
    el.classList.add('pc-hover');
  });
  el.addEventListener('dragleave', (e) => {
    // Only remove hover if actually leaving the element.
    const rt = e.relatedTarget;
    if (rt && el.contains(rt)) return;
    el.classList.remove('pc-hover');
  });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('pc-hover');
    const dt = e.dataTransfer || null;
    (async () => {
      const saved = await saveClickAndDragFromDataTransfer(widget, dt);
      if (saved) {
        flashClickAndDragDropBoxSuccess(widget);
        widget.showWidgetToast('Saved to Clips');
      } else {
        widget.showWidgetToast('Nothing to save');
      }
    })();
  });

  document.body.appendChild(el);
  widget._pcDropBoxEl = el;
}

export function positionClickAndDragDropBox(widget) {
  const el = widget._pcDropBoxEl;
  if (!el) return;

  const size = 64;
  const gap = 12;
  const rect = widget.widget ? widget.widget.getBoundingClientRect() : null;

  const x = rect
    ? Math.max(8, Math.round(rect.left - gap - size))
    : Math.max(8, window.innerWidth - 140);
  const y = rect
    ? Math.max(8, Math.round(rect.top + rect.height / 2 - size / 2))
    : Math.max(8, Math.round(window.innerHeight / 2 - size / 2));

  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

export function showClickAndDragDropBox(widget) {
  ensureClickAndDragDropBox(widget);
  positionClickAndDragDropBox(widget);
  if (!widget._pcDropBoxEl) return;
  widget._pcDropBoxEl.classList.add('pc-visible');
  widget._pcDropBoxVisible = true;
}

export function hideClickAndDragDropBox(widget, immediate = false) {
  if (!widget._pcDropBoxEl) return;
  widget._pcDropBoxEl.classList.remove('pc-hover');
  widget._pcDropBoxEl.classList.remove('pc-success');
  widget._pcDropBoxEl.classList.remove('pc-visible');
  widget._pcDropBoxVisible = false;
  if (immediate) {
    // Force-hide immediately (some pages can keep transitions running).
    widget._pcDropBoxEl.style.opacity = '0';
    widget._pcDropBoxEl.style.pointerEvents = 'none';
    setTimeout(() => {
      if (!widget._pcDropBoxVisible && widget._pcDropBoxEl) {
        widget._pcDropBoxEl.style.opacity = '';
        widget._pcDropBoxEl.style.pointerEvents = '';
      }
    }, 0);
  }
}

export function flashClickAndDragDropBoxSuccess(widget) {
  if (!widget._pcDropBoxEl) return;
  widget._pcDropBoxEl.classList.add('pc-success');
  clearTimeout(widget._pcDropBoxSuccessTimer);
  widget._pcDropBoxSuccessTimer = setTimeout(() => {
    if (widget._pcDropBoxEl) widget._pcDropBoxEl.classList.remove('pc-success');
  }, 650);
}

export async function saveClickAndDragFromDataTransfer(widget, dt) {
  if (!dt) return false;
  if (!widget.settings || widget.settings.clickAndDragEnabled !== true) return false;

  const MAX_TEXT = 30000;
  const MAX_HTML = 50000;

  let plain = '';
  let html = '';
  let uriList = '';
  try { plain = dt.getData('text/plain') || ''; } catch (_) {}
  try { html = dt.getData('text/html') || ''; } catch (_) {}
  try { uriList = dt.getData('text/uri-list') || ''; } catch (_) {}

  const { imgSrc, linkHref } = pcParseHtmlForImageOrLink(html);
  const uriFromList = pcFirstUriFromUriList(uriList);

  const sourcePageUrl = String(location && location.href ? location.href : '');
  const capturedAt = Date.now();

  // Build best-effort text candidate early; used to prevent URL payloads overriding highlighted text.
  const fromPlain = String(plain || '').trim();
  const fromHtml = pcTextFromHtml(html);
  const fromSelection = pcSelectionText();
  const textCandidate = (fromPlain || fromHtml || fromSelection || '').trim();
  // IMPORTANT: do NOT treat arbitrary text as a URL just because it can be resolved as a relative URL.
  const textLooksUrl = !!pcTryParseAbsoluteHttpUrl(textCandidate);

  // 1) Image (match existing "Copy Image to PasteCraft": kind=image with srcUrl)
  const imgAbs = pcTryParseUrl(imgSrc, sourcePageUrl);
  const uriAbs = pcTryParseUrl(uriFromList, sourcePageUrl);
  const imageUrl = imgAbs || (pcLooksLikeImageUrl(uriAbs) ? uriAbs : '');

  if (imageUrl) {
    const meta = {
      kind: 'image',
      plainText: '',
      html: '',
      url: '',
      image: { mime: '', dataUrl: '', srcUrl: pcSafeTrim(imageUrl, 4000) },
      sourcePageUrl: pcSafeTrim(sourcePageUrl, 4000),
      capturedAt
    };

    await chrome.runtime.sendMessage({
      action: 'saveClip',
      text: pcSafeTrim(imageUrl, MAX_TEXT),
      meta,
      category: 'Uncategorized',
      autoShow: false
    });
    return true;
  }

  // 2) Text (prefer highlighted text over URL payloads, unless text is itself a URL)
  if (textCandidate && !textLooksUrl) {
    const meta = {
      kind: 'text',
      plainText: pcSafeTrim(textCandidate, MAX_TEXT),
      html: pcSafeTrim(html, MAX_HTML),
      url: '',
      sourcePageUrl: pcSafeTrim(sourcePageUrl, 4000),
      capturedAt
    };

    await chrome.runtime.sendMessage({
      action: 'saveClip',
      text: pcSafeTrim(textCandidate, MAX_TEXT),
      meta,
      category: 'Uncategorized',
      autoShow: false
    });
    return true;
  }

  // 3) URL
  const linkAbs = pcTryParseUrl(linkHref, sourcePageUrl);
  const url = uriAbs || linkAbs || (textLooksUrl ? pcTryParseAbsoluteHttpUrl(textCandidate) : '') || '';
  if (url) {
    const meta = {
      kind: 'url',
      plainText: pcSafeTrim(url, MAX_TEXT),
      html: '',
      url: pcSafeTrim(url, 4000),
      sourcePageUrl: pcSafeTrim(sourcePageUrl, 4000),
      capturedAt
    };

    await chrome.runtime.sendMessage({
      action: 'saveClip',
      text: pcSafeTrim(url, MAX_TEXT),
      meta,
      category: 'Uncategorized',
      autoShow: false
    });
    return true;
  }

  // 4) Text fallback (even if it looks like a URL, if we got here there's nothing else)
  if (textCandidate) {
    const meta = {
      kind: 'text',
      plainText: pcSafeTrim(textCandidate, MAX_TEXT),
      html: pcSafeTrim(html, MAX_HTML),
      url: '',
      sourcePageUrl: pcSafeTrim(sourcePageUrl, 4000),
      capturedAt
    };

    await chrome.runtime.sendMessage({
      action: 'saveClip',
      text: pcSafeTrim(textCandidate, MAX_TEXT),
      meta,
      category: 'Uncategorized',
      autoShow: false
    });
    return true;
  }

  return false;
}
