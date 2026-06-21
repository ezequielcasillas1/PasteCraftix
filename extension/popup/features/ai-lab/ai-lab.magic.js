// ─── AI Lab: Craft Clips (formerly Magic Wand) ───
import {
  CRAFT_CLIPS_AI_MODES,
  CRAFT_CLIP_ACTIONS,
  CRAFT_CATEGORY_SUGGESTION_COUNT,
} from './ai-lab.craft-clips.constants.js';
import {
  loadCraftClipsSettings,
  saveCraftClipsSettings,
  resolveRefactorEdgeLevel,
  syncCraftClipsSettingsToUi,
} from './ai-lab.craft-clips.settings.js';
import { openCraftCategoryPickModal } from './ai-lab.craft-clips.category-pick.js';
import { createCategory } from '../categories/categories.service.js';
import { getClipIdKey } from '../clips/clips.state.js';
import { deleteClipsByIdKeys } from '../clips/clips.service.js';
import { AI_STORAGE_KEYS } from './ai-lab.constants.js';
import { isOutOfCreditsError } from './ai-lab.credit-error.js';
import { REFACTOR_TEXT_CREDIT_COST } from './ai-lab.credits.js';

// ────────────────────────────────────────────────────────────
// Public entry: open Craft Clips preview modal
// ────────────────────────────────────────────────────────────

export async function magicFormat() {
  const app = this;
  _animateMagicWand();

  app._craftClipsSettings = await loadCraftClipsSettings();
  syncCraftClipsSettingsToUi(app._craftClipsSettings);

  app._magicAnalysis = app._analyzeMagicClips();
  app._magicSelected = new Set();
  app._magicPage = 0;

  _toggleMagicAiCreditNotice(app);

  app._renderMagicPage(0);
  app._renderMagicPagination();
  app._updateMagicSelectedCount();

  const modal = document.getElementById('magicPreviewModal');
  if (modal) modal.style.display = 'flex';
}

function _animateMagicWand() {
  const wand = document.getElementById('magicWand');
  if (!wand) return;
  wand.style.transform = 'scale(1.2) rotate(360deg)';
  setTimeout(() => { wand.style.transform = ''; }, 500);
}

function _toggleMagicAiCreditNotice(app) {
  const notice = document.getElementById('magicAiCreditNotice');
  if (!notice) return;
  if (!app._hasAiAccess()) {
    notice.style.display = 'none';
    return;
  }
  const settings = app._craftClipsSettings || {};
  const modeLabel = settings.aiMode === CRAFT_CLIPS_AI_MODES.REFACTORING
    ? 'AI Refactoring'
    : 'AI Formatted';
  notice.textContent = `💎 Premium · ~25 credits per batch · ${modeLabel} (one AI mode per craft)`;
  notice.style.display = 'block';
}

// ────────────────────────────────────────────────────────────
// Static lookup tables
// ────────────────────────────────────────────────────────────

export function _magicTypeLabels() {
  return {
    url: '🔗 Link', email: '📧 Email', phone: '📞 Phone', note: '📝 Note', text: '⚡ Text',
    code: '💻 Code', json: '📊 JSON', yaml: '📊 YAML', toml: '📊 TOML', xml: '📊 XML', csv: '📊 CSV', tsv: '📊 TSV',
    markdown: '📄 MD', html: '📄 HTML', latex: '📄 LaTeX', bbcode: '📄 BBCode',
    asciidoc: '📄 ADoc', rst: '📄 rST', orgmode: '📄 Org', mediawiki: '📄 Wiki',
    textile: '📄 Textile', jira: '📄 JIRA', slack: '📄 Slack', mermaid: '📐 Diagram',
  };
}

export function _skipAiFormatTypes() {
  return new Set(['url', 'email', 'phone', 'code', 'json', 'yaml', 'toml', 'xml', 'csv', 'tsv', 'html', 'latex', 'mermaid']);
}

const CATEGORY_SUGGESTION_MAP = {
  url:       { name: 'Links', icon: '🔗' },
  email:     { name: 'Contacts', icon: '📧' },
  phone:     { name: 'Contacts', icon: '📧' },
  note:      { name: 'Notes', icon: '📝' },
  text:      { name: 'Quick', icon: '⚡' },
  code:      { name: 'Code', icon: '💻' },
  json:      { name: 'Data', icon: '📊' },
  yaml:      { name: 'Data', icon: '📊' },
  toml:      { name: 'Data', icon: '📊' },
  xml:       { name: 'Data', icon: '📊' },
  csv:       { name: 'Data', icon: '📊' },
  tsv:       { name: 'Data', icon: '📊' },
  markdown:  { name: 'Markup', icon: '📄' },
  html:      { name: 'Markup', icon: '📄' },
  latex:     { name: 'Markup', icon: '📄' },
  bbcode:    { name: 'Markup', icon: '📄' },
  asciidoc:  { name: 'Markup', icon: '📄' },
  rst:       { name: 'Markup', icon: '📄' },
  orgmode:   { name: 'Markup', icon: '📄' },
  mediawiki: { name: 'Markup', icon: '📄' },
  textile:   { name: 'Markup', icon: '📄' },
  jira:      { name: 'Markup', icon: '📄' },
  slack:     { name: 'Markup', icon: '📄' },
  mermaid:   { name: 'Diagrams', icon: '📐' },
};

export function _suggestCategory(contentType) {
  return CATEGORY_SUGGESTION_MAP[contentType] || CATEGORY_SUGGESTION_MAP.text;
}

// ────────────────────────────────────────────────────────────
// Content type detection (decomposed from cc=14)
// ────────────────────────────────────────────────────────────

export function _detectContentType(text, meta) {
  if (!text || typeof text !== 'string') return 'text';
  const trimmed = text.trim();

  const simpleType = _detectSimpleContentType(trimmed);
  if (simpleType) return simpleType;

  const markupType = _detectMarkupContentType(trimmed, meta);
  if (markupType) return markupType;

  return _detectFallbackContentType(trimmed);
}

function _detectSimpleContentType(trimmed) {
  if (/^https?:\/\/\S+$/i.test(trimmed) || /^www\.\S+\.\S+/i.test(trimmed)) return 'url';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'email';
  if (/^[\+]?[\d\s\-\(\)\.]{7,20}$/.test(trimmed) && /\d{3,}/.test(trimmed)) return 'phone';
  return null;
}

function _detectMarkupContentType(trimmed, meta) {
  if (!window.PCMarkup || typeof window.PCMarkup.detectMarkupType !== 'function') return null;
  const markupType = window.PCMarkup.detectMarkupType(trimmed, meta);
  if (markupType && markupType !== 'text') return markupType;
  return null;
}

function _detectFallbackContentType(trimmed) {
  if (trimmed.split('\n').length > 3 || trimmed.length > 300) return 'note';
  return 'text';
}

// ────────────────────────────────────────────────────────────
// Content enhancement (decomposed from cc=24)
// ────────────────────────────────────────────────────────────

export function _enhanceContent(text, contentType) {
  if (!text) return text;
  const cleaned = _normalizeWhitespace(text);
  return _applyTypeEnhancement(cleaned, contentType);
}

function _normalizeWhitespace(text) {
  let result = text.replace(/\r\n/g, '\n');
  result = result.replace(/\n{4,}/g, '\n\n\n');
  result = result.replace(/[ \t]+$/gm, '');
  return result.trim();
}

function _enhanceUrl(text) {
  try {
    const url = new URL(text);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid']
      .forEach(p => url.searchParams.delete(p));
    return url.toString();
  } catch (_) {
    return text;
  }
}

function _enhanceJson(text) {
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch (_) { return text; }
}

function _enhanceXml(text) {
  return text.replace(/\s*\/>/g, ' />');
}

function _enhanceYamlToml(text) {
  return text.endsWith('\n') ? text : text + '\n';
}

function _enhanceCsvTsv(text) {
  return text.split('\n').filter(l => l.trim()).join('\n');
}

function _enhanceEmail(text) {
  return text.toLowerCase().trim();
}

const TYPE_ENHANCERS = {
  url: _enhanceUrl,
  json: _enhanceJson,
  xml: _enhanceXml,
  yaml: _enhanceYamlToml,
  toml: _enhanceYamlToml,
  csv: _enhanceCsvTsv,
  tsv: _enhanceCsvTsv,
  email: _enhanceEmail,
};

function _applyTypeEnhancement(text, contentType) {
  const enhancer = TYPE_ENHANCERS[contentType];
  return enhancer ? enhancer(text) : text;
}

// ────────────────────────────────────────────────────────────
// Analyze clips for Magic preview (decomposed from cc=19)
// ────────────────────────────────────────────────────────────

