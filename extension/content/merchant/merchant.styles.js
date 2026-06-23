import { MERCHANT_STRIP_HEIGHT_PX } from './merchant.constants.js';

export function getMerchantStripStyles() {
  return `
    :host {
      display: block;
      width: 100%;
      height: ${MERCHANT_STRIP_HEIGHT_PX}px;
      box-sizing: border-box;
    }

    .pc-merchant-strip {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      padding: 0 12px;
      background: #ffffff;
      border-bottom: 1px solid #e5e7eb;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      line-height: 1;
      color: #1f2937;
      pointer-events: auto;
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
