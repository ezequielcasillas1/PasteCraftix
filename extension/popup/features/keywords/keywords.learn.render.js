/** Learn catalog markup inside the Keywords tab. */

import { KEYWORD_ACTIONS, KEYWORD_COPY } from './keywords.constants.js';
import { pageLearnCatalog, pageSubjectKeywords } from './keywords.learn.js';
import { renderPaginationControls, renderSearchBar } from './keywords.pagination.js';
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
    return `<button type="button" class="keywords-learn-group${pressed ? ' is-on' : ''}" data-action="${KEYWORD_ACTIONS.LEARN_GROUP}" data-group="${escapeHtml(app, group.id)}" aria-pressed="${pressed ? 'true' : 'false'}">${escapeHtml(app, group.label)}</button>`;
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

function renderDetail(app, page) {
  if (!page.learnOpenTitle) return `<p class="keywords-hint">${KEYWORD_COPY.LEARN_OPEN_HINT}</p>`;
  const title = `<h4 class="keywords-card-word">${escapeHtml(app, page.learnOpenTitle)}</h4>`;
  const record = page.learnEntry;
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
        <button type="button" class="keywords-primary" data-action="${KEYWORD_ACTIONS.LEARN_SAVE}">${KEYWORD_COPY.LEARN_SAVE}</button>
      </div>
    </div>
  `;
}

function renderSearch(app, page, placeholder) {
  return renderSearchBar(app, {
    field: 'keyword-learn-search',
    value: page.learnQuery,
    placeholder,
    clearAction: KEYWORD_ACTIONS.CLEAR_LEARN_SEARCH,
    ariaLabel: placeholder,
  });
}

function renderPager(app, view, label) {
  return renderPaginationControls(app, {
    currentPage: view.currentPage,
    totalPages: view.totalPages,
    action: KEYWORD_ACTIONS.LEARN_PAGE,
    ariaLabel: label,
  });
}

export function renderLearnCatalog(app, page) {
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
      ${renderSearch(app, page, KEYWORD_COPY.SEARCH_KEYWORDS)}
      ${renderKeywordCards(app, keywords.items, page.learnOpenTitle)}
      ${renderPager(app, keywords, 'Subject keywords pagination')}
      ${renderDetail(app, page)}
    `;
  }
  const hint = view.hasKeywordLists
    ? `<p class="keywords-hint">${KEYWORD_COPY.LEARN_SUBJECT_HINT}</p>`
    : '';
  return `
    ${groups}
    ${hint}
    ${renderSearch(app, page, KEYWORD_COPY.LEARN_SEARCH)}
    ${renderCards(app, view.items, page.learnOpenTitle)}
    ${renderPager(app, view, 'Learn pagination')}
    ${renderDetail(app, page)}
  `;
}
