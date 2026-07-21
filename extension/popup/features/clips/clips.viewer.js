import {
  getClipTitle,
  getClipIdKey,
  getSelectedOrCurrentText,
  getSelectedOrCurrentClipIdKeys,
  getSelectedOrCurrentClipObjects,
} from './clips.state.js';
import { openGoogleSearchMenu } from './clips.action-menu.js';
import { getTimeAgo } from './clips.render.js';
import { copyClipToClipboard } from './clips.service.js';
import { formatClipViewerPlainText } from '../ai-lab/ai-lab.summary.js';
import { AI_STORAGE_KEYS } from '../ai-lab/ai-lab.constants.js';
import { ensureRefactorRegistryReady } from '../ai-lab/ai-lab.magic.js';
import { getClipImage } from '../../../shared/clip-images.js';
import { openClipImageAnnotate, popOutClipImageAnnotate } from './clips.image-annotate.js';

const CLIP_VIEWER_SOURCE_CONTEXTS = new Set(['clips', 'search', 'categories']);
const HEURISTIC_REFACTOR_WINDOW_MS = 5 * 60 * 1000;

function normalizeClipViewerSourceContext(sourceContext) {
  return CLIP_VIEWER_SOURCE_CONTEXTS.has(sourceContext) ? sourceContext : 'clips';
}

function getClipViewerAiText(app) {
  const clip = app.currentClipViewerClip;
  const clipText = clip && clip.text != null ? String(clip.text) : '';
  const context = app.clipViewerSourceContext || 'clips';
  if (typeof app.getSelectedOrCurrentText === 'function') {
    return app.getSelectedOrCurrentText(clipText, context);
  }
  return getSelectedOrCurrentText(app, clipText, context);
}

function captureClipViewerContext(app) {
  const clip = app.currentClipViewerClip;
  const context = app.clipViewerSourceContext || 'clips';
  const text = getClipViewerAiText(app);
  const idKeys = getSelectedOrCurrentClipIdKeys(app, clip, context);
  const clipObjects = getSelectedOrCurrentClipObjects(app, clip, context);
  return { clip, context, text, idKeys, clipObjects };
}

function closeClipViewerThen(app, fn) {
  const ctx = captureClipViewerContext(app);
  hide(app);
  return fn(ctx);
}

function switchToAiTab() {
  document.querySelectorAll('.tab-btn').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach((t) => t.classList.remove('active'));
  document.querySelector('[data-tab="ai"]')?.classList.add('active');
  document.getElementById('aiTab')?.classList.add('active');
}

function getClipViewerElements() {
  return {
    modal: document.getElementById('clipViewerModal'),
    titleEl: document.getElementById('clipViewerTitleText'),
    metaEl: document.getElementById('clipViewerMeta'),
    bodyEl: document.getElementById('clipViewerBody'),
    renderedEl: document.getElementById('clipViewerRendered'),
    rawEl: document.getElementById('clipViewerRaw'),
    htmlDetails: document.getElementById('clipViewerHtmlDetails'),
    htmlPre: document.getElementById('clipViewerHtml'),
    toggleBtn: document.getElementById('clipViewerToggleRaw'),
  };
}

function findClipAcrossCollections(app, id) {
  if (id == null) return null;
  const key = getClipIdKey(id);
  return (
    app.clips?.find((clip) => getClipIdKey(clip.id) === key) ||
    app.searchOnlyClips?.find((clip) => getClipIdKey(clip.id) === key) ||
    null
  );
}

