export const AI_CREDIT_COSTS = {
  openai: { default: 40, cheapest: 25, gpt5_mini: 200, latest: 500, gpt4o: 40 },
  google: {
    default: 40,
    cheapest: 25,
    gemini_pro: 350,
    latest: 100,
    gemini_37_flash: 40,
    gemini_38_flash: 40,
    gemini_35_flash_lite: 25,
  },
  anthropic: { default: 20 },
  meta: { default: 40, muse13: 40 },
  deepseek: { default: 20, cheapest: 20, deepseek_v41_flash: 20 },
  alibaba: { default: 20, qwen_flash: 20 },
  inclusionai: { default: 15, ling_flash: 15 },
  xai: { default: 250, grok47: 250 },
};

export const AI_PROVIDER_PRESETS = {
  openai: [
    { value: 'default', label: 'Clip Mini · GPT-4o mini · 40 cr' },
    { value: 'cheapest', label: 'Luna Clip · GPT-5.6 Luna · 25 cr' },
    { value: 'gpt4o', label: 'Clip Forge · Muse Spark 1.3 · 40 cr' },
    { value: 'gpt5_mini', label: 'Forge Mini · GPT-5 Mini · 200 cr' },
    { value: 'latest', label: 'Apex Craft · GPT-5.6 Terra · 500 cr' },
  ],
  google: [
    { value: 'default', label: 'Gemini Flash · Gemini 2.5 Flash · 40 cr' },
    { value: 'cheapest', label: 'Flash Lite · Gemini 2.5 Flash-Lite · 25 cr' },
    { value: 'gemini_38_flash', label: 'Nexus Flash · Gemini 3.8 Flash · 40 cr' },
    { value: 'gemini_37_flash', label: 'Nexus Flash · Gemini 3.8 Flash · 40 cr' },
    { value: 'gemini_35_flash_lite', label: 'Beam Lite · Gemini 3.5 Flash-Lite · 25 cr' },
    { value: 'gemini_pro', label: 'Gemini Pro · Gemini 2.5 Pro · 350 cr' },
    { value: 'latest', label: 'Gemini Latest · Gemini 3.8 Flash · 100 cr' },
  ],
  anthropic: [
    { value: 'default', label: 'Quill Spark · Haiku 5.5 · 20 cr' },
  ],
  deepseek: [
    { value: 'deepseek_v41_flash', label: 'Ember Flash · DeepSeek V4.1 Flash · 20 cr' },
    { value: 'cheapest', label: 'Ember Flash · DeepSeek V4.1 Flash · 20 cr' },
    { value: 'default', label: 'Ember Flash · DeepSeek V4.1 Flash · 20 cr' },
  ],
  alibaba: [
    { value: 'qwen_flash', label: 'Silk Flash · Qwen 3.8 Flash · 20 cr' },
    { value: 'default', label: 'Silk Flash · Qwen 3.8 Flash · 20 cr' },
  ],
  inclusionai: [
    { value: 'ling_flash', label: 'Pulse Lite · Ling 3.0 Flash · 15 cr' },
    { value: 'default', label: 'Pulse Lite · Ling 3.0 Flash · 15 cr' },
  ],
  meta: [
    { value: 'muse13', label: 'Clip Forge · Muse Spark 1.3 · 40 cr' },
    { value: 'default', label: 'Clip Forge · Muse Spark 1.3 · 40 cr' },
  ],
  xai: [
    { value: 'grok47', label: 'Summit Craft · Grok 4.7 · 250 cr' },
    { value: 'default', label: 'Summit Craft · Grok 4.7 · 250 cr' },
  ],
  groq: [
    { value: 'default', label: 'Default (Coming Soon)' },
  ],
};

/** Providers whose keys live in Edge Function secrets only. */
export const AI_ALLOWED_PROVIDERS = new Set([
  'openai',
  'google',
  'anthropic',
  'deepseek',
  'alibaba',
  'inclusionai',
  'meta',
  'xai',
]);

export const AI_STORAGE_KEYS = {
  WORKFLOW: 'pc_ai_workflow_v1',
  HISTORY: 'pc_aiHistory_v1',
  REFACTOR_LINKS: 'pc_refactorLinks_v1',
};

export const AI_HISTORY_PAGE_SIZE = 7;
export const AI_TEXT_INPUT_MAX_CHARS = 12000;

export const OPEN_RECENT_CONVERSATION_TOOLTIPS = Object.freeze({
  breakdown:
    'AI Breakdown: step-by-step explanations of your text at the comprehension level you pick.',
  summary:
    'AI Summary: shorter overview plus suggested questions from your selected clips or text.',
});
