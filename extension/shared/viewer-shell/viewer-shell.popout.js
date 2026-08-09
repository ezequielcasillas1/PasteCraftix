/**
 * Serialize modal body → temporary storage → open viewer-popout window.
 */

import {
  VIEWER_POPOUT_HEIGHT,
  VIEWER_POPOUT_PAGE,
  VIEWER_POPOUT_STORAGE_PREFIX,
  VIEWER_POPOUT_WIDTH,
} from './viewer-shell.constants.js';
import { resolveExtensionPageUrl } from '../image-annotate-window.js';

function makePayloadId() {
  return `v${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function stripUnsafeHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  template.content
    .querySelectorAll('script, iframe, object, embed, link[rel="import"]')
    .forEach((node) => node.remove());
  template.content.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = String(attr.value || '');
      if (name.startsWith('on') || value.trim().toLowerCase().startsWith('javascript:')) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return template.innerHTML;
}

function resolveOverlayTitle(overlay) {
  const titleEl =
    overlay.querySelector('.modal-header h3') ||
    overlay.querySelector('[id$="Title"], [id$="TitleText"]') ||
    overlay.querySelector('h3, h2');
  const text = (titleEl?.textContent || '').replace(/\s+/g, ' ').trim();
  return text || 'PasteCraft Viewer';
}

function resolveOverlayBody(overlay) {
  return (
    overlay.querySelector('.modal-body') ||
    overlay.querySelector('.clip-viewer-body') ||
    overlay.querySelector('.note-viewer-body') ||
    overlay.querySelector('.upgrade-modal-body') ||
    overlay.querySelector('.image-viewer-body') ||
    overlay
  );
}

function buildPopoutPayload(overlay) {
  const body = resolveOverlayBody(overlay);
  const title = resolveOverlayTitle(overlay);
  const html = stripUnsafeHtml(body?.innerHTML || '');
  const text = (body?.innerText || body?.textContent || '').trim();
  return {
    title,
    html,
    text,
    sourceId: overlay.id || '',
    createdAt: Date.now(),
  };
}

async function storePopoutPayload(payload) {
  const id = makePayloadId();
  const key = `${VIEWER_POPOUT_STORAGE_PREFIX}${id}`;
  const bag = { [key]: payload };
  try {
    if (chrome.storage?.session?.set) {
      await chrome.storage.session.set(bag);
    } else {
      await chrome.storage.local.set(bag);
    }
  } catch (_) {
    await chrome.storage.local.set(bag);
  }
  return id;
}

function openPopoutWindow(url) {
  const payload = {
    action: 'pcOpenPopupWindow',
    url,
    width: VIEWER_POPOUT_WIDTH,
    height: VIEWER_POPOUT_HEIGHT,
  };
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(payload, (response) => {
        const err = chrome.runtime.lastError;
        if (err || response?.success === false) {
          chrome.windows
            .create({
              url,
              type: 'popup',
              width: VIEWER_POPOUT_WIDTH,
              height: VIEWER_POPOUT_HEIGHT,
              focused: true,
            })
            .then(() => resolve(true))
            .catch(() => resolve(false));
          return;
        }
        resolve(true);
      });
    } catch (_) {
      try {
        chrome.windows.create({
          url,
          type: 'popup',
          width: VIEWER_POPOUT_WIDTH,
          height: VIEWER_POPOUT_HEIGHT,
          focused: true,
        });
        resolve(true);
      } catch (e) {
        resolve(false);
      }
    }
  });
}

/** Open a larger popup window with a snapshot of the overlay body. */
export async function openViewerShellPopout(overlay) {
  if (!overlay) return { ok: false, error: 'missing_overlay' };
  const payload = buildPopoutPayload(overlay);
  if (!payload.html && !payload.text) {
    return { ok: false, error: 'empty_body' };
  }
  const id = await storePopoutPayload(payload);
  const finalUrl = resolveExtensionPageUrl(
    VIEWER_POPOUT_PAGE,
    `id=${encodeURIComponent(id)}`,
  );
  const ok = await openPopoutWindow(finalUrl);
  return { ok, id };
}

async function takeFromSession(key) {
  try {
    if (!chrome.storage?.session?.get) return null;
    const session = await chrome.storage.session.get(key);
    const data = session?.[key] || null;
    if (data) await chrome.storage.session.remove(key);
    return data;
  } catch (_) {
    return null;
  }
}

async function takeFromLocal(key) {
  const local = await chrome.storage.local.get(key);
  const data = local?.[key] || null;
  if (data) await chrome.storage.local.remove(key).catch(() => {});
  return data;
}

/** Load + consume a popout payload by id (used by viewer-popout.html). */
export async function loadViewerPopoutPayload(id) {
  if (!id) return null;
  const key = `${VIEWER_POPOUT_STORAGE_PREFIX}${id}`;
  return (await takeFromSession(key)) || (await takeFromLocal(key));
}
