/**
 * @forward-slice Quick View get/delete commands (background).
 * Mediator routes pcGetQuickViewClips / pcDeleteQuickViewClip here via clips.handler.
 */

import { mergeActiveClipsSources } from '../../shared/clips-local-merge.js';
import { getClipIdKey } from '../../shared/clip-id.js';
import { slimQuickViewClips } from '../../shared/quickview-clips.js';
import { readIndexedDbPayloads, syncClipsToIndexedDb } from './quickview.idb.js';
import { normalizeQuickViewClip } from './quickview.normalize.js';

async function loadDeletedClipIdSet() {
  try {
    const res = await chrome.storage.local.get(['pc_deleted_clips']);
    const tombs = Array.isArray(res?.pc_deleted_clips) ? res.pc_deleted_clips : [];
    return new Set(tombs.map((t) => getClipIdKey(t?.id)).filter(Boolean));
  } catch (_) {
    return new Set();
  }
}

async function enqueueDeleteSyncOperation(tombstones, isArchived) {
  const payload = Array.isArray(tombstones) ? tombstones.filter(Boolean) : [];
  if (payload.length === 0) return;

  const type = isArchived ? 'syncDeletedArchivedClips' : 'syncDeletedClips';
  try {
    const result = await chrome.storage.local.get(['syncQueue']);
    const queue = Array.isArray(result?.syncQueue) ? result.syncQueue : [];
    queue.push({
      type,
      data: payload,
      timestamp: Date.now(),
      id: Date.now() + Math.random(),
    });
    await chrome.storage.local.set({ syncQueue: queue });
  } catch (error) {
    console.warn('⚠️ Failed to enqueue clip delete sync:', error?.message || error);
  }
}

function buildQuickViewMergedList(activeClips, archivedClips, idbClips, deletedIds = null) {
  const active = mergeActiveClipsSources(activeClips, idbClips, deletedIds);
  return [
    ...active.map((clip, index) => normalizeQuickViewClip(clip, index, 'active')).filter(Boolean),
    ...archivedClips
      .map((clip, index) => normalizeQuickViewClip(clip, index, 'archived'))
      .filter(Boolean)
      .map((clip) => ({ ...clip, archived: true })),
  ].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || String(b.id).localeCompare(String(a.id)));
}

const QUICKVIEW_CLIP_ID = (clip) => getClipIdKey(clip?.id ?? clip?.clip_id ?? clip?.clipId ?? '');

async function appendQuickViewTombstone(tombstoneKey, clip, source) {
  const id = QUICKVIEW_CLIP_ID(clip);
  if (!id) return;
  const deletedAt = Date.now();
  const existing = await chrome.storage.local.get([tombstoneKey]);
  const prev = Array.isArray(existing?.[tombstoneKey]) ? existing[tombstoneKey] : [];
  if (prev.some((item) => getClipIdKey(item?.id) === id)) return;
  await chrome.storage.local.set({
    [tombstoneKey]: [
      ...prev,
      {
        ...clip,
        id,
        deletedAt,
        updatedAt: deletedAt,
        source,
      },
    ],
  });
}

export async function getQuickViewClips() {
  const [storage, idbClips, deletedIds] = await Promise.all([
    chrome.storage.local.get(['clips', 'searchOnlyClips']),
    readIndexedDbPayloads('clips'),
    loadDeletedClipIdSet(),
  ]);

  const localActive = Array.isArray(storage?.clips) ? storage.clips : [];
  const active = mergeActiveClipsSources(localActive, idbClips, deletedIds);
  const archived = Array.isArray(storage?.searchOnlyClips) ? storage.searchOnlyClips : [];

  const merged = [
    ...active.map((clip, index) => normalizeQuickViewClip(clip, index, 'active')).filter(Boolean),
    ...archived
      .map((clip, index) => normalizeQuickViewClip(clip, index, 'archived'))
      .filter(Boolean)
      .map((clip) => ({ ...clip, archived: true }))
  ];

  merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || String(b.id).localeCompare(String(a.id)));
  // Strip image dataUrls before messaging — large payloads break Quick View postMessage/sendResponse
  const slimmed = slimQuickViewClips(merged.slice(0, 200));
  return slimmed;
}

