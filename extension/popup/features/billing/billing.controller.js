import {
  openUpgradeModal,
  closeUpgradeModal,
  openPricingPage,
  createCheckout,
  createCreditPackCheckout,
  createCustomCreditCheckout,
} from './billing.service.js';

import {
  openSupportForm,
  closeSupportForm,
  submitSupportForm,
  openSupportFormSafely,
  initSupportEvents,
} from './billing.support.js';
import * as upgradeUi from './billing.upgrade-ui.js';
import * as unsubscribe from './billing.unsubscribe.js';

export function initBillingFeature(app) {
  app.billingFeature = {
    service: { openUpgradeModal, closeUpgradeModal, openPricingPage, createCheckout, createCreditPackCheckout, createCustomCreditCheckout },
    support: { openSupportForm, closeSupportForm, submitSupportForm, openSupportFormSafely, initSupportEvents },
    upgradeUi,
    unsubscribe,
  };
  return app.billingFeature;
}
