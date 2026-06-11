/** Extracted from popup.js setupEventListeners — behavior unchanged. */

import { registerCustomSearchModalEvents } from '../features/clips/clips.custom-search.modal.js';

export function registerSharedModalEvents(app) {
    registerCustomSearchModalEvents(app);
    // Breakdown modal events
    document.getElementById('closeBreakdownModal').addEventListener('click', () => {
      app.hideBreakdownModal();
    });

    document.getElementById('closeBreakdownBtn').addEventListener('click', () => {
      app.hideBreakdownModal();
    });

    document.getElementById('copyBreakdownBtn').addEventListener('click', () => {
      app.copyBreakdownText();
    });
    const saveBreakdownToNotesBtn = document.getElementById('saveBreakdownToNotesBtn');
    if (saveBreakdownToNotesBtn) {
      saveBreakdownToNotesBtn.addEventListener('click', async () => {
        await app.saveCurrentAiOutputToNotes();
      });
    }

    // Italics toggle button
    document.getElementById('breakdownItalicsBtn').addEventListener('click', () => {
      app.toggleBreakdownItalics();
    });

    // Breakdown modal overlay click to close
    document.getElementById('breakdownModal').addEventListener('click', (e) => {
      if (e.target.id === 'breakdownModal') {
        app.hideBreakdownModal();
      }
    });

    // AI History modal events
    const closeAiHistoryModal = document.getElementById('closeAiHistoryModal');
    if (closeAiHistoryModal) {
      closeAiHistoryModal.addEventListener('click', () => {
        document.getElementById('aiHistoryModal').style.display = 'none';
      });
    }
    const closeAiHistoryModalBtn = document.getElementById('closeAiHistoryModalBtn');
    if (closeAiHistoryModalBtn) {
      closeAiHistoryModalBtn.addEventListener('click', () => {
        document.getElementById('aiHistoryModal').style.display = 'none';
      });
    }
    const copyAiHistoryBtn = document.getElementById('copyAiHistoryBtn');
    if (copyAiHistoryBtn) {
      copyAiHistoryBtn.addEventListener('click', () => {
        app.copyHistoryContent();
      });
    }
    const saveAiHistoryToNotesBtn = document.getElementById('saveAiHistoryToNotesBtn');
    if (saveAiHistoryToNotesBtn) {
      saveAiHistoryToNotesBtn.addEventListener('click', async () => {
        await app.saveCurrentAiOutputToNotes();
      });
    }
    // Edit title button
    const editAiHistoryTitleBtn = document.getElementById('editAiHistoryTitleBtn');
    if (editAiHistoryTitleBtn) {
      editAiHistoryTitleBtn.addEventListener('click', () => app._startEditHistoryTitle());
    }
    const aiHistoryTitleSaveBtn = document.getElementById('aiHistoryTitleSaveBtn');
    if (aiHistoryTitleSaveBtn) {
      aiHistoryTitleSaveBtn.addEventListener('click', () => app._saveEditHistoryTitle());
    }
    const aiHistoryTitleCancelBtn = document.getElementById('aiHistoryTitleCancelBtn');
    if (aiHistoryTitleCancelBtn) {
      aiHistoryTitleCancelBtn.addEventListener('click', () => app._cancelEditHistoryTitle());
    }
    const aiHistoryTitleInput = document.getElementById('aiHistoryTitleInput');
    if (aiHistoryTitleInput) {
      aiHistoryTitleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') app._saveEditHistoryTitle();
        if (e.key === 'Escape') app._cancelEditHistoryTitle();
      });
    }
    // Continue conversation button
    const continueConversationBtn = document.getElementById('continueConversationBtn');
    if (continueConversationBtn) {
      continueConversationBtn.addEventListener('click', () => app.continueHistoryConversation());
    }
    const aiRefactorReportBtn = document.getElementById('aiRefactorReportBtn');
    const aiRefactorReportForm = document.getElementById('aiRefactorReportForm');
    const aiRefactorReportCancelBtn = document.getElementById('aiRefactorReportCancelBtn');
    if (aiRefactorReportBtn && aiRefactorReportForm) {
      aiRefactorReportBtn.addEventListener('click', () => {
        aiRefactorReportForm.style.display = 'block';
        aiRefactorReportBtn.style.display = 'none';
        document.getElementById('aiRefactorReportInput')?.focus();
      });
    }
    if (aiRefactorReportCancelBtn && aiRefactorReportForm && aiRefactorReportBtn) {
      aiRefactorReportCancelBtn.addEventListener('click', () => {
        aiRefactorReportForm.style.display = 'none';
        aiRefactorReportBtn.style.display = '';
      });
    }
    if (aiRefactorReportForm) {
      aiRefactorReportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('aiRefactorReportInput');
        const ok = await app.submitRefactorTicket(input?.value || '');
        if (ok) {
          aiRefactorReportForm.style.display = 'none';
          if (aiRefactorReportBtn) aiRefactorReportBtn.style.display = 'none';
          if (input) input.value = '';
        }
      });
    }
    const aiHistoryModal = document.getElementById('aiHistoryModal');
    if (aiHistoryModal) {
      aiHistoryModal.addEventListener('click', (e) => {
        if (e.target.id === 'aiHistoryModal') {
          aiHistoryModal.style.display = 'none';
        }
      });
    }
    // Clear all AI history button
    const clearAiHistoryBtn = document.getElementById('clearAiHistoryBtn');
    if (clearAiHistoryBtn) {
      clearAiHistoryBtn.addEventListener('click', () => {
        app.clearAllAiHistory();
      });
    }

    // AI History search bar
    const aiHistorySearchInput = document.getElementById('aiHistorySearchInput');
    const aiHistorySearchClear = document.getElementById('aiHistorySearchClear');
    if (aiHistorySearchInput) {
      aiHistorySearchInput.addEventListener('input', () => {
        app._aiHistorySearchQuery = aiHistorySearchInput.value.trim().toLowerCase();
        app.resetAiHistoryListPagination();
        app.renderAiHistoryList();
      });
    }
    if (aiHistorySearchClear) {
      aiHistorySearchClear.addEventListener('click', () => {
        if (aiHistorySearchInput) aiHistorySearchInput.value = '';
        app._aiHistorySearchQuery = '';
        app.resetAiHistoryListPagination();
        app.renderAiHistoryList();
      });
    }

    // AI History filter chips
    document.querySelectorAll('.ai-history-filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.ai-history-filter-chip').forEach(c => {
          c.classList.remove('active');
          c.style.background = '#f8fafc';
          c.style.color = '#64748b';
          c.style.borderColor = '#e5e7eb';
        });
        chip.classList.add('active');
        chip.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
        chip.style.color = 'white';
        chip.style.borderColor = '#3b82f6';
        app._aiHistoryFilterType = chip.dataset.filter;
        app.resetAiHistoryListPagination();
        app.renderAiHistoryList();
      });
      // Style the initial active chip
      if (chip.classList.contains('active')) {
        chip.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
        chip.style.color = 'white';
        chip.style.borderColor = '#3b82f6';
      }
    });

    const aiHistoryTab = document.getElementById('aiHistoryTab');
    if (aiHistoryTab) {
      aiHistoryTab.addEventListener('click', (e) => {
        const pageBtn = e.target.closest('[data-action="ai-history-page"]');
        if (!pageBtn || pageBtn.disabled) return;
        const page = parseInt(pageBtn.dataset.page, 10);
        if (Number.isNaN(page)) return;
        app.setAiHistoryListPage(page);
      });
    }

    // Clip Viewer modal events
    const closeClipViewerModal = document.getElementById('closeClipViewerModal');
    if (closeClipViewerModal) {
      closeClipViewerModal.addEventListener('click', () => app.hideClipViewerModal());
    }
    const closeClipViewerBtn = document.getElementById('closeClipViewerBtn');
    if (closeClipViewerBtn) {
      closeClipViewerBtn.addEventListener('click', () => app.hideClipViewerModal());
    }
    const copyClipViewerBtn = document.getElementById('copyClipViewerBtn');
    if (copyClipViewerBtn) {
      copyClipViewerBtn.addEventListener('click', () => app.copyClipViewerText());
    }
    const clipViewerAiSummaryBtn = document.getElementById('clipViewerAiSummaryBtn');
    if (clipViewerAiSummaryBtn) {
      clipViewerAiSummaryBtn.addEventListener('click', () => app.runClipViewerAiSummary());
    }
    const clipViewerAiBreakdownBtn = document.getElementById('clipViewerAiBreakdownBtn');
    if (clipViewerAiBreakdownBtn) {
      clipViewerAiBreakdownBtn.addEventListener('click', () => app.runClipViewerAiBreakdown());
    }
    const clipViewerGoogleSearchBtn = document.getElementById('clipViewerGoogleSearchBtn');
    if (clipViewerGoogleSearchBtn) {
      clipViewerGoogleSearchBtn.addEventListener('click', () => app.openClipViewerGoogleSearchMenu());
    }
    const clipViewerAiRefactorBtn = document.getElementById('clipViewerAiRefactorBtn');
    if (clipViewerAiRefactorBtn) {
      clipViewerAiRefactorBtn.addEventListener('click', () => app.runClipViewerAiRefactorization());
    }
    const clipViewerAiCraftBtn = document.getElementById('clipViewerAiCraftBtn');
    if (clipViewerAiCraftBtn) {
      clipViewerAiCraftBtn.addEventListener('click', () => app.runClipViewerAiCraftClips());
    }
    const clipViewerSendCategoriesBtn = document.getElementById('clipViewerSendCategoriesBtn');
    if (clipViewerSendCategoriesBtn) {
      clipViewerSendCategoriesBtn.addEventListener('click', () => app.runClipViewerSendToCategories());
    }
    const clipViewerSendNotesBtn = document.getElementById('clipViewerSendNotesBtn');
    if (clipViewerSendNotesBtn) {
      clipViewerSendNotesBtn.addEventListener('click', () => app.runClipViewerSendToNotes());
    }
    const clipViewerModal = document.getElementById('clipViewerModal');
    if (clipViewerModal) {
      clipViewerModal.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'clipViewerModal') {
          app.hideClipViewerModal();
        }
      });
    }
}