export async function deleteQuickViewClip({ clipId, archived = false, index } = {}) {
  const clipIdKey = getClipIdKey(clipId) || String(clipId || '');
  const isArchived = archived === true;
  const [storage, idbClips] = await Promise.all([
    chrome.storage.local.get([
      'clips',
      'searchOnlyClips',
      'pc_deleted_clips',
      'pc_deleted_archived_clips',
    ]),
    readIndexedDbPayloads('clips'),
  ]);

  let clips = Array.isArray(storage?.clips) ? storage.clips : [];
  let archivedClips = Array.isArray(storage?.searchOnlyClips) ? storage.searchOnlyClips : [];
  const deletedIds = new Set(
    (Array.isArray(storage?.pc_deleted_clips) ? storage.pc_deleted_clips : [])
      .map((t) => getClipIdKey(t?.id))
      .filter(Boolean)
  );
  const filterOutById = (arr) => arr.filter((clip) => QUICKVIEW_CLIP_ID(clip) !== clipIdKey);
  const findById = (arr) => arr.find((clip) => QUICKVIEW_CLIP_ID(clip) === clipIdKey);

  let deletedEntity = null;
  let nextClips = clips;
  let nextArchived = archivedClips;

  if (clipIdKey) {
    if (isArchived) {
      deletedEntity = findById(archivedClips);
      nextArchived = filterOutById(archivedClips);
    } else {
      deletedEntity = findById(clips) || findById(idbClips);
      nextClips = filterOutById(clips);
    }
  }

  const idDeleteWorked = isArchived
    ? nextArchived.length !== archivedClips.length
    : (nextClips.length !== clips.length || (!!deletedEntity && !findById(clips)));

  if (!idDeleteWorked && Number.isFinite(index)) {
    const idx = parseInt(index, 10);
    if (!Number.isNaN(idx) && idx >= 0) {
      const merged = buildQuickViewMergedList(clips, archivedClips, idbClips, deletedIds);
      const target = merged[idx];
      const targetId = target?.id != null ? getClipIdKey(target.id) : '';
      if (target?.source === 'archived' && targetId) {
        deletedEntity = archivedClips.find((clip) => QUICKVIEW_CLIP_ID(clip) === targetId);
        nextArchived = archivedClips.filter((clip) => QUICKVIEW_CLIP_ID(clip) !== targetId);
      } else if (target?.source === 'active' && targetId) {
        deletedEntity = findById(clips) || findById(idbClips) || target;
        nextClips = clips.filter((clip) => QUICKVIEW_CLIP_ID(clip) !== targetId);
      }
    }
  }

  let tombstoneRecord = null;
  if (deletedEntity) {
    const deletedAt = Date.now();
    tombstoneRecord = {
      ...deletedEntity,
      id: QUICKVIEW_CLIP_ID(deletedEntity),
      deletedAt,
      updatedAt: deletedAt,
      source: isArchived ? 'archived' : 'active',
    };
    const tombstoneKey = isArchived ? 'pc_deleted_archived_clips' : 'pc_deleted_clips';
    await appendQuickViewTombstone(
      tombstoneKey,
      deletedEntity,
      isArchived ? 'archived' : 'active'
    );
  }

  await chrome.storage.local.set({
    clips: nextClips,
    searchOnlyClips: nextArchived,
    pc_local_updatedAt: Date.now(),
  });

  if (!isArchived) {
    await syncClipsToIndexedDb(nextClips);
  }

  if (tombstoneRecord) {
    await enqueueDeleteSyncOperation([tombstoneRecord], isArchived);
  }

  return getQuickViewClips();
}
