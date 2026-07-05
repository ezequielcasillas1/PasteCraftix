import { MERCHANT_STRIP_HEIGHT_PX, MERCHANT_STRIP_MAIN_HEIGHT_PX } from './merchant.constants.js';

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
      flex-direction: column;
      align-items: stretch;
      gap: 0;
      width: 100%;
      height: ${MERCHANT_STRIP_HEIGHT_PX}px;
      min-height: ${MERCHANT_STRIP_HEIGHT_PX}px;
      max-height: ${MERCHANT_STRIP_HEIGHT_PX}px;
      box-sizing: border-box;
      padding: 0;
      background: #ffffff;
      border-bottom: 1px solid #e5e7eb;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      line-height: 1;
      color: #1f2937;
      pointer-events: auto;
      flex-shrink: 0;
    }

    .pc-merchant-strip-row {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      height: ${MERCHANT_STRIP_MAIN_HEIGHT_PX}px;
      min-height: ${MERCHANT_STRIP_MAIN_HEIGHT_PX}px;
      max-height: ${MERCHANT_STRIP_MAIN_HEIGHT_PX}px;
      box-sizing: border-box;
      padding: 0 12px;
      flex-shrink: 0;
    }

    .pc-merchant-dock-target-row {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      box-sizing: border-box;
      padding: 0 12px 6px;
      border-top: 1px solid #f3f4f6;
      flex-shrink: 0;
      min-height: 0;
    }

    .pc-merchant-dock-target-label {
      font-size: 10px;
      font-weight: 600;
      color: #6b7280;
      white-space: nowrap;
      flex-shrink: 0;
      user-select: none;
    }

    .pc-merchant-dock-target-options {
      display: flex;
      align-items: center;
      gap: 4px;
      flex: 1;
      min-width: 0;
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: thin;
    }

    .pc-merchant-dock-target-btn {
      display: inline-flex;
      align-items: center;
      height: 22px;
      padding: 0 8px;
      border: 1px solid #d1d5db;
      border-radius: 999px;
      background: #f9fafb;
      color: #374151;
      font: inherit;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }

    .pc-merchant-dock-target-btn:hover {
      background: #f3f4f6;
      border-color: #9ca3af;
    }

    .pc-merchant-dock-target-btn:focus-visible {
      outline: 2px solid #f59e0b;
      outline-offset: 1px;
    }

    .pc-merchant-dock-target-btn[aria-pressed="true"] {
      border-color: #86efac;
      background: #ecfdf5;
      color: #166534;
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
      max-width: 160px;
      user-select: none;
      flex-shrink: 0;
      min-width: 0;
    }

    .pc-merchant-strip:has(.pc-merchant-pulse[data-pulse="live"]) .pc-merchant-pulse-label {
      color: #166534;
      font-weight: 600;
    }

    .pc-merchant-strip-row:has(.pc-merchant-pulse[data-pulse="live"]) .pc-merchant-pulse-label {
      color: #166534;
      font-weight: 600;
    }

    .pc-merchant-strip:has(.pc-merchant-pulse[data-pulse="expiring"]) .pc-merchant-pulse-label {
      color: #92400e;
      font-weight: 600;
    }

    .pc-merchant-strip-row:has(.pc-merchant-pulse[data-pulse="expiring"]) .pc-merchant-pulse-label {
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

    .pc-merchant-btn[data-action="merchant-one-shot-paste"] {
      border-color: #86efac;
      background: #ecfdf5;
      color: #166534;
    }

    .pc-merchant-btn[data-action="merchant-one-shot-paste"]:hover {
      background: #d1fae5;
      border-color: #22c55e;
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
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: thin;
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

    .pc-merchant-btn[data-action$="-queue-toggle"].is-active,
    .pc-merchant-btn[data-action$="-queue-toggle"][aria-pressed="true"] {
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

    .pc-merchant-snippet-wrap {
      position: relative;
      display: inline-flex;
      flex-shrink: 0;
    }

    .pc-merchant-snippet-menu {
      position: fixed;
      top: 0;
      left: 0;
      z-index: 2147483646;
      min-width: 220px;
      max-width: 280px;
      max-height: 320px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 6px;
      border-radius: 8px;
      border: 1px solid #7dd3fc;
      background: #ffffff;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
    }

    .pc-merchant-snippet-menu[hidden] {
      display: none !important;
    }

    .pc-merchant-snippet-header {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      flex-shrink: 0;
      padding: 2px 2px 6px;
      margin-bottom: 2px;
      border-bottom: 1px solid #e0f2fe;
    }

    .pc-merchant-snippet-label {
      font-size: 10px;
      font-weight: 600;
      color: #0369a1;
      background: #e0f2fe;
      padding: 3px 8px;
      border-radius: 999px;
      white-space: nowrap;
      user-select: none;
      line-height: 1.2;
    }

    .pc-merchant-snippet-row {
      display: flex;
      align-items: center;
      margin: 0 0 4px;
      border-radius: 6px;
    }

    .pc-merchant-snippet-row:last-child {
      margin-bottom: 0;
    }

    .pc-merchant-snippet-row:hover {
      background: #f0f9ff;
    }

    .pc-merchant-snippet-item {
      flex: 1 1 auto;
      min-width: 0;
      display: block;
      box-sizing: border-box;
      padding: 8px 4px 8px 10px;
      margin: 0;
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

    .pc-merchant-snippet-item-label {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pc-merchant-snippet-delete {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      padding: 0;
      margin: 0 4px 0 0;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: #64748b;
      font-size: 16px;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      opacity: 1;
      transition: color 0.15s ease, background 0.15s ease;
    }

    .pc-merchant-snippet-delete:hover {
      color: #dc2626;
      background: #fef2f2;
    }

    .pc-merchant-snippet-empty {
      margin: 0;
      padding: 8px;
      font-size: 11px;
      color: #64748b;
    }

    .pc-merchant-snippet-list {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      padding: 2px 0 4px;
      margin-bottom: 6px;
    }

    .pc-merchant-snippet-add {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-top: 6px;
      border-top: 1px solid #e0f2fe;
    }

    .pc-merchant-snippet-input {
      box-sizing: border-box;
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #bae6fd;
      border-radius: 6px;
      font: inherit;
      font-size: 11px;
      line-height: 1.35;
      color: #0f172a;
      resize: vertical;
      min-height: 44px;
    }

    .pc-merchant-snippet-input:focus {
      outline: none;
      border-color: #0284c7;
      box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15);
    }

    .pc-merchant-snippet-save {
      align-self: flex-end;
      padding: 5px 12px;
      border: 1px solid #0284c7;
      border-radius: 6px;
      background: #0284c7;
      color: #ffffff;
      font: inherit;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }

    .pc-merchant-snippet-save:hover {
      background: #0369a1;
      border-color: #0369a1;
    }

    .pc-merchant-hint {
      margin-left: auto;
      flex-shrink: 0;
      max-width: min(280px, 38vw);
      min-width: 72px;
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
