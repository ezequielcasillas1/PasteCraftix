/** Local analysis history (breakdown/summary initiated), separate from AI conversation history. */

const STORAGE_KEY = 'analysisHistory';
const MAX_ENTRIES = 50;

export async function saveToAnalysisHistory(app, text, type, level = null, result = null) {
  const historyEntry = {
    id: Date.now(),
    text: text.substring(0, 500),
    type,
    level,
    result: result ? result.substring(0, 1000) : null,
    timestamp: Date.now(),
    source: app.currentTab,
  };

  const { [STORAGE_KEY]: analysisHistory = [] } = await chrome.storage.local.get([STORAGE_KEY]);
  analysisHistory.unshift(historyEntry);

  if (analysisHistory.length > MAX_ENTRIES) {
    analysisHistory.splice(MAX_ENTRIES);
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: analysisHistory });
  app.analysisHistory = analysisHistory;
}

export async function loadAnalysisHistory(app) {
  const { [STORAGE_KEY]: analysisHistory = [] } = await chrome.storage.local.get([STORAGE_KEY]);
  app.analysisHistory = analysisHistory;
  return analysisHistory;
}

export function renderAnalysisHistory(app) {
  const history = app.analysisHistory;

  if (!history?.length) {
    return `
        <div style="text-align: center; padding: 40px 20px; color: #9ca3af;">
          <p style="font-size: 48px; margin: 0 0 16px 0; line-height: 1;" aria-hidden="true">\u2014</p>
          <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #6b7280;">No Analysis History</h3>
          <p style="margin: 0; font-size: 14px;">Start analyzing clips to see your history here</p>
        </div>
      `;
  }

  return history.map((entry) => {
    const iconName = entry.type === 'breakdown' ? 'brain' : entry.type === 'summary' ? 'notebook-pen' : 'scroll-text';
    const timeAgo = app.getTimeAgo(entry.timestamp);
    const levelBadge = entry.level
      ? `<span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">${entry.level}</span>`
      : '';

    return `
        <div class="history-entry" style="padding: 16px; border-bottom: 1px solid #e5e7eb; cursor: pointer; transition: background 0.2s;" data-entry-id="${entry.id}">
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <span style="font-size: 24px;" aria-hidden="true"><i data-lucide="${iconName}"></i></span>
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="font-size: 13px; font-weight: 600; color: #1f2937; text-transform: capitalize;">${entry.type}</span>
                ${levelBadge}
                <span style="font-size: 12px; color: #9ca3af; margin-left: auto;">${timeAgo}</span>
              </div>
              <p style="margin: 0; font-size: 13px; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${app.escapeHtml(entry.text.substring(0, 100))}...</p>
            </div>
          </div>
        </div>
      `;
  }).join('');
}
