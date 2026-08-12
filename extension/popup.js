// PasteCraft Advanced Popup Script
// (startup logging removed)

const PASTECRAFT_LOGS_ENABLED = (() => {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.PASTECRAFT_DEBUG === true) {
      return true;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('pastecraft_debug') === 'true';
    }
  } catch (_) {
    // Ignore storage access errors.
  }
  return false;
})();

if (!PASTECRAFT_LOGS_ENABLED && typeof console !== 'undefined') {
  const pastecraftNoop = () => {};
  console.log = pastecraftNoop;
  console.debug = pastecraftNoop;
  console.info = pastecraftNoop;
}

// PasteCraftCRUD — ESM via popup.boot ensurePasteCraftCrud() → globalThis.PasteCraftCRUD

class PasteCraftPopup {
  constructor() {
    const peel = PasteCraftPopup._appPeel;
    if (!peel?.createPopupInitialState) {
      throw new Error('PasteCraftPopup._appPeel not loaded — bootPopupPage must await peel modules first');
    }
    Object.assign(this, peel.createPopupInitialState());
    this.init();
  }

  _normalizeAiWorkflow(raw) {
    return this.aiLabFeature.credits._normalizeAiWorkflow.call(this, raw);
  }

  async loadAiWorkflow() {
    return this.aiLabFeature.credits.loadAiWorkflow.call(this);
  }

  applyAiWorkflowToUi() {
    return this.aiLabFeature.credits.applyAiWorkflowToUi.call(this);
  }

  async saveAiWorkflowFromUi(silent = true) {
    return this.aiLabFeature.credits.saveAiWorkflowFromUi.call(this, silent);
  }

  // =====================================================
  // LEGACY AUTH PREFS CLEANUP
  // =====================================================

  async clearLegacyAuthPrefs() {
    return this.authFeature.service.clearLegacyAuthPrefs(this);
  }

  _clipIdKey(id) {
    return this.clipsFeature.state.getClipIdKey(id);
  }

  _clipTitle(clip) {
    return this.clipsFeature.state.getClipTitle(clip);
  }

  _clipFallbackTitle(clip, maxLength = 42) {
    return this.clipsFeature.state.getClipFallbackTitle(clip, maxLength);
  }

  _clipAttachment(clip, addedDate = Date.now()) {
    return this.clipsFeature.state.getClipAttachment(clip, addedDate);
  }

  emitAiTaskOutput(rawArtifact) {
    return PasteCraftPopup._appPeel.emitAiTaskOutput(this, rawArtifact);
  }

  setAiTaskOutputArtifact(rawArtifact) {
    return PasteCraftPopup._appPeel.setAiTaskOutputArtifact(this, rawArtifact);
  }

  getAiTaskOutputArtifact() {
    return PasteCraftPopup._appPeel.getAiTaskOutputArtifact(this);
  }

  consumeAiTaskOutputArtifact() {
    return PasteCraftPopup._appPeel.consumeAiTaskOutputArtifact(this);
  }

  clearAiTaskOutputArtifact() {
    return PasteCraftPopup._appPeel.clearAiTaskOutputArtifact(this);
  }

  _categoryIdKey(category) {
    return this.categoriesFeature.state.getCategoryIdKey(category);
  }

  _queueClipOp(fn) {
    return this.clipsFeature.state.queueClipOp(this, fn);
  }

  getSelectedClipIdsInUiOrder() {
    return this.clipsFeature.state.getSelectedClipIdsInUiOrder(this);
  }

  async deleteClipsByIdKeys(idKeys, {
    includeArchived = true,
    reason = 'delete:unknown',
    closeCategoryModal = false,
    clearSelection = true,
    rerender = true
  } = {}) {
    return this.clipsFeature.service.deleteClipsByIdKeys(this, idKeys, {
      includeArchived,
      reason,
      closeCategoryModal,
      clearSelection,
      rerender
    });
  }
  
  async init() {
    return PasteCraftPopup._appPeel.runPopupInitWithGuard(this, () => this._initImpl());
  }

  _showOfflineModeBanner() {
    return PasteCraftPopup._appPeel.showOfflineModeBanner();
  }

  _clearOfflineModeBanner() {
    return PasteCraftPopup._appPeel.clearOfflineModeBanner();
  }

  async _initImpl() {
    if (!this._aiOutputBridge) {
      this._aiOutputBridge = await import('./popup/shared/ai-output-bridge.js');
    }
    const { runPopupInit } = await import('./popup/features/app/popup.init.js');
    return runPopupInit(this);
  }


  _formatShortDate(isoOrDate) {
    return PasteCraftPopup._appPeel.formatShortDate(isoOrDate);
  }

  _computeAiImageCreditsView(subscription) {
    return this.aiLabFeature.credits._computeAiImageCreditsView.call(this, subscription);
  }

  _computeAiTextCreditsView(subscription) {
    return this.aiLabFeature.credits._computeAiTextCreditsView.call(this, subscription);
  }

  /** Update the label text of a credit pill without destroying child elements (tooltips). */
  _setPillLabel(el, text) {
    return this.aiLabFeature.credits._setPillLabel.call(this, el, text);
  }

  /** Build provider-aware cost breakdown HTML for the text-credits tooltip. */
  _buildCreditCostHtml() {
    return this.aiLabFeature.credits._buildCreditCostHtml.call(this);
  }

  updateAiCreditsPills(source = '') {
    return this.aiLabFeature.credits.updateAiCreditsPills.call(this, source);
  }

  // Back-compat: older callsites.
  updateAiCreditsPill(source = '') {
    return this.aiLabFeature.credits.updateAiCreditsPill.call(this, source);
  }

  _hasTextCreditsForRefactor() {
    return this.aiLabFeature.credits.hasTextCreditsForRefactor(this.userSubscription);
  }

  setupLocalStorageListener() {
    return this.authFeature.session.setupLocalStorageListener(this);
  }

  async _ensureIndexedDbReadyAndMigrate() {
    return this.syncFeature?.storage?.ensureIndexedDbReadyAndMigrate?.(this);
  }

  async _mirrorChangedLocalStateToIndexedDb(changes) {
    return this.syncFeature?.storage?.mirrorChangedLocalStateToIndexedDb?.(this, changes);
  }

  // =====================================================
  // RESTORE POINTS (Local daily snapshots)
  // =====================================================

  async maybeCreateDailyRestorePoint(reason = 'daily', localOverride = null) {
    return this.settingsFeature?.restore?.maybeCreateDailyRestorePoint?.(reason, localOverride);
  }

  async createManualRestorePoint(reason = 'manual') {
    return this.settingsFeature?.restore?.createManualRestorePoint?.(reason);
  }

  async previewRestore(windowKey) {
    return this.settingsFeature?.restore?.previewRestore?.(windowKey);
  }

  async applyRestoreFromPreview() {
    return this.settingsFeature?.restore?.applyRestoreFromPreview?.();
  }

