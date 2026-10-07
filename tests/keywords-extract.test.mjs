import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { initKeywordsFeature } from '../extension/popup/features/keywords/keywords.controller.js';
import {
  lookupEmphasis,
  lookupWord,
  normalizeFreeDictionary,
  normalizeWiktionary,
  selectEmphasisSenses,
} from '../extension/popup/features/keywords/keywords.dictionary.js';
import { extractKeywords, selectedPhrase, toggleKeywordSelection, visibleKeywords } from '../extension/popup/features/keywords/keywords.extract.js';

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.document = originalDocument;
  globalThis.window = originalWindow;
  globalThis.fetch = originalFetch;
});

test('extracts unique English words and keeps the first spelling', () => {
  const words = extractKeywords("The well-known idea isn't the idea. See page 19.");
  assert.deepEqual(words.map((word) => word.text), [
    'The', 'well-known', 'idea', "isn't", 'See', 'page',
  ]);
  assert.equal(words.find((word) => word.key === 'the').text, 'The');
});

test('hides common words only when asked', () => {
  const words = extractKeywords('The idea of philosophy');
  assert.equal(visibleKeywords(words, false).length, 4);
  assert.deepEqual(visibleKeywords(words, true).map((word) => word.key), ['idea', 'philosophy']);
});

test('normalizes Free Dictionary API senses and ignores empty payloads', () => {
  const entry = normalizeFreeDictionary([
    {
      word: 'ontology',
      phonetic: '/ɒnˈtɒlədʒi/',
      meanings: [
        {
          partOfSpeech: 'noun',
          definitions: [
            {
              definition: 'the branch of metaphysics dealing with the nature of being.',
              example: 'Ontology asks what exists.',
            },
          ],
        },
      ],
    },
  ], 'ontology');
  assert.equal(entry.found, true);
  assert.equal(entry.source, 'free-dictionary');
  assert.equal(entry.phonetic, '/ɒnˈtɒlədʒi/');
  assert.equal(entry.senses[0].partOfSpeech, 'noun');
  assert.match(entry.senses[0].definition, /metaphysics/);
  assert.equal(normalizeFreeDictionary({ title: 'No Definitions Found' }, 'zzzx').found, false);
});

test('normalizes English Wiktionary HTML and skips other languages', () => {
  const entry = normalizeWiktionary({
    en: [
      {
        partOfSpeech: 'Noun',
        language: 'English',
        definitions: [
          {
            definition: '<b>epistemology</b> is the study of knowledge.',
            examples: ['<i>Epistemology</i> is a branch of philosophy.'],
          },
        ],
      },
    ],
    fr: [
      {
        partOfSpeech: 'nom',
        language: 'French',
        definitions: [{ definition: 'autre sens' }],
      },
    ],
  }, 'epistemology');
  assert.equal(entry.found, true);
  assert.equal(entry.source, 'wiktionary');
  assert.equal(entry.attribution, 'Wiktionary, CC BY-SA');
  assert.equal(entry.senses.length, 1);
  assert.equal(entry.senses[0].definition, 'epistemology is the study of knowledge.');
  assert.equal(entry.senses[0].example, 'Epistemology is a branch of philosophy.');
});

test('keeps dictionary synonyms and drops wiki markup from definitions', () => {
  const entry = normalizeFreeDictionary([
    {
      word: 'board',
      meanings: [
        {
          partOfSpeech: 'noun',
          synonyms: ['plank'],
          definitions: [
            { definition: 'a flat piece of wood', synonyms: ['timber'] },
          ],
        },
      ],
    },
  ], 'board');
  assert.deepEqual(entry.senses[0].synonyms, ['timber']);

  const wiki = normalizeWiktionary({
    en: [
      {
        partOfSpeech: 'Noun',
        language: 'English',
        definitions: [
          {
            definition: 'A <a href="/wiki/committee" title="committee">committee</a> .mw-parser-output .defdate{font-size:smaller}',
            examples: [],
          },
        ],
      },
    ],
  }, 'board');
  assert.equal(wiki.senses[0].definition, 'A committee');
  assert.deepEqual(wiki.senses[0].related, ['committee']);
  assert.equal(wiki.senses[0].synonyms.length, 0);
});

