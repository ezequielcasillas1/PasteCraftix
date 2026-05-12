// ─── AI Lab: Magic Wand Feature ───
// Auto-categorize, enhance, dedupe, and organize clips.
// All public functions use `this` (PasteCraftPopup) — call via .call(app, ...) from popup.js.

// ────────────────────────────────────────────────────────────
// Public entry: open Magic preview modal
// ────────────────────────────────────────────────────────────

export function magicFormat() {
  const app = this;
  _animateMagicWand();

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
  notice.style.display = app._hasAiAccess() ? 'block' : 'none';
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
  const issues = [];

  _appendCategoryIssue(app, clip, issues);
  _appendDuplicateIssue(clip, dupMap, issues);
  _appendFormatAndCleanupIssues(app, clip, contentType, issues);

  if (issues.length === 0) {
    issues.push({ tag: '✓ Already clean', detail: '', color: 'green' });
  }
  return { clip, contentType, issues };
}

function _appendCategoryIssue(app, clip, issues) {
  if (clip.category && clip.category !== 'Uncategorized') return;
  const aiLabel = app._hasAiAccess() ? ' (AI)' : '';
  issues.push({ tag: '📁 Uncategorized', detail: `→ Smart Categorize${aiLabel}`, color: 'amber' });
}

function _appendDuplicateIssue(clip, dupMap, issues) {
  const key = (clip.text || '').trim().toLowerCase();
  if (_isDuplicateKey(key, dupMap)) {
    issues.push({ tag: '📋 Duplicate', detail: '', color: 'red' });
  }
}

function _isDuplicateKey(key, dupMap) {
  if (!key) return false;
  return (dupMap.get(key) || 0) > 1;
}

function _appendFormatAndCleanupIssues(app, clip, contentType, issues) {
  const enhanced = app._enhanceContent(clip.text, contentType);
  const skipTypes = app._skipAiFormatTypes();
  const trimmedLen = (clip.text || '').trim().length;
  const canAiFormat = app._hasAiAccess() && !skipTypes.has(contentType) && trimmedLen > 5;
  if (canAiFormat) issues.push({ tag: '✨ Smart Format (AI)', detail: '', color: 'blue' });
  if (enhanced !== clip.text) issues.push({ tag: '🧹 Needs cleanup', detail: '', color: 'blue' });
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
  const issueTags = item.issues.map(i => _buildMagicIssueTagHtml(app, i)).join('');
  return `
    <div class="magic-clip-row ${isSelected ? 'magic-clip-selected' : ''}" data-magic-idx="${globalIdx}" data-clip-id="${clipId}">
      <input type="checkbox" class="magic-clip-check" ${isSelected ? 'checked' : ''}>
      <div class="magic-clip-info">
        <div class="magic-clip-text">${app._escHtml(preview)}</div>
        <div class="magic-clip-meta">
          <span class="magic-type-badge">${typeBadge}</span>
          ${issueTags}
        </div>
      </div>
    </div>`;
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
  const targetSet = new Set(clipIds.map(String));
  const stats = _initMagicStats();
  const categoryQueue = new Map();

  const clipTypeMap = _buildClipTypeMap(app, targetSet);
  const uncategorizedTargets = _collectUncategorizedTargets(app, targetSet);
  const skipTypes = app._skipAiFormatTypes();
  const formatTargets = _collectFormatTargets(app, targetSet, clipTypeMap, skipTypes);
  const hasAi = app._hasAiAccess();

  const aiCategoryMap = await _runAiCategorization(uncategorizedTargets, hasAi, stats);
  const aiFormatMap = await _runAiFormatting(formatTargets, hasAi);

  const ctx = { targetSet, clipTypeMap, aiCategoryMap, aiFormatMap, queue: categoryQueue, stats };
  _processMagicTargetClips(app, ctx);
  _detectMagicDuplicates(app, targetSet, stats);
  _createMissingMagicCategories(app, categoryQueue);
  _assignPendingMagicCategories(app, stats);

  await _persistMagicChanges(app);
  await _syncMagicToSupabase(app);
  _refreshMagicCreditsAndUi(app, stats);

  return stats;
}

function _initMagicStats() {
  return {
    categorized: 0,
    enhanced: 0,
    duplicatesFound: 0,
    typesFound: {},
    aiCategorized: false,
    aiFormatted: 0,
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

function _collectFormatTargets(app, targetSet, clipTypeMap, skipTypes) {
  const out = [];
  for (const clip of app.clips) {
    if (!targetSet.has(String(clip.id))) continue;
    const ct = clipTypeMap.get(String(clip.id));
    const trimmedLen = (clip.text || '').trim().length;
    if (!skipTypes.has(ct) && trimmedLen > 5) out.push(clip);
  }
  return out;
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
    _categorizeClipForMagic(app, clip, contentType, ctx);
    _applyAiFormatAndCleanup(app, clip, contentType, ctx);
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

function _applyAiFormatAndCleanup(app, clip, contentType, ctx) {
  const aiFormatted = ctx.aiFormatMap.get(String(clip.id));
  if (aiFormatted) {
    clip.text = aiFormatted;
    ctx.stats.aiFormatted++;
  }
  const enhanced = app._enhanceContent(clip.text, contentType);
  if (enhanced !== clip.text) {
    clip.text = enhanced;
    ctx.stats.enhanced++;
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

function _createMissingMagicCategories(app, queue) {
  for (const [name, { icon }] of queue) {
    const exists = app.categories.some(c => c.name.toLowerCase() === name.toLowerCase());
    if (exists) continue;
    const now = Date.now();
    app.categories.push({ id: now + Math.random(), name, icon, createdAt: now, updatedAt: now });
  }
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
  } catch (_) { /* don't block on sync failures */ }
}

function _refreshMagicCreditsAndUi(app, stats) {
  if (stats.aiCategorized || stats.aiFormatted > 0) {
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
  app._magicUndoSnapshot = {
    clips: JSON.parse(JSON.stringify(app.clips)),
    categories: JSON.parse(JSON.stringify(app.categories)),
  };
  const allClipIds = app.clips.map(c => String(c.id));
  const stats = await app._craftMagic(allClipIds);
  app.showToast('🪄 All clips processed! Click Magic again to undo.');
  return stats;
}

export async function _undoMagic() {
  const app = this;
  if (!app._magicUndoSnapshot) {
    app.showToast('⚠️ No magic to undo');
    return;
  }

  app.clips = app._magicUndoSnapshot.clips;
  app.categories = app._magicUndoSnapshot.categories;
  app._magicUndoSnapshot = null;

  await _persistUndoMagicChanges(app);
  await _syncMagicToSupabase(app);

  app.renderChips();
  app.renderCategories();
  app.updateCategoryFilter();
  app.updateManualInputCategories();

  const modal = document.getElementById('magicPreviewModal');
  if (modal) modal.style.display = 'none';
  app.showToast('🪄 Magic undone! Clips restored.');
}

async function _persistUndoMagicChanges(app) {
  await chrome.storage.local.set({
    clips: app.clips,
    categories: app.categories,
    pc_local_updatedAt: Date.now(),
  });
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
  if (stats.duplicatesFound > 0) parts.push(`${stats.duplicatesFound} dupes found`);
  app.showToast(parts.length ? `🪄 ${parts.join(', ')}` : '🪄 Clips already organized!');
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
  setText('magicStatDupes', stats.duplicatesFound);

  const breakdownEl = document.getElementById('magicTypeBreakdown');
  if (breakdownEl) {
    breakdownEl.innerHTML = typeBreakdown || '<span class="magic-type-tag">No clips to analyze</span>';
  }
}
