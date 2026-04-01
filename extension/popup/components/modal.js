// PasteCraft Modal Component
// Reusable modal/dialog system

let modalOverlay = null;
let activeModal = null;

/**
 * Show a modal dialog
 * @param {Object} options
 * @param {string} options.title - Modal title
 * @param {string} options.content - HTML content
 * @param {Array} options.buttons - Button configs [{label, type, onClick}]
 * @param {boolean} options.closable - Show close button
 * @param {Function} options.onClose - Callback when closed
 * @param {string} options.size - 'sm' | 'md' | 'lg'
 * @returns {Object} Modal controller { close }
 */
export function showModal(options = {}) {
  const {
    title = '',
    content = '',
    buttons = [],
    closable = true,
    onClose,
    size = 'md'
  } = options;

  // Close existing modal
  if (activeModal) {
    closeModal();
  }

  // Create overlay
  modalOverlay = document.createElement('div');
  modalOverlay.className = 'pc-modal-overlay';
  modalOverlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    animation: pc-modal-fade-in 0.2s ease;
  `;

  if (closable) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }

  // Size config
  const sizes = {
    sm: '320px',
    md: '420px',
    lg: '560px'
  };

  // Create modal
  activeModal = document.createElement('div');
  activeModal.className = 'pc-modal';
  activeModal.style.cssText = `
    background: var(--pc-bg-elevated, #ffffff);
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    width: 90%;
    max-width: ${sizes[size] || sizes.md};
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: pc-modal-scale-in 0.2s ease;
  `;

  // Header
  if (title || closable) {
    const header = document.createElement('div');
    header.className = 'pc-modal-header';
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid var(--pc-border, #e2e8f0);
    `;

    const titleEl = document.createElement('h3');
    titleEl.style.cssText = `
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--pc-text-primary, #0f172a);
    `;
    titleEl.textContent = title;
    header.appendChild(titleEl);

    if (closable) {
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '×';
      closeBtn.style.cssText = `
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: var(--pc-text-tertiary, #94a3b8);
        line-height: 1;
        padding: 0;
      `;
      closeBtn.addEventListener('click', closeModal);
      header.appendChild(closeBtn);
    }

    activeModal.appendChild(header);
  }

  // Body
  const body = document.createElement('div');
  body.className = 'pc-modal-body';
  body.style.cssText = `
    padding: 20px;
    overflow-y: auto;
    flex: 1;
  `;
  body.innerHTML = content;
  activeModal.appendChild(body);

  // Footer with buttons
  if (buttons.length > 0) {
    const footer = document.createElement('div');
    footer.className = 'pc-modal-footer';
    footer.style.cssText = `
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 20px;
      border-top: 1px solid var(--pc-border, #e2e8f0);
    `;

    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.textContent = btn.label;
      button.className = `pc-modal-btn pc-modal-btn-${btn.type || 'default'}`;
      button.style.cssText = getButtonStyle(btn.type);
      button.addEventListener('click', () => {
        if (btn.onClick) {
          const result = btn.onClick();
          if (result !== false) closeModal();
        } else {
          closeModal();
        }
      });
      footer.appendChild(button);
    });

    activeModal.appendChild(footer);
  }

  modalOverlay.appendChild(activeModal);
  document.body.appendChild(modalOverlay);

  // Handle Escape key
  const escHandler = (e) => {
    if (e.key === 'Escape' && closable) closeModal();
  };
  document.addEventListener('keydown', escHandler);
  modalOverlay._escHandler = escHandler;

  // Store onClose callback
  modalOverlay._onClose = onClose;

  return {
    close: closeModal,
    getBody: () => body,
    getModal: () => activeModal
  };
}

/**
 * Close the active modal
 */
export function closeModal() {
  if (!modalOverlay) return;

  const onClose = modalOverlay._onClose;
  const escHandler = modalOverlay._escHandler;

  if (escHandler) {
    document.removeEventListener('keydown', escHandler);
  }

  modalOverlay.style.animation = 'pc-modal-fade-out 0.2s ease forwards';
  if (activeModal) {
    activeModal.style.animation = 'pc-modal-scale-out 0.2s ease forwards';
  }

  setTimeout(() => {
    modalOverlay?.remove();
    modalOverlay = null;
    activeModal = null;
    if (onClose) onClose();
  }, 200);
}

/**
 * Show a confirmation dialog
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} options.confirmText
 * @param {string} options.cancelText
 * @param {string} options.confirmType - 'primary' | 'danger'
 * @returns {Promise<boolean>}
 */
export function confirm(options = {}) {
  const {
    title = 'Confirm',
    message = 'Are you sure?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmType = 'primary'
  } = options;

  return new Promise((resolve) => {
    showModal({
      title,
      content: `<p style="margin: 0; color: var(--pc-text-secondary, #475569);">${escapeHtml(message)}</p>`,
      buttons: [
        { label: cancelText, type: 'default', onClick: () => { resolve(false); } },
        { label: confirmText, type: confirmType, onClick: () => { resolve(true); } }
      ]
    });
  });
}

/**
 * Show an alert dialog
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} options.buttonText
 * @returns {Promise<void>}
 */
export function alert(options = {}) {
  const {
    title = 'Alert',
    message = '',
    buttonText = 'OK'
  } = options;

  return new Promise((resolve) => {
    showModal({
      title,
      content: `<p style="margin: 0; color: var(--pc-text-secondary, #475569);">${escapeHtml(message)}</p>`,
      buttons: [
        { label: buttonText, type: 'primary', onClick: () => { resolve(); } }
      ]
    });
  });
}

function getButtonStyle(type) {
  const base = `
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.15s ease;
  `;

  const types = {
    default: `
      ${base}
      background: var(--pc-bg-tertiary, #f1f5f9);
      color: var(--pc-text-primary, #0f172a);
    `,
    primary: `
      ${base}
      background: var(--pc-primary, #0ea5e9);
      color: #ffffff;
    `,
    danger: `
      ${base}
      background: var(--pc-error, #ef4444);
      color: #ffffff;
    `
  };

  return types[type] || types.default;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Add required CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes pc-modal-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes pc-modal-fade-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  @keyframes pc-modal-scale-in {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  @keyframes pc-modal-scale-out {
    from { transform: scale(1); opacity: 1; }
    to { transform: scale(0.95); opacity: 0; }
  }
`;
document.head.appendChild(style);
