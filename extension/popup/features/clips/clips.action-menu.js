import { showModule as showCustomSearchModule } from './clips.custom-search.module.js';
import { buildGoogleSearchUrl } from './clips.custom-search.service.js';
import {
  getSelectedOrCurrentClipIdKeys,
  getSelectedOrCurrentClipObjects,
} from './clips.state.js';
import { isImageBearingClip, resolveClipImageSrc } from '../../../shared/clip-images.js';

const MENU_ID = 'pcClipActionMenuPortal';
const GOOGLE_SEARCH_MAX_QUERY_LENGTH = 1800;
const GOOGLE_LOGO_ICON_HTML = '<img src="assets/google-logo.svg" alt="" class="pc-google-action-icon">';

function escapeMenuLabel(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function closeClipActionMenu() {
  const portal = document.getElementById(MENU_ID);
  if (!portal) return;
  const trigger = portal._pcTrigger;
  if (trigger) {
    trigger.setAttribute('aria-expanded', 'false');
    portal._pcTrigger = null;
  }
  portal.remove();
  document.removeEventListener('keydown', portal._pcKeyHandler, true);
  document.removeEventListener('pointerdown', portal._pcOutsideHandler, true);
}

function positionMenu(menu, anchor) {
  const rect = anchor.getBoundingClientRect();
  const gap = 4;
  menu.style.visibility = 'hidden';
  menu.style.display = 'block';

  const menuRect = menu.getBoundingClientRect();
  let top = rect.bottom + gap;
  let left = rect.right - menuRect.width;

  if (top + menuRect.height > window.innerHeight - 8) {
    top = rect.top - menuRect.height - gap;
  }
  if (left < 8) left = 8;
  if (left + menuRect.width > window.innerWidth - 8) {
    left = window.innerWidth - menuRect.width - 8;
  }

  menu.style.top = `${Math.round(top)}px`;
  menu.style.left = `${Math.round(left)}px`;
  menu.style.visibility = 'visible';
}

function getMenuItemIconHtml(item) {
  if (item.iconHtml) return item.iconHtml;
  return `<i data-lucide="${item.icon}"></i>`;
}

function buildMenuItemHtml(item) {
  if (item.type === 'separator') {
    return '<div class="pc-clip-action-menu-separator" role="separator" aria-hidden="true"></div>';
  }
  const disabled = item.disabled ? ' disabled aria-disabled="true"' : '';
  const label = escapeMenuLabel(item.label);
  return `
    <button
      type="button"
      class="pc-clip-action-menu-item"
      role="menuitem"
      data-action-id="${item.id}"
      title="${label}"
      aria-label="${label}"${disabled}
    >
      <span class="pc-clip-action-menu-icon" aria-hidden="true">${getMenuItemIconHtml(item)}</span>
      <span class="pc-clip-action-menu-label">${label}</span>
    </button>
  `;
}

export function openClipActionMenu({ anchor, title, items, onSelect }) {
  if (!anchor || !items?.length) return;

  closeClipActionMenu();

  const portal = document.createElement('div');
  portal.id = MENU_ID;
  portal.className = 'pc-clip-action-menu-portal';
  portal.setAttribute('role', 'presentation');

  const menu = document.createElement('div');
  menu.className = 'pc-clip-action-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', title);

  menu.innerHTML = items.map(buildMenuItemHtml).join('');
  portal.appendChild(menu);
  document.body.appendChild(portal);

  window.renderLucideIcons?.(menu);

  anchor.setAttribute('aria-expanded', 'true');
  portal._pcTrigger = anchor;

  positionMenu(menu, anchor);

  const focusFirst = () => {
    const first = menu.querySelector('.pc-clip-action-menu-item:not([disabled])');
    first?.focus();
  };
  requestAnimationFrame(focusFirst);

  const handleSelect = async (itemId) => {
    const item = items.find((entry) => entry.id === itemId);
    if (!item || item.disabled) return;
    closeClipActionMenu();
    await onSelect(itemId, item);
  };

  menu.addEventListener('click', async (event) => {
    const btn = event.target.closest('.pc-clip-action-menu-item');
    if (!btn || btn.disabled) return;
    event.stopPropagation();
    await handleSelect(btn.dataset.actionId);
  });

  portal._pcKeyHandler = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeClipActionMenu();
      anchor.focus();
      return;
    }

    const buttons = [...menu.querySelectorAll('.pc-clip-action-menu-item:not([disabled])')];
    const currentIndex = buttons.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' && buttons.length) {
      event.preventDefault();
      buttons[(currentIndex + 1) % buttons.length]?.focus();
    } else if (event.key === 'ArrowUp' && buttons.length) {
      event.preventDefault();
      buttons[(currentIndex <= 0 ? buttons.length : currentIndex) - 1]?.focus();
    }
  };

  portal._pcOutsideHandler = (event) => {
    if (portal.contains(event.target) || anchor.contains(event.target)) return;
    closeClipActionMenu();
  };

  document.addEventListener('keydown', portal._pcKeyHandler, true);
  document.addEventListener('pointerdown', portal._pcOutsideHandler, true);
}

