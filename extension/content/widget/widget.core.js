import { pastecraftGetURL, isExtensionContextValid } from '../shared.js';
import { createClosedShadowHost } from '../safety/shadow-host.js';
import { injectWidgetStyles } from './widget.styles.js';
import { loadWidgetSettings } from './widget.settings.js';
import {
  setupWidgetAutoCopyListener,
  loadWidgetAutoCopyState,
} from './widget.events.js';

export function createWidgetShell(widget) {
  if (!widget.shadowMount) {
    widget.shadowMount = createClosedShadowHost('pc-widget-host');
    widget.shadowMount.host.style.pointerEvents = 'auto';
  }
  const root = widget.shadowMount.root;

  widget.widget = document.createElement('div');
  widget.widget.setAttribute('data-field', 'pastecraft-floating-widget');
  widget.widget.className = 'pastecraft-widget';

  widget.widget.innerHTML = `
      <div class="pastecraft-widget-inner">
        <!-- Component 1: Logo Button -->
        <div class="widget-component logo-button" data-tooltip="Open PasteCraft">
          <img src="${pastecraftGetURL('logo.svg')}" alt="PasteCraft" class="widget-logo">
        </div>
        
        <!-- Component 2: Settings Button -->
        <div class="widget-component settings-button" data-tooltip="Settings">
          <span class="widget-icon">⚙️</span>
        </div>
        
        <!-- Component 3: Auto Copy Toggle -->
        <div class="widget-component auto-copy-section" data-tooltip="Auto Copy">
          <div class="auto-copy-toggle" data-state="off">
            <span class="toggle-label">OFF</span>
          </div>
          <div class="auto-copy-counter">0 clips</div>
        </div>
        
        <!-- Component 4: Quick View Button -->
        <div class="widget-component quick-view-button" data-tooltip="Quick View Menu" role="button" tabindex="0" aria-label="Open Quick View Menu">
          <div class="eye-icon-wrap">
            <svg class="eye-svg" xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <g class="eye-drawing">
                <path class="eye-outline" d="M5 32C11 20 20 14 32 14s21 6 27 18c-6 12-15 18-27 18S11 44 5 32Z"/>
                <circle class="eye-pupil" cx="32" cy="32" r="10"/>
              </g>
            </svg>
          </div>
        </div>
      </div>
    `;

  injectWidgetStyles(root);

  widget.widget.style.visibility = 'hidden';

  root.appendChild(widget.widget);

  widget.widget.addEventListener('click', (e) => {
    console.log('🖱️ Widget clicked! Target:', e.target.className);
  });

  setupWidgetEventListeners(widget);
}

export function setupWidgetEventListeners(widget) {
  console.log('🎯 Setting up widget event listeners...');
  console.log('🔍 Widget element:', widget.widget);
  console.log('🔍 Widget innerHTML sample:', widget.widget?.innerHTML?.substring(0, 200));

  const logoButton = widget.widget.querySelector('.logo-button');
  if (logoButton) {
    logoButton.addEventListener('click', () => {
      console.log('🎨 Logo button clicked!');
      if (String(widget.settings?.appOpenMode || 'inPage') === 'edgePopup') {
        try {
          chrome.runtime.sendMessage({
            action: 'pcOpenPopupWindow',
            page: 'popup.html',
            width: 520,
            height: 760
          });
        } catch (_) {}
        return;
      }
      if (widget.openStates.popup) {
        widget.closePopupOverlay();
      } else {
        widget.openPopupOverlay();
      }
    });
    console.log('✅ Logo button listener attached');
  } else {
    console.error('❌ Logo button not found!');
  }

  const settingsButton = widget.widget.querySelector('.settings-button');
  if (settingsButton) {
    settingsButton.addEventListener('click', () => {
      console.log('⚙️ Settings button clicked!');
      if (widget.openStates.settings) {
        widget.closeSettings();
      } else {
        widget.openSettings();
      }
    });
    console.log('✅ Settings button listener attached');
  }

  const autoToggle = widget.widget.querySelector('.auto-copy-toggle');
  if (autoToggle) {
    autoToggle.addEventListener('click', () => {
      console.log('🔄 Toggle clicked!');
      widget.toggleAutoCopy();
    });
    console.log('✅ Auto toggle listener attached');
  }

  const quickViewButton = widget.widget.querySelector('.quick-view-button');
  if (quickViewButton) {
    const toggleQuickView = () => {
      console.log('👁️ Quick View button clicked!');
      if (widget.openStates.quickView) {
        widget.closeQuickView();
      } else {
        widget.openQuickView();
      }
    };

    quickViewButton.addEventListener('click', toggleQuickView);
    quickViewButton.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      toggleQuickView();
    });
    console.log('✅ Quick View button listener attached');
  }

  console.log('🎯 All event listeners setup complete!');
}

export function setupWidgetDrag(widget) {
  if (!widget.widget) return;
  if (widget._widgetDragBound) return;
  widget._widgetDragBound = true;

  let dragging = false;
  let pointerStartY = 0;
  let startTopPct = 0;
  const DRAG_THRESHOLD = 4;
  let moved = false;

  const onMove = (e) => {
    if (!dragging) return;
    const dy = e.clientY - pointerStartY;
    if (!moved && Math.abs(dy) < DRAG_THRESHOLD) return;
    moved = true;
    widget.widget.classList.add('pc-dragging');

    const vh = window.innerHeight || 1;
    let nextPct = startTopPct + (dy / vh) * 100;
    const widgetH = widget.widget.offsetHeight || 0;
    const minPct = (widgetH / 2 / vh) * 100;
    const maxPct = 100 - minPct;
    nextPct = Math.max(minPct, Math.min(nextPct, maxPct));

    widget.widget.style.top = nextPct + '%';
    widget.position.top = nextPct;
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    widget.widget.classList.remove('pc-dragging');
    document.body.style.userSelect = '';
    if (moved) {
      saveWidgetPosition(widget);
    }
  };

  widget.widget.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.widget-component')) return;
    if (e.button !== 0) return;

    dragging = true;
    moved = false;
    pointerStartY = e.clientY;
    startTopPct = widget.position.top ?? 50;

    try { widget.widget.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
    document.body.style.userSelect = 'none';
  });

  widget.widget.addEventListener('pointermove', onMove);
  widget.widget.addEventListener('pointerup', onUp);
  widget.widget.addEventListener('pointercancel', onUp);
}

export function loadSavedWidgetPosition(widget) {
  const revealWidget = () => {
    if (widget.widget) {
      widget.widget.style.visibility = 'visible';
    }
  };

  if (!isExtensionContextValid()) {
    revealWidget();
    return;
  }

  try {
    chrome.storage.local.get(['widgetPosition'], (result) => {
      if (result.widgetPosition && widget.widget) {
        widget.position = result.widgetPosition;
        widget.widget.style.top = widget.position.top + '%';
        console.log('📍 Widget position loaded:', widget.position.top + '%');
      }
      revealWidget();
    });
  } catch (_) {
    revealWidget();
  }

  setTimeout(revealWidget, 800);
}

export function saveWidgetPosition(widget) {
  if (!isExtensionContextValid()) return;
  try {
    chrome.storage.local.set({ widgetPosition: widget.position });
  } catch (_) {}
}

export async function initWidgetAsync(widget) {
  await loadWidgetSettings(widget);
  try { await widget.applyWidgetIcon(); } catch (_) {}
  await loadWidgetAutoCopyState(widget);
  setupWidgetAutoCopyListener(widget);
  console.log('🎨 PasteCraft Floating Widget initialized with settings:', widget.settings);
}
