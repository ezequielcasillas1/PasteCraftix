/**
 * Listing dock markup + panel UI helpers (Phase 3A extract).
 * @forward-slice merchant
 */
import {
  MERCHANT_ACTIONS,
  MERCHANT_BRAND,
  MERCHANT_CUSTOM_TAG_LIMIT,
  MERCHANT_PLATFORM_PRESETS,
  MERCHANT_TAG_LIMIT_PRESET_IDS,
} from './merchant.constants.js';
import { validateTags } from './merchant.tags.js';

export function buildTagLimitOptionsMarkup() {
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

function buildDockHeaderMarkup() {
  return `
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
      </div>`;
}

function buildDockTagsFieldMarkup() {
  return `
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
      </div>`;
}

function buildDockSecondaryMarkup() {
  return `
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
      <p class="pc-merchant-dock-meta" data-field="pc-merchant-dock-meta"></p>`;
}

function buildDockActionsMarkup() {
  return `
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
      </div>`;
}

export function buildDockMarkup() {
  return `
    <div class="pc-merchant-dock-panel" data-field="pc-merchant-dock-panel" hidden>
      ${buildDockHeaderMarkup()}
      ${buildDockTagsFieldMarkup()}
      ${buildDockSecondaryMarkup()}
      ${buildDockActionsMarkup()}
    </div>
  `;
}

export function formatMeta(payload) {
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

export function chipStatusClass(status) {
  if (status === 'valid') return 'pc-merchant-tag-chip-valid';
  if (status === 'duplicate') return 'pc-merchant-tag-chip-duplicate';
  if (status === 'invalid_length') return 'pc-merchant-tag-chip-invalid';
  if (status === 'over_limit') return 'pc-merchant-tag-chip-over';
  return 'pc-merchant-tag-chip-invalid';
}

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clearTagPreview(previewEl, chipsEl, warningsEl) {
  previewEl.hidden = true;
  chipsEl.innerHTML = '';
  warningsEl.hidden = true;
  warningsEl.innerHTML = '';
}

function paintTagChips(chipsEl, chips) {
  chipsEl.innerHTML = chips.map((chip) => {
    const safeText = escapeHtml(chip.text);
    const title = chip.message ? ` title="${escapeHtml(chip.message)}"` : '';
    return `<span class="pc-merchant-tag-chip ${chipStatusClass(chip.status)}"${title}>${safeText}</span>`;
  }).join('');
}

function paintTagWarnings(warningsEl, warnings) {
  if (warnings.length > 0) {
    warningsEl.hidden = false;
    warningsEl.innerHTML = warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('');
    return;
  }
  warningsEl.hidden = true;
  warningsEl.innerHTML = '';
}

function queryTagPreviewEls(panelEl) {
  return {
    previewEl: panelEl?.querySelector('[data-field="dock-tag-preview"]'),
    countEl: panelEl?.querySelector('[data-field="dock-tag-count"]'),
    chipsEl: panelEl?.querySelector('[data-field="dock-tag-chips"]'),
    warningsEl: panelEl?.querySelector('[data-field="dock-tag-warnings"]'),
  };
}

export function renderTagPreview(panelEl, rawTags, profile) {
  const { previewEl, countEl, chipsEl, warningsEl } = queryTagPreviewEls(panelEl);
  if (!previewEl || !countEl || !chipsEl || !warningsEl) return;

  const trimmed = (rawTags || '').trim();
  if (!trimmed) {
    clearTagPreview(previewEl, chipsEl, warningsEl);
    return;
  }

  const result = validateTags(trimmed, profile);
  previewEl.hidden = false;
  countEl.textContent = `${result.count}/${result.maxTags}`;
  countEl.classList.toggle('pc-merchant-tag-count-warn', result.count >= result.maxTags);
  countEl.classList.toggle('pc-merchant-tag-count-error', result.hasErrors);
  paintTagChips(chipsEl, result.chips);
  paintTagWarnings(warningsEl, result.warnings);
}

export function showDockToast(dock, message) {
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
  clearTimeout(dock._toastTimer);
  dock._toastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2200);
}

export function updatePlatformHint(panelEl, profile) {
  const hintEl = panelEl?.querySelector('[data-field="dock-tag-hint"]');
  if (hintEl) {
    hintEl.textContent = `${profile.label} · ${profile.maxTags} max · ${profile.maxChars} chars`;
  }
}

export function syncCustomButtonState(panelEl) {
  const customBtn = panelEl?.querySelector(`[data-action="${MERCHANT_ACTIONS.DOCK_TAG_LIMIT_CUSTOM_SELECT}"]`);
  const isCustom = panelEl?.querySelector('[data-field="dock-tag-limit-preset"][value="custom"]:checked');
  if (customBtn) {
    customBtn.classList.toggle('is-selected', Boolean(isCustom));
    customBtn.setAttribute('aria-pressed', isCustom ? 'true' : 'false');
  }
}

export function syncTagLimitCustomRow(panelEl) {
  const selected = panelEl?.querySelector('[data-field="dock-tag-limit-preset"]:checked');
  const customRow = panelEl?.querySelector('[data-field="dock-tag-limit-custom-row"]');
  if (customRow) {
    customRow.hidden = selected?.value !== 'custom';
  }
  syncCustomButtonState(panelEl);
}

export function syncTagOptionsPanel(panelEl, prefs) {
  const radios = panelEl?.querySelectorAll('[data-field="dock-tag-limit-preset"]');
  radios?.forEach((radio) => {
    radio.checked = radio.value === prefs.platformPreset;
  });
  const customInput = panelEl?.querySelector('[data-field="dock-tag-limit-custom"]');
  if (customInput) {
    customInput.value = String(prefs.customMaxTags ?? MERCHANT_CUSTOM_TAG_LIMIT.DEFAULT);
  }
  syncTagLimitCustomRow(panelEl);
}

export function selectCustomTagLimit(panelEl) {
  const customRadio = panelEl?.querySelector('[data-field="dock-tag-limit-preset"][value="custom"]');
  if (customRadio) {
    customRadio.checked = true;
  }
  syncTagLimitCustomRow(panelEl);
  const customInput = panelEl?.querySelector('[data-field="dock-tag-limit-custom"]');
  customInput?.focus();
  customInput?.select();
}

export function setTagOptionsOpen(panelEl, open) {
  const panel = panelEl?.querySelector('[data-field="dock-tag-options-panel"]');
  const btn = panelEl?.querySelector(`[data-action="${MERCHANT_ACTIONS.DOCK_TAG_OPTIONS_TOGGLE}"]`);
  if (panel) panel.hidden = !open;
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function readFieldValue(panelEl, field) {
  return panelEl?.querySelector(`[data-field="${field}"]`)?.value || '';
}

export function getFieldValues(panelEl) {
  return {
    title: readFieldValue(panelEl, 'dock-title'),
    description: readFieldValue(panelEl, 'dock-description'),
    tags: readFieldValue(panelEl, 'dock-tags'),
    materials: readFieldValue(panelEl, 'dock-materials'),
  };
}

function writeInputValue(el, value) {
  if (el) el.value = value || '';
}

function maybeOpenAdvanced(advancedEl, payload) {
  const hasAdvanced = Boolean(payload.title || payload.description);
  if (advancedEl && hasAdvanced) {
    advancedEl.open = true;
  }
}

export function setFieldValues(panelEl, payload = {}, { previewTags = null, profile = null } = {}) {
  const titleEl = panelEl?.querySelector('[data-field="dock-title"]');
  const descEl = panelEl?.querySelector('[data-field="dock-description"]');
  const tagsEl = panelEl?.querySelector('[data-field="dock-tags"]');
  const materialsEl = panelEl?.querySelector('[data-field="dock-materials"]');
  const metaEl = panelEl?.querySelector('[data-field="pc-merchant-dock-meta"]');
  const advancedEl = panelEl?.querySelector('[data-field="dock-advanced"]');

  writeInputValue(titleEl, payload.title);
  writeInputValue(descEl, payload.description);
  writeInputValue(materialsEl, payload.materials);
  if (tagsEl) {
    tagsEl.value = payload.tags || '';
    const previewSource = previewTags != null ? previewTags : tagsEl.value;
    if (profile) {
      renderTagPreview(panelEl, previewSource, profile);
    }
  }
  if (metaEl) metaEl.textContent = formatMeta(payload);
  maybeOpenAdvanced(advancedEl, payload);
}
