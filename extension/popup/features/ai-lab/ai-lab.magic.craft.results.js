// @forward-slice AI Lab magic — craft results modal + artifact
import { CRAFT_CLIPS_AI_MODES } from './ai-lab.craft-clips.constants.js';
import { _resolveRefactorSummaryLine } from './ai-lab.magic.refactor.js';

function _isRefactoringMode(stats) {
  return stats.craftAiMode === CRAFT_CLIPS_AI_MODES.REFACTORING;
}

function _setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function _setMagicStatTexts(stats) {
  _setText('magicStatCategorized', stats.categorized);
  _setText('magicStatEnhanced', stats.enhanced);
  _setText('magicStatAiFormatted', stats.aiFormatted || 0);
  _setText('magicStatAiRefactored', stats.aiRefactored || 0);
}

function _toggleMagicModeCards(isRefactoring) {
  const formattedCard = document.getElementById('magicStatFormattedCard');
  const refactoredCard = document.getElementById('magicStatRefactoredCard');
  if (formattedCard) formattedCard.classList.toggle('magic-stat-hidden', isRefactoring);
  if (refactoredCard) refactoredCard.classList.toggle('magic-stat-hidden', !isRefactoring);
}

function _setMagicDupeStat(stats) {
  const dupeArchived = stats.duplicatesArchived > 0;
  _setText('magicStatDupes', dupeArchived ? stats.duplicatesArchived : stats.duplicatesFound);
  const dupeLabel = document.getElementById('magicStatDupesLabel');
  if (!dupeLabel) return;
  dupeLabel.textContent = dupeArchived
    ? 'Dupes Archived'
    : (stats.duplicateHandling ? 'Dupes Found' : 'Dupes');
}

function _buildRefactorSummaryParts(stats) {
  const parts = [`AI Refactoring · ${stats.refactorLevel || 'college'} level`];
  if (stats.aiRefactored > 0) {
    parts.push(`Original clip kept; ${stats.aiRefactored} new refactored clip(s) added to recents.`);
  } else {
    parts.push(_resolveRefactorSummaryLine(stats));
  }
  return parts;
}

function _buildFormatSummaryParts(app, stats) {
  if (stats.aiFormatted > 0) {
    return ['AI Formatted · grammar fixes applied to clip text. Open the clip or AI History for before/after.'];
  }
  if (app._hasAiAccess()) {
    return ['AI Formatted · no accepted changes (identical, rejected as fluff, or AI call failed). Check console for [PasteCraft:ai-format].'];
  }
  return ['Rule-based cleanup and categorize only (premium for AI).'];
}

