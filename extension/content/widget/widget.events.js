import { safeRuntimeSendMessage } from '../shared.js';
import { sanitizeWidgetSettings } from './widget.settings.js';
import { applyCaptureToolsStorageChange } from './widget.capture-stats.js';

export function setupWidgetStorageSync(widget) {
  if (widget._storageSyncListener) return;

  widget._storageSyncListener = (changes, area) => {
    if (area !== 'local') return;

    let settingsRefreshNeeded = false;

    if (changes.widgetSettings) {
      const next = sanitizeWidgetSettings(changes.widgetSettings.newValue);
      if (next && typeof next === 'object') {
        widget.settings = { ...widget.settings, ...next };
      }
      try { widget.applyWidgetIcon(); } catch (_) {}
      if (widget.settings && widget.settings.clickAndDragEnabled === false) {
        widget.hideClickAndDragDropBox(true);
      }
      settingsRefreshNeeded = true;
    }

    if (changes.autoDeletePeriod || changes.quickPasteSettings || changes.albumAttachmentOpenMode) {
      settingsRefreshNeeded = true;
      if (widget.openStates.settings) {
        widget.loadSettings().catch(() => {});
      }
    }

    if (changes.userProfile && widget.settings && widget.settings.widgetIconUseProfileImage) {
      try { widget.applyWidgetIcon(); } catch (_) {}
    }

    if ((changes.clips || changes.searchOnlyClips) && widget.openStates.quickView) {
      const quickViewIframe = document.querySelector('.pastecraft-quickview-iframe');
      if (quickViewIframe?.contentWindow) {
        safeRuntimeSendMessage({ action: 'pcGetQuickViewClips' })
          .then((response) => {
            const clips = response?.success && Array.isArray(response.clips) ? response.clips : [];
            if (quickViewIframe.contentWindow) {
              quickViewIframe.contentWindow.postMessage(
                { type: 'quickview-clips-data', clips },
                '*'
              );
            }
          })
          .catch(() => {});
      }
    }

    if (changes.widgetPosition) {
      const nextPos = changes.widgetPosition.newValue;
      if (nextPos && typeof nextPos === 'object') {
        widget.position = nextPos;
        if (widget.widget && typeof widget.position.top === 'number') {
          widget.widget.style.top = widget.position.top + '%';
        }
      }
    }

    let autoCopyUiChanged = false;

    if (changes.autoCopyEnabled) {
      widget.autoCopyEnabled = !!changes.autoCopyEnabled.newValue;
      autoCopyUiChanged = true;
    }

    if (changes.autoCopyCount || changes.autoCopyDate) {
      const today = new Date().toDateString();
      const nextDate = changes.autoCopyDate ? changes.autoCopyDate.newValue : undefined;
      const nextCount = changes.autoCopyCount ? changes.autoCopyCount.newValue : undefined;

      if (nextDate && nextDate !== today) {
        widget.autoCopyCount = 0;
      } else if (typeof nextCount === 'number') {
        widget.autoCopyCount = nextCount;
      }
      autoCopyUiChanged = true;
    }

    if (autoCopyUiChanged) {
      updateWidgetAutoCopyUI(widget);
    }

    applyCaptureToolsStorageChange(widget, changes);

    if (settingsRefreshNeeded && widget.openStates.settings) {
      // Settings UI refresh handled via loadSettings() above when panel is open.
    }
  };

  chrome.storage.onChanged.addListener(widget._storageSyncListener);
}

export function updateWidgetAutoCopyUI(widget) {
  if (!widget.widget) return;

  const toggle = widget.widget.querySelector('.auto-copy-toggle');
  const label = toggle?.querySelector('.toggle-label');
  if (toggle && label) {
    toggle.setAttribute('data-state', widget.autoCopyEnabled ? 'on' : 'off');
    label.textContent = widget.autoCopyEnabled ? 'ON' : 'OFF';
  }

  updateWidgetAutoCopyCounter(widget);
}

export function updateWidgetAutoCopyCounter(widget) {
  const counter = widget.widget.querySelector('.auto-copy-counter');
  if (counter) {
    counter.textContent = `${widget.autoCopyCount} clip${widget.autoCopyCount !== 1 ? 's' : ''}`;
    counter.style.transform = 'scale(1.2)';
    setTimeout(() => {
      counter.style.transform = 'scale(1)';
    }, 200);
  }
}

