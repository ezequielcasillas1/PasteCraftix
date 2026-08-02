/**
 * Host-scoped clips overview under AI Summary follow-up.
 * Tabs: Clips (recent) · Search · Categories — own IDs/selection (no Notes picker import).
 * @forward-slice
 */

import { isImageBearingClip, resolveClipImageSrc } from '../../../shared/clip-images.js';

const HOST_ID = 'summaryClipsOverview';
const SELECTED_KEY = '_summaryOverviewSelected';
const FILE_ID_KEY = '_summaryOverviewFileId';
const ACTIVE_TAB_KEY = '_summaryOverviewActiveTab';

// #region agent log
const _DBG_RELAY = false;
const _DBG_ENDPOINT = 'http://127.0.0.1:7917/ingest/ad95356a-805b-4ff0-9f29-cccbb04c04fd';
const _DBG_MAX = 12;
let _dbgCount = 0;
let _dbgBudgetNotified = false;
let _dbgRelayReported = false;
const _dbgSeen = new Set();
let _dbgPass = null;

function _escapeWsSample(text) {
  return String(text ?? '').slice(0, 40).replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
}

function _dbgDedupeKey(hypothesisId, data) {
  const d = data && typeof data === 'object' ? data : {};
  const stable = d.groupCount != null
    ? `${d.groupCount}|${JSON.stringify(d.groups || [])}`
    : d.rows != null
      ? `${d.rows}|${JSON.stringify(d.byBranch || {})}|${d.junk || 0}|${JSON.stringify((d.examples || []).map((e) => e.id || e.resolved || e))}`
      : d.thumbs != null
        ? `${d.thumbs}|${d.resolved}|${d.unresolved}`
        : d.clipId != null
          ? String(d.clipId)
          : d.normalized != null
            ? String(d.normalized)
            : JSON.stringify(d);
  return `${hypothesisId}|${stable}`;
}

