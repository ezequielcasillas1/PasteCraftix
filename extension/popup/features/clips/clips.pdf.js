import { createClips } from './clips.service.js';

function assertPdfLibraryLoaded() {
  if (!globalThis.pdfjsLib) {
    throw new Error('PDF library not loaded. Run npm run prepare:libs to restore extension/lib assets.');
  }
}

async function ensurePdfLibraryLoaded() {
  if (!globalThis.pdfjsLib) {
    const loader = globalThis.PasteCraftResourceLoader;
    if (!loader?.loadScript) {
      throw new Error('PDF library not loaded. Run npm run prepare:libs to restore extension/lib assets.');
    }
    try {
      await loader.loadScript('pdf');
    } catch (error) {
      throw new Error(
        'PDF library not loaded. Run npm run prepare:libs to restore extension/lib assets.',
        { cause: error },
      );
    }
  }
  assertPdfLibraryLoaded();
  globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');
  return globalThis.pdfjsLib;
}

function getPdfPreviewTextarea() {
  return document.getElementById('pdfPreviewTextarea');
}

function getPdfSaveMode() {
  return document.querySelector('input[name="pdfSaveMode"]:checked')?.value || 'single';
}

function pageHasExtractedText(page) {
  return typeof page === 'string' && page.trim().length > 0;
}

function getPdfPreviewText() {
  return getPdfPreviewTextarea()?.value?.trim() || '';
}

function stripPdfPageHeaders(text) {
  return String(text || '')
    .replace(/^— Page \d+ —\s*/gm, '')
    .trim();
}

function hasMeaningfulPreviewText() {
  return stripPdfPageHeaders(getPdfPreviewText()).length > 0;
}

function setPdfScanNotice(visible) {
  const notice = document.getElementById('pdfScanNotice');
  if (notice) notice.style.display = visible ? 'block' : 'none';
}

async function pageLooksImageOnly(page, hasText) {
  if (hasText) return false;
  try {
    const ops = await page.getOperatorList();
    const OPS = pdfjsLib.OPS || {};
    return ops.fnArray.some(
      (fn) =>
        fn === OPS.paintImageXObject ||
        fn === OPS.paintInlineImageXObject ||
        fn === OPS.paintJpegXObject
    );
  } catch (_) {
    return false;
  }
}

export function canSavePdfForMode(app) {
  if (!app._pdfPages?.length) return false;

  const mode = getPdfSaveMode();

  if (mode === 'selectedPage') {
    if (typeof app._pdfActiveTab !== 'number') return false;
    return hasMeaningfulPreviewText() || pageHasExtractedText(app._pdfPages[app._pdfActiveTab]);
  }

  if (mode === 'perPage') {
    return app._pdfPages.some(pageHasExtractedText);
  }

  return app._pdfPages.some(pageHasExtractedText) || hasMeaningfulPreviewText();
}

export function updatePdfSaveBtnState(app) {
  const saveBtn = document.getElementById('pdfExtractSaveBtn');
  if (!saveBtn || saveBtn.dataset.saving === 'true') return;
  saveBtn.disabled = !canSavePdfForMode(app);
}

