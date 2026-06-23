import { MERCHANT_STRIP_HEIGHT_PX } from './merchant.constants.js';

export function getMerchantDockStyles() {
  return `
    .pc-merchant-dock-panel {
      position: fixed;
      top: calc(${MERCHANT_STRIP_HEIGHT_PX}px + 8px);
      right: 12px;
      width: min(360px, calc(100vw - 24px));
      max-height: calc(100vh - ${MERCHANT_STRIP_HEIGHT_PX + 24}px);
      overflow: auto;
      box-sizing: border-box;
      padding: 14px;
      border-radius: 10px;
      border: 1px solid #fcd34d;
      background: #fffbeb;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      color: #1f2937;
      pointer-events: auto;
      z-index: 2147483645;
    }

    .pc-merchant-dock-panel[hidden] {
      display: none !important;
    }

    .pc-merchant-dock-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }

    .pc-merchant-dock-title {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: #92400e;
    }

    .pc-merchant-dock-warning {
      margin: 0 0 12px;
      padding: 8px 10px;
      border-radius: 6px;
      background: #fef3c7;
      border: 1px solid #fcd34d;
      font-size: 11px;
      line-height: 1.4;
      color: #78350f;
    }

    .pc-merchant-dock-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 10px;
    }

    .pc-merchant-dock-field span {
      font-size: 11px;
      font-weight: 600;
      color: #374151;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .pc-merchant-dock-field-primary span {
      font-size: 12px;
      color: #92400e;
    }

    .pc-merchant-dock-hint {
      font-style: normal;
      font-weight: 500;
      text-transform: none;
      letter-spacing: 0;
      color: #b45309;
      margin-left: 4px;
    }

    .pc-merchant-dock-field-primary input {
      font-size: 14px;
      font-weight: 500;
      padding: 10px 12px;
      border-color: #f59e0b;
    }

    .pc-merchant-dock-field input,
    .pc-merchant-dock-field textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 8px 10px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: #ffffff;
      font: inherit;
      color: #111827;
      resize: vertical;
    }

    .pc-merchant-dock-field textarea {
      min-height: 72px;
    }

    .pc-merchant-dock-field input:focus,
    .pc-merchant-dock-field textarea:focus {
      outline: 2px solid #f59e0b;
      outline-offset: 1px;
      border-color: #f59e0b;
    }

    .pc-merchant-dock-meta {
      margin: 0 0 10px;
      font-size: 10px;
      color: #6b7280;
    }

    .pc-merchant-dock-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .pc-merchant-dock-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 28px;
      padding: 0 10px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: #f9fafb;
      color: #374151;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      flex-shrink: 0;
    }

    .pc-merchant-dock-btn:hover {
      background: #f3f4f6;
    }

    .pc-merchant-dock-btn:focus-visible {
      outline: 2px solid #f59e0b;
      outline-offset: 1px;
    }

    .pc-merchant-dock-btn-primary {
      border-color: #86efac;
      background: #ecfdf5;
      color: #166534;
    }

    .pc-merchant-dock-btn-primary:hover {
      background: #d1fae5;
    }

    .pc-merchant-dock-btn-danger {
      border-color: #fca5a5;
      background: #fef2f2;
      color: #991b1b;
    }

    .pc-merchant-dock-btn-danger:hover {
      background: #fee2e2;
    }

    .pc-merchant-dock-btn-muted {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .pc-merchant-dock-tag-preview {
      margin: -4px 0 10px;
      padding: 8px;
      border-radius: 6px;
      background: #fff;
      border: 1px solid #fde68a;
    }

    .pc-merchant-dock-tag-preview-head {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 6px;
      font-size: 11px;
      font-weight: 700;
      color: #6b7280;
    }

    .pc-merchant-tag-count-warn {
      color: #b45309;
    }

    .pc-merchant-tag-count-error {
      color: #dc2626;
    }

    .pc-merchant-dock-tag-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .pc-merchant-tag-chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.5;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pc-merchant-tag-chip-valid {
      background: #ecfdf5;
      color: #166534;
      border: 1px solid #86efac;
    }

    .pc-merchant-tag-chip-invalid {
      background: #fef2f2;
      color: #991b1b;
      border: 1px solid #fca5a5;
    }

    .pc-merchant-tag-chip-duplicate {
      background: #f3f4f6;
      color: #6b7280;
      border: 1px solid #d1d5db;
      text-decoration: line-through;
    }

    .pc-merchant-tag-chip-over {
      background: #fff7ed;
      color: #c2410c;
      border: 1px solid #fdba74;
    }

    .pc-merchant-dock-tag-warnings {
      margin: 6px 0 0;
      padding-left: 16px;
      font-size: 10px;
      color: #b45309;
      line-height: 1.4;
    }

    .pc-merchant-dock-advanced {
      margin-bottom: 10px;
      border: 1px dashed #d1d5db;
      border-radius: 6px;
      padding: 0 8px 4px;
      background: #fafafa;
    }

    .pc-merchant-dock-advanced summary {
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      padding: 8px 0;
      list-style: none;
    }

    .pc-merchant-dock-advanced summary::-webkit-details-marker {
      display: none;
    }

    .pc-merchant-dock-advanced summary::before {
      content: '▸ ';
    }

    .pc-merchant-dock-advanced[open] summary::before {
      content: '▾ ';
    }
  `;
}
