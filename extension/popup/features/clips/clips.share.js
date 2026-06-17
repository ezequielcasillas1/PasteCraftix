/** Share overlay for a single clip (copy, WhatsApp, Reddit, X, email, phone QR, Facebook). */

import { openEmailShare } from '../../shared/protocol-share.js';
import {
  createPhoneQrSection,
  togglePhoneQrPanel,
  wirePhoneQrSection,
} from '../../shared/qr-phone-share.js';

function sanitizeShareText(raw, maxLen = 1800) {
  const cleaned = String(raw ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

async function getActiveTabUrlSafe() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tabs?.[0]?.url;
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return '';
    return url;
  } catch (_) {
    return '';
  }
}

function openUrlInNewTab(url) {
  try {
    chrome.tabs.create({ url: String(url) });
  } catch (e) {
    console.error('[clips.share] Failed to open URL:', e);
  }
}

export function closeShareMenu() {
  document.getElementById('pcShareMenuOverlay')?.remove();
}

export async function showShareMenuForClip(app, clip) {
  const clipText = clip && typeof clip === 'object' ? (clip.text ?? '') : String(clip ?? '');
  const text = sanitizeShareText(clipText, 2000);
  if (!text) {
    app.showToast('Nothing to share', 'error');
    return;
  }

  const title = sanitizeShareText(text.split('\n')[0], 80) || 'PasteCraft Clip';
  const tweetText = sanitizeShareText(text, 260);
  const activeUrl = await getActiveTabUrlSafe();
  const fbUrl = activeUrl || 'https://pastecraft.com';

  closeShareMenu();

  const overlay = document.createElement('div');
  overlay.id = 'pcShareMenuOverlay';
  overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 2147483647;
      background: rgba(0,0,0,0.35);
      display: flex; align-items: center; justify-content: center;
      padding: 16px;
    `;

  const card = document.createElement('div');
  card.style.cssText = `
      width: min(520px, 96vw);
      background: #111827;
      color: #e5e7eb;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      padding: 14px;
      box-shadow: 0 14px 40px rgba(0,0,0,0.4);
    `;

  const preview = text.length > 160 ? `${text.slice(0, 160)}…` : text;

  card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div style="font-weight:700;">Share</div>
        <button id="pcShareCloseBtn" class="btn-secondary" type="button" style="padding:6px 10px;">Close</button>
      </div>
      <div style="margin-top:10px; font-size:12px; color:#9ca3af; line-height:1.4; word-break:break-word;">
        ${app.escapeHtml(preview)}
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:12px;">
        <button id="pcShareCopyBtn" class="btn-primary" type="button">Copy</button>
        <button id="pcSharePhoneBtn" class="btn-secondary" type="button">📱 Send to phone</button>
        <button id="pcShareWhatsAppBtn" class="btn-secondary" type="button">WhatsApp</button>
        <button id="pcShareRedditBtn" class="btn-secondary" type="button">Reddit</button>
        <button id="pcShareXBtn" class="btn-secondary" type="button">X</button>
        <button id="pcShareEmailBtn" class="btn-secondary" type="button">Email</button>
        <button id="pcShareFacebookBtn" class="btn-secondary" type="button">Facebook</button>
      </div>
      <div style="margin-top:10px; font-size:11px; color:#9ca3af;">
        Facebook sharing is URL-based; your clip text is best shared via Copy.
      </div>
    `;

  const phoneQrSection = createPhoneQrSection();
  card.appendChild(phoneQrSection);
  wirePhoneQrSection(phoneQrSection, app, text, {
    copyText: (value) => app.copyClipToClipboard(value),
  });

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const close = () => closeShareMenu();
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  card.querySelector('#pcShareCloseBtn')?.addEventListener('click', close);

  card.querySelector('#pcShareCopyBtn')?.addEventListener('click', async () => {
    try {
      await app.copyClipToClipboard(text);
      app.showToast('Copied for sharing');
    } catch (e) {
      console.error('[clips.share] Copy failed:', e);
      app.showToast('Copy failed', 'error');
    }
  });

  card.querySelector('#pcSharePhoneBtn')?.addEventListener('click', async () => {
    await togglePhoneQrPanel(phoneQrSection, app, text, {
      copyText: (value) => app.copyClipToClipboard(value),
    });
  });

  card.querySelector('#pcShareWhatsAppBtn')?.addEventListener('click', () => {
    openUrlInNewTab(`https://wa.me/?text=${encodeURIComponent(text)}`);
    close();
  });

  card.querySelector('#pcShareRedditBtn')?.addEventListener('click', () => {
    openUrlInNewTab(
      `https://www.reddit.com/submit?title=${encodeURIComponent(title)}&text=${encodeURIComponent(text)}`,
    );
    close();
  });

  card.querySelector('#pcShareXBtn')?.addEventListener('click', () => {
    openUrlInNewTab(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`);
    close();
  });

  card.querySelector('#pcShareEmailBtn')?.addEventListener('click', () => {
    openEmailShare({ subject: title, body: text });
    close();
  });

  card.querySelector('#pcShareFacebookBtn')?.addEventListener('click', async () => {
    try {
      await app.copyClipToClipboard(text);
    } catch (_) {}
    openUrlInNewTab(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fbUrl)}`);
    app.showToast('Copied text. Facebook shares URL.');
    close();
  });
}
