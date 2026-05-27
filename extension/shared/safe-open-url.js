/**
 * Safe external link opening for popup and extension pages.
 */

import { isUrlSafeToOpen, normalizeUrlInput } from './url-safety.js';
import { primeBlocklistFromCache, refreshRemoteBlocklist } from './blocklist-remote.js';

let blocklistInitStarted = false;

function ensureBlocklistLoaded() {
  if (blocklistInitStarted) return;
  blocklistInitStarted = true;
  primeBlocklistFromCache()
    .then(() => refreshRemoteBlocklist())
    .catch(() => {});
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}

function getLinkBlockedModalEls() {
  return {
    modal: document.getElementById('linkBlockedModal'),
    reasonEl: document.getElementById('linkBlockedReason'),
    domainEl: document.getElementById('linkBlockedDomain'),
    closeBtn: document.getElementById('closeLinkBlockedModal'),
    okBtn: document.getElementById('linkBlockedCancelBtn'),
  };
}

let modalListenersBound = false;

function bindLinkBlockedModalListeners() {
  if (modalListenersBound) return;
  const { modal, closeBtn, okBtn } = getLinkBlockedModalEls();
  const hide = () => {
    if (modal) modal.style.display = 'none';
  };
  closeBtn?.addEventListener('click', hide);
  okBtn?.addEventListener('click', hide);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) hide();
  });
  modalListenersBound = true;
}

function ensureLinkBlockedModalInDocument() {
  if (document.getElementById('linkBlockedModal')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="modal-overlay" id="linkBlockedModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);align-items:center;justify-content:center;z-index:99999;">
      <div style="background:#fff;border-radius:12px;padding:20px;max-width:400px;margin:16px;box-shadow:0 10px 40px rgba(0,0,0,.15);">
        <h3 id="linkBlockedTitle" style="margin:0 0 12px;font-size:18px;">Link blocked</h3>
        <p id="linkBlockedReason" style="margin:0 0 12px;color:#374151;line-height:1.5;"></p>
        <p id="linkBlockedDomain" style="margin:0 0 16px;font-size:13px;color:#6b7280;word-break:break-all;"></p>
        <button type="button" id="linkBlockedCancelBtn" style="padding:8px 16px;border-radius:8px;border:1px solid #e5e7eb;background:#2563eb;color:#fff;font-weight:600;cursor:pointer;">OK</button>
      </div>
    </div>`;
  document.body.appendChild(wrap.firstElementChild);
  bindLinkBlockedModalListeners();
}

export function showLinkBlockedModal(result) {
  ensureLinkBlockedModalInDocument();
  bindLinkBlockedModalListeners();
  const { modal, reasonEl, domainEl } = getLinkBlockedModalEls();
  if (!modal) {
    console.warn('[PasteCraft] Link blocked:', result?.reason || 'unsafe');
    return;
  }
  if (reasonEl) {
    reasonEl.textContent = result?.reason || 'This link was blocked for your safety.';
  }
  if (domainEl) {
    const host = result?.host || result?.domain ? String(result.host || result.domain) : '';
    domainEl.innerHTML = host
      ? `<strong>Domain:</strong> ${escapeHtml(host)}`
      : '';
    domainEl.style.display = host ? 'block' : 'none';
  }
  modal.style.display = 'flex';
}

function navigateExternally(url) {
  const target = String(url || '').trim();
  if (!target) return false;
  try {
    chrome.tabs.create({ url: target, active: true }, () => {
      if (chrome.runtime.lastError) {
        window.open(target, '_blank', 'noopener,noreferrer');
      }
    });
    return true;
  } catch (_) {
    try {
      window.open(target, '_blank', 'noopener,noreferrer');
      return true;
    } catch (e2) {
      console.warn('[PasteCraft] Could not open URL tab.', e2?.message || e2);
      return false;
    }
  }
}

/**
 * Validate and open a user clip / attachment URL.
 * @returns {boolean} true if navigation started
 */
export function openUrlSafely(url, { onBlocked } = {}) {
  ensureBlocklistLoaded();
  const targetUrl = normalizeUrlInput(url);
  const check = isUrlSafeToOpen(targetUrl);

  if (!check.allowed) {
    console.warn('[PasteCraft] Blocked URL open:', check.code || 'blocked');
    showLinkBlockedModal(check);
    if (typeof onBlocked === 'function') onBlocked(check);
    return false;
  }

  const resolvedUrl = check.normalizedUrl || targetUrl;
  return navigateExternally(resolvedUrl);
}

/**
 * Delegate clicks on http(s) anchors inside a container through openUrlSafely.
 */
export function bindSafeLinkClick(container) {
  if (!container || container._pcSafeLinkBound) return;
  ensureBlocklistLoaded();

  container.addEventListener('click', (e) => {
    const link = e?.target?.closest?.('a[href], [data-pc-open-url]');
    if (!link || !container.contains(link)) return;

    const href = String(
      link.getAttribute('href') || link.getAttribute('data-href') || link.dataset?.url || '',
    ).trim();
    if (!href || href === '#' || href.startsWith('#')) return;

    e.preventDefault();
    e.stopPropagation();
    openUrlSafely(href);
  });

  container._pcSafeLinkBound = true;
}

export function initUrlSafetyForPopup() {
  ensureBlocklistLoaded();
  bindLinkBlockedModalListeners();
  if (document.body) bindSafeLinkClick(document.body);
}
