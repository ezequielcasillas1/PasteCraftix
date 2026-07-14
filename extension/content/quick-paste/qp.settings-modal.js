/** @forward-slice — Quick Paste settings + help modal UI (Shadow DOM). */

import {
  QP_CLASSES,
  QP_ELEMENT_IDS,
  QP_LIMITS,
  QP_DELIMITER,
  resolveQuickPasteTheme,
} from './qp.constants.js';

const MODAL_SHELL_CSS = `
      position: fixed !important;
      inset: 0 !important;
      z-index: 1000001 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      opacity: 1 !important;
      pointer-events: auto !important;
    `;

const HELP_SHELL_CSS = `
      position: fixed !important;
      inset: 0 !important;
      z-index: 1000003 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      opacity: 1 !important;
      pointer-events: auto !important;
    `;

function checkedAttr(on) {
  return on ? 'checked' : '';
}

function segmentActive(settings, value) {
  return settings.delimiter === value ? QP_CLASSES.ACTIVE : '';
}

function buildBasicSettingsFields(settings) {
  return `
          <div class="${QP_CLASSES.SETTING}">
            <label>
              <input type="checkbox" id="${QP_ELEMENT_IDS.AUTO_HIDE}" ${checkedAttr(settings.autoHide)}>
              Auto-hide after paste
            </label>
          </div>
          <div class="${QP_CLASSES.SETTING}">
            <label>
              <input type="checkbox" id="${QP_ELEMENT_IDS.SHOW_TIMESTAMPS}" ${checkedAttr(settings.showTimestamps)}>
              Show timestamps
            </label>
          </div>
          <div class="${QP_CLASSES.SETTING}">
            <label>Max clips to display</label>
            <input type="number" id="${QP_ELEMENT_IDS.MAX_CLIPS}" value="${settings.maxClipsDisplay}" min="${QP_LIMITS.MAX_CLIPS_MIN}" max="${QP_LIMITS.MAX_CLIPS_MAX}">
          </div>
    `;
}

function buildDelimiterGroup(settings) {
  const d = QP_DELIMITER;
  const customDisplay = settings.delimiter === d.CUSTOM ? 'block' : 'none';
  return `
          <div class="${QP_CLASSES.SETTING_GROUP}">
            <label class="${QP_CLASSES.SETTING_LABEL}">Delimiter</label>
            <div class="${QP_CLASSES.SEGMENTED_CONTROL}" id="${QP_ELEMENT_IDS.DELIMITER_CONTROL}">
              <button class="${QP_CLASSES.SEGMENT_BTN} ${segmentActive(settings, d.COMMA)}" data-delimiter="${d.COMMA}">Comma</button>
              <button class="${QP_CLASSES.SEGMENT_BTN} ${segmentActive(settings, d.NEWLINE)}" data-delimiter="${d.NEWLINE}">Newline</button>
              <button class="${QP_CLASSES.SEGMENT_BTN} ${segmentActive(settings, d.SPACE)}" data-delimiter="${d.SPACE}">Space</button>
              <button class="${QP_CLASSES.SEGMENT_BTN} ${segmentActive(settings, d.CUSTOM)}" data-delimiter="${d.CUSTOM}">Custom</button>
            </div>
            <input type="text" id="${QP_ELEMENT_IDS.CUSTOM_DELIMITER}" value="${settings.customDelimiter}"
                   style="display: ${customDisplay}; margin-top: 8px; padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px;"
                   placeholder="Enter custom delimiter">
          </div>
    `;
}

function buildOptionsGroup(settings) {
  const opts = settings.options || {};
  return `
          <div class="${QP_CLASSES.SETTING_GROUP}">
            <label class="${QP_CLASSES.SETTING_LABEL}">Options</label>
            <div class="pastecraft-toggles">
              <label class="${QP_CLASSES.TOGGLE}">
                <input type="checkbox" id="${QP_ELEMENT_IDS.DEDUPLICATE}" ${checkedAttr(opts.deduplicate)}>
                <div class="${QP_CLASSES.TOGGLE_SWITCH}"></div>
                <span>🔄 Deduplicate</span>
              </label>
              <label class="${QP_CLASSES.TOGGLE}">
                <input type="checkbox" id="${QP_ELEMENT_IDS.SORT}" ${checkedAttr(opts.sort)}>
                <div class="${QP_CLASSES.TOGGLE_SWITCH}"></div>
                <span>⬆️ Sort A→Z</span>
              </label>
              <label class="${QP_CLASSES.TOGGLE}">
                <input type="checkbox" id="${QP_ELEMENT_IDS.UPPERCASE}" ${checkedAttr(opts.uppercase)}>
                <div class="${QP_CLASSES.TOGGLE_SWITCH}"></div>
                <span>Aa UPPERCASE</span>
              </label>
            </div>
          </div>
    `;
}

