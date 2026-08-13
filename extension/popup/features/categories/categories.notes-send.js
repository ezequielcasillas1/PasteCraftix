/**
 * Category adapter for the notes send catalog.
 * Categories do not import notes — they queue clips through the app facade.
 * @forward-slice categories
 */

function clipsInCategory(app, categoryName) {
  const name = String(categoryName || '').trim();
  if (!name) return [];
  const all = [...(app.clips || []), ...(app.searchOnlyClips || [])];
  return all.filter((clip) => String(clip?.category || '').trim() === name);
}

export async function sendCategoryToNotes(app, category) {
  const name = String(category?.name || '').trim();
  const clips = clipsInCategory(app, name);
  return app.queueClipsForNotes?.(clips, {
    emptyMessage: name
      ? `"${name}" has no clips to send to notes`
      : 'No clip to send to notes',
  });
}
