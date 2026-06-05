// Lucide icon renderer - idempotent, safe to call many times.
// Replaces <i data-lucide="name"></i> placeholders with inline SVGs.
// Observes DOM mutations so dynamically-rendered templates also get icons.
const LUCIDE_ATTRS = { 'stroke-width': 2, 'aria-hidden': 'true', focusable: 'false' };
const ICON_BATCH_SIZE = 4;
const ICON_FRAME_BUDGET_MS = 8;

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
  lucide.createIcons({
    icons: lucide.icons || lucide,
    attrs: LUCIDE_ATTRS,
    nodes,
  });
}

(function initLucideRenderer() {
  const pendingNodes = new Set();
  let flushScheduled = false;
  let observerPaused = false;

  const scheduleFlush = () => {
    if (flushScheduled || pendingNodes.size === 0) return;
    flushScheduled = true;
    requestAnimationFrame(() => {
      flushScheduled = false;
      processBatch();
    });
  };

  const enqueueFromNode = (node) => {
    for (const el of collectUnrenderedPlaceholders(node)) {
      pendingNodes.add(el);
    }
    scheduleFlush();
  };

  const processBatch = () => {
    if (pendingNodes.size === 0) return;

    const batch = [];
    const batchT0 = performance.now();
    for (const node of pendingNodes) {
      if (!node.isConnected || !isUnrenderedPlaceholder(node)) {
        pendingNodes.delete(node);
        continue;
      }
      batch.push(node);
      pendingNodes.delete(node);
      if (batch.length >= ICON_BATCH_SIZE || performance.now() - batchT0 >= ICON_FRAME_BUDGET_MS) break;
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
    enqueueFromNode(document.body);
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
