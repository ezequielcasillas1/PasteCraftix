import {
  AI_ALLOWED_PROVIDERS,
  AI_CREDIT_COSTS,
  AI_PROVIDER_PRESETS,
} from './ai-lab.constants.js';
import { getCreditsElements, getWorkflowElements } from './ai-lab.selectors.js';

export function _normalizeAiWorkflow(raw) {
  const obj = (raw && typeof raw === 'object') ? raw : {};
  const enabled = obj.enabled === true;
  const providerValue = String(obj.provider || 'openai');
  const provider = AI_ALLOWED_PROVIDERS.has(providerValue) ? providerValue : 'openai';
  const presets = AI_PROVIDER_PRESETS[provider] || AI_PROVIDER_PRESETS.openai;
  const allowedPresets = new Set(presets.map(p => p.value));
  const presetValue = String(obj.preset || 'default');
  const preset = allowedPresets.has(presetValue) ? presetValue : 'default';
  const updatedAt = Number.isFinite(Number(obj.updatedAt)) ? Number(obj.updatedAt) : 0;

  return { enabled, provider, preset, updatedAt };
}

export async function loadAiWorkflow() {
  const key = this._aiWorkflowKey;
  const defaults = { enabled: false, provider: 'openai', preset: 'default', updatedAt: 0 };
  const syncCfg = await _readSyncWorkflow(key);
  const localCfg = await _readLocalWorkflow(key);
  const fromSync = this._normalizeAiWorkflow(syncCfg ? syncCfg[key] : null);
  const fromLocal = this._normalizeAiWorkflow(localCfg ? localCfg[key] : null);
  const hasSync = !!(syncCfg && syncCfg[key]);
  const hasLocal = !!(localCfg && localCfg[key]);
  const preferSync = hasSync && fromSync.updatedAt >= fromLocal.updatedAt;
  const next = preferSync ? fromSync : (hasLocal ? fromLocal : defaults);

  this.aiWorkflow = this._normalizeAiWorkflow(next);
  try { await chrome.storage.local.set({ [key]: this.aiWorkflow }); } catch (_) {}

  this.applyAiWorkflowToUi();
  return this.aiWorkflow;
}

export function applyAiWorkflowToUi() {
  try {
    const { toggle, providerEl, presetEl } = getWorkflowElements();
    const cfg = this._normalizeAiWorkflow(this.aiWorkflow);
    this.aiWorkflow = cfg;

    if (toggle) toggle.checked = !!cfg.enabled;
    if (providerEl) providerEl.value = cfg.provider || 'openai';
    _renderPresetOptions(presetEl, cfg);

    const disabled = !cfg.enabled;
    if (providerEl) providerEl.disabled = disabled;
    if (presetEl) presetEl.disabled = disabled;
  } catch (_) {}
}

export async function saveAiWorkflowFromUi(silent = true) {
  const key = this._aiWorkflowKey;
  const snapshot = window.PasteCraftCRUD.createSnapshot(this.aiWorkflow);
  const rollback = () => _rollbackWorkflow(this, key, snapshot);

  try {
    const next = _readWorkflowFromUi(this);
    this.aiWorkflow = next;
    this.applyAiWorkflowToUi();

    await window.PasteCraftCRUD.retryOperation(async () => {
      await chrome.storage.local.set({ [key]: this.aiWorkflow });
    });

    try {
      await new Promise((resolve) => chrome.storage.sync.set({ [key]: this.aiWorkflow }, resolve));
    } catch (_) {}

    await _verifyWorkflowPersisted(this, key);
    _syncWorkflowToSupabaseClient(this.aiWorkflow);

    if (!silent) this.showToast('✅ AI workflow saved!');
    return this.aiWorkflow;
  } catch (error) {
    console.error('❌ AI workflow save failed, rolling back:', error);
    await rollback();
    if (!silent) this.showToast(`❌ Failed to save AI workflow: ${error.message || 'Unknown error'}`, 'error');
    return null;
  }
}

