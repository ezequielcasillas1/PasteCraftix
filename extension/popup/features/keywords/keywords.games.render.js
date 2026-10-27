/** Mini Games segment markup: group chips, 2-column grid (20 per page), game detail. */

import { KEYWORD_ACTIONS, KEYWORD_COPY, KEYWORD_PAGINATION } from './keywords.constants.js';
import {
  GAME_GROUP_ALL,
  GAME_GROUPS,
  findGame,
  getGameGroupLabel,
  getGamesCatalog,
  searchGames,
} from './keywords.games.js';
import { renderSummaryCard } from './keywords.learn.render.js';
import { paginateSlice, renderPaginationControls } from './keywords.pagination.js';
import { escapeHtml } from './keywords.render.js';

function renderGroupChips(app, catalog, selected) {
  const chips = [{ id: GAME_GROUP_ALL, label: KEYWORD_COPY.GAMES_ALL }, ...GAME_GROUPS].map((group) => {
    const count = group.id === GAME_GROUP_ALL
      ? catalog.length
      : catalog.filter((game) => game.group === group.id).length;
    const pressed = group.id === selected;
    return `<button type="button" class="keywords-learn-group${pressed ? ' is-on' : ''}" data-action="${KEYWORD_ACTIONS.GAME_GROUP}" data-group="${escapeHtml(app, group.id)}" aria-pressed="${pressed ? 'true' : 'false'}">${escapeHtml(app, group.label)}<span class="keywords-chip-count">${count}</span></button>`;
  }).join('');
  return `<div class="keywords-learn-groups" role="group" aria-label="${KEYWORD_COPY.GAMES_GROUPS_LABEL}">${chips}</div>`;
}

function renderGameCard(app, game) {
  const sample = game.sample ? `<span class="keywords-game-sample">${KEYWORD_COPY.GAMES_SAMPLE}</span>` : '';
  return `
    <button type="button" class="keywords-game-card" data-action="${KEYWORD_ACTIONS.GAME_OPEN}" data-game="${escapeHtml(app, game.id)}">
      <span class="keywords-game-name">${escapeHtml(app, game.name)}${sample}</span>
      <span class="keywords-game-meta">${escapeHtml(app, getGameGroupLabel(game.group))} · ${game.keywords.length} keyword${game.keywords.length === 1 ? '' : 's'}</span>
    </button>
  `;
}

export function renderGamesEmpty() {
  return `
    <div class="keywords-empty-state" data-empty="games">
      <i data-lucide="dice-5" aria-hidden="true"></i>
      <p class="keywords-empty-title">${KEYWORD_COPY.GAMES_EMPTY_TITLE}</p>
      <p class="keywords-empty">${KEYWORD_COPY.GAMES_EMPTY_BODY}</p>
      <button type="button" class="keywords-link" data-action="${KEYWORD_ACTIONS.INTRO_LEARN}">${KEYWORD_COPY.GAMES_EMPTY_LEARN}</button>
    </div>
  `;
}

function renderNoMatch(app, page) {
  const groupLabel = page.gamesGroup === GAME_GROUP_ALL ? '' : getGameGroupLabel(page.gamesGroup);
  const where = groupLabel ? ` in ${escapeHtml(app, groupLabel)}` : '';
  const query = String(page.gamesQuery || '').trim();
  const title = query
    ? `No games match "${escapeHtml(app, query)}"${where}`
    : `No games${where} yet`;
  const searchAll = groupLabel
    ? `<button type="button" class="keywords-link" data-action="${KEYWORD_ACTIONS.GAMES_SEARCH_ALL}">${KEYWORD_COPY.GAMES_SEARCH_ALL}</button>`
    : '';
  const clear = query
    ? `<button type="button" class="keywords-link" data-action="${KEYWORD_ACTIONS.CLEAR_SCOPED_SEARCH}">${KEYWORD_COPY.GAMES_CLEAR}</button>`
    : '';
  return `
    <div class="keywords-empty-state" data-empty="games-search">
      <p class="keywords-empty-title">${title}</p>
      <p class="keywords-empty">${KEYWORD_COPY.GAMES_NO_MATCH_HINT}</p>
      <div class="keywords-empty-actions">${searchAll}${clear}</div>
    </div>
  `;
}

