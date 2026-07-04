import { injectShadowStyles } from '../safety/shadow-host.js';

export const WIDGET_CORE_CSS = `
      /* Main Widget Container - starts at right edge, slides left when panel opens */
      .pastecraft-widget {
        position: fixed;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 60px;
        /* 70% transparent background (alpha 0.3) */
        background: linear-gradient(135deg, rgba(30, 64, 175, 0.3) 0%, rgba(30, 58, 138, 0.3) 50%, rgba(29, 78, 216, 0.3) 100%);
        border-radius: 12px 0 0 12px;
        box-shadow: 
          -4px 0 16px rgba(0, 0, 0, 0.15),
          0 4px 24px rgba(30, 64, 175, 0.3);
        z-index: 2147483647;
        padding: 8px 6px;
        transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      /* Widget slides left when any panel is open */
      .pastecraft-widget.panel-open {
        right: 476px;
      }
      
      .pastecraft-widget-inner {
        display: flex;
        flex-direction: column;
        gap: 12px;
        align-items: center;
      }
      
      /* Widget Components */
      .widget-component {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.2s ease;
        position: relative;
      }
      
      .widget-component:hover {
        background: rgba(96, 165, 250, 0.2);
        box-shadow: 0 0 16px rgba(96, 165, 250, 0.5);
      }
      
      /* Active state - when panel is open */
      .widget-component.active {
        background: rgba(96, 165, 250, 0.3);
        box-shadow: 0 0 20px rgba(96, 165, 250, 0.7);
        border: 2px solid rgba(96, 165, 250, 0.8);
      }
      
      /* Component 1: Logo Button */
      .logo-button {
        background: rgba(255, 255, 255, 0.1);
      }
      
      .widget-logo {
        width: 36px;
        height: 36px;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
      }

      .widget-logo.is-profile-icon {
        border-radius: 50%;
        object-fit: cover;
        object-position: center;
        border: 2px solid rgba(255, 255, 255, 0.35);
        box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.25);
      }
      
      /* Component 2: Settings Button */
      .settings-button .widget-icon {
        font-size: 24px;
        transition: transform 0.3s ease;
      }
      
      .settings-button:hover .widget-icon {
        transform: rotate(90deg);
      }
      
      /* Component 3: Auto Copy Toggle - Circular Button */
      .auto-copy-section {
        flex-direction: column;
        height: auto;
        padding: 8px 4px;
        gap: 6px;
      }
      
      .auto-copy-toggle {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #374151;
        border: 2px solid #4b5563;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }
      
      .auto-copy-toggle:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      }
      
      .auto-copy-toggle[data-state="on"] {
        background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
        border-color: #15803d;
        box-shadow: 0 0 12px rgba(34, 197, 94, 0.5);
      }
      
      .toggle-label {
        font-size: 10px;
        font-weight: 700;
        color: white;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        pointer-events: none;
      }
      
      .auto-copy-counter {
        font-size: 10px;
        color: #e0f2fe;
        text-align: center;
        white-space: nowrap;
        transition: transform 0.2s ease;
      }
      
      /* Component 4: Quick View Button */
      .quick-view-button {
        background: transparent;
        box-shadow: none;
      }
      .quick-view-button .eye-icon-wrap {
        position: relative;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      }
      .quick-view-button .eye-svg {
        display: block;
        width: 34px;
        height: 34px;
        overflow: visible;
        transition: transform 0.15s ease;
      }
      .quick-view-button .eye-drawing {
        transform-box: fill-box;
        transform-origin: center;
      }
      .quick-view-button .eye-outline,
      .quick-view-button .eye-pupil {
        fill: none;
        stroke: rgba(255, 255, 255, 0.96);
        stroke-width: 6;
        stroke-linecap: round;
        stroke-linejoin: round;
        filter: drop-shadow(0 1px 2px rgba(15, 23, 42, 0.35));
      }
      .quick-view-button .eye-pupil {
        stroke-width: 7;
        transform-box: fill-box;
        transform-origin: center;
      }
      .quick-view-button:hover,
      .quick-view-button:focus-visible {
        background: rgba(96, 165, 250, 0.18);
        box-shadow: 0 0 16px rgba(56, 189, 248, 0.55);
      }

      .widget-component > svg,
      .widget-component > svg *,
      .widget-component > img,
      .widget-component .widget-icon,
      .widget-component .widget-logo,
      .widget-component .eye-icon-wrap,
      .widget-component .eye-icon-wrap *,
      .quickview-btn > svg,
      .quickview-btn > svg *,
      .quickview-btn > span,
      .clip-btn > svg,
      .clip-btn > svg *,
      .clip-btn > span {
        pointer-events: none;
      }

      .quick-view-button:hover .eye-svg,
      .quick-view-button:focus-visible .eye-svg {
        transform: scale(1.04);
      }
      .quick-view-button:hover .eye-drawing,
      .quick-view-button:focus-visible .eye-drawing {
        animation: pastecraft-eye-blink 1.15s ease-in-out infinite;
      }
      .quick-view-button:hover .eye-pupil,
      .quick-view-button:focus-visible .eye-pupil {
        animation: pastecraft-eye-pupil 1.15s ease-in-out infinite;
      }

      @keyframes pastecraft-eye-blink {
        0%, 38%, 68%, 100% {
          transform: scaleY(1);
        }
        50% {
          transform: scaleY(0.14);
        }
      }

      @keyframes pastecraft-eye-pupil {
        0%, 100% {
          transform: translateX(0);
        }
        25% {
          transform: translateX(-5px);
        }
        65% {
          transform: translateX(5px);
        }
      }
      
      /* Tooltips - appear on LEFT; hardened against host page CSS (chess.com etc.) */
      .widget-component[data-tooltip]::before {
        all: initial !important;
        content: attr(data-tooltip) !important;
        position: absolute !important;
        right: calc(100% + 10px) !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        background: rgba(15, 23, 42, 0.92) !important;
        color: #e2e8f0 !important;
        padding: 5px 10px !important;
        border-radius: 6px !important;
        font-size: 11px !important;
        font-family: system-ui, sans-serif !important;
        font-weight: 500 !important;
        line-height: 1.4 !important;
        white-space: nowrap !important;
        letter-spacing: 0.02em !important;
        opacity: 0 !important;
        pointer-events: none !important;
        transition: opacity 0.18s ease !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35) !important;
        z-index: 10 !important;
      }

      .widget-component[data-tooltip]::after {
        all: initial !important;
        content: '' !important;
        position: absolute !important;
        right: calc(100% + 4px) !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        border: 5px solid transparent !important;
        border-left-color: rgba(15, 23, 42, 0.92) !important;
        opacity: 0 !important;
        pointer-events: none !important;
        transition: opacity 0.18s ease !important;
        z-index: 10 !important;
      }

      .widget-component:hover[data-tooltip]::before,
      .widget-component:hover[data-tooltip]::after {
        opacity: 1 !important;
      }
      
      /* Animations - slides in from right */
      @keyframes widget-fade-in {
        from {
          opacity: 0;
          transform: translateY(-50%) translateX(20px);
        }
        to {
          opacity: 1;
          transform: translateY(-50%) translateX(0);
        }
      }
      
      .pastecraft-widget {
        animation: widget-fade-in 0.4s ease-out;
        cursor: grab;
      }

      /* While dragging the widget */
      .pastecraft-widget.pc-dragging {
        cursor: grabbing;
        transition: none !important;
      }

      /* Keep pointer cursor on interactive components */
      .pastecraft-widget .widget-component {
        cursor: pointer;
      }
    `;

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
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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

