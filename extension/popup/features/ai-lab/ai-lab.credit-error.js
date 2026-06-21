/**
 * Credit exhaustion error helpers for AI Lab.
 * Detects the 402 "No * credits remaining" response from Edge Functions
 * and renders a styled, actionable inline card instead of a generic error.
 */

const OUT_OF_CREDITS_PATTERNS = [
  'No text credits remaining',
  'No image credits remaining',
  'no text credits',
  'no image credits',
  'need more ai credits',
];

export function isOutOfCreditsError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return OUT_OF_CREDITS_PATTERNS.some((p) => msg.includes(p.toLowerCase()));
}

/**
 * Replace the content of `resultEl` with a polished "out of credits" card.
 * Provides two CTAs: Buy Credits (reveals the credit pack banner) and Upgrade Plan.
 *
 * @param {object} app        - The popup app instance (needs openUpgradeModal).
 * @param {HTMLElement|null} resultEl   - The element to render the card into.
 * @param {HTMLElement|null} loadingEl  - The loading spinner to hide.
 */
export function showCreditExhaustedInline(app, resultEl, loadingEl) {
  if (loadingEl) loadingEl.style.display = 'none';
  if (!resultEl) return;

  const card = document.createElement('div');
  card.className = 'ai-credit-empty-card';
  card.setAttribute('role', 'status');

  const iconEl = document.createElement('div');
  iconEl.className = 'ai-credit-empty-icon';
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.textContent = '⚡';

  const bodyEl = document.createElement('div');
  bodyEl.className = 'ai-credit-empty-body';

  const titleEl = document.createElement('strong');
  titleEl.className = 'ai-credit-empty-title';
  titleEl.textContent = "You're out of AI credits";

  const textEl = document.createElement('p');
  textEl.className = 'ai-credit-empty-text';
  textEl.textContent = 'Buy a credit pack to keep going, or upgrade for a monthly allowance.';

  const actionsEl = document.createElement('div');
  actionsEl.className = 'ai-credit-empty-actions';

  const buyBtn = document.createElement('button');
  buyBtn.type = 'button';
  buyBtn.className = 'ai-credit-empty-btn-buy';
  buyBtn.textContent = '✦ Buy Credits';
  buyBtn.addEventListener('click', () => {
    const banner = document.getElementById('aiLabCreditPackBanner');
    if (banner) {
      banner.hidden = false;
      banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      banner.classList.add('ai-credit-pack-highlight');
      setTimeout(() => banner.classList.remove('ai-credit-pack-highlight'), 1600);
    }
  });

  const upgradeBtn = document.createElement('button');
  upgradeBtn.type = 'button';
  upgradeBtn.className = 'ai-credit-empty-btn-upgrade';
  upgradeBtn.textContent = 'Upgrade Plan';
  upgradeBtn.addEventListener('click', () => {
    if (typeof app?.openUpgradeModal === 'function') app.openUpgradeModal();
  });

  actionsEl.appendChild(buyBtn);
  actionsEl.appendChild(upgradeBtn);
  bodyEl.appendChild(titleEl);
  bodyEl.appendChild(textEl);
  bodyEl.appendChild(actionsEl);
  card.appendChild(iconEl);
  card.appendChild(bodyEl);

  resultEl.innerHTML = '';
  resultEl.appendChild(card);
}
