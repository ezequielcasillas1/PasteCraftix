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

    .pc-merchant-btn[data-action="merchant-snippets-toggle"] {
      border-color: #7dd3fc;
      background: #f0f9ff;
      color: #0369a1;
    }

    .pc-merchant-btn[data-action="merchant-snippets-toggle"]:hover {
      background: #e0f2fe;
      border-color: #38bdf8;
    }

    .pc-merchant-btn[data-action="merchant-snippets-toggle"][aria-expanded="true"] {
      background: #0284c7;
      border-color: #0369a1;
      color: #ffffff;
    }

    .pc-merchant-btn-seal {
      border-color: #93c5fd;
      background: #eff6ff;
      color: #1d4ed8;
    }

    .pc-merchant-btn-seal:hover {
      background: #dbeafe;
      border-color: #60a5fa;
    }

    .pc-merchant-snippet-wrap {
      position: relative;
      display: inline-flex;
      flex-shrink: 0;
    }

    .pc-merchant-snippet-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      z-index: 10;
      min-width: 200px;
      max-width: 280px;
      max-height: 240px;
      overflow-y: auto;
      padding: 6px;
      border-radius: 8px;
      border: 1px solid #7dd3fc;
      background: #ffffff;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
    }

    .pc-merchant-snippet-menu[hidden] {
      display: none !important;
    }

    .pc-merchant-snippet-item {
      display: block;
      width: 100%;
      box-sizing: border-box;
      padding: 8px 10px;
      margin: 0 0 4px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: #0f172a;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      text-align: left;
      cursor: pointer;
    }

    .pc-merchant-snippet-item:last-child {
      margin-bottom: 0;
    }

    .pc-merchant-snippet-item:hover {
      background: #f0f9ff;
    }

    .pc-merchant-snippet-empty {
      margin: 0;
      padding: 8px;
      font-size: 11px;
      color: #64748b;
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

    .pc-merchant-seal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(15, 23, 42, 0.45);
      pointer-events: auto;
    }

    .pc-merchant-seal-backdrop[hidden] {
      display: none !important;
    }

    .pc-merchant-seal-dialog {
      width: min(360px, calc(100vw - 32px));
      padding: 20px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.18);
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }

    .pc-merchant-seal-title {
      margin: 0 0 8px;
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
    }

    .pc-merchant-seal-message {
      margin: 0 0 16px;
      font-size: 13px;
      line-height: 1.45;
      color: #475569;
    }

    .pc-merchant-seal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .pc-merchant-seal-btn {
      height: 32px;
      padding: 0 14px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #f8fafc;
      color: #334155;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }

    .pc-merchant-seal-btn:hover {
      background: #f1f5f9;
    }

    .pc-merchant-seal-btn-confirm {
      border-color: #2563eb;
      background: #2563eb;
      color: #ffffff;
    }

    .pc-merchant-seal-btn-confirm:hover {
      background: #1d4ed8;
      border-color: #1d4ed8;
    }
  `;
}
