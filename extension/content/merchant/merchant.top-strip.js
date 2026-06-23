import {
  MERCHANT_ACTIONS,
  MERCHANT_BRAND,
  MERCHANT_STRIP_HEIGHT_PX,
} from './merchant.constants.js';
import { getMerchantStripStyles } from './merchant.styles.js';
import { bindMerchantStripEvents, resetMerchantFeatureState } from './merchant.events.js';
import { injectShadowStyles } from '../safety/shadow-host.js';

function buildStripMarkup() {
  return `
    <div class="pc-merchant-strip" data-field="pc-merchant-strip" role="toolbar" aria-label="PasteCraft Merchant tools">
      <span class="pc-merchant-brand" data-field="pc-merchant-brand">${MERCHANT_BRAND.LABEL}</span>
      <span class="pc-merchant-divider" aria-hidden="true"></span>
      <div class="pc-merchant-actions">
        <button
          type="button"
          class="pc-merchant-btn"
          data-action="${MERCHANT_ACTIONS.SPOT}"
          aria-pressed="false"
          title="Spot — detect and fill listing fields"
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
      </div>
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
    this.host.setAttribute('data-field', 'pc-merchant-strip-host');
    this.host.style.cssText = [
      'display:block',
      'width:100%',
      `height:${MERCHANT_STRIP_HEIGHT_PX}px`,
      'position:relative',
      'z-index:2147483644',
      'box-sizing:border-box',
    ].join(';');

    this.root = this.host.attachShadow({ mode: 'closed' });
    injectShadowStyles(this.root, getMerchantStripStyles(), 'pc-merchant-strip-styles');

    this.stripEl = document.createElement('div');
    this.stripEl.innerHTML = buildStripMarkup();
    this.stripEl = this.stripEl.firstElementChild;
    this.root.appendChild(this.stripEl);

    bindMerchantStripEvents(this.root, this.stripEl);
    resetMerchantFeatureState(this.stripEl);

    document.body.insertBefore(this.host, document.body.firstChild);
    this._mounted = true;
    return this;
  }

  unmount() {
    if (!this._mounted) return;
    resetMerchantFeatureState(this.stripEl);
    this.host?.remove();
    this.host = null;
    this.root = null;
    this.stripEl = null;
    this._mounted = false;
  }

  isMounted() {
    return this._mounted;
  }
}