function buildSettingsModalHtml(settings) {
  return `
      <div class="${QP_CLASSES.MODAL_BACKDROP}"></div>
      <div class="${QP_CLASSES.MODAL_CONTENT}">
        <div class="pastecraft-modal-header">
          <h3>⚙️ Quick Paste Settings</h3>
          <div class="${QP_CLASSES.MODAL_ACTIONS}">
            <button class="${QP_CLASSES.HELP_BTN}" type="button" title="Help & Information" aria-label="Help and information"><span class="pastecraft-help-btn-glyph">?</span></button>
            <button class="${QP_CLASSES.MODAL_CLOSE}" type="button" aria-label="Close settings">×</button>
          </div>
        </div>
        <div class="${QP_CLASSES.MODAL_BODY}">
          ${buildBasicSettingsFields(settings)}
          ${buildDelimiterGroup(settings)}
          ${buildOptionsGroup(settings)}
        </div>
        <div class="${QP_CLASSES.MODAL_ACTIONS}">
          <button class="${QP_CLASSES.BTN_SECONDARY}" id="${QP_ELEMENT_IDS.CANCEL_SETTINGS}">Cancel</button>
          <button class="${QP_CLASSES.BTN_PRIMARY}" id="${QP_ELEMENT_IDS.SAVE_SETTINGS}">Save</button>
        </div>
      </div>
    `;
}

function buildHelpModalHtml() {
  return `
      <div class="${QP_CLASSES.MODAL_BACKDROP}"></div>
      <div class="${QP_CLASSES.MODAL_CONTENT}">
        <div class="pastecraft-modal-header">
          <h3>❓ Quick Paste Help & Information</h3>
          <div class="${QP_CLASSES.MODAL_ACTIONS}">
            <button class="${QP_CLASSES.BACK_BTN}" title="Back to Settings">←</button>
            <button class="${QP_CLASSES.MODAL_CLOSE}">×</button>
          </div>
        </div>
        <div class="pastecraft-modal-body help-content">
          <div class="help-section">
            <h4>⚡ Interface Behavior</h4>
            <div class="help-item">
              <strong>Auto-hide after paste:</strong> Automatically closes the Quick Paste interface after pasting a clip, keeping your screen clean
            </div>
            <div class="help-item">
              <strong>Show timestamps:</strong> Displays how long ago each clip was saved (e.g., '2m ago', '1h ago') for better organization
            </div>
            <div class="help-item">
              <strong>Max clips to display:</strong> Controls how many clips appear in the interface (5-50). Fewer clips = faster loading
            </div>
          </div>
          <div class="help-section">
            <h4>📝 Text Processing Options</h4>
            <div class="help-item">
              <strong>Delimiter:</strong> Choose how to separate multiple clips when copying them together:
              <ul>
                <li><strong>Comma:</strong> "clip1, clip2, clip3"</li>
                <li><strong>Newline:</strong> Each clip on a new line</li>
                <li><strong>Space:</strong> "clip1 clip2 clip3"</li>
                <li><strong>Custom:</strong> Define your own separator</li>
              </ul>
            </div>
            <div class="help-item">
              <strong>🔄 Deduplicate:</strong> Automatically removes duplicate clips when copying multiple selections, preventing repetition
            </div>
            <div class="help-item">
              <strong>⬆️ Sort A→Z:</strong> Alphabetically sorts clips when copying multiple selections for consistent organization
            </div>
            <div class="help-item">
              <strong>Aa UPPERCASE:</strong> Converts all text to uppercase when copying multiple selections for emphasis
            </div>
          </div>
          <div class="help-section">
            <h4>💡 Pro Tips</h4>
            <div class="help-item">
              • Drag the interface header to move it anywhere on the page
            </div>
            <div class="help-item">
              • Use keyboard shortcuts for faster access (configure in main settings)
            </div>
            <div class="help-item">
              • Organize clips into categories for better management
            </div>
            <div class="help-item">
              • Enable auto-hide to keep your workflow uninterrupted
            </div>
          </div>
        </div>
        <div class="pastecraft-modal-actions">
          <button class="${QP_CLASSES.BTN_PRIMARY}" id="${QP_ELEMENT_IDS.BACK_TO_SETTINGS}">← Back to Settings</button>
        </div>
      </div>
    `;
}

