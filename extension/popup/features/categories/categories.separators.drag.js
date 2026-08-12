import { CATEGORY_SEPARATOR_SELECTORS } from './categories.separators.constants.js';
import { getCategoryIdKey } from './categories.state.js';

const DRAG_MIME = 'application/x-pastecraft-separator';
const DROP_LINE_CLASS = 'category-separator-drop-line';

function findCategoryById(app, categoryId) {
  const key = String(categoryId || '');
  if (!key) return null;
  return (app.categories || []).find((cat) => getCategoryIdKey(cat) === key || String(cat?.id) === key) || null;
}

function clearDropIndicators(container) {
  container?.querySelectorAll?.(`.${DROP_LINE_CLASS}`)?.forEach((el) => {
    el.classList.remove(DROP_LINE_CLASS, 'drop-before', 'drop-after');
  });
}

/**
 * Walk composite rows and resolve afterClipId for a drop at clientY.
 * Inserts before the first row whose midpoint is below the pointer.
 */
export function resolveSeparatorDropAfterClipId(dropdown, clientY, draggedSeparatorId) {
  if (!dropdown) return null;
  const rows = [...dropdown.querySelectorAll(`.${CATEGORY_SEPARATOR_SELECTORS.ROW}, .category-clip`)]
    .filter((el) => String(el.dataset.separatorId || '') !== String(draggedSeparatorId || ''));

  let afterClipId = null;
  for (const row of rows) {
    const rect = row.getBoundingClientRect();
    const mid = rect.top + (rect.height / 2);
    if (clientY < mid) break;
    if (row.classList.contains('category-clip') && row.dataset.clipId) {
      afterClipId = String(row.dataset.clipId);
    }
  }
  return afterClipId;
}

function updateDropIndicator(dropdown, clientY, draggedSeparatorId) {
  clearDropIndicators(dropdown);
  const rows = [...dropdown.querySelectorAll(`.${CATEGORY_SEPARATOR_SELECTORS.ROW}, .category-clip`)]
    .filter((el) => String(el.dataset.separatorId || '') !== String(draggedSeparatorId || ''));
  if (!rows.length) return;

  let target = rows[rows.length - 1];
  let placeBefore = false;
  for (const row of rows) {
    const rect = row.getBoundingClientRect();
    const mid = rect.top + (rect.height / 2);
    if (clientY < mid) {
      target = row;
      placeBefore = true;
      break;
    }
    target = row;
    placeBefore = false;
  }
  target.classList.add(DROP_LINE_CLASS, placeBefore ? 'drop-before' : 'drop-after');
}

export function setupCategorySeparatorDrag(app) {
  if (app._categorySeparatorDragAttached) return;
  const container = document.getElementById('categoriesList');
  if (!container) return;

  let dragState = null;

  container.addEventListener('dragstart', (event) => {
    if (
      event.target.closest(`.${CATEGORY_SEPARATOR_SELECTORS.ACTIONS}`)
      || event.target.closest(`.${CATEGORY_SEPARATOR_SELECTORS.FOCUS_LEAD_BTN}`)
    ) {
      event.preventDefault();
      return;
    }
    const row = event.target.closest(`.${CATEGORY_SEPARATOR_SELECTORS.ROW}`);
    if (!row || !container.contains(row)) return;

    const separatorId = row.dataset.separatorId;
    const categoryId = row.dataset.categoryId;
    if (!separatorId || !categoryId) return;

    dragState = { separatorId, categoryId };
    row.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(DRAG_MIME, JSON.stringify(dragState));
    event.dataTransfer.setData('text/plain', separatorId);
  });

  container.addEventListener('dragend', (event) => {
    const row = event.target.closest(`.${CATEGORY_SEPARATOR_SELECTORS.ROW}`);
    row?.classList.remove('is-dragging');
    clearDropIndicators(container);
    dragState = null;
  });

  container.addEventListener('dragover', (event) => {
    const dropdown = event.target.closest('.category-dropdown');
    if (!dropdown || !container.contains(dropdown) || !dragState) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    updateDropIndicator(dropdown, event.clientY, dragState.separatorId);
  });

  container.addEventListener('dragleave', (event) => {
    const dropdown = event.target.closest('.category-dropdown');
    if (!dropdown) return;
    if (dropdown.contains(event.relatedTarget)) return;
    clearDropIndicators(dropdown);
  });

  container.addEventListener('drop', async (event) => {
    const dropdown = event.target.closest('.category-dropdown');
    if (!dropdown || !container.contains(dropdown) || !dragState) return;
    event.preventDefault();
    event.stopPropagation();

    const { separatorId, categoryId } = dragState;
    const afterClipId = resolveSeparatorDropAfterClipId(dropdown, event.clientY, separatorId);
    clearDropIndicators(container);

    const category = findCategoryById(app, categoryId);
    if (!category) return;
    await app.moveCategorySeparator?.(category, separatorId, afterClipId);
  });

  app._categorySeparatorDragAttached = true;
}
