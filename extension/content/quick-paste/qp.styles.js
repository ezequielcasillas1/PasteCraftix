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
    .pastecraft-quick-paste {
      position: fixed;
      top: 50%;
      left: 0;
      transform: translateY(-50%);
      width: 320px;
      max-height: 600px;
      background: white;
      border-radius: 0 12px 12px 0;
      box-shadow: 4px 0 60px rgba(0, 0, 0, 0.3);
      border: 1px solid #e2e8f0;
      border-left: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 999999;
      overflow: hidden;
      overflow-x: hidden;
      backdrop-filter: blur(10px);
      animation: pastecraft-slide-in 0.3s ease;
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
      background: #5797EF;
      color: white;
      font-size: 14px;
      font-weight: 600;
    }
    
    .pastecraft-logo {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .pastecraft-controls {
      display: flex;
      gap: 4px;
    }
    
    .pastecraft-btn {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 6px;
      padding: 4px 8px;
      color: white;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.2s;
    }
    
    .pastecraft-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }
    
    .pastecraft-content {
      max-height: 400px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      position: relative;
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
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .pastecraft-clip:hover {
      background: #f1f5f9;
      border-color: #3b82f6;
      transform: translateX(2px);
    }
    
    .pastecraft-clip-content {
      flex: 1;
      min-width: 0;
    }
    
    .pastecraft-clip-text {
      font-size: 13px;
      color: #1f2937;
      margin-bottom: 4px;
      word-break: break-word;
    }
    
    .pastecraft-clip-meta {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #6b7280;
    }
    
    .pastecraft-category {
      background: #e0e7ff;
      color: #3730a3;
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
      background: #2563eb !important;
      color: white !important;
      padding: 6px !important;
      border-radius: 6px !important;
    }
    
    .pastecraft-paste:hover {
      background: #1d4ed8 !important;
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
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .pastecraft-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .pastecraft-modal-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
    }
    
    .pastecraft-modal-close {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #6b7280;
      padding: 4px;
      border-radius: 4px;
    }
    
    .pastecraft-modal-close:hover {
      background: #f3f4f6;
      color: #374151;
    }
    
    /* Help Modal Styles - Force proper centering */
    .pastecraft-help-modal {
      display: none;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      z-index: 10000 !important;
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
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      height: 36px;
    }
    
    .pastecraft-help-btn:hover, .pastecraft-back-btn:hover {
      background: #2563eb;
      transform: translateY(-1px);
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
      border-left: 4px solid #3b82f6;
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
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    
    .pastecraft-setting input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: #3b82f6;
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
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: white;
      border: none;
      border-radius: 8px;
      padding: 12px 24px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
    }
    
    .pastecraft-btn-primary:hover {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
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
      background: #3b82f6;
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
      border-color: #3b82f6 !important;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
    }
    
    #quickPasteCustomDelimiter::placeholder {
      color: #9ca3af !important;
      font-style: italic !important;
    }
    
    
    .pastecraft-interface.dark .pastecraft-setting-group {
      background: #374151;
      border-color: #4b5563;
    }
    
    .pastecraft-interface.dark .pastecraft-setting-label {
      color: #f9fafb;
    }
    
    .pastecraft-interface.dark .pastecraft-segment-btn {
      background: #4b5563;
      color: #d1d5db;
      border-color: #6b7280;
    }
    
    .pastecraft-interface.dark .pastecraft-segment-btn:hover:not(.active) {
      background: #6b7280;
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
    
    /* Dark theme support */
    .pastecraft-interface.dark {
      background: #1f2937;
      border-color: #374151;
      color: #f9fafb;
    }
    
    .pastecraft-interface.dark .pastecraft-header {
      background: #111827;
      border-color: #374151;
    }
    
    .pastecraft-interface.dark .pastecraft-clip {
      background: #374151;
      border-color: #4b5563;
    }
    
    .pastecraft-interface.dark .pastecraft-clip:hover {
      background: #4b5563;
    }
    
    .pastecraft-interface.dark .pastecraft-clip-text {
      color: #f9fafb;
    }
    
    .pastecraft-interface.dark .pastecraft-clip-meta {
      color: #9ca3af;
    }
    
    .pastecraft-footer {
      position: sticky !important;
      bottom: 0 !important;
      z-index: 1000 !important;
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      padding: 12px 16px !important;
      background: rgba(248, 250, 252, 0.98) !important;
      backdrop-filter: blur(12px) !important;
      border-top: 2px solid #e2e8f0 !important;
      font-size: 12px !important;
      color: #6b7280 !important;
      box-shadow: 0 -6px 20px rgba(0, 0, 0, 0.15) !important;
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
      background: #f1f5f9;
    }
    
    .pastecraft-content::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 3px;
    }
    
    .pastecraft-content::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
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
    
    /* Dark theme override for selection */
    .pastecraft-interface.dark.pastecraft-interface .pastecraft-clip.selected.selected {
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%) !important;
      border-color: #ff6b35 !important;
    }
    
    /* Copy Multiple button styling */
    .pastecraft-copy-multiple {
      background: #2563eb !important;
      color: white !important;
      font-weight: 600 !important;
      padding: 6px 12px !important;
      border-radius: 6px !important;
      font-size: 12px !important;
      border: 1px solid #1a1f5e !important;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3) !important;
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
      background: #1a1f5e !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.5) !important;
    }
    
    .pastecraft-copy-multiple:disabled {
      background: #d1d5db !important;
      color: #9ca3af !important;
      cursor: not-allowed !important;
      transform: none !important;
      box-shadow: none !important;
      border-color: #d1d5db !important;
    }
    
    .pastecraft-interface.dark .pastecraft-footer {
      background: rgba(31, 41, 55, 0.98) !important;
      border-top-color: #374151 !important;
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
