/** Client fallback so AI Summary always shows Sources from clip metadata. */

const MAX_SOURCE_URL = 400;
const MAX_SOURCE_TITLE = 120;
const MAX_LOOSE_URLS = 8;
const SOURCE_LABEL_RE = /\[Source:\s*([^\]]+)\]/gi;
const SOURCES_HEADING_RE = /^#{1,3}\s*sources?\b/im;
const HTTP_URL_RE = /https?:\/\/[^\s<>\[\]()|'"]+/gi;
const CITE_MARK_RE = /\[(\d+)\]/g;

function isHttpUrl(value) {
  return /^https?:\/\/\S+$/i.test(String(value || '').trim());
}

function isUnsafeScheme(value) {
  return /^[a-z][a-z0-9+.-]*:/i.test(String(value || '').trim()) && !isHttpUrl(value);
}

function cleanUrl(value) {
  const raw = String(value || '').trim().replace(/[.,;:!?)]+$/, '');
  if (!isHttpUrl(raw) || isUnsafeScheme(raw)) return '';
  return raw.slice(0, MAX_SOURCE_URL);
}

function cleanTitle(value) {
  return String(value || '').trim().slice(0, MAX_SOURCE_TITLE);
}

function assignSourcePart(acc, part) {
  if (isUnsafeScheme(part)) return acc;
  const url = cleanUrl(part);
  if (url && !acc.url) return { title: acc.title, url };
  if (!acc.title) return { title: cleanTitle(part), url: acc.url };
  return acc;
}

function parseSourceLabel(label) {
  const parts = String(label || '').split('|').map((part) => part.trim()).filter(Boolean);
  const parsed = parts.reduce(assignSourcePart, { title: '', url: '' });
  if (!parsed.title && !parsed.url) return null;
  return parsed;
}

function sourceKey(item) {
  if (item?.url) return `url:${item.url}`;
  return `title:${item?.title || ''}`;
}

function isUsableSource(item) {
  return Boolean(item && (item.title || item.url));
}

function pushUnique(list, seen, item) {
  if (!isUsableSource(item)) return;
  const key = sourceKey(item);
  if (seen.has(key)) return;
  seen.add(key);
  list.push(item);
}

export function normalizeSource(item) {
  if (!item || typeof item !== 'object') return null;
  const url = cleanUrl(item.url);
  const title = cleanTitle(item.title);
  if (!title && !url) return null;
  const domain = cleanTitle(item.domain) || sourceHostname(url);
  const next = { title, url };
  if (domain) next.domain = domain;
  return next;
}

export function normalizeSourceList(list) {
  const sources = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((item) => {
    pushUnique(sources, seen, normalizeSource(item));
  });
  return sources;
}

export function hasSourcesSection(text) {
  return SOURCES_HEADING_RE.test(String(text || ''));
}

export function parseSourceLabels(text) {
  const sources = [];
  const seen = new Set();
  const raw = String(text || '');
  SOURCE_LABEL_RE.lastIndex = 0;
  let match = SOURCE_LABEL_RE.exec(raw);
  while (match) {
    pushUnique(sources, seen, parseSourceLabel(match[1]));
    match = SOURCE_LABEL_RE.exec(raw);
  }
  return sources;
}

export function extractHttpUrls(text) {
  const sources = [];
  const seen = new Set();
  const raw = String(text || '');
  HTTP_URL_RE.lastIndex = 0;
  let match = HTTP_URL_RE.exec(raw);
  while (match && sources.length < MAX_LOOSE_URLS) {
    const url = cleanUrl(match[0]);
    pushUnique(sources, seen, url ? { title: '', url } : null);
    match = HTTP_URL_RE.exec(raw);
  }
  return sources;
}

export function collectSummarySources(sourceText) {
  const labeled = parseSourceLabels(sourceText);
  return labeled.length ? labeled : extractHttpUrls(sourceText);
}

export function mergeSummarySources(...groups) {
  const sources = [];
  const seen = new Set();
  groups.forEach((group) => {
    if (typeof group === 'string') {
      collectSummarySources(group).forEach((item) => pushUnique(sources, seen, item));
      return;
    }
    normalizeSourceList(group).forEach((item) => pushUnique(sources, seen, item));
  });
  return sources;
}

