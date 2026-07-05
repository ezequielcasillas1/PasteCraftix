import {
  MERCHANT_ACTIONS,
  MERCHANT_QUEUE_LIMITS,
} from './merchant.constants.js';
import {
  ETSY_MATERIALS_PROFILE,
  materialsToStorageString,
  splitMaterialsInput,
} from './merchant.materials.js';
import {
  queueToStorageString,
  splitQueueInput,
} from './merchant.queue-parse.js';
import { removeTagAtIndex, validateTags } from './merchant.tags.js';

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function chipStatusClass(status) {
  if (status === 'valid') return 'pc-merchant-tag-chip-valid';
  if (status === 'duplicate') return 'pc-merchant-tag-chip-duplicate';
  if (status === 'invalid_length') return 'pc-merchant-tag-chip-invalid';
  if (status === 'over_limit') return 'pc-merchant-tag-chip-over';
  return 'pc-merchant-tag-chip-invalid';
}

/**
 * Generic chip validation — mirrors validateTags chip semantics.
 * @returns {{ items: string[], chips: Array, count: number, maxItems: number, maxChars: number, warnings: string[], hasErrors: boolean }}
 */
export function validateChipItems(rawInput, {
  splitFn,
  joinFn,
  maxItems = 50,
  maxChars = 500,
  itemLabel = 'item',
} = {}) {
  const join = joinFn || queueToStorageString;
  const split = splitFn || splitQueueInput;
  const segments = split(typeof rawInput === 'string' ? rawInput : join(rawInput));
  const seen = new Set();
  const chips = [];
  const valid = [];
  const warnings = [];

  segments.forEach((raw, segmentIndex) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) {
      chips.push({
        text: trimmed,
        status: 'duplicate',
        message: `Duplicate ${itemLabel}`,
        segmentIndex,
      });
      return;
    }
    seen.add(lower);

    if (trimmed.length > maxChars) {
      chips.push({
        text: trimmed,
        status: 'invalid_length',
        message: `${trimmed.length}/${maxChars} chars`,
        segmentIndex,
      });
      return;
    }

    if (valid.length >= maxItems) {
      chips.push({
        text: trimmed,
        status: 'over_limit',
        message: `Over ${maxItems} ${itemLabel} limit`,
        segmentIndex,
      });
      return;
    }

    valid.push(trimmed);
    chips.push({ text: trimmed, status: 'valid', message: null, segmentIndex });
  });

  const invalidCount = chips.filter((c) => c.status === 'invalid_length').length;
  const duplicateCount = chips.filter((c) => c.status === 'duplicate').length;
  const overLimitCount = chips.filter((c) => c.status === 'over_limit').length;

  if (invalidCount > 0) {
    warnings.push(`${invalidCount} ${itemLabel}(s) exceed ${maxChars} characters`);
  }
  if (duplicateCount > 0) {
    warnings.push(`${duplicateCount} duplicate ${itemLabel}(s) removed`);
  }
  if (overLimitCount > 0) {
    warnings.push(`Only first ${maxItems} valid ${itemLabel}(s) kept`);
  }
  if (valid.length === maxItems && overLimitCount > 0) {
    warnings.push(`${itemLabel} limit reached (${maxItems}/${maxItems})`);
  }

  return {
    items: valid,
    chips,
    count: valid.length,
    maxItems,
    maxChars,
    warnings,
    hasErrors: invalidCount > 0 || overLimitCount > 0,
  };
}

export function removeChipAtIndex(rawInput, index, splitFn, joinFn) {
  const join = joinFn || queueToStorageString;
  const split = splitFn || splitQueueInput;
  const items = split(typeof rawInput === 'string' ? rawInput : join(rawInput));
  if (index < 0 || index >= items.length) {
    return join(items);
  }
  items.splice(index, 1);
  return join(items);
}

export function buildDockChipPreviewMarkup({
  previewField,
  countField,
  chipsField,
  warningsField,
}) {
  return `
    <div class="pc-merchant-dock-chip-preview" data-field="${previewField}" hidden>
      <div class="pc-merchant-dock-chip-preview-head">
        <span data-field="${countField}">0/0</span>
      </div>
      <div class="pc-merchant-dock-chip-chips" data-field="${chipsField}"></div>
      <ul class="pc-merchant-dock-chip-warnings" data-field="${warningsField}" hidden></ul>
    </div>
  `;
}

function buildChipHtml(chip, removeAction, itemLabel, dockField) {
  const safeText = escapeHtml(chip.text);
  const title = chip.message ? ` title="${escapeHtml(chip.message)}"` : '';
  const removeLabel = escapeHtml(`Remove ${itemLabel} ${chip.text}`);
  const index = chip.segmentIndex ?? chip.index ?? 0;
  return `<span class="pc-merchant-tag-chip ${chipStatusClass(chip.status)}"${title}>` +
    `<span class="pc-merchant-tag-chip-label">${safeText}</span>` +
    `<button type="button" class="pc-merchant-tag-chip-remove" data-action="${removeAction}" data-dock-field="${dockField}" data-chip-index="${index}" aria-label="${removeLabel}">×</button>` +
    '</span>';
}

