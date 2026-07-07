import {
  MERCHANT_ACTIONS,
  MERCHANT_BRAND,
  MERCHANT_CUSTOM_TAG_LIMIT,
  MERCHANT_PLATFORM_PRESETS,
  MERCHANT_TAG_LIMIT_PRESET_IDS,
} from './merchant.constants.js';

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

import { normalizeTagsInputString, validateTags } from './merchant.tags.js';

import {
  copyAllStagedTags,
  clampCustomMaxTags,
  getPlatformProfile,
  pasteNextTag,
  readMerchantPrefs,
  refreshTagQueueTags,
  resetTagQueueIndex,
  updateMerchantPrefs,
} from './merchant.tag-queue.js';

import {
  copyAllStagedMaterials,
  normalizeMaterialsInputString,
} from './merchant.materials.js';

import { runSealAndShip } from './merchant.seal-ship.js';



function buildTagLimitOptionsMarkup() {
  const presetRows = MERCHANT_TAG_LIMIT_PRESET_IDS
    .filter((id) => id !== 'custom')
    .map((id) => {
      const preset = MERCHANT_PLATFORM_PRESETS[id];
      return `
        <label class="pc-merchant-dock-tag-limit-option">
          <input type="radio" name="pc-dock-tag-limit" value="${preset.id}" data-field="dock-tag-limit-preset" />
          <span>${preset.label} — ${preset.maxTags} tags · ${preset.maxChars} chars</span>
        </label>
      `;
    })
    .join('');

  return `
    <p class="pc-merchant-dock-tag-limit-title">Tag limit preset</p>
    <div class="pc-merchant-dock-tag-limit-scroll" data-field="dock-tag-limit-scroll">
      ${presetRows}
    </div>
    <input
      type="radio"
      name="pc-dock-tag-limit"
      value="custom"
      data-field="dock-tag-limit-preset"
      class="pc-merchant-dock-tag-limit-custom-radio"
      hidden
    />
    <button
      type="button"
      class="pc-merchant-dock-tag-limit-custom-btn"
      data-action="${MERCHANT_ACTIONS.DOCK_TAG_LIMIT_CUSTOM_SELECT}"
      aria-pressed="false"
    >
      Custom — set your own max
    </button>
    <div class="pc-merchant-dock-tag-limit-custom" data-field="dock-tag-limit-custom-row" hidden>
      <label class="pc-merchant-dock-tag-limit-custom-field">
        <span>Max tags</span>
        <input
          type="number"
          data-field="dock-tag-limit-custom"
          min="${MERCHANT_CUSTOM_TAG_LIMIT.MIN}"
          max="${MERCHANT_CUSTOM_TAG_LIMIT.MAX}"
          value="${MERCHANT_CUSTOM_TAG_LIMIT.DEFAULT}"
        />
      </label>
      <button
        type="button"
        class="pc-merchant-dock-btn pc-merchant-dock-btn-primary pc-merchant-dock-tag-limit-apply"
        data-action="${MERCHANT_ACTIONS.DOCK_TAG_LIMIT_APPLY}"
      >
        Apply custom max
      </button>
    </div>
  `;
}

