/** Map Supabase clip rows to local clip shape. */

export function mapDbClipToLocal(clip) {
  return {
    id: clip.clip_id,
    text: clip.text,
    title: clip.title || '',
    category: clip.category,
    timestamp: clip.timestamp,
    updatedAt: clip.updated_at ? Date.parse(clip.updated_at) : clip.timestamp,
    deletedAt: clip.deleted_at ? Date.parse(clip.deleted_at) : null,
    deviceId: clip.device_id || null
  };
}

/** Page fetch shape (active clips): includes meta, omits deletedAt. */
export function mapDbClipToLocalPage(clip) {
  return {
    id: clip.clip_id,
    text: clip.text,
    title: clip.title || '',
    category: clip.category,
    timestamp: clip.timestamp,
    updatedAt: clip.updated_at ? Date.parse(clip.updated_at) : clip.timestamp,
    deviceId: clip.device_id || null,
    meta: clip.meta || undefined
  };
}
