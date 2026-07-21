/** Standalone left-screen annotate popup page (?clipId=…). */

import { openClipImageAnnotate } from './clips.image-annotate.js';

function readClipId() {
  try {
    return String(new URLSearchParams(location.search).get('clipId') || '').trim();
  } catch (_) {
    return '';
  }
}

function setStatus(text) {
  const el = document.querySelector('[data-field="annotate-page-status"]');
  if (el) el.textContent = text || '';
}

function showToast(message) {
  const el = document.querySelector('[data-field="annotate-page-toast"]');
  if (!el) return;
  el.textContent = String(message || '');
  el.classList.add('is-visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('is-visible'), 2200);
}

const pageApp = {
  showToast: (msg) => showToast(msg),
  clipsFeature: null,
  currentClipViewerClip: null,
  clipViewerSourceContext: 'clips',
};

async function boot() {
  const clipId = readClipId();
  if (!clipId) {
    setStatus('Missing clip id.');
    return;
  }
  const result = await openClipImageAnnotate(pageApp, { clipId });
  if (!result?.ok) {
    setStatus('Could not open this image. Capture again with Image Picker.');
    return;
  }
  setStatus('');
  const status = document.querySelector('[data-field="annotate-page-status"]');
  if (status) status.style.display = 'none';

  // Page mode: Cancel / Esc closes the popup window.
  document.addEventListener(
    'click',
    (event) => {
      const btn = event.target.closest('[data-action="annotate-cancel"]');
      if (!btn) return;
      window.close();
    },
    true,
  );
}

boot().catch(() => setStatus('Failed to load annotate window.'));
