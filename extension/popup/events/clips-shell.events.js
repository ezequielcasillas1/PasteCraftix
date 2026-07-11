/** Extracted from popup.js setupEventListeners — behavior unchanged. */

export function registerClipsShellEvents(app) {
    // Manual Text Input functionality
    const manualInputToggle = document.getElementById('manualInputToggle');
    const manualInputBody = document.getElementById('manualInputBody');
    const manualInputHeader = document.querySelector('.manual-input-header');
    
    if (manualInputToggle && manualInputBody && manualInputHeader) {
      manualInputHeader.addEventListener('click', () => {
        const isVisible = manualInputBody.style.display !== 'none';
        manualInputBody.style.display = isVisible ? 'none' : 'block';
        manualInputToggle.classList.toggle('active', !isVisible);
      });
    }

    const manualInputSaveBtn = document.getElementById('manualInputSaveBtn');
    const manualInputTextarea = document.getElementById('manualInputTextarea');
    const manualInputCategory = document.getElementById('manualInputCategory');
    const manualInputClearBtn = document.getElementById('manualInputClearBtn');
    const manualInputSaveSpinner = document.getElementById('manualInputSaveSpinner');
    const manualInputSaveIcon = document.getElementById('manualInputSaveIcon');
    const manualInputSaveLabel = document.getElementById('manualInputSaveLabel');

    const setManualInputSavingState = (isSaving) => {
      if (manualInputSaveBtn) {
        manualInputSaveBtn.disabled = !!isSaving;
        manualInputSaveBtn.title = isSaving ? 'Saving…' : 'Save clip';
        manualInputSaveBtn.setAttribute('aria-label', isSaving ? 'Saving…' : 'Save clip');
      }
      if (manualInputSaveSpinner) manualInputSaveSpinner.style.display = isSaving ? 'inline-block' : 'none';
      if (manualInputSaveIcon) manualInputSaveIcon.style.display = isSaving ? 'none' : '';
      if (manualInputSaveLabel) manualInputSaveLabel.style.display = isSaving ? 'none' : '';
    };

    const manualInputMarkup = document.getElementById('manualInputMarkup');

    if (manualInputSaveBtn && manualInputTextarea && manualInputCategory) {
      manualInputSaveBtn.addEventListener('click', async () => {
        if (app.manualClipSaveInProgress) return;

        const text = manualInputTextarea.value.trim();
        if (!text) {
          app.showToast('Please enter some text to save');
          return;
        }

        const category = manualInputCategory.value || 'Uncategorized';
        
        // Check category limit (Uncategorized = unlimited, others = 150 max)
        if (category !== 'Uncategorized') {
          const allClips = [...app.clips, ...app.searchOnlyClips];
          const clipsInCategory = allClips.filter(clip => clip.category === category);
          
          if (clipsInCategory.length >= 150) {
            app.showToast(`Category "${category}" is full (150 clips max)`);
            return;
          }
        }

        // Build meta with markup hint if user selected a specific format
        const selectedMarkup = manualInputMarkup ? manualInputMarkup.value : 'auto';
        const clipMeta = selectedMarkup && selectedMarkup !== 'auto'
          ? { markupHint: selectedMarkup }
          : null;

        try {
          setManualInputSavingState(true);
          app.manualClipSaveInProgress = true;

          const newClip = {
            id: Date.now() + Math.random(),
            text: text,
            category: category,
            timestamp: Date.now(),
            ...(clipMeta ? { meta: clipMeta } : {})
          };

          app.clips.unshift(newClip);
          
          await app.enforceClipLimit();

          app.currentPage = 0; // Jump to first page so new clip is visible

          // Persist immediately (fast path)
          await chrome.storage.local.set({
            clips: app.clips,
            searchOnlyClips: app.searchOnlyClips,
            pc_local_updatedAt: Date.now()
          });
          
          // Notify content scripts (without auto-showing Quick View)
          try {
            chrome.tabs.query({}, (tabs) => {
              tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                  action: 'clipSaved',
                  clip: newClip,
                  autoShow: false
                }).catch(() => {});
              });
            });
          } catch (error) {
            console.log('Could not notify content scripts:', error);
          }
          
          app.renderChips();
          app.renderCategories();
          app.updateCategoryFilter();
          app.updateManualInputCategories();
          app.showToast(`Saved to ${category}!`);
          
          // Clear textarea
          manualInputTextarea.value = '';

          // Background sync (do NOT block UI on network)
          Promise.resolve()
            .then(() => pasteCraftSupabase.syncWithQueue('syncClips', app.clips, pasteCraftSupabase.syncClipsToSupabase))
            .catch(() => {});
          Promise.resolve()
            .then(() => pasteCraftSupabase.syncWithQueue('syncArchivedClips', app.searchOnlyClips, pasteCraftSupabase.syncArchivedClipsToSupabase))
            .catch(() => {});
          
        } finally {
          app.manualClipSaveInProgress = false;
          setManualInputSavingState(false);
        }
      });
    }

    if (manualInputClearBtn && manualInputTextarea) {
      manualInputClearBtn.addEventListener('click', () => {
        manualInputTextarea.value = '';
        manualInputTextarea.focus();
      });
    }

    // PDF Upload functionality
    app.initPdfExtraction();

    // Populate category dropdown
    app.updateManualInputCategories();

    // Notes functionality
    app.notesFeature.events.registerNotesEvents(app);

    app.clipsFeature.events.registerClipEvents(app);

    // Category management
    document.getElementById('createCategoryBtn').addEventListener('click', () => {
      app.showCreateCategoryDialog();
    });

    // Crafted Output is editable: mark as manual when user types
    const previewArea = document.getElementById('previewArea');
    if (previewArea) {
      previewArea.addEventListener('input', () => {
        app.previewIsManual = true;
      });
    }

    // Category modal events
    app.categoriesFeature.events.registerCategoryModalEvents(app);

    // Profile modal events
    document.getElementById('profileBtn').addEventListener('click', () => {
      app.showProfileModal();
    });

    document.getElementById('closeProfileModal').addEventListener('click', () => {
      app.hideProfileModal();
    });

    app.setupProfileModalEvents();

    const oneClickCopyToggle = document.getElementById('activityOneClickCopyToggle');
    if (oneClickCopyToggle) {
      oneClickCopyToggle.checked = !!app.quickPasteSettings?.oneClickCopy;
      oneClickCopyToggle.addEventListener('change', async (e) => {
        const enabled = !!e.target.checked;
        const saved = await app.saveQuickPasteSettingsPatch({ oneClickCopy: enabled }, true, true);
        if (!saved) {
          oneClickCopyToggle.checked = !enabled;
          app.showToast('❌ Failed to update one-click copy', 'error');
          return;
        }
        app.showToast(enabled ? '✅ One-click copy enabled' : '✅ One-click copy disabled', 'success');
      });
    }

    // Settings events � delegated to settingsFeature
    if (app.settingsFeature?.events?.initSettingsEvents) {
      try {
        app.settingsFeature.events.initSettingsEvents();
      } catch (e) {
        console.error('[Popup] Settings event init failed:', e);
      }
    } else {
      console.error('[Popup] settingsFeature not initialized');
    }
}
