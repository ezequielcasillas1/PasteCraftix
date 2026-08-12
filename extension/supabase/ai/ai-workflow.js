/** Vertical slice: ai-workflow.js */
export const aiWorkflowMixin = {
// AI WORKFLOW (provider + preset) - local-first read
// =====================================================

_normalizeAiWorkflow(raw) {
  const allowedProviders = new Set([
    'openai',
    'google',
    'anthropic',
    'deepseek',
    'alibaba',
    'inclusionai',
  ]);
  const presetsByProvider = {
    openai: new Set(['default', 'cheapest', 'gpt5_mini', 'latest', 'gpt4o']),
    google: new Set([
      'default',
      'cheapest',
      'gemini_pro',
      'latest',
      'gemini_36_flash',
      'gemini_35_flash_lite',
    ]),
    anthropic: new Set(['default']),
    deepseek: new Set(['default', 'cheapest', 'deepseek_v4_flash']),
    alibaba: new Set(['default', 'qwen_flash']),
    inclusionai: new Set(['default', 'ling_flash']),
  };

  const obj = (raw && typeof raw === 'object') ? raw : {};
  const enabled = obj.enabled === true;
  const provider = allowedProviders.has(String(obj.provider || 'openai')) ? String(obj.provider || 'openai') : 'openai';
  const allowedPresets = presetsByProvider[provider] || presetsByProvider.openai;
  const preset = allowedPresets.has(String(obj.preset || 'default')) ? String(obj.preset || 'default') : 'default';
  const updatedAt = Number.isFinite(Number(obj.updatedAt)) ? Number(obj.updatedAt) : 0;
  return { enabled, provider, preset, updatedAt };
},

  async getAiWorkflowConfig() {
  // Cache for a few seconds to avoid storage overhead on rapid calls.
  try {
    const now = Date.now();
    if (this._aiWorkflowCache && (now - (this._aiWorkflowCache.at || 0)) < 5000) {
      return this._aiWorkflowCache.value;
    }

    const key = this._aiWorkflowKey;
    let local = null;
    try {
      local = await chrome.storage.local.get([key]);
    } catch (_) {
      local = null;
    }

    let cfg = this._normalizeAiWorkflow(local ? local[key] : null);
    if (!cfg.enabled) {
      // Fall back to sync only if local is missing/disabled (best-effort)
      try {
        const sync = await new Promise((resolve) => chrome.storage.sync.get([key], resolve));
        const fromSync = this._normalizeAiWorkflow(sync ? sync[key] : null);
        if (fromSync.enabled && fromSync.updatedAt >= cfg.updatedAt) cfg = fromSync;
      } catch (_) {}
    }

    const finalCfg = cfg && cfg.enabled ? { enabled: true, provider: cfg.provider, preset: cfg.preset, updatedAt: cfg.updatedAt } : null;
    this._aiWorkflowCache = { value: finalCfg, at: now };
    return finalCfg;
  } catch (_) {
    return null;
  }
},

/**
 * Directly set the in-memory AI workflow cache (bypasses storage read).
 * Call this after saving workflow from the UI so the next AI call
 * immediately reflects the user's selection.
 */
  setAiWorkflowConfigDirect(cfg) {
  if (!cfg || typeof cfg !== 'object') {
    this._aiWorkflowCache = { value: null, at: 0 };
    return;
  }
  const normalized = this._normalizeAiWorkflow(cfg);
  const finalCfg = normalized.enabled
    ? { enabled: true, provider: normalized.provider, preset: normalized.preset, updatedAt: normalized.updatedAt }
    : null;
  this._aiWorkflowCache = { value: finalCfg, at: Date.now() };
},

  async _withAiWorkflow(body) {
  try {
    const base = (body && typeof body === 'object') ? body : {};
    const cfg = await this.getAiWorkflowConfig();
    if (!cfg) return base;
    return { ...base, aiWorkflow: cfg };
  } catch (_) {
    return body;
  }
}

// =====================================================
};
