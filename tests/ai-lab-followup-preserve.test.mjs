import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const url = pathToFileURL(
  join(root, 'extension/popup/features/ai-lab/ai-lab.summary.js'),
).href;

const { applyFollowupComposerAfterSend } = await import(url);

function mockComposer(initialValue) {
  return {
    inputEl: { value: initialValue, disabled: true },
    btnEl: { disabled: true },
  };
}

{
  const { inputEl, btnEl } = mockComposer('Why did this fail?');
  const result = applyFollowupComposerAfterSend({
    inputEl,
    btnEl,
    success: false,
  });
  assert.equal(inputEl.value, 'Why did this fail?');
  assert.equal(inputEl.disabled, false);
  assert.equal(btnEl.disabled, false);
  assert.equal(result.cleared, false);
  assert.equal(result.preserved, true);
}

{
  const { inputEl, btnEl } = mockComposer('Thanks, that worked');
  const result = applyFollowupComposerAfterSend({
    inputEl,
    btnEl,
    success: true,
  });
  assert.equal(inputEl.value, '');
  assert.equal(inputEl.disabled, false);
  assert.equal(btnEl.disabled, true);
  assert.equal(result.cleared, true);
  assert.equal(result.preserved, false);
}

{
  let levelTabsEnabled = null;
  const { inputEl, btnEl } = mockComposer('Retry after model switch');
  applyFollowupComposerAfterSend({
    inputEl,
    btnEl,
    success: false,
    toggleLevelTabs: (enable) => {
      levelTabsEnabled = enable;
    },
  });
  assert.equal(levelTabsEnabled, true);
  assert.equal(inputEl.value, 'Retry after model switch');
}

console.log('ai-lab-followup-preserve.test.mjs: ok');
