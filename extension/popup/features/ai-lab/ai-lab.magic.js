// ─── AI Lab: Craft Clips (formerly Magic Wand) ───
import {
  CRAFT_CLIPS_AI_MODES,
  CRAFT_CLIP_ACTIONS,
  CRAFT_CATEGORY_SUGGESTION_COUNT,
  CRAFT_POWER_MODES,
} from './ai-lab.craft-clips.constants.js';
import {
  loadCraftClipsSettings,
  saveCraftClipsSettings,
  resolveRefactorEdgeLevel,
  syncCraftClipsSettingsToUi,
  buildMagicAiCreditNoticeText,
} from './ai-lab.craft-clips.settings.js';
import { openCraftCategoryPickModal } from './ai-lab.craft-clips.category-pick.js';
import { createCategory } from '../categories/categories.service.js';

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

  _toggleMagicUndoBanner(app);
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

function _toggleMagicUndoBanner(app) {
  const banner = document.getElementById('magicUndoBanner');
  if (!banner) return;
  banner.style.display = app._magicUndoSnapshot ? 'flex' : 'none';
}

function _toggleMagicAiCreditNotice(app) {
  const notice = document.getElementById('magicAiCreditNotice');
  if (!notice) return;
  if (!app._hasAiAccess()) {
    notice.style.display = 'none';
    return;
  }
  const settings = app._craftClipsSettings || {};
  notice.textContent = buildMagicAiCreditNoticeText(settings);
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
  const aiEligibleTargets = _collectAiEligibleTargets(app, targetSet, clipTypeMap, skipTypes);
  const hasAi = app._hasAiAccess();
  const deferCategoryPick = settings.smartCategorize
    && hasAi
    && uncategorizedTargets.length > 0;

  let aiCategoryMap = new Map();
  let aiFormatMap = new Map();
  let aiRefactorMap = new Map();
  let refactorDiagnostics = new Map();

  const craftPower = settings.craftPower === CRAFT_POWER_MODES.SUPER
    ? CRAFT_POWER_MODES.SUPER
    : CRAFT_POWER_MODES.REGULAR;

  if (settings.smartCategorize && !deferCategoryPick) {
    aiCategoryMap = await _runAiCategorization(uncategorizedTargets, hasAi, stats, craftPower);
  }

  if (hasAi && aiEligibleTargets.length > 0) {
    if (settings.aiMode === CRAFT_CLIPS_AI_MODES.REFACTORING) {
      const edgeLevel = resolveRefactorEdgeLevel(settings.refactorLevel);
      const refactorResult = await _runAiRefactoring(aiEligibleTargets, edgeLevel, stats, craftPower);
      aiRefactorMap = refactorResult.map;
      refactorDiagnostics = refactorResult.diagnostics;
    } else {
      aiFormatMap = await _runAiFormatting(aiEligibleTargets, hasAi, craftPower);
    }
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
  _insertRefactoredSiblingClips(app, ctx, targetSet);

  if (settings.duplicateHandling) {
    _archiveYoungerDuplicates(app, targetSet, stats);
  } else {
    _detectMagicDuplicates(app, targetSet, stats);
  }

  await _createMissingMagicCategories(app, categoryQueue);
  _assignPendingMagicCategories(app, stats);

  _promoteCraftedClipsToRecents(app, targetSet, stats);

  await _persistMagicChanges(app);
  await _syncMagicToSupabase(app);
  _refreshMagicCreditsAndUi(app, stats);

  if (settings.aiMode === CRAFT_CLIPS_AI_MODES.REFACTORING
    && ((ctx.refactorNewClips || []).length > 0 || (ctx.refactorDiagnostics && ctx.refactorDiagnostics.size > 0))) {
    await _saveCraftRefactorHistory(app, ctx);
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

async function _fetchCategorySuggestions(app, targets, hasAi) {
  if (targets.length === 0) return [];
  const craftPower = app._craftClipsSettings?.craftPower === CRAFT_POWER_MODES.SUPER
    ? CRAFT_POWER_MODES.SUPER
    : CRAFT_POWER_MODES.REGULAR;
  if (hasAi) {
    try {
      const ai = await pasteCraftSupabase.aiCategorizeSuggestions(targets, { craftPower });
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

async function _runAiCategorization(targets, hasAi, stats, craftPower) {
  const map = new Map();
  if (targets.length === 0 || !hasAi) return map;
  try {
    const aiResults = await pasteCraftSupabase.aiCategorize(targets, { craftPower });
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

async function _runAiFormatting(targets, hasAi, craftPower) {
  const map = new Map();
  if (targets.length === 0 || !hasAi) return map;
  try {
    const aiResults = await pasteCraftSupabase.aiFormat(targets, { craftPower });
    if (Array.isArray(aiResults) && aiResults.length > 0) {
      _populateAiFormatMap(map, targets, aiResults);
    }
  } catch (_) { /* AI failed — fall back to rule-based enhance */ }
  return map;
}

async function _runAiRefactoring(targets, edgeLevel, stats, craftPower) {
  const map = new Map();
  const diagnostics = new Map();
  if (targets.length === 0) return { map, diagnostics };
  try {
    const result = await pasteCraftSupabase.aiRefactor(targets, edgeLevel, { craftPower });
    const aiResults = Array.isArray(result?.refactored) ? result.refactored : [];
    const diagList = Array.isArray(result?.diagnostics) ? result.diagnostics : [];
    if (aiResults.length > 0) {
      _populateAiRefactorMap(map, targets, aiResults, stats);
    }
    targets.forEach((target, i) => {
      const diag = diagList[i] || diagList.find((d) => d?.index === i) || null;
      if (diag) diagnostics.set(String(target.id), diag);
    });
  } catch (err) {
    targets.forEach((target) => {
      diagnostics.set(String(target.id), {
        outcome: 'failed',
        reasons: [String(err?.message || 'AI refactor request failed')],
        synthesis: 'The refactor request failed before the model could rewrite this clip.',
        level: edgeLevel,
      });
    });
  }
  return { map, diagnostics };
}

function _populateAiRefactorMap(map, targets, aiResults, stats) {
  const len = Math.min(targets.length, aiResults.length);
  for (let i = 0; i < len; i++) {
    const refactored = String(aiResults[i] || '').trim();
    const original = (targets[i].text || '').trim();
    if (refactored && refactored !== original) {
      map.set(String(targets[i].id), refactored);
      stats.aiRefactored++;
    }
  }
}

function _populateAiFormatMap(map, targets, aiResults) {
  const len = Math.min(targets.length, aiResults.length);
  for (let i = 0; i < len; i++) {
    const formatted = String(aiResults[i] || '').trim();
    const original = (targets[i].text || '').trim();
    if (formatted && formatted !== original) {
      map.set(String(targets[i].id), formatted);
    }
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

  const aiRefactored = ctx.aiRefactorMap.get(String(clip.id));
  if (aiRefactored && settings.aiMode === CRAFT_CLIPS_AI_MODES.REFACTORING) {
    const original = (clip.text || '').trim();
    if (aiRefactored !== original) {
      ctx.refactorNewClips.push(_buildRefactoredSiblingClip(clip, aiRefactored, settings));
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

function _buildRefactoredSiblingClip(sourceClip, refactoredText, settings) {
  const now = Date.now();
  const sourceMeta = sourceClip.meta && typeof sourceClip.meta === 'object'
    ? { ...sourceClip.meta }
    : {};
  return {
    id: now + Math.random(),
    text: refactoredText,
    category: sourceClip.category || 'Uncategorized',
    timestamp: now,
    updatedAt: now,
    meta: {
      ...sourceMeta,
      craftRefactor: true,
      craftRefactorSourceId: String(sourceClip.id),
      craftRefactorLevel: settings.refactorLevel,
    },
  };
}

function _insertRefactoredSiblingClips(app, ctx, targetSet) {
  const created = ctx.refactorNewClips || [];
  if (created.length === 0) return;

  for (let i = created.length - 1; i >= 0; i--) {
    app.clips.unshift(created[i]);
    targetSet.add(String(created[i].id));
  }

  if (typeof app.enforceClipLimit === 'function') {
    void app.enforceClipLimit();
  }
}

async function _saveCraftRefactorHistory(app, ctx) {
  if (typeof app.saveRefactorHistory !== 'function') return;
  const records = [];
  const savedSources = new Set();

  for (const newClip of ctx.refactorNewClips || []) {
    const sourceId = String(newClip.meta?.craftRefactorSourceId || '');
    const sourceClip = app.clips.find((c) => String(c.id) === sourceId);
    const before = String(sourceClip?.text || '').trim();
    const after = String(newClip.text || '').trim();
    if (!before || !after) continue;
    savedSources.add(sourceId);
    records.push({
      before,
      after,
      refactorLevel: ctx.settings?.refactorLevel || 'college',
      sourceClipId: sourceId,
      newClipId: String(newClip.id),
      synthesis: ctx.refactorDiagnostics?.get(sourceId) || {},
    });
  }

  for (const [sourceId, synthesis] of ctx.refactorDiagnostics || []) {
    if (savedSources.has(String(sourceId))) continue;
    const sourceClip = app.clips.find((c) => String(c.id) === String(sourceId));
    const before = String(sourceClip?.text || '').trim();
    if (!before) continue;
    const after = String(ctx.aiRefactorMap?.get(String(sourceId)) || before).trim();
    records.push({
      before,
      after,
      refactorLevel: ctx.settings?.refactorLevel || 'college',
      sourceClipId: String(sourceId),
      newClipId: '',
      synthesis: synthesis || {},
    });
  }

  if (records.length > 0) {
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

async function _persistMagicChanges(app) {
  await chrome.storage.local.set({
    clips: app.clips,
    categories: app.categories,
    searchOnlyClips: app.searchOnlyClips,
    pc_local_updatedAt: Date.now(),
  });
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
  if (stats.aiCategorized || stats.aiFormatted > 0 || stats.aiRefactored > 0) {
    app.updateAiCreditsPills('fresh');
  }
  app.renderChips();
  app.renderCategories();
  app.updateCategoryFilter();
  app.updateManualInputCategories();
}

// ────────────────────────────────────────────────────────────
// Craft all + undo
// ────────────────────────────────────────────────────────────

export async function _craftAllMagic() {
  const app = this;
  _saveMagicUndoSnapshot(app);
  const allClipIds = app.clips.map(c => String(c.id));
  const stats = await app._craftMagic(allClipIds);
  app.showToast('✨ All clips crafted! Open Craft Clips again to undo.');
  return stats;
}

export function saveMagicUndoSnapshot() {
  _saveMagicUndoSnapshot(this);
}

function _saveMagicUndoSnapshot(app) {
  app._magicUndoSnapshot = {
    clips: JSON.parse(JSON.stringify(app.clips)),
    categories: JSON.parse(JSON.stringify(app.categories)),
    searchOnlyClips: JSON.parse(JSON.stringify(app.searchOnlyClips || [])),
  };
}

export async function _undoMagic() {
  const app = this;
  if (!app._magicUndoSnapshot) {
    app.showToast('⚠️ No magic to undo');
    return;
  }

  app.clips = app._magicUndoSnapshot.clips;
  app.categories = app._magicUndoSnapshot.categories;
  app.searchOnlyClips = app._magicUndoSnapshot.searchOnlyClips || [];
  app._magicUndoSnapshot = null;

  await _persistUndoMagicChanges(app);
  await _syncMagicToSupabase(app);

  app.renderChips();
  app.renderCategories();
  app.updateCategoryFilter();
  app.updateManualInputCategories();

  const modal = document.getElementById('magicPreviewModal');
  if (modal) modal.style.display = 'none';
  app.showToast('✨ Craft Clips undone! Clips restored.');
}

async function _persistUndoMagicChanges(app) {
  await chrome.storage.local.set({
    clips: app.clips,
    categories: app.categories,
    searchOnlyClips: app.searchOnlyClips,
    pc_local_updatedAt: Date.now(),
  });
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
    await _persistMagicChanges(app);
    await _syncMagicToSupabase(app);
    _refreshMagicCreditsAndUi(app, { aiCategorized: true });
  }

  return assigned;
}

export async function _finishCraftFlow(stats) {
  const app = this;

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
        parts.push('No refactored copies saved (check premium credits or try again).');
      }
    } else if (stats.aiFormatted > 0) {
      parts.push('AI Formatted · grammar polish applied to clip text.');
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

/** Clips eligible for standalone AI Refactorization (AI Lab panel). */
export function getRefactorEligibleClips() {
  const app = this;
  if (!app._hasAiAccess()) return [];
  const skipTypes = app._skipAiFormatTypes();
  return app.clips.filter((clip) => {
    if (clip.meta?.craftRefactor) return false;
    const contentType = app._detectContentType(clip.text, clip.meta);
    const trimmedLen = (clip.text || '').trim().length;
    return trimmedLen > 5 && !skipTypes.has(contentType);
  });
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
    craftPower: prev?.craftPower === CRAFT_POWER_MODES.SUPER
      ? CRAFT_POWER_MODES.SUPER
      : CRAFT_POWER_MODES.REGULAR,
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