export function initPdfExtraction(app) {
  const pdfBtn = document.getElementById('pdfUploadBtn');
  const pdfInput = document.getElementById('pdfFileInput');
  if (!pdfBtn || !pdfInput) return;

  pdfBtn.addEventListener('click', (e) => {
    e.preventDefault();
    pdfInput.click();
  });

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

  const previewTextarea = getPdfPreviewTextarea();
  if (previewTextarea) {
    previewTextarea.addEventListener('input', () => updatePdfSaveBtnState(app));
  }

  document.querySelectorAll('input[name="pdfSaveMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      updatePdfSaveLabel(app);
      updatePdfSaveBtnState(app);
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
  app._pdfIsScanned = false;
  if (fileNameEl) fileNameEl.textContent = file.name;
  if (pageCountEl) pageCountEl.textContent = '…';
  if (saveBtn) saveBtn.disabled = true;
  if (loading) loading.style.display = 'flex';
  if (options) options.style.display = 'none';
  if (preview) preview.style.display = 'none';
  setPdfScanNotice(false);
  if (modal) modal.style.display = 'flex';

  populatePdfCategoryDropdown(app);

  try {
    if (loadingText) loadingText.textContent = 'Reading PDF…';
    const arrayBuffer = await file.arrayBuffer();

    if (loadingText) loadingText.textContent = 'Extracting text…';
    const { pages, meta } = await extractPdfText(arrayBuffer);
    app._pdfPages = pages;

    if (pageCountEl) pageCountEl.textContent = `${pages.length} page${pages.length !== 1 ? 's' : ''}`;

    buildPdfPageTabs(app, pages);

    const textarea = getPdfPreviewTextarea();
    const hasText = pages.some(pageHasExtractedText);
    const isScanned = !hasText && (meta.imageOnlySampleCount > 0 || meta.itemsWithText === 0);
    app._pdfIsScanned = isScanned;

    if (textarea) {
      textarea.value = hasText
        ? pages.map((p, i) => `— Page ${i + 1} —\n${p}`).join('\n\n')
        : '';
      textarea.placeholder = isScanned
        ? 'Scanned PDF — paste or type text here, then Save.'
        : 'Extracted text will appear here. You can edit before saving.';
    }

    if (loading) loading.style.display = 'none';
    if (options) options.style.display = 'flex';
    if (preview) preview.style.display = 'flex';
    setPdfScanNotice(isScanned);
    updatePdfSaveBtnState(app);

    if (!hasText) {
      app.showToast(
        isScanned
          ? 'Scanned PDF (image-only). Paste text into the preview to save.'
          : 'No selectable text found. Edit the preview or try another PDF.'
      );
      if (textarea) textarea.focus();
    }
  } catch (err) {
    console.error('PDF extraction failed:', err);
    if (loading) loading.style.display = 'none';
    setPdfScanNotice(false);
    const message = err?.message?.includes('PDF library not loaded')
      ? 'PDF tools are missing. Run npm run prepare:libs, then reload the extension.'
      : 'Failed to read this PDF. It may be corrupted, password-protected, or image-only.';
    app.showToast(message, 'error');
    closePdfModal(app);
  }
}

export async function extractPdfText(arrayBuffer) {
  const pdfLibrary = await ensurePdfLibraryLoaded();

  const pdf = await pdfLibrary.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  let imageOnlySampleCount = 0;
  let itemsWithText = 0;
  const sampleLimit = Math.min(3, pdf.numPages);

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      .filter((item) => typeof item.str === 'string')
      .map((item) => item.str);
    itemsWithText += strings.filter((s) => s.trim()).length;
    const joined = strings.join(' ').replace(/\s{2,}/g, ' ').trim();
    pages.push(joined);

    if (i <= sampleLimit && await pageLooksImageOnly(page, !!joined)) {
      imageOnlySampleCount += 1;
    }
  }

  return {
    pages,
    meta: {
      itemsWithText,
      imageOnlySampleCount,
      nonEmptyPages: pages.filter((p) => p.trim()).length,
    },
  };
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

  const textarea = getPdfPreviewTextarea();
  if (!textarea) return;

  if (pageIndex === 'all') {
    textarea.value = app._pdfIsScanned
      ? ''
      : app._pdfPages.map((p, i) => `— Page ${i + 1} —\n${p}`).join('\n\n');
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

  if (app._pdfIsScanned) {
    textarea.placeholder = typeof pageIndex === 'number'
      ? `Scanned page ${pageIndex + 1} — paste or type text here, then Save.`
      : 'Scanned PDF — paste or type text here, then Save.';
  }

  updatePdfSaveBtnState(app);
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
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.dataset.saving = 'true';
  }
  if (spinner) spinner.style.display = 'inline-block';
  if (label) label.textContent = 'Saving…';

  try {
    const mode = getPdfSaveMode();
    const category = document.getElementById('pdfExtractCategory')?.value || 'Uncategorized';
    const fileName = document.getElementById('pdfFileName')?.textContent || 'PDF';

    let clipsToSave = [];

    if (mode === 'single') {
      const allText = app._pdfActiveTab === 'all' && hasMeaningfulPreviewText()
        ? stripPdfPageHeaders(getPdfPreviewText())
        : app._pdfPages.join('\n\n');
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
        return;
      }
      const pageText = hasMeaningfulPreviewText()
        ? getPdfPreviewText()
        : app._pdfPages[pageIdx];
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

      if (clipsToSave.length === 0 && hasMeaningfulPreviewText()) {
        clipsToSave.push({
          id: Date.now() + Math.random(),
          text: stripPdfPageHeaders(getPdfPreviewText()),
          category,
          timestamp: Date.now(),
          meta: { source: 'pdf', fileName }
        });
      }
    }

    if (clipsToSave.length === 0) {
      app.showToast('No text found in PDF to save. Edit the preview and try again.');
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
    if (saveBtn) saveBtn.dataset.saving = 'false';
    if (spinner) spinner.style.display = 'none';
    updatePdfSaveLabel(app);
    updatePdfSaveBtnState(app);
  }
}

export function closePdfModal(app) {
  const modal = document.getElementById('pdfExtractModal');
  if (modal) modal.style.display = 'none';
  setPdfScanNotice(false);
  app._pdfPages = [];
  app._pdfActiveTab = 'all';
  app._pdfIsScanned = false;
}