export function _analyzeMagicClips() {
  const app = this;
  const dupMap = _buildDuplicateTextMap(app.clips);
  return app.clips.map(clip => _analyzeOneMagicClip(app, clip, dupMap));
}

function _buildDuplicateTextMap(clips) {
  const dupMap = new Map();
  for (const clip of clips) {
    const key = (clip.text || '').trim().toLowerCase();
    if (!key) continue;
    dupMap.set(key, (dupMap.get(key) || 0) + 1);
  }
  return dupMap;
}

function _analyzeOneMagicClip(app, clip, dupMap) {
  const contentType = app._detectContentType(clip.text, clip.meta);
  const actions = _buildCraftClipActions(app, clip, contentType, dupMap);
  return { clip, contentType, actions };
}

function _getCraftClipsSettings(app) {
  return app._craftClipsSettings || { smartCategorize: true, duplicateHandling: false, aiMode: CRAFT_CLIPS_AI_MODES.FORMATTED, refactorLevel: 'college' };
}

function _buildCraftClipActions(app, clip, contentType, dupMap) {
  const settings = _getCraftClipsSettings(app);
  const actions = [];
  const skipTypes = app._skipAiFormatTypes();
  const trimmedLen = (clip.text || '').trim().length;
  const hasAi = app._hasAiAccess();

  if (settings.smartCategorize && (!clip.category || clip.category === 'Uncategorized')) {
    actions.push({
      kind: CRAFT_CLIP_ACTIONS.CATEGORIZE,
      label: hasAi ? 'Categorize (AI)' : 'Categorize',
      active: true,
    });
  }

  if (hasAi && trimmedLen > 5 && !skipTypes.has(contentType)) {
    if (settings.aiMode === CRAFT_CLIPS_AI_MODES.REFACTORING) {
      actions.push({
        kind: CRAFT_CLIP_ACTIONS.REFACTOR,
        label: `Refactor (${settings.refactorLevel})`,
        active: true,
      });
    } else {
      actions.push({ kind: CRAFT_CLIP_ACTIONS.FORMAT, label: 'AI Formatted', active: true });
    }
  }

  const enhanced = app._enhanceContent(clip.text, contentType);
  if (enhanced !== clip.text) {
    actions.push({ kind: CRAFT_CLIP_ACTIONS.CLEANUP, label: 'Cleanup', active: true });
  }

  const key = (clip.text || '').trim().toLowerCase();
  if (settings.duplicateHandling && _isDuplicateKey(key, dupMap)) {
    actions.push({ kind: CRAFT_CLIP_ACTIONS.DEDUPE, label: 'Archive duplicate', active: true });
  } else if (_isDuplicateKey(key, dupMap)) {
    actions.push({ kind: CRAFT_CLIP_ACTIONS.DEDUPE, label: 'Duplicate', active: false });
  }

  if (clip.meta?.craftRefactorSourceId) {
    actions.push({ kind: CRAFT_CLIP_ACTIONS.REFACTOR, label: 'Refactored copy', active: false });
  }

  if (actions.length === 0) {
    actions.push({ kind: 'clean', label: 'Already clean', active: false });
  }
  return actions;
}

function _isDuplicateKey(key, dupMap) {
  if (!key) return false;
  return (dupMap.get(key) || 0) > 1;
}

// ────────────────────────────────────────────────────────────
// Magic preview modal: render page (decomposed from cc=9)
// ────────────────────────────────────────────────────────────

export function _renderMagicPage(page) {
  const app = this;
  app._magicPage = page;
  const perPage = 10;
  const start = page * perPage;
  const end = Math.min(start + perPage, app._magicAnalysis.length);
  const pageItems = app._magicAnalysis.slice(start, end);
  const labels = app._magicTypeLabels();
  const container = document.getElementById('magicClipList');
  if (!container) return;

  if (app._magicAnalysis.length === 0) {
    container.innerHTML = '<div class="magic-clip-empty">No clips to analyze</div>';
    return;
  }

  container.innerHTML = pageItems
    .map((item, idx) => _buildMagicRowHtml(app, item, start + idx, labels))
    .join('');
  _attachMagicRowHandlers(app, container);
}

function _buildMagicRowHtml(app, item, globalIdx, labels) {
  const clipId = String(item.clip.id);
  const isSelected = app._magicSelected.has(clipId);
  const preview = _buildMagicPreviewText(item.clip.text);
  const typeBadge = app._escHtml(labels[item.contentType] || item.contentType);
  const actionCards = (item.actions || []).map(a => _buildCraftActionCardHtml(app, a)).join('');
  return `
    <div class="magic-clip-row craft-clip-card ${isSelected ? 'magic-clip-selected' : ''}" data-magic-idx="${globalIdx}" data-clip-id="${clipId}">
      <input type="checkbox" class="magic-clip-check" ${isSelected ? 'checked' : ''}>
      <div class="magic-clip-info">
        <div class="magic-clip-text">${app._escHtml(preview)}</div>
        <div class="magic-clip-meta">
          <span class="magic-type-badge">${typeBadge}</span>
        </div>
        <div class="craft-action-cards">${actionCards}</div>
      </div>
    </div>`;
}

function _buildCraftActionCardHtml(app, action) {
  const kind = String(action.kind || 'neutral').replace(/[^a-z0-9_-]/gi, '') || 'neutral';
  const inactive = action.active === false ? ' craft-action-inactive' : '';
  return `<span class="craft-action-card craft-action-${kind}${inactive}">${app._escHtml(action.label || '')}</span>`;
}

function _buildMagicPreviewText(text) {
  const flat = (text || '').replace(/\n/g, ' ');
  const truncated = flat.slice(0, 80);
  return truncated + ((text || '').length > 80 ? '…' : '');
}

function _buildMagicIssueTagHtml(app, issue) {
  const safeColor = String(issue.color || 'neutral').replace(/[^a-z0-9_-]/gi, '') || 'neutral';
  const detailHtml = issue.detail ? ' ' + app._escHtml(issue.detail) : '';
  return `<span class="magic-issue-tag magic-issue-${safeColor}">${app._escHtml(issue.tag)}${detailHtml}</span>`;
}

function _attachMagicRowHandlers(app, container) {
  container.querySelectorAll('.magic-clip-row').forEach(row => {
    row.addEventListener('click', () => _toggleMagicRowSelection(app, row));
  });
}

function _toggleMagicRowSelection(app, row) {
  const clipId = row.dataset.clipId;
  if (app._magicSelected.has(clipId)) {
    _deselectMagicRow(app, row, clipId);
  } else {
    _selectMagicRow(app, row, clipId);
  }
  app._updateMagicSelectedCount();
}

function _selectMagicRow(app, row, clipId) {
  app._magicSelected.add(clipId);
  row.classList.add('magic-clip-selected');
  _setMagicRowChecked(row, true);
}

function _deselectMagicRow(app, row, clipId) {
  app._magicSelected.delete(clipId);
  row.classList.remove('magic-clip-selected');
  _setMagicRowChecked(row, false);
}

function _setMagicRowChecked(row, checked) {
  const checkbox = row.querySelector('.magic-clip-check');
  if (checkbox) checkbox.checked = checked;
}

// ────────────────────────────────────────────────────────────
// Pagination (decomposed from cc=13)
// ────────────────────────────────────────────────────────────

export function _renderMagicPagination() {
  const app = this;
  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(app._magicAnalysis.length / perPage));
  const container = document.getElementById('magicPagination');
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = _buildMagicPaginationHtml(totalPages, app._magicPage);
  _attachMagicPaginationHandlers(app, container, totalPages);
}

function _buildMagicPaginationHtml(totalPages, currentPage) {
  let html = _buildMagicPrevButton(currentPage);
  for (let i = 0; i < totalPages; i++) {
    html += _buildMagicPageButtonOrDots(i, currentPage, totalPages);
  }
  html += _buildMagicNextButton(currentPage, totalPages);
  return html;
}

function _buildMagicPrevButton(currentPage) {
  const disabled = currentPage === 0 ? 'disabled' : '';
  return `<button class="magic-page-btn" data-magic-page="${currentPage - 1}" ${disabled}>‹</button>`;
}

function _buildMagicNextButton(currentPage, totalPages) {
  const disabled = currentPage >= totalPages - 1 ? 'disabled' : '';
  return `<button class="magic-page-btn" data-magic-page="${currentPage + 1}" ${disabled}>›</button>`;
}

function _buildMagicPageButtonOrDots(i, currentPage, totalPages) {
  if (_isVisibleMagicPage(i, currentPage, totalPages)) {
    return _buildMagicVisiblePageButton(i, currentPage);
  }
  return _buildMagicEllipsisIfNeeded(i, currentPage, totalPages);
}

