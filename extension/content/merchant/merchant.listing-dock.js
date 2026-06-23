import { MERCHANT_ACTIONS, MERCHANT_BRAND, ETSY_TAG_PROFILE } from './merchant.constants.js';

import { getMerchantDockStyles } from './merchant.dock-styles.js';

import { injectShadowStyles } from '../safety/shadow-host.js';

import { mountMerchantHost } from './merchant.mount.js';

import {

  clearListingDock,

  readListingDock,

  saveListingDock,

  stageFromClipboard,

} from './merchant.dock-storage.js';

import { refreshMerchantPulse } from './merchant.pulse.js';

import { validateEtsyTags } from './merchant.tags.js';



function buildDockMarkup() {

  return `

    <div class="pc-merchant-dock-panel" data-field="pc-merchant-dock-panel" hidden>

      <div class="pc-merchant-dock-header">

        <h2 class="pc-merchant-dock-title">${MERCHANT_BRAND.DOCK_LABEL}</h2>

      </div>

      <p class="pc-merchant-dock-warning" data-field="pc-merchant-dock-warning">

        Ephemeral staging — not saved forever. Auto-expires in 24h unless refreshed.

      </p>

      <label class="pc-merchant-dock-field pc-merchant-dock-field-primary">

        <span>Tags <em class="pc-merchant-dock-hint">Etsy · ${ETSY_TAG_PROFILE.MAX_TAGS} max · ${ETSY_TAG_PROFILE.MAX_CHARS} chars</em></span>

        <input type="text" data-field="dock-tags" autocomplete="off" maxlength="1000" placeholder="comma-separated tags" />

      </label>

      <div class="pc-merchant-dock-tag-preview" data-field="dock-tag-preview" hidden>

        <div class="pc-merchant-dock-tag-preview-head">

          <span data-field="dock-tag-count">0/${ETSY_TAG_PROFILE.MAX_TAGS}</span>

        </div>

        <div class="pc-merchant-dock-tag-chips" data-field="dock-tag-chips"></div>

        <ul class="pc-merchant-dock-tag-warnings" data-field="dock-tag-warnings" hidden></ul>

      </div>

      <details class="pc-merchant-dock-advanced" data-field="dock-advanced">

        <summary>Advanced — title &amp; description</summary>

        <label class="pc-merchant-dock-field">

          <span>Title</span>

          <input type="text" data-field="dock-title" autocomplete="off" maxlength="500" />

        </label>

        <label class="pc-merchant-dock-field">

          <span>Description</span>

          <textarea data-field="dock-description" rows="4" maxlength="5000"></textarea>

        </label>

      </details>

      <p class="pc-merchant-dock-meta" data-field="pc-merchant-dock-meta"></p>

      <div class="pc-merchant-dock-actions">

        <button type="button" class="pc-merchant-dock-btn pc-merchant-dock-btn-primary" data-action="${MERCHANT_ACTIONS.DOCK_SAVE}">

          Save to dock

        </button>

        <button type="button" class="pc-merchant-dock-btn" data-action="${MERCHANT_ACTIONS.DOCK_CLIPBOARD}">

          From clipboard

        </button>

        <button type="button" class="pc-merchant-dock-btn pc-merchant-dock-btn-danger" data-action="${MERCHANT_ACTIONS.DOCK_CLEAR}">

          Clear dock

        </button>

        <button type="button" class="pc-merchant-dock-btn pc-merchant-dock-btn-muted" data-action="${MERCHANT_ACTIONS.SEAL_SHIP}" disabled title="Seal &amp; Ship ships in Phase 5">

          Seal &amp; Ship

        </button>

        <button type="button" class="pc-merchant-dock-btn" data-action="${MERCHANT_ACTIONS.DOCK_CLOSE}">

          Close

        </button>

      </div>

    </div>

  `;

}



