// Lucide icon renderer - idempotent, safe to call many times.
// Replaces <i data-lucide="name"></i> placeholders with inline SVGs.
// Observes DOM mutations so dynamically-rendered templates also get icons.
const LUCIDE_ATTRS = { 'stroke-width': 2, 'aria-hidden': 'true', focusable: 'false' };
const ICON_SYNC_THRESHOLD = 120;
const ICON_BATCH_SIZE = 96;
const ICON_FRAME_BUDGET_MS = 16;
const ICON_MAX_SCAN_PER_FRAME = 200;
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

function prunePendingNodes(pendingNodes) {
  for (const node of pendingNodes) {
    if (!node.isConnected || !isUnrenderedPlaceholder(node)) pendingNodes.delete(node);
  }
}

function runLucideOnRoot(root) {
  const lucide = window.lucide;
  if (!lucide?.createIcons || !root?.nodeType) return;
  if (!collectUnrenderedPlaceholders(root).length) return;
  lucide.createIcons({
    attrs: LUCIDE_ATTRS,
    root,
  });
}

function runLucideCreateIcons(nodes) {
  const lucide = window.lucide;
  if (!lucide?.createIcons || !nodes.length) return;

  const roots = new Set();
  for (const node of nodes) {
    const root = node?.parentElement || node;
    if (root?.nodeType === 1) roots.add(root);
  }
  if (!roots.size) return;

  for (const root of roots) {
    runLucideOnRoot(root);
  }
}

