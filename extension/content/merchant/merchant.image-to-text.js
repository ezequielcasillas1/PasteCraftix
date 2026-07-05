/**

 * Image → Text (#21) — Merchant content hook.

 * Snipping overlay → region text extract → selected dock target staging.

 */



import { stageTextToDockTarget } from './merchant.dock-storage.js';

import { getDockTargetLabel, readCaptureDockTarget } from './merchant.dock-target.js';

import { extractTextFromRegion } from './merchant.region-text.js';

import {

  cancelRegionCapture,

  isRegionCaptureActive,

  startRegionCapture,

} from './merchant.snip-overlay.js';



let _armed = false;



export function isImageToTextArmed() {

  return _armed || isRegionCaptureActive();

}



export function disarmImageToText() {

  _armed = false;

  if (isRegionCaptureActive()) {

    cancelRegionCapture();

  }

}



function buildStageMessage(targetField, payload) {

  const label = getDockTargetLabel(targetField);

  if (targetField === 'tags' && payload?.tag_validation?.count) {

    return `${payload.tag_validation.count} tag(s) extracted — staged to ${label}`;

  }

  return `Text extracted — staged to ${label}`;

}



/** Start snip capture; resolves when region completes, cancels, or fails. */

export function activateImageToText() {

  if (isRegionCaptureActive()) {

    cancelRegionCapture();

    return Promise.resolve({

      ok: true,

      armed: false,

      staged: false,

      message: 'Image → Text cancelled.',

    });

  }



  const dock = window.__pasteCraftMerchant?.dock;

  dock?.open();

  _armed = true;



  return new Promise((resolve) => {

    startRegionCapture({

      onComplete: async (rect) => {

        _armed = false;

        try {

          const text = extractTextFromRegion(rect);

          if (!text) {

            resolve({

              ok: false,

              armed: false,

              staged: false,

              message: 'No text found in region — try visible text or an image with alt/data-ocr-text.',

            });

            return;

          }



          const targetField = await readCaptureDockTarget();

          const result = await stageTextToDockTarget(text, targetField, 'selection');

          if (!result.ok) {

            resolve({

              ok: false,

              armed: false,

              staged: false,

              message: result.error || 'Could not stage extracted text.',

            });

            return;

          }



          await dock?.applyPayload(result.payload);

          resolve({

            ok: true,

            armed: false,

            staged: true,

            message: buildStageMessage(targetField, result.payload),

          });

        } catch (err) {

          console.error('[merchant.image-to-text:activateImageToText]', err);

          resolve({

            ok: false,

            armed: false,

            staged: false,

            message: 'Image → Text failed — try again.',

          });

        }

      },

      onCancel: () => {

        _armed = false;

        resolve({

          ok: true,

          armed: false,

          staged: false,

          message: 'Image → Text cancelled.',

        });

      },

    });

  });

}



/** @deprecated Use activateImageToText */

export function toggleImageToTextPlaceholder() {

  return activateImageToText();

}

