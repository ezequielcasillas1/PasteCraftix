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

function maskDisallowedPlaceholders(allowed) {
  const masked = [];
  document.querySelectorAll?.('[data-lucide]')?.forEach((element) => {
    if (!isUnrenderedPlaceholder(element) || allowed.has(element)) return;
    masked.push([element, element.getAttribute('data-lucide')]);
    element.removeAttribute('data-lucide');
  });
  return masked;
}

function restoreMaskedPlaceholders(masked) {
  masked.forEach(([element, iconName]) => {
    if (element.isConnected && !element.hasAttribute('data-lucide')) {
      element.setAttribute('data-lucide', iconName);
    }
  });
}

function removeRenderedLucideMarkers() {
  document.querySelectorAll?.('svg[data-lucide]')?.forEach((el) => el.removeAttribute('data-lucide'));
}

function runLucideOnPlaceholders(placeholders) {
  const lucide = window.lucide;
  if (!lucide?.createIcons || !placeholders.length) return;
  const allowed = new Set(placeholders.filter(isUnrenderedPlaceholder));
  if (!allowed.size) return;
  const masked = maskDisallowedPlaceholders(allowed);
  try {
    lucide.createIcons({ attrs: LUCIDE_ATTRS });
  } finally {
    restoreMaskedPlaceholders(masked);
  }
  removeRenderedLucideMarkers();
}

function runLucideOnRoot(root) {
  if (!root?.nodeType) return;
  const placeholders = collectUnrenderedPlaceholders(root)
    .filter((element) => !isInsideInactiveTab(element));
  runLucideOnPlaceholders(placeholders);
}

function runLucideCreateIcons(nodes) {
  runLucideOnPlaceholders(nodes);
}

const BOOT_SHELL_SELECTORS = [
  '#topBar',
  '.header',
  '#upgradeBanner',
  '#manualInputSection',
  '.tab-nav',
];

function collectBootPlaceholders(activeTabRoot) {
  const placeholders = new Set();
  BOOT_SHELL_SELECTORS.forEach((selector) => {
    const root = document.querySelector?.(selector);
    collectUnrenderedPlaceholders(root || {}).forEach((element) => placeholders.add(element));
  });
  collectUnrenderedPlaceholders(activeTabRoot || {}).forEach((element) => placeholders.add(element));
  return [...placeholders];
}

function isInsideInactiveTab(element) {
  const tabRoot = element?.closest?.('.tab-content');
  return !!tabRoot && !tabRoot.classList.contains('active');
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
      const activeRoot = window.getActiveTabContentRoot();
      runLucideOnPlaceholders(collectBootPlaceholders(activeRoot));
    } catch (e) {
      console.warn('Lucide boot render failed:', e);
    } finally {
      pendingNodes.clear();
      flushScheduled = false;
      observerPaused = false;
      window.__pcTabIconRendering = false;
    }
  };

  const cancelScheduledTabIconFlush = () => {
    if (!tabIconFlushScheduled || !tabIconFlushRafId) return;
    cancelAnimationFrame(tabIconFlushRafId);
    tabIconFlushScheduled = false;
    tabIconFlushRafId = 0;
  };

  const scheduleTabIconFlush = () => {
    if (tabIconFlushScheduled) return;
    tabIconFlushScheduled = true;
    tabIconFlushRafId = requestAnimationFrame(() => {
      tabIconFlushScheduled = false;
      tabIconFlushRafId = 0;
      runTabIconFlush();
    });
  };

  window.renderLucideIconsForActiveTab = function renderLucideIconsForActiveTab(tabName, _source, options = {}) {
    if (window.__pcPopupLucideBooting) return;
    tabIconFlushTab = tabName || window.pasteCraftPopup?.currentTab || '';
    if (options.immediate === true) {
      cancelScheduledTabIconFlush();
      runTabIconFlush();
      return;
    }
    scheduleTabIconFlush();
  };

  const processSyncFlush = () => {
    prunePendingNodes(pendingNodes);
    if (pendingNodes.size === 0) return;

    const nodes = [...pendingNodes];
    pendingNodes.clear();
    observerPaused = true;
    try {
      runLucideCreateIcons(nodes);
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
        processSyncFlush();
        return;
      }
      processBatch(preferredRoot);
    };

    scheduleIconWork(run, pendingNodes.size <= ICON_SYNC_THRESHOLD);
  };

  const enqueueFromNode = (node) => {
    if (!node) return;
    for (const el of collectUnrenderedPlaceholders(node)) {
      if (isInsideInactiveTab(el)) continue;
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

  const shouldStopBatchScan = (batchLength, scanned, frameDeadline) => (
    batchLength >= ICON_BATCH_SIZE
    || scanned >= ICON_MAX_SCAN_PER_FRAME
    || performance.now() >= frameDeadline
  );

  const takeIconBatch = () => {
    const batch = [];
    const frameDeadline = performance.now() + ICON_FRAME_BUDGET_MS;
    let scanned = 0;
    for (const node of pendingNodes) {
      scanned += 1;
      pendingNodes.delete(node);
      if (node.isConnected && isUnrenderedPlaceholder(node)) batch.push(node);
      if (shouldStopBatchScan(batch.length, scanned, frameDeadline)) break;
    }
    return batch;
  };

  const renderIconBatch = (batch) => {
    observerPaused = true;
    try {
      runLucideCreateIcons(batch);
    } catch (e) {
      console.warn('Lucide render failed:', e);
    } finally {
      observerPaused = false;
    }
  };

  const scheduleRemainingIconWork = (preferredRoot) => {
    if (pendingNodes.size === 0) return;
    if (pendingNodes.size <= ICON_SYNC_THRESHOLD) processSyncFlush();
    else scheduleFlush(preferredRoot);
  };

  const processBatch = (preferredRoot) => {
    if (pendingNodes.size === 0) return;
    const batch = takeIconBatch();
    if (batch.length) renderIconBatch(batch);
    scheduleRemainingIconWork(preferredRoot);
  };

  const getIconRenderRoot = (scope) => (
    scope instanceof Element ? scope : document.body
  );

  const canRenderIconRoot = (root) => {
    if (!root?.isConnected) return false;
    if (isInsideInactiveTab(root)) return false;
    return collectUnrenderedPlaceholders(root).length > 0;
  };

  const runSynchronousIconRender = (root) => {
    observerPaused = true;
    try {
      runLucideOnRoot(root);
    } finally {
      observerPaused = false;
    }
  };

  window.renderLucideIconsSync = function renderLucideIconsSync(scope) {
    if (window.__pcPopupLucideBooting) return;
    if (window.__pcTabIconRendering && !(scope instanceof Element)) return;
    const root = getIconRenderRoot(scope);
    if (!canRenderIconRoot(root)) return;
    runSynchronousIconRender(root);
  };

  const enqueueIconArray = (nodes) => {
    nodes.forEach((node) => {
      if (isUnrenderedPlaceholder(node)) pendingNodes.add(node);
    });
    scheduleFlush(null);
  };

  const shouldBlockGeneralIconRender = (scope) => (
    window.__pcTabIconRendering
    || (window.__pcPopupLucideBooting && !scope)
  );

  window.renderLucideIcons = function renderLucideIcons(scope) {
    if (shouldBlockGeneralIconRender(scope)) return;
    if (scope instanceof Element) {
      enqueueFromNode(scope);
      return;
    }
    if (Array.isArray(scope) && scope.length) {
      enqueueIconArray(scope);
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
        for (const el of placeholders) {
          if (!isInsideInactiveTab(el)) pendingNodes.add(el);
        }
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