export function parseSourcesFromSection(sourcesMarkdown) {
  const sources = [];
  const seen = new Set();
  String(sourcesMarkdown || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s+/, '').replace(/^\*\*Source(?:\s+\d+)?:\*\*\s*/i, '').trim())
    .filter((line) => line && !SOURCES_HEADING_RE.test(line))
    .forEach((line) => {
      const urlMatch = line.match(/https?:\/\/[^\s<>\[\]()|'"]+/i);
      const url = urlMatch ? cleanUrl(urlMatch[0]) : '';
      const title = cleanTitle(
        line
          .replace(/https?:\/\/[^\s<>\[\]()|'"]+/gi, '')
          .replace(/[—–|-]+/g, ' ')
          .replace(/^["“]|["”]$/g, '')
          .trim(),
      );
      pushUnique(sources, seen, title || url ? { title, url } : null);
    });
  return sources;
}

export function formatSourcesMarkdown(sources) {
  const list = normalizeSourceList(sources);
  if (!list.length) return '';
  const lines = list.map((item, index) => {
    const n = index + 1;
    const label = [item.title, item.url].filter(Boolean).join(' — ');
    return `- **Source ${n}:** ${label}`;
  });
  return `## Sources\n${lines.join('\n')}`;
}

export function sourceHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch (_) {
    return '';
  }
}

export function extractCitationIndexes(text) {
  const found = new Set();
  const raw = String(text || '');
  CITE_MARK_RE.lastIndex = 0;
  let match = CITE_MARK_RE.exec(raw);
  while (match) {
    const n = Number(match[1]);
    if (n >= 1) found.add(n);
    match = CITE_MARK_RE.exec(raw);
  }
  return [...found].sort((a, b) => a - b);
}

export function ensureCitationMarkers(body, sources) {
  const list = normalizeSourceList(sources);
  const text = String(body || '').trim();
  if (!list.length) return text;
  const existing = new Set(extractCitationIndexes(text));
  const missing = list.map((_, index) => index + 1).filter((n) => !existing.has(n));
  if (!missing.length) return text;
  const marks = missing.map((n) => `[${n}]`).join('');
  return text ? `${text} ${marks}` : marks;
}

export function attachSourceLabels(text, extraSources) {
  const body = String(text || '');
  const sources = mergeSummarySources(extraSources, body);
  if (!sources.length || parseSourceLabels(body).length) return body;
  const lines = sources.map((item) => {
    const label = [item.title, item.url].filter(Boolean).join(' | ');
    return `[Source: ${label}]`;
  });
  return body ? `${lines.join('\n')}\n${body}` : lines.join('\n');
}

function knownSources(sourceText, extraSources) {
  return mergeSummarySources(extraSources, sourceText);
}

function sanitizeSectionSources(fromSection, known) {
  const allowUrls = new Set(known.map((item) => item.url).filter(Boolean));
  const allowTitles = new Set(known.filter((item) => !item.url && item.title).map((item) => item.title));
  return normalizeSourceList(fromSection).filter((item) => {
    if (item.url) return allowUrls.has(item.url);
    return allowTitles.has(item.title);
  });
}

function resolveMergedSources(responseText, sourceText, extraSources) {
  const raw = String(responseText || '');
  const { body, sourcesMarkdown } = splitSourcesSection(raw);
  const fromSection = parseSourcesFromSection(sourcesMarkdown);
  const known = knownSources(sourceText, extraSources);
  const sanitized = sanitizeSectionSources(fromSection, known);
  return {
    body,
    sourcesMarkdown,
    fromSection: sanitized,
    sources: mergeSummarySources(sanitized, known),
  };
}

function joinBodyAndBlock(body, block) {
  if (!block) return body;
  return body ? `${body}\n\n${block}` : block;
}

function sourcesBlockFor(resolved) {
  return formatSourcesMarkdown(resolved.sources);
}

export function ensureSummarySources(responseText, sourceText, extraSources) {
  const response = String(responseText || '').trim();
  const resolved = resolveMergedSources(response, sourceText, extraSources);
  const fallbackBody = resolved.fromSection.length ? '' : response;
  const marked = ensureCitationMarkers(resolved.body || fallbackBody, resolved.sources);
  return joinBodyAndBlock(marked, sourcesBlockFor(resolved)) || response;
}

export function splitSourcesSection(text) {
  const raw = String(text || '');
  const idx = raw.search(SOURCES_HEADING_RE);
  if (idx < 0) return { body: raw, sourcesMarkdown: '' };
  return {
    body: raw.slice(0, idx).trim(),
    sourcesMarkdown: raw.slice(idx).trim(),
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function resolveSourcesForDisplay(responseText, sourceText, extraSources) {
  const ensured = ensureSummarySources(responseText, sourceText, extraSources);
  const { body, sources } = resolveMergedSources(ensured, sourceText, extraSources);
  const markedBody = ensureCitationMarkers(body, sources);
  return { body: markedBody, sources, text: ensured };
}

export function applyCitationMarkup(html, sources) {
  const max = normalizeSourceList(sources).length;
  if (!max) return String(html || '');
  return String(html || '').replace(/\[(\d+)\]/g, (match, n) => {
    const idx = Number(n);
    if (idx < 1 || idx > max) return match;
    return `<button type="button" class="pc-ai-cite" data-action="ai-cite" data-cite="${idx}" aria-label="Jump to source ${idx}">${idx}</button>`;
  });
}

function sourceCardTitle(item, domain) {
  return item.title || domain || item.url || `Source`;
}

function renderSourceCard(item, index) {
  const n = index + 1;
  const url = item.url && isHttpUrl(item.url) ? item.url : '';
  const domain = url ? sourceHostname(url) : '';
  const title = escapeHtml(sourceCardTitle(item, domain));
  const titleHtml = url
    ? `<a class="pc-ai-source-title" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${title}</a>`
    : `<span class="pc-ai-source-title">${title}</span>`;
  const domainHtml = domain
    ? `<span class="pc-ai-source-domain">${escapeHtml(domain)}</span>`
    : '';
  const urlHtml = url && domain !== item.url
    ? `<span class="pc-ai-source-url">${escapeHtml(url)}</span>`
    : '';
  return `<li class="pc-ai-source-card" id="pc-ai-source-${n}" data-cite-card="${n}"><span class="pc-ai-source-index" aria-hidden="true">${n}</span><div class="pc-ai-source-meta">${titleHtml}${domainHtml}${urlHtml}</div></li>`;
}

export function renderSourcesPanelHtml(sources) {
  const list = normalizeSourceList(sources);
  if (!list.length) return '';
  const items = list.map(renderSourceCard).join('');
  return `<div class="pc-ai-sources" data-field="ai-sources"><h2 class="pc-ai-sources-heading">Sources</h2><ol class="pc-ai-sources-cards">${items}</ol></div>`;
}

export function getHistoryEntrySources(entry) {
  return mergeSummarySources(entry?.sources, entry?.threads?.[0]?.sources);
}
