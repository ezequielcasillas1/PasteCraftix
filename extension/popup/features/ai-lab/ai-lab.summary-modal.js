/** Navigate to AI Lab summary tab with clip text prefilled. */

import { clearSummaryAiContext } from './ai-lab.session-state.js';

const IMAGE_CLIP_PLACEHOLDER = /^image clip$/i;
const IMAGE_SUMMARY_INSTRUCTION = 'Describe and summarize this image.';
const SUMMARY_IMAGE_MAX_DIM = 1024;
const SUMMARY_IMAGE_MAX_CHARS = 900_000;

function _escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function _loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Allow canvas export when the source is a same-origin blob/data URL or CORS-enabled remote.
    if (/^https?:\/\//i.test(src)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('summary_image_load_failed'));
    img.src = src;
  });
}

async function _httpUrlToDataUrl(url) {
  const resp = await fetch(url, { credentials: 'omit', cache: 'force-cache' });
  if (!resp.ok) throw new Error(`summary_image_fetch_${resp.status}`);
  const blob = await resp.blob();
  if (!String(blob.type || '').startsWith('image/')) {
    throw new Error('summary_image_not_image');
  }
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result.startsWith('data:image/')) reject(new Error('summary_image_read_failed'));
      else resolve(result);
    };
    reader.onerror = () => reject(reader.error || new Error('summary_image_read_failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Normalize any clip image src to a compact JPEG data URL.
 * Remote http(s) URLs are fetched/inlined — Gemini rejects remote image_url fetches.
 */
async function _downscaleSummaryImage(rawSrc) {
  let src = typeof rawSrc === 'string' ? rawSrc.trim() : '';
  if (!src) return '';

  if (/^https?:\/\//i.test(src)) {
    try {
      src = await _httpUrlToDataUrl(src);
    } catch (_) {
      // Fall through — canvas path may still work with crossOrigin if the host allows it.
    }
  }

  if (!src.startsWith('data:image/') && !/^https?:\/\//i.test(src)) return '';

  try {
    const image = await _loadImageElement(src);
    const width = image.naturalWidth || image.width || SUMMARY_IMAGE_MAX_DIM;
    const height = image.naturalHeight || image.height || SUMMARY_IMAGE_MAX_DIM;
    const scale = Math.min(1, SUMMARY_IMAGE_MAX_DIM / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      return src.startsWith('data:image/') ? src : '';
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    // Always re-encode to JPEG for provider compatibility (PNG/WebP/SVG data URLs can 400).
    const attempts = [
      ['image/jpeg', 0.8],
      ['image/jpeg', 0.65],
      ['image/jpeg', 0.5],
    ];
    let best = '';
    for (const [type, quality] of attempts) {
      const candidate = canvas.toDataURL(type, quality);
      if (!best || candidate.length < best.length) best = candidate;
      if (candidate.length <= SUMMARY_IMAGE_MAX_CHARS) return candidate;
    }
    return best || (src.startsWith('data:image/') ? src : '');
  } catch (_) {
    return src.startsWith('data:image/') ? src : '';
  }
}

function _activateSummaryTab() {
  const aiTab = document.querySelector('[data-tab="ai"]');
  const summarySubTab = document.querySelector('[data-ai-tab="summary"]');
  const aiTabContent = document.getElementById('aiTab');
  const summarySection = document.getElementById('aiSummarySection');
  if (!aiTab || !summarySubTab || !aiTabContent || !summarySection) return false;

  document.querySelectorAll('.tab-btn').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach((t) => t.classList.remove('active'));
  aiTab.classList.add('active');
  aiTabContent.classList.add('active');

  document.querySelectorAll('.ai-lab-tab').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('.ai-lab-section').forEach((s) => s.classList.remove('active'));
  summarySubTab.classList.add('active');
  summarySection.classList.add('active');
  return true;
}

function _normalizeSummaryPrefillText(text, imageBase64) {
  const nextText = String(text ?? '');
  const trimmed = nextText.trim();
  if (imageBase64 && (!trimmed || IMAGE_CLIP_PLACEHOLDER.test(trimmed))) {
    return IMAGE_SUMMARY_INSTRUCTION;
  }
  return nextText;
}

/** Shared study preview used on questions step + paginated result chat. */
function _renderStudyImagePreview(hostId, imageBase64) {
  const host = document.getElementById(hostId);
  if (!host) return;

  if (!imageBase64) {
    host.style.display = 'none';
    host.innerHTML = '';
    return;
  }

  const safeSrc = _escapeAttr(imageBase64);
  const canPreview = imageBase64.startsWith('data:image/') || /^https?:\/\//i.test(imageBase64);
  if (!canPreview) {
    host.style.display = 'none';
    host.innerHTML = '';
    return;
  }

  host.style.display = 'flex';
  host.innerHTML = `
    <span class="summary-questions-image-label">Reference image</span>
    <img class="summary-questions-image-preview" alt="Attached clip image for study" src="${safeSrc}">
  `;
}

/** Show/hide the summary image attachment indicator (+ questions/result study previews). */
export function renderSummaryImageAttach(app) {
  const host = document.getElementById('summaryImageAttach');
  const imageBase64 = typeof app?.currentSummaryImageBase64 === 'string'
    ? app.currentSummaryImageBase64
    : '';

  _renderStudyImagePreview('summaryQuestionsImage', imageBase64);
  _renderStudyImagePreview('summaryResultImage', imageBase64);

  if (!host) return;

  if (!imageBase64) {
    host.style.display = 'none';
    host.innerHTML = '';
    return;
  }

  const safeSrc = _escapeAttr(imageBase64);
  const canThumb = imageBase64.startsWith('data:image/') || /^https?:\/\//i.test(imageBase64);
  const thumbHtml = canThumb
    ? `<img class="summary-image-thumb" alt="" src="${safeSrc}">`
    : '';

  host.style.display = 'flex';
  host.innerHTML = `${thumbHtml}<span class="summary-image-attach-label">Image attached — the selected model will analyze the image</span>`;
}

export function clearSummaryAttachedImage(app) {
  if (app) app.currentSummaryImageBase64 = null;
  renderSummaryImageAttach(app);
}

/**
 * @param {*} app
 * @param {string} text
 * @param {{ imageBase64?: string }} [opts]
 */
export async function showSummaryModal(app, text, opts = {}) {
  const summaryInput = document.getElementById('summaryInput');
  if (!summaryInput || !_activateSummaryTab()) return;

  clearSummaryAiContext(app);

  const rawImage = typeof opts?.imageBase64 === 'string' ? opts.imageBase64.trim() : '';
  const imageBase64 = rawImage ? await _downscaleSummaryImage(rawImage) : '';
  const nextText = _normalizeSummaryPrefillText(text, imageBase64);

  app.currentSummaryImageBase64 = imageBase64 || null;
  renderSummaryImageAttach(app);

  summaryInput.value = nextText;
  summaryInput.dispatchEvent(new Event('input'));
  summaryInput.scrollTop = 0;
  summaryInput.focus();

  const clipCount = (nextText.match(/\n\n---\n\n/g) || []).length + 1;
  if (clipCount > 1) {
    app.showToast(`${clipCount} clips added to summary (scroll to see all)`);
  }

  app.saveToAnalysisHistory(nextText, 'summary-initiated');

  app._saveSummaryState();
  app._currentAiLabSubTab = 'summary';
  app._saveActiveTabState();

  app.clearAllSelections();
}
