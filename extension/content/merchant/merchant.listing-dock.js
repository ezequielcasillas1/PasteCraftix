/**
 * Listing dock facade — composes mount / layout / events / storage siblings.
 * @forward-slice merchant
 */
import {
  MERCHANT_CUSTOM_TAG_LIMIT,
  MERCHANT_PLATFORM_PRESETS,
  MERCHANT_TAG_LIMIT_PRESET_IDS,
} from './merchant.constants.js';
import {
  clearListingDock,
  readListingDock,
  saveListingDock,
  stageFromClipboard,
} from './merchant.dock-storage.js';
import { refreshMerchantPulse } from './merchant.pulse.js';
import {
  copyAllStagedTags,
  clampCustomMaxTags,
  getPlatformProfile,
  pasteNextTag,
  readMerchantPrefs,
  refreshTagQueueTags,
  resetTagQueueIndex,
  updateMerchantPrefs,
} from './merchant.tag-queue.js';
import { copyAllStagedMaterials } from './merchant.materials.js';
import { runSealAndShip } from './merchant.seal-ship.js';
import {
  attachListingDockHost,
  createListingDockShadow,
  destroyListingDockHost,
  hideListingDockPanel,
  showListingDockPanel,
} from './merchant.dock-mount.js';
import {
  getFieldValues as readDockFields,
  renderTagPreview as paintTagPreview,
  selectCustomTagLimit as selectCustomOnPanel,
  setFieldValues as writeDockFields,
  setTagOptionsOpen,
  showDockToast,
  syncCustomButtonState as syncCustomBtnOnPanel,
  syncTagLimitCustomRow as syncCustomRowOnPanel,
  syncTagOptionsPanel as syncOptionsOnPanel,
  updatePlatformHint as paintPlatformHint,
} from './merchant.dock-layout.js';
import { bindListingDockEvents } from './merchant.dock-events.js';

export class MerchantListingDock {
  constructor({ stripEl = null, onChange = null } = {}) {
    this.stripEl = stripEl;
    this.onChange = onChange;
    this.host = null;
    this.root = null;
    this.panelEl = null;
    this._mounted = false;
    this._open = false;
    this._platformPreset = 'etsy';
    this._customMaxTags = MERCHANT_CUSTOM_TAG_LIMIT.DEFAULT;
    this._tagOptionsOpen = false;
  }

  setStripEl(stripEl) {
    this.stripEl = stripEl;
  }

  mount() {
    if (this._mounted || !document.body) return this;

    createListingDockShadow(this);
    this.bindEvents();
    attachListingDockHost(this);
    this._mounted = true;
    this.hydratePrefs().catch(() => {});
    this.hydrateFromStorage().catch(() => {});
    return this;
  }

  unmount() {
    if (!this._mounted) return;
    destroyListingDockHost(this);
    this._mounted = false;
    this._open = false;
  }

  isMounted() {
    return this._mounted;
  }

  isOpen() {
    return this._open;
  }

  getActiveProfile() {
    return getPlatformProfile(this._platformPreset, {
      platformPreset: this._platformPreset,
      customMaxTags: this._customMaxTags,
    });
  }

  bindEvents() {
    bindListingDockEvents(this);
  }

  renderTagPreview(rawTags) {
    paintTagPreview(this.panelEl, rawTags, this.getActiveProfile());
  }

  showDockToast(message) {
    showDockToast(this, message);
  }

  updatePlatformHint() {
    paintPlatformHint(this.panelEl, this.getActiveProfile());
  }

  syncTagLimitCustomRow() {
    syncCustomRowOnPanel(this.panelEl);
  }

  syncCustomButtonState() {
    syncCustomBtnOnPanel(this.panelEl);
  }

  selectCustomTagLimit() {
    selectCustomOnPanel(this.panelEl);
  }

  syncTagOptionsPanel(prefs = null) {
    const active = prefs || {
      platformPreset: this._platformPreset,
      customMaxTags: this._customMaxTags,
    };
    syncOptionsOnPanel(this.panelEl, active);
  }

  toggleTagOptions() {
    if (this._tagOptionsOpen) {
      this.closeTagOptions();
      return;
    }
    this.syncTagOptionsPanel();
    this._tagOptionsOpen = true;
    setTagOptionsOpen(this.panelEl, true);
  }

  closeTagOptions() {
    this._tagOptionsOpen = false;
    setTagOptionsOpen(this.panelEl, false);
  }

