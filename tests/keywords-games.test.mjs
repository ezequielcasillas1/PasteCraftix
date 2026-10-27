import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GAME_GROUPS,
  GAMES_CATALOG,
  SAMPLE_GAMES,
  getGamesCatalog,
  normalizeGame,
  searchGames,
  setGamesCatalog,
} from '../extension/popup/features/keywords/keywords.games.js';
import { renderGamesSection } from '../extension/popup/features/keywords/keywords.games.render.js';
import { renderKeywordsNav } from '../extension/popup/features/keywords/keywords.library.render.js';
import { renderLearnBridge, renderLearnCatalog } from '../extension/popup/features/keywords/keywords.learn.render.js';
import { createKeywordsPage } from '../extension/popup/features/keywords/keywords.page.js';
import { createKeywordsPageState } from '../extension/popup/features/keywords/keywords.state.js';

const app = { escapeHtml: (s) => String(s ?? '').replace(/</g, '&lt;').replace(/"/g, '&quot;'), showToast: () => {} };

test('shipped catalog is the generated one, with no samples; at most 3 clearly marked samples exist', () => {
  assert.equal(GAMES_CATALOG.length, 194);
  assert.equal(getGamesCatalog().length, 194);
  assert.ok(getGamesCatalog().every((game) => game.sample === false && !game.id.startsWith('sample-')));
  assert.ok(getGamesCatalog().every((game) => game.howToPlay.length >= 3), 'every shipped game has How to play');
  assert.equal(new Set(getGamesCatalog().map((game) => game.id)).size, 194);
  assert.equal(getGamesCatalog().find((game) => game.name === 'Chess')?.id, 'chess');
  GAME_GROUPS.forEach((group) => assert.ok(getGamesCatalog().some((game) => game.group === group.id), group.id));
  assert.ok(SAMPLE_GAMES.length <= 3);
  SAMPLE_GAMES.forEach((game) => {
    assert.equal(game.sample, true);
    assert.match(game.blurb, /^SAMPLE/);
    assert.ok(normalizeGame(game));
  });
  assert.deepEqual(GAME_GROUPS.map((g) => g.label), ['Board', 'Table', 'Racquet & paddle', 'Card', 'Dice', 'Parlor', 'Lawn & yard']);
});

test('loader validates the schema and dedupes ids', () => {
  const accepted = setGamesCatalog([
    { id: 'a', name: 'A', group: 'dice', blurb: 'x', keywords: ['Roll', 'roll', ''] },
    { id: 'a', name: 'Dup', group: 'dice', blurb: '', keywords: [] },
    { id: 'b', name: 'B', group: 'not-a-group', blurb: '', keywords: [] },
    { id: '', name: 'C', group: 'card', blurb: '', keywords: [] },
    null,
  ]);
  assert.equal(accepted, 1);
  assert.deepEqual(getGamesCatalog()[0].keywords, ['Roll']);
  setGamesCatalog([]);
});

test('empty catalog shows "Mini Games are on the way"', () => {
  setGamesCatalog([]);
  const html = renderGamesSection(app, createKeywordsPageState());
  assert.match(html, /Mini Games are on the way/);
  assert.doesNotMatch(html, /keywords-game-grid/);
});

test('grid pages 20 at a time, filters by group and shows the no-results state', () => {
  const games = Array.from({ length: 25 }, (_, i) => ({ id: `g${i}`, name: `Game ${i}`, group: i % 2 ? 'dice' : 'card', blurb: '', keywords: ['Kw'] }));
  setGamesCatalog(games);
  const page = createKeywordsPageState();
  const first = renderGamesSection(app, page);
  assert.equal((first.match(/keywords-game-card"/g) || []).length, 20);
  assert.match(first, /1 \/ 2/);
  assert.equal((first.match(/keywords-pagination"/g) || []).length, 2, 'pager top and bottom');
  page.gamesPage = 1;
  assert.equal((renderGamesSection(app, page).match(/keywords-game-card"/g) || []).length, 5);
  page.gamesPage = 0;
  page.gamesGroup = 'dice';
  page.gamesQuery = 'zzz';
  const none = renderGamesSection(app, page);
  assert.match(none, /No games match &quot;zzz&quot; in Dice|No games match "zzz" in Dice/);
  assert.match(none, /Search all groups/);
  assert.equal(searchGames({ query: 'kw', groupId: 'card' }).length, 13);
  setGamesCatalog([]);
});

test('game detail lists its keywords and a summary saves through the game slot', () => {
  setGamesCatalog(SAMPLE_GAMES);
  const page = createKeywordsPageState();
  page.gamesOpenId = 'sample-chess';
  const html = renderGamesSection(app, page);
  assert.match(html, /← All games/);
  assert.match(html, /Keywords in this game/);
  assert.match(html, /Checkmate/);
  page.gamesOpenTitle = 'Checkmate';
  page.gamesEntry = { status: 'ready', entry: { found: true, word: 'Checkmate', senses: [{ definition: 'King is trapped.' }] } };
  assert.match(renderGamesSection(app, page), /data-action="keyword-game-save"/);
  setGamesCatalog([]);
});

test('scoped search placeholder follows the segment; My words shows its count', () => {
  const page = createKeywordsPageState();
  assert.match(renderKeywordsNav(app, page, 4), /Search my words…/);
  assert.match(renderKeywordsNav(app, page, 4), /My words <span class="keywords-seg-count">· 4/);
  page.section = 'learn';
  assert.match(renderKeywordsNav(app, page, 4), /Search subjects and keywords…/);
  page.section = 'games';
  assert.match(renderKeywordsNav(app, page, 4), /Search games and keywords…/);
});

test('Learn: short chips, muted counts, banner and the My words bridge', () => {
  const page = createKeywordsPageState();
  const html = renderLearnCatalog(app, page, { bank: [] });
  assert.match(html, />Certificates<span class="keywords-chip-count">/);
  assert.match(html, />States<span class="keywords-chip-count">/);
  assert.match(html, /keywords-games-banner/);
  const bridge = renderLearnBridge(app, 'comp', [{ key: 'compile', text: 'compile' }]);
  assert.match(bridge, /Already in My words: <strong>compile<\/strong>/);
  assert.match(bridge, /View →/);
  assert.equal(renderLearnBridge(app, 'zzz', [{ key: 'compile', text: 'compile' }]), '');
});

test('segment and explainer state persist in chrome.storage.local', async () => {
  const saved = {};
  const prefs = { get: async () => ({ pc_keywords_section: 'games' }), set: async (v) => Object.assign(saved, v) };
  const library = { files: [{ id: 'kw-file-saved', name: 'Saved' }], folders: [{ id: 'kw-folder-all', fileId: 'kw-file-saved', name: 'All words' }], selection: { fileId: 'kw-file-saved', folderId: 'kw-folder-all' } };
  const store = { getLibrary: () => library, getBank: () => [{ key: 'dink', text: 'Dink', folderId: 'kw-folder-all' }], apply: async () => ({ ok: true }) };
  globalThis.document = { getElementById: () => null, querySelector: () => null };
  const page = createKeywordsPage({ app, store, prefs });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(page.state.section, 'games');
  assert.equal(page.state.introOpen, true, 'explainer opens the first time');
  page.dismissIntro();
  assert.equal(saved.pc_keywords_intro_seen, true);
  page.setSection('learn');
  assert.equal(saved.pc_keywords_section, 'learn');
  page.viewSavedWord('dink');
  assert.equal(page.state.section, 'words');
  assert.equal(page.state.openKey, 'dink');
  assert.ok(page.state.expanded.has('kw-folder-all'));
});

test('Learn banner counts the loaded catalog', async () => {
  const { setGamesCatalog: set, SAMPLE_GAMES: samples } = await import('../extension/popup/features/keywords/keywords.games.js');
  const page = createKeywordsPageState();
  set([]);
  assert.match(renderLearnCatalog(app, page), /Games and their keywords are on the way/);
  set(samples);
  assert.match(renderLearnCatalog(app, page), /<strong>Mini Games<\/strong> · 3 games and their keywords/);
  set([]);
});

test('howToPlay: accepts howToPlay or how_to_play, 3–5 steps, else hidden', async () => {
  const { normalizeGame: norm } = await import('../extension/popup/features/keywords/keywords.games.js');
  const base = { id: 'g', name: 'G', group: 'card', blurb: '', keywords: [] };
  assert.deepEqual([...norm({ ...base, howToPlay: ['a', 'b', 'c'] }).howToPlay], ['a', 'b', 'c']);
  assert.deepEqual([...norm({ ...base, how_to_play: ['a', ' b ', 'c', 'd'] }).howToPlay], ['a', 'b', 'c', 'd']);
  assert.equal(norm({ ...base, howToPlay: ['a', 'b'] }).howToPlay.length, 0);
  assert.equal(norm({ ...base, howToPlay: ['1', '2', '3', '4', '5', '6'] }).howToPlay.length, 0);
  assert.equal(norm({ ...base, howToPlay: 'not a list' }).howToPlay.length, 0);
  assert.equal(norm({ ...base, howToPlay: ['a', '', 'b', 7] }).howToPlay.length, 0, 'blank/non-string steps do not count');
  assert.equal(norm(base).howToPlay.length, 0);
  SAMPLE_GAMES.forEach((game) => {
    const steps = norm(game).howToPlay;
    assert.ok(steps.length >= 3 && steps.length <= 5);
    steps.forEach((step) => assert.match(step, /^SAMPLE/));
  });
});

test('detail order is blurb, How to play (open), keywords; hidden when empty; search matches steps', () => {
  setGamesCatalog([
    ...SAMPLE_GAMES,
    { id: 'plain', name: 'Plain', group: 'card', blurb: 'No steps', keywords: ['Trick'] },
  ]);
  const page = createKeywordsPageState();
  page.gamesOpenId = 'sample-chess';
  const html = renderGamesSection(app, page);
  const iBlurb = html.indexOf('keywords-definition-text');
  const iHow = html.indexOf('How to play');
  const iKw = html.indexOf('Keywords in this game');
  assert.ok(iBlurb > 0 && iBlurb < iHow && iHow < iKw);
  assert.match(html, /<details class="keywords-howto" open>/);
  assert.equal((html.match(/<li>/g) || []).length, 4);
  page.gamesOpenId = 'plain';
  assert.doesNotMatch(renderGamesSection(app, page), /How to play/);
  assert.deepEqual(searchGames({ query: 'kitchen' }).map((g) => g.id), ['sample-pickleball']);
  setGamesCatalog([]);
});
