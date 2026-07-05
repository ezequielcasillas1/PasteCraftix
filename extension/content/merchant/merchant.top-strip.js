import {
  MERCHANT_ACTIONS,
  MERCHANT_BRAND,
  MERCHANT_STRIP_HEIGHT_PX,
} from './merchant.constants.js';
import { buildDockTargetRowMarkup } from './merchant.dock-target.js';
import { getMerchantStripStyles } from './merchant.styles.js';
import { bindMerchantStripEvents, resetMerchantFeatureState } from './merchant.events.js';
import { refreshMerchantPulse } from './merchant.pulse.js';
import { initMerchantDockTarget } from './merchant.dock-target.js';
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
      <div class="pc-merchant-strip-row">
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
            class="pc-merchant-btn pc-merchant-btn-fill-all"
            data-action="${MERCHANT_ACTIONS.ONE_SHOT_PASTE}"
            title="Fill All — paste staged dock fields into matching page inputs"
          >
            <span class="pc-merchant-btn-icon" aria-hidden="true">⇥</span>
            <span class="pc-merchant-btn-label">${MERCHANT_BRAND.ONE_SHOT_LABEL}</span>
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
            aria-pressed="false"
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
            title="Tag Queue — paste-next for staged tags"
          >
            <span class="pc-merchant-btn-icon" aria-hidden="true">⎇</span>
            <span class="pc-merchant-btn-label">${MERCHANT_BRAND.TAG_QUEUE_LABEL}</span>
          </button>
          <button
            type="button"
            class="pc-merchant-btn"
            data-action="${MERCHANT_ACTIONS.MATERIAL_QUEUE_TOGGLE}"
            aria-pressed="false"
            title="Material Queue — paste-next for staged materials"
          >
            <span class="pc-merchant-btn-icon" aria-hidden="true">⎈</span>
            <span class="pc-merchant-btn-label">${MERCHANT_BRAND.MATERIAL_QUEUE_LABEL}</span>
          </button>
          <button
            type="button"
            class="pc-merchant-btn"
            data-action="${MERCHANT_ACTIONS.TITLE_QUEUE_TOGGLE}"
            aria-pressed="false"
            title="Title Queue — paste-next for staged title variants"
          >
            <span class="pc-merchant-btn-icon" aria-hidden="true">T</span>
            <span class="pc-merchant-btn-label">${MERCHANT_BRAND.TITLE_QUEUE_LABEL}</span>
          </button>
          <button
            type="button"
            class="pc-merchant-btn"
            data-action="${MERCHANT_ACTIONS.DESCRIPTION_QUEUE_TOGGLE}"
            aria-pressed="false"
            title="Description Queue — paste-next for staged description variants"
          >
            <span class="pc-merchant-btn-icon" aria-hidden="true">D</span>
            <span class="pc-merchant-btn-label">${MERCHANT_BRAND.DESCRIPTION_QUEUE_LABEL}</span>
          </button>
          <button
            type="button"
            class="pc-merchant-btn"
            data-action="${MERCHANT_ACTIONS.KEYWORD_QUEUE_TOGGLE}"
            aria-pressed="false"
            title="Keyword Queue — paste-next for backend/search keywords"
          >
            <span class="pc-merchant-btn-icon" aria-hidden="true">K</span>
            <span class="pc-merchant-btn-label">${MERCHANT_BRAND.KEYWORD_QUEUE_LABEL}</span>
          </button>
          <button
            type="button"
            class="pc-merchant-btn"
            data-action="${MERCHANT_ACTIONS.BULLET_QUEUE_TOGGLE}"
            aria-pressed="false"
            title="Bullet Queue — paste-next for Amazon-style bullet points"
          >
            <span class="pc-merchant-btn-icon" aria-hidden="true">•</span>
            <span class="pc-merchant-btn-label">${MERCHANT_BRAND.BULLET_QUEUE_LABEL}</span>
          </button>
          <button
            type="button"
            class="pc-merchant-btn"
            data-action="${MERCHANT_ACTIONS.HASHTAG_QUEUE_TOGGLE}"
            aria-pressed="false"
            title="Hashtag Queue — paste-next for social promo hashtag slots"
          >
            <span class="pc-merchant-btn-icon" aria-hidden="true">#</span>
            <span class="pc-merchant-btn-label">${MERCHANT_BRAND.HASHTAG_QUEUE_LABEL}</span>
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
        </div>
        <span class="pc-merchant-pulse-label" data-field="pc-merchant-pulse-label">No staging — dock empty</span>
        <span class="pc-merchant-hint" data-field="pc-merchant-hint">Spot idle</span>
      </div>
      ${buildDockTargetRowMarkup()}
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
    initMerchantDockTarget({ stripEl: this.stripEl }).catch(() => {});
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