function bindHideOnClick(el, hideFn) {
  if (!el) return;
  el.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideFn();
  });
}

/** Wire help modal close / back / backdrop. */
export function setupQuickPasteHelpModalEvents(qp) {
  if (!qp.helpModal) return;
  bindHideOnClick(qp.helpModal.querySelector(`.${QP_CLASSES.MODAL_CLOSE}`), () => hideQuickPasteHelpModal(qp));
  bindHideOnClick(qp.helpModal.querySelector(`.${QP_CLASSES.BACK_BTN}`), () => hideQuickPasteHelpModal(qp));
  bindHideOnClick(qp.helpModal.querySelector(`#${QP_ELEMENT_IDS.BACK_TO_SETTINGS}`), () => hideQuickPasteHelpModal(qp));
  bindHideOnClick(qp.helpModal.querySelector(`.${QP_CLASSES.MODAL_BACKDROP}`), () => hideQuickPasteHelpModal(qp));
}

function setHelpBtnExpanded(qp, expanded) {
  const helpBtn = qp.settingsModal?.querySelector(`.${QP_CLASSES.HELP_BTN}`);
  if (!helpBtn) return;
  if (expanded) {
    helpBtn.classList.add(QP_CLASSES.ACTIVE);
    helpBtn.setAttribute('aria-expanded', 'true');
    return;
  }
  helpBtn.classList.remove(QP_CLASSES.ACTIVE);
  helpBtn.setAttribute('aria-expanded', 'false');
}

/** Show help above settings (settings stays open, non-interactive). */
export function showQuickPasteHelpModal(qp) {
  if (!qp.helpModal) return;
  const root = qp.shadowMount?.root;
  if (root && qp.helpModal.parentNode === root) {
    root.appendChild(qp.helpModal);
  }
  qp.helpModal.style.cssText = HELP_SHELL_CSS;
  qp.helpModal.classList.add('is-open');
  if (qp.settingsModal) {
    qp.settingsModal.style.pointerEvents = 'none';
    qp.settingsModal.classList.add('help-open');
  }
  setHelpBtnExpanded(qp, true);
}

export function hideQuickPasteHelpModal(qp) {
  if (!qp.helpModal) return;
  qp.helpModal.style.display = 'none';
  qp.helpModal.classList.remove('is-open');
  if (qp.settingsModal) {
    qp.settingsModal.style.pointerEvents = '';
    qp.settingsModal.classList.remove('help-open');
  }
  setHelpBtnExpanded(qp, false);
}

/** Layout-only shell — colors live in qp.styles.js (theme class on modal). */
export function applyQuickPasteSettingsModalShellStyles(qp) {
  if (!qp.settingsModal) return;
  qp.settingsModal.style.cssText = MODAL_SHELL_CSS;
}

function onDelimiterSegmentClick(qp, e) {
  if (!e.target.classList.contains(QP_CLASSES.SEGMENT_BTN)) return;
  qp.settingsModal.querySelectorAll(`.${QP_CLASSES.SEGMENT_BTN}`).forEach((btn) => {
    btn.classList.remove(QP_CLASSES.ACTIVE);
  });
  e.target.classList.add(QP_CLASSES.ACTIVE);
  const customInput = qp.settingsModal.querySelector(`#${QP_ELEMENT_IDS.CUSTOM_DELIMITER}`);
  if (e.target.dataset.delimiter === QP_DELIMITER.CUSTOM) {
    customInput.style.display = 'block';
    customInput.focus();
    return;
  }
  customInput.style.display = 'none';
}

