// PasteCraft Toast Component
// Reusable toast notification system

let toastContainer = null;
let toastQueue = [];
let activeToast = null;

const TOAST_DURATION = 3000;
const TOAST_GAP = 300;

/**
 * Initialize toast container
 */
function ensureContainer() {
  if (toastContainer && document.body.contains(toastContainer)) return;

  toastContainer = document.createElement('div');
  toastContainer.id = 'pc-toast-container';
  toastContainer.style.cssText = `
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10000;
    pointer-events: none;
  `;
  document.body.appendChild(toastContainer);
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {Object} options
 * @param {'success' | 'error' | 'warning' | 'info'} options.type - Toast type
 * @param {number} options.duration - Duration in ms
 * @param {boolean} options.dismissible - Allow click to dismiss
 */
export function showToast(message, options = {}) {
  const {
    type = 'info',
    duration = TOAST_DURATION,
    dismissible = true
  } = options;

  ensureContainer();

  const toast = createToastElement(message, type, dismissible);
  
  // Queue management
  if (activeToast) {
    toastQueue.push({ toast, duration });
    return;
  }

  displayToast(toast, duration);
}

/**
 * Create toast DOM element
 */
function createToastElement(message, type, dismissible) {
  const colors = {
    success: { bg: '#22c55e', icon: '✓' },
    error: { bg: '#ef4444', icon: '✕' },
    warning: { bg: '#f59e0b', icon: '⚠' },
    info: { bg: '#0ea5e9', icon: 'ℹ' }
  };

  const { bg, icon } = colors[type] || colors.info;

  const toast = document.createElement('div');
  toast.className = 'pc-toast';
  toast.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: ${bg};
    color: #ffffff;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    pointer-events: auto;
    cursor: ${dismissible ? 'pointer' : 'default'};
    animation: pc-toast-enter 0.3s ease;
    max-width: 340px;
  `;

  toast.innerHTML = `
    <span style="font-size: 16px;">${icon}</span>
    <span>${escapeHtml(message)}</span>
  `;

  if (dismissible) {
    toast.addEventListener('click', () => dismissToast(toast));
  }

  return toast;
}

/**
 * Display toast and handle timing
 */
function displayToast(toast, duration) {
  activeToast = toast;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    dismissToast(toast);
  }, duration);
}

/**
 * Dismiss active toast
 */
function dismissToast(toast) {
  if (!toast || !toast.parentNode) return;

  toast.style.animation = 'pc-toast-exit 0.3s ease forwards';
  
  setTimeout(() => {
    toast.remove();
    activeToast = null;

    // Process queue
    if (toastQueue.length > 0) {
      const next = toastQueue.shift();
      setTimeout(() => displayToast(next.toast, next.duration), TOAST_GAP);
    }
  }, 300);
}

/**
 * Clear all toasts
 */
export function clearToasts() {
  toastQueue = [];
  if (activeToast) {
    dismissToast(activeToast);
  }
}

/**
 * Shorthand methods
 */
export const toast = {
  success: (msg, opts) => showToast(msg, { ...opts, type: 'success' }),
  error: (msg, opts) => showToast(msg, { ...opts, type: 'error' }),
  warning: (msg, opts) => showToast(msg, { ...opts, type: 'warning' }),
  info: (msg, opts) => showToast(msg, { ...opts, type: 'info' })
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Add required CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes pc-toast-enter {
    from { transform: translateY(-100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @keyframes pc-toast-exit {
    from { transform: translateY(0); opacity: 1; }
    to { transform: translateY(-100%); opacity: 0; }
  }
`;
document.head.appendChild(style);
