/** Clip page URL / title for AI summary citations. */

const MAX_SOURCE_URL = 400;
const MAX_SOURCE_TITLE = 120;

function _meta(clip) {
  return clip && typeof clip.meta === 'object' && clip.meta ? clip.meta : {};
}

export function getClipSourcePageUrl(clip) {
  const meta = _meta(clip);
  return String(meta.sourcePageUrl || meta.url || clip?.sourcePageUrl || clip?.url || '')
    .trim()
    .slice(0, MAX_SOURCE_URL);
}

export function getClipSourceTitle(clip) {
  const meta = _meta(clip);
  return String(meta.title || meta.pageTitle || clip?.title || '')
    .trim()
    .slice(0, MAX_SOURCE_TITLE);
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

export function joinClipsForSummary(clips) {
  const blocks = (Array.isArray(clips) ? clips : [])
    .map((clip) => formatClipTextWithSource(clip, clipBodyForSummary(clip)))
    .filter(Boolean);
  return blocks.join('\n\n---\n\n');
}
