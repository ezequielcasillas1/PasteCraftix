import { formatClipViewerPlainText } from '../ai-lab/ai-lab.summary.js';
import {
  buildCombinedSearchQuery,
  isCustomSearchQueryValid,
  navigateToGoogleSearch,
} from './clips.custom-search.service.js';

const MODULE_ID = 'customSearchModule';
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getModuleElements() {
  return {
    module: document.getElementById(MODULE_ID),
    backBtn: document.getElementById('customSearchBackBtn'),
    clipPanel: document.getElementById('customSearchClipPanel'),
    highlightInput: document.getElementById('customSearchHighlightInput'),
    questionInput: document.getElementById('customSearchQuestionInput'),
    submitBtn: document.getElementById('customSearchSubmitBtn'),
  };
}

function getClipText(clip) {
  return String(clip?.text ?? '').trim();
}

function renderClipPanel(clipPanel, clip, app) {
  if (!clipPanel) return;
  const text = getClipText(clip);
  try {
    clipPanel.innerHTML = formatClipViewerPlainText.call(app, text);
  } catch (error) {
    console.error('[custom-search] Failed to render clip panel:', error);
    clipPanel.textContent = text || 'This clip is empty.';
  }
}

function resetInputs(app) {
  const { highlightInput, questionInput } = getModuleElements();
  if (highlightInput) highlightInput.value = '';
  if (questionInput) questionInput.value = '';
  app._customSearchHighlight = '';
  app._customSearchLastCaptured = '';
  updateSubmitState(app);
}

function updateSubmitState(app) {
  const { highlightInput, questionInput, submitBtn } = getModuleElements();
  const highlight = highlightInput?.value ?? app._customSearchHighlight ?? '';
  const question = questionInput?.value ?? '';
  const valid = isCustomSearchQueryValid(highlight, question);
  if (submitBtn) submitBtn.disabled = !valid;
}

function selectionIsInsideClipPanel(selection, clipPanel) {
  if (!selection || !clipPanel || selection.rangeCount === 0) return false;
  const anchor = selection.anchorNode;
  const focus = selection.focusNode;
  if (anchor && clipPanel.contains(anchor)) return true;
  if (focus && clipPanel.contains(focus)) return true;
  try {
    const range = selection.getRangeAt(0);
    return clipPanel.contains(range.commonAncestorContainer);
  } catch (_) {
    return false;
  }
}

function appendHighlightText(app, selected) {
  const { highlightInput } = getModuleElements();
  const current = String(highlightInput?.value ?? app._customSearchHighlight ?? '').trim();
  const next = current ? `${current} ${selected}` : selected;
  app._customSearchHighlight = next;
  if (highlightInput) highlightInput.value = next;
  updateSubmitState(app);
}

function captureClipSelection(app) {
  const { module, clipPanel } = getModuleElements();
  if (!module || module.hidden || !clipPanel) return;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;
  if (!selectionIsInsideClipPanel(selection, clipPanel)) return;

  const selected = selection.toString().trim();
  if (!selected) return;

  // mouseup + keyup can fire for one gesture — append once
  if (app._customSearchLastCaptured === selected) return;
  app._customSearchLastCaptured = selected;

  appendHighlightText(app, selected);
  try {
    selection.removeAllRanges();
  } catch (_) {}
}

function bindSelectionCapture(app) {
  if (app._customSearchSelectionBound) return;

  const onCapture = () => captureClipSelection(app);
  const onClipMouseDown = (event) => {
    const { clipPanel } = getModuleElements();
    if (clipPanel?.contains(event.target)) {
      // New drag/select gesture — allow the same phrase to append again
      app._customSearchLastCaptured = '';
    }
  };
  app._customSearchSelectionHandler = onCapture;
  app._customSearchMouseDownHandler = onClipMouseDown;
  // Document-level: drag-select often ends with mouseup outside the panel
  document.addEventListener('mouseup', onCapture);
  document.addEventListener('keyup', onCapture);
  document.addEventListener('mousedown', onClipMouseDown);
  app._customSearchSelectionBound = true;
}