function bindOptionToggles(qp) {
  qp.settingsModal.querySelectorAll(`.${QP_CLASSES.TOGGLE}`).forEach((toggle) => {
    toggle.addEventListener('click', (e) => {
      const checkbox = toggle.querySelector('input[type="checkbox"]');
      if (e.target === checkbox) return;
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
}

function bindSettingsChrome(qp) {
  qp.settingsModal.querySelector(`.${QP_CLASSES.MODAL_CLOSE}`).addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideQuickPasteSettingsModal(qp);
  });

  qp.settingsModal.querySelector(`.${QP_CLASSES.HELP_BTN}`).addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showQuickPasteHelpModal(qp);
  });

  qp.settingsModal.querySelector(`.${QP_CLASSES.MODAL_BACKDROP}`).addEventListener('click', (e) => {
    if (qp.helpModal?.classList.contains('is-open')) return;
    e.preventDefault();
    e.stopPropagation();
    hideQuickPasteSettingsModal(qp);
  });

  qp.settingsModal.querySelector(`#${QP_ELEMENT_IDS.CANCEL_SETTINGS}`).addEventListener('click', () => {
    hideQuickPasteSettingsModal(qp);
  });

  qp.settingsModal.querySelector(`#${QP_ELEMENT_IDS.SAVE_SETTINGS}`).addEventListener('click', () => {
    saveQuickPasteSettingsFromModal(qp);
  });
}

/** Wire settings close/help/save + delimiter/toggles. */
export function setupQuickPasteSettingsModalEvents(qp) {
  if (!qp.settingsModal) return;
  bindSettingsChrome(qp);
  qp.settingsModal.querySelector(`#${QP_ELEMENT_IDS.DELIMITER_CONTROL}`).addEventListener('click', (e) => {
    onDelimiterSegmentClick(qp, e);
  });
  bindOptionToggles(qp);
}

function readModalSettingsInto(qp) {
  const modal = qp.settingsModal;
  qp.settings.autoHide = modal.querySelector(`#${QP_ELEMENT_IDS.AUTO_HIDE}`).checked;
  qp.settings.showTimestamps = modal.querySelector(`#${QP_ELEMENT_IDS.SHOW_TIMESTAMPS}`).checked;
  qp.settings.maxClipsDisplay = parseInt(modal.querySelector(`#${QP_ELEMENT_IDS.MAX_CLIPS}`).value, 10);

  const activeDelimiterBtn = modal.querySelector(`.${QP_CLASSES.SEGMENT_BTN}.${QP_CLASSES.ACTIVE}`);
  if (activeDelimiterBtn) {
    qp.settings.delimiter = activeDelimiterBtn.dataset.delimiter;
  }
  qp.settings.customDelimiter = modal.querySelector(`#${QP_ELEMENT_IDS.CUSTOM_DELIMITER}`).value;

  qp.settings.options.deduplicate = modal.querySelector(`#${QP_ELEMENT_IDS.DEDUPLICATE}`).checked;
  qp.settings.options.sort = modal.querySelector(`#${QP_ELEMENT_IDS.SORT}`).checked;
  qp.settings.options.uppercase = modal.querySelector(`#${QP_ELEMENT_IDS.UPPERCASE}`).checked;
}

export async function saveQuickPasteSettingsFromModal(qp) {
  if (!qp.settingsModal) return;
  readModalSettingsInto(qp);
  await qp.saveSettings();
  qp.applySettings();
  qp.updateInterface();
  hideQuickPasteSettingsModal(qp);
  qp.showToast('Settings saved!', 'success');
}

export function hideQuickPasteSettingsModal(qp) {
  hideQuickPasteHelpModal(qp);
  if (qp.helpModal) {
    qp.helpModal.remove();
    qp.helpModal = null;
  }
  if (qp.settingsModal) {
    qp.settingsModal.remove();
    qp.settingsModal = null;
  }
}

function createThemedModal(className, themeClass, html) {
  const el = document.createElement('div');
  el.className = `${className} ${themeClass}`;
  el.innerHTML = html;
  return el;
}

/** Open settings + help modals inside the Quick Paste shadow root. */
export function showQuickPasteSettingsModal(qp) {
  if (qp.settingsModal) {
    qp.settingsModal.remove();
  }

  const themeClass = resolveQuickPasteTheme(qp.settings.theme);
  qp.settingsModal = createThemedModal(
    QP_CLASSES.SETTINGS_MODAL,
    themeClass,
    buildSettingsModalHtml(qp.settings),
  );
  qp.helpModal = createThemedModal(
    QP_CLASSES.HELP_MODAL,
    themeClass,
    buildHelpModalHtml(),
  );

  const root = qp.shadowMount?.root;
  if (!root) {
    console.error('❌ Quick Paste shadow root missing; cannot open settings');
    return;
  }
  root.appendChild(qp.settingsModal);
  root.appendChild(qp.helpModal);

  applyQuickPasteSettingsModalShellStyles(qp);
  setupQuickPasteSettingsModalEvents(qp);
  setupQuickPasteHelpModalEvents(qp);
}