export function _computeAiImageCreditsView(subscription) {
  if (!subscription) {
    return { state: 'unknown', text: 'Image credits: —', css: 'is-muted', title: 'Sign in to view image credits' };
  }
  if (!_hasAiCreditsEntitlement(subscription)) {
    return { state: 'no_access', text: 'Image credits: 0', css: 'is-empty', title: 'Upgrade to access AI image generation' };
  }
  if (_hasUnlimitedAi(subscription)) {
    return { state: 'unlimited', text: 'Image credits: ∞', css: '', title: 'Unlimited AI image credits' };
  }

  const resetAt = _getResetAt(subscription, 'ai_image_credits_reset_at');
  const limit = _finiteNumberOrNaN(subscription.ai_image_credits_limit);
  const used = _finiteNumberOr(subscription.ai_image_credits_used, 0);
  if (!Number.isFinite(limit) || limit <= 0) {
    const suffix = _resetSuffix(this, resetAt);
    return { state: 'pending', text: `Image credits: —${suffix}`, css: 'is-muted', title: 'Credits pending billing sync' };
  }

  return _buildCreditsView(this, {
    label: 'Image credits',
    limit,
    used,
    resetAt,
    titlePrefix: 'AI image credits remaining',
  });
}

export function _computeAiTextCreditsView(subscription) {
  if (!subscription) {
    return { state: 'unknown', text: 'AI text credits: —', css: 'is-muted', title: 'Sign in to view AI text credits' };
  }
  if (!_hasAiCreditsEntitlement(subscription)) {
    return { state: 'no_access', text: 'AI text credits: 0', css: 'is-empty', title: 'Upgrade to access AI text features' };
  }

  const resetAt = _getResetAt(subscription, 'ai_text_credits_reset_at');
  const limit = _finiteNumberOrNaN(subscription.ai_text_credits_limit);
  const used = _finiteNumberOr(subscription.ai_text_credits_used, 0);
  if (!Number.isFinite(limit) || limit <= 0) {
    return { state: 'unlimited', text: 'AI text credits: ∞', css: '', title: 'AI text credits are currently unlimited' };
  }

  return _buildCreditsView(this, {
    label: 'AI text credits',
    limit,
    used,
    resetAt,
    titlePrefix: 'AI text credits remaining',
  });
}

