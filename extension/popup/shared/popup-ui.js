(function initPasteCraftPopupUi(globalScope) {
  function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    overlay.style.transition = 'none';
    overlay.style.opacity = '1';
    overlay.style.display = 'none';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  const TOAST_COLORS = {
    success: '#2563eb',
    error: '#ef4444',
    info: '#3b82f6',
  };

  function showToast(app, message, type = 'success') {
    const TOAST_DURATION_MS = 3000;

    app._toastState = app._toastState || {
      el: null,
      timerId: null,
      lastMessage: null,
      lastShownAt: 0
    };

    const now = Date.now();
    const msg = String(message ?? '');
    if (!msg) return;

    const toastType = TOAST_COLORS[type] ? type : 'success';

    if (app._toastState.lastMessage === msg && (now - app._toastState.lastShownAt) < 1200) {
      return;
    }
    app._toastState.lastMessage = msg;
    app._toastState.lastShownAt = now;

    if (!app._toastState.el || !app._toastState.el.isConnected) {
      const toast = document.createElement('div');
      toast.setAttribute('data-pastecraft-toast', '1');
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${TOAST_COLORS[toastType]};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10000;
        opacity: 0;
        transform: translateY(-6px);
        transition: opacity 180ms ease, transform 180ms ease;
        pointer-events: none;
      `;
      document.body.appendChild(toast);
      app._toastState.el = toast;
    }

    const toast = app._toastState.el;
    toast.style.background = TOAST_COLORS[toastType];
    toast.textContent = msg;

    if (app._toastState.timerId) {
      clearTimeout(app._toastState.timerId);
      app._toastState.timerId = null;
    }

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    app._toastState.timerId = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-6px)';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 220);
    }, TOAST_DURATION_MS);
  }

  function showConfetti() {
    const colors = ['#2563eb', '#3b82f6', '#60a5fa', '#ef4444', '#1a1f5e'];
    const container = document.body;

    for (let i = 0; i < 30; i++) {
      setTimeout(() => {
        const confetti = document.createElement('div');
        confetti.style.cssText = `
          position: fixed;
          width: 6px;
          height: 6px;
          background: ${colors[Math.floor(Math.random() * colors.length)]};
          left: ${Math.random() * 100}vw;
          top: -10px;
          border-radius: 50%;
          pointer-events: none;
          z-index: 9999;
          animation: confetti 3s linear forwards;
        `;

        container.appendChild(confetti);
        setTimeout(() => confetti.remove(), 3000);
      }, i * 50);
    }
  }

  function setActionButtonLoading(app, buttonId, isLoading, loadingText = 'Loading...') {
    if (!buttonId) return;
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    if (!btn.dataset.originalHtml) {
      btn.dataset.originalHtml = btn.innerHTML;
    }

    if (isLoading) {
      btn.disabled = true;
      btn.innerHTML = `<span class="btn-loading-spinner" aria-hidden="true"></span>${escapeHtml(loadingText)}`;
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalHtml;
    }
  }

  globalScope.PasteCraftPopupUi = {
    hideLoadingOverlay,
    escapeHtml,
    showToast,
    showConfetti,
    setActionButtonLoading
  };
})(typeof window !== 'undefined' ? window : globalThis);