function normalizeTextForMatch(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function textsMatch(a, b) {
  const left = normalizeTextForMatch(a);
  const right = normalizeTextForMatch(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 120 && right.length >= 120) {
    return left.slice(0, 240) === right.slice(0, 240);
  }
  return false;
}

async function ensureRefactorResolverData(app) {
  await ensureRefactorRegistryReady(app);
  const stored = await chrome.storage.local.get([AI_STORAGE_KEYS.HISTORY]);
  app.aiHistoryEntries = Array.isArray(stored[AI_STORAGE_KEYS.HISTORY])
    ? stored[AI_STORAGE_KEYS.HISTORY]
    : [];

  if (app.aiHistoryEntries.length === 0 && typeof app.loadAiHistory === 'function') {
    try {
      await app.loadAiHistory();
    } catch (_) {
      /* keep storage read */
    }
  }
}

function findClipByTextMatch(app, text, excludeId = null) {
  const target = normalizeTextForMatch(text);
  if (!target) return null;
  const excludeKey = excludeId != null ? getClipIdKey(excludeId) : '';
  const all = [...(app.clips || []), ...(app.searchOnlyClips || [])];
  for (const candidate of all) {
    if (excludeKey && getClipIdKey(candidate?.id) === excludeKey) continue;
    if (textsMatch(candidate?.text, target)) return candidate;
  }
  return null;
}
function findRefactoredSiblingsForSource(app, sourceId) {
  const key = getClipIdKey(sourceId);
  const all = [...(app.clips || []), ...(app.searchOnlyClips || [])];
  return all.filter((clip) => {
    const linkedSourceId = clip?.meta?.craftRefactorSourceId;
    if (linkedSourceId == null || linkedSourceId === '') return false;
    return getClipIdKey(linkedSourceId) === key && getClipIdKey(clip.id) !== key;
  });
}

function isRefactoredSiblingClip(clip) {
  const linkedSourceId = clip?.meta?.craftRefactorSourceId;
  if (linkedSourceId == null || linkedSourceId === '') return false;
  return getClipIdKey(linkedSourceId) !== getClipIdKey(clip?.id);
}

function resolveRefactorContextFromSessionIndex(app, clip) {
  const clipKey = getClipIdKey(clip?.id);
  if (!clipKey || !app._refactorResolverIndex?.get) return null;

  const record = app._refactorResolverIndex.get(clipKey);
  if (!record) return null;

  const sourceId = getClipIdKey(record.sourceClipId);
  const newClipId = getClipIdKey(record.newClipId);
  const before = normalizeTextForMatch(record.before);
  const after = normalizeTextForMatch(record.after);
  if (!before || !after || before === after) return null;

  let sourceClip = findClipAcrossCollections(app, sourceId);
  let refactoredClip = findClipAcrossCollections(app, newClipId);
  if (!sourceClip && clipKey === sourceId) sourceClip = clip;
  if (!refactoredClip && clipKey === newClipId) refactoredClip = clip;

  return buildRefactorPairResult(
    sourceClip || { id: sourceId || clipKey, text: record.before },
    refactoredClip || { id: newClipId || `refactored_session_${sourceId}`, text: record.after },
    { fromSessionIndex: true, resolverPath: 'session-index' },
  );
}

function buildRefactorPairResult(sourceClip, refactoredClip, extra = {}) {
  const originalText = String(sourceClip?.text ?? '');
  const refactoredText = String(refactoredClip?.text ?? '');
  const normOriginal = normalizeTextForMatch(originalText);
  const normRefactored = normalizeTextForMatch(refactoredText);
  if (!normOriginal || !normRefactored) return null;
  if (normOriginal === normRefactored) return null;

  return {
    sourceClip,
    refactoredClip,
    originalText,
    refactoredText,
    refactoredClipId: refactoredClip?.id,
    sourceClipId: sourceClip?.id,
    ...extra,
  };
}

function backfillRefactorMetaLink(refactoredClip, sourceClipId) {
  if (!refactoredClip || sourceClipId == null) return;
  if (!refactoredClip.meta || typeof refactoredClip.meta !== 'object') {
    refactoredClip.meta = {};
  }
  if (!refactoredClip.meta.craftRefactorSourceId) {
    refactoredClip.meta.craftRefactorSourceId = getClipIdKey(sourceClipId);
  }
  if (refactoredClip.meta.craftRefactor !== true) {
    refactoredClip.meta.craftRefactor = true;
  }
}

function logRefactorPairResolved(clip, pair) {
  console.warn('[PasteCraft:refactor-link]', {
    clipId: getClipIdKey(clip?.id),
    sourceClipId: getClipIdKey(pair.sourceClipId),
    refactoredClipId: getClipIdKey(pair.refactoredClipId),
    resolverPath: pair.resolverPath || 'unknown',
  });
}

function resolveRefactorContextFromHistory(app, clip) {
  const clipId = getClipIdKey(clip?.id);
  const clipText = normalizeTextForMatch(clip?.text);
  if (!clipId && !clipText) return null;

  const entries = app.aiHistoryEntries || [];
  for (const entry of entries) {
    if (entry?.type !== 'refactorization') continue;
    const thread = entry.threads?.[0];
    if (!thread) continue;

    const sourceId = getClipIdKey(thread.sourceClipId);
    const newClipId = getClipIdKey(thread.newClipId);
    const beforeRaw = thread.before || entry.originalText || thread.question || '';
    const afterRaw = thread.after || thread.answer || '';
    const before = normalizeTextForMatch(beforeRaw);
    const after = normalizeTextForMatch(afterRaw);
    if (!before || !after || before === after) continue;

    const idMatch = clipId && (clipId === sourceId || clipId === newClipId);
    const textMatchBefore = clipText && textsMatch(clipText, before);
    const textMatchAfter = clipText && textsMatch(clipText, after);
    if (!idMatch && !textMatchBefore && !textMatchAfter) continue;

    const viewingAfter = textMatchAfter || (clipId && clipId === newClipId);
    const viewingBefore = textMatchBefore || (clipId && clipId === sourceId);

    let sourceClip = findClipAcrossCollections(app, sourceId);
    let refactoredClip = findClipAcrossCollections(app, newClipId);

    if (!sourceClip) {
      sourceClip = viewingBefore
        ? clip
        : findClipByTextMatch(app, beforeRaw, refactoredClip?.id ?? clipId);
    }
    if (!refactoredClip) {
      refactoredClip = viewingAfter
        ? clip
        : findClipByTextMatch(app, afterRaw, sourceClip?.id ?? clipId);
    }

    const resolverPath = idMatch ? 'history-id' : 'history-text';
    const pair = buildRefactorPairResult(
      sourceClip || { id: sourceId || clipId, text: beforeRaw },
      refactoredClip || { id: newClipId || `refactored_${entry.id}`, text: afterRaw },
      { fromHistory: true, historyEntryId: entry.id, resolverPath, synthetic: !refactoredClip?.id || !sourceClip?.id },
    );
    if (pair) return pair;
  }

  return null;
}

function resolveRefactorContextFromLinks(app, clip) {
  const clipId = getClipIdKey(clip?.id);
  const clipText = normalizeTextForMatch(clip?.text);
  const links = app._refactorLinks || [];

  for (const link of links) {
    const sourceId = getClipIdKey(link.sourceClipId);
    const newClipId = getClipIdKey(link.newClipId);
    const before = normalizeTextForMatch(link.before);
    const after = normalizeTextForMatch(link.after);
    if (!before || !after || before === after) continue;

    const matchesSource = (clipId && clipId === sourceId) || textsMatch(clipText, before);
    const matchesRefactored = (clipId && clipId === newClipId) || textsMatch(clipText, after);
    if (!matchesSource && !matchesRefactored) continue;

    let sourceClip = findClipAcrossCollections(app, sourceId);
    let refactoredClip = findClipAcrossCollections(app, newClipId);

    if (!sourceClip && matchesSource) sourceClip = clip;
    if (!refactoredClip && matchesRefactored) refactoredClip = clip;
    if (!sourceClip) sourceClip = findClipByTextMatch(app, before, refactoredClip?.id ?? clipId);
    if (!refactoredClip) refactoredClip = findClipByTextMatch(app, after, sourceClip?.id ?? clipId);

    const pair = buildRefactorPairResult(
      sourceClip || { id: sourceId || clipId, text: before },
      refactoredClip || { id: newClipId || `refactored_link_${sourceId}`, text: after },
      { fromLinks: true, resolverPath: 'content-link' },
    );
    if (pair) return pair;
  }

  return null;
}

function resolveRefactorContextFromContentMatch(app, clip) {
  const clipId = getClipIdKey(clip?.id);
  if (!clipId) return null;

  const all = [...(app.clips || []), ...(app.searchOnlyClips || [])];
  for (const other of all) {
    if (getClipIdKey(other.id) === clipId) continue;
    const linkedSourceId = other?.meta?.craftRefactorSourceId;
    if (linkedSourceId == null || linkedSourceId === '') continue;
    if (getClipIdKey(linkedSourceId) === clipId) {
      return buildRefactorPairResult(clip, other, { resolverPath: 'content-meta' });
    }
  }

  return null;
}

function resolveRefactorContextHeuristicRecent(app, clip) {
  const clipKey = getClipIdKey(clip?.id);
  const clipText = normalizeTextForMatch(clip?.text);
  if (!clipKey || !clipText) return null;

  const clipTs = clip?.timestamp || 0;
  const clipCategory = clip?.category || 'Uncategorized';
  const all = [...(app.clips || []), ...(app.searchOnlyClips || [])];

  const siblingCandidates = all.filter((other) => {
    if (getClipIdKey(other?.id) === clipKey) return false;
    if (!other?.meta?.craftRefactor) return false;
    const sameCategory = (other.category || 'Uncategorized') === clipCategory;
    const timeClose = Math.abs((other.timestamp || 0) - clipTs) <= HEURISTIC_REFACTOR_WINDOW_MS;
    const textDiffers = normalizeTextForMatch(other.text) !== clipText;
    if (!sameCategory || !timeClose || !textDiffers) return false;

    const linkedSourceKey = getClipIdKey(other.meta?.craftRefactorSourceId);
    const sourceTextMatch = textsMatch(other.meta?.craftRefactorSourceText, clip?.text);
    return linkedSourceKey === clipKey || sourceTextMatch;
  });

  if (siblingCandidates.length === 0) return null;

  const refactoredClip = siblingCandidates.sort(
    (a, b) => (b.timestamp || 0) - (a.timestamp || 0),
  )[0];
  const viewingRefactored = isRefactoredSiblingClip(clip);
  const sourceClip = viewingRefactored
    ? findClipAcrossCollections(app, getClipIdKey(clip.meta.craftRefactorSourceId)) || {
        id: getClipIdKey(clip.meta.craftRefactorSourceId),
        text: clip.meta?.craftRefactorSourceText || '',
      }
    : clip;
  const refClip = viewingRefactored ? clip : refactoredClip;

  return buildRefactorPairResult(sourceClip, refClip, { resolverPath: 'heuristic-recent' });
}

function resolveRefactorContext(app, clip) {
  if (!clip) {
    return null;
  }

  const sessionPair = resolveRefactorContextFromSessionIndex(app, clip);
  if (sessionPair) {
    logRefactorPairResolved(clip, sessionPair);
    return sessionPair;
  }

  const viewingRefactoredCopy = isRefactoredSiblingClip(clip);
  const sourceId = viewingRefactoredCopy
    ? getClipIdKey(clip.meta.craftRefactorSourceId)
    : getClipIdKey(clip.id);

  let sourceClip = viewingRefactoredCopy ? findClipAcrossCollections(app, sourceId) : clip;
  let refactoredClip = viewingRefactoredCopy ? clip : null;

  if (viewingRefactoredCopy && !sourceClip) {
    const historyPair = resolveRefactorContextFromHistory(app, clip);
    if (historyPair) {
      logRefactorPairResolved(clip, historyPair);
      return historyPair;
    }
    const linkPair = resolveRefactorContextFromLinks(app, clip);
    if (linkPair) {
      logRefactorPairResolved(clip, linkPair);
      return linkPair;
    }
  }

  if (!refactoredClip) {
    const siblings = findRefactoredSiblingsForSource(app, sourceId);
    if (siblings.length > 0) {
      refactoredClip = siblings.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
    }
  }

  if (sourceClip && refactoredClip) {
    const metaPair = buildRefactorPairResult(sourceClip, refactoredClip, { resolverPath: 'meta' });
    if (metaPair) {
      logRefactorPairResolved(clip, metaPair);
      return metaPair;
    }
  }

  const historyPair = resolveRefactorContextFromHistory(app, clip);
  if (historyPair) {
    if (historyPair.refactoredClip?.id && historyPair.sourceClipId) {
      backfillRefactorMetaLink(historyPair.refactoredClip, historyPair.sourceClipId);
    }
    logRefactorPairResolved(clip, historyPair);
    return historyPair;
  }

  const linkPair = resolveRefactorContextFromLinks(app, clip);
  if (linkPair) {
    if (linkPair.refactoredClip?.id && linkPair.sourceClipId) {
      backfillRefactorMetaLink(linkPair.refactoredClip, linkPair.sourceClipId);
    }
    logRefactorPairResolved(clip, linkPair);
    return linkPair;
  }

  const contentPair = resolveRefactorContextFromContentMatch(app, clip);
  if (contentPair) {
    logRefactorPairResolved(clip, contentPair);
    return contentPair;
  }

  const heuristicPair = resolveRefactorContextHeuristicRecent(app, clip);
  if (heuristicPair) {
    if (heuristicPair.refactoredClip?.id && heuristicPair.sourceClipId) {
      backfillRefactorMetaLink(heuristicPair.refactoredClip, heuristicPair.sourceClipId);
    }
    logRefactorPairResolved(clip, heuristicPair);
    return heuristicPair;
  }

  console.warn('[PasteCraft:refactor-link]', {
    clipId: getClipIdKey(clip.id),
    resolverPath: null,
    message: 'No refactor link for this clip — run AI Refactorization first',
  });
  return null;
}

function buildRefactorSectionHtml(app, label, text) {
  const content = formatClipViewerPlainText.call(app, text);
  return `
    <section class="clip-viewer-refactor-section">
      <div class="clip-viewer-section-label">${app.escapeHtml(label)}</div>
      <div class="clip-viewer-refactor-section-body">${content}</div>
    </section>`;
}

function renderRefactorDualContent(app, renderedEl, rawEl, refactorPair) {
  if (!renderedEl || !refactorPair) return;

  renderedEl.innerHTML = `
    <div class="clip-viewer-refactor-dual">
      ${buildRefactorSectionHtml(app, 'Original clip', refactorPair.originalText)}
      ${buildRefactorSectionHtml(app, 'Refactored clip', refactorPair.refactoredText)}
    </div>`;
  renderedEl.style.display = 'block';

  if (rawEl) {
    rawEl.textContent = '';
    rawEl.style.display = 'none';
  }
}

function buildClipViewerContext(clip) {
  const text = clip && clip.text != null ? String(clip.text) : '';
  const meta = clip && clip.meta && typeof clip.meta === 'object' ? clip.meta : null;
  const clipTitle = getClipTitle(clip);
  const markupType =
    typeof PCMarkup !== 'undefined' ? PCMarkup.detectMarkupType(text, meta) : 'text';
  return { text, meta, clipTitle, markupType };
}

function resolveClipViewerTitle(clipTitle, meta) {
  const trimmed = clipTitle ? String(clipTitle).trim() : '';
  if (trimmed) return trimmed;
  if (meta && meta.kind === 'image') return 'Clip viewer · Image';
  if (meta && meta.kind === 'url') return 'Clip viewer · Link';
  return 'Clip viewer';
}

function renderClipViewerMeta(app, metaEl, meta, markupType, clip) {
  if (!metaEl) return;
  const bits = [];
  if (meta && meta.kind) bits.push(`<strong>Type:</strong> ${app.escapeHtml(meta.kind)}`);
  if (markupType !== 'text') {
    bits.push(`<strong>Format:</strong> ${app.escapeHtml(markupType.toUpperCase())}`);
  }
  if (meta && meta.sourcePageUrl) {
    bits.push(`<strong>From:</strong> ${app.escapeHtml(meta.sourcePageUrl)}`);
  }
  if (clip && typeof clip.timestamp === 'number') {
    bits.push(
      `<strong>Saved:</strong> ${app.escapeHtml(getTimeAgo(clip.timestamp))}`,
    );
  }

  if (bits.length) {
    metaEl.innerHTML = bits.join('<br>');
    metaEl.style.display = 'block';
    return;
  }
  metaEl.textContent = '';
  metaEl.style.display = 'none';
}

function extractClipViewerSource(meta) {
  let srcHtml = '';
  let url = '';
  let imgSrc = '';

  if (meta) {
    if (typeof meta.html === 'string' && meta.html.trim()) srcHtml = meta.html;
    if (typeof meta.url === 'string' && meta.url.trim()) url = meta.url.trim();
    if (meta.image && typeof meta.image === 'object') {
      imgSrc = (meta.image.dataUrl || meta.image.srcUrl || '').trim();
    }
  }

  return { srcHtml, url, imgSrc };
}

async function resolveClipViewerImageSrc(clip, meta) {
  const { imgSrc } = extractClipViewerSource(meta);
  if (
    imgSrc &&
    (imgSrc.startsWith('data:image/') ||
      imgSrc.startsWith('http://') ||
      imgSrc.startsWith('https://'))
  ) {
    return imgSrc;
  }
  const wantsImage =
    meta?.kind === 'image' ||
    meta?.image?.hasImage === true ||
    meta?.captureSource === 'image-picker';
  if (!wantsImage && !imgSrc) return '';
  try {
    const stored = await getClipImage(clip?.id);
    if (stored?.dataUrl) return stored.dataUrl;
  } catch (_) {}
  return imgSrc || '';
}

function buildClipViewerHeaderParts(app, text, meta, url, imgSrc) {
  const headerParts = [];
  let resolvedUrl = url;

  if (!resolvedUrl) {
    const raw = String(text || '').trim();
    if (/^https?:\/\/\S+$/i.test(raw)) resolvedUrl = raw;
  }

  if (resolvedUrl) {
    const safeUrl = app.escapeHtml(resolvedUrl);
    headerParts.push(`
        <div class="clip-viewer-link-card">
          <div class="clip-viewer-section-label">Link</div>
          <a data-pc-open-url="1" href="${safeUrl}" target="_blank" rel="noreferrer">${safeUrl}</a>
        </div>
      `);
  }

  const isRenderableImageSrc =
    imgSrc &&
    (imgSrc.startsWith('data:image/') ||
      imgSrc.startsWith('http://') ||
      imgSrc.startsWith('https://'));

  if (imgSrc && !isRenderableImageSrc) {
    headerParts.push(
      '<div class="clip-viewer-note">Image preview unavailable (non-renderable source).</div>',
    );
  } else if (imgSrc && isRenderableImageSrc) {
    headerParts.push(`
      <div class="clip-viewer-image-actions clip-viewer-image-actions--top">
        <button type="button" class="pc-annotate-open-btn pc-annotate-open-btn--primary" data-action="clip-image-popout">Pop out full screen</button>
      </div>
    `);
    headerParts.push(
      `<img class="clip-viewer-image" data-action="clip-image-annotate" src="${app.escapeHtml(imgSrc)}" alt="Clip image" title="Annotate here" />`,
    );
    headerParts.push(`
      <div class="clip-viewer-image-actions">
        <button type="button" class="pc-annotate-open-btn" data-action="clip-image-annotate">Annotate here · Draw / Text</button>
      </div>
    `);
    if (meta && meta.image && meta.image.tooLarge) {
      headerParts.push(
        '<div class="clip-viewer-note">Image payload too large to embed; showing what is available.</div>',
      );
    }
    if (meta && meta.image && meta.image.exportFailed) {
      headerParts.push(
        '<div class="clip-viewer-note">Image export blocked by the page (canvas/security restrictions).</div>',
      );
    }
  } else if (meta && meta.image && (meta.image.tooLarge || meta.image.hasImage)) {
    headerParts.push(
      '<div class="clip-viewer-note">Image not found in local store. Capture again with Image Picker.</div>',
    );
  }

  return headerParts;
}

function renderClipViewerMainContent(
  app,
  renderedEl,
  text,
  meta,
  markupType,
  headerParts,
  safeText,
) {
  const hasMarkup = markupType !== 'text' && typeof PCMarkup !== 'undefined';
  if (!renderedEl) return hasMarkup;

  if (hasMarkup) {
    const rendered = PCMarkup.renderMarkup(text, meta, { type: markupType });
    if (rendered && typeof rendered.then === 'function') {
      renderedEl.innerHTML =
        headerParts.join('') + '<div class="clip-viewer-note">Rendering diagram...</div>';
      rendered
        .then((rHtml) => {
          renderedEl.innerHTML = headerParts.join('') + rHtml;
        })
        .catch(() => {
          renderedEl.innerHTML =
            headerParts.join('') + `<pre class="clip-viewer-pre">${safeText}</pre>`;
        });
    } else {
      renderedEl.innerHTML = headerParts.join('') + rendered;
    }
    renderedEl.style.display = 'block';
    return hasMarkup;
  }

  renderedEl.innerHTML =
    headerParts.join('') + formatClipViewerPlainText.call(app, text);
  renderedEl.style.display = 'block';
  return hasMarkup;
}

function renderClipViewerRawContent(rawEl, text) {
  if (!rawEl) return;
  rawEl.textContent = text;
  rawEl.style.display = 'none';
}

function setLucideIconOnButton(btn, iconName) {
  if (!btn || !iconName) return;
  btn.querySelector('svg.lucide')?.remove();
  let iconEl = btn.querySelector('i[data-lucide]');
  if (!iconEl) {
    iconEl = document.createElement('i');
    btn.insertBefore(iconEl, btn.firstChild);
  }
  iconEl.setAttribute('data-lucide', iconName);
  window.renderLucideIcons?.(btn);
}

function updateToggleRawPresentation(toggleBtn, showingRaw) {
  if (!toggleBtn) return;
  const tipEl = toggleBtn.querySelector('.pc-tip');
  if (tipEl) tipEl.textContent = showingRaw ? 'View Rendered' : 'View Raw';
  toggleBtn.setAttribute('aria-label', showingRaw ? 'View rendered' : 'View raw');
  setLucideIconOnButton(toggleBtn, showingRaw ? 'eye' : 'file-text');
}

function bindClipViewerToggle(app, toggleBtn, hasMarkup) {
  if (!toggleBtn) return;
  if (!hasMarkup) {
    toggleBtn.style.display = 'none';
    return;
  }

  toggleBtn.style.display = '';
  updateToggleRawPresentation(toggleBtn, false);

  if (toggleBtn.dataset.pcToggleBound === '1') return;
  toggleBtn.dataset.pcToggleBound = '1';
  toggleBtn.addEventListener('click', () => {
    app._clipViewerShowingRaw = !app._clipViewerShowingRaw;
    const renderedEl = document.getElementById('clipViewerRendered');
    const rawEl = document.getElementById('clipViewerRaw');
    const activeToggleBtn = document.getElementById('clipViewerToggleRaw');

    if (app._clipViewerShowingRaw) {
      if (renderedEl) renderedEl.style.display = 'none';
      if (rawEl) rawEl.style.display = 'block';
    } else {
      if (renderedEl) renderedEl.style.display = 'block';
      if (rawEl) rawEl.style.display = 'none';
    }
    updateToggleRawPresentation(activeToggleBtn, app._clipViewerShowingRaw);
  });
}

function bindClipViewerLinkHandler(app, bodyEl) {
  try {
    if (app._clipViewerLinkHandlerAttached || !bodyEl) return;
    bodyEl.addEventListener('click', (e) => {
      const popOutBtn = e?.target?.closest?.('[data-action="clip-image-popout"]');
      if (popOutBtn && bodyEl.contains(popOutBtn)) {
        e.preventDefault();
        popOutClipImageAnnotate(app, { clipId: app.currentClipViewerClip?.id });
        return;
      }
      const annotateBtn = e?.target?.closest?.('[data-action="clip-image-annotate"]');
      if (annotateBtn && bodyEl.contains(annotateBtn)) {
        e.preventDefault();
        const clip = app.currentClipViewerClip;
        const img = bodyEl.querySelector('img.clip-viewer-image');
        openClipImageAnnotate(app, {
          clipId: clip?.id,
          dataUrl: img?.getAttribute('src') || '',
        }).catch(() => {});
        return;
      }
      const link = e && e.target ? e.target.closest('a[data-pc-open-url="1"]') : null;
      if (!link) return;
      e.preventDefault();
      const targetUrl = String(link.getAttribute('href') || '').trim();
      if (!targetUrl) return;
      chrome.tabs.create({ url: targetUrl, active: true }, () => {
        if (chrome.runtime.lastError) {
          window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }
      });
    });
    app._clipViewerLinkHandlerAttached = true;
  } catch (e) {
    // Non-fatal
  }
}

function renderClipViewerSourceHtml(htmlDetails, htmlPre, srcHtml) {
  if (!htmlDetails || !htmlPre) return;
  if (srcHtml) {
    htmlPre.textContent = String(srcHtml);
    htmlDetails.style.display = 'block';
    return;
  }
  htmlPre.textContent = '';
  htmlDetails.style.display = 'none';
}

export async function open(app, clip, sourceContext = 'clips') {
  const {
    modal,
    titleEl,
    metaEl,
    bodyEl,
    renderedEl,
    rawEl,
    htmlDetails,
    htmlPre,
    toggleBtn,
  } = getClipViewerElements();

  if (!modal || !titleEl || !bodyEl) {
    return;
  }

  await ensureRefactorResolverData(app);

  const canonicalClip = findClipAcrossCollections(app, clip?.id) || clip;
  app.currentClipViewerClip = canonicalClip || null;
  app.clipViewerSourceContext = normalizeClipViewerSourceContext(sourceContext);
  app._clipViewerShowingRaw = false;

  const { text, meta, clipTitle, markupType } = buildClipViewerContext(canonicalClip);
  const refactorPair = resolveRefactorContext(app, canonicalClip);
  app._clipViewerRefactorPair = refactorPair;

  titleEl.textContent = resolveClipViewerTitle(clipTitle, meta);
  renderClipViewerMeta(app, metaEl, meta, markupType, canonicalClip);

  const safeText = app.escapeHtml(text);
  const { srcHtml, url } = extractClipViewerSource(meta);
  const imgSrc = await resolveClipViewerImageSrc(canonicalClip, meta);
  const headerParts = buildClipViewerHeaderParts(app, text, meta, url, imgSrc);

  let hasMarkup = false;
  if (refactorPair) {
    renderRefactorDualContent(app, renderedEl, rawEl, refactorPair);
    if (toggleBtn) toggleBtn.style.display = 'none';
  } else {
    hasMarkup = renderClipViewerMainContent(
      app,
      renderedEl,
      text,
      meta,
      markupType,
      headerParts,
      safeText,
    );
    renderClipViewerRawContent(rawEl, text);
    bindClipViewerToggle(app, toggleBtn, hasMarkup);
  }

  bindClipViewerLinkHandler(app, bodyEl);
  renderClipViewerSourceHtml(htmlDetails, htmlPre, srcHtml);

  modal.style.display = 'flex';
  window.renderLucideIcons?.(modal);
}

export function hide(app) {
  const modal = document.getElementById('clipViewerModal');
  if (modal) modal.style.display = 'none';
  app.currentClipViewerClip = null;
  app.clipViewerSourceContext = null;
  app._clipViewerRefactorPair = null;
}

export function runAiSummary(app) {
  closeClipViewerThen(app, ({ text }) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) {
      app.showToast?.('No clip text to summarize', 'error');
      return;
    }
    app.showSummaryModal?.(trimmed);
  });
}

