/** @forward-slice — Quick Paste shadow-DOM stylesheet injector (no behavior). */

import { QP_HOST } from './qp.constants.js';

export function addQuickPasteStyles(root) {
  if (!root) return;
  const styleField = QP_HOST.STYLE_FIELD;
  const existingStyles = root.querySelector(`[data-field="${styleField}"]`);
  if (existingStyles) {
    existingStyles.remove();
  }
  
  const styles = document.createElement('style');
  styles.setAttribute('data-field', styleField);
  styles.textContent = `
    /* Premium blue tokens (mirror assets/styles/tokens.css — Shadow DOM safe) */
    .pastecraft-quick-paste,
    .pastecraft-interface {
      --qp-primary-900: #05080f;
      --qp-primary-800: #0a0e14;
      --qp-primary-700: #0b1220;
      --qp-primary-600: #1e3a8a;
      --qp-primary-500: #1d4ed8;
      --qp-secondary-500: #2563eb;
      --qp-secondary-400: #3b82f6;
      --qp-secondary-300: #60a5fa;
      --qp-secondary-200: #93c5fd;
      --qp-secondary-100: #dbeafe;
      --qp-secondary-50: #eff6ff;
      --qp-surface: #f8fafc;
      --qp-surface-2: #f1f5f9;
      --qp-border: #e2e8f0;
      --qp-text: #1f2937;
      --qp-text-muted: #64748b;
      --qp-gradient-header: linear-gradient(135deg, #0d1240 0%, #1a1f5e 48%, #2563eb 100%);
      --qp-gradient-accent: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      --qp-shadow-brand: 0 4px 18px rgba(37, 99, 235, 0.28);
      --qp-shadow-panel: 4px 0 48px rgba(13, 18, 64, 0.28);
    }

    .pastecraft-quick-paste {
      position: fixed;
      top: 50%;
      left: 0;
      transform: translateY(-50%);
      width: 320px;
      max-height: 600px;
      background: #ffffff;
      border-radius: 0 12px 12px 0;
      box-shadow: var(--qp-shadow-panel);
      border: 1px solid var(--qp-border);
      border-left: 3px solid var(--qp-secondary-500);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 999999;
      overflow: hidden;
      overflow-x: hidden;
      animation: pastecraft-slide-in 0.3s ease;
      opacity: 1;
    }
    
    @keyframes pastecraft-slide-in {
      from { transform: translate(-100%, -50%); opacity: 0; }
      to { transform: translate(0, -50%); opacity: 1; }
    }
    
    .pastecraft-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: var(--qp-gradient-header);
      color: white;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.01em;
      box-shadow: 0 2px 12px rgba(13, 18, 64, 0.22);
      border-bottom: 1px solid rgba(147, 197, 253, 0.25);
    }
    
    .pastecraft-logo {
      display: flex;
      align-items: center;
      gap: 6px;
      text-shadow: 0 1px 2px rgba(8, 12, 42, 0.35);
    }
    
    .pastecraft-controls {
      display: flex;
      gap: 4px;
    }
    
    .pastecraft-btn {
      background: rgba(255, 255, 255, 0.14);
      border: 1px solid rgba(255, 255, 255, 0.22);
      border-radius: 6px;
      padding: 4px 8px;
      color: white;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
    }
    
    .pastecraft-btn:hover {
      background: rgba(255, 255, 255, 0.28);
      border-color: rgba(255, 255, 255, 0.4);
      box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.35);
    }
    
    .pastecraft-content {
      max-height: 400px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      position: relative;
      background: #ffffff;
    }
    
    .pastecraft-clips-container {
      padding: 8px;
      flex: 1;
      overflow-y: auto;
    }
    
    .pastecraft-clip {
      display: flex;
      align-items: center;
      padding: 10px;
      margin: 4px 0;
      background: var(--qp-surface);
      border: 1px solid var(--qp-border);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .pastecraft-clip:hover {
      background: var(--qp-secondary-50);
      border-color: var(--qp-secondary-400);
      box-shadow: 0 2px 10px rgba(37, 99, 235, 0.12);
      transform: translateX(2px);
    }
    
    .pastecraft-clip-content {
      flex: 1;
      min-width: 0;
    }
    
    .pastecraft-clip-text {
      font-size: 13px;
      color: var(--qp-text);
      margin-bottom: 4px;
      word-break: break-word;
    }
    
    .pastecraft-clip-meta {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--qp-text-muted);
    }
    
    .pastecraft-category {
      background: var(--qp-secondary-100);
      color: var(--qp-primary-600);
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
    }
    
    .pastecraft-clip-actions {
      margin-left: 8px;
    }

    .pastecraft-btn > svg,
    .pastecraft-btn > svg *,
    .pastecraft-btn > img,
    .pastecraft-btn > span,
    .pastecraft-clip-actions button > svg,
    .pastecraft-clip-actions button > svg *,
    .pastecraft-clip-actions button > img,
    .pastecraft-clip-actions button > span {
      pointer-events: none;
    }
    
    .pastecraft-paste {
      background: var(--qp-gradient-accent) !important;
      color: white !important;
      padding: 6px !important;
      border-radius: 6px !important;
      border: 1px solid var(--qp-primary-700) !important;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3) !important;
    }
    
    .pastecraft-paste:hover {
      background: linear-gradient(135deg, var(--qp-secondary-500) 0%, var(--qp-primary-500) 100%) !important;
      box-shadow: 0 3px 10px rgba(37, 99, 235, 0.42) !important;
    }
    
    .pastecraft-empty {
      text-align: center;
      padding: 40px 20px;
      color: #6b7280;
    }
    
    .pastecraft-empty-icon {
      font-size: 24px;
      margin-bottom: 8px;
    }
    
    /* Settings Modal Styles */
    .pastecraft-settings-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1000001;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .pastecraft-modal-backdrop {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
    }
    
    .pastecraft-modal-content {
      position: relative;
      background: white;
      border-radius: 12px;
      width: 400px;
      max-width: 90vw;
      max-height: 80vh;
      overflow: hidden;
      border: 1px solid #dbeafe;
      box-shadow: 0 20px 60px rgba(13, 18, 64, 0.28), 0 0 0 1px rgba(37, 99, 235, 0.08);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .pastecraft-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid #dbeafe;
      background: linear-gradient(135deg, #0d1240 0%, #1a1f5e 48%, #2563eb 100%);
      color: #fff;
    }
    
    .pastecraft-modal-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #fff;
      text-shadow: 0 1px 2px rgba(8, 12, 42, 0.35);
    }
    
    .pastecraft-modal-close {
      background: rgba(255, 255, 255, 0.14);
      border: 1px solid rgba(255, 255, 255, 0.22);
      font-size: 20px;
      cursor: pointer;
      color: #fff;
      padding: 4px 8px;
      border-radius: 6px;
    }
    
    .pastecraft-modal-close:hover {
      background: rgba(255, 255, 255, 0.28);
      color: #fff;
    }
    
    /* Help Modal Styles - Force proper centering */
    .pastecraft-help-modal {
      display: none;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      z-index: 1000002 !important;
      justify-content: center !important;
      align-items: center !important;
      background: rgba(0, 0, 0, 0.5) !important;
    }
    
    .pastecraft-help-modal .pastecraft-modal-backdrop {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background: rgba(0, 0, 0, 0.5) !important;
    }
    
    .pastecraft-help-modal .pastecraft-modal-content {
      position: relative !important;
      background: white !important;
      border-radius: 12px !important;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3) !important;
      max-width: 600px !important;
      max-height: 80vh !important;
      width: 90% !important;
      overflow: hidden !important;
      display: flex !important;
      flex-direction: column !important;
      margin: auto !important;
    }
    
    .pastecraft-modal-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    
    .pastecraft-help-btn, .pastecraft-back-btn {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: #fff;
      border: 1px solid #1a1f5e;
      border-radius: 8px;
      padding: 0;
      font-size: 16px;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      min-width: 36px;
      height: 36px;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35);
    }

    .pastecraft-help-btn-glyph {
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 18px;
      font-weight: 700;
      pointer-events: none;
      text-shadow: 0 1px 1px rgba(8, 12, 42, 0.35);
    }
    
    .pastecraft-help-btn:hover, .pastecraft-back-btn:hover {
      background: linear-gradient(135deg, #60a5fa 0%, #2563eb 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.45);
    }

    .pastecraft-help-btn.active,
    .pastecraft-help-btn[aria-expanded="true"] {
      background: linear-gradient(135deg, #1d4ed8 0%, #1a1f5e 100%);
      box-shadow: 0 0 0 2px rgba(147, 197, 253, 0.55), 0 4px 12px rgba(37, 99, 235, 0.45);
    }

    .pastecraft-help-modal.is-open {
      z-index: 1000003 !important;
    }
    
    .help-content {
      padding: 20px !important;
      color: #374151 !important;
    }
    
    .help-section {
      margin-bottom: 24px;
    }
    
    .help-section h4 {
      color: #1f2937 !important;
      margin-bottom: 12px;
      font-size: 16px;
      font-weight: 600;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 8px;
    }
    
    .help-item {
      margin-bottom: 12px;
      padding: 12px;
      background: #f8fafc;
      border-radius: 8px;
      border-left: 4px solid #2563eb;
      line-height: 1.5;
      color: #374151 !important;
    }
    
    .help-item strong {
      color: #1f2937 !important;
      font-weight: 600 !important;
    }
    
    .help-item ul {
      margin: 8px 0 0 20px;
      color: #374151 !important;
    }
    
    .help-item li {
      margin-bottom: 4px;
      color: #374151 !important;
    }
    
    .pastecraft-modal-body {
      padding: 0;
      max-height: 60vh;
      overflow-y: auto;
    }
    
    .pastecraft-setting {
      padding: 20px 24px;
      border-bottom: 1px solid #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 60px;
    }
    
    .pastecraft-setting:last-child {
      border-bottom: none;
    }
    
    .pastecraft-setting label {
      font-weight: 500;
      color: #374151;
      font-size: 14px;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .pastecraft-setting select,
    .pastecraft-setting input[type="number"] {
      padding: 8px 12px;
      border: 1.5px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      background: white;
      color: #374151;
      transition: all 0.2s ease;
      min-width: 120px;
    }
    
    .pastecraft-setting select:focus,
    .pastecraft-setting input[type="number"]:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
    }
    
    .pastecraft-setting input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: #2563eb;
      cursor: pointer;
    }
    
    
    .pastecraft-modal-actions {
      display: flex;
      gap: 12px;
      padding: 24px;
      background: #f8fafc;
      border-top: 1px solid #f1f5f9;
      justify-content: flex-end;
    }
    
    .pastecraft-btn-secondary {
      background: white;
      color: #6b7280;
      border: 1.5px solid #d1d5db;
      border-radius: 8px;
      padding: 12px 20px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
    }
    
    .pastecraft-btn-secondary:hover {
      background: #f9fafb;
      border-color: #9ca3af;
      color: #374151;
    }
    
    .pastecraft-btn-primary {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 55%, #1a1f5e 100%);
      color: white;
      border: 1px solid #1a1f5e;
      border-radius: 8px;
      padding: 12px 24px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.28);
    }
    
    .pastecraft-btn-primary:hover {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 55%, #0d1240 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(26, 31, 94, 0.35);
    }
    
    .pastecraft-btn-danger {
      background: #ef4444;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 10px 16px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }
    
    .pastecraft-btn-danger:hover {
      background: #dc2626;
    }
    
    /* Settings Modal - Delimiter and Options Styles */
    .pastecraft-setting-group {
      margin: 0;
      padding: 24px;
      border-bottom: 1px solid #f3f4f6;
      background: white;
    }
    
    .pastecraft-setting-group:last-child {
      border-bottom: none;
    }
    
    .pastecraft-setting-label {
      display: block;
      font-weight: 600;
      margin-bottom: 16px;
      color: #1f2937;
      font-size: 15px;
      letter-spacing: -0.025em;
    }
    
    .pastecraft-segmented-control {
      display: flex;
      background: #f3f4f6;
      border-radius: 10px;
      padding: 4px;
      gap: 2px;
    }
    
    .pastecraft-segment-btn {
      flex: 1;
      padding: 10px 16px;
      border: none;
      background: transparent;
      color: #6b7280;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      border-radius: 6px;
      transition: all 0.2s ease;
    }
    
    .pastecraft-segment-btn.active {
      background: white;
      color: #1f2937;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    
    .pastecraft-segment-btn:hover:not(.active) {
      background: rgba(255, 255, 255, 0.5);
      color: #374151;
    }
    
    .pastecraft-toggles {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .pastecraft-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      padding: 12px 16px;
      background: #f8fafc;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      transition: all 0.2s ease;
    }
    
    .pastecraft-toggle:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }
    
    .pastecraft-toggle input[type="checkbox"] {
      display: none;
    }
    
    .pastecraft-toggle-switch {
      width: 44px;
      height: 24px;
      background: #cbd5e1;
      border-radius: 12px;
      position: relative;
      transition: all 0.3s ease;
      flex-shrink: 0;
    }
    
    .pastecraft-toggle-switch::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      background: white;
      border-radius: 50%;
      transition: all 0.3s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .pastecraft-toggle input:checked + .pastecraft-toggle-switch {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
    }
    
    .pastecraft-toggle input:checked + .pastecraft-toggle-switch::after {
      transform: translateX(20px);
    }
    
    .pastecraft-toggle span {
      font-weight: 500;
      color: #374151;
      font-size: 14px;
    }
    
    /* Custom delimiter input styling */
    #quickPasteCustomDelimiter {
      margin-top: 12px !important;
      padding: 10px 14px !important;
      border: 1.5px solid #d1d5db !important;
      border-radius: 8px !important;
      font-size: 14px !important;
      background: white !important;
      color: #374151 !important;
      transition: all 0.2s ease !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }
    
    #quickPasteCustomDelimiter:focus {
      outline: none !important;
      border-color: #2563eb !important;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15) !important;
    }
    
    #quickPasteCustomDelimiter::placeholder {
      color: #9ca3af !important;
      font-style: italic !important;
    }
    
    
    .pastecraft-interface.dark .pastecraft-setting-group,
    .pastecraft-interface.blue .pastecraft-setting-group {
      background: #111827;
      border-color: #1e3a8a;
    }
    
    .pastecraft-interface.dark .pastecraft-setting-label,
    .pastecraft-interface.blue .pastecraft-setting-label {
      color: #f8fafc;
    }
    
    .pastecraft-interface.dark .pastecraft-segment-btn,
    .pastecraft-interface.blue .pastecraft-segment-btn {
      background: #0b1220;
      color: #94a3b8;
      border-color: #1e3a8a;
    }
    
    .pastecraft-interface.dark .pastecraft-segment-btn:hover:not(.active),
    .pastecraft-interface.blue .pastecraft-segment-btn:hover:not(.active) {
      background: #1e3a8a;
      color: #e0f2fe;
    }
    
    /* Confirmation modal uses same styles as settings modal */
    .pastecraft-confirm-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1000002;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    /* Blue Dark Mode (popup parity) — opaque navy glass, no page bleed-through */
    .pastecraft-interface.blue,
    .pastecraft-interface.dark {
      --qp-surface: #0b1220;
      --qp-surface-2: #111827;
      --qp-border: #1e3a8a;
      --qp-text: #f8fafc;
      --qp-text-muted: #94a3b8;
      --qp-secondary-100: rgba(59, 130, 246, 0.22);
      --qp-secondary-50: #111827;
      --qp-gradient-header: linear-gradient(135deg, #05080f 0%, #0b1220 42%, #1e3a8a 78%, #2563eb 100%);
      --qp-shadow-panel: 4px 0 40px rgba(37, 99, 235, 0.35);
      background: #0a0e14 !important;
      border-color: #1e3a8a !important;
      border-left-color: #3b82f6 !important;
      color: #f8fafc !important;
      opacity: 1 !important;
      box-shadow: var(--qp-shadow-panel) !important;
    }

    .pastecraft-interface.blue .pastecraft-header,
    .pastecraft-interface.dark .pastecraft-header {
      background: var(--qp-gradient-header) !important;
      border-bottom: 1px solid rgba(59, 130, 246, 0.45) !important;
      box-shadow: 0 4px 20px rgba(37, 99, 235, 0.35) !important;
      color: #fff !important;
    }

    .pastecraft-interface.blue .pastecraft-btn,
    .pastecraft-interface.dark .pastecraft-btn {
      background: rgba(59, 130, 246, 0.18) !important;
      border: 1px solid rgba(59, 130, 246, 0.4) !important;
      color: #fff !important;
    }

    .pastecraft-interface.blue .pastecraft-btn:hover,
    .pastecraft-interface.dark .pastecraft-btn:hover {
      background: rgba(59, 130, 246, 0.35) !important;
      border-color: #60a5fa !important;
    }

    .pastecraft-interface.blue .pastecraft-content,
    .pastecraft-interface.dark .pastecraft-content,
    .pastecraft-interface.blue .pastecraft-clips-container,
    .pastecraft-interface.dark .pastecraft-clips-container {
      background: #0a0e14 !important;
      opacity: 1 !important;
    }
    
    .pastecraft-interface.blue .pastecraft-clip,
    .pastecraft-interface.dark .pastecraft-clip {
      background: #0b1220 !important;
      border: 1px solid #1e3a8a !important;
      color: #f8fafc !important;
      opacity: 1 !important;
    }
    
    .pastecraft-interface.blue .pastecraft-clip:hover,
    .pastecraft-interface.dark .pastecraft-clip:hover {
      background: #111827 !important;
      border-color: #3b82f6 !important;
      box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.35), 0 4px 14px rgba(37, 99, 235, 0.25) !important;
    }
    
    .pastecraft-interface.blue .pastecraft-clip-text,
    .pastecraft-interface.dark .pastecraft-clip-text {
      color: #f8fafc !important;
    }
    
    .pastecraft-interface.blue .pastecraft-clip-meta,
    .pastecraft-interface.dark .pastecraft-clip-meta,
    .pastecraft-interface.blue .pastecraft-time,
    .pastecraft-interface.dark .pastecraft-time,
    .pastecraft-interface.blue .pastecraft-count,
    .pastecraft-interface.dark .pastecraft-count,
    .pastecraft-interface.blue .pastecraft-empty,
    .pastecraft-interface.dark .pastecraft-empty {
      color: #94a3b8 !important;
    }

    .pastecraft-interface.blue .pastecraft-category,
    .pastecraft-interface.dark .pastecraft-category {
      background: rgba(37, 99, 235, 0.25) !important;
      color: #93c5fd !important;
      border: 1px solid rgba(59, 130, 246, 0.35);
    }

    .pastecraft-interface.blue .pastecraft-footer,
    .pastecraft-interface.dark .pastecraft-footer {
      background: #0b1220 !important;
      border-top: 2px solid #1e3a8a !important;
      color: #94a3b8 !important;
      box-shadow: 0 -8px 24px rgba(5, 8, 15, 0.65) !important;
      backdrop-filter: none !important;
      opacity: 1 !important;
    }

    .pastecraft-interface.blue .pastecraft-content::-webkit-scrollbar-track,
    .pastecraft-interface.dark .pastecraft-content::-webkit-scrollbar-track {
      background: #0b1220;
    }

    .pastecraft-interface.blue .pastecraft-content::-webkit-scrollbar-thumb,
    .pastecraft-interface.dark .pastecraft-content::-webkit-scrollbar-thumb {
      background: #1e3a8a;
    }

    .pastecraft-interface.blue .pastecraft-content::-webkit-scrollbar-thumb:hover,
    .pastecraft-interface.dark .pastecraft-content::-webkit-scrollbar-thumb:hover {
      background: #3b82f6;
    }

    .pastecraft-interface.blue .pastecraft-paste,
    .pastecraft-interface.dark .pastecraft-paste {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
      border-color: #1e3a8a !important;
    }

    .pastecraft-interface.blue .pastecraft-copy-multiple:not(:disabled),
    .pastecraft-interface.dark .pastecraft-copy-multiple:not(:disabled) {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 55%, #1a1f5e 100%) !important;
      border-color: #3b82f6 !important;
      color: #fff !important;
    }

    .pastecraft-interface.blue .pastecraft-copy-multiple:disabled,
    .pastecraft-interface.dark .pastecraft-copy-multiple:disabled {
      background: #111827 !important;
      color: #64748b !important;
      border-color: #1e3a8a !important;
    }

    /* Settings / Help / Confirm — Blue Dark Mode (popup modal parity) */
    .pastecraft-settings-modal.blue,
    .pastecraft-help-modal.blue,
    .pastecraft-confirm-modal.blue {
      --qp-surface: #0b1220;
      --qp-border: #1e3a8a;
      --qp-text: #f8fafc;
      --qp-text-muted: #94a3b8;
    }

    .pastecraft-settings-modal.blue .pastecraft-modal-backdrop,
    .pastecraft-help-modal.blue .pastecraft-modal-backdrop,
    .pastecraft-confirm-modal.blue .pastecraft-modal-backdrop {
      background: rgba(5, 8, 15, 0.82) !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-modal-content,
    .pastecraft-help-modal.blue .pastecraft-modal-content,
    .pastecraft-confirm-modal.blue .pastecraft-modal-content {
      background:
        radial-gradient(ellipse 110% 60% at 50% -20%, rgba(37, 99, 235, 0.18), transparent 55%),
        #0b1220 !important;
      border: 1px solid rgba(59, 130, 246, 0.4) !important;
      color: #f8fafc !important;
      box-shadow:
        0 20px 40px rgba(0, 0, 0, 0.6),
        0 0 0 1px rgba(30, 58, 138, 0.45),
        inset 0 1px 0 rgba(96, 165, 250, 0.08) !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-modal-header,
    .pastecraft-help-modal.blue .pastecraft-modal-header,
    .pastecraft-confirm-modal.blue .pastecraft-modal-header {
      background: linear-gradient(135deg, #05080f 0%, #0b1220 42%, #1e3a8a 78%, #2563eb 100%) !important;
      border-bottom: 1px solid rgba(59, 130, 246, 0.35) !important;
      box-shadow: 0 4px 18px rgba(37, 99, 235, 0.35) !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-modal-header h3,
    .pastecraft-help-modal.blue .pastecraft-modal-header h3,
    .pastecraft-confirm-modal.blue .pastecraft-modal-header h3 {
      color: #fff !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-modal-close,
    .pastecraft-help-modal.blue .pastecraft-modal-close {
      background: rgba(59, 130, 246, 0.18) !important;
      border: 1px solid rgba(59, 130, 246, 0.4) !important;
      color: #e0f2fe !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-modal-close:hover,
    .pastecraft-help-modal.blue .pastecraft-modal-close:hover {
      background: rgba(59, 130, 246, 0.35) !important;
      color: #fff !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-modal-body,
    .pastecraft-help-modal.blue .help-content {
      background: transparent !important;
      color: #f8fafc !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-setting {
      border-bottom-color: #1e3a8a !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-setting label {
      color: #e2e8f0 !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-setting select,
    .pastecraft-settings-modal.blue .pastecraft-setting input[type="number"],
    .pastecraft-settings-modal.blue #quickPasteCustomDelimiter {
      background: #111827 !important;
      border: 1.5px solid #1e3a8a !important;
      color: #f8fafc !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-setting select:focus,
    .pastecraft-settings-modal.blue .pastecraft-setting input[type="number"]:focus,
    .pastecraft-settings-modal.blue #quickPasteCustomDelimiter:focus {
      border-color: #3b82f6 !important;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.25) !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-setting input[type="checkbox"] {
      accent-color: #3b82f6 !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-setting-group {
      background: transparent !important;
      border-bottom-color: #1e3a8a !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-setting-label {
      color: #93c5fd !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-segmented-control {
      background: #111827 !important;
      border: 1px solid #1e3a8a;
    }

    .pastecraft-settings-modal.blue .pastecraft-segment-btn {
      color: #94a3b8 !important;
      background: transparent !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-segment-btn:hover:not(.active) {
      background: rgba(59, 130, 246, 0.15) !important;
      color: #e0f2fe !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-segment-btn.active {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
      color: #fff !important;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35) !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-toggle {
      background: #111827 !important;
      border: 1px solid #1e3a8a !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-toggle:hover {
      background: #0b1220 !important;
      border-color: #3b82f6 !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-toggle span {
      color: #e2e8f0 !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-toggle-switch {
      background: #334155 !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-toggle input:checked + .pastecraft-toggle-switch {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25);
    }

    .pastecraft-settings-modal.blue .pastecraft-modal-content > .pastecraft-modal-actions,
    .pastecraft-help-modal.blue .pastecraft-modal-content > .pastecraft-modal-actions,
    .pastecraft-confirm-modal.blue .pastecraft-modal-content > .pastecraft-modal-actions {
      background: #0a0e14 !important;
      border-top: 1px solid #1e3a8a !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-modal-header .pastecraft-modal-actions,
    .pastecraft-help-modal.blue .pastecraft-modal-header .pastecraft-modal-actions {
      background: transparent !important;
      border-top: none !important;
      padding: 0 !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-btn-secondary,
    .pastecraft-confirm-modal.blue .pastecraft-btn-secondary {
      background: #111827 !important;
      color: #94a3b8 !important;
      border: 1.5px solid #1e3a8a !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-btn-secondary:hover,
    .pastecraft-confirm-modal.blue .pastecraft-btn-secondary:hover {
      background: #0b1220 !important;
      border-color: #3b82f6 !important;
      color: #e0f2fe !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-btn-primary,
    .pastecraft-help-modal.blue .pastecraft-btn-primary,
    .pastecraft-confirm-modal.blue .pastecraft-btn-primary {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 55%, #1a1f5e 100%) !important;
      border: 1px solid #3b82f6 !important;
      box-shadow: 0 2px 10px rgba(37, 99, 235, 0.4) !important;
    }

    .pastecraft-help-modal.blue {
      background: rgba(5, 8, 15, 0.82) !important;
      z-index: 1000003 !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-help-btn {
      background: rgba(59, 130, 246, 0.22) !important;
      border: 1px solid rgba(147, 197, 253, 0.55) !important;
      color: #fff !important;
      box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.25), 0 2px 8px rgba(37, 99, 235, 0.35) !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-help-btn:hover,
    .pastecraft-settings-modal.blue .pastecraft-help-btn.active {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
      border-color: #93c5fd !important;
    }

    .pastecraft-settings-modal.blue .pastecraft-help-btn-glyph {
      color: #fff !important;
    }

    .pastecraft-help-modal.blue .help-section h4 {
      color: #93c5fd !important;
      border-bottom-color: #1e3a8a !important;
    }

    .pastecraft-help-modal.blue .help-item {
      background: #111827 !important;
      border-left-color: #3b82f6 !important;
      color: #e2e8f0 !important;
    }

    .pastecraft-help-modal.blue .help-item strong,
    .pastecraft-help-modal.blue .help-item ul,
    .pastecraft-help-modal.blue .help-item li {
      color: #f8fafc !important;
    }

    .pastecraft-confirm-modal.blue .pastecraft-modal-body {
      color: #e2e8f0 !important;
      background: #0b1220 !important;
      padding: 20px 24px;
    }

    .pastecraft-confirm-modal.blue .pastecraft-modal-body strong {
      color: #fca5a5 !important;
    }

    .pastecraft-footer {
      position: sticky !important;
      bottom: 0 !important;
      z-index: 1000 !important;
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      padding: 12px 16px !important;
      background: #f8fafc !important;
      border-top: 2px solid #dbeafe !important;
      font-size: 12px !important;
      color: #64748b !important;
      box-shadow: 0 -6px 20px rgba(13, 18, 64, 0.1) !important;
      flex-wrap: nowrap !important;
      gap: 12px !important;
      margin: 0 !important;
      flex-shrink: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      left: 0 !important;
      overflow: hidden !important;
      min-width: 0 !important;
      right: 0 !important;
      box-sizing: border-box !important;
    }
    
    .pastecraft-count {
      font-weight: 500;
    }
    
    /* Custom scrollbar */
    .pastecraft-content::-webkit-scrollbar {
      width: 6px;
    }
    
    .pastecraft-content::-webkit-scrollbar-track {
      background: #eff6ff;
    }
    
    .pastecraft-content::-webkit-scrollbar-thumb {
      background: #93c5fd;
      border-radius: 3px;
    }
    
    .pastecraft-content::-webkit-scrollbar-thumb:hover {
      background: #60a5fa;
    }
    
    /* Delete button styling */
    .pastecraft-delete {
      background: #ef4444 !important;
      color: white !important;
      font-size: 16px !important;
      padding: 4px 8px !important;
      border-radius: 4px !important;
      margin-left: 4px !important;
    }
    
    .pastecraft-delete:hover {
      background: #dc2626 !important;
      transform: scale(1.1);
    }
    
    /* Multi-select functionality - NUCLEAR SPECIFICITY */
    .pastecraft-interface.pastecraft-interface .pastecraft-clip.selected.selected {
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%) !important;
      color: white !important;
      border: 4px solid #ff6b35 !important;
      box-shadow: 0 8px 25px rgba(255, 107, 53, 0.9) !important;
      transform: scale(1.08) !important;
      z-index: 50 !important;
      position: relative !important;
      outline: 3px solid rgba(255, 107, 53, 0.5) !important;
      outline-offset: 2px !important;
    }
    
    .pastecraft-interface.pastecraft-interface .pastecraft-clip.selected.selected * {
      color: white !important;
    }
    
    .pastecraft-interface.pastecraft-interface .pastecraft-clip.selected.selected .pastecraft-clip-text {
      color: white !important;
      font-weight: 900 !important;
      text-shadow: 0 2px 4px rgba(0,0,0,0.5) !important;
      font-size: 1.1em !important;
    }
    
    .pastecraft-interface.pastecraft-interface .pastecraft-clip.selected.selected .pastecraft-clip-meta {
      color: rgba(255, 255, 255, 1) !important;
    }
    
    .pastecraft-interface.pastecraft-interface .pastecraft-clip.selected.selected .pastecraft-category {
      background: rgba(255, 255, 255, 0.6) !important;
      color: #ff6b35 !important;
      border: 2px solid white !important;
      font-weight: 700 !important;
    }
    
    .pastecraft-interface.pastecraft-interface .pastecraft-clip.selected.selected .pastecraft-time {
      color: rgba(255, 255, 255, 1) !important;
      font-weight: 600 !important;
    }
    
    .pastecraft-interface.pastecraft-interface .pastecraft-clip.selected.selected .pastecraft-btn {
      background: rgba(255, 255, 255, 0.3) !important;
      color: white !important;
      border: 2px solid rgba(255, 255, 255, 0.8) !important;
    }
    
    /* Dark / blue theme override for selection */
    .pastecraft-interface.dark.pastecraft-interface .pastecraft-clip.selected.selected,
    .pastecraft-interface.blue.pastecraft-interface .pastecraft-clip.selected.selected {
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%) !important;
      border-color: #ff6b35 !important;
    }
    
    /* Copy Multiple button styling */
    .pastecraft-copy-multiple {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 55%, #1a1f5e 100%) !important;
      color: white !important;
      font-weight: 600 !important;
      padding: 6px 12px !important;
      border-radius: 6px !important;
      font-size: 12px !important;
      border: 1px solid #1a1f5e !important;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35) !important;
      flex: none !important;
      min-width: auto !important;
      max-width: 140px !important;
      text-align: center !important;
      white-space: nowrap !important;
      margin-left: 0 !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }
    
    .pastecraft-copy-multiple:hover:not(:disabled) {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #0d1240 100%) !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 4px 14px rgba(26, 31, 94, 0.45) !important;
    }
    
    .pastecraft-copy-multiple:disabled {
      background: #d1d5db !important;
      color: #9ca3af !important;
      cursor: not-allowed !important;
      transform: none !important;
      box-shadow: none !important;
      border-color: #d1d5db !important;
    }
    
    .pastecraft-interface.dark .pastecraft-footer,
    .pastecraft-interface.blue .pastecraft-footer {
      background: #0b1220 !important;
      border-top-color: #1e3a8a !important;
    }
    
    /* NUCLEAR STICKY FOOTER FIX */
    .pastecraft-quick-paste .pastecraft-footer {
      position: -webkit-sticky !important;
      position: sticky !important;
      bottom: 0px !important;
      z-index: 9999 !important;
      margin-top: auto !important;
    }
    
    .pastecraft-quick-paste .pastecraft-content {
      display: -webkit-flex !important;
      display: flex !important;
      -webkit-flex-direction: column !important;
      flex-direction: column !important;
      height: 100% !important;
      min-height: 300px !important;
    }
    
    .pastecraft-quick-paste .pastecraft-clips-container {
      -webkit-flex: 1 !important;
      flex: 1 !important;
      overflow-y: auto !important;
      min-height: 0 !important;
    }
  `;
  
  root.appendChild(styles);
}
