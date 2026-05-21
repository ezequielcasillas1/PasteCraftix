// Lucide icon renderer - idempotent, safe to call many times.
// Replaces <i data-lucide="name"></i> placeholders with inline SVGs.
// Observes DOM mutations so dynamically-rendered templates also get icons.
window.renderLucideIcons = function renderLucideIcons() {
  try {
    if (typeof window.lucide === 'undefined' || !window.lucide.createIcons) return;
    window.lucide.createIcons({
      icons: window.lucide.icons || window.lucide,
      attrs: { 'stroke-width': 2, 'aria-hidden': 'true', focusable: 'false' },
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
        if (node.nodeType === 1 && (node.matches?.('[data-lucide]') || node.querySelector?.('[data-lucide]'))) {
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