  async syncRestoredDataToCloud() {
    return this.settingsFeature?.restore?.syncRestoredDataToCloud?.();
  }

  repairLocalClipIds(clipsRaw, searchOnlyRaw) {
    return this.syncFeature?.repair?.repairLocalClipIds?.(clipsRaw, searchOnlyRaw);
  }

  async performBackgroundSync(options) {
    return this.syncFeature?.listener?.performBackgroundSync?.(this, options);
  }
  
  hideLoadingOverlay() {
    return PasteCraftPopupUi.hideLoadingOverlay();
  }

  // -- Upgrade UI (Freemium ? Basic/Enhanced) --------------------------
  _isFreemiumUser() {
    return this.billingFeature?.upgradeUi?.isFreemiumUser?.(this) ?? true;
  }

  updateUpgradeUI() {
    return this.billingFeature?.upgradeUi?.updateUpgradeUI?.(this);
  }

  openUpgradeModal() {
    return this.billingFeature?.service?.openUpgradeModal?.(this);
  }

  closeUpgradeModal() {
    return this.billingFeature?.service?.closeUpgradeModal?.(this);
  }

  _openPricingPage() {
    return this.billingFeature?.service?.openPricingPage?.();
  }

  async _createCheckout(priceId) {
    return this.billingFeature?.service?.createCheckout?.(this, priceId);
  }

  setupVisibilityListener() {
    return this.syncFeature?.visibility?.setupVisibilityListener?.(this);
  }
  
  setupSyncStatusListeners() {
    return this.syncFeature?.listener?.setupSyncStatusListeners?.(this);
  }

  _clearSyncAutoRefresh() {
    return this.syncFeature?.listener?.clearSyncAutoRefresh?.(this);
  }

  _isSyncProgressVisible() {
    return this.syncFeature?.listener?.isSyncProgressVisible?.() ?? false;
  }

  _scheduleSyncAutoRefreshTick() {
    return this.syncFeature?.listener?.scheduleSyncAutoRefreshTick?.(this);
  }

  async _runSyncAutoRefreshTick() {
    return this.syncFeature?.listener?.runSyncAutoRefreshTick?.(this);
  }
  
  setupRealtimeListeners() {
    return this.syncFeature?.listener?.setupRealtimeListeners?.(this);
  }
  
  updateSyncIndicator(status, queueLength = 0) {
    return this.syncFeature?.listener?.updateSyncIndicator?.(this, status, queueLength);
  }
  
  updateSyncProgress(current, total, percentage) {
    return this.syncFeature?.listener?.updateSyncProgress?.(this, current, total, percentage);
  }

  async loadData() {
    this._debugLoadDataCalls = (this._debugLoadDataCalls || 0) + 1;
    const callNo = this._debugLoadDataCalls;
    const startedAt = Date.now();
    const result = await this.syncFeature?.loader?.loadData?.(this);
    const elapsedMs = Date.now() - startedAt;
    return result;
  }

  /**
   * Initialize tiered storage and get remote counts for lazy loading
   * @private
   */
  async _initializeTieredStorage() {
    return this.syncFeature?.storage?.initializeTieredStorage?.(this);
  }
  
  async enforceClipLimit() {
    return this.clipsFeature.service.enforceClipLimit(this);
  }
  
  async setupEventListeners() {
    const { registerPopupEventListeners } = await import('./popup/popup.events.js');
    registerPopupEventListeners(this);
  }
  
  // =====================================================
  // AUTHENTICATION METHODS
  // =====================================================
  
  async checkOAuthCallback() {
    return this.authFeature.callbacks.checkOAuthCallback();
  }

  async checkPasswordResetCallback() {
    return this.authFeature.callbacks.checkPasswordResetCallback();
  }

  async setPasswordResetSession(accessToken, refreshToken) {
    return this.authFeature.callbacks.setPasswordResetSession(accessToken, refreshToken);
  }
  
  showAuthModal() {
    return this.authFeature.events.showAuthModal(this);
  }

  hideAuthModal() {
    return this.authFeature.events.hideAuthModal(this);
  }

  async _getSessionBridgePayload() {
    return this.authFeature.service._getSessionBridgePayload(this);
  }

  async _refreshSupabaseTokenViaBackground(refreshToken) {
    return this.authFeature.service._refreshSupabaseTokenViaBackground(this, refreshToken);
  }

  async restoreSupabaseSessionFromBridge(reason = 'unknown') {
    return this.authFeature.service.restoreSupabaseSessionFromBridge(this, reason);
  }

  
  setupAuthModalEvents() {
    return this.authFeature.events.setupAuthModalEvents(this);
  }

  _setupSupportFormEvents() {
    return this.billingFeature?.support?.initSupportEvents?.(this);
  }

  _openSupportFormSafely(type) {
    return this.billingFeature?.support?.openSupportFormSafely?.(this, type);
  }

  _wireSupportOpenButtons() {
    return this.billingFeature?.support?.initSupportEvents?.(this);
  }

  _isSupportModalBackdrop(e) {
    return !!(e && e.target && e.target.id === 'supportFormModal');
  }

  _wireSupportFormControls() {
    /* now part of initSupportEvents � no-op stub */
  }

  openSupportForm(type) {
    return this.billingFeature?.support?.openSupportForm?.(this, type);
  }

  closeSupportForm() {
    return this.billingFeature?.support?.closeSupportForm?.();
  }

  async submitSupportForm() {
    return this.billingFeature?.support?.submitSupportForm?.(this);
  }

  
  renderChips() {
    return this.clipsFeature.render.renderChips(this);
  }

  /**
   * Lazy load a page of clips from Supabase
   * @private
   */
  async _lazyLoadClipsPage(startIndex, pageSize, container) {
    return this.clipsFeature.render.lazyLoadClipsPage(this, startIndex, pageSize, container);
  }
  
  renderPagination() {
    return this.clipsFeature.render.renderPagination(this);
  }
  
  createChip(clip, index) {
    return this.clipsFeature.render.createChip(this, clip, index);
  }
  
  toggleChip(clipIdKey, chipElement) {
    return this.clipsFeature.state.toggleChip(this, clipIdKey, chipElement);
  }
  
  toggleSearchClip(clipId, itemElement) {
    return this.clipsFeature.state.toggleSearchClip(this, clipId, itemElement);
  }
  
  toggleCategoryClip(clipId, itemElement) {
    return this.clipsFeature.state.toggleCategoryClip(this, clipId, itemElement);
  }
  
  syncOptionToggles() {
    return this.clipsFeature.preview.syncOptionToggles(this);
  }
  
  async removeChip(clipIdKey) {
    return this.clipsFeature.service.removeChip(this, clipIdKey);
  }
  
  updateLastCapture() {
    return this.clipsFeature.render.updateLastCapture(this);
  }

  updateHeaderClipCount() {
    return this.clipsFeature.render.updateHeaderClipCount(this);
  }
  
