import {
  MERCHANT_ACTIONS,
  MERCHANT_BRAND,
  MERCHANT_STRIP_HEIGHT_PX,
} from './merchant.constants.js';
import { getMerchantStripStyles } from './merchant.styles.js';
import { bindMerchantStripEvents, resetMerchantFeatureState } from './merchant.events.js';
import { refreshMerchantPulse } from './merchant.pulse.js';
import {
  applyMerchantLayoutCompensation,
  removeMerchantLayoutCompensation,
} from './merchant.layout.js';
import {
  applyStripHostFixedStyles,
  bindMerchantStripPinGuard,
  mountMerchantHost,
  unbindMerchantStripPinGuard,
} from './merchant.mount.js';
import { injectShadowStyles } from '../safety/shadow-host.js';

function buildStripMarkup() {
  return `
    <div class="pc-merchant-strip" data-field="pc-merchant-strip" role="toolbar" aria-label="PasteCraft Merchant tools">
      <span class="pc-merchant-brand" data-field="pc-merchant-brand">${MERCHANT_BRAND.LABEL}</span>
      <span
        class="pc-merchant-pulse"
        data-field="pc-merchant-pulse"
        data-pulse="empty"
        role="status"
        aria-live="polite"
        aria-label="No staging — dock empty"
        title="Merchant Pulse — ephemeral staging indicator"
      >
        <span class="pc-merchant-pulse-dot" aria-hidden="true"></span>
      </span>
      <span class="pc-merchant-divider" aria-hidden="true"></span>
      <div class="pc-merchant-actions">
        <button
          type="button"
          class="pc-merchant-btn"
          data-action="${MERCHANT_ACTIONS.DOCK_TOGGLE}"
          title="Listing Dock — ephemeral title, description, tags"
        >
          <span class="pc-merchant-btn-icon" aria-hidden="true">⎘</span>
          <span class="pc-merchant-btn-label">${MERCHANT_BRAND.DOCK_LABEL}</span>
        </button>
        <button
          type="button"
          class="pc-merchant-btn"
          data-action="${MERCHANT_ACTIONS.SPOT}"
          aria-pressed="false"
          title="Spot — stage selection into listing dock"
        >
          <span class="pc-merchant-btn-icon" aria-hidden="true">◎</span>
          <span class="pc-merchant-btn-label">${MERCHANT_BRAND.SPOT_LABEL}</span>
        </button>
        <button
          type="button"
          class="pc-merchant-btn"
          data-action="${MERCHANT_ACTIONS.IMAGE_TO_TEXT}"
          title="Image → Text — capture region and extract text"
        >
          <span class="pc-merchant-btn-icon" aria-hidden="true">▣</span>
          <span class="pc-merchant-btn-label">${MERCHANT_BRAND.IMAGE_TO_TEXT_LABEL}</span>
        </button>
        <button
          type="button"
          class="pc-merchant-btn"
          data-action="${MERCHANT_ACTIONS.TAG_QUEUE_TOGGLE}"
          aria-pressed="false"
          title="Tag Queue — paste-next mode for staged tags"
        >
          <span class="pc-merchant-btn-icon" aria-hidden="true">⎇</span>
          <span class="pc-merchant-btn-label">${MERCHANT_BRAND.TAG_QUEUE_LABEL}</span>
        </button>
        <div class="pc-merchant-snippet-wrap" data-field="pc-merchant-snippet-wrap">
          <button
            type="button"
            class="pc-merchant-btn"
            data-action="${MERCHANT_ACTIONS.SNIPPETS_TOGGLE}"
            aria-expanded="false"
            title="Snippets — insert reusable seller boilerplate"
          >
            <span class="pc-merchant-btn-icon" aria-hidden="true">¶</span>
            <span class="pc-merchant-btn-label">${MERCHANT_BRAND.SNIPPETS_LABEL}</span>
          </button>
          <div class="pc-merchant-snippet-menu" data-field="pc-merchant-snippet-menu" hidden></div>
        </div>
        <button
          type="button"
          class="pc-merchant-btn pc-merchant-btn-seal"
          data-action="${MERCHANT_ACTIONS.SEAL_SHIP}"
          title="Seal &amp; Ship — confirm and purge ephemeral staging"
        >
          <span class="pc-merchant-btn-icon" aria-hidden="true">✓</span>
          <span class="pc-merchant-btn-label">${MERCHANT_BRAND.SEAL_SHIP_LABEL}</span>
        </button>
      </div>
      <span class="pc-merchant-pulse-label" data-field="pc-merchant-pulse-label">No staging — dock empty</span>
      <span class="pc-merchant-hint" data-field="pc-merchant-hint">Spot idle</span>
    </div>
  `;
}

export class MerchantTopStrip {
  constructor() {
    this.host = null;
    this.root = null;
    this.stripEl = null;
    this._mounted = false;
  }

  mount() {
    if (this._mounted || !document.body) return this;

    this.host = document.createElement('div');
    applyStripHostFixedStyles(this.host, MERCHANT_STRIP_HEIGHT_PX);

    this.root = this.host.attachShadow({ mode: 'closed' });
    injectShadowStyles(this.root, getMerchantStripStyles(), 'pc-merchant-strip-styles');

    this.stripEl = document.createElement('div');
    this.stripEl.innerHTML = buildStripMarkup();
    this.stripEl = this.stripEl.firstElementChild;
    this.root.appendChild(this.stripEl);

    bindMerchantStripEvents(this.root, this.stripEl);
    resetMerchantFeatureState(this.stripEl);
    refreshMerchantPulse(this.stripEl).catch(() => {});

    applyMerchantLayoutCompensation(MERCHANT_STRIP_HEIGHT_PX);
    mountMerchantHost(this.host);
    bindMerchantStripPinGuard(this.host);
    this._mounted = true;
    return this;
  }

  unmount() {
    if (!this._mounted) return;
    unbindMerchantStripPinGuard();
    resetMerchantFeatureState(this.stripEl);
    this.host?.remove();
    removeMerchantLayoutCompensation();
    this.host = null;
    this.root = null;
    this.stripEl = null;
    this._mounted = false;
  }

  isMounted() {
    return this._mounted;
  }
}

