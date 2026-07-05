import { MERCHANT_ACTIONS } from './merchant.constants.js';
import { mountMerchantHost } from './merchant.mount.js';
import { injectShadowStyles } from '../safety/shadow-host.js';
import {
  getMerchantStripEnabled,
  subscribeMerchantStripEnabled,
} from './merchant.strip-preference.js';
import { merchantAccessDeniedMessage } from './merchant.gating.js';

const VISIBILITY_HOST_FIELD = 'pc-merchant-visibility-host';

function getVisibilityToggleStyles() {
  return `
    :host, * { box-sizing: border-box; }

    .pc-merchant-visibility-toggle {
      position: fixed;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      z-index: 2147483647;
      pointer-events: auto;
    }

    .pc-merchant-visibility-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      padding: 0;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      font: inherit;
      font-size: 18px;
      line-height: 1;
      transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
    }

    .pc-merchant-visibility-btn.is-on {
      background: #22c55e;
      border-color: #16a34a;
      color: #fff;
    }

    .pc-merchant-visibility-btn.is-off {
      background: #9ca3af;
      border-color: #6b7280;
      color: #fff;
    }

    .pc-merchant-visibility-btn:hover {
      box-shadow: 0 3px 14px rgba(0, 0, 0, 0.22);
    }

    .pc-merchant-visibility-btn.is-locked {
      background: #374151;
      border-color: #1f2937;
      color: #d1d5db;
      cursor: not-allowed;
    }

    .pc-merchant-visibility-btn:focus-visible {
      outline: 2px solid #f59e0b;
      outline-offset: 2px;
    }
  `;
}

function buildToggleMarkup(enabled, locked = false) {
  if (locked) {
    return `
    <div class="pc-merchant-visibility-toggle" data-field="pc-merchant-visibility-toggle">
      <button
        type="button"
        class="pc-merchant-visibility-btn is-locked"
        data-action="${MERCHANT_ACTIONS.VISIBILITY_TOGGLE}"
        aria-pressed="false"
        title="Merchant — subscription required"
      >M</button>
    </div>
  `;
  }
  const onClass = enabled ? 'is-on' : 'is-off';
  const pressed = enabled ? 'true' : 'false';
  const title = enabled ? 'Merchant — click to hide' : 'Merchant — click to show';
  return `
    <div class="pc-merchant-visibility-toggle" data-field="pc-merchant-visibility-toggle">
      <button
        type="button"
        class="pc-merchant-visibility-btn ${onClass}"
        data-action="${MERCHANT_ACTIONS.VISIBILITY_TOGGLE}"
        aria-pressed="${pressed}"
        title="${title}"
      >M</button>
    </div>
  `;
}

export class MerchantVisibilityToggle {
  constructor() {
    this.host = null;
    this.root = null;
    this.toggleEl = null;
    this.btnEl = null;
    this._mounted = false;
    this._unsubscribe = null;
    this._merchantAccess = { allowed: true, reason: 'gating_open' };
  }

  async mount(options = {}) {
    if (this._mounted || !document.body) return this;

    this._merchantAccess = options.merchantAccess || { allowed: true, reason: 'gating_open' };
    const locked = !this._merchantAccess.allowed;
    const enabled = locked ? false : await getMerchantStripEnabled();

    this.host = document.createElement('div');
    this.host.setAttribute('data-field', VISIBILITY_HOST_FIELD);
    this.host.style.cssText = [
      'position:fixed',
      'top:0',
      'right:0',
      'width:0',
      'height:0',
      'z-index:2147483647',
      'pointer-events:none',
    ].join(';');

    this.root = this.host.attachShadow({ mode: 'closed' });
    injectShadowStyles(this.root, getVisibilityToggleStyles(), 'pc-merchant-visibility-styles');

    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildToggleMarkup(enabled, locked);
    this.toggleEl = wrapper.firstElementChild;
    this.btnEl = this.toggleEl.querySelector('[data-action]');
    this.root.appendChild(this.toggleEl);

    this.bindEvents();
    this.bindPreferenceSync();
    mountMerchantHost(this.host);

    this._mounted = true;
    return this;
  }

  unmount() {
    if (!this._mounted) return;
    this._unsubscribe?.();
    this._unsubscribe = null;
    this.host?.remove();
    this.host = null;
    this.root = null;
    this.toggleEl = null;
    this.btnEl = null;
    this._mounted = false;
  }

  isMounted() {
    return this._mounted;
  }

  syncUi(enabled) {
    if (!this.btnEl) return;
    this.btnEl.classList.toggle('is-on', enabled);
    this.btnEl.classList.toggle('is-off', !enabled);
    this.btnEl.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    this.btnEl.title = enabled ? 'Merchant — click to hide' : 'Merchant — click to show';
  }

  bindEvents() {
    if (!this.toggleEl || this.toggleEl.dataset.pcVisibilityBound === '1') return;
    this.toggleEl.dataset.pcVisibilityBound = '1';

    this.toggleEl.addEventListener('click', (event) => {
      const btn = event.target.closest(`[data-action="${MERCHANT_ACTIONS.VISIBILITY_TOGGLE}"]`);
      if (!btn) return;
      event.preventDefault();
      this.handleToggle().catch(() => {});
    });

    this.toggleEl.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const btn = event.target.closest(`[data-action="${MERCHANT_ACTIONS.VISIBILITY_TOGGLE}"]`);
      if (!btn) return;
      event.preventDefault();
      btn.click();
    });
  }

  bindPreferenceSync() {
    if (this._unsubscribe) return;
    this._unsubscribe = subscribeMerchantStripEnabled((enabled) => {
      this.syncUi(enabled);
    });
  }

  async handleToggle() {
    if (!this._merchantAccess?.allowed) {
      const message = merchantAccessDeniedMessage(this._merchantAccess?.reason);
      if (this.root) {
        let toast = this.root.querySelector('[data-field="pc-merchant-gate-toast"]');
        if (!toast) {
          toast = document.createElement('div');
          toast.setAttribute('data-field', 'pc-merchant-gate-toast');
          toast.style.cssText = 'position:fixed;right:56px;top:50%;transform:translateY(-50%);max-width:220px;padding:8px 10px;background:#1f2937;color:#fff;border-radius:8px;font-size:12px;line-height:1.35;z-index:2147483647;pointer-events:none;';
          this.root.appendChild(toast);
        }
        toast.textContent = message;
        clearTimeout(this._gateToastTimer);
        this._gateToastTimer = setTimeout(() => {
          toast?.remove();
        }, 2600);
      }
      return;
    }
    const currentlyEnabled = await getMerchantStripEnabled();
    const nextEnabled = !currentlyEnabled;
    const { setMerchantStripEnabled } = await import('./merchant.controller.js');
    await setMerchantStripEnabled(nextEnabled);
    this.syncUi(nextEnabled);
  }
}

export async function initMerchantVisibilityToggle(options = {}) {
  if (window.__pasteCraftMerchantVisibility?.isMounted?.()) {
    const toggle = window.__pasteCraftMerchantVisibility;
    toggle._merchantAccess = options.merchantAccess || toggle._merchantAccess;
    if (!toggle._merchantAccess?.allowed) {
      toggle.syncUi(false);
    } else {
      toggle.syncUi(await getMerchantStripEnabled());
    }
    return toggle;
  }
  const toggle = new MerchantVisibilityToggle();
  await toggle.mount(options);
  window.__pasteCraftMerchantVisibility = toggle;
  return toggle;
}