  getTimeAgo(timestamp) {
    return this.clipsFeature.render.getTimeAgo(timestamp);
  }
  
  updatePreview() {
    return this.clipsFeature.preview.updatePreview(this);
  }

  updateDelimiterExample() {
    return this.clipsFeature.preview.updateDelimiterExample(this);
  }
  
  // Fallback clipboard method for extension popups (Clipboard API blocked by permissions policy)
  async copyToClipboardFallback(text) {
    return this.clipsFeature.service.copyToClipboardFallback(text);
  }
  
  async copyToClipboard() {
    return this.clipsFeature.service.copyToClipboard(this);
  }
  
  async handleQuickCopy() {
    return this.clipsFeature.service.handleQuickCopy(this);
  }

  async handleQuickDelete() {
    return this.clipsFeature.service.handleQuickDelete(this);
  }
  
  updateQuickCopyButton() {
    return this.clipsFeature.render.updateQuickCopyButton(this);
  }

  getSelectedOrCurrentText(clipText, context) {
    return this.clipsFeature.state.getSelectedOrCurrentText(this, clipText, context);
  }

  clearAllSelections() {
    return this.clipsFeature.state.clearAllSelections(this);
  }

  showSummaryModal(text, opts) {
    return this.aiLabFeature.summaryModal.showSummaryModal(this, text, opts);
  }

  _getSelectedClipsText() {
    return this.clipsFeature.state.getSelectedClipsText(this);
  }

  _getSelectedClipIdKeys() {
    return this.clipsFeature.state.getSelectedClipIdKeys(this);
  }

  _getSelectedClipObjects() {
    return this.clipsFeature.state.getSelectedClipObjects(this);
  }

  _getSelectedCategoryClipIdKeys() {
    return this.clipsFeature.state.getSelectedCategoryClipIdKeys(this);
  }

  _getSelectedCategoryClipObjects() {
    return this.clipsFeature.state.getSelectedCategoryClipObjects(this);
  }

  _getSelectedCategoryClipsText() {
    return this.clipsFeature.state.getSelectedCategoryClipsText(this);
  }

  _wireBulkAiButtons(config) {
    return this.aiLabFeature?.bulk?.wireBulkAiButtons?.(this, config);
  }
  
  // --- Magic Button: Content Type Detection ---
  _detectContentType(text, meta) {
    return this.aiLabFeature.magic._detectContentType.call(this, text, meta);
  }

  // --- Magic Button: Category Suggestion ---
  _suggestCategory(contentType) {
    return this.aiLabFeature.magic._suggestCategory.call(this, contentType);
  }

  // --- Magic Button: Content Enhancement ---
  _enhanceContent(text, contentType) {
    return this.aiLabFeature.magic._enhanceContent.call(this, text, contentType);
  }

  // --- Magic Button: Type Labels (shared) ---
  _magicTypeLabels() {
    return this.aiLabFeature.magic._magicTypeLabels.call(this);
  }

  // --- Magic Button: Analyze All Clips ---
  _analyzeMagicClips() {
    return this.aiLabFeature.magic._analyzeMagicClips.call(this);
  }

  // --- Magic Button: Open Preview Modal ---
  magicFormat() {
    return this.aiLabFeature.magic.magicFormat.call(this);
  }

  // --- Magic Button: Render a Page of Clips in Modal ---
  _renderMagicPage(page) {
    return this.aiLabFeature.magic._renderMagicPage.call(this, page);
  }

  // --- Magic Button: Escape HTML helper ---
  _escHtml(str) {
    return this.aiLabFeature.magic._escHtml.call(this, str);
  }

  // --- Magic Button: Pagination Controls ---
  _renderMagicPagination() {
    return this.aiLabFeature.magic._renderMagicPagination.call(this);
  }

  // --- Magic Button: Update Selected Count ---
  _updateMagicSelectedCount() {
    return this.aiLabFeature.magic._updateMagicSelectedCount.call(this);
  }

  // --- Magic Button: Check if user has AI (premium) access ---
  _hasAiAccess() {
    return PasteCraftPopup._appPeel.hasAiAccess(this.userSubscription);
  }

  // --- Magic Button: Content types that should skip AI formatting ---
  _skipAiFormatTypes() {
    return this.aiLabFeature.magic._skipAiFormatTypes.call(this);
  }

  // --- Magic Button: Apply Magic to Specific Clips ---
  async _craftMagic(clipIds) {
    return this.aiLabFeature.magic._craftMagic.call(this, clipIds);
  }

  activateRefactorizationSection() {
    return this.aiLabFeature.refactorization.activateRefactorizationSection(this);
  }

  renderRefactorizationPanel() {
    return this.aiLabFeature.refactorization.renderRefactorizationPanel.call(this);
  }

  maybeRefreshRefactorizationPanel() {
    return this.aiLabFeature.refactorization.maybeRefreshRefactorizationPanel(this);
  }

  // --- Magic Button: Craft All ---
  async _craftAllMagic() {
    return this.aiLabFeature.magic._craftAllMagic.call(this);
  }

  // --- Magic Button: Show Results Modal ---
  _showMagicResults(stats) {
    return this.aiLabFeature.magic._showMagicResults.call(this, stats);
  }

  async _finishCraftFlow(stats) {
    return this.aiLabFeature.magic._finishCraftFlow.call(this, stats);
  }

  async _applyCraftCategoryPick(categoryName, clipIds) {
    return this.aiLabFeature.magic._applyCraftCategoryPick.call(this, categoryName, clipIds);
  }

  
  showConfetti() {
    return PasteCraftPopupUi.showConfetti();
  }

  // Search and Filter Functions
  renderSearchResults() {
    return this.clipsFeature.render.renderSearchResults(this);
  }

  // Backwards-compat: older code paths still call this name
  performSearch() {
    return this.renderSearchResults();
  }

  filterClips() {
    return this.clipsFeature.render.filterClips(this);
  }

  createSearchResultItem(clip) {
    return this.clipsFeature.render.createSearchResultItem(this, clip);
  }

  // Category Management Functions
  renderCategories() {
    return this.categoriesFeature.render.renderCategories(this);
  }

  createCategoryItem(category) {
    return this.categoriesFeature.render.createCategoryItem(this, category);
  }

  showCreateCategoryDialog() {
    return this.categoriesFeature.render.showCreateCategoryDialog(this);
  }

  setActionButtonLoading(buttonId, isLoading, loadingText = 'Loading...') {
    return PasteCraftPopupUi.setActionButtonLoading(this, buttonId, isLoading, loadingText);
  }

  async createCategory(name, icon, options = {}) {
    return this.categoriesFeature.service.createCategory(this, name, icon, options);
  }

  async editCategory(category) {
    return this.categoriesFeature.service.editCategory(this, category);
  }

  async deleteCategory(category) {
    return this.categoriesFeature.service.deleteCategory(this, category);
  }

  updateCategoryFilter() {
    return this.categoriesFeature.render.updateCategoryFilter(this);
  }

