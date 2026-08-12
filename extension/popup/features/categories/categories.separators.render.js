import { CATEGORY_SEPARATOR_SELECTORS } from './categories.separators.constants.js';
import { getActiveSeparators } from './categories.separators.service.js';

/**
 * Composite list: separator nodes interleaved with clips (Arkitect Composite).
 * Separators with afterClipId=null render at the top; others render below their anchor clip.
 */
export function buildCategoryCompositeNodes(clips, separators) {
  const list = Array.isArray(clips) ? clips : [];
  const active = (Array.isArray(separators) ? separators : []).filter((s) => s && !Number.isFinite(s.deletedAt));
  const byAfter = new Map();

  const bucketKey = (sep) => (
    sep.afterClipId == null || sep.afterClipId === '' ? '__TOP__' : String(sep.afterClipId)
  );

  active.forEach((sep) => {
    const key = bucketKey(sep);
    const bucket = byAfter.get(key) || [];
    bucket.push(sep);
    byAfter.set(key, bucket);
  });

  byAfter.forEach((bucket) => bucket.sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0)));

  const nodes = [];
  const placed = new Set();
  const flush = (key) => {
    (byAfter.get(key) || []).forEach((sep) => {
      nodes.push({ type: 'separator', separator: sep });
      placed.add(String(sep.id));
    });
  };

  flush('__TOP__');
  list.forEach((clip) => {
    nodes.push({ type: 'clip', clip });
    flush(String(clip?.id));
  });
  active.forEach((sep) => {
    if (!placed.has(String(sep.id))) nodes.push({ type: 'separator', separator: sep });
  });
  return nodes;
}

export function renderCategorySeparatorHTML(app, separator, categoryId) {
  const name = app.escapeHtml(separator?.name || 'Section');
  const sepId = app.escapeHtml(String(separator?.id || ''));
  const catId = app.escapeHtml(String(categoryId || ''));
  return `
    <div class="${CATEGORY_SEPARATOR_SELECTORS.ROW}"
         role="separator"
         aria-label="${name}"
         draggable="true"
         title="Drag to reorder"
         data-separator-id="${sepId}"
         data-category-id="${catId}">
      <span class="category-separator-grip" aria-hidden="true" title="Drag">⋮⋮</span>
      <button type="button"
              class="${CATEGORY_SEPARATOR_SELECTORS.FOCUS_LEAD_BTN}"
              data-separator-id="${sepId}"
              data-category-id="${catId}"
              title="Highlight this section's clips"
              aria-label="Highlight this section's clips"
              aria-expanded="false"
              draggable="false">
        <i data-lucide="chevron-down"></i>
      </button>
      <div class="category-separator-line" aria-hidden="true"></div>
      <span class="${CATEGORY_SEPARATOR_SELECTORS.LABEL}">${name}</span>
      <div class="category-separator-line" aria-hidden="true"></div>
      <div class="${CATEGORY_SEPARATOR_SELECTORS.ACTIONS}">
        <button type="button"
                class="${CATEGORY_SEPARATOR_SELECTORS.FOCUS_TOGGLE_BTN}"
                data-separator-id="${sepId}"
                data-category-id="${catId}"
                title="Highlight this section's clips"
                aria-label="Highlight this section's clips"
                aria-expanded="false"
                draggable="false">
          <i data-lucide="chevron-down"></i>
        </button>
        <button type="button"
                class="${CATEGORY_SEPARATOR_SELECTORS.EDIT_BTN}"
                data-separator-id="${sepId}"
                data-category-id="${catId}"
                title="Rename separator"
                aria-label="Rename separator"
                draggable="false">
          <i data-lucide="pencil"></i>
        </button>
        <button type="button"
                class="${CATEGORY_SEPARATOR_SELECTORS.DELETE_BTN}"
                data-separator-id="${sepId}"
                data-category-id="${catId}"
                title="Delete separator"
                aria-label="Delete separator"
                draggable="false">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    </div>
  `;
}

export function renderCategoryCompositeHTML(app, category, clips) {
  const separators = getActiveSeparators(category);
  const nodes = buildCategoryCompositeNodes(clips, separators);

  if (nodes.length === 0) {
    return '<div class="category-clip" style="text-align: center; color: #9ca3af; padding: 16px;">No clips in this category</div>';
  }

  return nodes.map((node) => {
    if (node.type === 'separator') {
      return renderCategorySeparatorHTML(app, node.separator, category?.id);
    }
    if (typeof app.createCategoryClipRowHTML === 'function') {
      return app.createCategoryClipRowHTML(node.clip);
    }
    return app.createCategoryClipsHTML([node.clip], category?.id);
  }).join('');
}