function _dbg(hypothesisId, location, message, data) {
  if (_dbgBudgetNotified) return;
  const key = _dbgDedupeKey(hypothesisId, data);
  if (_dbgSeen.has(key)) return;
  // Reserve final slot for the budget-reached line (total ≤ _DBG_MAX warns).
  if (_dbgCount >= _DBG_MAX - 1) {
    _dbgBudgetNotified = true;
    _dbgCount += 1;
    console.warn('[PasteCraft:debug:7004b6]', JSON.stringify({
      sessionId: '7004b6',
      runId: 'pre-fix',
      hypothesisId: 'BUDGET',
      location: 'ai-lab.summary-clips-overview.js:_dbg',
      message: 'probe budget reached',
      data: { max: _DBG_MAX },
      timestamp: Date.now(),
    }));
    return;
  }
  _dbgSeen.add(key);
  _dbgCount += 1;
  const payload = {
    sessionId: '7004b6',
    runId: 'pre-fix',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  console.warn('[PasteCraft:debug:7004b6]', JSON.stringify(payload));
  if (!_DBG_RELAY) return;
  try {
    chrome.runtime.sendMessage({ action: 'pcAgentDebugLog', endpoint: _DBG_ENDPOINT, payload }, (resp) => {
      if (_dbgRelayReported) return;
      _dbgRelayReported = true;
      const err = chrome.runtime.lastError;
      console.warn('[PasteCraft:debug:7004b6]', JSON.stringify({
        sessionId: '7004b6',
        runId: 'pre-fix',
        hypothesisId: 'RELAY',
        location: 'ai-lab.summary-clips-overview.js:_dbg',
        message: 'relay result',
        data: { error: err ? err.message : null, resp: resp || null },
        timestamp: Date.now(),
      }));
    });
  } catch (_) { /* relay unavailable */ }
}

function _beginDbgPass() {
  _dbgPass = {
    h3: {
      rows: 0,
      byBranch: { clipTitle: 0, fallback: 0 },
      junk: 0,
      examples: [],
      _seenEx: new Set(),
    },
    h4: { thumbs: 0, resolved: 0, unresolved: 0 },
  };
}

function _isJunkDisplayTitle(resolved) {
  const t = String(resolved || '');
  if (!t || t.length <= 3) return true;
  if (/\bfile\b/i.test(t)) return true;
  if (/^[-–—_•·.\s]+$/.test(t)) return true;
  try {
    if (/^[\p{P}\p{S}\s]+$/u.test(t)) return true;
  } catch (_) { /* unicode property unsupported */ }
  return false;
}

function _noteH3(app, clip, branch, resolved) {
  if (!_dbgPass?.h3) return;
  const h3 = _dbgPass.h3;
  h3.rows += 1;
  if (branch === 'clipTitle') h3.byBranch.clipTitle += 1;
  else h3.byBranch.fallback += 1;
  if (!_isJunkDisplayTitle(resolved)) return;
  h3.junk += 1;
  const id = _clipIdKey(app, clip?.id);
  if (!id || h3._seenEx.has(id) || h3.examples.length >= 3) return;
  h3._seenEx.add(id);
  h3.examples.push({
    id,
    resolved: String(resolved || '').slice(0, 40),
    text: _escapeWsSample(clip?.text),
  });
}

function _flushH3() {
  if (!_dbgPass?.h3 || _dbgPass.h3.rows === 0) return;
  const h3 = _dbgPass.h3;
  _dbg('H3', 'ai-lab.summary-clips-overview.js:_displayTitle', 'title resolution summary', {
    rows: h3.rows,
    byBranch: h3.byBranch,
    junk: h3.junk,
    examples: h3.examples,
  });
}

function _noteH4(resolvedOk) {
  if (!_dbgPass?.h4) return;
  _dbgPass.h4.thumbs += 1;
  if (resolvedOk) _dbgPass.h4.resolved += 1;
  else _dbgPass.h4.unresolved += 1;
}

function _flushH4() {
  if (!_dbgPass?.h4 || _dbgPass.h4.thumbs === 0) return;
  const h4 = _dbgPass.h4;
  _dbg('H4', 'ai-lab.summary-clips-overview.js:_fillThumb', 'thumb resolve summary', {
    thumbs: h4.thumbs,
    resolved: h4.resolved,
    unresolved: h4.unresolved,
  });
}
// #endregion

function _escapeHtml(app, value) {
  if (typeof app?.escapeHtml === 'function') return app.escapeHtml(value);
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function _allClips(app) {
  return [...(app.clips || []), ...(app.searchOnlyClips || [])];
}

function _selected(app) {
  if (!(app[SELECTED_KEY] instanceof Set)) app[SELECTED_KEY] = new Set();
  return app[SELECTED_KEY];
}

function _host() {
  return document.getElementById(HOST_ID);
}

function _panel(name) {
  return document.getElementById(`summaryClipOverview${name}Panel`);
}

function _clipIdKey(app, id) {
  if (typeof app?._clipIdKey === 'function') {
    const key = app._clipIdKey(id);
    if (key != null && key !== '') return String(key);
  }
  return id != null ? String(id) : '';
}

function _findClip(app, clipId) {
  const target = _clipIdKey(app, clipId);
  if (!target) return null;
  return _allClips(app).find((c) => _clipIdKey(app, c?.id) === target) || null;
}

function _displayTitle(app, clip) {
  const titled = typeof app?._clipTitle === 'function' ? String(app._clipTitle(clip) || '').trim() : '';
  let result;
  if (titled) {
    result = titled;
  } else if (typeof app?._clipFallbackTitle === 'function') {
    result = String(app._clipFallbackTitle(clip, 46) || '').trim() || 'Untitled clip';
  } else {
    result = _clipPreview(clip).slice(0, 46) || 'Untitled clip';
  }
  // #region agent log
  _noteH3(app, clip, titled ? 'clipTitle' : 'fallback', result);
  // #endregion
  return result;
}

function _updateFooter(app) {
  const countEl = document.getElementById('summaryClipOverviewCount');
  const useBtn = document.getElementById('summaryClipOverviewUseBtn');
  const n = _selected(app).size;
  if (countEl) countEl.textContent = n === 1 ? '1 selected' : `${n} selected`;
  if (useBtn) useBtn.disabled = n === 0;
}

function _setRowSelected(row, selected) {
  row?.classList.toggle('selected', selected);
  const cb = row?.querySelector('input[type="checkbox"]');
  if (cb) cb.checked = selected;
}

function _toggleClip(app, clipId, row) {
  const set = _selected(app);
  const id = _clipIdKey(app, clipId) || String(clipId);
  if (set.has(id)) {
    set.delete(id);
    _setRowSelected(row, false);
  } else {
    set.add(id);
    _setRowSelected(row, true);
  }
  _updateFooter(app);
}

function _clipPreview(clip) {
  const normalized = _normalizeText(clip?.text);
  const junk = /^[-–—_•·.\s]+$/.test(normalized);
  // #region agent log
  let punctOnly = false;
  try { punctOnly = /^[\p{P}\p{S}\s]+$/u.test(normalized); } catch (_) { /* unicode property unsupported */ }
  if (normalized && (junk || punctOnly)) {
    _dbg('H2', 'ai-lab.summary-clips-overview.js:_clipPreview', 'dashy preview eval', {
      normalized: normalized.slice(0, 40),
      junkRegexHit: junk,
      previewEmitted: !junk,
    });
  }
  // #endregion
  if (!normalized || junk) return '';
  return normalized.length > 90 ? `${normalized.slice(0, 90)}…` : normalized;
}

function _buildRowHtml(app, clip) {
  const id = _clipIdKey(app, clip?.id) || String(clip?.id ?? '');
  const selected = _selected(app).has(id);
  const category = clip.category || 'Uncategorized';
  const timeAgo = typeof app.getTimeAgo === 'function' ? app.getTimeAgo(clip.timestamp) : '';
  const title = _displayTitle(app, clip);
  const preview = _clipPreview(clip);
  const showThumb = isImageBearingClip(clip);
  const safeId = _escapeHtml(app, id);
  return `
    <div class="summary-clip-overview-row ${selected ? 'selected' : ''}" data-action="summary-clip-toggle" data-clip-id="${safeId}">
      <input type="checkbox" class="summary-clip-overview-check" ${selected ? 'checked' : ''} tabindex="-1">
      ${showThumb ? `<img class="summary-clip-overview-thumb" data-thumb-clip-id="${safeId}" alt="" hidden>` : ''}
      <div class="summary-clip-overview-body">
        <div class="summary-clip-overview-title">${_escapeHtml(app, title)}</div>
        ${preview ? `<div class="summary-clip-overview-text">${_escapeHtml(app, preview)}</div>` : ''}
        <div class="summary-clip-overview-meta">
          <span>${_escapeHtml(app, category)}</span>
          <span>${_escapeHtml(app, timeAgo)}</span>
        </div>
      </div>
      <button type="button" class="summary-clip-overview-open" data-action="summary-clip-open" data-clip-id="${safeId}" title="Open clip" aria-label="Open clip">
        <i data-lucide="search"></i>
      </button>
    </div>
  `;
}

function _clipsById(app, clips) {
  const byId = new Map();
  (clips || []).forEach((clip) => {
    const key = _clipIdKey(app, clip?.id) || String(clip?.id ?? '');
    if (key) byId.set(key, clip);
  });
  return byId;
}

async function _fillThumb(img, clip) {
  if (!clip || !isImageBearingClip(clip)) return;
  try {
    const resolved = await resolveClipImageSrc(clip);
    // #region agent log
    _noteH4(Boolean(resolved?.src));
    // #endregion
    if (!resolved?.src || !img.isConnected) return;
    img.src = resolved.src;
    img.hidden = false;
  } catch (_) {
    /* leave thumb hidden */
  }
}

async function _hydrateThumbnails(app, container, clips) {
  if (!container) return;
  const byId = _clipsById(app, clips);
  const imgs = Array.from(container.querySelectorAll('img[data-thumb-clip-id]'));
  await Promise.all(imgs.map((img) => {
    const id = String(img.getAttribute('data-thumb-clip-id') || '');
    return _fillThumb(img, byId.get(id));
  }));
  // #region agent log
  _flushH4();
  // #endregion
}

function _emptyHtml(app, icon, message, hint) {
  const hintHtml = hint
    ? `<p>${_escapeHtml(app, hint)}</p>`
    : '';
  return `<div class="summary-clip-overview-empty"><span>${icon}</span><p>${_escapeHtml(app, message)}</p>${hintHtml}</div>`;
}

function _categoriesForOverviewFile(app) {
  const categories = app.categories || [];
  const fileId = app[FILE_ID_KEY];
  if (!fileId) return categories;
  const categoryIds = new Set((app.fileCategories || [])
    .filter((mapping) => String(mapping.fileId) === String(fileId))
    .map((mapping) => String(mapping.categoryId)));
  return categories.filter((category) => categoryIds.has(String(category.id)));
}

function _renderFilesStrip(app) {
  const strip = document.getElementById('summaryClipOverviewFilesStrip');
  if (!strip) return;

  const files = Array.isArray(app.categoryFiles) ? app.categoryFiles : [];
  const selectedFileId = app[FILE_ID_KEY] || '';
  const allActive = !selectedFileId ? ' selected' : '';

  const chips = [
    `<button type="button" class="summary-clips-overview-file-chip${allActive}" data-action="summary-clip-file" data-file-id="" aria-pressed="${!selectedFileId}">All</button>`,
    ...files.map((file) => {
      const id = String(file.id);
      const selected = String(selectedFileId) === id;
      const accent = _escapeHtml(app, file.colorAccent || '#3b82f6');
      const name = _escapeHtml(app, file.name || 'Untitled file');
      return `
        <button type="button" class="summary-clips-overview-file-chip${selected ? ' selected' : ''}"
          data-action="summary-clip-file" data-file-id="${_escapeHtml(app, id)}"
          aria-pressed="${selected}" title="${name}">
          <span class="summary-clips-overview-file-dot" style="background:${accent}"></span>
          <span>${name}</span>
        </button>
      `;
    }),
  ];

  strip.innerHTML = chips.join('');
}

function _ensureFilesLoaded(app) {
  const init = app?.filesFeature?.initialize;
  if (typeof init !== 'function') {
    _renderFilesStrip(app);
    return;
  }
  Promise.resolve(init.call(app.filesFeature, app))
    .then(() => {
      if (!_host()) return;
      _renderFilesStrip(app);
      if (app[ACTIVE_TAB_KEY] === 'categories') {
        renderSummaryClipOverviewCategories(app);
        window.renderLucideIcons?.(_host());
      }
    })
    .catch(() => {
      _renderFilesStrip(app);
    });
  _renderFilesStrip(app);
}

export function renderSummaryClipOverviewClips(app) {
  const list = document.getElementById('summaryClipOverviewClipsList');
  if (!list) return;
  // #region agent log
  _beginDbgPass();
  // #endregion
  const recent = (app.clips || []).slice(0, 30);
  if (!recent.length) {
    list.innerHTML = _emptyHtml(app, '📋', 'No recent clips');
    // #region agent log
    _flushH3();
    // #endregion
    return;
  }
  list.innerHTML = recent.map((clip) => _buildRowHtml(app, clip)).join('');
  // #region agent log
  _flushH3();
  // #endregion
  void _hydrateThumbnails(app, list, recent);
}

export function renderSummaryClipOverviewSearch(app, query) {
  const list = document.getElementById('summaryClipOverviewSearchList');
  if (!list) return;
  // #region agent log
  _beginDbgPass();
  // #endregion
  const q = String(query || '').trim().toLowerCase();
  if (!q) {
    list.innerHTML = _emptyHtml(app, '🔎', 'Type to search clips');
    // #region agent log
    _flushH3();
    // #endregion
    return;
  }
  const results = _allClips(app)
    .filter((clip) =>
      (clip.text || '').toLowerCase().includes(q)
      || (clip.category || '').toLowerCase().includes(q)
      || (clip.title || '').toLowerCase().includes(q)
      || _displayTitle(app, clip).toLowerCase().includes(q))
    .slice(0, 50);
  if (!results.length) {
    list.innerHTML = _emptyHtml(app, '🔎', 'No matching clips');
    // #region agent log
    _flushH3();
    // #endregion
    return;
  }
  list.innerHTML = results.map((clip) => _buildRowHtml(app, clip)).join('');
  // #region agent log
  _flushH3();
  // #endregion
  void _hydrateThumbnails(app, list, results);
}

export function renderSummaryClipOverviewCategories(app) {
  const list = document.getElementById('summaryClipOverviewCategoriesList');
  if (!list) return;

  // #region agent log
  _beginDbgPass();
  // #endregion

  _renderFilesStrip(app);

  const clips = _allClips(app);
  const fileId = app[FILE_ID_KEY];
  const categories = _categoriesForOverviewFile(app);
  const groups = [];

  if (!fileId) {
    groups.push({
      id: 'uncategorized',
      name: 'Uncategorized',
      clips: clips.filter((c) => (c.category || 'Uncategorized') === 'Uncategorized'),
    });
  }

  categories.forEach((c) => {
    groups.push({
      id: String(c.id),
      name: c.name,
      clips: clips.filter((cl) => cl.category === c.name),
    });
  });

  const filled = groups.filter((g) => g.clips.length > 0);

  // #region agent log
  _dbg('H1', 'ai-lab.summary-clips-overview.js:renderSummaryClipOverviewCategories', 'categories render groups', {
    groupCount: filled.length,
    groups: filled.map((g) => ({ name: g.name, count: g.clips.length })),
  });
  {
    const snip = filled.find((g) => /snip history/i.test(String(g.name || '')));
    if (snip) {
      _dbg('H6', 'ai-lab.summary-clips-overview.js:renderSummaryClipOverviewCategories', 'snip history group dump', {
        name: snip.name,
        count: snip.clips.length,
        clips: snip.clips.slice(0, 4).map((clip) => ({
          id: _clipIdKey(app, clip?.id),
          title: clip?.title ?? null,
          text: _escapeWsSample(clip?.text),
          textLen: String(clip?.text ?? '').length,
          isImage: isImageBearingClip(clip),
          metaKind: clip?.meta?.kind ?? null,
          category: clip?.category ?? null,
        })),
      });
    }
  }
  // #endregion

  if (!filled.length) {
    // Files strip already rendered above — keep it so user can clear the filter.
    let emptyMessage = 'No categorized clips';
    let emptyHint = '';
    if (fileId) {
      if (categories.length === 0) {
        // File selected but no file↔category mappings yet (Manage Categories never run).
        emptyMessage = 'No categories in this file';
        emptyHint = 'Click "Manage Categories" on the file to add some';
      } else {
        // Mappings exist, but none of those categories currently hold clips.
        emptyMessage = "This file's categories have no clips yet";
      }
    }
    list.innerHTML = _emptyHtml(app, '📁', emptyMessage, emptyHint);
    // #region agent log
    _flushH3();
    // #endregion
    return;
  }

  const rowClips = [];
  list.innerHTML = filled.map((group) => {
    const shown = group.clips.slice(0, 25);
    rowClips.push(...shown);
    return `
    <div class="summary-clip-overview-category" data-action="summary-clip-cat-toggle">
      <div class="summary-clip-overview-cat-header">
        <strong>${_escapeHtml(app, group.name)}</strong>
        <span>${group.clips.length}</span>
      </div>
      <div class="summary-clip-overview-cat-body">
        ${shown.map((clip) => _buildRowHtml(app, clip)).join('')}
      </div>
    </div>
  `;
  }).join('');
  // #region agent log
  _flushH3();
  // #endregion
  void _hydrateThumbnails(app, list, rowClips);
}

export function switchSummaryClipOverviewTab(app, tabName) {
  const host = _host();
  if (!host) return;
  const tab = String(tabName || 'clips');
  app[ACTIVE_TAB_KEY] = tab;

  host.querySelectorAll('[data-action="summary-clip-tab"]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
  });

  ['Clips', 'Search', 'Categories'].forEach((name) => {
    const panel = _panel(name);
    if (!panel) return;
    const show = name.toLowerCase() === tab;
    panel.hidden = !show;
    panel.classList.toggle('active', show);
  });

  if (tab === 'clips') renderSummaryClipOverviewClips(app);
  else if (tab === 'search') {
    const input = document.getElementById('summaryClipOverviewSearchInput');
    renderSummaryClipOverviewSearch(app, input?.value || '');
  } else if (tab === 'categories') {
    _ensureFilesLoaded(app);
    renderSummaryClipOverviewCategories(app);
  }

  window.renderLucideIcons?.(host);
}

function _selectedClipTexts(app) {
  const clips = _allClips(app);
  const texts = [];
  _selected(app).forEach((id) => {
    const clip = clips.find((c) => _clipIdKey(app, c.id) === String(id) || String(c.id) === String(id));
    if (clip?.text) texts.push(_normalizeText(clip.text));
  });
  return texts;
}

function _appendTextsToFollowup(texts) {
  const input = document.getElementById('summaryFollowupInput');
  if (!input) return false;
  const block = texts.join('\n\n---\n\n');
  const prev = String(input.value || '').trim();
  input.value = prev ? `${prev}\n\n${block}` : block;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
  return true;
}

export function useSelectedSummaryClipsInFollowup(app) {
  if (!_selected(app).size) {
    app.showToast?.('Select at least one clip');
    return;
  }
  const texts = _selectedClipTexts(app);
  if (!texts.length) {
    app.showToast?.('Selected clips have no text');
    return;
  }
  if (!_appendTextsToFollowup(texts)) return;
  app.showToast?.(texts.length === 1 ? 'Clip added to follow-up' : `${texts.length} clips added to follow-up`);
}

function _viewerContext(app) {
  const tab = app?.[ACTIVE_TAB_KEY] || 'clips';
  if (tab === 'search') return 'search';
  if (tab === 'categories') return 'categories';
  return 'clips';
}

function _openClipFromOverview(app, clipId) {
  const clip = _findClip(app, clipId);
  if (!clip) {
    app.showToast?.('Clip not found');
    return;
  }
  app.openClipViewer?.(clip, _viewerContext(app));
}

function _setOverviewFileFilter(app, fileIdAttr) {
  const fileId = String(fileIdAttr || '');
  const current = String(app[FILE_ID_KEY] || '');
  app[FILE_ID_KEY] = !fileId || current === fileId ? null : fileId;
  renderSummaryClipOverviewCategories(app);
  window.renderLucideIcons?.(_host());
}

function _onHostClick(app, e) {
  const actionEl = e.target.closest?.('[data-action]');
  if (!actionEl) return;
  const action = actionEl.getAttribute('data-action');

  if (action === 'summary-clip-tab') {
    switchSummaryClipOverviewTab(app, actionEl.getAttribute('data-tab'));
    return;
  }
  if (action === 'summary-clip-use') {
    useSelectedSummaryClipsInFollowup(app);
    return;
  }
  if (action === 'summary-clip-open') {
    e.stopPropagation();
    e.preventDefault();
    _openClipFromOverview(app, actionEl.getAttribute('data-clip-id'));
    return;
  }
  if (action === 'summary-clip-file') {
    e.stopPropagation();
    e.preventDefault();
    _setOverviewFileFilter(app, actionEl.getAttribute('data-file-id'));
    return;
  }
  if (action === 'summary-clip-cat-toggle') {
    if (e.target.closest?.('[data-action="summary-clip-toggle"], [data-action="summary-clip-open"]')) return;
    actionEl.classList.toggle('expanded');
    return;
  }
  if (action === 'summary-clip-toggle') {
    e.preventDefault();
    _toggleClip(app, actionEl.getAttribute('data-clip-id'), actionEl);
  }
}

function _onHostInput(app, e) {
  if (e.target?.id === 'summaryClipOverviewSearchInput') {
    renderSummaryClipOverviewSearch(app, e.target.value);
    window.renderLucideIcons?.(_host());
  }
}

/** Bind once; safe to call repeatedly. */
export function bindSummaryClipsOverviewEvents(app) {
  const host = _host();
  if (!host || host.dataset.pcBound === '1') return;
  host.dataset.pcBound = '1';
  host.addEventListener('click', (e) => _onHostClick(app, e));
  host.addEventListener('input', (e) => _onHostInput(app, e));
}

export function mountSummaryClipsOverview(app) {
  const host = _host();
  if (!host) return;
  bindSummaryClipsOverviewEvents(app);
  host.style.display = 'block';
  if (!(app[SELECTED_KEY] instanceof Set)) app[SELECTED_KEY] = new Set();
  app[FILE_ID_KEY] = null;
  _updateFooter(app);
  switchSummaryClipOverviewTab(app, 'clips');
}

export function hideSummaryClipsOverview(app) {
  const host = _host();
  if (host) host.style.display = 'none';
  if (app?.[SELECTED_KEY] instanceof Set) app[SELECTED_KEY].clear();
  if (app) app[FILE_ID_KEY] = null;
  _updateFooter(app || {});
  const listIds = [
    'summaryClipOverviewClipsList',
    'summaryClipOverviewSearchList',
    'summaryClipOverviewCategoriesList',
  ];
  listIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  const strip = document.getElementById('summaryClipOverviewFilesStrip');
  if (strip) strip.innerHTML = '';
}
