import { CREDIT_PACKS } from '../billing/billing.constants.js';

import {

  CUSTOM_CREDIT_MIN,

  CHECKOUT_MIN_CREDITS,

  meetsStripeMinimum,

  formatCreditPricePreview,

} from '../billing/credit-pricing.js';

import { getCreditPackBannerElements } from './ai-lab.selectors.js';



function _hasPremiumAiAccess(subscription) {

  if (!subscription) return false;

  const tier = String(subscription.subscription_tier || '').toLowerCase();

  const status = String(subscription.subscription_status || '').toLowerCase();

  const expiresAtMs = subscription?.ai_access_expires_at ? Date.parse(subscription.ai_access_expires_at) : NaN;

  const hasCouponAiAccess = !!(

    subscription.has_unlimited_ai === true ||

    (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now())

  );

  return (tier === 'premium' && (status === 'active' || status === 'past_due')) || hasCouponAiAccess;

}



/** Matches create-checkout requireCreditPurchaseEligibility — who may open Stripe. */
export function canPurchaseCreditPacks(subscription) {
  if (!subscription) return false;
  if (subscription.has_unlimited_ai === true) return false;
  return _hasPremiumAiAccess(subscription);
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
    `<button type="button" class="ai-lab-credit-pack-btn" data-action="buy-credit-pack" data-price-id="${pack.priceId}" title="${pack.label} for ${pack.priceLabel}">
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

      const priceId = String(presetBtn.dataset.priceId || '');

      if (!priceId) return;

      app.billingFeature?.service?.createCreditPackCheckout?.(app, priceId);

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


