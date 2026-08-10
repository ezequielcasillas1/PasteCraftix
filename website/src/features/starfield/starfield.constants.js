/** @forward-slice website starfield */

export const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export const STARFIELD = {
  scale: 4,
  maxStars: 260,
  starDensity: 14000,
  minSpeed: 2,
  maxSpeed: 9,
  twinkleSpeed: 1.6,
  burstIntervalMinMs: 2200,
  burstIntervalMaxMs: 4200,
  sparkCountMin: 26,
  sparkCountMax: 46,
  sparkSpeedMin: 14,
  sparkSpeedMax: 52,
  sparkLifeMin: 0.6,
  sparkLifeMax: 1.4,
  sparkSize: 2,
  pointerRadius: 130,
  pointerRepel: 340,
  pointerSwirl: 160,
  pointerLerp: 0.18,
  clickSparks: 42,
  colors: ['#94a3b8', '#3b82f6', '#93c5fd', '#2563eb'],
  maxDpr: 2,
};

/**
 * Per-card particle formation: rounded-rect border + sparse face lattice.
 * Hover scatters particles; spring+damping returns them home.
 */
export const CARD_DITHER = {
  scale: 2,
  sparkSize: 2,
  cornerRadiusCss: 16,
  /** Inset of border homes inside the shell edge (css px). */
  insetCss: 3,
  borderSpacing: 6,
  faceSpacing: 16,
  springK: 0.28,
  damping: 0.82,
  settleEpsilon: 0.2,
  pointerRadius: 110,
  pointerRepel: 7.2,
  pointerSwirl: 3.0,
  pointerLerp: 0.35,
  twinkleSpeed: 1.0,
  twinkleAmp: 0.06,
  borderAlpha: 0.82,
  faceAlpha: 0.34,
  borderIntensity: 0.85,
  faceIntensity: 0.4,
  borderColors: ['#3b82f6', '#2563eb', '#60a5fa'],
  faceColors: ['#94a3b8', '#cbd5e1'],
  maxDpr: 2,
};
