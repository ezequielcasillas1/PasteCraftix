/** Extracted from popup.js setupEventListeners — behavior unchanged. */

export function registerTabNavEvents(app) {
    // Tab navigation
    document.querySelector('.tab-nav').addEventListener('click', async (e) => {
      const target = e.target;
      const tabBtn = (target && target.closest)
        ? target.closest('.tab-btn')
        : (target && target.classList && target.classList.contains('tab-btn') ? target : null);

      if (tabBtn) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        tabBtn.classList.add('active');
        app.currentTab = tabBtn.dataset.tab;
        document.getElementById(app.currentTab + 'Tab').classList.add('active');
        
        // Persist active tab so it survives popup close
        app._saveActiveTabState();
        
        // Format controls, preview, and magic wand are always visible across all tabs
        
        // Auto-reload data when switching tabs to ensure fresh counts
        if (app.currentTab === 'clips') {
          await app.loadData();
          app.renderChips();
          app.updateManualInputCategories();
        } else if (app.currentTab === 'categories') {
          await app.loadData();
          app.renderCategories();
          app.updateCategoryBulkActions();
          app.updateManualInputCategories();
        } else if (app.currentTab === 'search') {
          await app.loadData();
          app.renderSearchResults();
          app.updateSearchBulkActions();
        } else if (app.currentTab === 'ai') {
          app.updateAiCreditsPills('ai-tab');
        } else if (app.currentTab === 'notes') {
          await app.loadNotes();
          app.renderNotes();
        } else if (app.currentTab === 'aiHistory') {
          await app.loadAiHistory();
          app.resetAiHistoryListPagination();
          app.renderAiHistoryList();
        } else if (app.currentTab === 'activity') {
          await app.activityFeature.service.loadActivityLog(app);
          app.activityFeature.render.renderActivityList(app);
        }
      }
    });
}