function _isVisibleMagicPage(i, currentPage, totalPages) {
  return i === 0 || i === totalPages - 1 || Math.abs(i - currentPage) <= 2;
}

function _buildMagicVisiblePageButton(i, currentPage) {
  const active = i === currentPage ? 'active' : '';
  return `<button class="magic-page-btn ${active}" data-magic-page="${i}">${i + 1}</button>`;
}

function _buildMagicEllipsisIfNeeded(i, currentPage, totalPages) {
  if (i === 1 && currentPage > 3) return '<span class="magic-page-dots">…</span>';
  if (i === totalPages - 2 && currentPage < totalPages - 4) return '<span class="magic-page-dots">…</span>';
  return '';
}

function _attachMagicPaginationHandlers(app, container, totalPages) {
  container.querySelectorAll('.magic-page-btn').forEach(btn => {
    btn.addEventListener('click', () => _handleMagicPageClick(app, btn, totalPages));
  });
}

function _handleMagicPageClick(app, btn, totalPages) {
  const p = parseInt(btn.dataset.magicPage);
  if (!_isValidMagicPageIndex(p, totalPages)) return;
  app._renderMagicPage(p);
  app._renderMagicPagination();
}

function _isValidMagicPageIndex(p, totalPages) {
  return !isNaN(p) && p >= 0 && p < totalPages;
}

// ────────────────────────────────────────────────────────────
// Selected count + tiny helpers
// ────────────────────────────────────────────────────────────

export function _updateMagicSelectedCount() {
  const app = this;
  const countEl = document.getElementById('magicSelectedCount');
  if (countEl) countEl.textContent = `${app._magicSelected.size} selected`;
  const craftBtn = document.getElementById('magicCraftSelectedBtn');
  if (craftBtn) craftBtn.disabled = app._magicSelected.size === 0;
}

export function _escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ────────────────────────────────────────────────────────────
// _craftMagic — decomposed from cc=63 brain method
// ────────────────────────────────────────────────────────────

export async function _craftMagic(clipIds) {
  const app = this;
  app._craftClipsSettings = app._craftClipsSettings || await loadCraftClipsSettings();
  const settings = _getCraftClipsSettings(app);
  const targetSet = new Set(clipIds.map(String));
  const stats = _initMagicStats();
  const categoryQueue = new Map();

  const clipTypeMap = _buildClipTypeMap(app, targetSet);
  const uncategorizedTargets = settings.smartCategorize
    ? _collectUncategorizedTargets(app, targetSet)
    : [];
  const skipTypes = app._skipAiFormatTypes();
  let aiEligibleTargets = _collectAiEligibleTargets(app, targetSet, clipTypeMap, skipTypes);
  if (settings.aiMode === CRAFT_CLIPS_AI_MODES.REFACTORING) {
    aiEligibleTargets = _normalizeRefactorEligibleTargets(app, aiEligibleTargets);
  }
  const hasAi = app._hasAiAccess();
  const deferCategoryPick = settings.smartCategorize
    && hasAi
    && uncategorizedTargets.length > 0;

  let aiCategoryMap = new Map();
  let aiFormatMap = new Map();
  let aiRefactorMap = new Map();
  let refactorDiagnostics = new Map();
  let refactorPipeline = null;

  if (settings.smartCategorize && !deferCategoryPick) {
    aiCategoryMap = await _runAiCategorization(uncategorizedTargets, hasAi, stats);
  }

  if (hasAi && aiEligibleTargets.length > 0) {
    if (settings.aiMode === CRAFT_CLIPS_AI_MODES.REFACTORING) {
      const edgeLevel = resolveRefactorEdgeLevel(settings.refactorLevel);
      if (!app._hasTextCreditsForRefactor()) {
        stats.refactorError = 'Need more AI credits';
        stats.refactorPipeline = {
          eligible: aiEligibleTargets.length,
          aiResultCount: 0,
          mapSize: 0,
          siblingsCreated: 0,
          skipped: aiEligibleTargets.map((target) => ({
            clipId: String(target.id),
            outcome: 'no_credits',
            reason: 'insufficient_text_credits',
          })),
          blockedBeforeCall: true,
        };
        console.warn('[PasteCraft:refactor]', {
          ...stats.refactorPipeline,
          reason: 'blocked_no_credits',
          refactorCost: REFACTOR_TEXT_CREDIT_COST,
        });
      } else {
        const refactorResult = await _runAiRefactoring(aiEligibleTargets, edgeLevel, stats);
        aiRefactorMap = refactorResult.map;
        refactorDiagnostics = refactorResult.diagnostics;
        refactorPipeline = refactorResult.pipeline;
      }
    } else {
      aiFormatMap = await _runAiFormatting(aiEligibleTargets, hasAi);
    }
  } else if (settings.aiMode === CRAFT_CLIPS_AI_MODES.REFACTORING) {
    console.warn('[PasteCraft:refactor]', {
      eligible: aiEligibleTargets.length,
      hasAi,
      reason: !hasAi ? 'no_ai_access' : 'no_eligible_clips',
    });
  }

  const ctx = {
    targetSet,
    clipTypeMap,
    aiCategoryMap,
    aiFormatMap,
    aiRefactorMap,
    refactorDiagnostics,
    refactorNewClips: [],
    queue: categoryQueue,
    stats,
    settings,
    deferCategoryPick,
  };
  _processMagicTargetClips(app, ctx);
  await _insertRefactoredSiblingClips(app, ctx, targetSet);

  if (refactorPipeline) {
    refactorPipeline.siblingsCreated = (ctx.refactorNewClips || []).length;
    stats.refactorPipeline = refactorPipeline;
    console.warn('[PasteCraft:refactor]', {
      ...refactorPipeline,
      statsAiRefactored: stats.aiRefactored,
    });
  }

  if (settings.duplicateHandling) {
    _archiveYoungerDuplicates(app, targetSet, stats);
  } else {
    _detectMagicDuplicates(app, targetSet, stats);
  }

  await _createMissingMagicCategories(app, categoryQueue);
  _assignPendingMagicCategories(app, stats);

  _promoteCraftedClipsToRecents(app, targetSet, stats);

  await _saveMagicState(app, {
    uiUpdater: () => _refreshMagicCreditsAndUi(app, stats),
    syncToCloud: true,
  });

  if (settings.aiMode === CRAFT_CLIPS_AI_MODES.REFACTORING
    && ((ctx.refactorNewClips || []).length > 0 || (ctx.refactorDiagnostics && ctx.refactorDiagnostics.size > 0))) {
    await _saveCraftRefactorHistory(app, ctx);
  }

  if (settings.aiMode === CRAFT_CLIPS_AI_MODES.REFACTORING) {
    await ensureRefactorRegistryReady(app);
  }

  stats.craftAiMode = settings.aiMode;
  stats.refactorLevel = settings.refactorLevel;
  stats.duplicateHandling = settings.duplicateHandling;

  if (deferCategoryPick) {
    stats.needsCategoryPick = true;
    stats.pendingCategoryClipIds = uncategorizedTargets.map((c) => String(c.id));
    stats.categorySuggestions = await _fetchCategorySuggestions(app, uncategorizedTargets, hasAi);
  }

  return stats;
}

function _initMagicStats() {
  return {
    categorized: 0,
    enhanced: 0,
    duplicatesFound: 0,
    duplicatesArchived: 0,
    typesFound: {},
    aiCategorized: false,
    aiFormatted: 0,
    aiRefactored: 0,
    craftAiMode: CRAFT_CLIPS_AI_MODES.FORMATTED,
    refactorLevel: 'college',
    duplicateHandling: false,
  };
}

function _buildClipTypeMap(app, targetSet) {
  const map = new Map();
  for (const clip of app.clips) {
    if (!targetSet.has(String(clip.id))) continue;
    map.set(String(clip.id), app._detectContentType(clip.text, clip.meta));
  }
  return map;
}

function _collectUncategorizedTargets(app, targetSet) {
  const out = [];
  for (const clip of app.clips) {
    if (!targetSet.has(String(clip.id))) continue;
    if (!clip.category || clip.category === 'Uncategorized') out.push(clip);
  }
  return out;
}

function _collectAiEligibleTargets(app, targetSet, clipTypeMap, skipTypes) {
  const out = [];
  for (const clip of app.clips) {
    if (!targetSet.has(String(clip.id))) continue;
    const ct = clipTypeMap.get(String(clip.id));
    const trimmedLen = (clip.text || '').trim().length;
    if (!skipTypes.has(ct) && trimmedLen > 5) out.push(clip);
  }
  return out;
}

