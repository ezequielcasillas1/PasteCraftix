import { PRIVACY_ELEMENT_IDS, PRIVACY_NOTICE_VERSION } from './privacy.constants.js';
import { acknowledgePrivacyNotice } from './privacy.storage.js';
import { ensureDisclosureListRendered, refreshPrivacyDisclosure, wireAuthPrivacyLinks } from './privacy.render.js';

export function initPrivacyEvents(app) {
  ensureDisclosureListRendered();
  wireAuthPrivacyLinks();
  refreshPrivacyDisclosure().catch(() => {});

  const ackBtn = document.getElementById(PRIVACY_ELEMENT_IDS.ACK_BTN);
  if (ackBtn && !ackBtn.dataset.pcPrivacyBound) {
    ackBtn.dataset.pcPrivacyBound = '1';
    ackBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await acknowledgePrivacyNotice(PRIVACY_NOTICE_VERSION);
        await refreshPrivacyDisclosure();
        app.showToast?.('Privacy notice acknowledged', 'success');
      } catch (err) {
        console.error('[Privacy] ack failed:', err);
        app.showToast?.('Could not save privacy acknowledgment', 'error');
      }
    });
  }

  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn && !settingsBtn.dataset.pcPrivacyRefreshBound) {
    settingsBtn.dataset.pcPrivacyRefreshBound = '1';
    settingsBtn.addEventListener('click', () => {
      ensureDisclosureListRendered();
      refreshPrivacyDisclosure().catch(() => {});
    });
  }
}
