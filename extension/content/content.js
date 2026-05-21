import { QuickPasteInterface } from './quick-paste/quick-paste.js';
import { PasteCraftFloatingWidget } from './widget/widget.js';

// Initialize Quick Paste when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.pasteCraftQuickPaste = new QuickPasteInterface();
    window.pasteCraftFloatingWidget = new PasteCraftFloatingWidget();
  });
} else {
  window.pasteCraftQuickPaste = new QuickPasteInterface();
  window.pasteCraftFloatingWidget = new PasteCraftFloatingWidget();
}

// Add toast animation styles
const toastStyles = document.createElement('style');
toastStyles.textContent = `
  @keyframes pastecraft-toast-in {
    from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
    to { transform: translateX(-50%) translateY(0); opacity: 1; }
  }
  
  @keyframes pastecraft-toast-out {
    from { transform: translateX(-50%) translateY(0); opacity: 1; }
    to { transform: translateX(-50%) translateY(-100%); opacity: 0; }
  }
`;
document.head.appendChild(toastStyles);

