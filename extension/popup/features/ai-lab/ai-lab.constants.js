export const AI_CREDIT_COSTS = {
  openai: { default: 40, cheapest: 25, gpt5_mini: 200, latest: 500 },
  google: { default: 40, cheapest: 25, gemini_pro: 350, latest: 100 },
};

export const AI_PROVIDER_PRESETS = {
  openai: [
    { value: 'default', label: 'Default (4o-mini) · 40 cr' },
    { value: 'cheapest', label: 'Cheap (GPT-5 Nano) · 25 cr' },
    { value: 'gpt5_mini', label: 'Balanced (GPT-5 Mini) · 200 cr' },
    { value: 'latest', label: 'Latest (GPT-5.2) · 500 cr' },
  ],
  google: [
    { value: 'default', label: 'Default (Gemini 2.0 Flash) · 40 cr' },
    { value: 'cheapest', label: 'Cheap (Gemini 2.0 Flash-Lite) · 25 cr' },
    { value: 'gemini_pro', label: 'Balanced (Gemini 2.5 Pro) · 350 cr' },
    { value: 'latest', label: 'Latest (Gemini 2.5 Flash) · 100 cr' },
  ],
  anthropic: [
    { value: 'default', label: 'Default (Coming Soon)' },
  ],
  groq: [
    { value: 'default', label: 'Default (Coming Soon)' },
  ],
};

export const AI_ALLOWED_PROVIDERS = new Set(['openai', 'google', 'anthropic', 'groq']);

export const AI_STORAGE_KEYS = {
  WORKFLOW: 'pc_ai_workflow_v1',
  HISTORY: 'pc_aiHistory_v1',
};

/** Native tooltips for recent-conversation icons (matches popup.html lucide naming). */
export const OPEN_RECENT_CONVERSATION_TOOLTIPS = Object.freeze({
  breakdown:
    'AI Breakdown: step-by-step explanations of your text at the comprehension level you pick.',
  summary:
    'AI Summary: shorter overview plus suggested questions from your selected clips or text.',
});
