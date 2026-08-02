/**
 * Quick View — clip load / storage fetch (DOM panel path).
 * @forward-slice
 */
import { slimQuickViewClips } from '../../shared/quickview-clips.js';
import { getLikedClipIds } from './widget.liked-clips.js';
import { renderQuickViewList } from './widget.quickview.render.js';

export function ensureQvState(widget) {
  if (!widget._qvState) {
    widget._qvState = {
      allClips: [],
      likedIdSet: new Set(),
      likedFilterOn: false,
    };
  }
  return widget._qvState;
}

export async function loadClipsFromLocalStorage() {
  try {
    const result = await chrome.storage.local.get(['clips', 'searchOnlyClips']);
    const active = Array.isArray(result?.clips) ? result.clips : [];
    const archived = Array.isArray(result?.searchOnlyClips) ? result.searchOnlyClips : [];
    return slimQuickViewClips([
      ...active.map((clip) => ({ ...clip, source: clip?.source || 'active' })),
      ...archived.map((clip) => ({ ...clip, archived: true, source: 'archived' })),
    ]);
  } catch (_) {
    return [];
  }
}

export async function loadQuickViewClips(widget) {
  const state = ensureQvState(widget);
  try {
    let response = null;
    try {
      response = await chrome.runtime.sendMessage({ action: 'pcGetQuickViewClips' });
    } catch (err) {
      response = { success: false, error: String(err?.message || err), clips: [] };
    }

    let clips = response?.success && Array.isArray(response.clips) ? response.clips : [];

    // Background miss / SW failure → read chrome.storage.local in-content.
    if (!response?.success || clips.length === 0) {
      const localClips = await loadClipsFromLocalStorage();
      if (localClips.length > 0) {
        clips = localClips;
      }
    }

    state.allClips = slimQuickViewClips(clips);
    state.likedIdSet = new Set(await getLikedClipIds());
    renderQuickViewList(widget);
  } catch (err) {
    try {
      state.allClips = await loadClipsFromLocalStorage();
      state.likedIdSet = new Set(await getLikedClipIds());
    } catch (_) {
      state.allClips = [];
    }
    renderQuickViewList(widget);
  }
}