function unbindSelectionCapture(app) {
  const handler = app._customSearchSelectionHandler;
  const mouseDownHandler = app._customSearchMouseDownHandler;
  if (handler) {
    document.removeEventListener('mouseup', handler);
    document.removeEventListener('keyup', handler);
  }
  if (mouseDownHandler) {
    document.removeEventListener('mousedown', mouseDownHandler);
  }
  app._customSearchSelectionHandler = null;
  app._customSearchMouseDownHandler = null;
  app._customSearchSelectionBound = false;
}

function setMainShellHidden(hidden) {
  const shell = document.getElementById('customSearchMainShell');
  if (!shell) return;
  shell.hidden = hidden;
}

function trapFocus(module) {
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      hideModuleFromApp(module._pcApp);
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = [...module.querySelectorAll(FOCUSABLE_SELECTOR)]
      .filter((el) => !el.disabled && el.offsetParent !== null);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  module._pcFocusTrap = handleKeyDown;
  document.addEventListener('keydown', handleKeyDown, true);
}

function releaseFocusTrap(module) {
  if (module?._pcFocusTrap) {
    document.removeEventListener('keydown', module._pcFocusTrap, true);
    module._pcFocusTrap = null;
  }
}

function restorePreviousTab(app) {
  const previousTab = app._customSearchPreviousTab;
  if (!previousTab) return;
  const tabBtn = document.querySelector(`.tab-btn[data-tab="${previousTab}"]`);
  if (tabBtn && app.currentTab !== previousTab) {
    tabBtn.click();
  }
}

function hideModuleFromApp(app) {
  const { module } = getModuleElements();
  if (!module) return;

  module.hidden = true;
  releaseFocusTrap(module);
  unbindSelectionCapture(app);
  setMainShellHidden(false);

  app._customSearchContext = null;
  app._customSearchHighlight = '';
  app._customSearchLastCaptured = '';
  app._customSearchPreviousTab = null;
  module._pcApp = null;

  restorePreviousTab(app);
}

export function hideModule(app) {
  hideModuleFromApp(app);
}

export function showModule(app, { clip = null, context = 'clips' } = {}) {
  const { module, clipPanel, questionInput } = getModuleElements();
  if (!module) {
    console.error('[custom-search] Module element not found');
    app.showToast?.('Custom Search unavailable', 'error');
    return;
  }
  if (!clip) {
    app.showToast?.('No clip to search', 'error');
    return;
  }

  try {
    app.clipsFeature?.viewer?.hide?.(app);

    app._customSearchContext = { clip, context };
    app._customSearchPreviousTab = app.currentTab || 'clips';
    app._customSearchHighlight = '';
    app._customSearchLastCaptured = '';

    setMainShellHidden(true);
    module.hidden = false;
    module._pcApp = app;

    renderClipPanel(clipPanel, clip, app);
    resetInputs(app);
    bindSelectionCapture(app);
    trapFocus(module);

    questionInput?.focus();
    window.renderLucideIcons?.(module);
  } catch (error) {
    console.error('[custom-search] Failed to open module:', error);
    unbindSelectionCapture(app);
    releaseFocusTrap(module);
    module.hidden = true;
    setMainShellHidden(false);
    app.showToast?.('Could not open Custom Search', 'error');
  }
}

async function handleSearch(app) {
  const { highlightInput, questionInput } = getModuleElements();
  const query = buildCombinedSearchQuery(
    highlightInput?.value ?? app._customSearchHighlight ?? '',
    questionInput?.value ?? '',
  );
  if (!query) {
    app.showToast?.('Enter a search query', 'error');
    return;
  }

  const opened = await navigateToGoogleSearch(query);
  if (opened) hideModule(app);
}

export function registerCustomSearchModuleEvents(app) {
  if (app._customSearchModuleEventsAttached) return;

  const { module, backBtn, highlightInput, questionInput, submitBtn } =
    getModuleElements();
  if (!module) return;

  backBtn?.addEventListener('click', () => hideModule(app));

  highlightInput?.addEventListener('input', () => updateSubmitState(app));
  questionInput?.addEventListener('input', () => updateSubmitState(app));
  questionInput?.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (submitBtn?.disabled) return;
    await handleSearch(app);
  });

  submitBtn?.addEventListener('click', async (event) => {
    event.preventDefault();
    await handleSearch(app);
  });

  app._customSearchModuleEventsAttached = true;
}
