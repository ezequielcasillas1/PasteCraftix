/** Lightweight clip payloads for Quick View postMessage (strip image dataUrls / heavy meta). */

export const QV_TRANSPORT_MAX_ITEMS = 80;
export const QV_TRANSPORT_MAX_TEXT = 400;

export function slimQuickViewClip(clip, options = {}) {
  if (clip == null) return null;
  const maxText = Number.isFinite(options.maxText) ? options.maxText : null;

  if (typeof clip === 'string') {
    let text = clip.trim();
    if (!text) return null;
    if (maxText != null && text.length > maxText) text = `${text.slice(0, maxText)}…`;
    return { id: '', text, category: 'Uncategorized', timestamp: 0, source: 'active' };
  }
  if (typeof clip !== 'object') return null;

  let text = String(clip.text ?? '').trim();
  if (!text) return null;
  if (maxText != null && text.length > maxText) text = `${text.slice(0, maxText)}…`;

  const id = clip.id ?? clip.clip_id ?? clip.clipId;
  const meta = clip.meta && typeof clip.meta === 'object' ? clip.meta : null;
  let lightMeta = null;
  if (meta) {
    lightMeta = {
      kind: typeof meta.kind === 'string' ? meta.kind : 'text',
      captureSource: meta.captureSource || undefined,
    };
    if (meta.image && typeof meta.image === 'object') {
      lightMeta.image = {
        mime: meta.image.mime || '',
        srcUrl: meta.image.srcUrl || '',
        tooLarge: meta.image.tooLarge === true || !!meta.image.dataUrl,
        hasImage: !!(meta.image.dataUrl || meta.image.srcUrl),
      };
    }
  }

  return {
    id: id != null ? String(id) : '',
    text,
    category: clip.category || 'Uncategorized',
    timestamp: typeof clip.timestamp === 'number' ? clip.timestamp : 0,
    updatedAt: typeof clip.updatedAt === 'number' ? clip.updatedAt : undefined,
    archived: clip.archived === true,
    source: clip.source || (clip.archived ? 'archived' : 'active'),
    ...(lightMeta ? { meta: lightMeta } : {}),
  };
}

export function slimQuickViewClips(clips, options = {}) {
  if (!Array.isArray(clips)) return [];
  const maxItems = Number.isFinite(options.maxItems) ? options.maxItems : null;
  const list = maxItems != null ? clips.slice(0, maxItems) : clips;
  return list.map((c) => slimQuickViewClip(c, options)).filter(Boolean);
}

/** Safe payload for srcdoc postMessage — capped count + truncated text. */
export function toQuickViewTransportClips(clips) {
  return slimQuickViewClips(clips, {
    maxItems: QV_TRANSPORT_MAX_ITEMS,
    maxText: QV_TRANSPORT_MAX_TEXT,
  });
}