function navigateToCategoriesTab() {
  document.querySelector('.tab-btn[data-tab="categories"]')?.click();
}

function navigateNewTab(url) {
  const safeUrl = String(url || '').trim();
  if (!safeUrl) return;
  try {
    chrome.tabs.create({ url: safeUrl }, () => {
      if (chrome.runtime.lastError) {
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
      }
    });
  } catch (error) {
    console.error('[clips.action-menu] Failed to open search tab:', error);
    try {
      window.open(safeUrl, '_blank', 'noopener,noreferrer');
    } catch (_) {}
  }
}

function getSelectedOrCurrentSearchText(app, clip, context) {
  const text =
    app.getSelectedOrCurrentText?.(clip?.text ?? '', context) ?? String(clip?.text ?? '');
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, GOOGLE_SEARCH_MAX_QUERY_LENGTH);
}

function buildGoogleSearchQuery(text, actionId) {
  if (actionId === 'search-meaning') {
    return `what does ${text} mean`;
  }
  return text;
}

export async function runAiCraftFromClip(app, clip, context) {
  const idKeys = getSelectedOrCurrentClipIdKeys(app, clip, context);
  if (!idKeys.length) {
    app.showToast?.('No clip to craft', 'error');
    return;
  }
  await app.magicFormat?.();
  app._magicSelected = new Set(idKeys.map(String));
  app._renderMagicPage?.(0);
  app._updateMagicSelectedCount?.();
}

function getOrgBundleItems(context) {
  const items = [
    { id: 'notes', icon: 'notebook', label: 'Send to Notes' },
  ];

  if (context === 'categories') {
    items.push({ id: 'change-category', icon: 'folder-plus', label: 'Change category' });
  } else {
    items.push(
      { id: 'add-category', icon: 'folder-plus', label: 'Add to category' },
      { id: 'browse-categories', icon: 'folder', label: 'Categories' },
    );
  }

  return items;
}

function getAiBundleItems() {
  return [
    { id: 'breakdown', icon: 'brain', label: 'AI Breakdown' },
    { id: 'summary', icon: 'notebook-pen', label: 'AI Summary' },
    { id: 'craft', icon: 'wand-sparkles', label: 'AI Craft' },
  ];
}

function getGoogleSearchBaseItems() {
  return [
    { id: 'vague-search', iconHtml: GOOGLE_LOGO_ICON_HTML, label: 'Do a vague search' },
    { id: 'search-meaning', iconHtml: GOOGLE_LOGO_ICON_HTML, label: 'Search for meaning' },
  ];
}

function getGoogleSearchItems() {
  return [
    ...getGoogleSearchBaseItems(),
    { type: 'separator' },
    { id: 'custom-search', icon: 'search', label: 'Custom Search' },
  ];
}

async function runOrgBundleAction(app, actionId, { clip, clipIdKey, context }) {
  if (actionId === 'notes') {
    await app.loadNotes?.();
    const clipObjects = getSelectedOrCurrentClipObjects(app, clip, context);
    if (clipObjects.length > 1) {
      app.pendingBulkClipsForNotes = clipObjects;
      app.pendingClipForNotes = null;
    } else {
      app.pendingBulkClipsForNotes = null;
      app.pendingClipForNotes = clip || null;
    }
    app.showAlbumPicker?.();
    return;
  }

  if (actionId === 'add-category' || actionId === 'change-category') {
    const idKeys = getSelectedOrCurrentClipIdKeys(app, clip, context);
    if (idKeys.length > 1) {
      app.pendingBulkClipIds = idKeys;
      app.pendingText = null;
      app.pendingClipId = null;
    } else {
      app.pendingBulkClipIds = null;
      app.pendingText = clip?.text ?? '';
      app.pendingClipId = clipIdKey;
    }
    app.showCategoryModal?.(actionId === 'change-category');
    return;
  }

  if (actionId === 'browse-categories') {
    navigateToCategoriesTab();
  }
}