/**
 * Render chip preview into dock panel elements.
 */
export function renderDockChipPreview(panelEl, config, rawValue, context = {}) {
  const {
    previewField,
    countField,
    chipsField,
    warningsField,
    removeAction = MERCHANT_ACTIONS.DOCK_CHIP_REMOVE,
    dockField,
    itemLabel = 'item',
    validate,
  } = config;

  const previewEl = panelEl?.querySelector(`[data-field="${previewField}"]`);
  const countEl = panelEl?.querySelector(`[data-field="${countField}"]`);
  const chipsEl = panelEl?.querySelector(`[data-field="${chipsField}"]`);
  const warningsEl = panelEl?.querySelector(`[data-field="${warningsField}"]`);

  if (!previewEl || !countEl || !chipsEl || !warningsEl) return null;

  const trimmed = (rawValue || '').trim();
  if (!trimmed) {
    previewEl.hidden = true;
    chipsEl.innerHTML = '';
    warningsEl.hidden = true;
    warningsEl.innerHTML = '';
    return null;
  }

  const result = validate(trimmed, context);
  previewEl.hidden = false;
  countEl.textContent = `${result.count}/${result.maxItems ?? result.maxTags}`;
  countEl.classList.toggle('pc-merchant-tag-count-warn', result.count >= (result.maxItems ?? result.maxTags));
  countEl.classList.toggle('pc-merchant-tag-count-error', result.hasErrors);

  const chips = result.chips || [];
  chipsEl.innerHTML = chips.map((chip, index) =>
    buildChipHtml(
      { ...chip, segmentIndex: chip.segmentIndex ?? index },
      removeAction,
      itemLabel,
      dockField,
    ),
  ).join('');

  if (result.warnings?.length > 0) {
    warningsEl.hidden = false;
    warningsEl.innerHTML = result.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('');
  } else {
    warningsEl.hidden = true;
    warningsEl.innerHTML = '';
  }

  return result;
}