function scheduleIconWork(task, urgent = false) {
  if (urgent) {
    queueMicrotask(task);
    return;
  }

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
  let tabIconFlushTab = null;
  let tabIconFlushScheduled = false;
  let tabIconFlushRafId = 0;
  let tabIconSuppressUntil = 0;

  window.getActiveTabContentRoot = function getActiveTabContentRoot(tabName) {
    const tab = tabName || window.pasteCraftPopup?.currentTab;
    if (!tab) return null;
    return document.getElementById(`${tab}Tab`) || null;
  };

  const runTabIconFlush = () => {
    const activeTab = tabIconFlushTab;
    const activeRoot = window.getActiveTabContentRoot(activeTab);
    pendingNodes.clear();
    flushScheduled = false;
    tabIconSuppressUntil = performance.now() + 150;
    observerPaused = true;
    window.__pcTabIconRendering = true;
    try {
      if (activeRoot?.isConnected) {
        window.renderLucideIconsSync(activeRoot);
        if (!collectUnrenderedPlaceholders(activeRoot).length && activeRoot.dataset) {
          activeRoot.dataset.pcIconsReady = '1';
        }
      }
    } finally {
      pendingNodes.clear();
      flushScheduled = false;
      window.__pcTabIconRendering = false;
      observerPaused = false;
    }
  };

  window.finishBootLucideIcons = function finishBootLucideIcons() {
    window.__pcPopupLucideBooting = false;
    pendingNodes.clear();
    flushScheduled = false;
    tabIconSuppressUntil = performance.now() + 200;
    observerPaused = true;
    window.__pcTabIconRendering = true;
    try {
      const body = document.body;
      if (body?.isConnected && collectUnrenderedPlaceholders(body).length) {
        runLucideOnRoot(body);
      }
    } catch (e) {
      console.warn('Lucide boot render failed:', e);
    } finally {
      pendingNodes.clear();
      flushScheduled = false;
      observerPaused = false;
      window.__pcTabIconRendering = false;
    }
  };

  window.renderLucideIconsForActiveTab = function renderLucideIconsForActiveTab(tabName, _source, options = {}) {
    if (window.__pcPopupLucideBooting) return;
    const immediate = options.immediate === true;
    const force = options.force === true;
    const tab = tabName || window.pasteCraftPopup?.currentTab || '';
    const activeRoot = window.getActiveTabContentRoot(tab);
    if (!force && activeRoot?.dataset?.pcIconsReady === '1' && !collectUnrenderedPlaceholders(activeRoot).length) {
      return;
    }
    tabIconFlushTab = tab;

    if (immediate) {
      if (tabIconFlushScheduled && tabIconFlushRafId) {
        cancelAnimationFrame(tabIconFlushRafId);
        tabIconFlushScheduled = false;
        tabIconFlushRafId = 0;
      }
      runTabIconFlush();
      return;
    }

    if (tabIconFlushScheduled) return;
    tabIconFlushScheduled = true;
    tabIconFlushRafId = requestAnimationFrame(() => {
      tabIconFlushScheduled = false;
      tabIconFlushRafId = 0;
      runTabIconFlush();
    });
  };

  const processSyncFlush = (preferredRoot) => {
    prunePendingNodes(pendingNodes);
    if (pendingNodes.size === 0) return;

    pendingNodes.clear();
    const root = preferredRoot instanceof Element ? preferredRoot : document.body;
    observerPaused = true;
    try {
      runLucideOnRoot(root);
    } catch (e) {
      console.warn('Lucide render failed:', e);
    } finally {
      observerPaused = false;
    }
  };

  const scheduleFlush = (preferredRoot) => {
    if (flushScheduled || pendingNodes.size === 0) return;
    flushScheduled = true;

    const run = () => {
      flushScheduled = false;
      prunePendingNodes(pendingNodes);
      if (pendingNodes.size === 0) return;
      if (pendingNodes.size <= ICON_SYNC_THRESHOLD) {
        processSyncFlush(preferredRoot);
        return;
      }
      processBatch(preferredRoot);
    };

    scheduleIconWork(run, pendingNodes.size <= ICON_SYNC_THRESHOLD);
  };

  const enqueueFromNode = (node) => {
    if (!node) return;
    for (const el of collectUnrenderedPlaceholders(node)) {
      pendingNodes.add(el);
    }
    scheduleFlush(node instanceof Element ? node : null);
  };

  const queueFullDocumentScan = () => {
    if (!document.body || fullScanQueued) return;
    if (performance.now() < tabIconSuppressUntil) return;
    const now = performance.now();
    if (pendingNodes.size > 0 && now - lastFullScanAt < ICON_FULL_SCAN_COOLDOWN_MS) {
      scheduleFlush(document.body);
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

  const processBatch = (preferredRoot) => {
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
      if (pendingNodes.size > 0) scheduleFlush(preferredRoot);
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

    if (pendingNodes.size > 0) {
      if (pendingNodes.size <= ICON_SYNC_THRESHOLD) {
        processSyncFlush(preferredRoot);
        return;
      }
      scheduleFlush(preferredRoot);
    }
  };

  window.renderLucideIconsSync = function renderLucideIconsSync(scope) {
    if (window.__pcPopupLucideBooting) return;
    if (window.__pcTabIconRendering && !(scope instanceof Element)) return;
    const root = scope instanceof Element ? scope : document.body;
    if (!root?.isConnected) return;
    if (!collectUnrenderedPlaceholders(root).length) return;
    observerPaused = true;
    try {
      runLucideOnRoot(root);
    } finally {
      observerPaused = false;
    }
  };

  window.renderLucideIcons = function renderLucideIcons(scope) {
    if (window.__pcTabIconRendering) return;
    if (window.__pcPopupLucideBooting && !scope) return;
    if (scope instanceof Element) {
      enqueueFromNode(scope);
      return;
    }
    if (Array.isArray(scope) && scope.length) {
      for (const node of scope) {
        if (isUnrenderedPlaceholder(node)) pendingNodes.add(node);
      }
      scheduleFlush(null);
      return;
    }
    queueFullDocumentScan();
  };

  if (window.__lucideObserverInstalled) return;
  window.__lucideObserverInstalled = true;

  const observer = new MutationObserver((mutations) => {
    if (observerPaused || window.__pcPopupLucideBooting || window.__pcTabIconRendering) return;
    if (performance.now() < tabIconSuppressUntil) return;

    let queued = false;
    let scopeRoot = null;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        const placeholders = collectUnrenderedPlaceholders(node);
        if (!placeholders.length) continue;
        for (const el of placeholders) pendingNodes.add(el);
        if (!scopeRoot) scopeRoot = node;
        queued = true;
      }
    }

    if (queued) scheduleFlush(scopeRoot);
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