  async hydratePrefs() {
    const prefs = await readMerchantPrefs();
    this._platformPreset = prefs.platformPreset;
    this._customMaxTags = prefs.customMaxTags ?? MERCHANT_CUSTOM_TAG_LIMIT.DEFAULT;
    const autoAdvanceEl = this.panelEl?.querySelector('[data-field="dock-queue-auto-advance"]');
    if (autoAdvanceEl) autoAdvanceEl.checked = prefs.queueAutoAdvance !== false;
    this.syncTagOptionsPanel(prefs);
    this.updatePlatformHint();
  }

  async applyTagLimitSelection({ closePanel = false } = {}) {
    const selected = this.panelEl?.querySelector('[data-field="dock-tag-limit-preset"]:checked');
    const presetId = selected?.value || this._platformPreset;
    const presetOk = MERCHANT_TAG_LIMIT_PRESET_IDS.includes(presetId)
      || MERCHANT_PLATFORM_PRESETS[presetId];
    const safeId = presetOk ? presetId : 'etsy';
    const customInput = this.panelEl?.querySelector('[data-field="dock-tag-limit-custom"]');
    const customMaxTags = clampCustomMaxTags(customInput?.value ?? this._customMaxTags);

    this._platformPreset = safeId;
    this._customMaxTags = customMaxTags;
    await updateMerchantPrefs({ platformPreset: safeId, customMaxTags });
    this.syncTagOptionsPanel();
    this.updatePlatformHint();

    const tagsEl = this.panelEl?.querySelector('[data-field="dock-tags"]');
    if (tagsEl) this.renderTagPreview(tagsEl.value);

    await refreshTagQueueTags();
    if (closePanel) this.closeTagOptions();
  }

  async handleCopyTags() {
    const result = await copyAllStagedTags();
    this.showDockToast(result.message || (result.ok ? 'Tags copied.' : 'Copy failed.'));
    return result;
  }

  async handleNextTag() {
    const result = await pasteNextTag();
    this.showDockToast(result.message || (result.ok ? 'Tag copied.' : 'Queue failed.'));
    return result;
  }

  async handleCopyMaterials() {
    const result = await copyAllStagedMaterials();
    this.showDockToast(result.message || (result.ok ? 'Materials copied.' : 'Copy failed.'));
    return result;
  }

  async handleSealShip() {
    const result = await runSealAndShip({
      stripEl: this.stripEl,
      root: window.__pasteCraftMerchant?.strip?.root || null,
    });
    if (result.ok) {
      this.setFieldValues({});
      this.close();
    }
    this.showDockToast(result.message || (result.ok ? 'Staging purged.' : 'Seal & Ship failed.'));
    return result;
  }

  getFieldValues() {
    return readDockFields(this.panelEl);
  }

  setFieldValues(payload = {}, { previewTags = null } = {}) {
    writeDockFields(this.panelEl, payload, {
      previewTags,
      profile: this.getActiveProfile(),
    });
  }

  async hydrateFromStorage() {
    const payload = await readListingDock();
    if (payload) {
      this.setFieldValues(payload);
    } else {
      this.setFieldValues({});
    }
    await this.notifyChange();
    await refreshTagQueueTags();
  }

  async notifyChange() {
    if (this.stripEl) {
      await refreshMerchantPulse(this.stripEl);
    }
    this.onChange?.();
  }

  open() {
    if (!this._mounted) this.mount();
    if (!this.panelEl) return;
    showListingDockPanel(this);
    this.hydratePrefs().catch(() => {});
    this.hydrateFromStorage().catch(() => {});
    const tagsEl = this.panelEl.querySelector('[data-field="dock-tags"]');
    tagsEl?.focus();
  }

  close() {
    if (!this.panelEl) return;
    hideListingDockPanel(this);
    this.closeTagOptions();
  }

  toggle() {
    if (this._open) this.close();
    else this.open();
  }

  focus() {
    this.open();
  }

  async handleSave() {
    const result = await saveListingDock(
      this.getFieldValues(),
      'manual',
      this.getActiveProfile(),
    );
    if (!result.ok) {
      return result;
    }
    this.setFieldValues(result.payload);
    await this.notifyChange();
    await refreshTagQueueTags();
    resetTagQueueIndex();
    return result;
  }

  async handleClipboard() {
    const result = await stageFromClipboard(this.getActiveProfile());
    if (result.ok && result.payload) {
      this.setFieldValues(result.payload);
    }
    await this.notifyChange();
    await refreshTagQueueTags();
    resetTagQueueIndex();
    return result;
  }

  async handleClear() {
    await clearListingDock();
    this.setFieldValues({});
    await this.notifyChange();
    resetTagQueueIndex();
    await refreshTagQueueTags();
    return { ok: true, message: 'Listing dock cleared.' };
  }

  async applyPayload(payload) {
    if (payload) {
      this.setFieldValues(payload);
    }
    await this.notifyChange();
  }
}
