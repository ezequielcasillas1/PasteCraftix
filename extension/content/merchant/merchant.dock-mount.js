/**
 * Listing dock shadow-host mount / open / close (Phase 3A extract).
 * @forward-slice merchant
 */
import { getMerchantDockStyles } from './merchant.dock-styles.js';
import { injectShadowStyles } from '../safety/shadow-host.js';
import { mountMerchantHost } from './merchant.mount.js';
import { buildDockMarkup } from './merchant.dock-layout.js';

/** Create host + closed shadow + panel; mutate dock fields. Does not bind events. */
export function createListingDockShadow(dock) {
  dock.host = document.createElement('div');
  dock.host.setAttribute('data-field', 'pc-merchant-dock-host');
  dock.host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483646;pointer-events:none;transform:none;';

  dock.root = dock.host.attachShadow({ mode: 'closed' });
  injectShadowStyles(dock.root, getMerchantDockStyles(), 'pc-merchant-dock-styles');

  const wrapper = document.createElement('div');
  wrapper.innerHTML = buildDockMarkup();
  dock.panelEl = wrapper.firstElementChild;
  dock.root.appendChild(dock.panelEl);
  return dock;
}

export function attachListingDockHost(dock) {
  mountMerchantHost(dock.host);
  return dock;
}

export function destroyListingDockHost(dock) {
  dock.host?.remove();
  dock.host = null;
  dock.root = null;
  dock.panelEl = null;
}

export function showListingDockPanel(dock) {
  if (!dock.panelEl) return;
  dock.panelEl.hidden = false;
  dock._open = true;
}

export function hideListingDockPanel(dock) {
  if (!dock.panelEl) return;
  dock.panelEl.hidden = true;
  dock._open = false;
}
