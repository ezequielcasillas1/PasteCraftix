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
  isModelNotCapableError,
  formatModelNotCapableMessage,
  assertModelCapableForAction,
  modelSupportsVision,
} = await import(url);

assert.ok(MODEL_NOT_CAPABLE_MESSAGE.includes('not capable'));
assert.ok(MODEL_NOT_CAPABLE_MESSAGE.includes('choose a different model'));
assert.equal(/vercel/i.test(MODEL_NOT_CAPABLE_MESSAGE), false);

assert.equal(isModelNotCapableError({ message: 'model_not_found' }), true);
assert.equal(isModelNotCapableError({ message: 'AI provider rejected the summary request' }), true);
assert.equal(isModelNotCapableError({ isModelNotCapable: true }), true);
assert.equal(isModelNotCapableError({ message: 'No text credits remaining' }), false);
assert.equal(isModelNotCapableError({ message: 'Network timeout' }), false);

const nano = {
  id: 'gpt-5-nano',
  label: 'Nano Clip · GPT-5 Nano',
  supportsVision: false,
};
assert.equal(modelSupportsVision(nano), false);
assert.match(formatModelNotCapableMessage(nano), /Nano Clip · GPT-5 Nano/);
assert.match(formatModelNotCapableMessage(nano), /choose a different model/);

const app = {
  aiWorkflow: { enabled: true, provider: 'openai', preset: 'cheapest' },
};
assert.throws(
  () => assertModelCapableForAction(app, 'vision'),
  (err) => err?.isModelNotCapable === true && /not capable/i.test(err.message),
);

console.log('ai-model-error.test.mjs: ok');
