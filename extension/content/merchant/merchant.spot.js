/**

 * Spot (#29) — Merchant content hook (Phase 3).

 * Opens listing dock and stages page selection into the selected dock target.

 */



import { stageTextToDockTarget } from './merchant.dock-storage.js';

import { getCaptureDockTarget, getDockTargetLabel, readCaptureDockTarget } from './merchant.dock-target.js';

import { clearSelectionCache, readSelectionText } from './merchant.selection-cache.js';



let _spotActive = false;



export function isSpotActive() {

  return _spotActive;

}



function buildStageMessage(targetField, payload) {

  const label = getDockTargetLabel(targetField);

  if (targetField === 'tags' && payload?.tag_validation?.count) {

    const count = payload.tag_validation.count;

    const warn = payload.tag_validation.warnings?.[0];

    return warn

      ? `${count} tag(s) staged to ${label} (${warn})`

      : `${count} tag(s) staged to ${label}`;

  }

  return `Staged to ${label}`;

}



/** Open dock + stage selection into the saved capture dock target. */

export async function activateSpot() {

  _spotActive = true;

  const dock = window.__pasteCraftMerchant?.dock;

  dock?.open();



  const selectedText = readSelectionText();

  if (!selectedText) {

    const targetLabel = getDockTargetLabel(getCaptureDockTarget());

    return {

      ok: true,

      staged: false,

      phase: 3,

      message: `Spot opened dock — select text, then click Spot to stage to ${targetLabel}.`,

    };

  }



  const targetField = await readCaptureDockTarget();

  const result = await stageTextToDockTarget(selectedText, targetField, 'spot');

  if (!result.ok) {

    return {

      ok: false,

      staged: false,

      phase: 3,

      message: result.error || 'Could not stage selection.',

    };

  }



  await dock?.applyPayload(result.payload);

  clearSelectionCache();



  return {

    ok: true,

    staged: true,

    phase: 3,

    message: `${buildStageMessage(targetField, result.payload)} — ephemeral, not saved forever.`,

  };

}



export function deactivateSpot() {

  _spotActive = false;

  clearSelectionCache();

}



export function getSpotStatusLabel() {

  if (!_spotActive) return 'Spot idle';

  const dock = window.__pasteCraftMerchant?.dock;

  if (dock?.isOpen?.()) return 'Spot + dock open';

  return 'Spot active';

}



/** Legacy export for backward compat within merchant layer. */

export const activateSpotPlaceholder = activateSpot;

export const deactivateSpotPlaceholder = deactivateSpot;


