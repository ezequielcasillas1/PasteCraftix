import {
  AI_ALLOWED_PROVIDERS,
  AI_CREDIT_COSTS,
  AI_PROVIDER_PRESETS,
} from './ai-lab.constants.js';
import { getCreditsElements } from './ai-lab.selectors.js';

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
  const cfg = this._normalizeAiWorkflow(this.aiWorkflow);
  this.aiWorkflow = cfg;
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
  const purchasedBalance = _finiteNumberOr(subscription.ai_purchased_credits_balance, 0);
  if (!Number.isFinite(limit) || limit <= 0) {
    if (purchasedBalance > 0) {
      return {
        state: 'ok',
        text: `Image credits: ${purchasedBalance} purchased`,
        css: '',
        title: `${purchasedBalance} purchased credits available for images`,
      };
    }
    const suffix = _resetSuffix(this, resetAt);
    return { state: 'pending', text: `Image credits: —${suffix}`, css: 'is-muted', title: 'Credits pending billing sync' };
  }

  return _buildCreditsView(this, {
    label: 'Image credits',
    limit,
    used,
    resetAt,
    titlePrefix: 'AI image credits remaining',
    purchasedBalance,
  });
}

export function _computeAiTextCreditsView(subscription) {
  if (!subscription) {
    return { state: 'unknown', text: 'AI text credits: —', css: 'is-muted', title: 'Sign in to view AI text credits' };
  }
  if (!_hasAiCreditsEntitlement(subscription)) {
    return { state: 'no_access', text: 'AI text credits: 0', css: 'is-empty', title: 'Upgrade to access AI text features' };
  }
  if (_hasUnlimitedAi(subscription)) {
    return { state: 'unlimited', text: 'AI text credits: ∞', css: '', title: 'Unlimited AI text credits' };
  }

  const resetAt = _getResetAt(subscription, 'ai_text_credits_reset_at');
  const limit = _finiteNumberOrNaN(subscription.ai_text_credits_limit);
  const used = _finiteNumberOr(subscription.ai_text_credits_used, 0);
  const purchasedBalance = _finiteNumberOr(subscription.ai_purchased_credits_balance, 0);
  if (!Number.isFinite(limit) || limit <= 0) {
    if (purchasedBalance > 0) {
      return {
        state: 'ok',
        text: `AI text credits: ${purchasedBalance} purchased`,
        css: '',
        title: `${purchasedBalance} purchased credits available for AI text`,
      };
    }
    const suffix = _resetSuffix(this, resetAt);
    return { state: 'pending', text: `AI text credits: —${suffix}`, css: 'is-muted', title: 'Credits pending billing sync' };
  }

  return _buildCreditsView(this, {
    label: 'AI text credits',
    limit,
    used,
    resetAt,
    titlePrefix: 'AI text credits remaining',
    purchasedBalance,
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

  this.aiLabFeature?.creditPacks?.refreshCreditPackBanner?.(this);
  this.aiLabFeature?.announcements?.renderAnnouncementBanner?.(this);

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

function _readWorkflowFromUi(app) {
  return app._normalizeAiWorkflow({
    ...app.aiWorkflow,
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
  const isPaidTier = (tier === 'premium' || tier === 'basic')
    && (status === 'active' || status === 'past_due');
  const purchasedBalance = Number.isFinite(Number(subscription.ai_purchased_credits_balance))
    ? Math.max(0, Number(subscription.ai_purchased_credits_balance))
    : 0;
  return isPaidTier || hasCouponAiAccess || purchasedBalance > 0;
}

function _hasUnlimitedAi(subscription) {
  return subscription.has_unlimited_ai === true;
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

function _buildCreditsView(app, { label, limit, used, resetAt, titlePrefix, purchasedBalance = 0 }) {
  const remaining = Math.max(0, limit - Math.max(0, used));
  const purchased = Math.max(0, Number(purchasedBalance) || 0);
  const totalRemaining = remaining + purchased;
  const resetShort = resetAt ? app._formatShortDate(resetAt) : null;
  const suffix = resetShort ? ` • resets ${resetShort}` : '';
  const purchasedSuffix = purchased > 0 ? ` (+${purchased} purchased)` : '';
  const css = totalRemaining <= 0 ? 'is-empty' : (totalRemaining <= Math.min(3, Math.floor(limit * 0.15)) ? 'is-low' : '');
  return {
    state: 'ok',
    text: `${label}: ${totalRemaining}/${limit}${purchasedSuffix}${suffix}`,
    css,
    title: `${titlePrefix}: ${totalRemaining} of ${limit}${purchased > 0 ? ` (${purchased} purchased bonus)` : ''}${resetShort ? ` (resets ${resetShort})` : ''}`,
  };
}

function _updatePill(el, view) {
  if (!el) return;
  _setPillLabel(el, view.text);
  el.title = view.title || el.title || '';
  el.classList.remove('is-muted', 'is-low', 'is-empty');
  if (view.css) view.css.split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
}
