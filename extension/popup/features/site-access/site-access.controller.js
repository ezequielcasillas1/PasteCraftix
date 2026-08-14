/** @forward-slice Popup site-access init — independent of popup.js monolith. */

import { bindSiteAccessEvents } from './site-access.events.js';
import { refreshSiteAccessBanner } from './site-access.render.js';
import { pcDebugOperaAf03f9 } from '../../../shared/optional-permissions.js';

export function initSiteAccessFeature() {
  if (initSiteAccessFeature._started) return;
  initSiteAccessFeature._started = true;
  bindSiteAccessEvents();
  refreshSiteAccessBanner().catch(() => {});
  // #region agent log
  pcDebugOperaAf03f9('H-O1', 'site-access.controller.js:init', 'popup grant banner ready', {});
  // #endregion
}
