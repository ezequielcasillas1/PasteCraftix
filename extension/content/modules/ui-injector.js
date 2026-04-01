// PasteCraft UI Injector
// Shadow DOM factory for isolated UI injection
// Reference: https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM

/**
 * Check if running in Repo Loader development mode
 */
function isRepoLoaderBuild() {
  try {
    const mf = chrome.runtime?.getManifest?.();
    const name = mf?.name ? String(mf.name) : '';
    const desc = mf?.description ? String(mf.description) : '';
    return (
      name.includes('Repo Loader') ||
      desc.includes('repo root') ||
      desc.includes('Actual extension lives in /extension')
    );
  } catch (_) {
    return false;
  }
}

/**
 * Get extension resource URL with repo loader support
 * @param {string} path - Resource path relative to extension
 * @returns {string} Full URL
 */
export function getResourceUrl(path) {
  const normalized = String(path || '').replace(/^\/+/, '');
  const finalPath = isRepoLoaderBuild() ? `extension/${normalized}` : normalized;
  return chrome.runtime.getURL(finalPath);
}

/**
 * Create an isolated UI container using Shadow DOM
 * @param {Object} options
 * @param {string} options.id - Container ID (for deduplication)
 * @param {string} options.cssPath - Path to CSS file to inject
 * @param {string} options.cssText - Inline CSS (alternative to cssPath)
 * @param {string} options.html - HTML content
 * @param {string} options.position - 'fixed' | 'absolute' (default: 'fixed')
 * @returns {Object} { host, shadow, container }
 */
export function createShadowUI({ id, cssPath, cssText, html, position = 'fixed' }) {
  // Remove existing if present
  const existing = document.getElementById(id);
  if (existing) {
    existing.remove();
  }

  // Create host element
  const host = document.createElement('div');
  host.id = id;
  host.style.cssText = `
    all: initial;
    position: ${position};
    z-index: 2147483647;
    pointer-events: none;
  `;

  // Attach shadow DOM
  const shadow = host.attachShadow({ mode: 'closed' });

  // Add styles
  if (cssPath) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = getResourceUrl(cssPath);
    shadow.appendChild(link);
  }

  if (cssText) {
    const style = document.createElement('style');
    style.textContent = cssText;
    shadow.appendChild(style);
  }

  // Add content container
  const container = document.createElement('div');
  container.className = 'pc-shadow-container';
  container.style.pointerEvents = 'auto';
  
  if (html) {
    container.innerHTML = html;
  }
  
  shadow.appendChild(container);
  document.body.appendChild(host);

  return { host, shadow, container };
}

/**
 * Inject CSS into shadow root
 * @param {ShadowRoot} shadow - Shadow root
 * @param {string} cssText - CSS text to inject
 */
export function injectShadowCSS(shadow, cssText) {
  const style = document.createElement('style');
  style.textContent = cssText;
  shadow.appendChild(style);
}

/**
 * Remove shadow UI by ID
 * @param {string} id - Container ID
 */
export function removeShadowUI(id) {
  const host = document.getElementById(id);
  if (host) {
    host.remove();
  }
}

/**
 * Show toast notification in shadow DOM
 * @param {string} message - Toast message
 * @param {Object} options
 * @param {'success' | 'error' | 'info'} options.type - Toast type
 * @param {number} options.duration - Duration in ms
 */
export function showToast(message, { type = 'info', duration = 3000 } = {}) {
  const toastId = 'pastecraft-toast';
  removeShadowUI(toastId);

  const colors = {
    success: { bg: '#22c55e', text: '#ffffff' },
    error: { bg: '#ef4444', text: '#ffffff' },
    info: { bg: '#0ea5e9', text: '#ffffff' }
  };

  const { bg, text } = colors[type] || colors.info;

  const cssText = `
    .pc-toast {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      background: ${bg};
      color: ${text};
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: toast-in 0.3s ease, toast-out 0.3s ease ${duration - 300}ms forwards;
      z-index: 2147483647;
    }
    @keyframes toast-in {
      from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
      to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    @keyframes toast-out {
      from { transform: translateX(-50%) translateY(0); opacity: 1; }
      to { transform: translateX(-50%) translateY(-100%); opacity: 0; }
    }
  `;

  const { host } = createShadowUI({
    id: toastId,
    cssText,
    html: `<div class="pc-toast">${escapeHtml(message)}</div>`
  });

  setTimeout(() => {
    host.remove();
  }, duration);
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
