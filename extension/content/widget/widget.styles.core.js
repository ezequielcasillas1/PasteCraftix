/** @forward-slice — Widget styles: floating widget shell */

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

      /* Capture Tools — hexagon bundle between Settings and Auto-Copy */
      .capture-tools-wrap {
        position: relative;
        flex-direction: column;
        height: auto;
        padding: 4px;
        gap: 4px;
      }

      .capture-tools-btn {
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.1);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: all 0.2s ease;
      }

      .capture-tools-btn:hover,
      .capture-tools-wrap.is-open .capture-tools-btn {
        background: rgba(96, 165, 250, 0.22);
        box-shadow: 0 0 14px rgba(96, 165, 250, 0.45);
      }

      .capture-tools-wrap.is-spot-active .capture-tools-btn {
        box-shadow: 0 0 14px rgba(74, 222, 128, 0.55);
      }

      .capture-tools-wrap.is-image-active .capture-tools-btn {
        box-shadow: 0 0 14px rgba(251, 191, 36, 0.55);
      }

      .capture-hex-svg {
        width: 28px;
        height: 28px;
        display: block;
        pointer-events: none;
      }

      .capture-hex-shape {
        transition: fill 0.2s ease, stroke 0.2s ease;
      }

      .capture-tools-counter {
        font-size: 10px;
        color: #e0f2fe;
        text-align: center;
        white-space: nowrap;
        transition: transform 0.2s ease;
        pointer-events: none;
        line-height: 1.2;
      }

      .capture-tools-menu {
        position: absolute;
        right: calc(100% + 10px);
        top: 8px;
        min-width: 148px;
        padding: 6px;
        border-radius: 10px;
        background: rgba(15, 23, 42, 0.96);
        border: 1px solid rgba(96, 165, 250, 0.35);
        box-shadow: -4px 0 20px rgba(0, 0, 0, 0.35);
        display: flex;
        flex-direction: column;
        gap: 4px;
        z-index: 2;
      }

      .capture-tools-wrap.is-unsupported .capture-tools-menu {
        min-width: 228px;
        max-width: 260px;
      }

      .capture-tools-unsupported {
        margin: 0;
        padding: 6px 8px 8px;
        color: #cbd5e1;
        font: 500 11px/1.4 system-ui, sans-serif;
      }

      .capture-tools-menu-item.is-unsupported {
        opacity: 0.45;
      }

      .capture-tools-menu[hidden] {
        display: none !important;
      }

      .capture-tools-menu-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 10px;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: #f8fafc;
        font: 600 13px system-ui, sans-serif;
        cursor: pointer;
        text-align: left;
      }

      .capture-tools-menu-item:hover {
        background: rgba(96, 165, 250, 0.2);
      }

      .capture-tools-menu-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .capture-tools-menu-dot.spot {
        background: #4ade80;
      }

      .capture-tools-menu-dot.image {
        background: #fbbf24;
      }
      
      /* Component 4: Auto Copy Toggle - Circular Button */
      .auto-copy-section {
        flex-direction: column;
        height: auto;
        padding: 8px 4px;
        gap: 6px;
        cursor: pointer;
        pointer-events: auto;
        position: relative;
        z-index: 2;
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
        pointer-events: auto;
      }
      
      .auto-copy-toggle:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      }
      
      .auto-copy-toggle[data-state="on"] {
        background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
        border-color: #1a1f5e;
        box-shadow: 0 0 12px rgba(37, 99, 235, 0.5);
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

      /* Hide Capture Tools tooltip while Spot / Image Picker menu is open */
      .capture-tools-wrap.is-open:hover[data-tooltip]::before,
      .capture-tools-wrap.is-open:hover[data-tooltip]::after {
        opacity: 0 !important;
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
