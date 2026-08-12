import { CATEGORY_SEPARATOR_SELECTORS } from './categories.separators.constants.js';
import { buildCategoryCompositeNodes } from './categories.separators.render.js';
import { getActiveSeparators } from './categories.separators.service.js';
import { getCategoryIdKey } from './categories.state.js';

const MASTER_CLIP_CLASS = 'category-separator-master';
const FOCUSED_SEP_CLASS = 'is-section-focused';

/**
 * Master clips for a separator = clips after it in the composite list until the next separator.
 */
export function getSeparatorMasterClipIds(clips, separators, separatorId) {
  const nodes = buildCategoryCompositeNodes(clips, separators);
  const start = nodes.findIndex(
    (node) => node.type === 'separator' && String(node.separator?.id) === String(separatorId)
  );
  if (start < 0) return [];

  const ids = [];
  for (let i = start + 1; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (node.type === 'separator') break;
    if (node.type === 'clip' && node.clip?.id != null) {
      ids.push(String(node.clip.id));
    }
  }
  return ids;
}

function clearSectionFocus(dropdown) {
  if (!dropdown) return;
  dropdown.querySelectorAll(`.${MASTER_CLIP_CLASS}`).forEach((el) => {
    el.classList.remove(MASTER_CLIP_CLASS);
  });
  dropdown.querySelectorAll(`.${CATEGORY_SEPARATOR_SELECTORS.ROW}.${FOCUSED_SEP_CLASS}`).forEach((el) => {
    el.classList.remove(FOCUSED_SEP_CLASS);
    syncSeparatorArrowIcons(el, false);
  });
}

function getClipsInCategory(app, category) {
  const categoryName = category?.name;
  if (!categoryName) return [];
  return (app.clipboardHistory || []).filter((clip) => clip.category === categoryName);
}

function findClipRow(dropdown, clipId) {
  const target = String(clipId);
  return Array.from(dropdown.querySelectorAll('.category-clip')).find(
    (el) => String(el.dataset.clipId) === target
  ) || null;
}

function findSeparatorRow(dropdown, separatorId) {
  return Array.from(
    dropdown?.querySelectorAll(`.${CATEGORY_SEPARATOR_SELECTORS.ROW}`) || []
  ).find((el) => String(el.dataset.separatorId) === String(separatorId)) || null;
}

function syncSeparatorArrowIcons(sepRow, isFocused) {
  const iconName = isFocused ? 'chevron-up' : 'chevron-down';
  const label = isFocused
    ? 'Hide section highlight'
    : 'Highlight this section\'s clips';
  const buttons = sepRow.querySelectorAll(
    `.${CATEGORY_SEPARATOR_SELECTORS.FOCUS_TOGGLE_BTN}, .${CATEGORY_SEPARATOR_SELECTORS.FOCUS_LEAD_BTN}`
  );
  buttons.forEach((btn) => {
    btn.setAttribute('title', label);
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-expanded', isFocused ? 'true' : 'false');
    btn.innerHTML = `<i data-lucide="${iconName}"></i>`;
  });
  window.renderLucideIconsSync?.(sepRow);
}

/**
 * Single toggle: click highlights master clips + flips arrows up;
 * click again clears highlight + flips arrows down.
 * Left lead arrow and right toggle stay in sync.
 */
export function toggleSeparatorSection(app, category, separatorId) {
  if (!category || !separatorId) return false;

  const categoryKey = getCategoryIdKey(category) || String(category.id || '');
  const item = document.querySelector(`.category-item[data-category-id="${CSS.escape(categoryKey)}"]`);
  const dropdown = item?.querySelector('.category-dropdown');
  const sepRow = findSeparatorRow(dropdown, separatorId);
  if (!dropdown || !sepRow) return false;

  const wasFocused = sepRow.classList.contains(FOCUSED_SEP_CLASS);
  clearSectionFocus(dropdown);

  if (wasFocused) {
    return true;
  }

  const clips = getClipsInCategory(app, category);
  const masterIds = getSeparatorMasterClipIds(clips, getActiveSeparators(category), separatorId);
  sepRow.classList.add(FOCUSED_SEP_CLASS);
  syncSeparatorArrowIcons(sepRow, true);

  let firstMasterEl = null;
  masterIds.forEach((clipId) => {
    const clipEl = findClipRow(dropdown, clipId);
    if (!clipEl) return;
    clipEl.classList.add(MASTER_CLIP_CLASS);
    if (!firstMasterEl) firstMasterEl = clipEl;
  });

  if (firstMasterEl) {
    firstMasterEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } else {
    sepRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    app.showToast?.('No clips under this section yet');
  }

  return true;
}

/** @deprecated use toggleSeparatorSection */
export function focusSeparatorSection(app, category, separatorId, _direction = 'down') {
  return toggleSeparatorSection(app, category, separatorId);
}
