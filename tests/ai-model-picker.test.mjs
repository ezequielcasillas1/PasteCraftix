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

assert.ok(AI_SHOWCASE_MODELS.length >= 10);
assert.equal(AI_SHOWCASE_MODELS.at(-1).id, 'gpt-5.4');
assert.equal(DEFAULT_SHOWCASE_MODEL_ID, 'muse-spark-1.3');

const map = Object.fromEntries(AI_SHOWCASE_MODELS.map((m) => [m.id, m]));
assert.equal(map['muse-spark-1.3'].brandName, 'Clip Forge');
assert.equal(map['muse-spark-1.3'].modelName, 'Muse Spark 1.3');
assert.equal(map['muse-spark-1.3'].label, 'Clip Forge · Muse Spark 1.3');
assert.equal(map['muse-spark-1.3'].provider, 'meta');
assert.equal(map['muse-spark-1.3'].preset, 'muse13');
assert.equal(map['muse-spark-1.3'].gatewayModel, 'meta/muse-spark-1.3');
assert.equal(map['claude-haiku-5-5'].label, 'Quill Spark · Haiku 5.5');
assert.equal(map['claude-haiku-5-5'].provider, 'anthropic');
assert.equal(map['claude-haiku-5-5'].preset, 'default');
assert.equal(map['gpt-5.6-terra'].label, 'Apex Craft · GPT-5.6 Terra');
assert.equal(map['gpt-5.6-terra'].provider, 'openai');
assert.equal(map['gpt-5.6-terra'].preset, 'latest');
assert.equal(map['gemini-3.8-flash'].label, 'Nexus Flash · Gemini 3.8 Flash');
assert.equal(map['gemini-3.8-flash'].provider, 'google');
assert.equal(map['gemini-3.8-flash'].preset, 'gemini_38_flash');
assert.equal(map['gemini-3.8-flash'].gatewayModel, 'google/gemini-3.8-flash');
assert.equal(map['deepseek-v4.1-flash'].label, 'Ember Flash · DeepSeek V4.1 Flash');
assert.equal(map['deepseek-v4.1-flash'].preset, 'deepseek_v41_flash');
assert.equal(map['gemini-3.5-flash-lite'].label, 'Beam Lite · Gemini 3.5 Flash-Lite');
assert.equal(map['gpt-5.6-luna'].label, 'Luna Clip · GPT-5.6 Luna');
assert.equal(map['qwen-3.8-flash'].label, 'Silk Flash · Qwen 3.8 Flash');
assert.equal(map['ling-3.0-flash'].label, 'Pulse Lite · Ling 3.0 Flash');
assert.equal(map['gpt-5.4'].label, 'Summit Craft · GPT-5.4');
assert.equal(map['gpt-5.4'].provider, 'openai');
assert.equal(map['gpt-5.4'].preset, 'gpt54');
assert.equal(map['gpt-5.4'].gatewayModel, 'openai/gpt-5.4');
assert.equal(map['gpt-5.4'].supportsVision, true);

// User-facing copy must not mention Vercel / gateway branding
for (const m of AI_SHOWCASE_MODELS) {
  const blob = `${m.label}\n${m.tagline}\n${m.description}\n${m.strength}`;
  assert.equal(/vercel|ai gateway/i.test(blob), false, m.id);
}

assert.equal(
  resolveShowcaseModelFromWorkflow({ provider: 'openai', preset: 'latest' }).id,
  'gpt-5.6-terra',
);
assert.equal(
  resolveShowcaseModelFromWorkflow({ provider: 'openai', preset: 'gpt4o' }).id,
  'muse-spark-1.3',
);
assert.equal(
  resolveShowcaseModelFromWorkflow({ provider: 'openai', preset: 'gpt54' }).id,
  'gpt-5.4',
);
assert.equal(
  resolveShowcaseModelFromWorkflow({ provider: 'google', preset: 'gemini_37_flash' }).id,
  'gemini-3.8-flash',
);
assert.equal(
  resolveShowcaseModelFromWorkflow({ provider: 'deepseek', preset: 'deepseek_v41_flash' }).id,
  'deepseek-v4.1-flash',
);

const wf = workflowFromShowcaseModel(map['muse-spark-1.3']);
assert.equal(wf.enabled, true);
assert.equal(wf.provider, 'meta');
assert.equal(wf.preset, 'muse13');

assert.equal(getShowcaseCreditCost(map['gpt-5.6-terra']), 500);
assert.equal(getShowcaseCreditCost(map['gpt-5.4']), 500);
assert.equal(getShowcaseCreditCost(map['claude-haiku-5-5']), 20);
assert.equal(getShowcaseCreditCost(map['muse-spark-1.3']), 40);
assert.equal(getShowcaseCreditCost(map['gemini-3.8-flash']), 40);
assert.equal(getShowcaseCreditCost(map['deepseek-v4.1-flash']), 20);
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

// Edge model id wired for Gemini 3.7 Flash + gateway routing
const workflowTs = readFileSync(
  join(root, 'supabase/functions/_shared/ai_workflow.ts'),
  'utf8',
);
assert.match(workflowTs, /gemini_38_flash[\s\S]*gemini-3\.8-flash/);
assert.match(workflowTs, /muse-spark-1\.3/);
assert.match(workflowTs, /gpt-5\.6-terra/);
assert.match(workflowTs, /gpt54[\s\S]*gpt-5\.4/);
assert.match(workflowTs, /AI_GATEWAY_BASE_URL|ai-gateway\.vercel\.sh/);
assert.match(workflowTs, /deepseek-v4\.1-flash/);

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
    preset: 'gemini_37_flash',
    updatedAt: 99,
  };
  const kept = await ensureDefaultWorkflowEnabled(app);
  assert.equal(kept.enabled, true);
  assert.equal(kept.provider, 'google');
  assert.equal(kept.preset, 'gemini_37_flash');
  assert.equal(saved, null);
}

console.log('ai-model-picker.test.mjs: ok');
