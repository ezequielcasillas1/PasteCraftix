import { createClosedShadowHost } from '../safety/shadow-host.js';
import { injectSettingsStyles } from './widget.styles.js';

export function sanitizeWidgetSettings(rawSettings) {
  const settings = (rawSettings && typeof rawSettings === 'object') ? { ...rawSettings } : {};

  delete settings.aiHelperEnabled;
  delete settings.aiHelperRuleTipsEnabled;
  delete settings.aiHelperAiTipsEnabled;
  delete settings.aiHelperShowOnCopyOnly;
  delete settings.aiHelperMode;
  delete settings.aiHelperPlacement;
  delete settings.aiHelperUserPositioned;
  delete settings.aiHelperUserPosition;

  return settings;
}

export async function loadWidgetSettings(widget) {
  try {
    const result = await chrome.storage.local.get(['widgetSettings']);
    if (result.widgetSettings) {
      widget.settings = { ...widget.settings, ...sanitizeWidgetSettings(result.widgetSettings) };
    }
    console.log('📝 Widget settings loaded:', widget.settings);
  } catch (error) {
    console.error('Error loading widget settings:', error);
  } finally {
    widget._settingsLoaded = true;
  }
}

export async function saveWidgetSettings(widget) {
  try {
    const nextSettings = sanitizeWidgetSettings(widget.settings);
    widget.settings = { ...nextSettings };
    await chrome.storage.local.set({ widgetSettings: nextSettings });
    console.log('💾 Widget settings saved:', widget.settings);
  } catch (error) {
    console.error('Error saving widget settings:', error);
  }
}

export function ensureSettingsShadowMount(widget) {
  if (widget._settingsShadowMount) return widget._settingsShadowMount;

  const mount = createClosedShadowHost('pc-settings-host');
  mount.host.style.pointerEvents = 'none';
  widget._settingsShadowMount = mount;
  injectSettingsStyles(mount.root);
  return mount;
}

export function isPointerInsideSettingsPanel(widget, e) {
  const mount = widget._settingsShadowMount;
  const panel = widget._settingsPanelEl;
  if (!mount || !panel) return false;

  const target = e?.target;
  if (target === mount.host) return true;

  const path = typeof e?.composedPath === 'function' ? e.composedPath() : [];
  if (path.includes(panel) || path.includes(mount.root) || path.includes(mount.host)) {
    return true;
  }

  return false;
}