function _resolveRefactorSourceClip(app, clip) {
  const linkedSourceId = clip?.meta?.craftRefactorSourceId;
  if (linkedSourceId == null || linkedSourceId === '') return clip;
  const sourceKey = getClipIdKey(linkedSourceId);
  if (sourceKey === getClipIdKey(clip?.id)) return clip;
  const original = app.clips.find((candidate) => getClipIdKey(candidate.id) === sourceKey);
  if (original) return original;
  const storedText = String(clip?.meta?.craftRefactorSourceText || '').trim();
  if (storedText) {
    return { id: linkedSourceId, text: storedText, meta: {}, category: clip.category };
  }
  return clip;
}

function _normalizeRefactorEligibleTargets(app, targets) {
  const seen = new Set();
  const out = [];
  for (const clip of targets) {
    const sourceClip = _resolveRefactorSourceClip(app, clip);
    const key = getClipIdKey(sourceClip.id);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(sourceClip);
  }
  return out;
}

async function _fetchCategorySuggestions(app, targets, hasAi) {
  if (targets.length === 0) return [];
  if (hasAi) {
    try {
      const ai = await pasteCraftSupabase.aiCategorizeSuggestions(targets);
      const custom = _normalizeAiCategorySuggestions(ai);
      if (custom.length > 0) return custom;
      const customFromSummary = await _fetchCategorySuggestionsFromSummaryAi(targets);
      if (customFromSummary.length > 0) return customFromSummary;
    } catch (e) {
      console.error('AI category suggestion flow failed:', e);
    }
  }
  return _fallbackCategorySuggestions(app, targets);
}

function _normalizeAiCategorySuggestions(raw) {
  const generic = new Set([
    'quick notes', 'links', 'work', 'personal', 'reference', 'quick', 'notes',
    'contacts', 'code', 'data', 'markup', 'diagrams', 'uncategorized', 'general',
  ]);
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const name = String(item || '').trim();
    if (!name || generic.has(name.toLowerCase())) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= CRAFT_CATEGORY_SUGGESTION_COUNT) break;
  }
  return out;
}

async function _fetchCategorySuggestionsFromSummaryAi(targets) {
  if (!Array.isArray(targets) || targets.length === 0) return [];
  try {
    const source = targets
      .slice(0, 12)
      .map((clip, idx) => {
        const hint = _clipSourceHint(clip);
        const text = String(clip?.text || '').trim().slice(0, 260);
        return hint
          ? `Snippet ${idx + 1}: ${text} [source:${hint}]`
          : `Snippet ${idx + 1}: ${text}`;
      })
      .join('\n');
    const prompt =
      'Return up to 5 custom clipboard category titles that match these snippets. ' +
      'If a source hint appears like [source:example.com], use it as context. ' +
      'If source/topic hints suggest Bible content, prefer canonical book-level titles like Psalms/Proverbs/Romans. ' +
      'For wiki/docs/information sites, prefer topic-specific titles from snippet and source/topic hints. ' +
      'Use specific topical names (not generic words like Work, Personal, Links, Quick, Reference). ' +
      'Output titles only, one per line, no numbering.';
    const summary = await pasteCraftSupabase.generateSummary(source, prompt);
    return _normalizeAiCategorySuggestions(_parseTitleLines(summary));
  } catch (e) {
    console.error('Summary AI category fallback failed:', e);
    return [];
  }
}

function _parseTitleLines(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];
  return text
    .split(/\r?\n|[|•]/g)
    .map((line) => String(line || '').replace(/^\s*(?:[-*]|\d+[\).\s])\s*/, '').trim())
    .filter(Boolean);
}

function _clipSourceHint(clip) {
  const meta = clip && typeof clip.meta === 'object' ? clip.meta : {};
  const fromMeta = String(meta.sourcePageUrl || meta.url || '').trim();
  const fromClip = String(clip?.sourcePageUrl || clip?.url || '').trim();
  const raw = fromMeta || fromClip;
  if (!raw) return '';
  try {
    return String(new URL(raw).hostname || '').toLowerCase().slice(0, 80);
  } catch (_) {
    return raw.slice(0, 80).toLowerCase();
  }
}

function _fallbackCategorySuggestions(app, targets) {
  const names = [];
  const seen = new Set();
  for (const clip of targets) {
    const contentType = app._detectContentType(clip.text, clip.meta);
    const name = app._suggestCategory(contentType).name;
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      names.push(name);
    }
  }
  const pads = ['Quick Notes', 'Links', 'Work', 'Personal', 'Reference'];
  for (const p of pads) {
    if (names.length >= CRAFT_CATEGORY_SUGGESTION_COUNT) break;
    if (!seen.has(p.toLowerCase())) {
      names.push(p);
      seen.add(p.toLowerCase());
    }
  }
  return names.slice(0, CRAFT_CATEGORY_SUGGESTION_COUNT);
}

async function _runAiCategorization(targets, hasAi, stats) {
  const map = new Map();
  if (targets.length === 0 || !hasAi) return map;
  try {
    const aiResults = await pasteCraftSupabase.aiCategorize(targets);
    if (Array.isArray(aiResults) && aiResults.length > 0) {
      _populateAiCategoryMap(map, targets, aiResults);
      stats.aiCategorized = true;
    }
  } catch (_) { /* AI failed — fall back to rule-based */ }
  return map;
}

function _populateAiCategoryMap(map, targets, aiResults) {
  const len = Math.min(targets.length, aiResults.length);
  for (let i = 0; i < len; i++) {
    const catName = String(aiResults[i] || '').trim();
    if (catName) map.set(String(targets[i].id), catName);
  }
}

async function _runAiFormatting(targets, hasAi) {
  const map = new Map();
  if (targets.length === 0 || !hasAi) return map;
  try {
    const aiResults = await pasteCraftSupabase.aiFormat(targets);
    if (Array.isArray(aiResults) && aiResults.length > 0) {
      _populateAiFormatMap(map, targets, aiResults);
    }
  } catch (_) { /* AI failed — fall back to rule-based enhance */ }
  return map;
}

async function _runAiRefactoring(targets, edgeLevel, stats) {
  const map = new Map();
  const diagnostics = new Map();
  const pipeline = {
    eligible: targets.length,
    aiResultCount: 0,
    mapSize: 0,
    siblingsCreated: 0,
    skipped: [],
  };

  if (targets.length === 0) {
    console.warn('[PasteCraft:refactor]', { ...pipeline, reason: 'no_eligible_targets' });
    return { map, diagnostics, pipeline };
  }

  try {
    const result = await pasteCraftSupabase.aiRefactor(targets, edgeLevel);
    const aiResults = Array.isArray(result?.refactored) ? result.refactored : [];
    const diagList = Array.isArray(result?.diagnostics) ? result.diagnostics : [];
    pipeline.aiResultCount = aiResults.length;

    if (aiResults.length > 0) {
      _populateAiRefactorMap(map, targets, aiResults);
    }
    pipeline.mapSize = map.size;

    targets.forEach((target, i) => {
      const clipId = String(target.id);
      const diag = diagList[i] || diagList.find((d) => d?.index === i) || null;
      if (diag) diagnostics.set(clipId, diag);

      if (map.has(clipId)) return;

      const original = (target.text || '').trim();
      const returned = String(aiResults[i] || '').trim();
      const outcome = diag?.outcome || (returned && returned !== original ? 'unknown' : 'unchanged');
      pipeline.skipped.push({
        clipId,
        outcome,
        reason: diag?.reasons?.[0] || (returned === original ? 'identical_text' : 'not_in_map'),
        reasons: Array.isArray(diag?.reasons) ? diag.reasons : undefined,
        synthesis: diag?.synthesis || '',
        originalLen: original.length,
        refactoredLen: returned.length,
        originalPreview: _textPreview(original),
        refactoredPreview: _textPreview(returned),
        level: diag?.level || edgeLevel,
      });
    });

    if (aiResults.length === 0) {
      pipeline.skipped.push({ outcome: 'empty_response', reason: 'edge_returned_no_refactored_array' });
    }
  } catch (err) {
    const msg = String(err?.message || 'AI refactor request failed');
    stats.refactorError = msg;
    pipeline.error = msg;
    const creditBlocked = isOutOfCreditsError(err) || /need more ai credits/i.test(msg);
    targets.forEach((target) => {
      diagnostics.set(String(target.id), {
        outcome: creditBlocked ? 'no_credits' : 'failed',
        reasons: [msg],
        synthesis: creditBlocked
          ? 'Not enough AI text credits for this refactor batch.'
          : msg.includes('fetch') || msg.includes('network')
            ? 'Network error — check connection and Supabase reachability, then try again.'
            : 'The refactor request failed before the model could rewrite this clip.',
        level: edgeLevel,
      });
      if (creditBlocked) {
        pipeline.skipped.push({
          clipId: String(target.id),
          outcome: 'no_credits',
          reason: 'insufficient_text_credits',
        });
      }
    });
    console.warn('[PasteCraft:refactor]', {
      ...pipeline,
      reason: creditBlocked ? 'no_credits' : 'request_failed',
      skipSummaries: pipeline.skipped.map((s) => _formatRefactorSkipLog(s)).join(' | '),
    });
    return { map, diagnostics, pipeline };
  }

  const skipSummaries = pipeline.skipped.map((s) => _formatRefactorSkipLog(s)).join(' | ');
  console.warn('[PasteCraft:refactor]', {
    ...pipeline,
    skipSummaries: skipSummaries || undefined,
    skipped: pipeline.skipped.length > 0 ? pipeline.skipped : undefined,
  });
  return { map, diagnostics, pipeline };
}

