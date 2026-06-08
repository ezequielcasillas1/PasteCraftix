/** Extracted from popup.js setupEventListeners — behavior unchanged. */

import { BILLING_PRICE_IDS } from '../features/billing/billing.constants.js';

export function registerBillingUpgradeEvents(app) {
    // Track active price IDs per plan (default: Basic monthly, Enhanced weekly)
    let basicPriceId    = BILLING_PRICE_IDS.BASIC_MONTHLY;
    let enhancedPriceId = BILLING_PRICE_IDS.ENHANCED_WEEKLY;

    // Upgrade banner + modal (must run on init; banner is visible for freemium users)
    const upgradeBanner = document.getElementById('upgradeBanner');
    if (upgradeBanner) {
      upgradeBanner.addEventListener('click', () => app.openUpgradeModal());
      upgradeBanner.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); app.openUpgradeModal(); } });
    }
    const upgradeSubBtn = document.getElementById('upgradeSubBtn');
    if (upgradeSubBtn) upgradeSubBtn.addEventListener('click', () => app.openUpgradeModal());
    const upgradeModalClose = document.getElementById('upgradeModalClose');
    if (upgradeModalClose) upgradeModalClose.addEventListener('click', () => app.closeUpgradeModal());
    const upgradeModal = document.getElementById('upgradeModal');
    if (upgradeModal) upgradeModal.addEventListener('click', (e) => {
      if (e.target === upgradeModal) app.closeUpgradeModal();
    });

    // Interval toggle buttons — update displayed price and tracked price ID
    document.querySelectorAll('.interval-btn[data-plan="basic"]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.interval-btn[data-plan="basic"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        basicPriceId = btn.dataset.priceId;
        const display = document.getElementById('basicPriceDisplay');
        if (display) display.innerHTML = `${btn.dataset.price}<span>${btn.dataset.period}</span>`;
      });
    });

    document.querySelectorAll('.interval-btn[data-plan="enhanced"]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.interval-btn[data-plan="enhanced"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        enhancedPriceId = btn.dataset.priceId;
        const display = document.getElementById('enhancedPriceDisplay');
        if (display) display.innerHTML = `${btn.dataset.price}<span>${btn.dataset.period}</span>`;
      });
    });

    const upgradeBtnBasic = document.getElementById('upgradeBtnBasic');
    if (upgradeBtnBasic) upgradeBtnBasic.addEventListener('click', () => {
      app.closeUpgradeModal();
      app._createCheckout(basicPriceId);
    });
    const upgradeBtnEnhanced = document.getElementById('upgradeBtnEnhanced');
    if (upgradeBtnEnhanced) upgradeBtnEnhanced.addEventListener('click', () => {
      app.closeUpgradeModal();
      app._createCheckout(enhancedPriceId);
    });
}
