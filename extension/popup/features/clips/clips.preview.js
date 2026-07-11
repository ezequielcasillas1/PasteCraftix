export function syncOptionToggles(app) {
  const deduplicateToggle = document.getElementById('deduplicateToggle');
  const sortToggle = document.getElementById('sortToggle');
  const uppercaseToggle = document.getElementById('uppercaseToggle');

  if (deduplicateToggle) deduplicateToggle.checked = app.options.deduplicate;
  if (sortToggle) sortToggle.checked = app.options.sort;
  if (uppercaseToggle) uppercaseToggle.checked = app.options.uppercase;
}

function getClipPoolForPreview(app) {
  const active = Array.isArray(app.clips) ? app.clips : [];
  const archived = Array.isArray(app.searchOnlyClips) ? app.searchOnlyClips : [];
  return [...active, ...archived];
}

export function buildClipTextIndex(app) {
  const textById = new Map();
  getClipPoolForPreview(app).forEach((clip) => {
    const id = app._clipIdKey(clip?.id);
    if (id && !textById.has(id)) textById.set(id, clip?.text);
  });
  return textById;
}

export function getSelectedPreviewTexts(app) {
  const textById = buildClipTextIndex(app);
  return app.getSelectedClipIdsInUiOrder()
    .map((id) => textById.get(id))
    .filter(Boolean);
}

function clearGeneratedPreview(app, previewArea) {
  if (app.previewIsManual || !app.previewLastAutoValue) return;
  previewArea.value = '';
  app.previewLastAutoValue = '';
}

function applyPreviewTransforms(texts, options) {
  let result = [...texts];
  if (options.deduplicate) result = [...new Set(result)];
  if (options.sort) result.sort();
  if (options.uppercase) result = result.map((text) => text.toUpperCase());
  return result;
}

function getPreviewDelimiter(app) {
  const delimiters = {
    comma: ', ',
    newline: '\n',
    space: ' ',
    pipe: ' | ',
    custom: document.getElementById('customDelimiter')?.value || ', '
  };
  return delimiters[app.delimiter] || ', ';
}

function writeGeneratedPreview(app, previewArea, output) {
  previewArea.value = output;
  app.previewIsManual = false;
  app.previewLastAutoValue = output;
  app.updateQuickCopyButton();
}

export function updatePreview(app) {
  const previewArea = document.getElementById('previewArea');
  if (!previewArea) return;

  const selectedTexts = getSelectedPreviewTexts(app);
  if (selectedTexts.length === 0) {
    clearGeneratedPreview(app, previewArea);
    return;
  }
  const processedTexts = applyPreviewTransforms(selectedTexts, app.options);
  writeGeneratedPreview(app, previewArea, processedTexts.join(getPreviewDelimiter(app)));
}

export function updateDelimiterExample(app) {
  const exampleText = document.querySelector('.example-text');
  if (!exampleText) return;

  const delimiters = {
    comma: ', ',
    newline: '\n',
    space: ' ',
    custom: document.getElementById('customDelimiter')?.value || ' | '
  };

  const delimiter = delimiters[app.delimiter] || ', ';
  const items = ['apple', 'banana', 'cherry'];

  if (app.delimiter === 'newline') {
    exampleText.textContent = 'apple ? banana ? cherry';
  } else {
    exampleText.textContent = items.join(delimiter);
  }
}