function _normalizeRefactorText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function _textPreview(text, max = 60) {
  const norm = _normalizeRefactorText(text);
  return norm.length <= max ? norm : `${norm.slice(0, max)}…`;
}

function _formatRefactorSkipLog(skip) {
  const parts = [];
  if (skip.clipId) parts.push(`clip=${skip.clipId}`);
  parts.push(`outcome=${skip.outcome || 'unknown'}`);
  parts.push(`reason=${skip.reason || 'unknown'}`);
  if (skip.originalLen != null) parts.push(`origLen=${skip.originalLen}`);
  if (skip.refactoredLen != null) parts.push(`refLen=${skip.refactoredLen}`);
  if (skip.originalPreview) parts.push(`orig="${skip.originalPreview}"`);
  if (skip.refactoredPreview) parts.push(`ref="${skip.refactoredPreview}"`);
  if (skip.synthesis) parts.push(`synthesis="${String(skip.synthesis).slice(0, 100)}"`);
  if (Array.isArray(skip.reasons) && skip.reasons.length > 1) {
    parts.push(`allReasons=[${skip.reasons.join('; ')}]`);
  }
  return parts.join(' ');
}

function _resolveRefactorSkipToast(skipped, refactorError) {
  if (refactorError) {
    if (isOutOfCreditsError({ message: refactorError }) || /need more ai credits/i.test(refactorError)) {
      return 'Need more AI credits — buy a pack or wait for your monthly reset';
    }
    if (/failed to fetch|network|timeout/i.test(refactorError)) {
      return 'Refactor failed — network error reaching Supabase. Check connection and retry.';
    }
    return `Refactor failed: ${refactorError}`;
  }

  if (!Array.isArray(skipped) || skipped.length === 0) {
    return 'No refactored copies saved — select text clips (not URLs/code)';
  }

  const first = skipped[0];
  const outcome = first?.outcome || 'unknown';

  switch (outcome) {
    case 'no_credits':
      return 'Need more AI credits — buy a pack or wait for your monthly reset';
    case 'unchanged':
      return 'AI returned the same text — try a different level or a longer clip';
    case 'minimal_change':
      return 'AI made only tiny edits — try a higher-contrast level (e.g. Child or PhD)';
    case 'preserved':
      return 'This clip looks like code or a link — refactor preserves it unchanged';
    case 'partial':
      return 'AI response was incomplete — try again';
    case 'empty_response':
      return 'Refactor returned no results — check connection and retry';
    default:
      if (first?.reason === 'identical_text') {
        return 'AI returned the same text — try a different level or a longer clip';
      }
      return 'No refactored copies saved — check credits or try again';
  }
}

function _resolveRefactorSummaryLine(stats) {
  if (stats.aiRefactored > 0) {
    return `Original clip kept; ${stats.aiRefactored} new refactored clip(s) added to recents.`;
  }
  if (stats.refactorError || stats.refactorPipeline?.blockedBeforeCall) {
    return _resolveRefactorSkipToast(stats.refactorPipeline?.skipped || [], stats.refactorError);
  }
  const skipped = stats.refactorPipeline?.skipped || [];
  if (skipped.length > 0) {
    return _resolveRefactorSkipToast(skipped, null);
  }
  return 'No refactored copies saved (check network, credits, or clip type).';
}

function _populateAiRefactorMap(map, targets, aiResults) {
  const len = Math.min(targets.length, aiResults.length);
  for (let i = 0; i < len; i++) {
    const refactored = String(aiResults[i] || '').trim();
    const original = (targets[i].text || '').trim();
    if (refactored && _normalizeRefactorText(refactored) !== _normalizeRefactorText(original)) {
      map.set(String(targets[i].id), refactored);
    }
  }
}

function _countEmDashes(text) {
  return (String(text || '').match(/—/g) || []).length;
}