export function openSettingsPanel(widget) {
  console.log('⚙️ Opening settings panel');

  const mount = ensureSettingsShadowMount(widget);

  if (mount.root.querySelector('#pastecraft-settings-panel')) {
    return;
  }

  widget.openStates.settings = true;
  widget.widget.classList.add('panel-open');
  widget.syncPageDocking();

  const settingsButton = widget.widget.querySelector('.settings-button');
  if (settingsButton) {
    settingsButton.classList.add('active');
  }

  const backdrop = document.createElement('div');
  backdrop.id = 'pastecraft-settings-backdrop';
  backdrop.className = 'pastecraft-settings-backdrop';

  const panel = document.createElement('div');
  panel.id = 'pastecraft-settings-panel';
  panel.className = 'pastecraft-settings-panel';

  panel.innerHTML = `
      <div class="settings-header">
        <h3>Widget Settings</h3>
        <button class="settings-close" aria-label="Close">×</button>
      </div>
      
      <div class="settings-content">
        <div class="settings-section">
          <h4>Open Mode</h4>
          
          <div class="setting-item setting-item--with-select">
            <div class="setting-info">
              <label for="appOpenMode">Open PasteCraft in</label>
              <p class="setting-desc">Choose between the in-page panel or a separate popup window</p>
            </div>
            <select id="appOpenMode" class="pc-settings-select" aria-label="Open PasteCraft in">
              <option value="inPage" ${String(widget.settings.appOpenMode || 'inPage') === 'inPage' ? 'selected' : ''}>In-page panel (default)</option>
              <option value="edgePopup" ${String(widget.settings.appOpenMode || '') === 'edgePopup' ? 'selected' : ''}>Popup window (separate)</option>
            </select>
          </div>
        </div>

        <div class="settings-section">
          <h4>Popup Behavior</h4>
          
          <div class="setting-item">
            <div class="setting-info">
              <label>Keep popup open when clicking pages</label>
              <p class="setting-desc">Popup stays open even when you interact with websites</p>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="keepPopupOpen" ${widget.settings.keepPopupOpen ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          
          <div class="setting-item">
            <div class="setting-info">
              <label>Keep Quick View open when clicking pages</label>
              <p class="setting-desc">Quick View menu stays visible during page interaction</p>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="keepQuickViewOpen" ${widget.settings.keepQuickViewOpen ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div class="settings-section">
          <h4>Capture</h4>

          <div class="setting-item">
            <div class="setting-info">
              <label>Enable Click & Drag capture</label>
              <p class="setting-desc">Drag text, links, or images into a drop box to save to Clips</p>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="clickAndDragEnabled" ${widget.settings.clickAndDragEnabled ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
    `;

  mount.host.style.pointerEvents = 'auto';
  widget._settingsPanelEl = panel;

  mount.root.appendChild(backdrop);
  mount.root.appendChild(panel);

  const closeBtn = panel.querySelector('.settings-close');
  closeBtn.addEventListener('click', () => closeSettingsPanel(widget));

  if (widget._settingsOutsidePointerDown) {
    document.removeEventListener('pointerdown', widget._settingsOutsidePointerDown, false);
    widget._settingsOutsidePointerDown = null;
  }
  widget._settingsOutsidePointerDown = (e) => {
    if (!widget.openStates.settings || !widget._settingsPanelEl) return;
    if (isPointerInsideSettingsPanel(widget, e)) return;
    if (widget._isPointerInsideWidget(e)) return;
    closeSettingsPanel(widget);
  };
  document.addEventListener('pointerdown', widget._settingsOutsidePointerDown, false);

  const keepPopupToggle = panel.querySelector('#keepPopupOpen');
  const keepQuickViewToggle = panel.querySelector('#keepQuickViewOpen');
  const clickAndDragToggle = panel.querySelector('#clickAndDragEnabled');
  const appOpenModeSelect = panel.querySelector('#appOpenMode');

  appOpenModeSelect?.addEventListener('change', (e) => {
    const v = String(e.target.value || 'inPage');
    widget.settings.appOpenMode = v === 'edgePopup' ? 'edgePopup' : 'inPage';
    saveWidgetSettings(widget);
    widget.showWidgetToast(widget.settings.appOpenMode === 'edgePopup' ? 'Open: Popup window' : 'Open: In-page panel');
  });

  keepPopupToggle.addEventListener('change', (e) => {
    widget.settings.keepPopupOpen = e.target.checked;
    saveWidgetSettings(widget);
    console.log('📝 Keep popup open:', widget.settings.keepPopupOpen);
  });

  keepQuickViewToggle.addEventListener('change', (e) => {
    widget.settings.keepQuickViewOpen = e.target.checked;
    saveWidgetSettings(widget);
    console.log('📝 Keep Quick View open:', widget.settings.keepQuickViewOpen);
  });

  clickAndDragToggle.addEventListener('change', (e) => {
    widget.settings.clickAndDragEnabled = e.target.checked;
    saveWidgetSettings(widget);
    console.log('📝 Click & Drag enabled:', widget.settings.clickAndDragEnabled);
    widget.showWidgetToast(widget.settings.clickAndDragEnabled ? 'Click & Drag ON' : 'Click & Drag OFF');
  });

  setTimeout(() => {
    backdrop.classList.add('visible');
    panel.classList.add('visible');
    widget.syncPageDocking();
  }, 10);
}

export function closeSettingsPanel(widget) {
  const mount = widget._settingsShadowMount;
  const backdrop = mount?.root?.querySelector('#pastecraft-settings-backdrop');
  const panel = mount?.root?.querySelector('#pastecraft-settings-panel');

  if (widget._settingsOutsidePointerDown) {
    document.removeEventListener('pointerdown', widget._settingsOutsidePointerDown, false);
    widget._settingsOutsidePointerDown = null;
  }

  if (backdrop) backdrop.classList.remove('visible');
  if (panel) panel.classList.remove('visible');

  if (backdrop || panel) {
    setTimeout(() => {
      if (backdrop) backdrop.remove();
      if (panel) panel.remove();
    }, 300);

    widget.openStates.settings = false;
    widget._settingsPanelEl = null;
    if (mount) mount.host.style.pointerEvents = 'none';

    if (!widget.openStates.popup && !widget.openStates.quickView) {
      widget.widget.classList.remove('panel-open');
    }

    const settingsButton = widget.widget.querySelector('.settings-button');
    if (settingsButton) {
      settingsButton.classList.remove('active');
    }

    widget.syncPageDocking();
  }
}
