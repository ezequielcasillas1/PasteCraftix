/**
 * Curated PasteCraft AI model showcase — maps UI picks to aiWorkflow provider+preset.
 * @forward-slice
 */

import { AI_CREDIT_COSTS } from './ai-lab.constants.js';

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   provider: string,
 *   preset: string,
 *   strength: string,
 *   shortLabel: string,
 *   tagline: string,
 *   description: string,
 * }} AiShowcaseModel
 */

/** @type {AiShowcaseModel[]} */
export const AI_SHOWCASE_MODELS = [
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    shortLabel: '4o',
    provider: 'openai',
    preset: 'gpt4o',
    strength: 'Balanced polish · reliable format + categorize',
    tagline: 'Best at balanced polish · format + categorize',
    description:
      'OpenAI GPT-4o is a mid-tier multimodal model that handles text and vision with reliable structure. Strong at grammar polish, consistent formatting, and category suggestions without overthinking. Sees image clips when needed, but shines as the everyday default for Craft format/categorize and summaries. Faster and cheaper than GPT-5.2 while steadier than flash models for polished prose. Recommended for most PasteCraft workflows where quality and cost should stay balanced (~80 credits).',
  },
  {
    id: 'claude-haiku-4-5',
    label: 'Haiku 4.5',
    shortLabel: 'Haiku',
    provider: 'anthropic',
    preset: 'default',
    strength: 'Fast rewrite/refactor register changes',
    tagline: 'Best at fast rewrite · refactor register shifts',
    description:
      'Anthropic Claude Haiku 4.5 is a small, fast text model tuned for quick rewrites and register changes. Text-first (not the pick for image analysis). Excels at Craft refactor levels, light polish, and high-volume text passes where latency and credit cost matter most. Lower reasoning depth than GPT-5.2 or GPT-4o on hard clips, but ideal for bulk rewrite/refactor batches and cheap everyday text transforms (~40 credits).',
  },
  {
    id: 'gpt-5.2',
    label: 'GPT-5.2',
    shortLabel: '5.2',
    provider: 'openai',
    preset: 'latest',
    strength: 'Highest quality · hard clips · Super craft',
    tagline: 'Best at hard clips · Super craft quality',
    description:
      'OpenAI GPT-5.2 is the deepest-reasoning showcase model for difficult clips and Super craft. Large quality class: stronger long-context judgment, tougher categorization, and careful multi-step formatting when cheaper models stumble. Supports text-first hard work; use when accuracy outweighs speed. Premium cost (~500 credits) — reserve for Super craft, complex summaries, messy mixed content, and clips that need maximum polish rather than bulk batching.',
  },
  {
    id: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    shortLabel: 'Gemini',
    provider: 'google',
    preset: 'gemini_36_flash',
    strength: 'Fast cheap multimodal/text batch',
    tagline: 'Best at image analysis · cheap multimodal batch',
    description:
      'Google Gemini 3.6 Flash is a fast, low-cost multimodal model and the best default for image-clip analysis. Handles vision plus text quickly for OCR-style reads, screenshot context, and high-volume text batches. Less polish depth than GPT-4o/5.2 on hard prose, but excellent when throughput and credits matter. Recommended for image clips, multimodal triage, and cheap bulk text passes (~40 credits).',
  },
];

export const DEFAULT_SHOWCASE_MODEL_ID = 'gpt-4o';

export function getShowcaseModelById(id) {
  return AI_SHOWCASE_MODELS.find((m) => m.id === id) || null;
}

export function resolveShowcaseModelFromWorkflow(workflow) {
  const provider = String(workflow?.provider || 'openai');
  const preset = String(workflow?.preset || 'default');
  const match = AI_SHOWCASE_MODELS.find(
    (m) => m.provider === provider && m.preset === preset,
  );
  if (match) return match;
  return getShowcaseModelById(DEFAULT_SHOWCASE_MODEL_ID);
}

export function workflowFromShowcaseModel(model) {
  const m = model || getShowcaseModelById(DEFAULT_SHOWCASE_MODEL_ID);
  return {
    enabled: true,
    provider: m.provider,
    preset: m.preset,
    updatedAt: Date.now(),
  };
}

export function getShowcaseCreditCost(model) {
  const m = model || getShowcaseModelById(DEFAULT_SHOWCASE_MODEL_ID);
  const costs = AI_CREDIT_COSTS[m.provider] || AI_CREDIT_COSTS.openai;
  return Number.isFinite(costs[m.preset]) ? costs[m.preset] : AI_CREDIT_COSTS.openai.default;
}

function hasCouponAiWindow(subscription) {
  const expiresAtMs = subscription?.ai_access_expires_at
    ? Date.parse(subscription.ai_access_expires_at)
    : NaN;
  return Number.isFinite(expiresAtMs) && expiresAtMs > Date.now();
}

function isPaidPremiumAi(subscription) {
  const tier = String(subscription?.subscription_tier || '').toLowerCase();
  const status = String(subscription?.subscription_status || '').toLowerCase();
  return tier === 'premium' && (status === 'active' || status === 'past_due');
}

function hasPurchasedCredits(subscription) {
  const purchased = Number(subscription?.ai_purchased_credits_balance);
  return Number.isFinite(purchased) && purchased > 0;
}

/** Unlimited (dev4ever) + paid AI entitlement see full list; no-access gets locked UI. */
export function canUseModelPicker(subscription) {
  if (!subscription) return false;
  if (subscription.has_unlimited_ai === true) return true;
  if (hasCouponAiWindow(subscription)) return true;
  if (isPaidPremiumAi(subscription)) return true;
  return hasPurchasedCredits(subscription);
}

export function isUnlimitedAi(subscription) {
  return !!(subscription && subscription.has_unlimited_ai === true);
}

export function listPickerModels(subscription) {
  // Full showcase for unlimited + paid; costs shown only when not unlimited.
  void subscription;
  return AI_SHOWCASE_MODELS.slice();
}