const AI_FORMAT_FILLER_RE = /\b(delve|delving|it's important to note|it is important to note|furthermore|in conclusion|additionally|moreover|it's worth noting|it is worth noting|in today's world|navigate the complexities|as an ai|underscores the importance|comprehensive overview|robust solution)\b/i;

function _isSuspiciousAiFormatOutput(original, formatted) {
  const orig = String(original || '').trim();
  const fmt = String(formatted || '').trim();
  if (!fmt || fmt === orig) return false;
  if (orig.length > 0 && fmt.length > orig.length * 1.12) return true;
  if (AI_FORMAT_FILLER_RE.test(fmt) && !AI_FORMAT_FILLER_RE.test(orig)) return true;
  if (_countEmDashes(fmt) > _countEmDashes(orig)) return true;
  return false;
}

function _populateAiFormatMap(map, targets, aiResults) {
  const len = Math.min(targets.length, aiResults.length);
  for (let i = 0; i < len; i++) {
    const original = (targets[i].text || '').trim();
    const formatted = String(aiResults[i] || '').trim();
    if (!formatted || formatted === original || _isSuspiciousAiFormatOutput(original, formatted)) continue;
    map.set(String(targets[i].id), formatted);
  }
}

function _processMagicTargetClips(app, ctx) {
  for (const clip of app.clips) {
    if (!ctx.targetSet.has(String(clip.id))) continue;
    const contentType = ctx.clipTypeMap.get(String(clip.id)) || 'text';
    ctx.stats.typesFound[contentType] = (ctx.stats.typesFound[contentType] || 0) + 1;
    if (ctx.settings?.smartCategorize && !ctx.deferCategoryPick) {
      _categorizeClipForMagic(app, clip, contentType, ctx);
    }
    _applyAiFormatRefactorAndCleanup(app, clip, contentType, ctx);
  }
}

function _categorizeClipForMagic(app, clip, contentType, ctx) {
  if (clip.category && clip.category !== 'Uncategorized') return;
  const suggested = _resolveSuggestedCategory(app, clip, contentType, ctx.aiCategoryMap);
  const existingCat = app.categories.find(c => c.name.toLowerCase() === suggested.name.toLowerCase());
  if (existingCat) {
    _assignClipToExistingCategory(app, clip, existingCat, ctx.stats);
  } else {
    _queueNewCategoryForClip(clip, suggested, ctx.queue);
  }
}

function _resolveSuggestedCategory(app, clip, contentType, aiCategoryMap) {
  const aiCat = aiCategoryMap.get(String(clip.id));
  return aiCat ? { name: aiCat, icon: '🏷️' } : app._suggestCategory(contentType);
}

function _assignClipToExistingCategory(app, clip, existingCat, stats) {
  const clipsInCat = app.clips.filter(c => c.category === existingCat.name);
  if (clipsInCat.length < 150) {
    clip.category = existingCat.name;
    stats.categorized++;
  }
}

function _queueNewCategoryForClip(clip, suggested, queue) {
  if (!queue.has(suggested.name)) {
    queue.set(suggested.name, suggested);
  }
  clip._pendingCategory = suggested.name;
}

function _applyAiFormatRefactorAndCleanup(app, clip, contentType, ctx) {
  const settings = ctx.settings || _getCraftClipsSettings(app);
  const aiFormatted = ctx.aiFormatMap.get(String(clip.id));
  if (aiFormatted && settings.aiMode === CRAFT_CLIPS_AI_MODES.FORMATTED) {
    clip.text = aiFormatted;
    ctx.stats.aiFormatted++;
  }

  const sourceClip = settings.aiMode === CRAFT_CLIPS_AI_MODES.REFACTORING
    ? _resolveRefactorSourceClip(app, clip)
    : clip;
  const aiRefactored = ctx.aiRefactorMap.get(String(sourceClip.id));
  if (aiRefactored && settings.aiMode === CRAFT_CLIPS_AI_MODES.REFACTORING) {
    const original = (sourceClip.text || '').trim();
    if (_normalizeRefactorText(aiRefactored) !== _normalizeRefactorText(original)) {
      ctx.refactorNewClips.push(_buildRefactoredSiblingClip(sourceClip, aiRefactored, settings));
      ctx.stats.aiRefactored++;
    }
  }

  if (settings.aiMode !== CRAFT_CLIPS_AI_MODES.REFACTORING) {
    const enhanced = app._enhanceContent(clip.text, contentType);
    if (enhanced !== clip.text) {
      clip.text = enhanced;
      ctx.stats.enhanced++;
    }
  }
}

let _refactorClipIdSeq = 0;
let _pendingRefactorLinkPersist = Promise.resolve();

function _nextRefactorClipId() {
  _refactorClipIdSeq = (_refactorClipIdSeq + 1) % 1000;
  return Date.now() + _refactorClipIdSeq;
}

export function hydrateRefactorResolverIndex(app, links) {
  if (!app._refactorResolverIndex) app._refactorResolverIndex = new Map();
  for (const link of links || []) {
    const before = String(link.before || '').trim();
    const after = String(link.after || '').trim();
    if (!before || !after || before === after) continue;
    const record = {
      sourceClipId: getClipIdKey(link.sourceClipId),
      newClipId: getClipIdKey(link.newClipId),
      before,
      after,
    };
    if (record.sourceClipId) app._refactorResolverIndex.set(record.sourceClipId, record);
    if (record.newClipId) app._refactorResolverIndex.set(record.newClipId, record);
  }
}

export async function ensureRefactorRegistryReady(app) {
  await _pendingRefactorLinkPersist;
  try {
    const { [AI_STORAGE_KEYS.REFACTOR_LINKS]: stored = [] } = await chrome.storage.local.get([
      AI_STORAGE_KEYS.REFACTOR_LINKS,
    ]);
    app._refactorLinks = Array.isArray(stored) ? stored : [];
    hydrateRefactorResolverIndex(app, app._refactorLinks);
  } catch (err) {
    console.warn('ensureRefactorRegistryReady failed:', err?.message || err);
  }
}

function _registerRefactorLinkInMemory(app, record) {
  if (!record) return;
  if (!Array.isArray(app._refactorLinks)) app._refactorLinks = [];
  app._refactorLinks.unshift({
    sourceClipId: record.sourceClipId,
    newClipId: record.newClipId,
    before: record.before,
    after: record.after,
    updatedAt: Date.now(),
  });
  if (app._refactorLinks.length > 50) app._refactorLinks.length = 50;
  if (!app._refactorResolverIndex) app._refactorResolverIndex = new Map();
  app._refactorResolverIndex.set(record.sourceClipId, record);
  if (record.newClipId) app._refactorResolverIndex.set(record.newClipId, record);
}

function _rememberRefactorPair(app, sourceClip, newClip) {
  const before = String(
    sourceClip?.text || newClip?.meta?.craftRefactorSourceText || '',
  ).trim();
  const after = String(newClip?.text || '').trim();
  if (!before || !after || before === after) return null;

  const record = {
    sourceClipId: getClipIdKey(sourceClip?.id ?? newClip?.meta?.craftRefactorSourceId),
    newClipId: getClipIdKey(newClip?.id),
    before,
    after,
  };
  _registerRefactorLinkInMemory(app, record);
  return record;
}

function _buildRefactoredSiblingClip(sourceClip, refactoredText, settings) {
  const now = Date.now();
  const sourceMeta = sourceClip.meta && typeof sourceClip.meta === 'object'
    ? { ...sourceClip.meta }
    : {};
  return {
    id: _nextRefactorClipId(),
    text: refactoredText,
    category: sourceClip.category || 'Uncategorized',
    timestamp: now,
    updatedAt: now,
    meta: {
      ...sourceMeta,
      craftRefactor: true,
      craftRefactorSourceId: getClipIdKey(sourceClip.id),
      craftRefactorSourceText: String(sourceClip.text || '').trim(),
      craftRefactorLevel: settings.refactorLevel,
    },
  };
}

async function _insertRefactoredSiblingClips(app, ctx, targetSet) {
  const created = ctx.refactorNewClips || [];
  if (created.length === 0) return;

  await _replaceExistingRefactoredSiblings(app, ctx);

  const linkRecords = [];
  for (let i = created.length - 1; i >= 0; i--) {
    const newClip = created[i];
    const sourceIdKey = getClipIdKey(newClip?.meta?.craftRefactorSourceId || '');
    const sourceClip = app.clips.find((c) => getClipIdKey(c.id) === sourceIdKey) || {
      id: sourceIdKey,
      text: newClip?.meta?.craftRefactorSourceText || '',
    };
    const linkRecord = _rememberRefactorPair(app, sourceClip, newClip);
    if (linkRecord) linkRecords.push(linkRecord);
    app.clips.unshift(newClip);
    targetSet.add(getClipIdKey(newClip.id));
  }

  console.warn('[PasteCraft:refactor]', {
    message: 'siblings_inserted',
    siblingsCreated: created.length,
    linksRegistered: linkRecords.length,
  });

  if (linkRecords.length > 0) {
    await _persistRefactorLinks(linkRecords);
    for (const record of linkRecords) {
      console.warn('[PasteCraft:refactor-link]', {
        sourceId: record.sourceClipId,
        refactoredId: record.newClipId,
      });
    }
  }

  if (typeof app.enforceClipLimit === 'function') {
    await app.enforceClipLimit();
  }
}

async function _persistRefactorLinks(records) {
  if (!Array.isArray(records) || records.length === 0) return;
  _pendingRefactorLinkPersist = _pendingRefactorLinkPersist.then(async () => {
    try {
      const { [AI_STORAGE_KEYS.REFACTOR_LINKS]: existing = [] } = await chrome.storage.local.get([
        AI_STORAGE_KEYS.REFACTOR_LINKS,
      ]);
      const links = Array.isArray(existing) ? [...existing] : [];
      for (const record of records) {
        const before = String(record.before || '').trim();
        const after = String(record.after || '').trim();
        if (!before || !after || before === after) continue;
        links.unshift({
          sourceClipId: getClipIdKey(record.sourceClipId),
          newClipId: getClipIdKey(record.newClipId),
          before,
          after,
          updatedAt: Date.now(),
        });
      }
      await chrome.storage.local.set({ [AI_STORAGE_KEYS.REFACTOR_LINKS]: links.slice(0, 50) });
    } catch (err) {
      console.warn('_persistRefactorLinks failed:', err?.message || err);
    }
  });
  return _pendingRefactorLinkPersist;
}

async function _replaceExistingRefactoredSiblings(app, ctx) {
  const sourceIds = new Set();
  for (const newClip of ctx.refactorNewClips || []) {
    const sourceKey = getClipIdKey(newClip?.meta?.craftRefactorSourceId || '');
    if (sourceKey) sourceIds.add(sourceKey);
  }
  if (sourceIds.size === 0) return;

  const toDelete = [];
  for (const clip of app.clips || []) {
    const linkedSourceId = clip?.meta?.craftRefactorSourceId;
    if (linkedSourceId == null || linkedSourceId === '') continue;
    const sourceKey = getClipIdKey(linkedSourceId);
    if (!sourceIds.has(sourceKey)) continue;
    const clipKey = getClipIdKey(clip.id);
    if (clipKey === sourceKey) continue;
    toDelete.push(clipKey);
  }
  if (toDelete.length === 0) return;

  await deleteClipsByIdKeys(app, toDelete, {
    reason: 'replace:refactor',
    rerender: false,
    clearSelection: false,
  });
  await _pruneRefactorLinksForDeletedClips(app, toDelete);
}

async function _pruneRefactorLinksForDeletedClips(app, deletedIdKeys) {
  const deleted = new Set((deletedIdKeys || []).map(getClipIdKey).filter(Boolean));
  if (deleted.size === 0) return;

  if (Array.isArray(app._refactorLinks)) {
    app._refactorLinks = app._refactorLinks.filter(
      (link) => !deleted.has(getClipIdKey(link.newClipId)),
    );
  }
  if (app._refactorResolverIndex instanceof Map) {
    for (const id of deleted) {
      app._refactorResolverIndex.delete(id);
    }
  }

  _pendingRefactorLinkPersist = _pendingRefactorLinkPersist.then(async () => {
    try {
      const { [AI_STORAGE_KEYS.REFACTOR_LINKS]: existing = [] } = await chrome.storage.local.get([
        AI_STORAGE_KEYS.REFACTOR_LINKS,
      ]);
      const links = (Array.isArray(existing) ? existing : []).filter(
        (link) => !deleted.has(getClipIdKey(link.newClipId)),
      );
      await chrome.storage.local.set({ [AI_STORAGE_KEYS.REFACTOR_LINKS]: links.slice(0, 50) });
    } catch (err) {
      console.warn('_pruneRefactorLinksForDeletedClips failed:', err?.message || err);
    }
  });
  return _pendingRefactorLinkPersist;
}

async function _saveCraftRefactorHistory(app, ctx) {
  if (typeof app.saveRefactorHistory !== 'function') return;
  const records = [];
  const savedSources = new Set();

  for (const newClip of ctx.refactorNewClips || []) {
    const sourceIdKey = getClipIdKey(newClip.meta?.craftRefactorSourceId || '');
    const sourceClip = app.clips.find((c) => getClipIdKey(c.id) === sourceIdKey);
    const before = String(sourceClip?.text || '').trim();
    const after = String(newClip.text || '').trim();
    if (!before || !after) continue;
    savedSources.add(sourceIdKey);
    records.push({
      before,
      after,
      refactorLevel: ctx.settings?.refactorLevel || 'college',
      sourceClipId: sourceIdKey,
      newClipId: getClipIdKey(newClip.id),
      synthesis: ctx.refactorDiagnostics?.get(String(sourceIdKey)) || {},
    });
  }

  for (const [sourceId, synthesis] of ctx.refactorDiagnostics || []) {
    const sourceIdKey = getClipIdKey(sourceId);
    if (savedSources.has(sourceIdKey)) continue;
    const sourceClip = app.clips.find((c) => getClipIdKey(c.id) === sourceIdKey);
    const before = String(sourceClip?.text || '').trim();
    if (!before) continue;
    const after = String(ctx.aiRefactorMap?.get(String(sourceId)) || before).trim();
    records.push({
      before,
      after,
      refactorLevel: ctx.settings?.refactorLevel || 'college',
      sourceClipId: sourceIdKey,
      newClipId: '',
      synthesis: synthesis || {},
    });
  }

  if (records.length > 0) {
    await _persistRefactorLinks(records);
    await app.saveRefactorHistory(records);
  }
}

function _detectMagicDuplicates(app, targetSet, stats) {
  const dupMap = _buildAllClipsDuplicateMap(app.clips);
  _countDuplicatesInTargets(app, targetSet, dupMap, stats);
}

function _buildAllClipsDuplicateMap(clips) {
  const dupMap = new Map();
  for (const clip of clips) {
    const key = (clip.text || '').trim().toLowerCase();
    if (!key) continue;
    dupMap.set(key, (dupMap.get(key) || 0) + 1);
  }
  return dupMap;
}

function _countDuplicatesInTargets(app, targetSet, dupMap, stats) {
  for (const clip of app.clips) {
    if (!targetSet.has(String(clip.id))) continue;
    const key = (clip.text || '').trim().toLowerCase();
    if (_isDuplicateKey(key, dupMap)) stats.duplicatesFound++;
  }
}

async function _createMissingMagicCategories(app, queue) {
  for (const [name, { icon }] of queue) {
    const exists = app.categories.some(c => c.name.toLowerCase() === name.toLowerCase());
    if (exists) continue;
    try {
      await createCategory(app, name, icon, { silent: true });
    } catch (_) {
      /* fall through — assignPending may still match if created elsewhere */
    }
  }
}

function _archiveYoungerDuplicates(app, targetSet, stats) {
  const groups = new Map();
  for (const clip of app.clips) {
    if (!targetSet.has(String(clip.id))) continue;
    const key = (clip.text || '').trim().toLowerCase();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(clip);
  }

  const toArchive = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    stats.duplicatesFound += group.length;
    group.sort((a, b) => (a.timestamp || a.createdAt || 0) - (b.timestamp || b.createdAt || 0));
    const keeper = group[0];
    for (let i = 1; i < group.length; i++) {
      if (String(group[i].id) !== String(keeper.id)) toArchive.push(group[i]);
    }
  }

  if (toArchive.length === 0) return;

  const archiveIds = new Set(toArchive.map(c => String(c.id)));
  app.clips = app.clips.filter(c => !archiveIds.has(String(c.id)));
  if (!Array.isArray(app.searchOnlyClips)) app.searchOnlyClips = [];
  for (const clip of toArchive) {
    app.searchOnlyClips.unshift(clip);
  }
  stats.duplicatesArchived = toArchive.length;
}

