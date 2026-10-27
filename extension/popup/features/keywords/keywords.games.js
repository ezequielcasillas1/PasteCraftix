/**
 * @forward-slice Mini Games catalog for the Keywords tab.
 *
 * Schema (one entry per game):
 *   { id: string, name: string, group: GameGroupId, blurb: string, keywords: string[] }
 *
 * The real catalog is being written by Rio and Sable. Until it lands, GAMES_CATALOG is
 * empty and the tab shows "Mini Games are on the way". To ship the real games, either
 *   1. replace the GAMES_CATALOG array below with the full list, or
 *   2. call setGamesCatalog(list) once at startup (e.g. from a generated module).
 * Every entry goes through normalizeGame(): bad rows are dropped, never rendered.
 *
 * SAMPLE_GAMES are layout fixtures only (tests and screenshots). They are NOT loaded
 * by default and must not be shipped as real content.
 */

/** Group chips, in display order. `id` is the value used in `group`. */
export const GAME_GROUPS = Object.freeze([
  Object.freeze({ id: 'board', label: 'Board' }),
  Object.freeze({ id: 'table', label: 'Table' }),
  Object.freeze({ id: 'racquet-paddle', label: 'Racquet & paddle' }),
  Object.freeze({ id: 'card', label: 'Card' }),
  Object.freeze({ id: 'dice', label: 'Dice' }),
  Object.freeze({ id: 'parlor', label: 'Parlor' }),
  Object.freeze({ id: 'lawn-yard', label: 'Lawn & yard' }),
]);

export const GAME_GROUP_ALL = 'all';

const GROUP_IDS = new Set(GAME_GROUPS.map((group) => group.id));

/** ⚠️ SAMPLE ENTRIES — placeholders for layout, not the real catalog (max 3). */
export const SAMPLE_GAMES = Object.freeze([
  Object.freeze({
    id: 'sample-chess',
    name: 'Chess',
    group: 'board',
    blurb: 'SAMPLE · Two players move pieces on an 8×8 board, each trying to checkmate the other king.',
    keywords: Object.freeze(['Checkmate', 'Gambit', 'Castling', 'En passant']),
    sample: true,
  }),
  Object.freeze({
    id: 'sample-pickleball',
    name: 'Pickleball',
    group: 'racquet-paddle',
    blurb: 'SAMPLE · Paddle sport on a small court; players hit a perforated plastic ball over a low net.',
    keywords: Object.freeze(['Dink', 'Volley', 'Fault']),
    sample: true,
  }),
  Object.freeze({
    id: 'sample-yahtzee',
    name: 'Yahtzee',
    group: 'dice',
    blurb: 'SAMPLE · Roll five dice up to three times a turn to fill scoring boxes on a card.',
    keywords: Object.freeze(['Full house', 'Straight']),
    sample: true,
  }),
]);

/** ← Rio & Sable: the real catalog goes here (or call setGamesCatalog). */
export const GAMES_CATALOG = Object.freeze([]);

function cleanText(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** One validated, frozen game, or null when the row breaks the schema. */
export function normalizeGame(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id, 80);
  const name = cleanText(raw.name, 80);
  const group = cleanText(raw.group, 40);
  const blurb = cleanText(raw.blurb, 400);
  if (!id || !name || !GROUP_IDS.has(group)) return null;
  const seen = new Set();
  const keywords = (Array.isArray(raw.keywords) ? raw.keywords : [])
    .map((word) => cleanText(word, 80))
    .filter((word) => {
      const key = word.toLowerCase();
      if (!word || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return Object.freeze({ id, name, group, blurb, keywords: Object.freeze(keywords), sample: raw.sample === true });
}

/** Validate a whole list: drops bad rows and duplicate ids (first wins). */
export function normalizeGamesCatalog(list) {
  const ids = new Set();
  const out = [];
  (Array.isArray(list) ? list : []).forEach((raw) => {
    const game = normalizeGame(raw);
    if (!game || ids.has(game.id)) return;
    ids.add(game.id);
    out.push(game);
  });
  return Object.freeze(out);
}

let activeCatalog = normalizeGamesCatalog(GAMES_CATALOG);

/** Swap in a catalog at runtime. Returns how many games were accepted. */
export function setGamesCatalog(list) {
  activeCatalog = normalizeGamesCatalog(list);
  return activeCatalog.length;
}

export function getGamesCatalog() {
  return activeCatalog;
}

export function getGameGroupLabel(groupId) {
  return GAME_GROUPS.find((group) => group.id === groupId)?.label || '';
}

export function findGame(id) {
  return activeCatalog.find((game) => game.id === id) || null;
}

/** Local search: game name, group label, blurb, or any keyword. */
export function searchGames({ query = '', groupId = GAME_GROUP_ALL } = {}) {
  const q = String(query || '').trim().toLowerCase();
  return activeCatalog.filter((game) => {
    if (groupId && groupId !== GAME_GROUP_ALL && game.group !== groupId) return false;
    if (!q) return true;
    return game.name.toLowerCase().includes(q)
      || getGameGroupLabel(game.group).toLowerCase().includes(q)
      || game.blurb.toLowerCase().includes(q)
      || game.keywords.some((word) => word.toLowerCase().includes(q));
  });
}
