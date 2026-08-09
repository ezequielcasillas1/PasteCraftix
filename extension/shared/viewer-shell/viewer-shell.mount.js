/**
 * Mount expand + pop-out chrome on every popup modal overlay.
 */

import {
  VIEWER_SHELL_ACTION,
  VIEWER_SHELL_ACTIONS_CLASS,
  VIEWER_SHELL_CLASS,
  VIEWER_SHELL_EXPANDED_CLASS,
  VIEWER_SHELL_MOUNTED_ATTR,
  VIEWER_SHELL_OVERLAY_SELECTOR,
  VIEWER_SHELL_STORAGE_KEY,
} from './viewer-shell.constants.js';
import { openViewerShellPopout } from './viewer-shell.popout.js';

const EXPAND_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
    <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
  </svg>`;

const COLLAPSE_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
    <line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>
  </svg>`;

const POPOUT_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>`;

function listOverlays(root) {
  return [...root.querySelectorAll(VIEWER_SHELL_OVERLAY_SELECTOR)];
}

function findHeaderHost(overlay) {
  return (
    overlay.querySelector('.modal-header') ||
    overlay.querySelector('.upgrade-modal-header') ||
    overlay.querySelector('.info-modal-header') ||
    overlay.querySelector('.image-viewer-content') ||
    null
  );
}

const CLOSE_BUTTON_SELECTORS = [
  '.modal-close',
  '.upgrade-modal-close',
  '.image-viewer-close',
  '[id^="close"]',
];

function queryFirst(root, selectors) {
  if (!root) return null;
  for (const selector of selectors) {
    const hit = root.querySelector(selector);
    if (hit) return hit;
  }
  return null;
}

function findCloseButton(host, overlay) {
  return queryFirst(host, CLOSE_BUTTON_SELECTORS) || queryFirst(overlay, CLOSE_BUTTON_SELECTORS);
}

function ensureClipMetaRow(overlay) {
  const existing = overlay.querySelector('#clipViewerMetaRow, .pc-viewer-shell-meta-row');
  if (existing) return existing;
  const meta = overlay.querySelector('#clipViewerMeta');
  if (!meta) return null;
  const row = document.createElement('div');
  row.className = 'pc-viewer-shell-meta-row';
  row.id = 'clipViewerMetaRow';
  meta.parentNode.insertBefore(row, meta);
  row.appendChild(meta);
  return row;
}

function createActionsCluster() {
  const cluster = document.createElement('div');
  cluster.className = VIEWER_SHELL_ACTIONS_CLASS;
  cluster.setAttribute(VIEWER_SHELL_MOUNTED_ATTR, 'actions');

  const expandBtn = document.createElement('button');
  expandBtn.type = 'button';
  expandBtn.className = 'pc-viewer-shell-btn';
  expandBtn.dataset.action = VIEWER_SHELL_ACTION.EXPAND;
  expandBtn.setAttribute('aria-label', 'Expand to fullscreen in module');
  expandBtn.setAttribute('title', 'Expand in module');
  expandBtn.setAttribute('aria-pressed', 'false');
  expandBtn.innerHTML = EXPAND_ICON;

  const popoutBtn = document.createElement('button');
  popoutBtn.type = 'button';
  popoutBtn.className = 'pc-viewer-shell-btn';
  popoutBtn.dataset.action = VIEWER_SHELL_ACTION.POPOUT;
  popoutBtn.setAttribute('aria-label', 'Pop out viewer');
  popoutBtn.setAttribute('title', 'Pop out');
  popoutBtn.innerHTML = POPOUT_ICON;

  cluster.append(expandBtn, popoutBtn);
  return cluster;
}

function insertBeforeCloseOrAppend(host, overlay, cluster) {
  const closeBtn = findCloseButton(host, overlay);
  if (closeBtn?.parentElement) {
    closeBtn.parentElement.insertBefore(cluster, closeBtn);
    return;
  }
  (host || overlay).appendChild(cluster);
}

function placeActions(overlay, cluster) {
  if (overlay.id === 'clipViewerModal') {
    const row = ensureClipMetaRow(overlay);
    if (row) {
      row.appendChild(cluster);
      return;
    }
  }

  const header = findHeaderHost(overlay);
  if (header) {
    insertBeforeCloseOrAppend(header, overlay, cluster);
    return;
  }

  overlay.insertBefore(cluster, overlay.firstChild);
}

function syncExpandButton(overlay) {
  const expanded = overlay.classList.contains(VIEWER_SHELL_EXPANDED_CLASS);
  const btn = overlay.querySelector(`[data-action="${VIEWER_SHELL_ACTION.EXPAND}"]`);
  if (!btn) return;
  btn.setAttribute('aria-pressed', expanded ? 'true' : 'false');
  btn.setAttribute('title', expanded ? 'Exit module fullscreen' : 'Expand in module');
  btn.setAttribute(
    'aria-label',
    expanded ? 'Exit module fullscreen' : 'Expand to fullscreen in module',
  );
  btn.innerHTML = expanded ? COLLAPSE_ICON : EXPAND_ICON;
}

async function readExpandedMap() {
  try {
    const bag = await chrome.storage.local.get(VIEWER_SHELL_STORAGE_KEY);
    const value = bag?.[VIEWER_SHELL_STORAGE_KEY];
    return value && typeof value === 'object' ? value : {};
  } catch (_) {
    return {};
  }
}

async function writeExpandedState(overlayId, expanded) {
  if (!overlayId) return;
  try {
    const map = await readExpandedMap();
    map[overlayId] = !!expanded;
    await chrome.storage.local.set({ [VIEWER_SHELL_STORAGE_KEY]: map });
  } catch (_) {}
}

async function applyStoredExpand(overlay) {
  if (!overlay.id) return;
  const map = await readExpandedMap();
  if (map[overlay.id]) {
    overlay.classList.add(VIEWER_SHELL_EXPANDED_CLASS);
    syncExpandButton(overlay);
  }
}

async function toggleExpand(overlay) {
  const next = !overlay.classList.contains(VIEWER_SHELL_EXPANDED_CLASS);
  overlay.classList.toggle(VIEWER_SHELL_EXPANDED_CLASS, next);
  syncExpandButton(overlay);
  await writeExpandedState(overlay.id, next);
}

function mountOverlay(overlay) {
  if (!overlay || overlay.getAttribute(VIEWER_SHELL_MOUNTED_ATTR) === '1') return;
  overlay.classList.add(VIEWER_SHELL_CLASS);
  overlay.setAttribute(VIEWER_SHELL_MOUNTED_ATTR, '1');

  if (!overlay.querySelector(`.${VIEWER_SHELL_ACTIONS_CLASS}`)) {
    placeActions(overlay, createActionsCluster());
  }

  applyStoredExpand(overlay);
}

async function handleShellAction(action, overlay, event) {
  event.preventDefault();
  event.stopPropagation();
  if (action === VIEWER_SHELL_ACTION.EXPAND) {
    await toggleExpand(overlay);
    return;
  }
  if (action === VIEWER_SHELL_ACTION.POPOUT) {
    const result = await openViewerShellPopout(overlay);
    if (!result.ok) {
      console.warn('[PasteCraft:viewer-shell] popout failed', result.error);
    }
  }
}

function bindDelegatedActions(root) {
  if (root.__pcViewerShellBound) return;
  root.__pcViewerShellBound = true;

  root.addEventListener('click', (event) => {
    const btn = event.target?.closest?.(`[data-action^="viewer-shell-"]`);
    if (!btn) return;
    const overlay = btn.closest(VIEWER_SHELL_OVERLAY_SELECTOR);
    if (!overlay) return;
    handleShellAction(btn.dataset.action, overlay, event);
  });
}

function mountNodeTree(node) {
  if (!(node instanceof HTMLElement)) return;
  if (node.matches?.(VIEWER_SHELL_OVERLAY_SELECTOR)) mountOverlay(node);
  node.querySelectorAll?.(VIEWER_SHELL_OVERLAY_SELECTOR).forEach(mountOverlay);
}

function observeNewOverlays(root) {
  if (typeof MutationObserver === 'undefined') return;
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes.forEach(mountNodeTree));
  });
  observer.observe(root.documentElement || root, { childList: true, subtree: true });
}

/** Mount shell controls on every known modal overlay in the document. */
export function mountAll(root = document) {
  bindDelegatedActions(root);
  listOverlays(root).forEach(mountOverlay);
  observeNewOverlays(root);
  return { mounted: listOverlays(root).length };
}
