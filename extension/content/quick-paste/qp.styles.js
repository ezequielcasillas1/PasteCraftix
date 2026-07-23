/** @forward-slice — Quick Paste shadow-DOM stylesheet injector (aggregator). */

import { QP_HOST } from './qp.constants.js';
import { QP_STYLES_BASE } from './qp.styles.base.js';
import { QP_STYLES_CLIPS } from './qp.styles.clips.js';
import { QP_STYLES_MODALS } from './qp.styles.modals.js';
import { QP_STYLES_THEME } from './qp.styles.theme.js';

export function addQuickPasteStyles(root) {
  if (!root) return;
  const styleField = QP_HOST.STYLE_FIELD;
  const existingStyles = root.querySelector(`[data-field="${styleField}"]`);
  if (existingStyles) {
    existingStyles.remove();
  }

  const styles = document.createElement('style');
  styles.setAttribute('data-field', styleField);
  styles.textContent = QP_STYLES_BASE + QP_STYLES_MODALS + QP_STYLES_THEME + QP_STYLES_CLIPS;
  root.appendChild(styles);
}
