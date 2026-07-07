/**
 * Spot (#29) — Merchant content hook (Phase 3).
 * Opens listing dock and stages page selection / listing pack with Etsy tag validation.
 */

import { getPageSelectionText } from '../capture/capture.selection.js';
import { parseListingPackText, stageFromSelectionText } from './merchant.dock-storage.js';
import { validateEtsyTags } from './merchant.tags.js';

let _spotActive = false;

export function isSpotActive() {
  return _spotActive;
}

/** Phase 3: open dock + stage selection or listing-pack text with tag validation. */
export async function activateSpot() {
  _spotActive = true;
  const dock = window.__pasteCraftMerchant?.dock;
  dock?.open();

  const selectedText = getPageSelectionText();
  if (!selectedText) {
    return {
      ok: true,
      staged: false,
      phase: 3,
      message: 'Spot opened dock — select text on page, then click Spot again to stage.',
    };
  }

  const parsed = parseListingPackText(selectedText);
  const result = await stageFromSelectionText(selectedText, 'spot');
  if (!result.ok) {
    return {
      ok: false,
      staged: false,
      phase: 3,
      message: result.error || 'Could not stage selection.',
    };
  }

  await dock?.applyPayload(result.payload);

  let fieldHint = 'Selection staged';
  if (parsed.tags) {
    const validation = validateEtsyTags(parsed.tags);
    fieldHint = `${validation.count} tag(s) staged`;
    if (validation.warnings.length > 0) {
      fieldHint += ` (${validation.warnings[0]})`;
    }
  } else if (parsed.title || parsed.description) {
    fieldHint = 'Listing pack staged (title/desc in Advanced)';
  } else if (result.payload?.tags) {
    const validation = validateEtsyTags(result.payload.tags);
    fieldHint = `${validation.count} tag(s) staged from selection`;
  }

  return {
    ok: true,
    staged: true,
    phase: 3,
    message: `${fieldHint} — ephemeral, not saved forever.`,
  };
}

export function deactivateSpot() {
  _spotActive = false;
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