function formatMeta(payload) {

  if (!payload) return '';

  const updated = payload.updated_at

    ? new Date(payload.updated_at).toLocaleString()

    : '—';

  const expires = payload.expires_at

    ? new Date(payload.expires_at).toLocaleString()

    : '—';

  const tagNote = payload.tag_validation?.count != null

    ? ` · ${payload.tag_validation.count} tag(s)`

    : '';

  return `Updated ${updated} · Expires ${expires} · Source: ${payload.source || 'manual'}${tagNote}`;

}



function chipStatusClass(status) {

  if (status === 'valid') return 'pc-merchant-tag-chip-valid';

  if (status === 'duplicate') return 'pc-merchant-tag-chip-duplicate';

  if (status === 'invalid_length') return 'pc-merchant-tag-chip-invalid';

  if (status === 'over_limit') return 'pc-merchant-tag-chip-over';

  return 'pc-merchant-tag-chip-invalid';

}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}



export class MerchantListingDock {

  constructor({ stripEl = null, onChange = null } = {}) {

    this.stripEl = stripEl;

    this.onChange = onChange;

    this.host = null;

    this.root = null;

    this.panelEl = null;

    this._mounted = false;

    this._open = false;

  }



  setStripEl(stripEl) {

    this.stripEl = stripEl;

  }



  mount() {

    if (this._mounted || !document.body) return this;



    this.host = document.createElement('div');

    this.host.setAttribute('data-field', 'pc-merchant-dock-host');

    this.host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483646;pointer-events:none;transform:none;';



    this.root = this.host.attachShadow({ mode: 'closed' });

    injectShadowStyles(this.root, getMerchantDockStyles(), 'pc-merchant-dock-styles');



    const wrapper = document.createElement('div');

    wrapper.innerHTML = buildDockMarkup();

    this.panelEl = wrapper.firstElementChild;

    this.root.appendChild(this.panelEl);



    this.bindEvents();

    mountMerchantHost(this.host);

    this._mounted = true;

    this.hydrateFromStorage().catch(() => {});

    return this;

  }



  unmount() {

    if (!this._mounted) return;

    this.host?.remove();

    this.host = null;

    this.root = null;

    this.panelEl = null;

    this._mounted = false;

    this._open = false;

  }



  isMounted() {

    return this._mounted;

  }



  isOpen() {

    return this._open;

  }



  bindEvents() {

    if (!this.panelEl || this.panelEl.dataset.pcMerchantDockBound === '1') return;

    this.panelEl.dataset.pcMerchantDockBound = '1';



    const tagsEl = this.panelEl.querySelector('[data-field="dock-tags"]');

    tagsEl?.addEventListener('input', () => {

      this.renderTagPreview(tagsEl.value);

    });



    this.panelEl.addEventListener('click', (event) => {

      const btn = event.target.closest('[data-action]');

      if (!btn || !this.panelEl.contains(btn)) return;

      event.preventDefault();



      const action = btn.getAttribute('data-action');

      if (action === MERCHANT_ACTIONS.DOCK_SAVE) {

        this.handleSave().catch(() => {});

        return;

      }

      if (action === MERCHANT_ACTIONS.DOCK_CLIPBOARD) {

        this.handleClipboard().catch(() => {});

        return;

      }

      if (action === MERCHANT_ACTIONS.DOCK_CLEAR) {

        this.handleClear().catch(() => {});

        return;

      }

      if (action === MERCHANT_ACTIONS.DOCK_CLOSE) {

        this.close();

      }

    });

  }



