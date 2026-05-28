/** Craft Clips (Magic Wand revamp) — storage keys, AI modes, refactor levels. */

import { AI_CREDIT_COSTS } from './ai-lab.constants.js';

export const CRAFT_CLIPS_STORAGE_KEY = 'pc_craft_clips_settings_v1';

export const CRAFT_CLIPS_AI_MODES = {
  FORMATTED: 'formatted',
  REFACTORING: 'refactoring',
};

/**
 * Craft power — exactly two modes.
 * Regular = cheapest model (default/off). Super = the single higher tier below.
 */
export const CRAFT_POWER_MODES = {
  REGULAR: 'regular',
  SUPER: 'super',
};

/** Regular always maps to the cheapest preset. */
export const CRAFT_REGULAR_PRESET = 'cheapest';

/**
 * The single higher tier "Super" craft power requests. CHANGE THIS ONE CONSTANT
 * to upgrade the Super model later (must be a key in AI_CREDIT_COSTS.openai,
 * e.g. 'default' = GPT-4o Mini · 40 cr, 'gpt5_mini' = GPT-5 Mini · 200 cr).
 * The server independently whitelists + recomputes the charged credits.
 */
export const CRAFT_SUPER_PRESET = 'default';

/** Per-batch credit cost shown in the UI for each craft power mode. */
export const CRAFT_POWER_CREDIT_COST = {
  [CRAFT_POWER_MODES.REGULAR]: AI_CREDIT_COSTS.openai[CRAFT_REGULAR_PRESET],
  [CRAFT_POWER_MODES.SUPER]: AI_CREDIT_COSTS.openai[CRAFT_SUPER_PRESET],
};

export const CRAFT_CLIPS_DEFAULT_SETTINGS = {
  smartCategorize: true,
  duplicateHandling: false,
  aiMode: CRAFT_CLIPS_AI_MODES.FORMATTED,
  refactorLevel: 'college',
  craftPower: CRAFT_POWER_MODES.REGULAR,
};

/** UI level id → Edge ai-refactor / ai-breakdown key */
export const REFACTOR_LEVEL_TO_EDGE = {
  eli5: 'child',
  elementary: 'elementary',
  highschool: 'highschool',
  college: 'college',
  phd: 'phd',
  wiseman: 'wiseman',
};

export const REFACTOR_LEVELS = [
  { id: 'eli5', label: 'ELI5', color: 'rose' },
  { id: 'elementary', label: 'Elementary', color: 'amber' },
  { id: 'highschool', label: 'High School', color: 'emerald' },
  { id: 'college', label: 'College', color: 'sky' },
  { id: 'phd', label: 'PhD', color: 'violet' },
  { id: 'wiseman', label: 'Wise Man', color: 'indigo' },
];

/** Info tooltips — rewrite use cases (not breakdown/explain). */
export const REFACTOR_LEVEL_INFO = {
  eli5: 'Rewrites dense jargon into plain language. Same facts—easier to read. Best for legal/tech paste, not casual notes.',
  elementary: 'Simple, clear prose (ages 8–11 style). Good for instructions and how-tos.',
  highschool: 'Teen-level clarity. Useful for blog drafts and general sharing.',
  college: 'Undergraduate academic tone. Reports, essays, professional email polish.',
  phd: 'Expert/scholarly register. Elevates rough notes to formal technical prose.',
  wiseman: 'Philosophical, metaphor-rich voice. Best for quotes and reflective text—not code or URLs.',
};

export const CRAFT_CATEGORY_SUGGESTION_COUNT = 5;

export const CRAFT_CLIP_ACTIONS = {
  CATEGORIZE: 'categorize',
  FORMAT: 'format',
  REFACTOR: 'refactor',
  CLEANUP: 'cleanup',
  DEDUPE: 'dedupe',
};
