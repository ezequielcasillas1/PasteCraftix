/** Two-step testimonial share flow for profile image viewer. */

import { openEmailShare } from '../../shared/protocol-share.js';
import {
  createPhoneQrSection,
  togglePhoneQrPanel,
  wirePhoneQrSection,
} from '../../shared/qr-phone-share.js';

const PASTECRAFT_URL = 'https://pastecraft.com';
const OVERLAY_ID = 'pcProfileShareOverlay';

export const TESTIMONIAL_OPTIONS = Object.freeze([
  { id: 'productivity', text: 'PasteCraft has helped me in productivity' },
  { id: 'studying', text: 'PasteCraft has helped me in studying' },
  { id: 'business', text: 'PasteCraft has helped me in my business' },
]);

function sanitizeShareText(raw, maxLen = 1800) {
  const cleaned = String(raw ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

function openUrlInNewTab(url) {
  try {
    chrome.tabs.create({ url: String(url) });
  } catch (e) {
    console.error('[profile.social-share] Failed to open URL:', e);
  }
}

function isShareableImageUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

function buildShareText(testimonial, avatarUrl) {
  const testimonialClean = sanitizeShareText(testimonial, 500);
  const parts = [testimonialClean, '', PASTECRAFT_URL];
  if (isShareableImageUrl(avatarUrl)) {
    parts.splice(2, 0, '', `My PasteCraft avatar: ${avatarUrl}`);
  }
  return parts.join('\n');
}

export function closeProfileShareOverlay() {
  document.getElementById(OVERLAY_ID)?.remove();
}

function createOverlay() {
  closeProfileShareOverlay();
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'profile-share-overlay';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeProfileShareOverlay();
  });
  return overlay;
}

function showTestimonialPicker(app, avatarUrl) {
  const overlay = createOverlay();
  const card = document.createElement('div');
  card.className = 'profile-share-card';
  card.innerHTML = `
    <div class="profile-share-header">
      <div class="profile-share-title">Share your PasteCraft story</div>
      <button type="button" class="profile-share-close" id="pcProfileShareClose" aria-label="Close">✕</button>
    </div>
    <p class="profile-share-subtitle">Pick a message, then share it with your avatar.</p>
    <div class="profile-share-testimonial-list" id="pcProfileTestimonialList"></div>
  `;
  overlay.appendChild(card);

  card.querySelector('#pcProfileShareClose')?.addEventListener('click', closeProfileShareOverlay);

  const list = card.querySelector('#pcProfileTestimonialList');
  TESTIMONIAL_OPTIONS.forEach((option) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'profile-share-testimonial-option';
    btn.textContent = option.text;
    btn.addEventListener('click', () => {
      showSharePlatformMenu(app, option.text, avatarUrl);
    });
    list?.appendChild(btn);
  });
}

function showSharePlatformMenu(app, testimonial, avatarUrl) {
  const text = buildShareText(testimonial, avatarUrl);
  const title = sanitizeShareText(testimonial, 80) || 'PasteCraft';
  const tweetText = sanitizeShareText(text, 260);
  const preview = text.length > 160 ? `${text.slice(0, 160)}…` : text;

  const overlay = createOverlay();
  const card = document.createElement('div');
  card.className = 'profile-share-card';
  card.innerHTML = `
    <div class="profile-share-header">
      <div class="profile-share-title">Share testimonial</div>
      <button type="button" class="profile-share-close" id="pcProfileShareClose" aria-label="Close">✕</button>
    </div>
    <div class="profile-share-preview">${app.escapeHtml(preview)}</div>
    <div class="profile-share-platforms">
      <button type="button" class="profile-share-platform-btn profile-share-platform-btn--primary" id="pcProfileShareCopy">Copy</button>
      <button type="button" class="profile-share-platform-btn" id="pcProfileSharePhone">📱 Send to phone</button>
      <button type="button" class="profile-share-platform-btn" id="pcProfileShareWhatsApp">WhatsApp</button>
      <button type="button" class="profile-share-platform-btn" id="pcProfileShareX">X</button>
      <button type="button" class="profile-share-platform-btn" id="pcProfileShareFacebook">Facebook</button>
      <button type="button" class="profile-share-platform-btn" id="pcProfileShareLinkedIn">LinkedIn</button>
      <button type="button" class="profile-share-platform-btn" id="pcProfileShareEmail">Email</button>
    </div>
    <button type="button" class="profile-share-back" id="pcProfileShareBack">← Change message</button>
  `;

  const phoneQrSection = createPhoneQrSection();
  card.appendChild(phoneQrSection);
  wirePhoneQrSection(phoneQrSection, app, text, {
    copyText: (value) => app.copyClipToClipboard(value),
  });

  overlay.appendChild(card);

  const close = () => closeProfileShareOverlay();
  card.querySelector('#pcProfileShareClose')?.addEventListener('click', close);
  card.querySelector('#pcProfileShareBack')?.addEventListener('click', () => {
    showTestimonialPicker(app, avatarUrl);
  });

  card.querySelector('#pcProfileShareCopy')?.addEventListener('click', async () => {
    try {
      await app.copyClipToClipboard(text);
      app.showToast('Copied for sharing');
    } catch (e) {
      console.error('[profile.social-share] Copy failed:', e);
      app.showToast('Copy failed', 'error');
    }
  });

  card.querySelector('#pcProfileSharePhone')?.addEventListener('click', async () => {
    await togglePhoneQrPanel(phoneQrSection, app, text, {
      copyText: (value) => app.copyClipToClipboard(value),
    });
  });

  card.querySelector('#pcProfileShareWhatsApp')?.addEventListener('click', () => {
    openUrlInNewTab(`https://wa.me/?text=${encodeURIComponent(text)}`);
    close();
  });

  card.querySelector('#pcProfileShareX')?.addEventListener('click', () => {
    openUrlInNewTab(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`);
    close();
  });

  card.querySelector('#pcProfileShareEmail')?.addEventListener('click', () => {
    openEmailShare({ subject: title, body: text });
    close();
  });

  card.querySelector('#pcProfileShareFacebook')?.addEventListener('click', async () => {
    try {
      await app.copyClipToClipboard(text);
    } catch (_) {}
    openUrlInNewTab(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(PASTECRAFT_URL)}`);
    app.showToast('Copied text. Facebook shares URL.');
    close();
  });

  card.querySelector('#pcProfileShareLinkedIn')?.addEventListener('click', async () => {
    try {
      await app.copyClipToClipboard(text);
    } catch (_) {}
    openUrlInNewTab(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(PASTECRAFT_URL)}`,
    );
    app.showToast('Copied text. LinkedIn shares URL.');
    close();
  });
}

export function showProfileTestimonialShare(app, avatarUrl = '') {
  if (!app) return;
  showTestimonialPicker(app, avatarUrl);
}
