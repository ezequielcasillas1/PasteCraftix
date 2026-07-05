export function showWidgetToast(message) {
  const existing = document.querySelector('.pastecraft-widget-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'pastecraft-widget-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    right: 70px;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(30, 64, 175, 0.95);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    z-index: 2147483647;
    animation: fadeInOut 2s ease forwards;
  `;

  if (!document.querySelector('#pastecraft-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'pastecraft-toast-styles';
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateY(-50%) translateX(10px); }
        15% { opacity: 1; transform: translateY(-50%) translateX(0); }
        85% { opacity: 1; transform: translateY(-50%) translateX(0); }
        100% { opacity: 0; transform: translateY(-50%) translateX(10px); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}
