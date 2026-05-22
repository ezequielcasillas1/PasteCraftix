/** Extracted from popup.js setupEventListeners — behavior unchanged. */

export function registerBillingUpgradeEvents(app) {
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
    const upgradeBtnBasic = document.getElementById('upgradeBtnBasic');
    if (upgradeBtnBasic) upgradeBtnBasic.addEventListener('click', () => {
      app.closeUpgradeModal();
      app._createCheckout('price_1SsbTZLOdeLTrjap9UnXhu0M');
    });
    const upgradeBtnEnhanced = document.getElementById('upgradeBtnEnhanced');
    if (upgradeBtnEnhanced) upgradeBtnEnhanced.addEventListener('click', () => {
      app.closeUpgradeModal();
      app._createCheckout('price_1SUYs3LOdeLTrjapCFFDe7td');
    });
}
