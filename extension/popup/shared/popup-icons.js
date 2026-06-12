// Lucide icon renderer - idempotent, safe to call many times.
// Replaces <i data-lucide="name"></i> placeholders with inline SVGs.
// Observes DOM mutations so dynamically-rendered templates also get icons.
const LUCIDE_ATTRS = { 'stroke-width': 2, 'aria-hidden': 'true', focusable: 'false' };
const ICON_BATCH_SIZE = 12;
const ICON_FRAME_BUDGET_MS = 10;
const ICON_MAX_SCAN_PER_FRAME = 72;
const ICON_FULL_SCAN_COOLDOWN_MS = 120;
const ICON_IDLE_TIMEOUT_MS = 48;

function isUnrenderedPlaceholder(el) {
  return el?.nodeType === 1 && el.hasAttribute?.('data-lucide') && el.tagName !== 'SVG';
}

function collectUnrenderedPlaceholders(node) {
  const found = [];
  if (isUnrenderedPlaceholder(node)) found.push(node);
  node.querySelectorAll?.('[data-lucide]')?.forEach((el) => {
    if (isUnrenderedPlaceholder(el)) found.push(el);
  });
  return found;
}

function runLucideCreateIcons(nodes) {
  const lucide = window.lucide;
  if (!lucide?.createIcons || !nodes.length) return;

  // Lucide's createIcons accepts a `root` container (not a `nodes` list).
  // Render only each pending icon's parent subtree to avoid full-document rescans.
  const roots = new Set();
  for (const node of nodes) {
    const root = node?.parentElement || node;
    if (root?.nodeType === 1) roots.add(root);
  }
  if (!roots.size) return;

  for (const root of roots) {
    lucide.createIcons({
      attrs: LUCIDE_ATTRS,
      root,
    });
  }
}

function scheduleIconWork(task) {
  // Prefer next-frame work so controls render with the same paint cycle.
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => task());
    return;
  }

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => task(), { timeout: ICON_IDLE_TIMEOUT_MS });
    return;
  }
  setTimeout(task, 0);
}

(function initLucideRenderer() {
  const pendingNodes = new Set();
  let flushScheduled = false;
  let observerPaused = false;
  let fullScanQueued = false;
  let lastFullScanAt = 0;

  const scheduleFlush = () => {
    if (flushScheduled || pendingNodes.size === 0) return;
    flushScheduled = true;
    scheduleIconWork(() => {
      flushScheduled = false;
      processBatch();
    });
  };

  const enqueueFromNode = (node) => {
    if (!node) return;
    for (const el of collectUnrenderedPlaceholders(node)) {
      pendingNodes.add(el);
    }
    scheduleFlush();
  };

  const queueFullDocumentScan = () => {
    if (!document.body || fullScanQueued) return;
    const now = performance.now();
    if (pendingNodes.size > 0 && now - lastFullScanAt < ICON_FULL_SCAN_COOLDOWN_MS) {
      scheduleFlush();
      return;
    }
    fullScanQueued = true;
    queueMicrotask(() => {
      fullScanQueued = false;
      if (!document.body) return;
      lastFullScanAt = performance.now();
      enqueueFromNode(document.body);
    });
  };

  const processBatch = () => {
    if (pendingNodes.size === 0) return;

    const batch = [];
    const frameDeadline = performance.now() + ICON_FRAME_BUDGET_MS;
    let scanned = 0;
    for (const node of pendingNodes) {
      scanned += 1;
      if (!node.isConnected || !isUnrenderedPlaceholder(node)) {
        pendingNodes.delete(node);
      } else {
        batch.push(node);
        pendingNodes.delete(node);
      }
      if (
        batch.length >= ICON_BATCH_SIZE ||
        scanned >= ICON_MAX_SCAN_PER_FRAME ||
        performance.now() >= frameDeadline
      ) break;
    }

    if (!batch.length) {
      if (pendingNodes.size > 0) scheduleFlush();
      return;
    }

    observerPaused = true;
    try {
      runLucideCreateIcons(batch);
    } catch (e) {
      console.warn('Lucide render failed:', e);
    } finally {
      observerPaused = false;
    }

    if (pendingNodes.size > 0) scheduleFlush();
  };

  window.renderLucideIcons = function renderLucideIcons(scope) {
    if (scope instanceof Element) {
      enqueueFromNode(scope);
      return;
    }
    if (Array.isArray(scope) && scope.length) {
      for (const node of scope) {
        if (isUnrenderedPlaceholder(node)) pendingNodes.add(node);
      }
      scheduleFlush();
      return;
    }
    queueFullDocumentScan();
  };

  if (window.__lucideObserverInstalled) return;
  window.__lucideObserverInstalled = true;

  const observer = new MutationObserver((mutations) => {
    if (observerPaused) return;

    let queued = false;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        const placeholders = collectUnrenderedPlaceholders(node);
        if (!placeholders.length) continue;
        for (const el of placeholders) pendingNodes.add(el);
        queued = true;
      }
    }

    if (queued) scheduleFlush();
  });

  const startObserving = () => {
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.body) {
    startObserving();
  } else {
    document.addEventListener('DOMContentLoaded', startObserving, { once: true });
  }
})();