function _assignPendingMagicCategories(app, stats) {
  for (const clip of app.clips) {
    if (!clip._pendingCategory) continue;
    const cat = app.categories.find(c => c.name.toLowerCase() === clip._pendingCategory.toLowerCase());
    if (cat && _categoryHasRoom(app, cat)) {
      clip.category = cat.name;
      stats.categorized++;
    }
    delete clip._pendingCategory;
  }
}

function _categoryHasRoom(app, cat) {
  return app.clips.filter(c => c.category === cat.name).length < 150;
}

function _promoteCraftedClipsToRecents(app, targetSet, stats) {
  let ts = Date.now();
  for (const clip of app.clips) {
    if (!targetSet.has(String(clip.id))) continue;
    clip.timestamp = ts;
    clip.updatedAt = ts;
    ts -= 1;
  }
  app.clips.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  app.currentPage = 0;
}

async function _verifyMagicState(app) {
  const stored = await chrome.storage.local.get(['clips', 'categories', 'searchOnlyClips']);
  const clips = Array.isArray(stored.clips) ? stored.clips : [];
  const categories = Array.isArray(stored.categories) ? stored.categories : [];
  const searchOnlyClips = Array.isArray(stored.searchOnlyClips) ? stored.searchOnlyClips : [];
  return (
    clips.length === (Array.isArray(app.clips) ? app.clips.length : 0) &&
    categories.length === (Array.isArray(app.categories) ? app.categories.length : 0) &&
    searchOnlyClips.length === (Array.isArray(app.searchOnlyClips) ? app.searchOnlyClips.length : 0)
  );
}

async function _saveMagicState(app, { uiUpdater = null, syncToCloud = true } = {}) {
  const result = await PasteCraftCRUD.saveOperation({
    stateGetter: () => ({
      clips: app.clips,
      categories: app.categories,
      searchOnlyClips: app.searchOnlyClips,
      currentPage: app.currentPage,
    }),
    stateSetter: async (newState) => {
      app.clips = Array.isArray(newState.clips) ? newState.clips : [];
      app.categories = Array.isArray(newState.categories) ? newState.categories : [];
      app.searchOnlyClips = Array.isArray(newState.searchOnlyClips) ? newState.searchOnlyClips : [];
      app.currentPage = typeof newState.currentPage === 'number' ? newState.currentPage : app.currentPage;
    },
    stateKeys: ['clips', 'categories', 'searchOnlyClips', 'currentPage'],
    mutateState: async () => {},
    storageKeys: ['clips', 'categories', 'searchOnlyClips'],
    buildStorageData: async (state) => ({
      clips: state.clips,
      categories: state.categories,
      searchOnlyClips: state.searchOnlyClips,
      pc_local_updatedAt: Date.now(),
    }),
    storageWriter: async (data) => {
      await chrome.storage.local.set(data);
    },
    verifier: async () => _verifyMagicState(app),
    uiUpdater: () => {
      if (typeof uiUpdater === 'function') uiUpdater();
    },
    backgroundSync: syncToCloud ? async () => {
      await _syncMagicToSupabase(app);
    } : null,
    successMessage: () => '',
    errorMessage: (error) => `Failed to persist crafted clips: ${error.message || 'Unknown error'}`,
    showToast: null,
  });

  if (!result.success) {
    throw new Error(result.error || 'Failed to persist crafted clips');
  }
}

async function _syncMagicToSupabase(app) {
  try {
    await pasteCraftSupabase.syncClipsToSupabase(app.clips);
    await pasteCraftSupabase.syncCategoriesToSupabase(app.categories);
    if (Array.isArray(app.searchOnlyClips) && app.searchOnlyClips.length > 0) {
      await pasteCraftSupabase.syncArchivedClipsToSupabase(app.searchOnlyClips);
    }
  } catch (_) { /* don't block on sync failures */ }
}

function _refreshMagicCreditsAndUi(app, stats) {
  const refactorAttempted = (stats.refactorPipeline?.aiResultCount > 0)
    || stats.refactorPipeline?.error
    || stats.refactorPipeline?.blockedBeforeCall;
  if (stats.aiCategorized || stats.aiFormatted > 0 || stats.aiRefactored > 0 || refactorAttempted) {
    app.updateAiCreditsPills('fresh');
  }
  app.renderChips();
  app.renderCategories();
  app.updateCategoryFilter();
  app.updateManualInputCategories();
}

// ────────────────────────────────────────────────────────────
// Craft all
// ────────────────────────────────────────────────────────────

export async function _craftAllMagic() {
  const app = this;
  const allClipIds = app.clips.map(c => String(c.id));
  const stats = await app._craftMagic(allClipIds);
  app.showToast('✨ All clips crafted!');
  return stats;
}

