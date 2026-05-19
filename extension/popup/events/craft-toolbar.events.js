/** Extracted from popup.js setupEventListeners — behavior unchanged. */

export function registerCraftToolbarEvents(app) {
    // Breakdown tab switching
    document.querySelector('.breakdown-tabs').addEventListener('click', (e) => {
      const tab = e.target.closest('.breakdown-tab');
      if (tab) {
        const level = tab.dataset.level;
        
        // Update active tab
        document.querySelectorAll('.breakdown-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update level info text
        app.updateLevelInfo(level);
        
        // Generate breakdown for this level
        app.currentBreakdownLevel = level;
        app.generateBreakdown(level);
      }
    });

    // settingsModal overlay click handled by settingsFeature.events.initSettingsEvents()

    // Delimiter controls
    document.getElementById('delimiterControl').addEventListener('click', (e) => {
      if (e.target.classList.contains('segment-btn')) {
        document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        app.delimiter = e.target.dataset.delimiter;
        app.updatePreview();
        app.updatePreviewFromSelection(); // Also update category selection preview
        app.updateDelimiterExample(); // Update example text
        
        // Handle custom delimiter
        const customInput = document.getElementById('customDelimiter');
        if (app.delimiter === 'custom') {
          customInput.style.display = 'block';
          customInput.focus();
        } else {
          customInput.style.display = 'none';
        }
      }
    });
    
    // Custom delimiter input
    document.getElementById('customDelimiter').addEventListener('input', () => {
      if (app.delimiter === 'custom') {
        app.updatePreview();
        app.updatePreviewFromSelection();
        app.updateDelimiterExample(); // Update example text
      }
    });
    
    // Toggle controls
    document.getElementById('deduplicateToggle').addEventListener('change', (e) => {
      app.options.deduplicate = e.target.checked;
      app.updatePreview();
      app.updatePreviewFromSelection(); // Also update category selection preview
    });
    
    document.getElementById('sortToggle').addEventListener('change', (e) => {
      app.options.sort = e.target.checked;
      app.updatePreview();
      app.updatePreviewFromSelection(); // Also update category selection preview
    });
    
    document.getElementById('uppercaseToggle').addEventListener('change', (e) => {
      app.options.uppercase = e.target.checked;
      app.updatePreview();
      app.updatePreviewFromSelection(); // Also update category selection preview
    });
    
    // Copy button
    document.getElementById('copyBtn').addEventListener('click', () => {
      app.copyToClipboard();
    });
    
    // Magic wand � opens preview modal
    document.getElementById('magicWand').addEventListener('click', () => {
      app.magicFormat();
    });

    // Magic info button � opens info modal
    const magicInfoBtn = document.getElementById('magicInfoBtn');
    if (magicInfoBtn) magicInfoBtn.addEventListener('click', () => {
      document.getElementById('magicInfoModal').style.display = 'flex';
    });
    const closeMagicInfo = document.getElementById('closeMagicInfo');
    if (closeMagicInfo) closeMagicInfo.addEventListener('click', () => {
      document.getElementById('magicInfoModal').style.display = 'none';
    });
    const magicInfoDone = document.getElementById('magicInfoDone');
    if (magicInfoDone) magicInfoDone.addEventListener('click', () => {
      document.getElementById('magicInfoModal').style.display = 'none';
    });
    const magicInfoOverlay = document.getElementById('magicInfoModal');
    if (magicInfoOverlay) magicInfoOverlay.addEventListener('click', (e) => {
      if (e.target.id === 'magicInfoModal') magicInfoOverlay.style.display = 'none';
    });

    // Magic preview modal: close / cancel
    const closeMagicPreview = document.getElementById('closeMagicPreview');
    if (closeMagicPreview) closeMagicPreview.addEventListener('click', () => {
      document.getElementById('magicPreviewModal').style.display = 'none';
    });
    const magicCancelBtn = document.getElementById('magicCancelBtn');
    if (magicCancelBtn) magicCancelBtn.addEventListener('click', () => {
      document.getElementById('magicPreviewModal').style.display = 'none';
    });
    const magicPreviewOverlay = document.getElementById('magicPreviewModal');
    if (magicPreviewOverlay) magicPreviewOverlay.addEventListener('click', (e) => {
      if (e.target.id === 'magicPreviewModal') magicPreviewOverlay.style.display = 'none';
    });

    // Magic preview: Craft the Magic (selected only)
    const craftSelectedBtn = document.getElementById('magicCraftSelectedBtn');
    if (craftSelectedBtn) craftSelectedBtn.addEventListener('click', async () => {
      if (app._magicSelected.size === 0) return;
      document.getElementById('magicPreviewModal').style.display = 'none';
      const stats = await app._craftMagic([...app._magicSelected]);
      app._showMagicResults(stats);
    });

    // Magic preview: Craft all Magic to clips
    const craftAllBtn = document.getElementById('magicCraftAllBtn');
    if (craftAllBtn) craftAllBtn.addEventListener('click', async () => {
      document.getElementById('magicPreviewModal').style.display = 'none';
      const stats = await app._craftAllMagic();
      app._showMagicResults(stats);
    });

    // Magic preview: Undo
    const magicUndoBtn = document.getElementById('magicUndoBtn');
    if (magicUndoBtn) magicUndoBtn.addEventListener('click', () => {
      app._undoMagic();
    });

    // Magic results modal: close
    const closeMagicResults = document.getElementById('closeMagicResults');
    if (closeMagicResults) closeMagicResults.addEventListener('click', () => {
      document.getElementById('magicResultsModal').style.display = 'none';
    });
    const magicDoneBtn = document.getElementById('magicResultsDone');
    if (magicDoneBtn) magicDoneBtn.addEventListener('click', () => {
      document.getElementById('magicResultsModal').style.display = 'none';
    });
    const magicResultsOverlay = document.getElementById('magicResultsModal');
    if (magicResultsOverlay) magicResultsOverlay.addEventListener('click', (e) => {
      if (e.target.id === 'magicResultsModal') magicResultsOverlay.style.display = 'none';
    });
}
