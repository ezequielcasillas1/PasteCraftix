/** @forward-slice — Quick Paste styles: dock, tokens, core panel */

export const QP_STYLES_BASE = `
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
    
`;