  updateManualInputCategories() {
    return this.categoriesFeature.render.updateManualInputCategories(this);
  }

  // -- PDF Extraction ----------------------------------------------
  initPdfExtraction() {
    return this.clipsFeature?.pdf?.initPdfExtraction?.(this);
  }

  async openPdfExtractModal(file) {
    return this.clipsFeature?.pdf?.openPdfExtractModal?.(this, file);
  }

  async extractPdfText(arrayBuffer) {
    return this.clipsFeature?.pdf?.extractPdfText?.(arrayBuffer);
  }

  buildPdfPageTabs(pages) {
    return this.clipsFeature?.pdf?.buildPdfPageTabs?.(this, pages);
  }

  switchPdfTab(pageIndex) {
    return this.clipsFeature?.pdf?.switchPdfTab?.(this, pageIndex);
  }

  populatePdfCategoryDropdown() {
    return this.clipsFeature?.pdf?.populatePdfCategoryDropdown?.(this);
  }

  async savePdfClips() {
    return this.clipsFeature?.pdf?.savePdfClips?.(this);
  }

  closePdfModal() {
    return this.clipsFeature?.pdf?.closePdfModal?.(this);
  }

  escapeHtml(text) {
    return PasteCraftPopupUi.escapeHtml(text);
  }

  async copyClipToClipboard(textOrClip, options) {
    return this.clipsFeature.service.copyClipToClipboard(this, textOrClip, options);
  }

  openClipViewer(clip, sourceContext) {
    return this.clipsFeature?.viewer?.open?.(this, clip, sourceContext);
  }

  hideClipViewerModal() {
    return this.clipsFeature?.viewer?.hide?.(this);
  }

  async copyClipViewerText() {
    return this.clipsFeature?.viewer?.copyText?.(this);
  }

  enterClipViewerEditMode() {
    return this.clipsFeature?.viewer?.enterEditMode?.(this);
  }

  saveClipViewerEdit() {
    return this.clipsFeature?.viewer?.saveEdit?.(this);
  }

  cancelClipViewerEdit() {
    return this.clipsFeature?.viewer?.cancelEdit?.(this);
  }

  runClipViewerAiSummary() {
    return this.clipsFeature?.viewer?.runAiSummary?.(this);
  }

  runClipViewerAiBreakdown() {
    return this.clipsFeature?.viewer?.runAiBreakdown?.(this);
  }

  openClipViewerGoogleSearchMenu() {
    return this.clipsFeature?.viewer?.openGoogleSearchActions?.(this);
  }

  showCustomSearchModule(clip, context = 'clips') {
    return this.clipsFeature?.customSearch?.showModule?.(this, { clip, context });
  }

  hideCustomSearchModule() {
    return this.clipsFeature?.customSearch?.hideModule?.(this);
  }

  runClipViewerAiRefactorization() {
    return this.clipsFeature?.viewer?.runAiRefactorization?.(this);
  }

  runClipViewerAiCraftClips() {
    return this.clipsFeature?.viewer?.runAiCraftClips?.(this);
  }

  runClipViewerSendToCategories() {
    return this.clipsFeature?.viewer?.runSendToCategories?.(this);
  }

  runClipViewerSendToNotes() {
    return this.clipsFeature?.viewer?.runSendToNotes?.(this);
  }

  async showShareMenuForClip(clip) {
    return this.clipsFeature?.share?.showShareMenuForClip?.(this, clip);
  }

  showToast(message, type) {
    return PasteCraftPopupUi.showToast(this, message, type);
  }

  // Category Modal Functions
  showCategoryModal(isReassignment = false) {
    return this.categoriesFeature.events.showCategoryModal(this, isReassignment);
  }

  hideCategoryModal() {
    return this.categoriesFeature.events.hideCategoryModal(this);
  }

  // Breakdown Modal Functions
  showBreakdownModal(text) {
    return this.aiLabFeature.breakdown.showBreakdownModal(this, text);
  }

  showBreakdownModalWithLevel(text, level) {
    return this.aiLabFeature.breakdown.showBreakdownModalWithLevel(this, text, level);
  }

  hideBreakdownModal() {
    return this.aiLabFeature.breakdown.hideBreakdownModal(this);
  }

  setBreakdownSourcePanel(options = {}) {
    return this.aiLabFeature.breakdown.setBreakdownSourcePanel(options);
  }

  setBreakdownOriginalText(text, options = {}) {
    return this.aiLabFeature.breakdown.setBreakdownOriginalText(text, options);
  }

  toggleBreakdownSourcePanel(forceCollapsed = null) {
    return this.aiLabFeature.breakdown.toggleBreakdownSourcePanel(forceCollapsed);
  }

  toggleBreakdownItalics() {
    return this.aiLabFeature.breakdown.toggleBreakdownItalics();
  }

  updateLevelInfo(level) {
    return this.aiLabFeature.breakdown.updateLevelInfo(level);
  }

  async generateBreakdown(level) {
    return this.aiLabFeature.breakdown.generateBreakdown.call(this, level);
  }

  copyBreakdownText() {
    return this.aiLabFeature.breakdown.copyBreakdownText(this);
  }

  startInlineBreakdown(text, level) {
    return this.aiLabFeature.breakdown.startInlineBreakdown(this, text, level);
  }

  async generateBreakdownInline(level) {
    return this.aiLabFeature.summary.generateBreakdownInline.call(this, level);
  }

  async sendInlineBreakdownFollowup(question) {
    return this.aiLabFeature.summary.sendInlineBreakdownFollowup.call(this, question);
  }

  renderInlineBreakdownPagination() {
    return this.aiLabFeature.summary.renderInlineBreakdownPagination.call(this);
  }

  showSummarySection(section) {
    return this.aiLabFeature.summary.showSummarySection.call(this, section);
  }

  async generateSummaryQuestions(text) {
    return this.aiLabFeature.summary.generateSummaryQuestions.call(this, text);
  }

  async generateSummary(text, question) {
    return this.aiLabFeature.summary.generateSummary.call(this, text, question);
  }

  _formatAiOutput(raw) {
    return this.aiLabFeature.summary._formatAiOutput.call(this, raw);
  }

  async _renderAiResponse(rawText) {
    return this.aiLabFeature.summary._renderAiResponse.call(this, rawText);
  }

  async handleSummaryFollowup(followupQuestion) {
    return this.aiLabFeature.summary.handleSummaryFollowup(this, followupQuestion);
  }

  async handleBreakdownFollowup(followupQuestion) {
    return this.aiLabFeature.summary.handleBreakdownFollowup.call(this, followupQuestion);
  }

  toggleFollowupLevelTabs(enable) {
    return this.aiLabFeature.breakdown.toggleFollowupLevelTabs(enable);
  }

  renderThreadPagination(type) {
    return this.aiLabFeature.breakdown.renderThreadPagination.call(this, type);
  }

