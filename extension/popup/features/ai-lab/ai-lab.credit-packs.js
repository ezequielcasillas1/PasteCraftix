import { CREDIT_PACKS } from '../billing/billing.constants.js';

import {

  CUSTOM_CREDIT_MIN,

  CHECKOUT_MIN_CREDITS,

  meetsStripeMinimum,

  formatCreditPricePreview,

} from '../billing/credit-pricing.js';

import { getCreditPackBannerElements } from './ai-lab.selectors.js';



/** Matches create-checkout requireCreditPurchaseEligibility — any signed-in tier except unlimited AI. */
export function canPurchaseCreditPacks(subscription) {
  if (!subscription) return false;
  if (subscription.has_unlimited_ai === true) return false;
  return true;
}

function _updateCustomPreview(elements) {

  const { customInput, customPreview, customBuyBtn } = elements;

  if (!customInput || !customPreview) return;



  const raw = customInput.value.trim();

  if (!raw) {

    customPreview.textContent = `Enter credits (min ${CUSTOM_CREDIT_MIN}, checkout min ${CHECKOUT_MIN_CREDITS})`;

    if (customBuyBtn) customBuyBtn.disabled = true;

    return;

  }



  const credits = Math.floor(Number(raw));

  customPreview.textContent = formatCreditPricePreview(credits);

  if (customBuyBtn) {

    customBuyBtn.disabled = !Number.isFinite(credits) || credits < CUSTOM_CREDIT_MIN || !meetsStripeMinimum(credits);

  }

}



export function shouldShowCreditPackBanner(subscription) {
  return canPurchaseCreditPacks(subscription);
}



export function renderCreditPackBanner(app) {

  const elements = getCreditPackBannerElements();

  const { banner, packRow } = elements;

  if (!banner || !packRow) return;



  const show = shouldShowCreditPackBanner(app.userSubscription);

  banner.hidden = !show;

  if (!show) return;



  packRow.innerHTML = CREDIT_PACKS.map((pack) => (
    `<button type="button" class="ai-lab-credit-pack-btn" data-action="buy-credit-pack" data-credits="${pack.credits}" title="${pack.label} for ${pack.priceLabel}">
      <span class="ai-lab-credit-pack-amount">${pack.label}</span>
      <span class="ai-lab-credit-pack-price">${pack.priceLabel}</span>
    </button>`
  )).join('');



  _updateCustomPreview(elements);

}



export function bindCreditPackBannerEvents(app) {

  const elements = getCreditPackBannerElements();

  const { banner, customInput } = elements;

  if (!banner || banner.dataset.bound === '1') return;

  banner.dataset.bound = '1';



  banner.addEventListener('click', (event) => {

    const presetBtn = event.target.closest('[data-action="buy-credit-pack"]');

    if (presetBtn) {

      const credits = Math.floor(Number(presetBtn.dataset.credits));
      if (!Number.isFinite(credits)) return;
      // Route preset packs through custom checkout pricing to avoid
      // Stripe mode mismatch on hard-coded price IDs.
      app.billingFeature?.service?.createCustomCreditCheckout?.(app, credits);

      return;

    }



    const customBtn = event.target.closest('[data-action="buy-custom-credit-pack"]');

    if (customBtn && customInput) {

      const credits = Math.floor(Number(customInput.value));

      if (!Number.isFinite(credits)) return;

      app.billingFeature?.service?.createCustomCreditCheckout?.(app, credits);

    }

  });



  if (customInput) {

    customInput.addEventListener('input', () => _updateCustomPreview(elements));

  }

}



export function refreshCreditPackBanner(app) {

  renderCreditPackBanner(app);

}


