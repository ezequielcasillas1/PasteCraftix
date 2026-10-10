/** Local Learn catalog. Search never calls the network. */

import { KEYWORD_PAGINATION } from './keywords.constants.js';
import { paginateSlice } from './keywords.pagination.js';
import { STUDY_SECTOR_GROUPS } from './keywords.study-sectors.js';

function normalizeLearnQuery(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function matchesText(value, query) {
  return String(value || '').toLowerCase().includes(query);
}

function matchesKeyword(keyword, query) {
  if (matchesText(keyword.title, query)) return true;
  return keyword.aliases.some((alias) => matchesText(alias, query));
}

function matchesSubject(entry, query) {
  if (matchesText(entry.title, query)) return true;
  return entry.aliases.some((alias) => matchesText(alias, query));
}

function rankText(title, aliases, query) {
  const name = String(title || '').toLowerCase();
  const keys = (aliases || []).map((alias) => alias.toLowerCase());
  if (name === query || keys.includes(query)) return 0;
  if (name.startsWith(query) || keys.some((alias) => alias.startsWith(query))) return 1;
  return 2;
}

export function listLearnGroups() {
  return STUDY_SECTOR_GROUPS;
}

function subjectCards(group) {
  return group.entries.map((entry) => ({
    title: entry.title,
    groupId: group.id,
    groupLabel: group.label,
    keywordCount: entry.keywords?.length || 0,
  }));
}

function keywordCards(group, entry, query) {
  return (entry.keywords || [])
    .filter((keyword) => matchesKeyword(keyword, query))
    .map((keyword) => ({
      title: keyword.title,
      groupId: group.id,
      groupLabel: group.label,
      subjectTitle: entry.title,
      keywordCount: 0,
      rank: rankText(keyword.title, keyword.aliases, query),
    }));
}

/** Titles in one group. An empty query returns subjects. A search returns matching keywords. */
export function searchLearnCatalog(query, groupId) {
  const q = normalizeLearnQuery(query);
  const groups = STUDY_SECTOR_GROUPS.filter((group) => group.id === groupId);
  if (!q) return groups.flatMap((group) => subjectCards(group));
  const cards = [];
  for (const group of groups) {
    for (const entry of group.entries) {
      if (matchesSubject(entry, q)) {
        cards.push({
          title: entry.title,
          groupId: group.id,
          groupLabel: group.label,
          keywordCount: entry.keywords?.length || 0,
          rank: rankText(entry.title, entry.aliases, q),
        });
      }
      cards.push(...keywordCards(group, entry, q));
    }
  }
  return cards
    .sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title))
    .map(({ rank, ...card }) => card);
}

export function subjectKeywords(groupId, subjectTitle) {
  const group = STUDY_SECTOR_GROUPS.find((item) => item.id === groupId);
  const subject = group?.entries.find((entry) => entry.title === subjectTitle);
  return subject?.keywords || [];
}

/** Keywords written for one subject. An empty query returns that list only. */
export function searchSubjectKeywords(query, groupId, subjectTitle) {
  const q = normalizeLearnQuery(query);
  return subjectKeywords(groupId, subjectTitle)
    .filter((keyword) => !q || matchesKeyword(keyword, q))
    .map((keyword) => ({
      title: keyword.title,
      groupId,
      subjectTitle,
      rank: q ? rankText(keyword.title, keyword.aliases, q) : 1,
    }))
    .sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title))
    .map(({ rank, ...card }) => card);
}

/** Best keyword or subject to define while the search box has a real query. */
export function pickBestLearnKeyword(query, groupId, subjectTitle = '') {
  const q = normalizeLearnQuery(query);
  if (q.length < 3) return null;
  const hits = subjectTitle
    ? searchSubjectKeywords(q, groupId, subjectTitle)
    : searchLearnCatalog(q, groupId);
  return hits[0] || null;
}

export function pageSubjectKeywords({ query = '', groupId = '', subjectTitle = '', page = 0 } = {}) {
  const matches = searchSubjectKeywords(query, groupId, subjectTitle);
  return paginateSlice(matches, page, KEYWORD_PAGINATION.LEARN_PER_PAGE);
}

export function pageLearnCatalog({ query = '', groupId = '', page = 0 } = {}) {
  const matches = searchLearnCatalog(query, groupId);
  const group = STUDY_SECTOR_GROUPS.find((item) => item.id === groupId);
  return {
    groups: STUDY_SECTOR_GROUPS,
    hasKeywordLists: !!group?.entries.some((entry) => entry.keywords?.length),
    ...paginateSlice(matches, page, KEYWORD_PAGINATION.LEARN_PER_PAGE),
  };
}

/** Bank row for a Wikipedia summary opened from Learn. */
export function learnBankDraft(entry) {
  if (!entry?.found) return null;
  const text = String(entry.word || '').trim().slice(0, 120);
  const key = text.toLowerCase().replace(/\s+/g, ' ');
  if (!key) return null;
  return {
    key,
    text,
    sourceLabel: 'Learn',
    clipId: null,
    kind: 'entry',
    phonetic: '',
    senses: Array.isArray(entry.senses) ? entry.senses : [],
    parts: [],
  };
}
