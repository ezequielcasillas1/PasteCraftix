/** Learn catalog markup inside the Keywords tab. */

import { KEYWORD_ACTIONS, KEYWORD_COPY, LEARN_GROUP_SHORT_LABELS } from './keywords.constants.js';
import { getGamesCatalog } from './keywords.games.js';
import { pageLearnCatalog, pageSubjectKeywords } from './keywords.learn.js';
import { filterKeywords, renderPaginationControls } from './keywords.pagination.js';
import { escapeHtml } from './keywords.render.js';

function safeWikiHref(url) {
  try {
    const parsed = new URL(String(url || ''));
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'en.wikipedia.org') return '';
    return parsed.href;
  } catch {
    return '';
  }
}

function renderGroups(app, groups, selectedId) {
  return groups.map((group) => {
    const pressed = group.id === selectedId;
    const label = LEARN_GROUP_SHORT_LABELS[group.id] || group.label;
    const count = Array.isArray(group.entries) ? `<span class="keywords-chip-count">${group.entries.length}</span>` : '';
    return `<button type="button" class="keywords-learn-group${pressed ? ' is-on' : ''}" data-action="${KEYWORD_ACTIONS.LEARN_GROUP}" data-group="${escapeHtml(app, group.id)}" aria-pressed="${pressed ? 'true' : 'false'}" title="${escapeHtml(app, group.label)}">${escapeHtml(app, label)}${count}</button>`;
  }).join('');
}

function renderCards(app, cards, openTitle) {
  if (!cards.length) return `<p class="keywords-empty">${KEYWORD_COPY.LEARN_EMPTY}</p>`;
  const chips = cards.map((card) => {
    const pressed = card.title === openTitle;
    const action = card.keywordCount > 0 ? KEYWORD_ACTIONS.LEARN_SUBJECT : KEYWORD_ACTIONS.LEARN_OPEN;
    const count = card.subjectTitle
      ? `<span class="keywords-count">${escapeHtml(app, card.subjectTitle)}</span>`
      : (card.keywordCount > 0 ? `<span class="keywords-count">${card.keywordCount}</span>` : '');
    return `<button type="button" class="keywords-word${pressed ? ' is-selected' : ''}" data-action="${action}" data-title="${escapeHtml(app, card.title)}" aria-pressed="${pressed ? 'true' : 'false'}">${escapeHtml(app, card.title)}${count}</button>`;
  }).join('');
  return `<div class="keywords-word-list">${chips}</div>`;
}

function renderKeywordCards(app, cards, openTitle) {
  if (!cards.length) return `<p class="keywords-empty">${KEYWORD_COPY.LEARN_KEYWORD_EMPTY}</p>`;
  const chips = cards.map((card) => {
    const pressed = card.title === openTitle;
    return `<button type="button" class="keywords-word${pressed ? ' is-selected' : ''}" data-action="${KEYWORD_ACTIONS.LEARN_OPEN}" data-title="${escapeHtml(app, card.title)}" aria-pressed="${pressed ? 'true' : 'false'}">${escapeHtml(app, card.title)}</button>`;
  }).join('');
  return `<div class="keywords-word-list">${chips}</div>`;
}

/** Wikipedia-style summary card, shared by Learn and Mini Games. */
export function renderSummaryCard(app, titleText, record, saveAction = KEYWORD_ACTIONS.LEARN_SAVE) {
  const title = `<h4 class="keywords-card-word">${escapeHtml(app, titleText)}</h4>`;
  if (!record || record.status === 'loading') {
    return `<div class="keywords-card">${title}<p class="keywords-status">${KEYWORD_COPY.LEARN_LOADING}</p></div>`;
  }
  if (record.status === 'error') {
    return `<div class="keywords-card">${title}<p class="keywords-status">${KEYWORD_COPY.LEARN_ERROR}</p></div>`;
  }
  const entry = record.entry;
  if (record.status !== 'ready' || !entry?.found) {
    return `<div class="keywords-card">${title}<p class="keywords-status">${KEYWORD_COPY.LEARN_MISSING}</p></div>`;
  }
  const definition = escapeHtml(app, entry.senses?.[0]?.definition || '');
  const example = entry.senses?.[0]?.example
    ? `<p class="keywords-example">${escapeHtml(app, entry.senses[0].example)}</p>`
    : '';
  const href = safeWikiHref(entry.articleUrl);
  const credit = href
    ? `<p class="keywords-learn-credit"><a href="${escapeHtml(app, href)}" target="_blank" rel="noopener noreferrer">${KEYWORD_COPY.LEARN_ARTICLE}</a> · ${KEYWORD_COPY.LEARN_CREDIT}</p>`
    : `<p class="keywords-learn-credit">${KEYWORD_COPY.LEARN_CREDIT}</p>`;
  return `
    <div class="keywords-card">
      ${title}
      <p class="keywords-definition-text">${definition}</p>
      ${example}
      ${credit}
      <div class="keywords-card-actions">
        <button type="button" class="keywords-primary" data-action="${saveAction}">${KEYWORD_COPY.LEARN_SAVE}</button>
      </div>
    </div>
  `;
}