// ────────────────────────────────────────────────────────────
// Category pick (after craft, before results)
// ────────────────────────────────────────────────────────────

export async function _applyCraftCategoryPick(categoryName, clipIds) {
  const app = this;
  const name = String(categoryName || '').trim();
  if (!name || !Array.isArray(clipIds) || clipIds.length === 0) return 0;

  const idSet = new Set(clipIds.map(String));
  let existingCat = app.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());

  if (!existingCat) {
    try {
      await createCategory(app, name, '🏷️', { silent: true });
      existingCat = app.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    } catch (_) { /* may exist from race */ }
  }

  if (!existingCat) return 0;

  let assigned = 0;
  for (const clip of app.clips) {
    if (!idSet.has(String(clip.id))) continue;
    const clipsInCat = app.clips.filter((c) => c.category === existingCat.name);
    if (clipsInCat.length >= 150 && clip.category !== existingCat.name) continue;
    clip.category = existingCat.name;
    assigned++;
  }

  if (assigned > 0) {
    await _saveMagicState(app, {
      uiUpdater: () => _refreshMagicCreditsAndUi(app, { aiCategorized: true }),
      syncToCloud: true,
    });
  }

  return assigned;
}

export async function _finishCraftFlow(stats) {
  const app = this;

  if (stats.craftAiMode === CRAFT_CLIPS_AI_MODES.REFACTORING) {
    await ensureRefactorRegistryReady(app);
    _notifyRefactorOutcome(app, stats);
  }

  if (stats.needsCategoryPick && stats.categorySuggestions?.length) {
    const chosen = await openCraftCategoryPickModal(stats.categorySuggestions);
    if (chosen) {
      const count = await _applyCraftCategoryPick.call(app, chosen, stats.pendingCategoryClipIds);
      stats.categorized = count;
      stats.aiCategorized = true;
      stats.chosenCategory = chosen;
    }
  }

  app._showMagicResults(stats);
}

function _notifyRefactorOutcome(app, stats) {
  if (stats.aiRefactored > 0) {
    app.showToast?.(`✨ ${stats.aiRefactored} refactored clip(s) added to recents`);
    return;
  }

  const toast = _resolveRefactorSkipToast(
    stats.refactorPipeline?.skipped || [],
    stats.refactorError,
  );
  app.showToast?.(toast, 'error');
}

// ────────────────────────────────────────────────────────────
// Results modal
// ────────────────────────────────────────────────────────────

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
}

function _showMagicResultsToastFallback(app, stats) {
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

function _populateMagicResultsModal(app, stats) {
  const labels = app._magicTypeLabels();
  const typeBreakdown = Object.entries(stats.typesFound)
    .map(([type, count]) => `<span class="magic-type-tag">${app._escHtml(labels[type] || type)}: ${count}</span>`)
    .join(' ');

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setText('magicStatCategorized', stats.categorized);
  setText('magicStatEnhanced', stats.enhanced);
  setText('magicStatAiFormatted', stats.aiFormatted || 0);
  setText('magicStatAiRefactored', stats.aiRefactored || 0);

  const isRefactoring = stats.craftAiMode === CRAFT_CLIPS_AI_MODES.REFACTORING;
  const formattedCard = document.getElementById('magicStatFormattedCard');
  const refactoredCard = document.getElementById('magicStatRefactoredCard');
  if (formattedCard) formattedCard.classList.toggle('magic-stat-hidden', isRefactoring);
  if (refactoredCard) refactoredCard.classList.toggle('magic-stat-hidden', !isRefactoring);

  const dupeArchived = stats.duplicatesArchived > 0;
  setText('magicStatDupes', dupeArchived ? stats.duplicatesArchived : stats.duplicatesFound);
  const dupeLabel = document.getElementById('magicStatDupesLabel');
  if (dupeLabel) {
    dupeLabel.textContent = dupeArchived ? 'Dupes Archived' : (stats.duplicateHandling ? 'Dupes Found' : 'Dupes');
  }

  const summaryEl = document.getElementById('magicResultsSummary');
  if (summaryEl) {
    const parts = [];
    if (isRefactoring) {
      parts.push(`AI Refactoring · ${stats.refactorLevel || 'college'} level`);
      if (stats.aiRefactored > 0) {
        parts.push(`Original clip kept; ${stats.aiRefactored} new refactored clip(s) added to recents.`);
      } else {
        parts.push(_resolveRefactorSummaryLine(stats));
      }
    } else if (stats.aiFormatted > 0) {
      parts.push('AI Formatted · grammar fixes applied to clip text.');
    } else if (app._hasAiAccess()) {
      parts.push('AI Formatted · no changes needed or AI call skipped.');
    } else {
      parts.push('Rule-based cleanup and categorize only (premium for AI).');
    }
    if (stats.chosenCategory) {
      parts.push(`Category: "${stats.chosenCategory}".`);
    } else if (stats.aiCategorized) {
      parts.push('Categories used AI batch.');
    } else if (stats.needsCategoryPick) {
      parts.push('Category pick skipped — clips left uncategorized.');
    }
    summaryEl.textContent = parts.join(' ');
  }

  const breakdownEl = document.getElementById('magicTypeBreakdown');
  if (breakdownEl) {
    breakdownEl.innerHTML = typeBreakdown || '<span class="magic-type-tag">No clips to analyze</span>';
  }
}

function _emitCraftArtifact(app, stats) {
  if (typeof app?.emitAiTaskOutput !== 'function') return;
  const mode = stats.craftAiMode || CRAFT_CLIPS_AI_MODES.FORMATTED;
  const title = mode === CRAFT_CLIPS_AI_MODES.REFACTORING ? 'Craft Clips Refactorization Results' : 'Craft Clips Results';
  const summaryLines = [
    `Mode: ${mode === CRAFT_CLIPS_AI_MODES.REFACTORING ? 'AI Refactorization' : 'AI Formatted'}`,
    `Categorized: ${stats.categorized || 0}`,
    `Cleanup: ${stats.enhanced || 0}`,
    `Duplicates Found: ${stats.duplicatesFound || 0}`,
    `Duplicates Archived: ${stats.duplicatesArchived || 0}`,
    `AI Formatted: ${stats.aiFormatted || 0}`,
    `AI Refactored: ${stats.aiRefactored || 0}`,
    stats.refactorLevel ? `Refactor Level: ${stats.refactorLevel}` : '',
    stats.chosenCategory ? `Chosen Category: ${stats.chosenCategory}` : '',
  ].filter(Boolean);

  app.emitAiTaskOutput({
    source: 'ai-lab.craft',
    taskType: mode === CRAFT_CLIPS_AI_MODES.REFACTORING ? 'refactorization' : 'craft',
    title,
    outputText: summaryLines.join('\n'),
    metadata: {
      mode,
      categorized: stats.categorized || 0,
      enhanced: stats.enhanced || 0,
      duplicatesFound: stats.duplicatesFound || 0,
      duplicatesArchived: stats.duplicatesArchived || 0,
      aiFormatted: stats.aiFormatted || 0,
      aiRefactored: stats.aiRefactored || 0,
      refactorLevel: stats.refactorLevel || '',
    },
  });
}

/** Clips eligible for standalone AI Refactorization (AI Lab panel). */
export function getRefactorEligibleClips() {
  const app = this;
  if (!app._hasAiAccess()) return [];
  const skipTypes = app._skipAiFormatTypes();
  return app.clips
    .filter((clip) => {
      if (clip.meta?.craftRefactor) return false;
      const contentType = app._detectContentType(clip.text, clip.meta);
      const trimmedLen = (clip.text || '').trim().length;
      return trimmedLen > 5 && !skipTypes.has(contentType);
    })
    .sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0));
}

/** Refactor selected clips only — no categorize, dedupe, or format. */
export async function runRefactorizationOnly(clipIds, refactorLevel) {
  const app = this;
  const prev = app._craftClipsSettings;
  app._craftClipsSettings = {
    smartCategorize: false,
    duplicateHandling: false,
    aiMode: CRAFT_CLIPS_AI_MODES.REFACTORING,
    refactorLevel: refactorLevel || 'college',
  };
  try {
    return await _craftMagic.call(app, clipIds);
  } finally {
    app._craftClipsSettings = prev;
  }
}

/** Open Craft Clips with AI Refactoring mode pre-selected. */
export async function openCraftClipsForRefactor() {
  const app = this;
  const settings = await loadCraftClipsSettings();
  const next = {
    ...settings,
    aiMode: CRAFT_CLIPS_AI_MODES.REFACTORING,
  };
  app._craftClipsSettings = await saveCraftClipsSettings(next);
  return magicFormat.call(app);
}
