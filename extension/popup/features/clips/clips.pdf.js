import { createClips } from './clips.service.js';

export function initPdfExtraction(app) {
  const pdfBtn = document.getElementById('pdfUploadBtn');
  const pdfInput = document.getElementById('pdfFileInput');
  if (!pdfBtn || !pdfInput) return;

  pdfBtn.addEventListener('click', () => pdfInput.click());

  pdfInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    pdfInput.value = '';
    await openPdfExtractModal(app, file);
  });

  const closeBtn = document.getElementById('pdfExtractCloseBtn');
  const cancelBtn = document.getElementById('pdfExtractCancelBtn');
  const saveBtn = document.getElementById('pdfExtractSaveBtn');
  const modal = document.getElementById('pdfExtractModal');

  if (closeBtn) closeBtn.addEventListener('click', () => closePdfModal(app));
  if (cancelBtn) cancelBtn.addEventListener('click', () => closePdfModal(app));
  if (modal) modal.addEventListener('click', (e) => {
    if (e.target === modal) closePdfModal(app);
  });
  if (saveBtn) saveBtn.addEventListener('click', () => savePdfClips(app));

  document.querySelectorAll('input[name="pdfSaveMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      updatePdfSaveLabel(app);
      const mode = radio.value;
      if (mode !== 'selectedPage' && typeof app._pdfActiveTab !== 'number') return;
      if (mode === 'selectedPage' && app._pdfActiveTab === 'all') {
        if (app._pdfPages && app._pdfPages.length > 0) {
          switchPdfTab(app, 0);
        }
      }
    });
  });
}

export async function openPdfExtractModal(app, file) {
  const modal = document.getElementById('pdfExtractModal');
  const loading = document.getElementById('pdfExtractLoading');
  const options = document.getElementById('pdfExtractOptions');
  const preview = document.getElementById('pdfExtractPreview');
  const saveBtn = document.getElementById('pdfExtractSaveBtn');
  const fileNameEl = document.getElementById('pdfFileName');
  const pageCountEl = document.getElementById('pdfPageCount');
  const loadingText = document.getElementById('pdfLoadingText');

  app._pdfPages = [];
  app._pdfActiveTab = 'all';
  if (fileNameEl) fileNameEl.textContent = file.name;
  if (pageCountEl) pageCountEl.textContent = '…';
  if (saveBtn) saveBtn.disabled = true;
  if (loading) loading.style.display = 'flex';
  if (options) options.style.display = 'none';
  if (preview) preview.style.display = 'none';
  if (modal) modal.style.display = 'flex';

  populatePdfCategoryDropdown(app);

  try {
    if (loadingText) loadingText.textContent = 'Reading PDF…';
    const arrayBuffer = await file.arrayBuffer();

    if (loadingText) loadingText.textContent = 'Extracting text…';
    const pages = await extractPdfText(arrayBuffer);
    app._pdfPages = pages;

    if (pageCountEl) pageCountEl.textContent = `${pages.length} page${pages.length !== 1 ? 's' : ''}`;

    buildPdfPageTabs(app, pages);

    const textarea = document.getElementById('pdfPreviewTextarea');
    if (textarea) {
      textarea.value = pages.map((p, i) => `— Page ${i + 1} —\n${p}`).join('\n\n');
    }

    if (loading) loading.style.display = 'none';
    if (options) options.style.display = 'flex';
    if (preview) preview.style.display = 'flex';
    if (saveBtn) saveBtn.disabled = false;
  } catch (err) {
    console.error('PDF extraction failed:', err);
    if (loading) loading.style.display = 'none';
    app.showToast('Failed to extract PDF text. The file may be scanned/image-only.');
    closePdfModal(app);
  }
}

export async function extractPdfText(arrayBuffer) {
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');
  }

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    pages.push(strings.join(' ').replace(/\s{2,}/g, ' ').trim());
  }
  return pages;
}

export function buildPdfPageTabs(app, pages) {
  const container = document.getElementById('pdfPreviewTabs');
  if (!container) return;
  container.innerHTML = '';

  const allTab = document.createElement('button');
  allTab.className = 'pdf-page-tab active';
  allTab.textContent = 'All';
  allTab.dataset.page = 'all';
  allTab.addEventListener('click', () => switchPdfTab(app, 'all'));
  container.appendChild(allTab);

  pages.forEach((_, idx) => {
    const tab = document.createElement('button');
    tab.className = 'pdf-page-tab';
    tab.textContent = `P${idx + 1}`;
    tab.dataset.page = String(idx);
    tab.addEventListener('click', () => switchPdfTab(app, idx));
    container.appendChild(tab);
  });
}