export const WIDGET_SETTINGS_CSS = `
      /* Settings Backdrop */
      .pastecraft-settings-backdrop {
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
      
      .pastecraft-settings-backdrop.visible {
        opacity: 1;
      }
      
      /* Settings Panel - same size as popup (wide) */
      .pastecraft-settings-panel {
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
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        color: #1f2937;
        box-sizing: border-box;
      }

      .pastecraft-settings-panel *,
      .pastecraft-settings-panel *::before,
      .pastecraft-settings-panel *::after {
        box-sizing: border-box;
      }
      
      .pastecraft-settings-panel.visible {
        transform: translateX(0);
      }
      
      /* Settings Header */
      .settings-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border-bottom: 1px solid #e5e7eb;
        background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
        color: white;
      }
      
      .settings-header h3 {
        font-size: 20px;
        font-weight: 600;
        margin: 0;
      }
      
      .settings-close {
        width: 32px;
        height: 32px;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        border-radius: 50%;
        font-size: 24px;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }
      
      .settings-close:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.1);
      }
      
      /* Settings Content */
      .settings-content {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
      }

      .setting-item--with-select {
        align-items: flex-start;
        gap: 16px;
      }

      .setting-item--with-select .setting-info {
        flex: 1 1 auto;
        min-width: 0;
      }

      .pc-settings-select {
        flex: 0 0 auto;
        width: 200px;
        max-width: 42%;
        min-width: 160px;
        min-height: 36px;
        padding: 8px 32px 8px 10px;
        border-radius: 10px;
        border: 1px solid #e5e7eb;
        background: #ffffff;
        color: #0f172a;
        font-size: 13px;
        font-family: inherit;
        line-height: 1.3;
        outline: none;
        appearance: auto;
        -webkit-appearance: menulist;
        cursor: pointer;
      }

      .pc-settings-select:focus {
        border-color: rgba(59, 130, 246, 0.75);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.20);
      }
      
      .settings-section {
        margin-bottom: 32px;
      }
      
      .settings-section h4 {
        font-size: 14px;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0 0 16px 0;
      }
      
      /* Setting Item */
      .setting-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 0;
        border-bottom: 1px solid #f1f5f9;
      }
      
      .setting-item:last-child {
        border-bottom: none;
      }
      
      .setting-info {
        flex: 1;
        margin-right: 16px;
      }
      
      .setting-info label {
        font-size: 14px;
        font-weight: 500;
        color: #1f2937;
        display: block;
        margin-bottom: 4px;
        cursor: pointer;
      }

      .setting-desc {
        font-size: 13px;
        color: #64748b;
        margin: 0;
        line-height: 1.4;
        display: block;
      }
      
      /* Toggle Switch */
      .toggle-switch {
        position: relative;
        width: 48px;
        height: 24px;
        display: inline-block;
        cursor: pointer;
      }
      
      .toggle-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      
      .toggle-switch .toggle-slider {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: #cbd5e1;
        border-radius: 24px;
        transition: all 0.3s ease;
      }
      
      .toggle-switch .toggle-slider::before {
        content: '';
        position: absolute;
        width: 20px;
        height: 20px;
        left: 2px;
        bottom: 2px;
        background: white;
        border-radius: 50%;
        transition: all 0.3s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
      
      .toggle-switch input:checked + .toggle-slider {
        background: #60a5fa;
      }
      
      .toggle-switch input:checked + .toggle-slider::before {
        transform: translateX(24px);
      }
      
      /* Responsive */
      @media (max-width: 480px) {
        .pastecraft-settings-panel {
          width: 100%;
        }

        .pc-settings-select {
          width: 100%;
          max-width: none;
        }

        .setting-item--with-select {
          flex-direction: column;
          align-items: stretch;
        }
      }
    `;

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
      
      /* Quick View Iframe */
      .pastecraft-quickview-iframe {
        width: 100%;
        height: 100%;
        border: none;
        background: white;
      }
      
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

export function injectWidgetStyles(root) {
  if (!root) return;
  const existingStyles = root.querySelector('[data-field="pastecraft-floating-widget-styles"]');
  if (existingStyles) existingStyles.remove();
  const styles = document.createElement('style');
  styles.setAttribute('data-field', 'pastecraft-floating-widget-styles');
  styles.textContent = WIDGET_CORE_CSS;
  root.appendChild(styles);
}

export function injectOverlayStyles() {
  if (document.getElementById('pastecraft-overlay-styles')) return;
  const styles = document.createElement('style');
  styles.id = 'pastecraft-overlay-styles';
  styles.textContent = WIDGET_OVERLAY_CSS;
  document.head.appendChild(styles);
}

export function injectSettingsStyles(shadowRoot) {
  if (!shadowRoot) return;
  injectShadowStyles(shadowRoot, WIDGET_SETTINGS_CSS, 'pc-settings-styles');
}

export function injectQuickViewStyles() {
  if (document.getElementById('pastecraft-quickview-styles')) return;
  const styles = document.createElement('style');
  styles.id = 'pastecraft-quickview-styles';
  styles.textContent = WIDGET_QUICKVIEW_CSS;
  document.head.appendChild(styles);
}
