/**
 * @forward-slice Quick View clip shape normalization.
 */

export function hashTextForQuickView(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function normalizeQuickViewClip(clip, index, source) {
  if (typeof clip === 'string') {
    const timestamp = Date.now();
    return {
      id: `${timestamp}_${hashTextForQuickView(clip)}_${index}`,
      text: clip,
      category: 'Uncategorized',
      timestamp,
      source
    };
  }

  if (!clip || typeof clip !== 'object') return null;
  const text = clip.text ?? clip;
  if (!text) return null;
  const timestamp = typeof clip.timestamp === 'number' ? clip.timestamp : Date.now();
  const id = clip.id ?? clip.clip_id ?? clip.clipId ?? `${timestamp}_${hashTextForQuickView(text)}_${index}`;

  return {
    ...clip,
    id: String(id),
    text: String(text),
    category: clip.category || 'Uncategorized',
    timestamp,
    source
  };
}
