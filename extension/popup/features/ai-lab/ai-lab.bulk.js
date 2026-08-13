export function wireBulkAiButtons(app, config) {
  if (!config) return;
  const {
    summaryBtnId,
    sendCategoriesBtnId,
    sendNotesBtnId,
    breakdownBtnId,
    getText,
    getIdKeys,
    getClipObjects
  } = config;

  const summaryBtn = summaryBtnId ? document.getElementById(summaryBtnId) : null;
  if (summaryBtn && typeof getText === 'function') {
    summaryBtn.addEventListener('click', () => {
      const text = getText();
      if (text) app.showSummaryModal(text);
    });
  }

  const sendCategoriesBtn = sendCategoriesBtnId ? document.getElementById(sendCategoriesBtnId) : null;
  if (sendCategoriesBtn && typeof getIdKeys === 'function') {
    sendCategoriesBtn.addEventListener('click', () => {
      const ids = getIdKeys();
      if (!ids || ids.length === 0) return;
      app.pendingBulkClipIds = ids;
      app.pendingText = null;
      app.pendingClipId = null;
      app.showCategoryModal(true);
    });
  }

  const sendNotesBtn = sendNotesBtnId ? document.getElementById(sendNotesBtnId) : null;
  if (sendNotesBtn && typeof getClipObjects === 'function') {
    sendNotesBtn.addEventListener('click', async () => {
      const clips = getClipObjects();
      if (!clips || clips.length === 0) return;
      await app.queueClipsForNotes?.(clips);
    });
  }

  const breakdownBtn = breakdownBtnId ? document.getElementById(breakdownBtnId) : null;
  if (breakdownBtn && typeof getText === 'function') {
    breakdownBtn.addEventListener('click', () => {
      const text = getText();
      if (text) app.showBreakdownModal(text);
    });
  }
}