test('picks the organization sense of board when the phrase includes role', () => {
  const board = {
    word: 'board',
    senses: [
      { definition: 'A long thin piece of wood.' },
      { definition: 'A committee that manages the business of an organization, for example a board of directors.' },
    ],
  };
  const role = {
    word: 'role',
    senses: [
      { definition: 'A character or part played by a performer or actor.' },
      { definition: 'The function or position of something.' },
    ],
  };
  assert.match(selectEmphasisSenses(board, ['the', 'role', 'of', 'board'])[0].definition, /committee/);
  assert.match(selectEmphasisSenses(role, ['the', 'role', 'of', 'board'])[0].definition, /function or position/);
});

test('uses Wiktionary only when the primary dictionary misses', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (String(url).includes('dictionaryapi.dev')) {
      return { ok: false, json: async () => ({}) };
    }
    return {
      ok: true,
      json: async () => ({
        en: [
          {
            partOfSpeech: 'Noun',
            language: 'English',
            definitions: [{ definition: 'a college subject', examples: [] }],
          },
        ],
      }),
    };
  };

  const entry = await lookupWord('syllabus', fetchImpl);
  assert.equal(entry.found, true);
  assert.equal(entry.source, 'wiktionary');
  assert.equal(calls.length, 2);

  const primary = await lookupWord('idea', async (url) => {
    calls.push(url);
    return {
      ok: true,
      json: async () => [{
        word: 'idea',
        meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'a thought' }] }],
      }],
    };
  });
  assert.equal(primary.source, 'free-dictionary');
});

test('reports a reachability error when both dictionaries fail', async () => {
  const entry = await lookupWord('idea', async () => {
    throw new Error('offline');
  });
  assert.equal(entry.found, false);
  assert.equal(entry.error, true);
});

function installKeywordsDom() {
  const elements = new Map();
  const make = (id) => {
    const element = {
      id,
      hidden: false,
      checked: false,
      disabled: false,
      textContent: '',
      innerHTML: '',
      value: '',
      dataset: {},
      classList: { add() {}, remove() {}, contains() { return false; } },
    };
    elements.set(id, element);
    return element;
  };
  ['keywordsSource', 'keywordsWordList', 'keywordsDefinition', 'keywordsHideCommon', 'keywordsTab', 'clipsTab'].forEach(make);
  const buttons = new Map([
    ['clips', { dataset: { tab: 'clips' }, classList: { add() {}, remove() {} } }],
    ['keywords', { dataset: { tab: 'keywords' }, classList: { add() {}, remove() {} } }],
  ]);
  globalThis.document = {
    getElementById: (id) => elements.get(id) || null,
    querySelector(selector) {
      const match = selector.match(/data-tab="(.+)"/);
      return match ? buttons.get(match[1]) || null : null;
    },
    querySelectorAll(selector) {
      if (selector === '.tab-btn') return [...buttons.values()];
      if (selector === '.tab-content') return [elements.get('clipsTab'), elements.get('keywordsTab')];
      return [];
    },
  };
  globalThis.window = { renderLucideIconsForActiveTab() {} };
  return elements;
}