  generateThreadTooltip(thread, number) {
    return this.aiLabFeature.breakdown.generateThreadTooltip(thread, number);
  }

  async navigateToThread(type, index) {
    return this.aiLabFeature.breakdown.navigateToThread.call(this, type, index);
  }

  populateCategoryOptions() {
    return this.categoriesFeature.render.populateCategoryOptions(this);
  }

  async handleClipDelete() {
    return this.categoriesFeature.service.handleClipDelete(this);
  }

  async saveTextWithCategory() {
    return this.categoriesFeature.service.saveTextWithCategory(this);
  }

  showCreateCategoryFromModal() {
    return this.categoriesFeature.service.showCreateCategoryFromModal(this);
  }

  // Settings Management Functions � delegated to settingsFeature
  async loadSettings() {
    this._debugLoadSettingsCalls = (this._debugLoadSettingsCalls || 0) + 1;
    return this.settingsFeature.storage.loadSettings();
  }

  async saveSettings(silent = false, skipAuthPrefs = false) {
    return this.settingsFeature.storage.saveSettings(silent, skipAuthPrefs);
  }

  async saveQuickPasteSettingsPatch(patch, silent = true, skipAuthPrefs = true) {
    return this.settingsFeature.storage.saveQuickPasteSettingsPatch(patch, silent, skipAuthPrefs);
  }

  syncThemeToggles() {
    return this.settingsFeature.storage.syncThemeToggles();
  }

  async saveThemeOnly(nextTheme, silent = false) {
    return this.settingsFeature.storage.saveThemeOnly(nextTheme, silent);
  }

  async getCurrentProfileImageForWidget() {
    return this.settingsFeature.storage.getCurrentProfileImageForWidget();
  }

  async saveWidgetIconUseProfileImage(enabled, silent = false) {
    return this.settingsFeature.storage.saveWidgetIconUseProfileImage(enabled, silent);
  }

  async exportBackupToJson() {
    return this.settingsFeature.backup.exportBackupToJson();
  }

  async exportClipsToCsv() {
    return this.settingsFeature.backup.exportClipsToCsv();
  }

  async importBackupFromJsonMerge(file) {
    return this.settingsFeature.backup.importBackupFromJsonMerge(file);
  }

  async showSettingsModal() {
    return this.settingsFeature.render.showSettingsModal();
  }

  hideSettingsModal() {
    return this.settingsFeature.render.hideSettingsModal(this);
  }

  showHelpModal() {
    return this.settingsFeature.render.showHelpModal();
  }

  hideHelpModal() {
    return this.settingsFeature.render.hideHelpModal();
  }

  updateStorageStats() {
    return this.settingsFeature.render.updateStorageStats();
  }

  async cleanupOldClips() {
    return this.settingsFeature.storage.cleanupOldClips();
  }

  getCutoffTime(period) {
    return this.settingsFeature.storage.getCutoffTime(period);
  }

  // Category Dropdown Functions
  createCategoryClipsHTML(clips, categoryId) {
    return this.clipsFeature.render.createCategoryClipsHTML(this, clips, categoryId);
  }

  createCategoryClipRowHTML(clip) {
    return this.clipsFeature.render.createCategoryClipRowHTML(this, clip);
  }

  createCategorySeparator(category, options = {}) {
    return this.categoriesFeature.separators.service.createCategorySeparator(this, category, options);
  }

  renameCategorySeparator(category, separatorId) {
    return this.categoriesFeature.separators.service.renameCategorySeparator(this, category, separatorId);
  }

  moveCategorySeparator(category, separatorId, afterClipId) {
    return this.categoriesFeature.separators.service.moveCategorySeparator(
      this,
      category,
      separatorId,
      afterClipId,
    );
  }

  deleteCategorySeparator(category, separatorId) {
    return this.categoriesFeature.separators.service.deleteCategorySeparator(this, category, separatorId);
  }

  focusCategorySeparatorSection(category, separatorId) {
    return this.categoriesFeature.separators.section.toggleSeparatorSection(
      this,
      category,
      separatorId,
    );
  }

  toggleCategoryDropdown(categoryItem, category) {
    return this.categoriesFeature.render.toggleCategoryDropdown(this, categoryItem, category);
  }

  /**
   * Category-page clip handlers are wired via a single delegated click listener
   * on `#categoriesList` (see `setupCategoryClipDelegation`). This method is
   * kept as a no-op stub so existing callers (`toggleCategoryDropdown`) stay
   * safe � delegation survives every `renderCategories()` re-render, unlike
   * the previous per-button listeners which detached whenever the list was
   * re-rendered while a dropdown was open.
   */
  attachClipHandlers(_dropdown, _category) {
    // Intentionally empty. Delegated handler on #categoriesList owns all
    // clicks for .category-clip rows and .category-clip-*-btn buttons.
  }

  /**
   * Mirrors the clips-page pattern (see `createChip`): one click handler on
   * the stable parent container resolves the action button via
   * `e.target.closest('.category-clip-*-btn')` at click time, so it keeps
   * working even when `renderCategories()` wipes and rebuilds the DOM while
   * a dropdown is open.
   *
   * Idempotent: guarded by `_categoryClipDelegationAttached` so repeat calls
   * from `setupEventListeners()` don't stack listeners.
   */
  setupCategoryClipDelegation() {
    return this.clipsFeature.events.setupCategoryClipDelegation(this);
  }

  _findClipLocationById(clipId) {
    return this.clipsFeature?.title?.findClipLocationById?.(this, clipId) ?? null;
  }

  promptEditClipTitle(clipId) {
    return this.clipsFeature?.title?.promptEditClipTitle?.(this, clipId);
  }

  async updateClipTitleById(clipId, title) {
    return this.clipsFeature?.title?.updateClipTitleById?.(this, clipId, title);
  }

  _updateNoteClipTitlesById(clipId, title, updatedAt) {
    return this.clipsFeature?.title?.updateNoteClipTitlesById?.(this, clipId, title, updatedAt) ?? [];
  }

  updatePreviewFromSelection() {
    return this.clipsFeature.state.updatePreviewFromSelection(this);
  }

  getSelectedCategoryClipIdsInUiOrder() {
    return this.clipsFeature.state.getSelectedCategoryClipIdsInUiOrder(this);
  }

  updateCategoryBulkActions() {
    return this.clipsFeature.render.updateCategoryBulkActions(this);
  }

  async handleCategoryBulkCopy() {
    return this.clipsFeature.service.handleCategoryBulkCopy(this);
  }

  async handleCategoryBulkDelete() {
    return this.clipsFeature.service.handleCategoryBulkDelete(this);
  }

  getSelectedSearchClipIdsInUiOrder() {
    return this.clipsFeature.state.getSelectedSearchClipIdsInUiOrder(this);
  }

  updatePreviewFromSearchSelection() {
    return this.clipsFeature.state.updatePreviewFromSearchSelection(this);
  }

  updateSearchBulkActions() {
    return this.clipsFeature.render.updateSearchBulkActions(this);
  }

