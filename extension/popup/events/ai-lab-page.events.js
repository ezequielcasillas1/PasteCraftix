/** Extracted from popup.js setupEventListeners — behavior unchanged. */

export function registerAiLabPageEvents(app) {
    // AI button and tab handlers
    const aiBtn = document.getElementById('aiBtn');
    if (aiBtn) {
      aiBtn.addEventListener('click', () => {
        // Switch to AI tab
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        const aiTabBtn = document.querySelector('.tab-btn[data-tab="ai"]');
        if (aiTabBtn) {
          aiTabBtn.classList.add('active');
        }
        
        app.currentTab = 'ai';
        document.getElementById('aiTab').classList.add('active');

        // Persist active tab
        app._saveActiveTabState();

        // Refresh credits view when entering AI Lab.
        app.updateAiCreditsPills('ai-tab');

        // Defer heavy work one frame so the tab-switch paints first. Avoids
        // a stutter where layout + gallery network reads happen in the same
        // frame as the CSS class change.
        requestAnimationFrame(() => {
          app.loadAIGallery();
          app.migrateProfileImageToGallery();
        });
      });
    }

    // AI Lab internal tab navigation
    const aiLabTabsContainer = document.querySelector('.ai-lab-tabs');
    if (aiLabTabsContainer) {
      aiLabTabsContainer.addEventListener('click', (e) => {
        const clickedTab = e.target.closest('.ai-lab-tab');
        if (clickedTab) {
          // Remove active class from all AI Lab tabs
          document.querySelectorAll('.ai-lab-tab').forEach(tab => tab.classList.remove('active'));
          document.querySelectorAll('.ai-lab-section').forEach(section => section.classList.remove('active'));
          
          // Add active class to clicked tab
          clickedTab.classList.add('active');
          
          // Show corresponding section
          const tabName = clickedTab.dataset.aiTab;
          app._currentAiLabSubTab = tabName;
          app._saveActiveTabState();

          if (tabName === 'generator') {
            document.getElementById('aiGeneratorSection').classList.add('active');
          } else if (tabName === 'gallery') {
            document.getElementById('aiGallerySection').classList.add('active');
            app.loadAIGallery();
            app.migrateProfileImageToGallery();
          } else if (tabName === 'summary') {
            document.getElementById('aiSummarySection').classList.add('active');
            if (app._currentSummarySection === 'input' || !app._currentSummarySection) {
              app._renderOpenRecentConversation();
            }
          }
        }
      });
    }

    // AI Refactorization standalone button
    const refactorButton = document.querySelector('.ai-refactorization-feature');
    if (refactorButton) {
      refactorButton.addEventListener('click', () => {
        app.aiLabFeature.refactorization.activateRefactorizationSection(app);
      });
    }

    app.aiLabFeature.refactorization.bindRefactorizationPanelUi(app);

    // AI Breakdown standalone button
    const breakdownButton = document.querySelector('.ai-breakdown-feature');
    if (breakdownButton) {
      breakdownButton.addEventListener('click', () => {
        // Remove active class from all tabs and sections
        document.querySelectorAll('.ai-lab-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.ai-lab-section').forEach(section => section.classList.remove('active'));
        
        // Show breakdown section
        document.getElementById('aiBreakdownSection').classList.add('active');
        app._currentAiLabSubTab = 'breakdown';
        app._saveActiveTabState();
      });
    }

    // AI Breakdown page state
    app.selectedBreakdownLevel = null;

    // AI Breakdown page event listeners
    const clearBreakdownInput = document.getElementById('clearBreakdownInput');
    const breakdownInput = document.getElementById('breakdownInput');
    const charCounter = document.getElementById('breakdownCharCounter');
    const analyzeLevelBtn = document.getElementById('analyzeLevelBtn');
    const levelChips = document.querySelectorAll('.level-chip');
    const levelSelectionHint = document.getElementById('levelSelectionHint');

    if (clearBreakdownInput && breakdownInput) {
      clearBreakdownInput.addEventListener('click', () => {
        breakdownInput.value = '';
        if (charCounter) charCounter.textContent = '0 characters';
        app.selectedBreakdownLevel = null;
        
        // Disable and deselect all level chips
        levelChips.forEach(chip => {
          chip.disabled = true;
          chip.classList.remove('selected');
        });
        
        // Disable analyze button
        if (analyzeLevelBtn) analyzeLevelBtn.disabled = true;
        
        // Reset hint
        if (levelSelectionHint) {
          levelSelectionHint.textContent = 'Type at least one sentence above to enable levels';
        }
        
        // Hide inline results
        const bdInlineResults = document.getElementById('bdInlineResults');
        if (bdInlineResults) bdInlineResults.style.display = 'none';
        app.inlineBreakdownCache = {};
        app.inlineBreakdownThreads = [];
        app.currentInlineBreakdownThreadIndex = 0;

        breakdownInput.focus();
        // Persist cleared state
        app._saveBreakdownPageState();
      });
    }

    // Character counter and level chip enabler
    if (breakdownInput && charCounter) {
      // Debounce timer for persisting breakdown input
      let _bdInputSaveTimer = null;

      breakdownInput.addEventListener('input', () => {
        const text = breakdownInput.value.trim();
        const length = breakdownInput.value.length;
        const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
        
        charCounter.textContent = `${length} character${length !== 1 ? 's' : ''}`;
        
        // Enable level chips if at least 5 words (roughly one sentence)
        const hasEnoughText = wordCount >= 5;
        
        levelChips.forEach(chip => {
          chip.disabled = !hasEnoughText;
        });
        
        // Update hint text
        if (levelSelectionHint) {
          if (hasEnoughText) {
            levelSelectionHint.textContent = 'Select a level below to continue';
          } else {
            const remaining = 5 - wordCount;
            levelSelectionHint.textContent = `Type ${remaining} more word${remaining !== 1 ? 's' : ''} to enable levels`;
          }
        }
        
        // If text is cleared, disable analyze button and reset selection
        if (!hasEnoughText) {
          app.selectedBreakdownLevel = null;
          levelChips.forEach(chip => chip.classList.remove('selected'));
          if (analyzeLevelBtn) analyzeLevelBtn.disabled = true;
        }

        // Persist breakdown input (debounced)
        clearTimeout(_bdInputSaveTimer);
        _bdInputSaveTimer = setTimeout(() => app._saveBreakdownPageState(), 400);
      });
    }

    // Level chip selection
    levelChips.forEach(chip => {
      chip.addEventListener('click', () => {
        if (!chip.disabled) {
          // Deselect all chips
          levelChips.forEach(c => c.classList.remove('selected'));
          
          // Select this chip
          chip.classList.add('selected');
          app.selectedBreakdownLevel = chip.dataset.level;
          
          // Enable analyze button
          if (analyzeLevelBtn) analyzeLevelBtn.disabled = false;
          
          // Update hint
          if (levelSelectionHint) {
            const levelName = chip.querySelector('strong').textContent;
            levelSelectionHint.textContent = `${levelName} level selected - Click analyze button below`;
          }

          // Persist selected level
          app._saveBreakdownPageState();
        }
      });
    });

    // Analyze button - renders INLINE (not in modal) when from AI Lab page
    if (analyzeLevelBtn && breakdownInput) {
      analyzeLevelBtn.addEventListener('click', () => {
        const text = breakdownInput.value.trim();
        if (text && app.selectedBreakdownLevel) {
          app.startInlineBreakdown(text, app.selectedBreakdownLevel);
        }
      });
    }

    // Inline level tab clicks (switch levels inside inline results)
    document.querySelectorAll('.bd-inline-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const level = tab.dataset.inlineLevel;
        if (!level || !app.currentBreakdownText) return;

        // Update active tab
        document.querySelectorAll('.bd-inline-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Also update Step 2 chip selection
        const levelChips = document.querySelectorAll('.level-chip');
        levelChips.forEach(c => c.classList.remove('selected'));
        const matchingChip = document.querySelector(`.level-chip[data-level="${level}"]`);
        if (matchingChip) matchingChip.classList.add('selected');

        app.selectedBreakdownLevel = level;
        app.currentBreakdownLevel = level;

        // Update badge
        const badge = document.getElementById('bdInlineLevelBadge');
        const levelNames = { eli5: 'Child', elementary: 'Elementary', highschool: 'High School', college: 'College', phd: 'PhD', wiseman: 'Wise Man' };
        if (badge) badge.textContent = levelNames[level] || level;

        // Generate for this level
        app.generateBreakdownInline(level);
      });
    });

    // Inline follow-up button
    const bdInlineFollowupBtn = document.getElementById('bdInlineFollowupBtn');
    const bdInlineFollowupInput = document.getElementById('bdInlineFollowupInput');
    if (bdInlineFollowupBtn && bdInlineFollowupInput) {
      const sendInlineFollowup = () => {
        const question = bdInlineFollowupInput.value.trim();
        if (!question || !app.currentBreakdownText) return;
        bdInlineFollowupInput.value = '';
        app.sendInlineBreakdownFollowup(question);
      };
      bdInlineFollowupBtn.addEventListener('click', sendInlineFollowup);
      bdInlineFollowupInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendInlineFollowup();
      });
    }

    // AI Summary page event listeners
    const summaryInput = document.getElementById('summaryInput');
    const summaryCharCounter = document.getElementById('summaryCharCounter');
    const clearSummaryInput = document.getElementById('clearSummaryInput');
    const generateQuestionsBtn = document.getElementById('generateQuestionsBtn');
    const customQuestionInput = document.getElementById('customQuestionInput');
    const customQuestionBtn = document.getElementById('customQuestionBtn');
    const backToInputBtn = document.getElementById('backToInputBtn');
    const newQuestionBtn = document.getElementById('newQuestionBtn');
    const newSummaryBtn = document.getElementById('newSummaryBtn');
    const copySummaryBtn = document.getElementById('copySummaryBtn');

    // Summary input character counter
    // Debounce timer for persisting summary input
    let _sumInputSaveTimer = null;

    if (summaryInput && summaryCharCounter) {
      summaryInput.addEventListener('input', () => {
        const length = summaryInput.value.length;
        const wordCount = summaryInput.value.trim().split(/\s+/).filter(w => w.length > 0).length;
        summaryCharCounter.textContent = `${length} characters`;
        
        // Enable generate questions button if enough text (at least 5 words)
        if (generateQuestionsBtn) {
          generateQuestionsBtn.disabled = wordCount < 5;
        }

        // Persist summary input (debounced)
        clearTimeout(_sumInputSaveTimer);
        _sumInputSaveTimer = setTimeout(() => {
          app._currentSummarySection = 'input';
          app._saveSummaryState();
        }, 400);
      });
    }

    // Clear summary input
    if (clearSummaryInput && summaryInput) {
      clearSummaryInput.addEventListener('click', () => {
        summaryInput.value = '';
        if (summaryCharCounter) summaryCharCounter.textContent = '0 characters';
        if (generateQuestionsBtn) generateQuestionsBtn.disabled = true;
        summaryInput.focus();
        // Persist cleared state
        app._currentSummarySection = 'input';
        app._saveSummaryState();
      });
    }

    // Generate questions button
    if (generateQuestionsBtn) {
      generateQuestionsBtn.addEventListener('click', () => {
        const text = summaryInput.value.trim();
        if (text) {
          app.currentSummaryText = text;
          app.generateSummaryQuestions(text);
        }
      });
    }

    // Custom question input
    if (customQuestionInput && customQuestionBtn) {
      customQuestionInput.addEventListener('input', () => {
        customQuestionBtn.disabled = customQuestionInput.value.trim().length < 5;
      });
      
      customQuestionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !customQuestionBtn.disabled) {
          customQuestionBtn.click();
        }
      });
    }

    // Custom question button
    if (customQuestionBtn) {
      customQuestionBtn.addEventListener('click', () => {
        const question = customQuestionInput.value.trim();
        if (question && app.currentSummaryText) {
          app.currentSummaryQuestion = question;
          app.generateSummary(app.currentSummaryText, question);
        }
      });
    }

    // Back to input button
    if (backToInputBtn) {
      backToInputBtn.addEventListener('click', () => {
        app.showSummarySection('input');
        app.currentSummaryText = null;
        app.generatedQuestions = [];
        app._currentSummarySection = 'input';
        app._saveSummaryState();
        app._renderOpenRecentConversation();
      });
    }

    // New question button
    if (newQuestionBtn) {
      newQuestionBtn.addEventListener('click', () => {
        app.showSummarySection('questions');
        app._currentSummarySection = 'questions';
        app._saveSummaryState();
      });
    }

    // New summary button
    if (newSummaryBtn) {
      newSummaryBtn.addEventListener('click', () => {
        app._resetSummaryToEmpty();
        app._saveSummaryState();
      });
    }

    // Copy summary button
    if (copySummaryBtn) {
      copySummaryBtn.addEventListener('click', async () => {
        const content = document.getElementById('summaryResultContent').textContent;
        if (content) {
          try {
            await app.copyToClipboardFallback(content);
            app.showToast('Summary copied to clipboard!');
          } catch (error) {
            console.error('Summary copy failed:', error);
            app.showToast('Failed to copy summary', 'error');
          }
        }
      });
    }

    // Summary follow-up handlers
    const summaryFollowupInput = document.getElementById('summaryFollowupInput');
    const summaryFollowupBtn = document.getElementById('summaryFollowupBtn');

    if (summaryFollowupInput) {
      summaryFollowupInput.addEventListener('input', (e) => {
        if (summaryFollowupBtn) {
          summaryFollowupBtn.disabled = e.target.value.trim() === '';
        }
      });

      summaryFollowupInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.value.trim() && app.currentSummaryText) {
          app.handleSummaryFollowup(e.target.value.trim());
        }
      });
    }

    if (summaryFollowupBtn) {
      summaryFollowupBtn.disabled = true;
      summaryFollowupBtn.addEventListener('click', () => {
        if (summaryFollowupInput && app.currentSummaryText) {
          const followupQuestion = summaryFollowupInput.value.trim();
          if (followupQuestion) {
            app.handleSummaryFollowup(followupQuestion);
          }
        }
      });
    }

    // Breakdown follow-up handlers
    const breakdownFollowupInput = document.getElementById('breakdownFollowupInput');
    const breakdownFollowupBtn = document.getElementById('breakdownFollowupBtn');

    if (breakdownFollowupInput) {
      breakdownFollowupInput.addEventListener('input', (e) => {
        const hasText = e.target.value.trim() !== '';
        
        // Enable/disable send button
        if (breakdownFollowupBtn) {
          breakdownFollowupBtn.disabled = !hasText;
        }
        
        // Enable/disable level tabs
        app.toggleFollowupLevelTabs(hasText);
      });

      breakdownFollowupInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.value.trim() && app.currentBreakdownText) {
          app.handleBreakdownFollowup(e.target.value.trim());
        }
      });
    }

    if (breakdownFollowupBtn) {
      breakdownFollowupBtn.disabled = true;
      breakdownFollowupBtn.addEventListener('click', () => {
        if (breakdownFollowupInput && app.currentBreakdownText) {
          const followupQuestion = breakdownFollowupInput.value.trim();
          if (followupQuestion) {
            app.handleBreakdownFollowup(followupQuestion);
          }
        }
      });
    }

    // Follow-up level tab handlers
    const followupLevelTabs = document.querySelectorAll('.followup-level-tab');
    followupLevelTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        if (!tab.classList.contains('disabled')) {
          // Remove selected from all
          followupLevelTabs.forEach(t => t.classList.remove('selected'));
          // Add selected to clicked
          tab.classList.add('selected');
          // Store selected level
          app.selectedFollowupLevel = tab.dataset.followupLevel;
          console.log('?? Selected follow-up level:', app.selectedFollowupLevel);
          
          // ? FIX: Auto-submit the followup when level is clicked
          if (breakdownFollowupInput && app.currentBreakdownText) {
            const followupQuestion = breakdownFollowupInput.value.trim();
            if (followupQuestion) {
              app.handleBreakdownFollowup(followupQuestion);
            }
          }
        }
      });
    });
    
    // AI generation buttons
    const aiGenerateFromProfileBtn = document.getElementById('aiGenerateFromProfileBtn');
    const aiGenerateRandomBtn = document.getElementById('aiGenerateRandomBtn');
    const aiTimerDismiss = document.getElementById('aiTimerDismiss');
    
    if (aiGenerateFromProfileBtn) {
      aiGenerateFromProfileBtn.addEventListener('click', () => {
        app.generateAIImageFromProfile();
      });
    }
    
    if (aiGenerateRandomBtn) {
      aiGenerateRandomBtn.addEventListener('click', () => {
        app.generateRandomAIImage();
      });
    }
    
    if (aiTimerDismiss) {
      aiTimerDismiss.addEventListener('click', () => {
        app.hideAIGenerationTimer();
      });
    }
    
    // Quick Copy Button
    document.getElementById('quickCopyBtn').addEventListener('click', () => {
      app.handleQuickCopy();
    });

    // Quick Delete Button (2+ selected)
    const quickDeleteBtn = document.getElementById('quickDeleteBtn');
    if (quickDeleteBtn) {
      quickDeleteBtn.addEventListener('click', () => {
        app.handleQuickDelete();
      });
    }

    // Bulk AI Actions (2+ selected clips) � modularized so Clips and Categories reuse the same wiring
    app._wireBulkAiButtons({
      summaryBtnId: 'bulkAiSummaryBtn',
      sendCategoriesBtnId: 'bulkSendCategoriesBtn',
      sendNotesBtnId: 'bulkSendNotesBtn',
      breakdownBtnId: 'bulkAiBreakdownBtn',
      getText: () => app._getSelectedClipsText(),
      getIdKeys: () => app._getSelectedClipIdKeys(),
      getClipObjects: () => app._getSelectedClipObjects()
    });

    app._wireBulkAiButtons({
      summaryBtnId: 'categoriesBulkAiSummaryBtn',
      sendCategoriesBtnId: 'categoriesBulkSendCategoriesBtn',
      sendNotesBtnId: 'categoriesBulkSendNotesBtn',
      breakdownBtnId: 'categoriesBulkAiBreakdownBtn',
      getText: () => app._getSelectedCategoryClipsText(),
      getIdKeys: () => app._getSelectedCategoryClipIdKeys(),
      getClipObjects: () => app._getSelectedCategoryClipObjects()
    });

    // Setup image viewer for expanded view
    app.setupImageViewer();
    
    // Initialize delimiter example text
    app.updateDelimiterExample();
}