export function runAiBreakdown(app) {
  closeClipViewerThen(app, ({ text }) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) {
      app.showToast?.('No clip text to break down', 'error');
      return;
    }
    app.showBreakdownModal?.(trimmed);
  });
}

export function openGoogleSearchActions(app) {
  const anchor = document.getElementById('clipViewerGoogleSearchBtn');
  const clip = app.currentClipViewerClip;
  if (!anchor || !clip) return;
  openGoogleSearchMenu(app, {
    anchor,
    clip,
    context: app.clipViewerSourceContext || 'clips',
  });
}

export function runAiRefactorization(app) {
  closeClipViewerThen(app, ({ idKeys }) => {
    if (!idKeys.length) {
      app.showToast?.('No clip to refactor', 'error');
      return;
    }
    switchToAiTab();
    app.activateRefactorizationSection?.();
    app._refactorizationSelected = new Set(idKeys.map(String));
    app.renderRefactorizationPanel?.();
  });
}

export async function runAiCraftClips(app) {
  const { idKeys } = captureClipViewerContext(app);
  hide(app);
  if (!idKeys.length) {
    app.showToast?.('No clip to craft', 'error');
    return;
  }
  await app.magicFormat?.();
  app._magicSelected = new Set(idKeys.map(String));
  app._renderMagicPage?.(0);
  app._updateMagicSelectedCount?.();
}

