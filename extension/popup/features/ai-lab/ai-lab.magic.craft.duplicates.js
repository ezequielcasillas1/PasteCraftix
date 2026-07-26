// @forward-slice AI Lab magic — craft duplicate detect / archive
import { _isDuplicateKey } from './ai-lab.magic.analyze.js';

function _clipTextKey(clip) {
  return (clip.text || '').trim().toLowerCase();
}

function _clipAge(clip) {
  return clip.timestamp || clip.createdAt || 0;
}

function _groupTargetClipsByText(app, targetSet) {
  const groups = new Map();
  for (const clip of app.clips) {
    if (!targetSet.has(String(clip.id))) continue;
    const key = _clipTextKey(clip);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(clip);
  }
  return groups;
}

function _youngerThanKeeper(group, keeper) {
  return group.slice(1).filter((clip) => String(clip.id) !== String(keeper.id));
}

function _archiveCandidatesFromGroup(group, stats) {
  if (group.length < 2) return [];
  stats.duplicatesFound += group.length;
  group.sort((a, b) => _clipAge(a) - _clipAge(b));
  return _youngerThanKeeper(group, group[0]);
}

function _collectYoungerDuplicates(groups, stats) {
  const toArchive = [];
  for (const group of groups.values()) {
    toArchive.push(..._archiveCandidatesFromGroup(group, stats));
  }
  return toArchive;
}

function _moveClipsToSearchOnly(app, toArchive) {
  const archiveIds = new Set(toArchive.map((c) => String(c.id)));
  app.clips = app.clips.filter((c) => !archiveIds.has(String(c.id)));
  if (!Array.isArray(app.searchOnlyClips)) app.searchOnlyClips = [];
  for (const clip of toArchive) {
    app.searchOnlyClips.unshift(clip);
  }
}

export function _archiveYoungerDuplicates(app, targetSet, stats) {
  const groups = _groupTargetClipsByText(app, targetSet);
  const toArchive = _collectYoungerDuplicates(groups, stats);
  if (toArchive.length === 0) return;
  _moveClipsToSearchOnly(app, toArchive);
  stats.duplicatesArchived = toArchive.length;
}

function _buildAllClipsDuplicateMap(clips) {
  const dupMap = new Map();
  for (const clip of clips) {
    const key = _clipTextKey(clip);
    if (!key) continue;
    dupMap.set(key, (dupMap.get(key) || 0) + 1);
  }
  return dupMap;
}

function _countDuplicatesInTargets(app, targetSet, dupMap, stats) {
  for (const clip of app.clips) {
    if (!targetSet.has(String(clip.id))) continue;
    const key = _clipTextKey(clip);
    if (_isDuplicateKey(key, dupMap)) stats.duplicatesFound++;
  }
}

export function _detectMagicDuplicates(app, targetSet, stats) {
  const dupMap = _buildAllClipsDuplicateMap(app.clips);
  _countDuplicatesInTargets(app, targetSet, dupMap, stats);
}
