/** @forward-slice website starfield */
import { BAYER_4 } from './starfield.constants.js';

/**
 * Bayer 4x4 ordered-dither stamper for a low-res 2d buffer.
 * Intensity below the matrix threshold skips the pixel, producing
 * the grainy dither texture once the buffer is upscaled.
 */
export function createDitherStamper(bctx, sparkSize = 1) {
  function stampDot(x, y, intensity, color) {
    const px = Math.round(x);
    const py = Math.round(y);
    const threshold = (BAYER_4[py & 3][px & 3] + 0.5) / 16;
    if (intensity <= threshold) return;
    bctx.fillStyle = color;
    bctx.fillRect(px, py, 1, 1);
  }

  function stampSpark(x, y, intensity, color) {
    const px = Math.round(x);
    const py = Math.round(y);
    for (let dy = 0; dy < sparkSize; dy += 1) {
      for (let dx = 0; dx < sparkSize; dx += 1) {
        stampDot(px + dx, py + dy, intensity, color);
      }
    }
  }

  return { stampDot, stampSpark };
}
