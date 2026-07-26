import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Load ESM modules from extension via dynamic import
const modelsUrl = pathToFileURL(
  join(root, 'extension/popup/features/ai-lab/ai-lab.models.js'),
).href;

const {
  AI_SHOWCASE_MODELS,
  DEFAULT_SHOWCASE_MODEL_ID,
  resolveShowcaseModelFromWorkflow,
  workflowFromShowcaseModel,
  getShowcaseCreditCost,
  canUseModelPicker,
  isUnlimitedAi,
} = await import(modelsUrl);

assert.equal(AI_SHOWCASE_MODELS.length, 4);
assert.equal(DEFAULT_SHOWCASE_MODEL_ID, 'gpt-4o');

const map = Object.fromEntries(AI_SHOWCASE_MODELS.map((m) => [m.id, m]));
assert.equal(map['gpt-4o'].provider, 'openai');
assert.equal(map['gpt-4o'].preset, 'gpt4o');
assert.equal(map['claude-haiku-4-5'].provider, 'anthropic');
assert.equal(map['claude-haiku-4-5'].preset, 'default');
assert.equal(map['gpt-5.2'].provider, 'openai');
assert.equal(map['gpt-5.2'].preset, 'latest');
assert.equal(map['gemini-3.6-flash'].provider, 'google');
assert.equal(map['gemini-3.6-flash'].preset, 'gemini_36_flash');

assert.equal(
  resolveShowcaseModelFromWorkflow({ provider: 'openai', preset: 'latest' }).id,
  'gpt-5.2',
);
assert.equal(
  resolveShowcaseModelFromWorkflow({ provider: 'google', preset: 'gemini_36_flash' }).id,
  'gemini-3.6-flash',
);

const wf = workflowFromShowcaseModel(map['gpt-4o']);
assert.equal(wf.enabled, true);
assert.equal(wf.provider, 'openai');
assert.equal(wf.preset, 'gpt4o');

assert.equal(getShowcaseCreditCost(map['gpt-5.2']), 500);
assert.equal(getShowcaseCreditCost(map['claude-haiku-4-5']), 40);
assert.equal(getShowcaseCreditCost(map['gemini-3.6-flash']), 40);

assert.equal(canUseModelPicker({ has_unlimited_ai: true }), true);
assert.equal(isUnlimitedAi({ has_unlimited_ai: true }), true);
assert.equal(
  canUseModelPicker({
    subscription_tier: 'premium',
    subscription_status: 'active',
    has_unlimited_ai: false,
  }),
  true,
);
assert.equal(canUseModelPicker({ subscription_tier: 'basic', subscription_status: 'active' }), false);

// Edge model id wired for Gemini 3.6 Flash
const workflowTs = readFileSync(
  join(root, 'supabase/functions/_shared/ai_workflow.ts'),
  'utf8',
);
assert.match(workflowTs, /gemini_36_flash[\s\S]*gemini-3\.6-flash/);
assert.match(workflowTs, /gpt4o[\s\S]*gpt-4o/);

console.log('ai-model-picker.test.mjs: ok');
