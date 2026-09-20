/** Click a [n] citation marker to jump to its source card. */

const CITE_SCOPE = '#summaryResultContent, #aiHistoryResultContent, #aiHistoryModal, #aiSummarySection';

export function handleAiCitationClick(event) {
  const btn = event.target?.closest?.('[data-action="ai-cite"]');
  if (!btn) return;
  event.preventDefault();
  const n = String(btn.getAttribute('data-cite') || '').trim();
  if (!n) return;
  const scope = btn.closest(CITE_SCOPE) || document;
  const card = scope.querySelector(`[data-cite-card="${n}"]`);
  if (!card) return;
  card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  card.classList.add('pc-ai-source-card--flash');
  window.setTimeout(() => card.classList.remove('pc-ai-source-card--flash'), 1600);
}