export function switchPdfTab(app, pageIndex) {
  app._pdfActiveTab = pageIndex;
  const tabs = document.querySelectorAll('.pdf-page-tab');
  tabs.forEach(t => t.classList.remove('active'));

  const textarea = document.getElementById('pdfPreviewTextarea');
  if (!textarea) return;

  if (pageIndex === 'all') {
    textarea.value = app._pdfPages.map((p, i) => `— Page ${i + 1} —\n${p}`).join('\n\n');
    tabs[0]?.classList.add('active');
  } else {
    textarea.value = app._pdfPages[pageIndex] || '';
    tabs[pageIndex + 1]?.classList.add('active');

    const selectedPageRadio = document.querySelector('input[name="pdfSaveMode"][value="selectedPage"]');
    if (selectedPageRadio) {
      selectedPageRadio.checked = true;
      updatePdfSaveLabel(app);
    }
  }
}

export function updatePdfSaveLabel(app) {
  const label = document.getElementById('pdfSaveLabel');
  if (!label) return;
  const mode = document.querySelector('input[name="pdfSaveMode"]:checked')?.value || 'single';
  if (mode === 'selectedPage' && typeof app._pdfActiveTab === 'number') {
    label.textContent = `Save Page ${app._pdfActiveTab + 1} to Clips`;
  } else {
    label.textContent = 'Save to Clips';
  }
}

export function populatePdfCategoryDropdown(app) {
  return app.categoriesFeature?.render?.populatePdfCategoryDropdown?.(app);
}

export async function savePdfClips(app) {
  if (!app._pdfPages || app._pdfPages.length === 0) return;

  const saveBtn = document.getElementById('pdfExtractSaveBtn');
  const spinner = document.getElementById('pdfSaveSpinner');
  const label = document.getElementById('pdfSaveLabel');
  if (saveBtn) saveBtn.disabled = true;
  if (spinner) spinner.style.display = 'inline-block';
  if (label) label.textContent = 'Saving…';

  try {
    const mode = document.querySelector('input[name="pdfSaveMode"]:checked')?.value || 'single';
    const category = document.getElementById('pdfExtractCategory')?.value || 'Uncategorized';
    const fileName = document.getElementById('pdfFileName')?.textContent || 'PDF';

    let clipsToSave = [];

    if (mode === 'single') {
      const allText = app._pdfPages.join('\n\n');
      if (allText.trim()) {
        clipsToSave.push({
          id: Date.now() + Math.random(),
          text: allText.trim(),
          category,
          timestamp: Date.now(),
          meta: { source: 'pdf', fileName }
        });
      }
    } else if (mode === 'selectedPage') {
      const pageIdx = (typeof app._pdfActiveTab === 'number') ? app._pdfActiveTab : null;
      if (pageIdx === null || pageIdx < 0 || pageIdx >= app._pdfPages.length) {
        app.showToast('Please select a specific page tab (P1, P2, …) first.');
        if (saveBtn) saveBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
        if (label) label.textContent = 'Save to Clips';
        return;
      }
      const pageText = app._pdfPages[pageIdx];
      if (pageText && pageText.trim()) {
        clipsToSave.push({
          id: Date.now() + Math.random(),
          text: pageText.trim(),
          category,
          timestamp: Date.now(),
          meta: { source: 'pdf', fileName, page: pageIdx + 1 }
        });
      }
    } else {
      app._pdfPages.forEach((pageText, idx) => {
        if (pageText.trim()) {
          clipsToSave.push({
            id: Date.now() + Math.random() + idx,
            text: pageText.trim(),
            category,
            timestamp: Date.now() - idx,
            meta: { source: 'pdf', fileName, page: idx + 1 }
          });
        }
      });
    }

    if (clipsToSave.length === 0) {
      app.showToast('No text found in PDF to save.');
      return;
    }

    if (category !== 'Uncategorized') {
      const allClips = [...app.clips, ...app.searchOnlyClips];
      const inCat = allClips.filter(c => c.category === category).length;
      if (inCat + clipsToSave.length > 150) {
        app.showToast(`Category "${category}" would exceed 150 clip limit.`);
        return;
      }
    }

    const result = await createClips(app, clipsToSave, {
      successMessage: `Saved ${clipsToSave.length} clip${clipsToSave.length > 1 ? 's' : ''} from PDF!`,
      autoShowSavedClip: false,
    });

    if (!result.success) {
      app.showToast('Failed to save PDF clips', 'error');
      return;
    }

    closePdfModal(app);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
    if (spinner) spinner.style.display = 'none';
    if (label) label.textContent = 'Save to Clips';
  }
}

export function closePdfModal(app) {
  const modal = document.getElementById('pdfExtractModal');
  if (modal) modal.style.display = 'none';
  app._pdfPages = [];
  app._pdfActiveTab = 'all';
}
