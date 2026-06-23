import { MERCHANT_PULSE_STATES } from './merchant.constants.js';
import {
  isDockPayloadEmpty,
  isDockPayloadExpired,
  readListingDock,
} from './merchant.dock-storage.js';

const EXPIRING_SOON_MS = 2 * 60 * 60 * 1000;

export function getPulseStateFromPayload(payload) {
  if (!payload || isDockPayloadEmpty(payload)) {
    return MERCHANT_PULSE_STATES.EMPTY;
  }
  if (isDockPayloadExpired(payload)) {
    return MERCHANT_PULSE_STATES.EXPIRED;
  }
  const remaining = Date.parse(payload.expires_at) - Date.now();
  if (remaining <= EXPIRING_SOON_MS) {
    return MERCHANT_PULSE_STATES.EXPIRING;
  }
  return MERCHANT_PULSE_STATES.LIVE;
}

export async function getMerchantPulseState() {
  const payload = await readListingDock();
  return getPulseStateFromPayload(payload);
}

export function getPulseLabel(state) {
  switch (state) {
    case MERCHANT_PULSE_STATES.LIVE:
      return 'Staging live — not saved forever';
    case MERCHANT_PULSE_STATES.EXPIRING:
      return 'Expiring soon — will vanish';
    case MERCHANT_PULSE_STATES.EXPIRED:
      return 'Staging expired';
    default:
      return 'No staging — dock empty';
  }
}

export function applyPulseToStrip(stripEl, state) {
  if (!stripEl) return;

  const pulse = stripEl.querySelector('[data-field="pc-merchant-pulse"]');
  const pulseLabel = stripEl.querySelector('[data-field="pc-merchant-pulse-label"]');
  if (!pulse || !pulseLabel) return;

  pulse.setAttribute('data-pulse', state);
  pulse.setAttribute('aria-label', getPulseLabel(state));
  pulseLabel.textContent = getPulseLabel(state);
}

export async function refreshMerchantPulse(stripEl) {
  const state = await getMerchantPulseState();
  applyPulseToStrip(stripEl, state);
  return state;
}
