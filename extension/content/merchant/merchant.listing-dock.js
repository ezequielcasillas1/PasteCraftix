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

import { normalizeTagsInputString } from './merchant.tags.js';

import {
  bindDockChipFieldEnterKey,
  buildDockChipPreviewMarkup,
  DOCK_CHIP_FIELD_CONFIG,
  DOCK_CHIP_FIELD_KEYS,
  renderDockChipPreview,
} from './merchant.dock-chips.js';

import {
  copyAllStagedTags,
  clampCustomMaxTags,
  getPlatformProfile,
  readMerchantPrefs,
  updateMerchantPrefs,
} from './merchant.tag-queue.js';

import { normalizeMaterialsInputString } from './merchant.materials.js';
import { normalizeQueueInputString } from './merchant.queue-parse.js';
import { refreshAllMerchantQueues, resetAllMerchantQueueIndices } from './merchant.queue-all.js';

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

      <div class="pc-merchant-dock-chip-preview pc-merchant-dock-tag-preview" data-field="dock-tag-preview" hidden>

        <div class="pc-merchant-dock-chip-preview-head pc-merchant-dock-tag-preview-head">

          <span data-field="dock-tag-count">0/13</span>

        </div>

        <div class="pc-merchant-dock-chip-chips pc-merchant-dock-tag-chips" data-field="dock-tag-chips"></div>

        <ul class="pc-merchant-dock-chip-warnings pc-merchant-dock-tag-warnings" data-field="dock-tag-warnings" hidden></ul>

      </div>

      <details class="pc-merchant-dock-advanced" data-field="dock-advanced">

        <summary>Advanced — title, description, materials &amp; queue fields</summary>

        <p class="pc-merchant-dock-hint">Comma-separated values stage queue items. Toggle a queue on the strip, then focus each marketplace field to paste-next.</p>

        <label class="pc-merchant-dock-field pc-merchant-dock-field-secondary">

          <span class="pc-merchant-dock-field-label-text">

            Materials <em class="pc-merchant-dock-hint">comma-separated · up to 13</em>

          </span>

          <input type="text" data-field="dock-materials" autocomplete="off" maxlength="500" placeholder="cotton, linen, waxed thread" />

        </label>

        ${buildDockChipPreviewMarkup({
          previewField: 'dock-materials-preview',
          countField: 'dock-materials-count',
          chipsField: 'dock-materials-chips',
          warningsField: 'dock-materials-warnings',
        })}

        <label class="pc-merchant-dock-field">

          <span>Title variants <em class="pc-merchant-dock-hint">comma-separated · Title Queue</em></span>

          <input type="text" data-field="dock-title" autocomplete="off" maxlength="500" placeholder="Variant A, Variant B" />

        </label>

        ${buildDockChipPreviewMarkup({
          previewField: 'dock-title-preview',
          countField: 'dock-title-count',
          chipsField: 'dock-title-chips',
          warningsField: 'dock-title-warnings',
        })}

        <label class="pc-merchant-dock-field">

          <span>Description variants <em class="pc-merchant-dock-hint">comma-separated · Desc Queue</em></span>

          <textarea data-field="dock-description" rows="4" maxlength="5000" placeholder="Short blurb A, Short blurb B"></textarea>

        </label>

        ${buildDockChipPreviewMarkup({
          previewField: 'dock-description-preview',
          countField: 'dock-description-count',
          chipsField: 'dock-description-chips',
          warningsField: 'dock-description-warnings',
        })}

        <label class="pc-merchant-dock-field">

          <span>Keywords <em class="pc-merchant-dock-hint">comma-separated · falls back to tags</em></span>

          <input type="text" data-field="dock-keywords" autocomplete="off" maxlength="1000" placeholder="organic cotton, gift for mom" />

        </label>

        ${buildDockChipPreviewMarkup({
          previewField: 'dock-keywords-preview',
          countField: 'dock-keywords-count',
          chipsField: 'dock-keywords-chips',
          warningsField: 'dock-keywords-warnings',
        })}

        <label class="pc-merchant-dock-field">

          <span>Bullets <em class="pc-merchant-dock-hint">comma-separated · up to 5</em></span>

          <input type="text" data-field="dock-bullets" autocomplete="off" maxlength="2500" placeholder="Premium cotton, Machine washable, …" />

        </label>

        ${buildDockChipPreviewMarkup({
          previewField: 'dock-bullets-preview',
          countField: 'dock-bullets-count',
          chipsField: 'dock-bullets-chips',
          warningsField: 'dock-bullets-warnings',
        })}

        <label class="pc-merchant-dock-field">

          <span>Hashtags <em class="pc-merchant-dock-hint">comma-separated · up to 15</em></span>

          <input type="text" data-field="dock-hashtags" autocomplete="off" maxlength="1500" placeholder="#handmade, #shopsmall, …" />

        </label>

        ${buildDockChipPreviewMarkup({
          previewField: 'dock-hashtags-preview',
          countField: 'dock-hashtags-count',
          chipsField: 'dock-hashtags-chips',
          warningsField: 'dock-hashtags-warnings',
        })}

      </details>

      <p class="pc-merchant-dock-meta" data-field="pc-merchant-dock-meta"></p>

      <div class="pc-merchant-dock-actions">

        <button type="button" class="pc-merchant-dock-btn pc-merchant-dock-btn-primary" data-action="${MERCHANT_ACTIONS.DOCK_SAVE}">

          Save to dock

        </button>

        <button type="button" class="pc-merchant-dock-btn" data-action="${MERCHANT_ACTIONS.DOCK_COPY_TAGS}">

          Copy tags

        </button>

        <button type="button" class="pc-merchant-dock-btn" data-action="${MERCHANT_ACTIONS.DOCK_CLIPBOARD}">

          From clipboard

        </button>

        <button type="button" class="pc-merchant-dock-btn pc-merchant-dock-btn-danger" data-action="${MERCHANT_ACTIONS.DOCK_CLEAR}">

          Clear dock

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

      this.renderChipPreview('tags', tagsEl.value);

      refreshAllMerchantQueues().catch(() => {});

    });

    bindDockChipFieldEnterKey(tagsEl, {
      onFinalize: () => {
        this.renderChipPreview('tags', tagsEl.value);
        refreshAllMerchantQueues().catch(() => {});
      },
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

      this.renderChipPreview('materials', next);

      refreshAllMerchantQueues().catch(() => {});

    });

    materialsEl?.addEventListener('input', () => {

      this.renderChipPreview('materials', materialsEl.value);

      refreshAllMerchantQueues().catch(() => {});

    });

    bindDockChipFieldEnterKey(materialsEl, {
      onFinalize: () => {
        this.renderChipPreview('materials', materialsEl.value);
        refreshAllMerchantQueues().catch(() => {});
      },
    });

    const queueFieldBindings = [
      { selector: '[data-field="dock-title"]', chipKey: 'title' },
      { selector: '[data-field="dock-description"]', chipKey: 'description' },
      { selector: '[data-field="dock-keywords"]', chipKey: 'keywords' },
      { selector: '[data-field="dock-bullets"]', chipKey: 'bullets' },
      { selector: '[data-field="dock-hashtags"]', chipKey: 'hashtags' },
    ];

    queueFieldBindings.forEach(({ selector, chipKey }) => {
      const el = this.panelEl.querySelector(selector);
      el?.addEventListener('input', () => {
        this.renderChipPreview(chipKey, el.value);
        refreshAllMerchantQueues().catch(() => {});
      });
      bindDockChipFieldEnterKey(el, {
        multiline: el?.tagName === 'TEXTAREA',
        onFinalize: () => {
          this.renderChipPreview(chipKey, el.value);
          refreshAllMerchantQueues().catch(() => {});
        },
      });
      el?.addEventListener('paste', (event) => {
        const raw = event.clipboardData?.getData('text/plain');
        if (!raw?.trim()) return;
        event.preventDefault();
        const normalized = normalizeQueueInputString(raw);
        if (el.tagName === 'TEXTAREA') {
          el.value = normalized;
        } else {
          const start = el.selectionStart ?? 0;
          const end = el.selectionEnd ?? 0;
          const before = el.value.slice(0, start).replace(/,\s*$/, '');
          const after = el.value.slice(end).replace(/^\s*,\s*/, '');
          let next = normalized;
          if (before && after) {
            next = `${before}, ${normalized}, ${after}`;
          } else if (before) {
            next = `${before}, ${normalized}`;
          } else if (after) {
            next = `${normalized}, ${after}`;
          }
          el.value = next;
        }
        this.renderChipPreview(chipKey, el.value);
        refreshAllMerchantQueues().catch(() => {});
      });
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

      this.renderChipPreview('tags', next);

      refreshAllMerchantQueues().catch(() => {});

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

      if (action === MERCHANT_ACTIONS.DOCK_CHIP_REMOVE || action === MERCHANT_ACTIONS.DOCK_TAG_REMOVE) {

        const dockField = btn.getAttribute('data-dock-field');
        const chipIndex = parseInt(btn.getAttribute('data-chip-index') ?? btn.getAttribute('data-tag-index'), 10);

        if (dockField && Number.isFinite(chipIndex)) {

          this.handleRemoveChip(dockField, chipIndex).catch(() => {});

        }

        return;

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



  getChipPreviewContext() {
    return { profile: this.getActiveProfile() };
  }

  renderChipPreview(fieldKey, rawValue) {
    const config = DOCK_CHIP_FIELD_CONFIG[fieldKey];
    if (!config || !this.panelEl) return null;
    const context = config.needsProfile ? this.getChipPreviewContext() : {};
    return renderDockChipPreview(this.panelEl, config, rawValue, context);
  }

  renderAllChipPreviews(values = null) {
    const source = values || this.getFieldValues();
    DOCK_CHIP_FIELD_KEYS.forEach((key) => {
      const config = DOCK_CHIP_FIELD_CONFIG[key];
      const raw = source[config.dockField] || '';
      this.renderChipPreview(key, raw);
    });
  }

  /** @deprecated use renderChipPreview('tags', raw) */
  renderTagPreview(rawTags) {
    return this.renderChipPreview('tags', rawTags);
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

      this.renderChipPreview('tags', tagsEl.value);

    }


    if (closePanel) {

      this.closeTagOptions();

    }

  }



  async handleCopyTags() {

    const result = await copyAllStagedTags();

    this.showDockToast(result.message || (result.ok ? 'Tags copied.' : 'Copy failed.'));

    return result;

  }



  getFieldValues() {

    return {

      title: this.panelEl?.querySelector('[data-field="dock-title"]')?.value || '',

      description: this.panelEl?.querySelector('[data-field="dock-description"]')?.value || '',

      tags: this.panelEl?.querySelector('[data-field="dock-tags"]')?.value || '',

      materials: this.panelEl?.querySelector('[data-field="dock-materials"]')?.value || '',

      keywords: this.panelEl?.querySelector('[data-field="dock-keywords"]')?.value || '',

      bullets: this.panelEl?.querySelector('[data-field="dock-bullets"]')?.value || '',

      hashtags: this.panelEl?.querySelector('[data-field="dock-hashtags"]')?.value || '',

    };

  }



  setFieldValues(payload = {}, { previewTags = null } = {}) {

    const titleEl = this.panelEl?.querySelector('[data-field="dock-title"]');

    const descEl = this.panelEl?.querySelector('[data-field="dock-description"]');

    const tagsEl = this.panelEl?.querySelector('[data-field="dock-tags"]');

    const materialsEl = this.panelEl?.querySelector('[data-field="dock-materials"]');

    const keywordsEl = this.panelEl?.querySelector('[data-field="dock-keywords"]');

    const bulletsEl = this.panelEl?.querySelector('[data-field="dock-bullets"]');

    const hashtagsEl = this.panelEl?.querySelector('[data-field="dock-hashtags"]');

    const metaEl = this.panelEl?.querySelector('[data-field="pc-merchant-dock-meta"]');

    const advancedEl = this.panelEl?.querySelector('[data-field="dock-advanced"]');

    if (titleEl) titleEl.value = payload.title || '';

    if (descEl) descEl.value = payload.description || '';

    if (materialsEl) materialsEl.value = payload.materials || '';

    if (keywordsEl) keywordsEl.value = payload.keywords || '';

    if (bulletsEl) bulletsEl.value = payload.bullets || '';

    if (hashtagsEl) hashtagsEl.value = payload.hashtags || '';

    if (tagsEl) tagsEl.value = payload.tags || '';

    const previewValues = { ...payload };
    if (previewTags != null) {
      previewValues.tags = previewTags;
    }
    this.renderAllChipPreviews(previewValues);

    if (metaEl) metaEl.textContent = formatMeta(payload);

    if (advancedEl && (payload.title || payload.description || payload.materials || payload.keywords || payload.bullets || payload.hashtags)) {

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



  async handleRemoveChip(dockField, chipIndex) {

    const config = Object.values(DOCK_CHIP_FIELD_CONFIG).find((c) => c.dockField === dockField);

    if (!config) return { ok: false, error: 'Unknown chip field.' };

    const inputEl = this.panelEl?.querySelector(`[data-field="${config.inputField}"]`);

    if (!inputEl) return { ok: false, error: 'Field not found.' };

    const context = config.needsProfile ? this.getChipPreviewContext() : {};

    const next = config.removeAtIndex(inputEl.value, chipIndex, context);

    inputEl.value = next;

    this.renderChipPreview(config.key, next);

    const values = { ...this.getFieldValues(), [config.dockField]: next };

    const profile = config.needsProfile ? this.getActiveProfile() : null;

    const result = await saveListingDock(values, 'manual', profile);

    if (result.ok && result.payload) {

      inputEl.value = result.payload[config.dockField] || '';

      this.renderChipPreview(config.key, inputEl.value);

    }

    await this.notifyChange();

    await refreshAllMerchantQueues();

    return { ok: true };

  }

  /** @deprecated use handleRemoveChip('tags', chipIndex) */
  async handleRemoveTag(tagIndex) {
    return this.handleRemoveChip('tags', tagIndex);
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

    await refreshAllMerchantQueues();

    resetAllMerchantQueueIndices();

    return result;

  }



  async handleClipboard() {

    const result = await stageFromClipboard(this.getActiveProfile());

    if (result.ok && result.payload) {

      this.setFieldValues(result.payload);

    }

    await this.notifyChange();

    await refreshAllMerchantQueues();

    resetAllMerchantQueueIndices();

    return result;

  }



  async handleClear() {

    await clearListingDock();

    this.setFieldValues({});

    await this.notifyChange();

    resetAllMerchantQueueIndices();


    return { ok: true, message: 'Listing dock cleared.' };

  }



  async applyPayload(payload) {

    if (payload) {

      this.setFieldValues(payload);

    }

    await this.notifyChange();

  }

}


