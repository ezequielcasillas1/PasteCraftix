/** @forward-slice — Widget stylesheet injector (aggregator). */

import { injectShadowStyles } from '../safety/shadow-host.js';
import { WIDGET_CORE_CSS } from './widget.styles.core.js';
import { WIDGET_OVERLAY_CSS } from './widget.styles.overlay.js';
import { WIDGET_QUICKVIEW_CSS } from './widget.styles.quickview.js';
import { WIDGET_SETTINGS_CSS } from './widget.styles.settings.js';

export { WIDGET_CORE_CSS } from './widget.styles.core.js';
export { WIDGET_OVERLAY_CSS } from './widget.styles.overlay.js';
export { WIDGET_QUICKVIEW_CSS } from './widget.styles.quickview.js';
export { WIDGET_SETTINGS_CSS } from './widget.styles.settings.js';

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
  let styles = document.getElementById('pastecraft-quickview-styles');
  if (!styles) {
    styles = document.createElement('style');
    styles.id = 'pastecraft-quickview-styles';
    document.head.appendChild(styles);
  }
  styles.textContent = WIDGET_QUICKVIEW_CSS;
}