function renderDetail(app, page) {
  if (!page.learnOpenTitle) return `<p class="keywords-hint">${KEYWORD_COPY.LEARN_OPEN_HINT}</p>`;
  return renderSummaryCard(app, page.learnOpenTitle, page.learnEntry);
}

/** "Already in My words: X · View →" when the Learn search matches saved words. */
export function renderLearnBridge(app, query, bank) {
  const q = String(query || '').trim();
  if (!q || !Array.isArray(bank) || !bank.length) return '';
  const matches = filterKeywords(bank, q);
  if (!matches.length) return '';
  const first = matches[0];
  const more = matches.length > 1 ? ` <span class="keywords-chip-count">+${matches.length - 1}</span>` : '';
  return `
    <div class="keywords-bridge" role="status">
      <span>${KEYWORD_COPY.BRIDGE_PREFIX} <strong>${escapeHtml(app, first.text || first.key)}</strong>${more}</span>
      <button type="button" class="keywords-link" data-action="${KEYWORD_ACTIONS.BRIDGE_VIEW}" data-word="${escapeHtml(app, first.key)}">${KEYWORD_COPY.BRIDGE_VIEW}</button>
    </div>
  `;
}

function renderGamesBanner() {
  const ready = getGamesCatalog().length > 0;
  const body = ready ? KEYWORD_COPY.GAMES_BANNER_BODY : KEYWORD_COPY.GAMES_BANNER_SOON;
  return `
    <button type="button" class="keywords-games-banner" data-action="${KEYWORD_ACTIONS.SECTION}" data-section="games">
      <i data-lucide="dice-5" aria-hidden="true"></i>
      <span class="keywords-games-banner-text"><strong>${KEYWORD_COPY.GAMES_BANNER_TITLE}</strong> · ${body}</span>
      <span class="keywords-games-banner-open">${KEYWORD_COPY.GAMES_BANNER_OPEN}</span>
    </button>
  `;
}

function renderPager(app, view, label) {
  return renderPaginationControls(app, {
    currentPage: view.currentPage,
    totalPages: view.totalPages,
    action: KEYWORD_ACTIONS.LEARN_PAGE,
    ariaLabel: label,
  });
}

export function renderLearnCatalog(app, page, { bank = [] } = {}) {
  const view = pageLearnCatalog({
    query: page.learnSubject ? '' : page.learnQuery,
    groupId: page.learnGroup,
    page: page.learnSubject ? 0 : page.learnPage,
  });
  const groups = `
    <div class="keywords-learn-groups" role="group" aria-label="${KEYWORD_COPY.LEARN}">
      ${renderGroups(app, view.groups, page.learnGroup)}
    </div>
  `;
  if (page.learnSubject) {
    const keywords = pageSubjectKeywords({
      query: page.learnQuery,
      groupId: page.learnGroup,
      subjectTitle: page.learnSubject,
      page: page.learnPage,
    });
    return `
      ${groups}
      <div class="keywords-learn-subject">
        <button type="button" class="keywords-link" data-action="${KEYWORD_ACTIONS.LEARN_BACK}">${KEYWORD_COPY.LEARN_BACK}</button>
        <p class="keywords-section-label">${KEYWORD_COPY.LEARN_IN} ${escapeHtml(app, page.learnSubject)}</p>
      </div>
      ${renderLearnBridge(app, page.learnQuery, bank)}
      ${renderKeywordCards(app, keywords.items, page.learnOpenTitle)}
      ${renderPager(app, keywords, 'Subject keywords pagination')}
      ${renderDetail(app, page)}
    `;
  }
  const hint = view.hasKeywordLists
    ? `<p class="keywords-hint">${KEYWORD_COPY.LEARN_SUBJECT_HINT}</p>`
    : '';
  return `
    ${renderGamesBanner()}
    ${groups}
    ${hint}
    ${renderLearnBridge(app, page.learnQuery, bank)}
    ${renderCards(app, view.items, page.learnOpenTitle)}
    ${renderPager(app, view, 'Learn pagination')}
    ${renderDetail(app, page)}
  `;
}
