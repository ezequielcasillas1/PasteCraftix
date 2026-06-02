/** Navigate to AI Lab summary tab with clip text prefilled. */

import { clearSummaryAiContext } from './ai-lab.session-state.js';

export function showSummaryModal(app, text) {
  const aiTab = document.querySelector('[data-tab="ai"]');
  const summarySubTab = document.querySelector('[data-ai-tab="summary"]');
  const summaryInput = document.getElementById('summaryInput');

  if (!aiTab || !summarySubTab || !summaryInput) return;

  document.querySelectorAll('.tab-btn').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach((t) => t.classList.remove('active'));
  aiTab.classList.add('active');
  document.getElementById('aiTab').classList.add('active');

  document.querySelectorAll('.ai-lab-tab').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('.ai-lab-section').forEach((s) => s.classList.remove('active'));
  summarySubTab.classList.add('active');
  document.getElementById('aiSummarySection').classList.add('active');

  clearSummaryAiContext(app);

  summaryInput.value = text;
  summaryInput.dispatchEvent(new Event('input'));
  summaryInput.scrollTop = 0;
  summaryInput.focus();

  const clipCount = (text.match(/\n\n---\n\n/g) || []).length + 1;
  if (clipCount > 1) {
    app.showToast(`${clipCount} clips added to summary (scroll to see all)`);
  }

  app.saveToAnalysisHistory(text, 'summary-initiated');

  app._saveSummaryState();
  app._currentAiLabSubTab = 'summary';
  app._saveActiveTabState();

  app.clearAllSelections();
}
