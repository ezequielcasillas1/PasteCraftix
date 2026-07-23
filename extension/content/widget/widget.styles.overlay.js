/** @forward-slice — Widget styles: popup overlay panel */

export const WIDGET_OVERLAY_CSS = `
      /* Backdrop */
      .pastecraft-overlay-backdrop {
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
      
      .pastecraft-overlay-backdrop.visible {
        opacity: 1;
      }
      
      /* Panel - Slides in from right (wider for better UX) */
      .pastecraft-overlay-panel {
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
      
      .pastecraft-overlay-panel.visible,
      .pastecraft-overlay-panel.pastecraft-overlay-panel-loading {
        transform: translateX(0);
      }

      .pastecraft-overlay-panel-loading {
        background: linear-gradient(135deg, #0d1240 0%, #1a1f5e 100%);
      }

      .pastecraft-overlay-loader {
        position: absolute;
        inset: 0;
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        pointer-events: none;
      }

      .pastecraft-overlay-loader-spinner {
        width: 44px;
        height: 44px;
        border: 4px solid rgba(255, 255, 255, 0.35);
        border-top-color: #fff;
        border-radius: 50%;
        animation: pastecraft-overlay-spin 1s linear infinite;
      }

      .pastecraft-overlay-loader-text {
        color: #fff;
        font-size: 15px;
        font-weight: 600;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      }

      @keyframes pastecraft-overlay-spin {
        to { transform: rotate(360deg); }
      }
      
      /* Close Button - HIDDEN per user request */
      .pastecraft-overlay-close {
        display: none !important;
      }
      
      /* Iframe */
      .pastecraft-overlay-iframe {
        width: 100%;
        height: 100%;
        border: none;
        background: white;
        flex: 1;
        min-height: 0;
      }

      .pastecraft-overlay-iframe.pastecraft-overlay-iframe-loading {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
      }
      
      /* Responsive - Full width on mobile */
      @media (max-width: 480px) {
        .pastecraft-overlay-panel {
          width: 100%;
        }
      }
    `;
