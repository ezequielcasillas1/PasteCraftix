import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const url = pathToFileURL(
  join(root, 'extension/popup/features/ai-lab/ai-lab.model-error.js'),
).href;

const {
  MODEL_NOT_CAPABLE_MESSAGE,
  AI_SUMMARY_ERROR_BANNER_ID,
  isModelNotCapableError,
  formatModelNotCapableMessage,
  assertModelCapableForAction,
  modelSupportsVision,
  mountAiLabAlertCard,
  clearAiLabErrorBanner,
} = await import(url);

assert.ok(MODEL_NOT_CAPABLE_MESSAGE.includes('not capable'));
assert.ok(MODEL_NOT_CAPABLE_MESSAGE.includes('choose a different model'));
assert.equal(/vercel/i.test(MODEL_NOT_CAPABLE_MESSAGE), false);
assert.equal(AI_SUMMARY_ERROR_BANNER_ID, 'aiSummaryErrorBanner');

assert.equal(isModelNotCapableError({ message: 'model_not_found' }), true);
assert.equal(isModelNotCapableError({ message: 'AI provider rejected the summary request' }), true);
assert.equal(isModelNotCapableError({ isModelNotCapable: true }), true);
assert.equal(isModelNotCapableError({ message: 'No text credits remaining' }), false);
assert.equal(isModelNotCapableError({ message: 'Network timeout' }), false);

const luna = {
  id: 'gpt-5.6-luna',
  label: 'Luna Clip · GPT-5.6 Luna',
  supportsVision: true,
};
assert.equal(modelSupportsVision(luna), true);
assert.match(formatModelNotCapableMessage(luna), /Luna Clip · GPT-5.6 Luna/);
assert.match(formatModelNotCapableMessage(luna), /choose a different model/);

const pulse = {
  id: 'ling-3.0-flash',
  label: 'Pulse Lite · Ling 3.0 Flash',
  supportsVision: false,
};
assert.equal(modelSupportsVision(pulse), false);

const app = {
  aiWorkflow: { enabled: true, provider: 'inclusionai', preset: 'ling_flash' },
};
assert.throws(
  () => assertModelCapableForAction(app, 'vision'),
  (err) => err?.isModelNotCapable === true && /not capable/i.test(err.message),
);

// --- Bug 3: non-destructive banner mount (no workspace wipe) ---
{
  const bannerHost = {
    innerHTML: '',
    hidden: true,
    appendChild(child) {
      this._child = child;
      this.innerHTML = 'card';
    },
  };
  const workspace = {
    innerHTML: '<textarea id="summaryInput">keep me</textarea>',
    querySelectorAll() { return []; },
    insertBefore() { throw new Error('must not touch workspace when bannerHost is set'); },
  };
  const card = { className: 'ai-model-incapable-card' };
  const mode = mountAiLabAlertCard(card, { bannerHost, resultEl: workspace });
  assert.equal(mode, 'banner');
  assert.equal(bannerHost.hidden, false);
  assert.equal(bannerHost._child, card);
  assert.match(workspace.innerHTML, /summaryInput/);
}

{
  const resultEl = {
    innerHTML: '<div class="prior-summary">prior</div>',
    _kids: [],
    querySelectorAll(sel) {
      if (String(sel).includes('incapable') || String(sel).includes('credit')) return [];
      return [];
    },
    insertBefore(node) {
      this._kids.unshift(node);
      this.innerHTML = 'banner+prior';
    },
  };
  const card = { className: 'ai-model-incapable-card' };
  const mode = mountAiLabAlertCard(card, { resultEl, preserveContent: true });
  assert.equal(mode, 'prepend');
  assert.equal(resultEl._kids[0], card);
}

{
  const bannerHost = {
    innerHTML: 'old error',
    hidden: false,
  };
  clearAiLabErrorBanner(bannerHost);
  assert.equal(bannerHost.innerHTML, '');
  assert.equal(bannerHost.hidden, true);
}

// Legacy wipe path still available when no bannerHost / preserveContent
{
  const resultEl = {
    innerHTML: 'WORKSPACE',
    appendChild(child) {
      this._child = child;
      this.innerHTML = 'WIPED';
    },
  };
  const card = { className: 'ai-model-incapable-card' };
  const mode = mountAiLabAlertCard(card, { resultEl });
  assert.equal(mode, 'replace');
  assert.equal(resultEl.innerHTML, 'WIPED');
  assert.equal(resultEl._child, card);
}

console.log('ai-model-error.test.mjs: ok');