function _escapeHtml(app, value) {
  if (typeof app?.escapeHtml === 'function') return app.escapeHtml(value);
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _renderFormatCompareList(app, stats) {
  const wrap = document.getElementById('magicFormatCompare');
  const list = document.getElementById('magicFormatCompareList');
  if (!wrap || !list) return;

  const pairs = Array.isArray(stats.formatComparisons) ? stats.formatComparisons : [];
  const show = !_isRefactoringMode(stats) && pairs.length > 0;
  wrap.style.display = show ? 'block' : 'none';
  if (!show) {
    list.innerHTML = '';
    return;
  }

  list.innerHTML = pairs.map((pair, index) => `
    <div class="magic-format-compare-item">
      <div class="magic-format-compare-label">Clip ${index + 1}</div>
      <div class="refactor-history-stack">
        <section class="refactor-history-pane">
          <h4>Before</h4>
          <div class="refactor-history-text">${_escapeHtml(app, pair.before)}</div>
        </section>
        <section class="refactor-history-pane after">
          <h4>After</h4>
          <div class="refactor-history-text">${_escapeHtml(app, pair.after)}</div>
        </section>
      </div>
    </div>
  `).join('');
}

function _appendCategorySummaryParts(parts, stats) {
  if (stats.chosenCategory) {
    parts.push(`Category: "${stats.chosenCategory}".`);
  } else if (stats.aiCategorized) {
    parts.push('Categories used AI batch.');
  } else if (stats.needsCategoryPick) {
    parts.push('Category pick skipped — clips left uncategorized.');
  }
}

function _buildMagicResultsSummary(app, stats, isRefactoring) {
  const parts = isRefactoring
    ? _buildRefactorSummaryParts(stats)
    : _buildFormatSummaryParts(app, stats);
  _appendCategorySummaryParts(parts, stats);
  return parts.join(' ');
}

function _setMagicTypeBreakdown(app, stats) {
  const labels = app._magicTypeLabels();
  const typeBreakdown = Object.entries(stats.typesFound)
    .map(([type, count]) => `<span class="magic-type-tag">${app._escHtml(labels[type] || type)}: ${count}</span>`)
    .join(' ');
  const breakdownEl = document.getElementById('magicTypeBreakdown');
  if (!breakdownEl) return;
  breakdownEl.innerHTML = typeBreakdown || '<span class="magic-type-tag">No clips to analyze</span>';
}

export function _populateMagicResultsModal(app, stats) {
  const isRefactoring = _isRefactoringMode(stats);
  _setMagicStatTexts(stats);
  _toggleMagicModeCards(isRefactoring);
  _setMagicDupeStat(stats);

  const summaryEl = document.getElementById('magicResultsSummary');
  if (summaryEl) {
    summaryEl.textContent = _buildMagicResultsSummary(app, stats, isRefactoring);
  }
  _setMagicTypeBreakdown(app, stats);
  _renderFormatCompareList(app, stats);
}

function _buildCraftArtifactSummaryLines(stats, mode) {
  const isRefactor = mode === CRAFT_CLIPS_AI_MODES.REFACTORING;
  return [
    `Mode: ${isRefactor ? 'AI Refactorization' : 'AI Formatted'}`,
    `Categorized: ${stats.categorized || 0}`,
    `Cleanup: ${stats.enhanced || 0}`,
    `Duplicates Found: ${stats.duplicatesFound || 0}`,
    `Duplicates Archived: ${stats.duplicatesArchived || 0}`,
    `AI Formatted: ${stats.aiFormatted || 0}`,
    `AI Refactored: ${stats.aiRefactored || 0}`,
    stats.refactorLevel ? `Refactor Level: ${stats.refactorLevel}` : '',
    stats.chosenCategory ? `Chosen Category: ${stats.chosenCategory}` : '',
  ].filter(Boolean);
}

function _buildCraftArtifactMetadata(stats, mode) {
  return {
    mode,
    categorized: stats.categorized || 0,
    enhanced: stats.enhanced || 0,
    duplicatesFound: stats.duplicatesFound || 0,
    duplicatesArchived: stats.duplicatesArchived || 0,
    aiFormatted: stats.aiFormatted || 0,
    aiRefactored: stats.aiRefactored || 0,
    refactorLevel: stats.refactorLevel || '',
  };
}

export function _emitCraftArtifact(app, stats) {
  if (typeof app?.emitAiTaskOutput !== 'function') return;
  const mode = stats.craftAiMode || CRAFT_CLIPS_AI_MODES.FORMATTED;
  const isRefactor = mode === CRAFT_CLIPS_AI_MODES.REFACTORING;
  const title = isRefactor ? 'Craft Clips Refactorization Results' : 'Craft Clips Results';

  app.emitAiTaskOutput({
    source: 'ai-lab.craft',
    taskType: isRefactor ? 'refactorization' : 'craft',
    title,
    outputText: _buildCraftArtifactSummaryLines(stats, mode).join('\n'),
    metadata: _buildCraftArtifactMetadata(stats, mode),
  });
}

export function _showMagicResultsToastFallback(app, stats) {
  const parts = [];
  if (stats.categorized > 0) {
    parts.push(`${stats.categorized} categorized${stats.aiCategorized ? ' (AI)' : ''}`);
  }
  if (stats.enhanced > 0) {
    const aiSuffix = stats.aiFormatted > 0 ? ` (${stats.aiFormatted} AI formatted)` : '';
    parts.push(`${stats.enhanced} enhanced${aiSuffix}`);
  }
  if (stats.duplicatesArchived > 0) parts.push(`${stats.duplicatesArchived} dupes archived`);
  else if (stats.duplicatesFound > 0) parts.push(`${stats.duplicatesFound} dupes found`);
  if (stats.aiRefactored > 0) parts.push(`${stats.aiRefactored} refactored`);
  app.showToast(parts.length ? `✨ ${parts.join(', ')}` : '✨ Clips already organized!');
}

export function _showMagicResults(stats) {
  const app = this;
  const modal = document.getElementById('magicResultsModal');
  if (!modal) {
    _showMagicResultsToastFallback(app, stats);
    return;
  }
  _populateMagicResultsModal(app, stats);
  _emitCraftArtifact(app, stats);
  modal.style.display = 'flex';
  window.renderLucideIcons?.(modal);
}