  renderTagPreview(rawTags) {

    const previewEl = this.panelEl?.querySelector('[data-field="dock-tag-preview"]');

    const countEl = this.panelEl?.querySelector('[data-field="dock-tag-count"]');

    const chipsEl = this.panelEl?.querySelector('[data-field="dock-tag-chips"]');

    const warningsEl = this.panelEl?.querySelector('[data-field="dock-tag-warnings"]');

    if (!previewEl || !countEl || !chipsEl || !warningsEl) return;



    const trimmed = (rawTags || '').trim();

    if (!trimmed) {

      previewEl.hidden = true;

      chipsEl.innerHTML = '';

      warningsEl.hidden = true;

      warningsEl.innerHTML = '';

      return;

    }



    const result = validateEtsyTags(trimmed);

    previewEl.hidden = false;

    countEl.textContent = `${result.count}/${result.maxTags}`;

    countEl.classList.toggle('pc-merchant-tag-count-warn', result.count >= result.maxTags);

    countEl.classList.toggle('pc-merchant-tag-count-error', result.hasErrors);



    chipsEl.innerHTML = result.chips.map((chip) => {

      const safeText = escapeHtml(chip.text);

      const title = chip.message ? ` title="${escapeHtml(chip.message)}"` : '';

      return `<span class="pc-merchant-tag-chip ${chipStatusClass(chip.status)}"${title}>${safeText}</span>`;

    }).join('');



    if (result.warnings.length > 0) {

      warningsEl.hidden = false;

      warningsEl.innerHTML = result.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('');

    } else {

      warningsEl.hidden = true;

      warningsEl.innerHTML = '';

    }

  }



  getFieldValues() {

    return {

      title: this.panelEl?.querySelector('[data-field="dock-title"]')?.value || '',

      description: this.panelEl?.querySelector('[data-field="dock-description"]')?.value || '',

      tags: this.panelEl?.querySelector('[data-field="dock-tags"]')?.value || '',

    };

  }



  setFieldValues(payload = {}) {

    const titleEl = this.panelEl?.querySelector('[data-field="dock-title"]');

    const descEl = this.panelEl?.querySelector('[data-field="dock-description"]');

    const tagsEl = this.panelEl?.querySelector('[data-field="dock-tags"]');

    const metaEl = this.panelEl?.querySelector('[data-field="pc-merchant-dock-meta"]');

    const advancedEl = this.panelEl?.querySelector('[data-field="dock-advanced"]');

    if (titleEl) titleEl.value = payload.title || '';

    if (descEl) descEl.value = payload.description || '';

    if (tagsEl) {

      tagsEl.value = payload.tags || '';

      this.renderTagPreview(tagsEl.value);

    }

    if (metaEl) metaEl.textContent = formatMeta(payload);

    if (advancedEl && (payload.title || payload.description)) {

      advancedEl.open = true;

    }

  }



  async hydrateFromStorage() {

    const payload = await readListingDock();

    if (payload) {

      this.setFieldValues(payload);

    } else {

      this.setFieldValues({});

    }

    await this.notifyChange();

  }



  async notifyChange() {

    if (this.stripEl) {

      await refreshMerchantPulse(this.stripEl);

    }

    this.onChange?.();

  }



  open() {

    if (!this._mounted) this.mount();

    if (!this.panelEl) return;

    this.panelEl.hidden = false;

    this._open = true;

    this.hydrateFromStorage().catch(() => {});

    const tagsEl = this.panelEl.querySelector('[data-field="dock-tags"]');

    tagsEl?.focus();

  }



  close() {

    if (!this.panelEl) return;

    this.panelEl.hidden = true;

    this._open = false;

  }



  toggle() {

    if (this._open) this.close();

    else this.open();

  }



  focus() {

    this.open();

  }



  async handleSave() {

    const result = await saveListingDock(this.getFieldValues(), 'manual');

    if (!result.ok) {

      return result;

    }

    this.setFieldValues(result.payload);

    await this.notifyChange();

    return result;

  }



  async handleClipboard() {

    const result = await stageFromClipboard();

    if (result.ok && result.payload) {

      this.setFieldValues(result.payload);

    }

    await this.notifyChange();

    return result;

  }



  async handleClear() {

    await clearListingDock();

    this.setFieldValues({});

    await this.notifyChange();

    return { ok: true, message: 'Listing dock cleared.' };

  }



  async applyPayload(payload) {

    if (payload) {

      this.setFieldValues(payload);

    }

    await this.notifyChange();

  }

}


