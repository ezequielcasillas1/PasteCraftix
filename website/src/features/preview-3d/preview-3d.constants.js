/** @forward-slice website preview-3d */

export const PREVIEW_3D = {
  videoSrc: '/media/pastecraft-3d-preview.mp4',
  mountSelector: '[data-preview-3d]',
  canvasSelector: '[data-preview-3d-canvas]',
  videoSelector: '[data-preview-3d-video]',
  fallbackSelector: '[data-preview-3d-fallback]',
  maxDpr: 1.75,
  /** Native source: 720×1280 (9:16 portrait) */
  videoWidth: 720,
  videoHeight: 1280,
  /** World units — height drives portrait scale */
  planeHeight: 3.85,
};
