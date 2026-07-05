export function ensurePageDockStyles(widget) {
  // Inject once per page/tab
  if (document.getElementById('pastecraft-page-dock-styles')) return;

  const style = document.createElement('style');
  style.id = 'pastecraft-page-dock-styles';
  style.textContent = `
      /* PasteCraft: "docked" mode - push page content left when panel is open */
      html.pastecraft-page-pushed body {
        margin-right: var(--pastecraft-panel-width, 476px) !important;
        transition: margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }

      /* On small screens panels become full-width; don't push page */
      @media (max-width: 480px) {
        html.pastecraft-page-pushed body {
          margin-right: 0 !important;
        }
      }
    `;

  document.head.appendChild(style);
}

export function getActivePanelWidthPx(widget) {
  // Prefer the currently-open & visible panel, fall back to 476px.
  const candidates = [
    { open: widget.openStates?.popup, el: document.getElementById('pastecraft-popup-overlay') },
    { open: widget.openStates?.settings, el: widget._settingsPanelEl },
    { open: widget.openStates?.quickView, el: document.getElementById('pastecraft-quickview-panel') }
  ];

  const pick =
    candidates.find(c => c.open && c.el && c.el.classList.contains('visible')) ||
    candidates.find(c => c.open && c.el);

  const width = pick?.el?.getBoundingClientRect?.().width;
  if (typeof width === 'number' && Number.isFinite(width) && width > 0) return width;
  return 476;
}

export function syncPageDocking(widget) {
  ensurePageDockStyles(widget);

  const shouldPush = !!(widget.openStates?.popup || widget.openStates?.settings || widget.openStates?.quickView);
  const root = document.documentElement;
  if (!root) return;

  if (!shouldPush) {
    root.classList.remove('pastecraft-page-pushed');
    root.style.removeProperty('--pastecraft-panel-width');
    return;
  }

  const widthPx = getActivePanelWidthPx(widget);
  root.style.setProperty('--pastecraft-panel-width', `${Math.round(widthPx)}px`);
  root.classList.add('pastecraft-page-pushed');
}