  async handleSearchBulkCopy() {
    return this.clipsFeature.service.handleSearchBulkCopy(this);
  }

  // Profile Management Functions
  async loadUserProfile() {
    this._debugLoadUserProfileCalls = (this._debugLoadUserProfileCalls || 0) + 1;
    return this.profileFeature.storage.loadUserProfile(this);
  }

  updateTopBarIdentity(imageUrlOverride = undefined) {
    return this.profileFeature?.render?.updateTopBarIdentity?.(this, imageUrlOverride);
  }

  async saveUserProfile() { return this.profileFeature.storage.saveUserProfile(this); }

  showProfileModal() {
    return this.profileFeature?.render?.showProfileModal?.(this);
  }
  
  updateAIGenerateButtonState() {
    return this.profileFeature?.render?.updateAIGenerateButtonState?.(this);
  }

  hideProfileModal() {
    return this.profileFeature?.render?.hideProfileModal?.();
  }

  setupProfileModalEvents() {
    return this.profileFeature?.events?.setupProfileModalEvents?.(this);
  }

  applyAuthPrefsToUi() {
    return this.profileFeature?.accountInfo?.applyAuthPrefsToUi?.(this);
  }

  openPasswordResetFromProfile() {
    return this.profileFeature?.accountInfo?.openPasswordResetFromProfile?.(this);
  }
  
  toggleSection(contentId, toggleBtnId) {
    return this.profileFeature?.render?.toggleSection?.(contentId, toggleBtnId);
  }

  async handleProfileImageUpload(file) {
    return this.profileFeature?.events?.handleProfileImageUpload?.(this, file);
  }

  async generateAnimalAvatar() {
    return this.profileFeature?.generators?.generateAnimalAvatar?.(this);
  }
  
  async generateMyCartoon() {
    return this.profileFeature?.generators?.generateMyCartoon?.(this);
  }

  async generateAIName() {
    return this.profileFeature?.generators?.generateAIName?.(this);
  }

  showUnsubscribeConfirmation() {
    return this.billingFeature.unsubscribe.showUnsubscribeConfirmation(this);
  }

  async handleUnsubscribe() {
    return this.billingFeature.unsubscribe.handleUnsubscribe(this);
  }

  // Display image and funky name in top bar
  displayImageTopLeft(imageUrl) {
    return this.profileFeature?.render?.displayImageTopLeft?.(this, imageUrl);
  }

  // Auto-collapse profile name section after generation
  autoCollapseNameSection() {
    return this.profileFeature?.render?.autoCollapseNameSection?.();
  }

  // Start 10-second countdown with visible timer before collapsing name section
  startNameSectionCollapse() {
    return this.profileFeature?.render?.startNameSectionCollapse?.(this);
  }

  // Auto-collapse profile photo section after generation
  autoCollapsePhotoSection() {
    return this.profileFeature?.render?.autoCollapsePhotoSection?.();
  }

  // Start 10-second countdown with visible timer before collapsing profile image section
  startProfileImageCollapse() {
    return this.profileFeature?.render?.startProfileImageCollapse?.(this);
  }

  setupImageViewer() {
    return this.profileFeature.viewer.setupImageViewer(this);
  }

  showProfileTestimonialShare(avatarUrl) {
    return this.profileFeature?.socialShare?.showProfileTestimonialShare?.(this, avatarUrl);
  }

  updatePasswordStrength(password) {
    return this.authFeature.password.updatePasswordStrength(this, password);
  }

  updateRequirement(elementId, isValid) {
    return this.authFeature.password.updateRequirement(this, elementId, isValid);
  }

  validatePassword(password) {
    return this.authFeature.password.validatePassword(password);
  }

  updateNewPasswordStrength(password) {
    return this.authFeature.password.updateNewPasswordStrength(this, password);
  }

  checkPasswordMatch() {
    return this.authFeature.password.checkPasswordMatch();
  }

  static async handleMessage(message) {
    if (!PasteCraftPopup._messagingModule) {
      PasteCraftPopup._messagingModule = import('./popup/shared/popup-messaging.js');
    }
    const { handlePopupMessage } = await PasteCraftPopup._messagingModule;
    return handlePopupMessage(message);
  }

  async generateAIImageFromProfile() {
    return this.profileFeature.aiImage.generateAIImageFromProfile(this);
  }

  async generateRandomAIImage() {
    return this.profileFeature.aiImage.generateRandomAIImage(this);
  }
  async saveUserName() { return this.profileFeature.storage.saveUserName(this); }
  async saveAiNameToProfile() { return this.profileFeature.storage.saveAiNameToProfile(this); }
  async toggleShowcaseFunkyInHeader() {
    return this.profileFeature?.render?.toggleShowcaseFunkyInHeader?.(this);
  }

  // ==================== SESSION PERSISTENCE ====================

  async _saveActiveTabState() {
    return this.aiLabFeature?.sessionState?.saveActiveTabState?.(this);
  }

  async _getCurrentTabId() {
    return this.aiLabFeature?.sessionState?.getCurrentTabId?.();
  }

  async _saveBreakdownPageState() {
    return this.aiLabFeature?.sessionState?.saveBreakdownPageState?.(this);
  }

  async _saveBreakdownModalState() {
    return this.aiLabFeature?.sessionState?.saveBreakdownModalState?.(this);
  }

  async _saveSummaryState() {
    return this.aiLabFeature?.sessionState?.saveSummaryState?.(this);
  }

  _resetSummaryToEmpty() {
    return this.aiLabFeature?.sessionState?.resetSummaryToEmpty?.(this);
  }

  _resetBreakdownToEmpty() {
    return this.aiLabFeature?.sessionState?.resetBreakdownToEmpty?.(this);
  }

  async _renderOpenRecentConversation() {
    return this.aiLabFeature?.sessionState?.renderOpenRecentConversation?.(this);
  }

  async _renderOpenRecentConversationFallback() {
    return this.aiLabFeature?.sessionState?.renderOpenRecentConversationFallback?.(this);
  }

  /** Restore all persisted UI state on popup open */
  // Race a promise against a timer. Returns `fallback` if the promise throws
  // or exceeds `ms`. Keeps the underlying fetch alive in the background, so
  // the second call (or a visibility refresh) can use the warmed-up result.
  _withTimeout(promise, ms, fallback = undefined, label = '') {
    return PasteCraftAsyncUtils.withTimeout(promise, { ms, fallback, label });
  }

  async _restoreSessionState() {
    return this.authFeature.session._restoreSessionState(this);
  }

  async saveToAnalysisHistory(text, type, level = null, result = null) {
    return this.aiLabFeature.analysisHistory.saveToAnalysisHistory(this, text, type, level, result);
  }

  async loadAnalysisHistory() {
    return this.aiLabFeature.analysisHistory.loadAnalysisHistory(this);
  }

  renderAnalysisHistory() {
    return this.aiLabFeature.analysisHistory.renderAnalysisHistory(this);
  }