export const DOCK_CHIP_FIELD_CONFIG = Object.freeze({
  tags: {
    key: 'tags',
    inputField: 'dock-tags',
    previewField: 'dock-tag-preview',
    countField: 'dock-tag-count',
    chipsField: 'dock-tag-chips',
    warningsField: 'dock-tag-warnings',
    removeAction: MERCHANT_ACTIONS.DOCK_CHIP_REMOVE,
    dockField: 'tags',
    itemLabel: 'tag',
    needsProfile: true,
    validate(raw, ctx) {
      return validateTags(raw, ctx.profile);
    },
    removeAtIndex(raw, index, ctx) {
      return removeTagAtIndex(raw, index, ctx.profile);
    },
  },
  materials: {
    key: 'materials',
    inputField: 'dock-materials',
    previewField: 'dock-materials-preview',
    countField: 'dock-materials-count',
    chipsField: 'dock-materials-chips',
    warningsField: 'dock-materials-warnings',
    removeAction: MERCHANT_ACTIONS.DOCK_CHIP_REMOVE,
    dockField: 'materials',
    itemLabel: 'material',
    validate(raw) {
      const profile = ETSY_MATERIALS_PROFILE;
      return validateChipItems(raw, {
        splitFn: splitMaterialsInput,
        joinFn: materialsToStorageString,
        maxItems: profile.MAX_ITEMS,
        maxChars: profile.MAX_CHARS,
        itemLabel: 'material',
      });
    },
    removeAtIndex(raw, index) {
      return removeChipAtIndex(raw, index, splitMaterialsInput, materialsToStorageString);
    },
  },
  title: {
    key: 'title',
    inputField: 'dock-title',
    previewField: 'dock-title-preview',
    countField: 'dock-title-count',
    chipsField: 'dock-title-chips',
    warningsField: 'dock-title-warnings',
    removeAction: MERCHANT_ACTIONS.DOCK_CHIP_REMOVE,
    dockField: 'title',
    itemLabel: 'title',
    validate(raw) {
      const limits = MERCHANT_QUEUE_LIMITS.TITLE;
      return validateChipItems(raw, {
        maxItems: limits.maxItems,
        maxChars: limits.maxChars,
        itemLabel: 'title',
      });
    },
    removeAtIndex(raw, index) {
      return removeChipAtIndex(raw, index);
    },
  },
  description: {
    key: 'description',
    inputField: 'dock-description',
    previewField: 'dock-description-preview',
    countField: 'dock-description-count',
    chipsField: 'dock-description-chips',
    warningsField: 'dock-description-warnings',
    removeAction: MERCHANT_ACTIONS.DOCK_CHIP_REMOVE,
    dockField: 'description',
    itemLabel: 'description',
    validate(raw) {
      const limits = MERCHANT_QUEUE_LIMITS.DESCRIPTION;
      return validateChipItems(raw, {
        maxItems: limits.maxItems,
        maxChars: limits.maxChars,
        itemLabel: 'description',
      });
    },
    removeAtIndex(raw, index) {
      return removeChipAtIndex(raw, index);
    },
  },
  keywords: {
    key: 'keywords',
    inputField: 'dock-keywords',
    previewField: 'dock-keywords-preview',
    countField: 'dock-keywords-count',
    chipsField: 'dock-keywords-chips',
    warningsField: 'dock-keywords-warnings',
    removeAction: MERCHANT_ACTIONS.DOCK_CHIP_REMOVE,
    dockField: 'keywords',
    itemLabel: 'keyword',
    validate(raw) {
      const limits = MERCHANT_QUEUE_LIMITS.KEYWORD;
      return validateChipItems(raw, {
        maxItems: limits.maxItems,
        maxChars: limits.maxChars,
        itemLabel: 'keyword',
      });
    },
    removeAtIndex(raw, index) {
      return removeChipAtIndex(raw, index);
    },
  },
  bullets: {
    key: 'bullets',
    inputField: 'dock-bullets',
    previewField: 'dock-bullets-preview',
    countField: 'dock-bullets-count',
    chipsField: 'dock-bullets-chips',
    warningsField: 'dock-bullets-warnings',
    removeAction: MERCHANT_ACTIONS.DOCK_CHIP_REMOVE,
    dockField: 'bullets',
    itemLabel: 'bullet',
    validate(raw) {
      const limits = MERCHANT_QUEUE_LIMITS.BULLET;
      return validateChipItems(raw, {
        maxItems: limits.maxItems,
        maxChars: limits.maxChars,
        itemLabel: 'bullet',
      });
    },
    removeAtIndex(raw, index) {
      return removeChipAtIndex(raw, index);
    },
  },
  hashtags: {
    key: 'hashtags',
    inputField: 'dock-hashtags',
    previewField: 'dock-hashtags-preview',
    countField: 'dock-hashtags-count',
    chipsField: 'dock-hashtags-chips',
    warningsField: 'dock-hashtags-warnings',
    removeAction: MERCHANT_ACTIONS.DOCK_CHIP_REMOVE,
    dockField: 'hashtags',
    itemLabel: 'hashtag',
    validate(raw) {
      const limits = MERCHANT_QUEUE_LIMITS.HASHTAG;
      return validateChipItems(raw, {
        maxItems: limits.maxItems,
        maxChars: limits.maxChars,
        itemLabel: 'hashtag',
      });
    },
    removeAtIndex(raw, index) {
      return removeChipAtIndex(raw, index);
    },
  },
});

export const DOCK_CHIP_FIELD_KEYS = Object.freeze(Object.keys(DOCK_CHIP_FIELD_CONFIG));

/**
 * Finalize the in-progress chip segment by inserting ", " at the cursor —
 * equivalent to typing a comma delimiter. Returns true when Enter was handled.
 */
export function finalizeChipSegmentOnEnter(event, inputEl, { multiline = false } = {}) {
  if (event.key !== 'Enter' || event.isComposing) return false;
  if (multiline && event.shiftKey) return false;

  event.preventDefault();

  const value = inputEl.value ?? '';
  const start = inputEl.selectionStart ?? value.length;
  const end = inputEl.selectionEnd ?? start;
  const before = value.slice(0, start);
  const after = value.slice(end);

  if (/,\s*$/.test(before) && !after.trim()) {
    const pos = before.length;
    inputEl.setSelectionRange(pos, pos);
    return true;
  }

  const lastComma = before.lastIndexOf(',');
  const currentSegment = (lastComma === -1 ? before : before.slice(lastComma + 1)).trim();
  if (!currentSegment && !after.trim()) {
    return true;
  }

  const insert = ', ';
  const rest = after.replace(/^\s*,?\s*/, '');
  const newValue = before + insert + rest;

  inputEl.value = newValue;
  const cursor = before.length + insert.length;
  inputEl.setSelectionRange(cursor, cursor);
  return true;
}

/** Attach Enter-to-finalize handler on a dock chip input/textarea (once per element). */
export function bindDockChipFieldEnterKey(inputEl, { multiline = false, onFinalize } = {}) {
  if (!inputEl || inputEl.dataset.pcDockChipEnterBound === '1') return;
  inputEl.dataset.pcDockChipEnterBound = '1';

  inputEl.addEventListener('keydown', (event) => {
    if (finalizeChipSegmentOnEnter(event, inputEl, { multiline })) {
      onFinalize?.();
    }
  });
}
