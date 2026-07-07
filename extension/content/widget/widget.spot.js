/**
 * Scholar Spot (#29) — widget handler.
 * Phase A: selection → save clip + copy to clipboard option via toast feedback.
 */

import { getPageSelectionText, copyTextToClipboard } from '../capture/capture.selection.js';
import { CAPTURE_STORAGE_KEYS, DEFAULT_SPOT_PRESETS } from '../capture/capture.constants.js';
import { saveTextClipFromContent } from '../capture/capture.clip-save.js';

let _spotActive = false;

export function isWidgetSpotActive() {
  return _spotActive;
}

async function readSpotPresets() {
  try {
    const stored = await chrome.storage.local.get([CAPTURE_STORAGE_KEYS.SPOT_PRESETS]);
    const raw = stored[CAPTURE_STORAGE_KEYS.SPOT_PRESETS];
    if (raw && Array.isArray(raw.categories) && raw.categories.length > 0) {
      return raw.categories;
    }
  } catch (err) {
    console.error('[widget.spot:readSpotPresets]', err);
  }
  return DEFAULT_SPOT_PRESETS.map((c) => ({ ...c, items: [...c.items] }));
}

export async function runWidgetSpotAction() {
  _spotActive = true;
  const selectedText = getPageSelectionText();

  if (!selectedText) {
    return {
      ok: true,
      saved: false,
      message: 'Select text on the page, then open Spot again.',
    };
  }

  const saveResult = await saveTextClipFromContent(selectedText);
  if (!saveResult.ok) {
    return {
      ok: false,
      saved: false,
      message: saveResult.error || 'Could not save clip.',
    };
  }

  await copyTextToClipboard(selectedText);
  await readSpotPresets();

  return {
    ok: true,
    saved: true,
    message: 'Selection saved as clip and copied to clipboard.',
  };
}

export function deactivateWidgetSpot() {
  _spotActive = false;
}