  // ==================== AI HISTORY SYSTEM ====================

  /** Load AI history entries from local + cloud (merged). Pass `{ mergeCloud: false }` for local-only. */
  async loadAiHistory(options) {
    return this.aiLabFeature.history.loadAiHistory.call(this, options);
  }

  async _persistAiHistory() {
    return this.aiLabFeature.history._persistAiHistory.call(this);
  }

  async saveAiHistory(type, originalText, threads, options) {
    return this.aiLabFeature.history.saveAiHistory.call(this, type, originalText, threads, options);
  }

  async saveRefactorHistory(records) {
    return this.aiLabFeature.history.saveRefactorHistory.call(this, records);
  }

  async saveFormatHistory(records) {
    return this.aiLabFeature.history.saveFormatHistory.call(this, records);
  }

  async submitRefactorTicket(message) {
    return this.aiLabFeature.history.submitRefactorTicket.call(this, message);
  }

  async _generateAiHistoryTitle(entryId, originalText) {
    return this.aiLabFeature.history._generateAiHistoryTitle.call(this, entryId, originalText);
  }

  renderAiHistoryList() {
    return this.aiLabFeature.history.renderAiHistoryList.call(this);
  }

  resetAiHistoryListPagination() {
    return this.aiLabFeature.history.resetAiHistoryListPagination.call(this);
  }

  setAiHistoryListPage(pageIndex) {
    return this.aiLabFeature.history.setAiHistoryListPage.call(this, pageIndex);
  }

  async openAiHistoryModal(entry) {
    return this.aiLabFeature.history.openAiHistoryModal.call(this, entry);
  }

  _renderHistoryPagination() {
    return this.aiLabFeature.history._renderHistoryPagination.call(this);
  }

  async navigateHistoryThread(index) {
    return this.aiLabFeature.history.navigateHistoryThread.call(this, index);
  }

  copyHistoryContent() {
    return this.aiLabFeature.history.copyHistoryContent.call(this);
  }

  _startEditHistoryTitle() {
    return this.aiLabFeature.history._startEditHistoryTitle.call(this);
  }

  async _saveEditHistoryTitle() {
    return this.aiLabFeature.history._saveEditHistoryTitle.call(this);
  }

  _cancelEditHistoryTitle() {
    return this.aiLabFeature.history._cancelEditHistoryTitle.call(this);
  }

  async continueHistoryConversation() {
    return this.aiLabFeature.history.continueHistoryConversation.call(this);
  }

  /** Delete all AI history entries */
  async clearAllAiHistory() {
    return this.aiLabFeature.history.clearAllAiHistory.call(this);
  }

  async loadNotes() {
    return this.notesFeature.service.loadNotes(this);
  }

  async _initializeTieredNotesStorage() {
    return this.notesFeature.service.initializeTieredNotesStorage(this);
  }

  /**
   * Migrate excess local data to Supabase if storage is near quota
   * Only runs once per installation (tracked by flag)
   * @private
   */
  async _maybeMigrateTieredStorage() {
    return this.syncFeature?.storage?.maybeMigrateTieredStorage?.(this);
  }

  _getNoteContentForHash(note) {
    return this.notesFeature.service.getNoteContentForHash(note);
  }

  async saveNotes() {
    return this.notesFeature.service.saveNotes(this);
  }

  async saveNotesPrefs() {
    return this.notesFeature.service.saveNotesPrefs(this);
  }

  renderNotes() {
    return this.notesFeature.render.renderNotes(this);
  }

  async _lazyLoadNotesPage(startIndex, pageSize, container, paginationEl, pageCount) {
    return this.notesFeature.service.lazyLoadNotesPage(this, { startIndex, pageSize, container, paginationEl, pageCount });
  }

  _renderNoteCard(note) {
    return this.notesFeature.render.renderNoteCard(note, this);
  }

  _attachNoteCardListeners(container) {
    return this.notesFeature.render.attachNoteCardListeners(this, container);
  }

  updateNoteAiControls() {
    return this.notesFeature.render.updateNoteAiControls(this);
  }

  async generateNoteTitleFromContent() {
    return this.notesFeature.editor.generateNoteTitleFromContent(this);
  }

  async generateNoteDescriptionFromContent() {
    return this.notesFeature.editor.generateNoteDescriptionFromContent(this);
  }

  openNoteEditor(type = 'note', noteId = null, showBack = false) {
    return this.notesFeature.editor.openNoteEditor(this, type, noteId, showBack);
  }

  closeNoteEditor() {
    return this.notesFeature.editor.closeNoteEditor(this);
  }

  renderNoteAttachments() {
    return this.notesFeature.render.renderNoteAttachments(this);
  }

  async saveNote() {
    return this.notesFeature.editor.saveNote(this);
  }

  refreshAlbumsForNote(sourceNote) {
    return this.notesFeature.album.refreshAlbumsForNote(this, sourceNote);
  }

  showAlbumPicker() {
    return this.notesFeature.album.showAlbumPicker(this);
  }

  showAlbumPickerForNote(noteId) {
    return this.notesFeature.album.showAlbumPickerForNote(this, noteId);
  }

  closeAlbumPicker() {
    return this.notesFeature.album.closeAlbumPicker(this);
  }

  showBackToAlbumPicker() {
    return this.notesFeature.album.showBackToAlbumPicker(this);
  }

  hideBackToAlbumPicker() {
    return this.notesFeature.album.hideBackToAlbumPicker(this);
  }

  renderAlbumPicker(albums, selectedNoteId) {
    return this.notesFeature.album.renderAlbumPicker(this, albums, selectedNoteId);
  }

  filterAlbumPicker(searchTerm) {
    return this.notesFeature.album.filterAlbumPicker(this, searchTerm);
  }

  async addCurrentClipToNote(noteId) {
    return this.notesFeature.editor.addCurrentClipToNote(this, noteId);
  }

  async saveCurrentAiOutputToNotes() {
    return this.notesFeature.editor.saveCurrentAiOutputToNotes(this);
  }

  async addNoteToAlbum(albumId) {
    return this.notesFeature.album.addNoteToAlbum(this, albumId);
  }