export function runSendToCategories(app) {
  closeClipViewerThen(app, ({ clip, idKeys }) => {
    if (!idKeys.length) {
      app.showToast?.('No clip to categorize', 'error');
      return;
    }
    if (idKeys.length > 1) {
      app.pendingBulkClipIds = idKeys;
      app.pendingText = null;
      app.pendingClipId = null;
    } else {
      app.pendingBulkClipIds = null;
      app.pendingText = clip?.text ?? '';
      app.pendingClipId = idKeys[0];
    }
    app.showCategoryModal?.(true);
  });
}

export async function runSendToNotes(app) {
  closeClipViewerThen(app, async ({ clipObjects }) => {
    if (!clipObjects.length) {
      app.showToast?.('No clip to send to notes', 'error');
      return;
    }
    await app.loadNotes?.();
    if (clipObjects.length > 1) {
      app.pendingBulkClipsForNotes = clipObjects;
      app.pendingClipForNotes = null;
    } else {
      app.pendingBulkClipsForNotes = null;
      app.pendingClipForNotes = clipObjects[0];
    }
    app.showAlbumPicker?.();
  });
}

export async function copyText(app) {
  const clip = app.currentClipViewerClip;
  const text = clip && clip.text != null ? String(clip.text) : '';
  if (!text) return;
  await copyClipToClipboard(app, text);
}
