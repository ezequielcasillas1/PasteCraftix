export function findClipLocationById(app, clipId) {
  const idKey = app._clipIdKey(clipId);
  const activeIndex = app.clips.findIndex(c => app._clipIdKey(c?.id) === idKey);
  if (activeIndex >= 0) return { listName: 'clips', index: activeIndex, clip: app.clips[activeIndex] };

  const archivedIndex = app.searchOnlyClips.findIndex(c => app._clipIdKey(c?.id) === idKey);
  if (archivedIndex >= 0) {
    return { listName: 'searchOnlyClips', index: archivedIndex, clip: app.searchOnlyClips[archivedIndex] };
  }

  return null;
}

export function promptEditClipTitle(app, clipId) {
  const location = findClipLocationById(app, clipId);
  if (!location?.clip) {
    app.showToast('Clip not found');
    return;
  }

  const currentTitle = app._clipTitle(location.clip);
  const fallback = app._clipFallbackTitle(location.clip, 80);
  const nextTitle = prompt('Edit clip title (leave blank to clear):', currentTitle || fallback);
  if (nextTitle === null) return;

  updateClipTitleById(app, clipId, nextTitle);
}

export async function updateClipTitleById(app, clipId, title) {
  const idKey = app._clipIdKey(clipId);
  const normalizedTitle = typeof PCClipTitle !== 'undefined'
    ? PCClipTitle.normalizeTitle(title)
    : String(title || '').replace(/\s+/g, ' ').trim().slice(0, 120);

  return app._queueClipOp(async () => {
    const location = findClipLocationById(app, idKey);
    if (!location?.clip) {
      app.showToast('Clip not found');
      return false;
    }

    const snapshot = {
      clips: PasteCraftCRUD.createSnapshot(app.clips),
      searchOnlyClips: PasteCraftCRUD.createSnapshot(app.searchOnlyClips),
      notes: PasteCraftCRUD.createSnapshot(app.notes)
    };

    const updatedAt = Date.now();
    const nextClip = {
      ...location.clip,
      title: normalizedTitle,
      updatedAt
    };

    if (location.listName === 'clips') {
      app.clips[location.index] = nextClip;
    } else {
      app.searchOnlyClips[location.index] = nextClip;
    }

    const changedNotes = updateNoteClipTitlesById(app, idKey, normalizedTitle, updatedAt);

    try {
      await PasteCraftCRUD.retryOperation(async () => {
        await chrome.storage.local.set({
          clips: app.clips,
          searchOnlyClips: app.searchOnlyClips,
          notes: app.notes,
          pc_local_updatedAt: updatedAt
        });
      });

      const verification = await chrome.storage.local.get(['clips', 'searchOnlyClips']);
      const verifiedPool = [...(verification.clips || []), ...(verification.searchOnlyClips || [])];
      const verifiedClip = verifiedPool.find(c => app._clipIdKey(c?.id) === idKey);
      if (!verifiedClip || app._clipTitle(verifiedClip) !== normalizedTitle) {
        throw new Error('Verification failed: clip title was not persisted');
      }

      const syncName = location.listName === 'clips' ? 'syncClips' : 'syncArchivedClips';
      const syncFn = location.listName === 'clips'
        ? pasteCraftSupabase.syncClipsToSupabase
        : pasteCraftSupabase.syncArchivedClipsToSupabase;
      Promise.resolve()
        .then(() => pasteCraftSupabase.syncWithQueue(syncName, [nextClip], syncFn))
        .catch((error) => console.error('Failed to sync clip title:', error));

      if (changedNotes.length > 0) {
        Promise.resolve()
          .then(() => pasteCraftSupabase.syncWithQueue('syncNotes', changedNotes, pasteCraftSupabase.syncNotesToSupabase))
          .catch((error) => console.error('Failed to sync note clip titles:', error));
      }

      app.renderChips();
      app.renderSearchResults();
      app.renderCategories();
      app.renderNotes();
      app.showToast(normalizedTitle ? 'Clip title updated' : 'Clip title cleared');
      return true;
    } catch (error) {
      app.clips = snapshot.clips;
      app.searchOnlyClips = snapshot.searchOnlyClips;
      app.notes = snapshot.notes;
      await chrome.storage.local.set({
        clips: app.clips,
        searchOnlyClips: app.searchOnlyClips,
        notes: app.notes,
        pc_local_updatedAt: Date.now()
      });
      console.error('? Clip title update failed:', error);
      app.showToast('Failed to update clip title');
      return false;
    }
  });
}

export function updateNoteClipTitlesById(app, clipId, title, updatedAt) {
  const changedNotes = [];
  const idKey = app._clipIdKey(clipId);

  (app.notes || []).forEach(note => {
    if (!Array.isArray(note?.clips)) return;
    let changed = false;
    note.clips = note.clips.map(clip => {
      if (app._clipIdKey(clip?.id) !== idKey) return clip;
      changed = true;
      return { ...clip, title };
    });
    if (changed) {
      note.updatedAt = updatedAt;
      changedNotes.push(PasteCraftCRUD.createSnapshot(note));
    }
  });

  return changedNotes;
}