function clipTextForSummary(clip) {
  const text = String(clip?.text ?? '').trim();
  if (text) return text;
  return String(clip?.meta?.plainText ?? '').trim();
}

function buildSummaryTextFromClips(app, clip, context) {
  const clips = getSelectedOrCurrentClipObjects(app, clip, context);
  if (clips.length > 1) {
    return clips.map(clipTextForSummary).filter(Boolean).join('\n\n');
  }
  if (clips.length === 1) return clipTextForSummary(clips[0]);
  return clipTextForSummary(clip);
}

async function resolveSingleClipSummaryImage(clips) {
  if (!Array.isArray(clips) || clips.length !== 1 || !isImageBearingClip(clips[0])) {
    return '';
  }
  try {
    const resolved = await resolveClipImageSrc(clips[0]);
    return resolved?.src || '';
  } catch (_) {
    return '';
  }
}

async function runSummaryFromClip(app, clip, context) {
  const clips = getSelectedOrCurrentClipObjects(app, clip, context);
  const fallback = app.getSelectedOrCurrentText?.(clip?.text ?? '', context) ?? String(clip?.text ?? '');
  const summaryText = buildSummaryTextFromClips(app, clip, context) || String(fallback || '');
  const imageBase64 = await resolveSingleClipSummaryImage(clips);
  await app.showSummaryModal?.(summaryText, imageBase64 ? { imageBase64 } : undefined);
}

async function runAiBundleAction(app, actionId, { clip, context }) {
  const text = app.getSelectedOrCurrentText?.(clip?.text ?? '', context) ?? String(clip?.text ?? '');

  if (actionId === 'breakdown') {
    app.showBreakdownModal?.(text);
    return;
  }
  if (actionId === 'summary') {
    await runSummaryFromClip(app, clip, context);
    return;
  }
  if (actionId === 'craft') {
    await runAiCraftFromClip(app, clip, context);
  }
}

export async function runGoogleSearchAction(app, actionId, { clip, context }) {
  if (actionId === 'custom-search') {
    showCustomSearchModule(app, { clip, context });
    return;
  }

  const text = getSelectedOrCurrentSearchText(app, clip, context);
  if (!text) {
    app.showToast?.('No clip text to search', 'error');
    return;
  }
  const query = buildGoogleSearchQuery(text, actionId);
  navigateNewTab(buildGoogleSearchUrl(query));
}

export function openOrgBundleMenu(app, { anchor, clip, clipIdKey, context }) {
  openClipActionMenu({
    anchor,
    title: 'Notes and categories',
    items: getOrgBundleItems(context),
    onSelect: (actionId) => runOrgBundleAction(app, actionId, { clip, clipIdKey, context }),
  });
}

export function openAiBundleMenu(app, { anchor, clip, context }) {
  openClipActionMenu({
    anchor,
    title: 'AI actions',
    items: getAiBundleItems(),
    onSelect: (actionId) => runAiBundleAction(app, actionId, { clip, context }),
  });
}

export async function openGoogleSearchMenu(app, { anchor, clip, context }) {
  const items = getGoogleSearchItems();
  openClipActionMenu({
    anchor,
    title: 'Google search',
    items,
    onSelect: (actionId) => runGoogleSearchAction(app, actionId, { clip, context }),
  });
}

export const CLIP_ORG_BUNDLE_SELECTOR = '.chip-org-bundle-btn, .search-org-bundle-btn, .category-clip-org-bundle-btn';
export const CLIP_AI_BUNDLE_SELECTOR = '.chip-ai-bundle-btn, .search-ai-bundle-btn, .category-clip-ai-bundle-btn';
export const CLIP_GOOGLE_SEARCH_SELECTOR = '.chip-google-search-btn, .search-google-search-btn, .category-clip-google-search-btn';
