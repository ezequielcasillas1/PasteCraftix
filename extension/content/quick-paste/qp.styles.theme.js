/** @forward-slice — Quick Paste styles: dark / blue theme overrides */

export const QP_STYLES_THEME = `    /* Blue Dark Mode (popup parity) — opaque navy glass, no page bleed-through */
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
    
`;
