/** @forward-slice — Widget styles: quick view panel */

export const WIDGET_QUICKVIEW_CSS = `
      /* Quick View Backdrop */
      .pastecraft-quickview-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: transparent;
        z-index: 2147483645;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
      }
      
      .pastecraft-quickview-backdrop.visible {
        opacity: 1;
      }
      
      /* Quick View Panel - same size as popup (wide) */
      .pastecraft-quickview-panel {
        position: fixed;
        top: 0;
        right: 0;
        width: 476px;
        max-width: 90vw;
        height: 100vh;
        background: white;
        box-shadow: -4px 0 16px rgba(0, 0, 0, 0.2);
        z-index: 2147483646;
        transform: translateX(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      .pastecraft-quickview-panel.visible {
        transform: translateX(0);
      }
      
      /* In-panel Quick View chrome (no iframe) */
      .pastecraft-qv-chrome {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        width: 100%;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: white;
        overflow: hidden;
      }

      .pastecraft-qv-close {
        display: flex !important;
        position: absolute;
        top: 12px;
        left: -44px;
        z-index: 1;
      }

      .pastecraft-qv-header {
        background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 50%, #1d4ed8 100%);
        color: white;
        padding: 16px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        flex-shrink: 0;
      }

      .pastecraft-qv-title {
        font-size: 18px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .pastecraft-qv-count {
        font-size: 13px;
        font-weight: 500;
        background: rgba(255, 255, 255, 0.2);
        padding: 4px 10px;
        border-radius: 12px;
        color: rgba(255, 255, 255, 0.9);
      }

      .pastecraft-qv-controls { display: flex; gap: 8px; }

      .pastecraft-qv-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        border-radius: 6px;
        padding: 6px 10px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }

      .pastecraft-qv-btn:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.05);
      }

      .pastecraft-qv-btn.active {
        background: rgba(255, 255, 255, 0.35);
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.35);
      }

      .pastecraft-qv-btn.liked-active {
        color: #fecaca;
        background: rgba(239, 68, 68, 0.35);
      }

      .pastecraft-qv-btn.liked-active svg { fill: currentColor; }
      .pastecraft-qv-btn svg,
      .pastecraft-qv-btn svg *,
      .pastecraft-qv-btn span { pointer-events: none; }

      .pastecraft-qv-content {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        min-height: 0;
      }

      .pastecraft-qv-clip {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 10px;
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }

      .pastecraft-qv-clip-body { flex: 1; min-width: 0; }

      .pastecraft-qv-clip-text {
        font-size: 14px;
        color: #0f172a;
        line-height: 1.4;
        word-break: break-word;
      }

      .pastecraft-qv-clip-meta { margin-top: 6px; }

      .pastecraft-qv-clip-category {
        font-size: 11px;
        color: #64748b;
        background: #e2e8f0;
        padding: 2px 8px;
        border-radius: 999px;
      }

      .pastecraft-qv-clip-actions { display: flex; gap: 4px; flex-shrink: 0; }

      .pastecraft-qv-clip-btn {
        border: none;
        background: #e2e8f0;
        border-radius: 6px;
        padding: 6px 8px;
        cursor: pointer;
        font-size: 13px;
      }

      .pastecraft-qv-clip-btn:hover { background: #cbd5e1; }
      .pastecraft-qv-clip-btn.delete { color: #b91c1c; }

      .pastecraft-qv-like {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: #94a3b8;
        cursor: pointer;
      }

      .pastecraft-qv-like:hover {
        color: #ef4444;
        background: rgba(239, 68, 68, 0.1);
      }

      .pastecraft-qv-like.liked { color: #ef4444; }
      .pastecraft-qv-like.liked svg { fill: currentColor; }
      .pastecraft-qv-like svg,
      .pastecraft-qv-like svg * { pointer-events: none; }

      .pastecraft-qv-empty {
        text-align: center;
        padding: 48px 20px;
        color: #64748b;
      }

      .pastecraft-qv-empty-icon { font-size: 32px; margin-bottom: 12px; }
      .pastecraft-qv-empty-text {
        font-size: 16px;
        font-weight: 600;
        color: #334155;
        margin-bottom: 6px;
      }
      .pastecraft-qv-empty-hint { font-size: 13px; }

      .pastecraft-qv-toast {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #2563eb;
        color: white;
        padding: 10px 20px;
        border-radius: 8px;
        z-index: 2147483647;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transition: opacity 0.3s ease;
      }

      .pastecraft-qv-toast.is-error { background: #ef4444; }
      .pastecraft-qv-toast.fade { opacity: 0; }
      
      /* Responsive - Full width on mobile */
      @media (max-width: 480px) {
        .pastecraft-quickview-panel {
          width: 100%;
        }
      }

      /* Mini Quick View (placeholder) */
      .pastecraft-mini-quickview {
        position: fixed;
        width: 360px;
        height: 460px;
        max-width: 92vw;
        max-height: 85vh;
        background: white;
        border: 1px solid rgba(148, 163, 184, 0.55);
        border-radius: 12px;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
        z-index: 2147483647;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .pastecraft-mini-quickview-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 50%, #1d4ed8 100%);
        color: white;
        cursor: grab;
        user-select: none;
      }

      .pastecraft-mini-quickview-header:active {
        cursor: grabbing;
      }

      .pastecraft-mini-quickview-title {
        font-size: 14px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .pastecraft-mini-quickview-controls {
        display: inline-flex;
        gap: 8px;
        align-items: center;
      }

      .pastecraft-mini-quickview-btn {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        border-radius: 8px;
        width: 28px;
        height: 28px;
        color: white;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
      }

      .pastecraft-mini-quickview-btn:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.05);
      }

      .pastecraft-mini-quickview-body {
        flex: 1;
        background: rgba(241, 245, 249, 0.65);
        overflow-y: auto;
        padding: 8px;
      }

      .pastecraft-mini-quickview-empty {
        text-align: center;
        color: #64748b;
        font-size: 13px;
        padding: 32px 16px;
      }

      .pastecraft-mini-quickview-clip {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 10px 12px;
        margin-bottom: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .pastecraft-mini-quickview-clip:hover {
        background: #eff6ff;
        border-color: #3b82f6;
      }

      .pastecraft-mini-quickview-clip-text {
        font-size: 13px;
        color: #1f2937;
        line-height: 1.4;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .pastecraft-mini-quickview-clip-category {
        font-size: 11px;
        color: #3b82f6;
        background: rgba(59, 130, 246, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 500;
        align-self: flex-start;
      }

      .pastecraft-mini-quickview.docked {
        right: 20px;
        bottom: 20px;
      }
    `;
