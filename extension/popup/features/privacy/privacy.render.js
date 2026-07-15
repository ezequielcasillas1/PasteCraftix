import {
  PRIVACY_DISCLOSURE_ITEMS,
  PRIVACY_ELEMENT_IDS,
  PRIVACY_NOTICE_VERSION,
  PRIVACY_URLS,
} from './privacy.constants.js';
import { needsPrivacyChangeNotice } from './privacy.storage.js';

function _setLink(id, href) {
  const el = document.getElementById(id);
  if (!el) return;
  el.href = href;
  el.target = '_blank';
  el.rel = 'noopener noreferrer';
}

export function wireAuthPrivacyLinks() {
  document.querySelectorAll('[data-privacy-link="terms"]').forEach((el) => {
    el.href = PRIVACY_URLS.TERMS;
    el.target = '_blank';
    el.rel = 'noopener noreferrer';
  });
  document.querySelectorAll('[data-privacy-link="policy"]').forEach((el) => {
    el.href = PRIVACY_URLS.POLICY;
    el.target = '_blank';
    el.rel = 'noopener noreferrer';
  });
  _setLink(PRIVACY_ELEMENT_IDS.POLICY_LINK, PRIVACY_URLS.POLICY);
  _setLink(PRIVACY_ELEMENT_IDS.TERMS_LINK, PRIVACY_URLS.TERMS);
}

export async function refreshPrivacyDisclosure() {
  wireAuthPrivacyLinks();

  const notice = document.getElementById(PRIVACY_ELEMENT_IDS.CHANGE_NOTICE);
  const ackBtn = document.getElementById(PRIVACY_ELEMENT_IDS.ACK_BTN);
  if (!notice) return;

  const needsAck = await needsPrivacyChangeNotice();
  notice.hidden = !needsAck;
  if (ackBtn) ackBtn.hidden = !needsAck;

  const versionEl = notice.querySelector('[data-field="privacy-notice-version"]');
  if (versionEl) versionEl.textContent = String(PRIVACY_NOTICE_VERSION);
}

export function ensureDisclosureListRendered() {
  const list = document.querySelector(`#${PRIVACY_ELEMENT_IDS.SECTION} [data-field="privacy-disclosure-list"]`);
  if (!list || list.dataset.rendered === '1') return;

  list.innerHTML = PRIVACY_DISCLOSURE_ITEMS.map(
    (item) => `<li><strong>${item.title}:</strong> ${item.body}</li>`,
  ).join('');
  list.dataset.rendered = '1';
}
