import { isSiteAllowed } from './safety/site-guard.js';
import { QuickPasteInterface } from './quick-paste/quick-paste.js';
import { PasteCraftFloatingWidget } from './widget/widget.js';

function pastecraftBootContent() {
  if (window.pasteCraftFloatingWidget) return;

  window.pasteCraftQuickPaste = new QuickPasteInterface();
  window.pasteCraftFloatingWidget = new PasteCraftFloatingWidget();
}

function pastecraftInitContent() {
  if (!isSiteAllowed(location.href)) {
    return;
  }

  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', pastecraftInitContent, { once: true });
    } else {
      requestAnimationFrame(pastecraftInitContent);
    }
    return;
  }
  if (window.pasteCraftFloatingWidget) return;

  // Defer heavy shadow-DOM injection until after the host page's first paint.
  requestAnimationFrame(pastecraftBootContent);
}

pastecraftInitContent();
