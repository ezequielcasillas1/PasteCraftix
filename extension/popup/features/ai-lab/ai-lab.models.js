/**
 * Curated PasteCraft AI model showcase — fancy brand + real model side by side.
 * Real gateway model IDs live in Edge `ai_workflow` resolution (internal only).
 * @forward-slice
 */

import { AI_CREDIT_COSTS } from './ai-lab.constants.js';

/**
 * @typedef {{
 *   id: string,
 *   brandName: string,
 *   modelName: string,
 *   label: string,
 *   provider: string,
 *   preset: string,
 *   gatewayModel: string,
 *   strength: string,
 *   shortLabel: string,
 *   tagline: string,
 *   description: string,
 *   supportsVision: boolean,
 * }} AiShowcaseModel
 */

function displayLabel(brandName, modelName) {
  return `${brandName} · ${modelName}`;
}

/** @type {AiShowcaseModel[]} */
export const AI_SHOWCASE_MODELS = [
  {
    id: 'muse-spark-1.3',
    brandName: 'Clip Forge',
    modelName: 'Muse Spark 1.3',
    label: displayLabel('Clip Forge', 'Muse Spark 1.3'),
    shortLabel: 'Forge',
    provider: 'meta',
    preset: 'muse13',
    gatewayModel: 'meta/muse-spark-1.3',
    supportsVision: true,
    strength: 'Balanced polish · format + categorize',
    tagline: 'Everyday craft engine · reliable structure',
    description:
      'Clip Forge · Muse Spark 1.3 is PasteCraft’s balanced everyday engine. Strong at grammar polish, consistent formatting, and category suggestions without overthinking. Sees image clips when needed. Cheaper than the old GPT-4o slot and steadier than flash models for polished prose. Recommended for most workflows (~40 credits).',
  },
  {
    id: 'claude-haiku-5-5',
    brandName: 'Quill Spark',
    modelName: 'Haiku 5.5',
    label: displayLabel('Quill Spark', 'Haiku 5.5'),
    shortLabel: 'Quill',
    provider: 'anthropic',
    preset: 'default',
    gatewayModel: 'anthropic/claude-haiku-5.5',
    supportsVision: true,
    strength: 'Fast rewrite · refactor register shifts',
    tagline: 'Lightning rewrites · cheap text transforms',
    description:
      'Quill Spark · Haiku 5.5 is PasteCraft’s fast rewrite engine. Ideal for Craft refactor levels, light polish, and high-volume text passes where latency and credits matter. Lower reasoning depth than Apex Craft on hard clips, but excellent for bulk rewrite batches (~20 credits).',
  },
  {
    id: 'gpt-5.6-terra',
    brandName: 'Apex Craft',
    modelName: 'GPT-5.6 Terra',
    label: displayLabel('Apex Craft', 'GPT-5.6 Terra'),
    shortLabel: 'Apex',
    provider: 'openai',
    preset: 'latest',
    gatewayModel: 'openai/gpt-5.6-terra',
    supportsVision: true,
    strength: 'Current flagship lane · hard clips · Super craft',
    tagline: 'Deep reasoning · Super craft quality',
    description:
      'Apex Craft · GPT-5.6 Terra replaces GPT-5.2 as PasteCraft’s current premium craft model. Stronger long-context judgment, tougher categorization, and careful multi-step formatting when cheaper models stumble. Premium cost (~500 credits) — reserve for Super craft, complex summaries, and messy mixed content.',
  },
  {
    id: 'gemini-3.8-flash',
    brandName: 'Nexus Flash',
    modelName: 'Gemini 3.8 Flash',
    label: displayLabel('Nexus Flash', 'Gemini 3.8 Flash'),
    shortLabel: 'Nexus',
    provider: 'google',
    preset: 'gemini_38_flash',
    gatewayModel: 'google/gemini-3.8-flash',
    supportsVision: true,
    strength: 'Fast multimodal · image + text batch',
    tagline: 'Image analysis · cheap multimodal batch',
    description:
      'Nexus Flash · Gemini 3.8 Flash is PasteCraft’s multimodal speed model. Same credit cost as Gemini 3.7 Flash, with the newer Flash generation. Handles vision plus text quickly for OCR-style reads, screenshot context, and high-volume text batches (~40 credits).',
  },
  {
    id: 'deepseek-v4.1-flash',
    brandName: 'Ember Flash',
    modelName: 'DeepSeek V4.1 Flash',
    label: displayLabel('Ember Flash', 'DeepSeek V4.1 Flash'),
    shortLabel: 'Ember',
    provider: 'deepseek',
    preset: 'deepseek_v41_flash',
    gatewayModel: 'deepseek/deepseek-v4.1-flash',
    supportsVision: true,
    strength: 'Ultra-cheap · high-volume text',
    tagline: 'Lowest cost · bulk text craft',
    description:
      'Ember Flash · DeepSeek V4.1 Flash is PasteCraft’s ultra-cheap text engine. Built for high-volume summaries, light polish, and bulk Craft passes where cost matters most (~20 credits).',
  },
  {
    id: 'gemini-3.5-flash-lite',
    brandName: 'Beam Lite',
    modelName: 'Gemini 3.5 Flash-Lite',
    label: displayLabel('Beam Lite', 'Gemini 3.5 Flash-Lite'),
    shortLabel: 'Beam',
    provider: 'google',
    preset: 'gemini_35_flash_lite',
    gatewayModel: 'google/gemini-3.5-flash-lite',
    supportsVision: true,
    strength: 'Cheap multimodal lite · fast triage',
    tagline: 'Lite multimodal · high-volume triage',
    description:
      'Beam Lite · Gemini 3.5 Flash-Lite is PasteCraft’s lite multimodal runner. Fast triage for text and simple image clips at a lower credit cost (~25 credits).',
  },
  {
    id: 'gpt-5.6-luna',
    brandName: 'Luna Clip',
    modelName: 'GPT-5.6 Luna',
    label: displayLabel('Luna Clip', 'GPT-5.6 Luna'),
    shortLabel: 'Luna',
    provider: 'openai',
    preset: 'cheapest',
    gatewayModel: 'openai/gpt-5.6-luna',
    supportsVision: true,
    strength: 'Tiny & cheap · everyday snips',
    tagline: 'Smallest OpenAI tier · snappy snips',
    description:
      'Luna Clip · GPT-5.6 Luna is PasteCraft’s tiniest OpenAI-tier engine. Best for short snips, quick format passes, and low-cost everyday text (~25 credits).',
  },
  {
    id: 'qwen-3.8-flash',
    brandName: 'Silk Flash',
    modelName: 'Qwen 3.8 Flash',
    label: displayLabel('Silk Flash', 'Qwen 3.8 Flash'),
    shortLabel: 'Silk',
    provider: 'alibaba',
    preset: 'qwen_flash',
    gatewayModel: 'alibaba/qwen3.8-flash',
    supportsVision: true,
    strength: 'Ultra-cheap · fluent text batch',
    tagline: 'Bargain fluent · batch text craft',
    description:
      'Silk Flash · Qwen 3.8 Flash is PasteCraft’s bargain fluent engine. Excellent price/performance for summaries and batch text transforms (~20 credits).',
  },
  {
    id: 'ling-3.0-flash',
    brandName: 'Pulse Lite',
    modelName: 'Ling 3.0 Flash',
    label: displayLabel('Pulse Lite', 'Ling 3.0 Flash'),
    shortLabel: 'Pulse',
    provider: 'inclusionai',
    preset: 'ling_flash',
    gatewayModel: 'inclusionai/ling-3.0-flash',
    supportsVision: false,
    strength: 'Cheapest pulse · light drafts',
    tagline: 'Budget pulse · light drafts & snips',
    description:
      'Pulse Lite · Ling 3.0 Flash is PasteCraft’s budget pulse model. Lowest showcase credit cost for light drafts, snips, and exploratory passes (~15 credits).',
  },
  {
    id: 'grok-4.7',
    brandName: 'Summit Craft',
    modelName: 'Grok 4.7',
    label: displayLabel('Summit Craft', 'Grok 4.7'),
    shortLabel: 'Summit',
    provider: 'xai',
    preset: 'grok47',
    gatewayModel: 'xai/grok-4.7',
    supportsVision: true,
    strength: 'Frontier craft · image + long context',
    tagline: 'Strong reasoning · lower flagship cost',
    description:
      'Summit Craft · Grok 4.7 is PasteCraft’s frontier craft model. Strong long-context judgment, image-aware clips, and careful multi-step formatting. About half the previous GPT-5.4 API cost (~250 credits).',
  },
];

export const DEFAULT_SHOWCASE_MODEL_ID = 'muse-spark-1.3';

export function getShowcaseModelById(id) {
  return AI_SHOWCASE_MODELS.find((m) => m.id === id) || null;
}

export function resolveShowcaseModelFromWorkflow(workflow) {
  let provider = String(workflow?.provider || 'openai');
  let preset = String(workflow?.preset || 'default');
  // Stored Clip Forge picks from before Muse Spark 1.3.
  if (provider === 'openai' && preset === 'gpt4o') {
    provider = 'meta';
    preset = 'muse13';
  }
  // Stored Nexus picks from before Gemini 3.8 Flash.
  if (provider === 'google' && preset === 'gemini_37_flash') {
    preset = 'gemini_38_flash';
  }
  // Stored Summit picks from before Grok 4.7.
  if (provider === 'openai' && preset === 'gpt54') {
    provider = 'xai';
    preset = 'grok47';
  }
  if (provider === 'xai' && preset === 'default') {
    preset = 'grok47';
  }
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
