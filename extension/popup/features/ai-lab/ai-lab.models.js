/**
 * Curated PasteCraft AI model showcase — maps UI picks to aiWorkflow provider+preset.
 * @forward-slice
 */

import { AI_CREDIT_COSTS } from './ai-lab.constants.js';

/** @typedef {{ id: string, label: string, provider: string, preset: string, strength: string, shortLabel: string }} AiShowcaseModel */

/** @type {AiShowcaseModel[]} */
export const AI_SHOWCASE_MODELS = [
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    shortLabel: '4o',
    provider: 'openai',
    preset: 'gpt4o',
    strength: 'Balanced polish · reliable format + categorize',
  },
  {
    id: 'claude-haiku-4-5',
    label: 'Haiku 4.5',
    shortLabel: 'Haiku',
    provider: 'anthropic',
    preset: 'default',
    strength: 'Fast rewrite/refactor register changes',
  },
  {
    id: 'gpt-5.2',
    label: 'GPT-5.2',
    shortLabel: '5.2',
    provider: 'openai',
    preset: 'latest',
    strength: 'Highest quality · hard clips · Super craft',
  },
  {
    id: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    shortLabel: 'Gemini',
    provider: 'google',
    preset: 'gemini_36_flash',
    strength: 'Fast cheap multimodal/text batch',
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