function buildDockMarkup() {

  return `

    <div class="pc-merchant-dock-panel" data-field="pc-merchant-dock-panel" hidden>

      <div class="pc-merchant-dock-header">

        <h2 class="pc-merchant-dock-title">${MERCHANT_BRAND.DOCK_LABEL}</h2>

      </div>

      <p class="pc-merchant-dock-warning" data-field="pc-merchant-dock-warning">

        Ephemeral staging — not saved forever. Auto-expires in 24h unless refreshed.

      </p>

      <div class="pc-merchant-dock-prefs" data-field="dock-prefs-row">

        <label class="pc-merchant-dock-pref pc-merchant-dock-pref-check">

          <input type="checkbox" data-field="dock-queue-auto-advance" checked />

          <span>Auto-advance queue</span>

        </label>

      </div>

      <label class="pc-merchant-dock-field pc-merchant-dock-field-primary">

        <span class="pc-merchant-dock-field-label-row">

          <span class="pc-merchant-dock-field-label-text">

            Tags <em class="pc-merchant-dock-hint" data-field="dock-tag-hint">Etsy · 13 max · 20 chars</em>

          </span>

          <button
            type="button"
            class="pc-merchant-dock-options-btn"
            data-action="${MERCHANT_ACTIONS.DOCK_TAG_OPTIONS_TOGGLE}"
            aria-expanded="false"
          >
            Options
          </button>

        </span>

        <div
          class="pc-merchant-dock-tag-options"
          data-field="dock-tag-options-panel"
          hidden
        >
          ${buildTagLimitOptionsMarkup()}
        </div>

        <input type="text" data-field="dock-tags" autocomplete="off" maxlength="1000" placeholder="comma-separated tags" />

      </label>

      <div class="pc-merchant-dock-tag-preview" data-field="dock-tag-preview" hidden>

        <div class="pc-merchant-dock-tag-preview-head">

          <span data-field="dock-tag-count">0/13</span>

        </div>

        <div class="pc-merchant-dock-tag-chips" data-field="dock-tag-chips"></div>

        <ul class="pc-merchant-dock-tag-warnings" data-field="dock-tag-warnings" hidden></ul>

      </div>

      <label class="pc-merchant-dock-field pc-merchant-dock-field-secondary">

        <span class="pc-merchant-dock-field-label-text">

          Materials <em class="pc-merchant-dock-hint">comma-separated · up to 13</em>

        </span>

        <input type="text" data-field="dock-materials" autocomplete="off" maxlength="500" placeholder="cotton, linen, waxed thread" />

      </label>

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

        <button type="button" class="pc-merchant-dock-btn" data-action="${MERCHANT_ACTIONS.DOCK_COPY_TAGS}">

          Copy tags

        </button>

        <button type="button" class="pc-merchant-dock-btn" data-action="${MERCHANT_ACTIONS.DOCK_NEXT_TAG}">

          Paste next tag

        </button>

        <button type="button" class="pc-merchant-dock-btn" data-action="${MERCHANT_ACTIONS.DOCK_COPY_MATERIALS}">

          Copy materials

        </button>

        <button type="button" class="pc-merchant-dock-btn" data-action="${MERCHANT_ACTIONS.DOCK_CLIPBOARD}">

          From clipboard

        </button>

        <button type="button" class="pc-merchant-dock-btn pc-merchant-dock-btn-danger" data-action="${MERCHANT_ACTIONS.DOCK_CLEAR}">

          Clear dock

        </button>

        <button type="button" class="pc-merchant-dock-btn pc-merchant-dock-btn-seal" data-action="${MERCHANT_ACTIONS.SEAL_SHIP}" title="Confirm and purge ephemeral staging">

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

    this._platformPreset = 'etsy';

    this._customMaxTags = MERCHANT_CUSTOM_TAG_LIMIT.DEFAULT;

    this._tagOptionsOpen = false;

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

    this.hydratePrefs().catch(() => {});

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



  getActiveProfile() {
    return getPlatformProfile(this._platformPreset, {
      platformPreset: this._platformPreset,
      customMaxTags: this._customMaxTags,
    });
  }



  bindEvents() {

    if (!this.panelEl || this.panelEl.dataset.pcMerchantDockBound === '1') return;

    this.panelEl.dataset.pcMerchantDockBound = '1';



    const tagsEl = this.panelEl.querySelector('[data-field="dock-tags"]');

    tagsEl?.addEventListener('input', () => {

      this.renderTagPreview(tagsEl.value);

      refreshTagQueueTags().catch(() => {});

    });

    const materialsEl = this.panelEl.querySelector('[data-field="dock-materials"]');

    materialsEl?.addEventListener('paste', (event) => {

      const raw = event.clipboardData?.getData('text/plain');

      if (!raw?.trim()) return;

      event.preventDefault();

      const normalized = normalizeMaterialsInputString(raw);

      const start = materialsEl.selectionStart ?? 0;

      const end = materialsEl.selectionEnd ?? 0;

      const before = materialsEl.value.slice(0, start).replace(/,\s*$/, '');

      const after = materialsEl.value.slice(end).replace(/^\s*,\s*/, '');

      let next = normalized;

      if (before && after) {

        next = `${before}, ${normalized}, ${after}`;

      } else if (before) {

        next = `${before}, ${normalized}`;

      } else if (after) {

        next = `${normalized}, ${after}`;

      }

      materialsEl.value = next;

    });



    tagsEl?.addEventListener('paste', (event) => {

      const raw = event.clipboardData?.getData('text/plain');

      if (!raw?.trim()) return;

      event.preventDefault();

      const profile = this.getActiveProfile();

      const normalized = normalizeTagsInputString(raw, profile);

      const start = tagsEl.selectionStart ?? 0;

      const end = tagsEl.selectionEnd ?? 0;

      const before = tagsEl.value.slice(0, start).replace(/,\s*$/, '');

      const after = tagsEl.value.slice(end).replace(/^\s*,\s*/, '');

      let next = normalized;

      if (before && after) {

        next = `${before}, ${normalized}, ${after}`;

      } else if (before) {

        next = `${before}, ${normalized}`;

      } else if (after) {

        next = `${normalized}, ${after}`;

      }

      tagsEl.value = next;

      this.renderTagPreview(next);

      refreshTagQueueTags().catch(() => {});

    });



    const presetRadios = this.panelEl.querySelectorAll('[data-field="dock-tag-limit-preset"]');

    presetRadios.forEach((radio) => {

      radio.addEventListener('change', () => {

        this.syncTagLimitCustomRow();

        if (radio.value !== 'custom' && radio.checked) {

          this.applyTagLimitSelection({ closePanel: true }).catch(() => {});

        }

      });

    });



    const customInput = this.panelEl.querySelector('[data-field="dock-tag-limit-custom"]');

    customInput?.addEventListener('keydown', (event) => {

      if (event.key === 'Enter') {

        event.preventDefault();

        this.applyTagLimitSelection({ closePanel: true }).catch(() => {});

      }

    });



    const autoAdvanceEl = this.panelEl.querySelector('[data-field="dock-queue-auto-advance"]');

    autoAdvanceEl?.addEventListener('change', () => {

      updateMerchantPrefs({ queueAutoAdvance: autoAdvanceEl.checked }).catch(() => {});

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

      if (action === MERCHANT_ACTIONS.DOCK_COPY_TAGS) {

        this.handleCopyTags().catch(() => {});

        return;

      }

      if (action === MERCHANT_ACTIONS.DOCK_NEXT_TAG) {

        this.handleNextTag().catch(() => {});

        return;

      }

      if (action === MERCHANT_ACTIONS.DOCK_COPY_MATERIALS) {

        this.handleCopyMaterials().catch(() => {});

        return;

      }

      if (action === MERCHANT_ACTIONS.DOCK_CLEAR) {

        this.handleClear().catch(() => {});

        return;

      }

      if (action === MERCHANT_ACTIONS.DOCK_CLOSE) {

        this.close();

        return;

      }

      if (action === MERCHANT_ACTIONS.DOCK_TAG_OPTIONS_TOGGLE) {

        this.toggleTagOptions();

        return;

      }

      if (action === MERCHANT_ACTIONS.DOCK_TAG_LIMIT_CUSTOM_SELECT) {

        this.selectCustomTagLimit();

        return;

      }

      if (action === MERCHANT_ACTIONS.DOCK_TAG_LIMIT_APPLY) {

        this.applyTagLimitSelection({ closePanel: true }).catch(() => {});

        return;

      }

      if (action === MERCHANT_ACTIONS.SEAL_SHIP) {

        this.handleSealShip().catch(() => {});

      }

    });



    this.panelEl.addEventListener('click', (event) => {

      if (!this._tagOptionsOpen) return;

      const panel = this.panelEl.querySelector('[data-field="dock-tag-options-panel"]');

      const toggleBtn = this.panelEl.querySelector(`[data-action="${MERCHANT_ACTIONS.DOCK_TAG_OPTIONS_TOGGLE}"]`);

      if (!panel || panel.contains(event.target) || toggleBtn?.contains(event.target)) return;

      this.closeTagOptions();

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



    const result = validateTags(trimmed, this.getActiveProfile());

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



  showDockToast(message) {

    const stripRoot = window.__pasteCraftMerchant?.strip?.root;

    if (!stripRoot) return;

    let toast = stripRoot.querySelector('[data-field="pc-merchant-toast"]');

    if (!toast) {

      toast = document.createElement('div');

      toast.className = 'pc-merchant-toast';

      toast.setAttribute('data-field', 'pc-merchant-toast');

      stripRoot.appendChild(toast);

    }

    toast.textContent = message;

    toast.classList.add('is-visible');

    clearTimeout(this._toastTimer);

    this._toastTimer = setTimeout(() => {

      toast.classList.remove('is-visible');

    }, 2200);

  }



  updatePlatformHint() {

    const hintEl = this.panelEl?.querySelector('[data-field="dock-tag-hint"]');

    const profile = this.getActiveProfile();

    if (hintEl) {

      hintEl.textContent = `${profile.label} · ${profile.maxTags} max · ${profile.maxChars} chars`;

    }

  }



  syncTagLimitCustomRow() {

    const selected = this.panelEl?.querySelector('[data-field="dock-tag-limit-preset"]:checked');

    const customRow = this.panelEl?.querySelector('[data-field="dock-tag-limit-custom-row"]');

    if (customRow) {

      customRow.hidden = selected?.value !== 'custom';

    }

    this.syncCustomButtonState();

  }



  syncCustomButtonState() {

    const customBtn = this.panelEl?.querySelector(`[data-action="${MERCHANT_ACTIONS.DOCK_TAG_LIMIT_CUSTOM_SELECT}"]`);

    const isCustom = this.panelEl?.querySelector('[data-field="dock-tag-limit-preset"][value="custom"]:checked');

    if (customBtn) {

      customBtn.classList.toggle('is-selected', Boolean(isCustom));

      customBtn.setAttribute('aria-pressed', isCustom ? 'true' : 'false');

    }

  }



  selectCustomTagLimit() {

    const customRadio = this.panelEl?.querySelector('[data-field="dock-tag-limit-preset"][value="custom"]');

    if (customRadio) {

      customRadio.checked = true;

    }

    this.syncTagLimitCustomRow();

    const customInput = this.panelEl?.querySelector('[data-field="dock-tag-limit-custom"]');

    customInput?.focus();

    customInput?.select();

  }



  syncTagOptionsPanel(prefs = null) {

    const active = prefs || {

      platformPreset: this._platformPreset,

      customMaxTags: this._customMaxTags,

    };

    const radios = this.panelEl?.querySelectorAll('[data-field="dock-tag-limit-preset"]');

    radios?.forEach((radio) => {

      radio.checked = radio.value === active.platformPreset;

    });

    const customInput = this.panelEl?.querySelector('[data-field="dock-tag-limit-custom"]');

    if (customInput) {

      customInput.value = String(active.customMaxTags ?? MERCHANT_CUSTOM_TAG_LIMIT.DEFAULT);

    }

    this.syncTagLimitCustomRow();

  }



  toggleTagOptions() {

    if (this._tagOptionsOpen) {

      this.closeTagOptions();

      return;

    }

    this.syncTagOptionsPanel();

    this._tagOptionsOpen = true;

    const panel = this.panelEl?.querySelector('[data-field="dock-tag-options-panel"]');

    const btn = this.panelEl?.querySelector(`[data-action="${MERCHANT_ACTIONS.DOCK_TAG_OPTIONS_TOGGLE}"]`);

    if (panel) panel.hidden = false;

    if (btn) btn.setAttribute('aria-expanded', 'true');

  }



  closeTagOptions() {

    this._tagOptionsOpen = false;

    const panel = this.panelEl?.querySelector('[data-field="dock-tag-options-panel"]');

    const btn = this.panelEl?.querySelector(`[data-action="${MERCHANT_ACTIONS.DOCK_TAG_OPTIONS_TOGGLE}"]`);

    if (panel) panel.hidden = true;

    if (btn) btn.setAttribute('aria-expanded', 'false');

  }



  async hydratePrefs() {

    const prefs = await readMerchantPrefs();

    this._platformPreset = prefs.platformPreset;

    this._customMaxTags = prefs.customMaxTags ?? MERCHANT_CUSTOM_TAG_LIMIT.DEFAULT;

    const autoAdvanceEl = this.panelEl?.querySelector('[data-field="dock-queue-auto-advance"]');

    if (autoAdvanceEl) autoAdvanceEl.checked = prefs.queueAutoAdvance !== false;

    this.syncTagOptionsPanel(prefs);

    this.updatePlatformHint();

  }



  async applyTagLimitSelection({ closePanel = false } = {}) {

    const selected = this.panelEl?.querySelector('[data-field="dock-tag-limit-preset"]:checked');

    const presetId = selected?.value || this._platformPreset;

    const presetOk = MERCHANT_TAG_LIMIT_PRESET_IDS.includes(presetId)
      || MERCHANT_PLATFORM_PRESETS[presetId];

    const safeId = presetOk ? presetId : 'etsy';

    const customInput = this.panelEl?.querySelector('[data-field="dock-tag-limit-custom"]');

    const customMaxTags = clampCustomMaxTags(customInput?.value ?? this._customMaxTags);

    this._platformPreset = safeId;

    this._customMaxTags = customMaxTags;

    await updateMerchantPrefs({ platformPreset: safeId, customMaxTags });

    this.syncTagOptionsPanel();

    this.updatePlatformHint();

    const tagsEl = this.panelEl?.querySelector('[data-field="dock-tags"]');

    if (tagsEl) {

      this.renderTagPreview(tagsEl.value);

    }

    await refreshTagQueueTags();

    if (closePanel) {

      this.closeTagOptions();

    }

  }



  async handleCopyTags() {

    const result = await copyAllStagedTags();

    this.showDockToast(result.message || (result.ok ? 'Tags copied.' : 'Copy failed.'));

    return result;

  }



  async handleNextTag() {

    const result = await pasteNextTag();

    this.showDockToast(result.message || (result.ok ? 'Tag copied.' : 'Queue failed.'));

    return result;

  }



  async handleCopyMaterials() {

    const result = await copyAllStagedMaterials();

    this.showDockToast(result.message || (result.ok ? 'Materials copied.' : 'Copy failed.'));

    return result;

  }



  async handleSealShip() {

    const result = await runSealAndShip({
      stripEl: this.stripEl,
      root: window.__pasteCraftMerchant?.strip?.root || null,
    });

    if (result.ok) {

      this.setFieldValues({});

      this.close();

    }

    this.showDockToast(result.message || (result.ok ? 'Staging purged.' : 'Seal & Ship failed.'));

    return result;

  }



  getFieldValues() {

    return {

      title: this.panelEl?.querySelector('[data-field="dock-title"]')?.value || '',

      description: this.panelEl?.querySelector('[data-field="dock-description"]')?.value || '',

      tags: this.panelEl?.querySelector('[data-field="dock-tags"]')?.value || '',

      materials: this.panelEl?.querySelector('[data-field="dock-materials"]')?.value || '',

    };

  }



  setFieldValues(payload = {}, { previewTags = null } = {}) {

    const titleEl = this.panelEl?.querySelector('[data-field="dock-title"]');

    const descEl = this.panelEl?.querySelector('[data-field="dock-description"]');

    const tagsEl = this.panelEl?.querySelector('[data-field="dock-tags"]');

    const materialsEl = this.panelEl?.querySelector('[data-field="dock-materials"]');

    const metaEl = this.panelEl?.querySelector('[data-field="pc-merchant-dock-meta"]');

    const advancedEl = this.panelEl?.querySelector('[data-field="dock-advanced"]');

    if (titleEl) titleEl.value = payload.title || '';

    if (descEl) descEl.value = payload.description || '';

    if (materialsEl) materialsEl.value = payload.materials || '';

    if (tagsEl) {

      tagsEl.value = payload.tags || '';

      const previewSource = previewTags != null ? previewTags : tagsEl.value;

      this.renderTagPreview(previewSource);

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

    await refreshTagQueueTags();

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

    this.hydratePrefs().catch(() => {});

    this.hydrateFromStorage().catch(() => {});

    const tagsEl = this.panelEl.querySelector('[data-field="dock-tags"]');

    tagsEl?.focus();

  }



  close() {

    if (!this.panelEl) return;

    this.panelEl.hidden = true;

    this._open = false;

    this.closeTagOptions();

  }



  toggle() {

    if (this._open) this.close();

    else this.open();

  }



  focus() {

    this.open();

  }



  async handleSave() {

    const result = await saveListingDock(
      this.getFieldValues(),
      'manual',
      this.getActiveProfile(),
    );

    if (!result.ok) {

      return result;

    }

    this.setFieldValues(result.payload);

    await this.notifyChange();

    await refreshTagQueueTags();

    resetTagQueueIndex();

    return result;

  }



  async handleClipboard() {

    const result = await stageFromClipboard(this.getActiveProfile());

    if (result.ok && result.payload) {

      this.setFieldValues(result.payload);

    }

    await this.notifyChange();

    await refreshTagQueueTags();

    resetTagQueueIndex();

    return result;

  }



  async handleClear() {

    await clearListingDock();

    this.setFieldValues({});

    await this.notifyChange();

    resetTagQueueIndex();

    await refreshTagQueueTags();

    return { ok: true, message: 'Listing dock cleared.' };

  }



  async applyPayload(payload) {

    if (payload) {

      this.setFieldValues(payload);

    }

    await this.notifyChange();

  }

}


