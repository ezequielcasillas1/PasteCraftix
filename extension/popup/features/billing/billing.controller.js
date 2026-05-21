import {
  openUpgradeModal,
  closeUpgradeModal,
  openPricingPage,
  createCheckout,
} from './billing.service.js';

import {
  openSupportForm,
  closeSupportForm,
  submitSupportForm,
  openSupportFormSafely,
  initSupportEvents,
} from './billing.support.js';
import * as upgradeUi from './billing.upgrade-ui.js';

export function initBillingFeature(app) {
  app.billingFeature = {
    service: { openUpgradeModal, closeUpgradeModal, openPricingPage, createCheckout },
    support: { openSupportForm, closeSupportForm, submitSupportForm, openSupportFormSafely, initSupportEvents },
    upgradeUi,
  };
  return app.billingFeature;
}
