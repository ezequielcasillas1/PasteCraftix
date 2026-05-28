import { getAnnouncementBannerElements } from './ai-lab.selectors.js';

const DISMISS_STORAGE_KEY = 'pc_dismissed_announcements_v1';

function _readDismissedIds() {
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch (_) {
    return [];
  }
}

function _saveDismissedIds(ids) {
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(Array.from(new Set(ids))));
  } catch (_) {}
}

function _resolveAudience(subscription) {
  if (!subscription) return 'free';
  const tier = String(subscription.subscription_tier || '').toLowerCase();
  const status = String(subscription.subscription_status || '').toLowerCase();
  if (tier === 'premium' && (status === 'active' || status === 'past_due')) return 'premium';
  if (tier === 'basic' && (status === 'active' || status === 'past_due')) return 'basic';
  return 'free';
}

async function _fetchAnnouncements(audience) {
  const cfg = PASTECRAFT_CONFIG?.supabase || {};
  const supabaseUrl = String(cfg.url || '');
  const anonKey = String(cfg.anonKey || '');
  if (!supabaseUrl || !anonKey) return [];

  const resp = await fetch(`${supabaseUrl}/functions/v1/get-announcements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ audience }),
  });

  const data = await resp.json().catch(() => ({}));
  return Array.isArray(data?.announcements) ? data.announcements : [];
}

export function bindAnnouncementBannerEvents(app) {
  const { banner } = getAnnouncementBannerElements();
  if (!banner || banner.dataset.bound === '1') return;
  banner.dataset.bound = '1';

  banner.addEventListener('click', (event) => {
    const dismissBtn = event.target.closest('[data-action="dismiss-announcement"]');
    if (!dismissBtn) return;
    const id = String(dismissBtn.dataset.announcementId || '');
    if (!id) return;
    const dismissed = _readDismissedIds();
    dismissed.push(id);
    _saveDismissedIds(dismissed);
    renderAnnouncementBanner(app);
  });
}

export async function renderAnnouncementBanner(app) {
  const { banner, messageEl, linkEl } = getAnnouncementBannerElements();
  if (!banner || !messageEl) return;

  try {
    const audience = _resolveAudience(app.userSubscription);
    const announcements = await _fetchAnnouncements(audience);
    const dismissed = new Set(_readDismissedIds());
    const next = announcements.find((row) => row?.id && !dismissed.has(String(row.id)));

    if (!next) {
      banner.hidden = true;
      return;
    }

    banner.hidden = false;
    banner.dataset.announcementId = String(next.id);
    messageEl.textContent = next.body ? `${next.title} — ${next.body}` : String(next.title || '');

    if (linkEl) {
      if (next.link_url) {
        linkEl.hidden = false;
        linkEl.href = String(next.link_url);
        linkEl.textContent = String(next.link_label || 'Learn more');
      } else {
        linkEl.hidden = true;
        linkEl.removeAttribute('href');
      }
    }

    const dismissBtn = banner.querySelector('[data-action="dismiss-announcement"]');
    if (dismissBtn) dismissBtn.dataset.announcementId = String(next.id);
  } catch (error) {
    console.warn('[ai-lab.announcements] fetch failed:', error);
    banner.hidden = true;
  }
}
