/** @forward-slice Popup site-access init — independent of popup.js monolith. */

import { bindSiteAccessEvents } from './site-access.events.js';
import { refreshSiteAccessBanner } from './site-access.render.js';

export function initSiteAccessFeature() {
  if (initSiteAccessFeature._started) return;
  initSiteAccessFeature._started = true;
  bindSiteAccessEvents();
  refreshSiteAccessBanner().catch(() => {});
}