export function _setPillLabel(el, text) {
  const firstTextNode = Array.from(el.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
  if (firstTextNode) {
    firstTextNode.textContent = text + ' ';
  } else {
    el.insertBefore(document.createTextNode(text + ' '), el.firstChild);
  }
}

export function _buildCreditCostHtml() {
  const cfg = this._normalizeAiWorkflow(this.aiWorkflow);
  const provider = cfg.provider || 'openai';
  const costs = AI_CREDIT_COSTS[provider] || AI_CREDIT_COSTS.openai;
  const presets = AI_PROVIDER_PRESETS[provider] || AI_PROVIDER_PRESETS.openai;
  const providerName = provider === 'google' ? 'Google Gemini' : 'OpenAI';
  const lines = presets
    .filter(p => costs[p.value] !== undefined)
    .map(p => {
      const cleanLabel = p.label.replace(/\s*·\s*\d+\s*cr$/i, '');
      return `${cleanLabel} · <strong>${costs[p.value]}</strong> cr`;
    });

  return `<strong>${providerName} — Cost per call:</strong><br>` + lines.join('<br>');
}

export function updateAiCreditsPills(source = '') {
  const { imagePill, textPill, textCosts } = getCreditsElements();
  _updatePill(imagePill, this._computeAiImageCreditsView(this.userSubscription));
  _updatePill(textPill, this._computeAiTextCreditsView(this.userSubscription));

  if (textCosts) {
    textCosts.innerHTML = this._buildCreditCostHtml();
  }
  if (source) {
    try { console.log(`🎫 AI credits pills updated (${source})`); } catch (_) {}
  }
}

export function updateAiCreditsPill(source = '') {
  this.updateAiCreditsPills(source);
}

async function _readSyncWorkflow(key) {
  try {
    return await new Promise((resolve) => chrome.storage.sync.get([key], resolve));
  } catch (_) {
    return null;
  }
}

async function _readLocalWorkflow(key) {
  try {
    return await chrome.storage.local.get([key]);
  } catch (_) {
    return null;
  }
}

function _renderPresetOptions(presetEl, cfg) {
  if (!presetEl) return;
  const presets = AI_PROVIDER_PRESETS[cfg.provider] || AI_PROVIDER_PRESETS.openai;
  presetEl.innerHTML = '';
  for (const p of presets) {
    const opt = document.createElement('option');
    opt.value = p.value;
    opt.textContent = p.label;
    presetEl.appendChild(opt);
  }
  presetEl.value = cfg.preset || 'default';
}

function _readWorkflowFromUi(app) {
  const { toggle, providerEl, presetEl } = getWorkflowElements();
  if (!toggle || !providerEl || !presetEl) {
    throw new Error('AI workflow UI elements not found');
  }

  return app._normalizeAiWorkflow({
    enabled: !!toggle.checked,
    provider: String(providerEl.value || 'openai'),
    preset: String(presetEl.value || 'default'),
    updatedAt: Date.now(),
  });
}

async function _rollbackWorkflow(app, key, snapshot) {
  try {
    app.aiWorkflow = app._normalizeAiWorkflow(snapshot);
    app.applyAiWorkflowToUi();
    await window.PasteCraftCRUD.retryOperation(async () => {
      await chrome.storage.local.set({ [key]: app.aiWorkflow });
    });
  } catch (rollbackError) {
    console.error('❌ AI workflow rollback failed:', rollbackError);
  }
}

async function _verifyWorkflowPersisted(app, key) {
  const verification = await chrome.storage.local.get([key]);
  const verified = app._normalizeAiWorkflow(verification ? verification[key] : null);
  if (
    verified.updatedAt !== app.aiWorkflow.updatedAt ||
    verified.preset !== app.aiWorkflow.preset ||
    verified.enabled !== app.aiWorkflow.enabled
  ) {
    throw new Error('Verification failed: AI workflow not persisted correctly');
  }
}

function _syncWorkflowToSupabaseClient(aiWorkflow) {
  if (typeof pasteCraftSupabase !== 'undefined' && pasteCraftSupabase.setAiWorkflowConfigDirect) {
    pasteCraftSupabase.setAiWorkflowConfigDirect(aiWorkflow);
  }
}

function _hasAiCreditsEntitlement(subscription) {
  const tier = String(subscription.subscription_tier || '').toLowerCase();
  const status = String(subscription.subscription_status || '').toLowerCase();
  const expiresAtMs = subscription?.ai_access_expires_at ? Date.parse(subscription.ai_access_expires_at) : NaN;
  const hasCouponAiAccess = !!(
    subscription.has_unlimited_ai === true ||
    (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now())
  );
  return ((tier === 'premium' || tier === 'admin') && (status === 'active' || status === 'past_due')) || hasCouponAiAccess;
}

function _hasUnlimitedAi(subscription) {
  const tier = String(subscription.subscription_tier || '').toLowerCase();
  return subscription.has_unlimited_ai === true || tier === 'admin';
}

function _getResetAt(subscription, fieldName) {
  return subscription[fieldName]
    || subscription.stripe_current_period_end
    || subscription.current_period_end
    || null;
}

function _finiteNumberOrNaN(value) {
  return Number.isFinite(Number(value)) ? Number(value) : NaN;
}

function _finiteNumberOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function _resetSuffix(app, resetAt) {
  const resetShort = resetAt ? app._formatShortDate(resetAt) : null;
  return resetShort ? ` • resets ${resetShort}` : '';
}

function _buildCreditsView(app, { label, limit, used, resetAt, titlePrefix }) {
  const remaining = Math.max(0, limit - Math.max(0, used));
  const resetShort = resetAt ? app._formatShortDate(resetAt) : null;
  const suffix = resetShort ? ` • resets ${resetShort}` : '';
  const css = remaining <= 0 ? 'is-empty' : (remaining <= Math.min(3, Math.floor(limit * 0.15)) ? 'is-low' : '');
  return {
    state: 'ok',
    text: `${label}: ${remaining}/${limit}${suffix}`,
    css,
    title: `${titlePrefix}: ${remaining} of ${limit}${resetShort ? ` (resets ${resetShort})` : ''}`,
  };
}

function _updatePill(el, view) {
  if (!el) return;
  _setPillLabel(el, view.text);
  el.title = view.title || el.title || '';
  el.classList.remove('is-muted', 'is-low', 'is-empty');
  if (view.css) view.css.split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
}