export async function loadWidgetAutoCopyState(widget) {
  try {
    const result = await chrome.storage.local.get(['autoCopyEnabled', 'autoCopyCount', 'autoCopyDate']);

    const today = new Date().toDateString();
    if (result.autoCopyDate !== today) {
      widget.autoCopyCount = 0;
    } else {
      widget.autoCopyCount = result.autoCopyCount || 0;
    }

    widget.autoCopyEnabled = result.autoCopyEnabled || false;

    updateWidgetAutoCopyUI(widget);
    console.log('📋 Auto-copy state loaded:', widget.autoCopyEnabled, 'Count:', widget.autoCopyCount);
  } catch (error) {
    console.error('Failed to load auto-copy state:', error);
  }
}

export function toggleWidgetAutoCopy(widget) {
  const toggle = widget.widget.querySelector('.auto-copy-toggle');
  const label = toggle.querySelector('.toggle-label');
  const currentState = toggle.getAttribute('data-state');
  const newState = currentState === 'on' ? 'off' : 'on';

  toggle.setAttribute('data-state', newState);
  label.textContent = newState.toUpperCase();
  widget.autoCopyEnabled = newState === 'on';

  chrome.storage.local.set({ autoCopyEnabled: widget.autoCopyEnabled });

  console.log(`🔄 Auto Copy: ${newState.toUpperCase()}`);

  if (widget.autoCopyEnabled) {
    widget.showWidgetToast('Auto-copy ON - copied text will be saved');
  } else {
    widget.showWidgetToast('Auto-copy OFF');
  }
}

export function setupWidgetAutoCopyListener(widget) {
  const handler = async (e) => {
    if (!widget.autoCopyEnabled) return;

    const MAX_TEXT = 30000;
    const MAX_HTML = 50000;
    const MAX_IMAGE_BYTES = 600 * 1024;

    const cd = e && e.clipboardData ? e.clipboardData : null;

    const safeTrim = (s, max) => {
      const str = String(s ?? '');
      if (str.length <= max) return str;
      return str.slice(0, max) + '…';
    };

    const isProbablyUrl = (s) => {
      const t = String(s || '').trim();
      if (!t) return false;
      try {
        const u = new URL(t);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch (_) {
        return false;
      }
    };

    const plain = cd ? (cd.getData('text/plain') || '') : '';
    const html = cd ? (cd.getData('text/html') || '') : '';
    const selection = window.getSelection ? String(window.getSelection().toString() || '') : '';

    let textToSave = (plain || selection || '').trim();

    const meta = {
      kind: 'text',
      plainText: safeTrim(textToSave, MAX_TEXT),
      html: html ? safeTrim(html, MAX_HTML) : '',
      url: isProbablyUrl(textToSave) ? textToSave.trim() : '',
      image: null,
      sourcePageUrl: (typeof location !== 'undefined' && location.href) ? location.href : '',
      capturedAt: Date.now()
    };

    if (meta.url) meta.kind = 'url';
    if (meta.html && !meta.url) meta.kind = 'html';

    try {
      if (cd && cd.items && cd.items.length) {
        for (let i = 0; i < cd.items.length; i++) {
          const it = cd.items[i];
          const type = String(it && it.type ? it.type : '');
          if (type.startsWith('image/')) {
            const file = it.getAsFile ? it.getAsFile() : null;
            if (!file) continue;
            if (typeof file.size === 'number' && file.size > MAX_IMAGE_BYTES) {
              meta.image = { mime: type, dataUrl: '', srcUrl: '', tooLarge: true, size: file.size };
              meta.kind = 'image';
              if (!textToSave) textToSave = '[Image]';
              break;
            }

            const dataUrl = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || ''));
              reader.onerror = () => resolve('');
              reader.readAsDataURL(file);
            });

            if (dataUrl) {
              meta.image = { mime: type, dataUrl, srcUrl: '' };
              meta.kind = 'image';
              if (!textToSave) textToSave = '[Image]';
              meta.plainText = safeTrim(textToSave, MAX_TEXT);
            }
            break;
          }
        }
      }
    } catch (err) {
      console.warn('⚠️ Auto-copy image capture failed:', err?.message || err);
    }

    if (!textToSave && !(meta && meta.kind === 'image')) return;

    console.log('📋 Auto-copy detected:', textToSave.substring(0, 50) + '...');

    try {
      await safeRuntimeSendMessage({
        action: 'saveClip',
        text: safeTrim(textToSave, MAX_TEXT),
        meta,
        category: 'Uncategorized',
        autoShow: false
      });

      widget.autoCopyCount++;
      updateWidgetAutoCopyCounter(widget);

      chrome.storage.local.set({
        autoCopyCount: widget.autoCopyCount,
        autoCopyDate: new Date().toDateString()
      });

      console.log('✅ Auto-copied to PasteCraft!');
    } catch (error) {
      console.error('❌ Auto-copy failed:', error);
    }
  };

  document.addEventListener('copy', handler, true);
}
