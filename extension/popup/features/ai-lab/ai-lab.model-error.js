/**
 * Model capability / unsupported-model errors for AI Lab.
 * Surfaces a clear switch-model message — never silent on known incapability.
 * @forward-slice
 */

import { isOutOfCreditsError, showCreditExhaustedInline } from './ai-lab.credit-error.js';
import {
  resolveShowcaseModelFromWorkflow,
  getShowcaseModelById,
} from './ai-lab.models.js';

export const MODEL_NOT_CAPABLE_MESSAGE =
  'This AI model is not capable of that request — choose a different model.';

const CAPABILITY_ERROR_PATTERNS = [
  'model not capable',
  'not capable of that request',
  'model_not_found',
  'model not found',
  'does not exist',
  'no such model',
  'unknown model',
  'invalid model',
  'unsupported model',
  'model is not supported',
  'not supported for',
  'does not support',
  'do not support',
  'unsupported for',
  'model unavailable',
  'provider rejected',
  'ai provider rejected',
  'does not support image',
  'does not support vision',
  'vision is not supported',
  'cannot process image',
  'unable to process the image',
  'content type is not supported',
  'media type is not supported',
];

function errorBlob(error) {
  if (!error) return '';
  const parts = [
    error.message,
    error.providerBody,
    error.detail,
    error.code,
    error.aiErrorCode,
  ];
  return parts.map((p) => String(p || '')).join(' ').toLowerCase();
}

export function formatModelNotCapableMessage(model) {
  const label = String(model?.label || '').trim();
  if (!label) return MODEL_NOT_CAPABLE_MESSAGE;
  return `${label} is not capable of that request — choose a different model.`;
}

export function getActiveShowcaseModel(app) {
  return resolveShowcaseModelFromWorkflow(app?.aiWorkflow)
    || getShowcaseModelById('gpt-4o');
}

/** Known text-only / fragile models that cannot do vision / image analysis. */
export function modelSupportsVision(model) {
  if (!model) return true;
  if (model.supportsVision === false) return false;
  if (model.supportsVision === true) return true;
  // Default: assume vision unless explicitly marked false.
  return true;
}

export function isModelNotCapableError(error) {
  if (!error) return false;
  if (error.isModelNotCapable === true) return true;
  if (String(error.code || error.aiErrorCode || '') === 'model_not_capable') return true;
  const msg = errorBlob(error);
  if (!msg) return false;
  // Credit errors take precedence elsewhere — do not mis-label them.
  if (isOutOfCreditsError(error)) return false;
  return CAPABILITY_ERROR_PATTERNS.some((p) => msg.includes(p));
}

/**
 * Preflight: throw a clear capability error when the selected model
 * cannot perform the requested action (e.g. vision on a text-only model).
 * @param {object} app
 * @param {'vision'|'text'} action
 */
export function assertModelCapableForAction(app, action) {
  const model = getActiveShowcaseModel(app);
  if (action === 'vision' && !modelSupportsVision(model)) {
    const err = new Error(formatModelNotCapableMessage(model));
    err.isModelNotCapable = true;
    err.aiErrorCode = 'model_not_capable';
    err.modelId = model?.id;
    throw err;
  }
}

export function showModelNotCapableInline(app, resultEl, loadingEl) {
  if (loadingEl) loadingEl.style.display = 'none';
  if (!resultEl) return;

  const model = getActiveShowcaseModel(app);
  const card = document.createElement('div');
  card.className = 'ai-model-incapable-card';
  card.setAttribute('role', 'alert');

  const titleEl = document.createElement('strong');
  titleEl.className = 'ai-model-incapable-title';
  titleEl.textContent = 'AI model is not capable';

  const textEl = document.createElement('p');
  textEl.className = 'ai-model-incapable-text';
  textEl.textContent = formatModelNotCapableMessage(model);

  const hintEl = document.createElement('p');
  hintEl.className = 'ai-model-incapable-hint';
  hintEl.textContent = 'Pick another model from the MODEL dropdown or showcase cards, then try again.';

  card.appendChild(titleEl);
  card.appendChild(textEl);
  card.appendChild(hintEl);

  resultEl.innerHTML = '';
  resultEl.appendChild(card);
}

/**
 * Unified AI Lab request failure presenter.
 * @returns {'credits'|'model'|'other'}
 */
export function presentAiLabError(app, error, {
  resultEl = null,
  loadingEl = null,
  fallbackMessage = 'AI request failed',
  toast = true,
} = {}) {
  if (isOutOfCreditsError(error)) {
    showCreditExhaustedInline(app, resultEl, loadingEl);
    return 'credits';
  }

  if (isModelNotCapableError(error)) {
    const message = formatModelNotCapableMessage(getActiveShowcaseModel(app));
    showModelNotCapableInline(app, resultEl, loadingEl);
    if (toast) app?.showToast?.(message, 'error');
    return 'model';
  }

  const message = String(error?.message || '').trim() || fallbackMessage;
  if (loadingEl) loadingEl.style.display = 'none';
  if (resultEl) {
    if (typeof resultEl.textContent === 'string') {
      resultEl.textContent = `❌ ${message}`;
    }
  }
  if (toast) app?.showToast?.(message, 'error');
  return 'other';
}
