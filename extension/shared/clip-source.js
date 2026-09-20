/** Clip page URL / title for AI summary citations. */

const MAX_SOURCE_URL = 400;
const MAX_SOURCE_TITLE = 120;
const URL_KEYS = ['sourcePageUrl', 'url', 'pageUrl', 'sourceUrl'];
const TITLE_KEYS = ['sourcePageTitle', 'pageTitle', 'title'];

function _meta(clip) {
  return clip && typeof clip.meta === 'object' && clip.meta ? clip.meta : {};
}

function _firstHttpUrl(values) {
  for (const value of values) {
    const raw = String(value || '').trim();
    if (/^https?:\/\/\S+$/i.test(raw)) return raw.slice(0, MAX_SOURCE_URL);
  }
  return '';
}

function _firstTitle(values) {
  for (const value of values) {
    const raw = String(value || '').trim();
    if (raw) return raw.slice(0, MAX_SOURCE_TITLE);
  }
  return '';
}

export function getClipSourcePageUrl(clip) {
  const meta = _meta(clip);
  return _firstHttpUrl([
    ...URL_KEYS.map((key) => meta[key]),
    ...URL_KEYS.map((key) => clip?.[key]),
  ]);
}

export function getClipSourceTitle(clip) {
  const meta = _meta(clip);
  return _firstTitle([
    ...TITLE_KEYS.map((key) => meta[key]),
    ...TITLE_KEYS.map((key) => clip?.[key]),
  ]);
}

export function collectClipSources(clips) {
  const sources = [];
  const seen = new Set();
  (Array.isArray(clips) ? clips : []).forEach((clip) => {
    const url = getClipSourcePageUrl(clip);
    const title = getClipSourceTitle(clip);
    if (!url && !title) return;
    const key = `${title}|${url}`;
    if (seen.has(key)) return;
    seen.add(key);
    sources.push({ title, url });
  });
  return sources;
}

export function formatClipTextWithSource(clip, text) {
  const body = String(text || '').trim();
  const url = getClipSourcePageUrl(clip);
  const title = getClipSourceTitle(clip);
  if (!url && !title) return body;
  const label = [title, url].filter(Boolean).join(' | ');
  return body ? `[Source: ${label}]\n${body}` : `[Source: ${label}]`;
}

export function clipBodyForSummary(clip) {
  return String(clip?.text ?? '').trim() || String(clip?.meta?.plainText ?? '').trim();
}

export function joinClipBodiesForSummary(clips) {
  const blocks = (Array.isArray(clips) ? clips : [])
    .map((clip) => clipBodyForSummary(clip))
    .filter(Boolean);
  return blocks.join('\n\n---\n\n');
}

export function joinClipsForSummary(clips) {
  const blocks = (Array.isArray(clips) ? clips : [])
    .map((clip) => formatClipTextWithSource(clip, clipBodyForSummary(clip)))
    .filter(Boolean);
  return blocks.join('\n\n---\n\n');
}
