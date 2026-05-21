/** Craft Clips (Magic Wand revamp) — storage keys, AI modes, refactor levels. */

export const CRAFT_CLIPS_STORAGE_KEY = 'pc_craft_clips_settings_v1';

export const CRAFT_CLIPS_AI_MODES = {
  FORMATTED: 'formatted',
  REFACTORING: 'refactoring',
};

export const CRAFT_CLIPS_DEFAULT_SETTINGS = {
  smartCategorize: true,
  duplicateHandling: false,
  aiMode: CRAFT_CLIPS_AI_MODES.FORMATTED,
  refactorLevel: 'college',
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

export const CRAFT_CLIP_ACTIONS = {
  CATEGORIZE: 'categorize',
  FORMAT: 'format',
  REFACTOR: 'refactor',
  CLEANUP: 'cleanup',
  DEDUPE: 'dedupe',
};
