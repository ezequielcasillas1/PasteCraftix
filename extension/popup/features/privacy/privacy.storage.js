import { PRIVACY_NOTICE_VERSION, PRIVACY_STORAGE_KEYS } from './privacy.constants.js';

export async function getPrivacyAckVersion() {
  try {
    const result = await chrome.storage.local.get([PRIVACY_STORAGE_KEYS.ACK_VERSION]);
    const raw = result[PRIVACY_STORAGE_KEYS.ACK_VERSION];
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch (_) {
    return 0;
  }
}

export async function acknowledgePrivacyNotice(version = PRIVACY_NOTICE_VERSION) {
  const v = Number(version);
  const next = Number.isFinite(v) && v > 0 ? v : PRIVACY_NOTICE_VERSION;
  await chrome.storage.local.set({ [PRIVACY_STORAGE_KEYS.ACK_VERSION]: next });
  return next;
}

export async function needsPrivacyChangeNotice() {
  const ack = await getPrivacyAckVersion();
  return ack < PRIVACY_NOTICE_VERSION;
}
