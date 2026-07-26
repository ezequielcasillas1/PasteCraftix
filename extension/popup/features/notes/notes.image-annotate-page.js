/** Standalone left-screen annotate popup for notes (?session=…). */

import { openNoteImageAnnotateFromSession } from './notes.image-annotate.js';

function readSessionId() {
  try {
    return String(new URLSearchParams(location.search).get('session') || '').trim();
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
};

async function boot() {
  const sessionId = readSessionId();
  if (!sessionId) {
    setStatus('Missing annotate session.');
    return;
  }
  const result = await openNoteImageAnnotateFromSession(pageApp, sessionId);
  if (!result?.ok) {
    setStatus('Could not open this image. Re-open Image Picker and try again.');
    return;
  }
  setStatus('');
  const status = document.querySelector('[data-field="annotate-page-status"]');
  if (status) status.style.display = 'none';

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
