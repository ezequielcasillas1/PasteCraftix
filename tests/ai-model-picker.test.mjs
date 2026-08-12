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
const pickerUrl = pathToFileURL(
  join(root, 'extension/popup/features/ai-lab/ai-lab.model-picker.js'),
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
const { ensureDefaultWorkflowEnabled } = await import(pickerUrl);

assert.ok(AI_SHOWCASE_MODELS.length >= 9);
assert.equal(DEFAULT_SHOWCASE_MODEL_ID, 'gpt-4o');

const map = Object.fromEntries(AI_SHOWCASE_MODELS.map((m) => [m.id, m]));
assert.equal(map['gpt-4o'].brandName, 'Clip Forge');
assert.equal(map['gpt-4o'].modelName, 'GPT-4o');
assert.equal(map['gpt-4o'].label, 'Clip Forge · GPT-4o');
assert.equal(map['gpt-4o'].provider, 'openai');
assert.equal(map['gpt-4o'].preset, 'gpt4o');
assert.equal(map['gpt-4o'].gatewayModel, 'openai/gpt-4o');
assert.equal(map['claude-haiku-4-5'].label, 'Quill Spark · Haiku 4.5');
assert.equal(map['claude-haiku-4-5'].provider, 'anthropic');
assert.equal(map['claude-haiku-4-5'].preset, 'default');
assert.equal(map['gpt-5.2'].label, 'Apex Craft · GPT-5.2');
assert.equal(map['gpt-5.2'].provider, 'openai');
assert.equal(map['gpt-5.2'].preset, 'latest');
assert.equal(map['gemini-3.6-flash'].label, 'Nexus Flash · Gemini 3.6 Flash');
assert.equal(map['gemini-3.6-flash'].provider, 'google');
assert.equal(map['gemini-3.6-flash'].preset, 'gemini_36_flash');
assert.equal(map['gemini-3.6-flash'].gatewayModel, 'google/gemini-3.6-flash');
assert.equal(map['deepseek-v4-flash'].label, 'Ember Flash · DeepSeek V4 Flash');
assert.equal(map['deepseek-v4-flash'].preset, 'deepseek_v4_flash');
assert.equal(map['gemini-3.5-flash-lite'].label, 'Beam Lite · Gemini 3.5 Flash-Lite');
assert.equal(map['gpt-5-nano'].label, 'Nano Clip · GPT-5 Nano');
assert.equal(map['qwen-3.7-flash'].label, 'Silk Flash · Qwen 3.7 Flash');
assert.equal(map['ling-3.0-flash'].label, 'Pulse Lite · Ling 3.0 Flash');

// User-facing copy must not mention Vercel / gateway branding
for (const m of AI_SHOWCASE_MODELS) {
  const blob = `${m.label}\n${m.tagline}\n${m.description}\n${m.strength}`;
  assert.equal(/vercel|ai gateway/i.test(blob), false, m.id);
}

assert.equal(
  resolveShowcaseModelFromWorkflow({ provider: 'openai', preset: 'latest' }).id,
  'gpt-5.2',
);
assert.equal(
  resolveShowcaseModelFromWorkflow({ provider: 'google', preset: 'gemini_36_flash' }).id,
  'gemini-3.6-flash',
);
assert.equal(
  resolveShowcaseModelFromWorkflow({ provider: 'deepseek', preset: 'deepseek_v4_flash' }).id,
  'deepseek-v4-flash',
);

const wf = workflowFromShowcaseModel(map['gpt-4o']);
assert.equal(wf.enabled, true);
assert.equal(wf.provider, 'openai');
assert.equal(wf.preset, 'gpt4o');

assert.equal(getShowcaseCreditCost(map['gpt-5.2']), 500);
assert.equal(getShowcaseCreditCost(map['claude-haiku-4-5']), 40);
assert.equal(getShowcaseCreditCost(map['gemini-3.6-flash']), 40);
assert.equal(getShowcaseCreditCost(map['deepseek-v4-flash']), 20);
assert.equal(getShowcaseCreditCost(map['ling-3.0-flash']), 15);

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

// Edge model id wired for Gemini 3.6 Flash + gateway routing
const workflowTs = readFileSync(
  join(root, 'supabase/functions/_shared/ai_workflow.ts'),
  'utf8',
);
assert.match(workflowTs, /gemini_36_flash[\s\S]*gemini-3\.6-flash/);
assert.match(workflowTs, /gpt4o[\s\S]*gpt-4o/);
assert.match(workflowTs, /AI_GATEWAY_BASE_URL|ai-gateway\.vercel\.sh/);
assert.match(workflowTs, /deepseek-v4-flash-0731/);

const gatewayTs = readFileSync(
  join(root, 'supabase/functions/_shared/ai_gateway.ts'),
  'utf8',
);
assert.match(gatewayTs, /AI_GATEWAY_API_KEY/);
assert.match(gatewayTs, /ai-gateway\.vercel\.sh/);

const pickerSrc = readFileSync(
  join(root, 'extension/popup/features/ai-lab/ai-lab.model-picker.js'),
  'utf8',
);
assert.match(pickerSrc, /is-stagger/);
assert.match(pickerSrc, /--ai-card-stagger/);

// Pre-hydrate must not persist GPT-4o over a stored Gemini pick
{
  let saved = null;
  const app = {
    _aiWorkflowHydrated: false,
    userSubscription: { has_unlimited_ai: true },
    aiWorkflow: { enabled: false, provider: 'openai', preset: 'default', updatedAt: 0 },
    _normalizeAiWorkflow(raw) {
      return { ...raw };
    },
    applyAiWorkflowToUi() {},
    async saveAiWorkflowFromUi() {
      saved = this.aiWorkflow;
      return this.aiWorkflow;
    },
  };
  const before = await ensureDefaultWorkflowEnabled(app);
  assert.equal(before, null);
  assert.equal(saved, null);

  app._aiWorkflowHydrated = true;
  app.aiWorkflow = {
    enabled: true,
    provider: 'google',
    preset: 'gemini_36_flash',
    updatedAt: 99,
  };
  const kept = await ensureDefaultWorkflowEnabled(app);
  assert.equal(kept.enabled, true);
  assert.equal(kept.provider, 'google');
  assert.equal(kept.preset, 'gemini_36_flash');
  assert.equal(saved, null);
}

console.log('ai-model-picker.test.mjs: ok');