  openNoteViewer(noteId) { return this.notesFeature.album.openNoteViewer(this, noteId); }
  closeNoteViewer() { return this.notesFeature.album.closeNoteViewer(this); }
  getAlbumAttachmentOpenMode() { return this.notesFeature.album.getAlbumAttachmentOpenMode(this); }
  openAlbumAttachment(noteId, attachmentIndex) { return this.notesFeature.album.openAlbumAttachment(this, noteId, attachmentIndex); }
  openAlbumAttachmentInEdgePopup(noteId, attachmentIndex) { return this.notesFeature.album.openAlbumAttachmentInEdgePopup(this, noteId, attachmentIndex); }
  openAlbumAttachmentViewerModal(noteId, attachmentIndex) { return this.notesFeature.albumAttachmentViewer.open(this, noteId, attachmentIndex); }
  openAlbumAttachmentOverlay(note, att) { return this.notesFeature.album.openAlbumAttachmentOverlay(this, note, att); }
  closeAlbumAttachmentViewer() { return this.notesFeature.albumAttachmentViewer.close(this); }
  runAlbumAttachmentAiSummary() { return this.notesFeature.albumAttachmentViewer.runAiSummary(this); }
  runAlbumAttachmentAiBreakdown() { return this.notesFeature.albumAttachmentViewer.runAiBreakdown(this); }
  openAlbumAttachmentGoogleSearchMenu() { return this.notesFeature.albumAttachmentViewer.openGoogleSearchActions(this); }
  runAlbumAttachmentAiRefactorization() { return this.notesFeature.albumAttachmentViewer.runAiRefactorization(this); }
  runAlbumAttachmentAiCraftClips() { return this.notesFeature.albumAttachmentViewer.runAiCraftClips(this); }
  runAlbumAttachmentSendToCategories() { return this.notesFeature.albumAttachmentViewer.runSendToCategories(this); }
  runAlbumAttachmentSendToNotes() { return this.notesFeature.albumAttachmentViewer.runSendToNotes(this); }
  runAlbumAttachmentAnnotate() { return this.notesFeature.albumAttachmentViewer.runAnnotate(this); }
  runAlbumAttachmentAnnotatePopOut() { return this.notesFeature.albumAttachmentViewer.runAnnotatePopOut(this); }
  openAlbumSourceNoteOverlay(sourceNoteId, albumId) { return this.notesFeature.album.openAlbumSourceNoteOverlay(this, sourceNoteId, albumId); }
  closeAlbumSourceNoteOverlay() { return this.notesFeature.album.closeAlbumSourceNoteOverlay(this); }
  copyAllNoteAttachments() { return this.notesFeature.album.copyAllNoteAttachments(this); }

  deleteAlbumInterlaying(albumId, flatIndex, options) {
    return this.notesFeature.albumInterlayings.deleteAlbumInterlaying(this, albumId, flatIndex, options);
  }
  deleteAlbumInterlayingFromViewer(albumId, flatIndex) {
    return this.notesFeature.album.deleteAlbumInterlayingFromViewer(this, albumId, flatIndex);
  }
  editAlbumInterlayingFromViewer(albumId, flatIndex) {
    return this.notesFeature.album.editAlbumInterlayingFromViewer(this, albumId, flatIndex);
  }
  openAlbumInterlayingEditor(albumId, flatIndex) {
    return this.notesFeature.albumInterlayingEditor.openAlbumInterlayingEditor(this, albumId, flatIndex);
  }
  closeAlbumInterlayingEditor() {
    return this.notesFeature.albumInterlayingEditor.closeAlbumInterlayingEditor(this);
  }
  saveAlbumInterlayingEditor() {
    return this.notesFeature.albumInterlayingEditor.saveAlbumInterlayingEditor(this);
  }
  editAlbumSourceNoteFromOverlay() {
    return this.notesFeature.album.editAlbumSourceNoteFromOverlay(this);
  }
  returnToAlbumViewerAfterEditor() {
    return this.notesFeature.album.returnToAlbumViewerAfterEditor(this);
  }

  deleteNote(noteId) { return this.notesFeature.service.deleteNote(this, noteId); }

  showClipPickerForNote() { return this.notesFeature.editor.showClipPickerForNote(this); }
  closeClipPicker() { return this.notesFeature.editor.closeClipPicker(this); }
  updateClipPickerFooter() { return this.notesFeature.editor.updateClipPickerFooter(this); }
  togglePickerClip(clipId, itemElement) { return this.notesFeature.editor.togglePickerClip(this, clipId, itemElement); }
  normalizePickerText(text) { return this.notesFeature.editor.normalizePickerText(text); }
  createPickerSearchRowHTML(clip) { return this.notesFeature.editor.createPickerSearchRowHTML(this, clip); }
  createPickerChipElement(clip) { return this.notesFeature.editor.createPickerChipElement(this, clip); }
  attachPickerSearchRowHandlers(container) { return this.notesFeature.editor.attachPickerSearchRowHandlers(this, container); }
  switchClipPickerTab(tabName) { return this.notesFeature.editor.switchClipPickerTab(this, tabName); }
  renderClipPickerRecentClips() { return this.notesFeature.editor.renderClipPickerRecentClips(this); }
  searchClipsInPicker(query) { return this.notesFeature.editor.searchClipsInPicker(this, query); }
  renderClipPickerSearchResults(results) { return this.notesFeature.editor.renderClipPickerSearchResults(this, results); }
  renderClipPickerCategories() { return this.notesFeature.editor.renderClipPickerCategories(this); }
  addSelectedClipsToNote() { return this.notesFeature.editor.addSelectedClipsToNote(this); }
  populateClipPickerWriteCategories() {
    return this.notesFeature.clipCreate.populateClipPickerWriteCategories(this);
  }
  clearClipPickerWriteForm() {
    return this.notesFeature.clipCreate.clearClipPickerWriteForm(this);
  }
  saveClipPickerWriteClip() {
    return this.notesFeature.clipCreate.saveClipPickerWriteClip(this);
  }
  chooseClipPickerPdf() {
    return this.notesFeature.clipCreate.chooseClipPickerPdf(this);
  }
  handleClipPickerPdfFileChange(e) {
    return this.notesFeature.clipCreate.handleClipPickerPdfFileChange(this, e);
  }
  showImagePickerForNote() { return this.notesFeature.imagePicker.showImagePickerForNote(this); }
  closeImagePicker() { return this.notesFeature.imagePicker.closeImagePicker(this); }
  handleImagePickerClick(e) { return this.notesFeature.imagePicker.handleImagePickerClick(this, e); }
  handleImagePickerFileChange(e) { return this.notesFeature.imagePicker.handleImagePickerFileChange(this, e); }
  addURLToNote() { return this.notesFeature.editor.addURLToNote(this); }
  async exportNoteToPDF(noteId) { return this.notesFeature.editor.exportNoteToPDF(this, noteId); }

  async loadActivityLog() { return this.activityFeature.service.loadActivityLog(this); }
  async fetchActivityPage(append = false) { return this.activityFeature.service.fetchActivityPage(this, append); }
  renderActivityList() { return this.activityFeature.render.renderActivityList(this); }
  getActivityIcon(operation) { return this.activityFeature.render.getActivityIcon(operation); }
  getTableBadge(tableName) { return this.activityFeature.render.getTableBadge(tableName); }
  getActivitySummary(entry) { return this.activityFeature.render.getActivitySummary(entry); }
  formatTimeAgo(date) { return this.activityFeature.render.formatTimeAgo(date); }

}

import('./popup/features/app/popup.boot.js').then(({ bootPopupPage }) => {
  bootPopupPage(PasteCraftPopup);
});
