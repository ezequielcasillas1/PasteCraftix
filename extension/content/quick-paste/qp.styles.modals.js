/** @forward-slice — Quick Paste styles: settings, help, confirm modals */

export const QP_STYLES_MODALS = `    /* Settings Modal Styles */
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
    
`;
