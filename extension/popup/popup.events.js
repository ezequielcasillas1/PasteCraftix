/** Coordinates popup-wide event registration (extracted from popup.js). */

import { registerBillingUpgradeEvents } from './events/billing-upgrade.events.js';
import { registerTabNavEvents } from './events/tab-nav.events.js';
import { registerClipsShellEvents } from './events/clips-shell.events.js';
import { registerSharedModalEvents } from './events/modals-shared.events.js';
import { registerCraftToolbarEvents } from './events/craft-toolbar.events.js';
import { registerAiLabPageEvents } from './events/ai-lab-page.events.js';

export function registerPopupEventListeners(app) {
  if (app._popupEventListenersRegistered) return;
  app._popupEventListenersRegistered = true;

  app.setupCategoryClipDelegation();
  registerBillingUpgradeEvents(app);
  registerTabNavEvents(app);
  registerClipsShellEvents(app);
  registerSharedModalEvents(app);
  registerCraftToolbarEvents(app);
  registerAiLabPageEvents(app);

  app.activityFeature.events.initActivityEventListeners(app);
}