test('sends clip text to the keywords page and defines a clicked word', async () => {
  const elements = installKeywordsDom();
  const toasts = [];
  const app = {
    currentTab: 'clips',
    showToast(message) { toasts.push(message); },
    _saveActiveTabState() {},
    updateHeaderClipCount() {},
  };
  const feature = initKeywordsFeature(app);
  app.keywordsFeature = feature;

  const empty = feature.sendText({ text: '123 !!!', sourceLabel: 'Draft' });
  assert.equal(empty.ok, false);
  assert.equal(toasts.at(-1), 'No words to review');

  const sent = feature.sendText({
    text: 'Ontology studies being. The idea of ontology returns.',
    sourceLabel: 'Draft',
  });
  assert.equal(sent.ok, true);
  assert.equal(app.currentTab, 'keywords');
  assert.equal(feature.state.sourceLabel, 'Draft');
  assert.deepEqual(feature.state.words.map((word) => word.key), [
    'ontology', 'studies', 'being', 'the', 'idea', 'of', 'returns',
  ]);
  assert.match(elements.get('keywordsWordList').innerHTML, /Ontology/);
  assert.match(elements.get('keywordsSource').textContent, /Draft/);

  globalThis.fetch = async (url) => {
    if (String(url).includes('dictionaryapi.dev')) {
      return {
        ok: true,
        json: async () => [{
          word: 'ontology',
          phonetic: '/ɒnˈtɒlədʒi/',
          meanings: [{
            partOfSpeech: 'noun',
            definitions: [{ definition: 'the study of being', example: 'Ontology is philosophical.' }],
          }],
        }],
      };
    }
    throw new Error('fallback should not run');
  };

  await feature.toggle('ontology');
  const card = elements.get('keywordsDefinition').innerHTML;
  assert.match(card, /the study of being/);
  assert.match(card, /Free Dictionary API/);
  assert.match(card, /Ontology is philosophical/);
  assert.equal(feature.state.entries.get('ontology').status, 'ready');
});

test('joins selected words in the order they appear in the text', () => {
  const words = extractKeywords('The Role of board');
  let keys = [];
  for (const key of ['board', 'the', 'role', 'of']) {
    keys = toggleKeywordSelection(words, keys, key).keys;
  }
  assert.deepEqual(keys, ['the', 'role', 'of', 'board']);
  assert.equal(selectedPhrase(words, keys).label, 'The Role of board');

  const ranged = toggleKeywordSelection(words, ['the'], 'board', { extend: true, anchor: 'the' });
  assert.deepEqual(ranged.keys, ['the', 'role', 'of', 'board']);
});

test('defines a known phrase as one dictionary entry', async () => {
  const urls = [];
  const entry = await lookupEmphasis('ice cream', async (url) => {
    urls.push(String(url));
    return {
      ok: true,
      json: async () => [{
        word: 'ice cream',
        meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'a frozen dessert' }] }],
      }],
    };
  });
  assert.equal(entry.kind, 'entry');
  assert.equal(entry.entry.senses[0].definition, 'a frozen dessert');
  assert.equal(urls.length, 1);
});

test('defines an ordinary phrase from the main sense of each word', async () => {
  const elements = installKeywordsDom();
  const app = {
    currentTab: 'clips',
    showToast() {},
    _saveActiveTabState() {},
    updateHeaderClipCount() {},
  };
  const feature = initKeywordsFeature(app);
  feature.sendText({ text: 'The Role of board', sourceLabel: 'Draft' });

  globalThis.fetch = async (url) => {
    const leaf = decodeURIComponent(String(url).split('/').pop()).replace(/_/g, ' ');
    if (leaf.includes(' ')) return { ok: false, json: async () => ({}) };
    return {
      ok: true,
      json: async () => [{
        word: leaf,
        meanings: [{
          partOfSpeech: 'noun',
          definitions: [{ definition: `sense of ${leaf}`, example: '' }],
        }],
      }],
    };
  };

  for (const key of ['board', 'the', 'role', 'of']) {
    await feature.toggle(key);
  }

  const card = elements.get('keywordsDefinition').innerHTML;
  const chips = elements.get('keywordsWordList').innerHTML;
  assert.equal(feature.state.phraseLabel, 'The Role of board');
  assert.equal((chips.match(/is-selected/g) || []).length, 4);
  assert.match(card, /The Role of board/);
  assert.match(card, /No single dictionary entry for this phrase/);
  assert.match(card, /sense of role/);
  assert.match(card, /sense of board/);
  assert.match(card, /Grammar words in this phrase: The, of/);

  feature.clear();
  assert.equal(feature.state.phraseKey, '');
  assert.equal((elements.get('keywordsWordList').innerHTML.match(/is-selected/g) || []).length, 0);
});