/** Numbered steps, open by default and collapsible; nothing when the game has none. */
export function renderHowToPlay(app, steps) {
  if (!Array.isArray(steps) || !steps.length) return '';
  const items = steps.map((step) => `<li>${escapeHtml(app, step)}</li>`).join('');
  return `
    <details class="keywords-howto" open>
      <summary class="keywords-section-label">${KEYWORD_COPY.GAMES_HOW_TO_PLAY}</summary>
      <ol class="keywords-howto-steps">${items}</ol>
    </details>
  `;
}

function renderGameDetail(app, game, page) {
  const chips = game.keywords.length
    ? `<div class="keywords-word-list">${game.keywords.map((word) => {
      const pressed = word === page.gamesOpenTitle;
      return `<button type="button" class="keywords-word${pressed ? ' is-selected' : ''}" data-action="${KEYWORD_ACTIONS.GAME_KEYWORD}" data-title="${escapeHtml(app, word)}" aria-pressed="${pressed ? 'true' : 'false'}">${escapeHtml(app, word)}</button>`;
    }).join('')}</div>`
    : `<p class="keywords-empty">${KEYWORD_COPY.GAMES_NO_KEYWORDS}</p>`;
  const summary = page.gamesOpenTitle
    ? renderSummaryCard(app, page.gamesOpenTitle, page.gamesEntry, KEYWORD_ACTIONS.GAME_SAVE)
    : `<p class="keywords-hint">${KEYWORD_COPY.GAMES_KEYWORD_HINT}</p>`;
  const sample = game.sample ? `<span class="keywords-game-sample">${KEYWORD_COPY.GAMES_SAMPLE}</span>` : '';
  return `
    <div class="keywords-game-detail" data-game-detail="${escapeHtml(app, game.id)}">
      <button type="button" class="keywords-link" data-action="${KEYWORD_ACTIONS.GAME_BACK}">${KEYWORD_COPY.GAMES_BACK}</button>
      <h4 class="keywords-game-title">${escapeHtml(app, game.name)}${sample}</h4>
      <p class="keywords-count keywords-game-group">${escapeHtml(app, getGameGroupLabel(game.group))}</p>
      <p class="keywords-definition-text">${escapeHtml(app, game.blurb)}</p>
      ${renderHowToPlay(app, game.howToPlay)}
      <p class="keywords-section-label">${KEYWORD_COPY.GAMES_KEYWORDS_IN}</p>
      ${chips}
      ${summary}
    </div>
  `;
}

export function renderGamesSection(app, page) {
  const catalog = getGamesCatalog();
  if (!catalog.length) return renderGamesEmpty();
  const open = page.gamesOpenId ? findGame(page.gamesOpenId) : null;
  if (open) return renderGameDetail(app, open, page);
  const matches = searchGames({ query: page.gamesQuery, groupId: page.gamesGroup });
  const paged = paginateSlice(matches, page.gamesPage, KEYWORD_PAGINATION.GAMES_PER_PAGE);
  const pager = (position) => renderPaginationControls(app, {
    currentPage: paged.currentPage,
    totalPages: paged.totalPages,
    action: KEYWORD_ACTIONS.GAME_PAGE,
    ariaLabel: `Mini Games pagination ${position}`,
  });
  const body = matches.length
    ? `${pager('top')}<div class="keywords-game-grid">${paged.items.map((game) => renderGameCard(app, game)).join('')}</div>${pager('bottom')}`
    : renderNoMatch(app, page);
  return `${renderGroupChips(app, catalog, page.gamesGroup)}${body}`;
}
