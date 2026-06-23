import { MERCHANT_STRIP_HEIGHT_PX } from './merchant.constants.js';

export function getMerchantStripStyles() {
  return `
    :host {
      display: block;
      width: 100%;
      height: ${MERCHANT_STRIP_HEIGHT_PX}px;
      min-height: ${MERCHANT_STRIP_HEIGHT_PX}px;
      max-height: ${MERCHANT_STRIP_HEIGHT_PX}px;
      box-sizing: border-box;
      flex-shrink: 0;
    }

    .pc-merchant-strip {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      height: ${MERCHANT_STRIP_HEIGHT_PX}px;
      min-height: ${MERCHANT_STRIP_HEIGHT_PX}px;
      max-height: ${MERCHANT_STRIP_HEIGHT_PX}px;
      box-sizing: border-box;
      padding: 0 12px;
      background: #ffffff;
      border-bottom: 1px solid #e5e7eb;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      line-height: 1;
      color: #1f2937;
      pointer-events: auto;
      flex-shrink: 0;
    }

    .pc-merchant-brand {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 4px;
      background: #fef3c7;
      color: #92400e;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      flex-shrink: 0;
      user-select: none;
    }

    .pc-merchant-pulse {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
      cursor: default;
    }

    .pc-merchant-pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #d1d5db;
      flex-shrink: 0;
    }

    .pc-merchant-pulse[data-pulse="live"] .pc-merchant-pulse-dot {
      background: #22c55e;
      box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5);
      animation: pc-merchant-pulse-live 1.8s ease-out infinite;
    }

    .pc-merchant-pulse[data-pulse="expiring"] .pc-merchant-pulse-dot {
      background: #f59e0b;
      animation: pc-merchant-pulse-expiring 1.2s ease-in-out infinite;
    }

    .pc-merchant-pulse[data-pulse="expired"] .pc-merchant-pulse-dot {
      background: #ef4444;
    }

    @keyframes pc-merchant-pulse-live {
      0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.45); }
      70% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
      100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
    }

    @keyframes pc-merchant-pulse-expiring {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.45; }
    }

    .pc-merchant-pulse-label {
      font-size: 10px;
      color: #6b7280;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 140px;
      user-select: none;
      flex-shrink: 1;
      min-width: 0;
    }

    .pc-merchant-strip:has(.pc-merchant-pulse[data-pulse="live"]) .pc-merchant-pulse-label {
      color: #166534;
      font-weight: 600;
    }

    .pc-merchant-strip:has(.pc-merchant-pulse[data-pulse="expiring"]) .pc-merchant-pulse-label {
      color: #92400e;
      font-weight: 600;
    }

    .pc-merchant-btn[data-action="merchant-dock-toggle"] {
      border-color: #fcd34d;
      background: #fffbeb;
      color: #92400e;
    }

    .pc-merchant-btn[data-action="merchant-dock-toggle"]:hover {
      background: #fef3c7;
      border-color: #f59e0b;
    }

    .pc-merchant-divider {
      width: 1px;
      height: 20px;
      background: #e5e7eb;
      flex-shrink: 0;
    }

    .pc-merchant-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      min-width: 0;
    }

    .pc-merchant-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      height: 26px;
      padding: 0 10px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: #f9fafb;
      color: #374151;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }

    .pc-merchant-btn:hover {
      background: #f3f4f6;
      border-color: #9ca3af;
    }

    .pc-merchant-btn:focus-visible {
      outline: 2px solid #f59e0b;
      outline-offset: 1px;
    }

    .pc-merchant-btn .pc-merchant-btn-icon {
      pointer-events: none;
      font-size: 14px;
      line-height: 1;
    }

    .pc-merchant-btn .pc-merchant-btn-label {
      pointer-events: none;
    }

    .pc-merchant-btn[data-action="merchant-spot"] {
      border-color: #86efac;
      background: #ecfdf5;
      color: #166534;
    }

    .pc-merchant-btn[data-action="merchant-spot"]:hover {
      background: #d1fae5;
      border-color: #4ade80;
    }

    .pc-merchant-btn[data-action="merchant-image-to-text"] {
      border-color: #fcd34d;
      background: #fffbeb;
      color: #92400e;
    }

    .pc-merchant-btn[data-action="merchant-image-to-text"]:hover {
      background: #fef3c7;
      border-color: #f59e0b;
    }

    .pc-merchant-btn[data-action="merchant-tag-queue-toggle"] {
      border-color: #c4b5fd;
      background: #f5f3ff;
      color: #5b21b6;
    }

    .pc-merchant-btn[data-action="merchant-tag-queue-toggle"]:hover {
      background: #ede9fe;
      border-color: #a78bfa;
    }

    .pc-merchant-btn[data-action="merchant-tag-queue-toggle"].is-active,
    .pc-merchant-btn[data-action="merchant-tag-queue-toggle"][aria-pressed="true"] {
      background: #7c3aed;
      border-color: #6d28d9;
      color: #ffffff;
    }

    .pc-merchant-hint {
      margin-left: auto;
      font-size: 11px;
      color: #9ca3af;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      user-select: none;
    }

    .pc-merchant-toast {
      position: fixed;
      top: calc(${MERCHANT_STRIP_HEIGHT_PX}px + 8px);
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483646;
      padding: 8px 14px;
      border-radius: 8px;
      background: #1f2937;
      color: #f9fafb;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .pc-merchant-toast.is-visible {
      opacity: 1;
    }
  `;
}
