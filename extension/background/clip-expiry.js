import {
  CLIP_EXPIRY_ALARM,
  purgeExpiredClipsFromStorage,
  scheduleClipExpiryAlarm,
} from '../shared/clip-expiry.js';

export async function runClipExpiryCycle() {
  const result = await purgeExpiredClipsFromStorage();
  await scheduleClipExpiryAlarm();
  return result;
}

export function initClipExpiryAlarms() {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm?.name !== CLIP_EXPIRY_ALARM) return;
    runClipExpiryCycle().catch((e) => {
      console.error('[clip-expiry] alarm purge failed:', e);
    });
  });

  runClipExpiryCycle().catch((e) => {
    console.error('[clip-expiry] startup purge failed:', e);
  });
}
