/**
 * @forward-slice ACL — clip writes for popup/content slices.
 * Resolves legacy globals (PasteCraftCRUD, Supabase, IDB) for ES module callers.
 */
import { CLIPS_STORAGE_KEYS, CLIPS_SYNC_QUEUE_KEYS } from '../../popup/features/clips/clips.constants.js';
import {
  getIndexedDb,
  syncIndexedDbEntityFromLocalStorage,
} from '../storage/indexeddb.facade.js';

function resolveCrud() {
  const crud = globalThis.PasteCraftCRUD ?? globalThis.window?.PasteCraftCRUD;
  if (!crud) throw new Error('PasteCraftCRUD not loaded');
  return crud;
}

function resolveSupabase() {
  return globalThis.pasteCraftSupabase ?? null;
}

export function getClipWriteCrud() {
  return resolveCrud();
}

export async function persistClipTitleState({ clips, searchOnlyClips, notes }) {
  await chrome.storage.local.set({
    clips: Array.isArray(clips) ? clips : [],
    searchOnlyClips: Array.isArray(searchOnlyClips) ? searchOnlyClips : [],
    notes: Array.isArray(notes) ? notes : [],
    pc_local_updatedAt: Date.now(),
  });

  if (getIndexedDb()?.syncEntityFromLocalStorage) {
    await syncIndexedDbEntityFromLocalStorage(
      CLIPS_STORAGE_KEYS.ACTIVE,
      Array.isArray(clips) ? clips : [],
    );
    await syncIndexedDbEntityFromLocalStorage(
      'notes',
      Array.isArray(notes) ? notes : [],
    );
  }
}

export async function queueClipTitleSync({ listName, nextClip, changedNotes = [] }) {
  const supabase = resolveSupabase();
  if (!supabase?.syncWithQueue || !nextClip) return;

  try {
    const userId = await supabase.getSyncUserId?.();
    if (!userId) return;
    const hasAccess = await supabase.hasCloudSyncAccess?.(userId);
    if (!hasAccess) return;
  } catch (_) {
    return;
  }

  const syncName = listName === 'clips'
    ? CLIPS_SYNC_QUEUE_KEYS.ACTIVE
    : CLIPS_SYNC_QUEUE_KEYS.ARCHIVED;
  const syncFn = listName === 'clips'
    ? supabase.syncClipsToSupabase
    : supabase.syncArchivedClipsToSupabase;

  await supabase.syncWithQueue(syncName, [nextClip], syncFn);

  if (changedNotes.length > 0 && supabase.syncNotesToSupabase) {
    await supabase.syncWithQueue('syncNotes', changedNotes, supabase.syncNotesToSupabase);
  }
}
