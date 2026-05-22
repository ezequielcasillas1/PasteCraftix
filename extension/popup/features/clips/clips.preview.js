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

export function updatePreview(app) {
  const previewArea = document.getElementById('previewArea');
  if (!previewArea) return;

  const clipPool = getClipPoolForPreview(app);
  const orderedIds = app.getSelectedClipIdsInUiOrder();
  const selectedTexts = orderedIds
    .map(id => clipPool.find(c => app._clipIdKey(c?.id) === id)?.text)
    .filter(Boolean);

  if (selectedTexts.length === 0) {
    if (!app.previewIsManual && app.previewLastAutoValue) {
      previewArea.value = '';
      app.previewLastAutoValue = '';
    }
    return;
  }

  let processedTexts = [...selectedTexts];

  if (app.options.deduplicate) {
    processedTexts = [...new Set(processedTexts)];
  }

  if (app.options.sort) {
    processedTexts.sort();
  }

  if (app.options.uppercase) {
    processedTexts = processedTexts.map(t => t.toUpperCase());
  }

  const delimiters = {
    comma: ', ',
    newline: '\n',
    space: ' ',
    pipe: ' | ',
    custom: document.getElementById('customDelimiter')?.value || ', '
  };

  const output = processedTexts.join(delimiters[app.delimiter] || ', ');
  previewArea.value = output;
  app.previewIsManual = false;
  app.previewLastAutoValue = output;

  app.updateQuickCopyButton();
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
