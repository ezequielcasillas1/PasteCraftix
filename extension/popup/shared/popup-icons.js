// Lucide icon renderer - idempotent, safe to call many times.
// Replaces <i data-lucide="name"></i> placeholders with inline SVGs.
// Observes DOM mutations so dynamically-rendered templates also get icons.

const PENDING_ICON_SELECTOR = 'i[data-lucide]';

function countPendingLucideIcons(root = document) {
  return root.querySelectorAll(PENDING_ICON_SELECTOR).length;
}

function nodeHasPendingLucideIcon(node) {
  if (!node || node.nodeType !== 1) return false;
  if (node.matches?.(PENDING_ICON_SELECTOR)) return true;
  return !!node.querySelector?.(PENDING_ICON_SELECTOR);
}

window.renderLucideIcons = function renderLucideIcons(root) {
  try {
    if (typeof window.lucide === 'undefined' || !window.lucide.createIcons) return;
    const scope = root && root.querySelectorAll ? root : document;
    if (!countPendingLucideIcons(scope)) return;

    window.lucide.createIcons({
      icons: window.lucide.icons || window.lucide,
      attrs: { 'stroke-width': 2, 'aria-hidden': 'true', focusable: 'false' },
      root: scope === document ? undefined : scope,
    });
  } catch (e) {
    console.warn('Lucide render failed:', e);
  }
};

(function initLucideObserver() {
  if (window.__lucideObserverInstalled) return;
  window.__lucideObserverInstalled = true;
  const schedule = (() => {
    let pending = false;
    return () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        window.renderLucideIcons();
      });
    };
  })();
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (nodeHasPendingLucideIcon(node)) {
          schedule();
          return;
        }
      }
    }
  });
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    }, { once: true });
  }
})();
