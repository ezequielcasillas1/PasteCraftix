import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { removeKeywordFromBank, upsertKeyword } from '../extension/popup/features/keywords/keywords.bank.js';
import { DEFAULT_KEYWORD_FILE_ID, DEFAULT_KEYWORD_FOLDER_ID, KEYWORD_BANK_LIMIT, KEYWORD_COPY } from '../extension/popup/features/keywords/keywords.constants.js';
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
    if (id === 'quickSaveKeywords' || id === 'clipViewerKeywords') element.hidden = true;
    elements.set(id, element);
    return element;
  };
  [
    'keywordsSource', 'keywordsFiles', 'keywordsFolders', 'keywordsTab', 'clipsTab',
    'clipViewerKeywords', 'clipViewerKeywordsSource', 'clipViewerKeywordsHideCommon',
    'clipViewerKeywordsWords', 'clipViewerKeywordsDefinition',
    'quickSaveKeywords', 'quickSaveKeywordsSource', 'quickSaveKeywordsHideCommon',
    'quickSaveKeywordsWords', 'quickSaveKeywordsDefinition',
  ].forEach(make);
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

test('keyword page copy does not name a dictionary or an api', () => {
  const copy = Object.values(KEYWORD_COPY).join('\n');
  assert.doesNotMatch(copy, /api/i);
  assert.doesNotMatch(copy, /dictionary/i);
});

test('keeps one saved keyword and drops words past the bank limit', () => {
  let bank = upsertKeyword([], {
    key: 'idea',
    text: 'idea',
    kind: 'entry',
    senses: [{ definition: 'a thought' }],
  });
  bank = upsertKeyword(bank, {
    key: 'idea',
    text: 'Idea',
    kind: 'entry',
    senses: [{ definition: 'a notion' }],
  });
  assert.equal(bank.length, 1);
  assert.equal(bank[0].text, 'Idea');
  assert.equal(bank[0].senses[0].definition, 'a notion');

  for (let i = 0; i < KEYWORD_BANK_LIMIT + 5; i += 1) {
    bank = upsertKeyword(bank, { key: `word${i}`, text: `word${i}`, kind: 'missing' });
  }
  assert.equal(bank.length, KEYWORD_BANK_LIMIT);
  assert.equal(bank[0].key, `word${KEYWORD_BANK_LIMIT + 4}`);
  assert.equal(bank.some((item) => item.key === 'idea'), false);
  bank = removeKeywordFromBank(bank, bank[0].key);
  assert.equal(bank.length, KEYWORD_BANK_LIMIT - 1);
});

test('saves a word from quick save into the keyword bank', async () => {
  const elements = installKeywordsDom();
  const toasts = [];
  const app = {
    currentTab: 'clips',
    showToast(message) { toasts.push(message); },
    _saveActiveTabState() {},
    updateHeaderClipCount() {},
  };
  const feature = initKeywordsFeature(app);

  const empty = feature.reviewSavedText({ text: '123 !!!', sourceLabel: 'Quick Save' });
  assert.equal(empty.ok, false);
  assert.equal(elements.get('quickSaveKeywords').hidden, false);
  assert.match(elements.get('quickSaveKeywordsWords').innerHTML, /no words to save/i);

  const sent = feature.reviewSavedText({
    text: 'Ontology studies being. The idea of ontology returns.',
    sourceLabel: 'Quick Save',
    clipId: 'clip-9',
  });
  assert.equal(sent.ok, true);
  assert.equal(app.currentTab, 'clips');
  assert.deepEqual(feature.reviewState.words.map((word) => word.key), [
    'ontology', 'studies', 'being', 'the', 'idea', 'of', 'returns',
  ]);
  assert.match(elements.get('quickSaveKeywordsWords').innerHTML, /Ontology/);
  assert.match(elements.get('keywordsFolders').innerHTML, /Saved words stay here/);
  assert.doesNotMatch(`${elements.get('keywordsFiles').innerHTML} ${elements.get('keywordsFolders').innerHTML}`, /dictionary|api/i);

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
  const reviewCard = elements.get('quickSaveKeywordsDefinition').innerHTML;
  assert.match(reviewCard, /the study of being/);
  assert.match(reviewCard, /Save keyword/);
  assert.match(reviewCard, /Saves to Saved \/ All words/);
  assert.match(reviewCard, /Ontology is philosophical/);
  assert.doesNotMatch(reviewCard, /dictionary|api/i);
  assert.equal(feature.reviewState.entries.get('ontology').status, 'ready');

  await feature.saveKeyword('quick');
  assert.equal(toasts.at(-1), 'Keyword saved to Saved / All words');
  assert.equal(feature.getBank().length, 1);
  assert.equal(feature.getBank()[0].clipId, 'clip-9');
  assert.equal(feature.getBank()[0].folderId, DEFAULT_KEYWORD_FOLDER_ID);
  assert.match(elements.get('keywordsFiles').innerHTML, /Saved/);
  assert.match(elements.get('keywordsFiles').innerHTML, /New file/);
  const folders = elements.get('keywordsFolders').innerHTML;
  assert.match(folders, /All words/);
  assert.match(folders, /1 word</);
  assert.match(folders, /New words go here/);
  assert.match(folders, /Ontology/);
  assert.match(elements.get('quickSaveKeywordsDefinition').innerHTML, /keywords-save is-saved/);
  assert.match(elements.get('quickSaveKeywordsDefinition').innerHTML, /Saved in Saved \/ All words/);
  assert.match(elements.get('quickSaveKeywordsWords').innerHTML, /is-saved/);

  await feature.saveKeyword('quick');
  assert.equal(feature.getBank().length, 1);

  feature.openKeyword('ontology');
  const bankCard = elements.get('keywordsFolders').innerHTML;
  assert.match(bankCard, /the study of being/);
  assert.match(bankCard, /From Quick Save/);
  assert.match(bankCard, /Delete word/);
  assert.doesNotMatch(bankCard, /dictionary|api/i);

  await feature.page.startForm('new-folder', DEFAULT_KEYWORD_FILE_ID);
  assert.match(elements.get('keywordsFolders').innerHTML, /Name the new folder/);
  const created = await feature.page.submitForm('Philosophy');
  assert.equal(created.ok, true);
  assert.equal(feature.page.state.form, null);
  assert.match(elements.get('keywordsFolders').innerHTML, /Philosophy/);
  assert.match(elements.get('keywordsFolders').innerHTML, /Save new words here/);
  assert.equal((await feature.page.submitForm('x')).ok, false);

  await feature.page.moveWord('ontology', created.folderId);
  assert.equal(feature.getBank()[0].folderId, created.folderId);
  assert.match(toasts.at(-1), /Moved to Saved \/ Philosophy/);
  assert.match(elements.get('keywordsFolders').innerHTML, /keywords-move/);

  await feature.page.setTarget(created.folderId);
  assert.equal(feature.getLibrary().selection.folderId, created.folderId);
  assert.match(feature.reviewState.saveTarget, /Saved \/ Philosophy/);

  await feature.removeKeyword('ontology');
  assert.equal(feature.getBank().length, 0);
  assert.match(elements.get('keywordsFolders').innerHTML, /Saved words stay here/);
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
  feature.reviewSavedText({ text: 'The Role of board', sourceLabel: 'Quick Save' });

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

  const card = elements.get('quickSaveKeywordsDefinition').innerHTML;
  const chips = elements.get('quickSaveKeywordsWords').innerHTML;
  assert.equal(feature.reviewState.phraseLabel, 'The Role of board');
  assert.equal((chips.match(/is-selected/g) || []).length, 4);
  assert.match(card, /The Role of board/);
  assert.match(card, /No single meaning for this phrase/);
  assert.doesNotMatch(card, /dictionary|api/i);
  assert.match(card, /sense of role/);
  assert.match(card, /sense of board/);
  assert.match(card, /Grammar words in this phrase: The, of/);

  feature.clear();
  assert.equal(feature.reviewState.phraseKey, '');
  assert.equal((elements.get('quickSaveKeywordsWords').innerHTML.match(/is-selected/g) || []).length, 0);
});

test('reviews an open clip in the viewer and can save its word', async () => {
  const elements = installKeywordsDom();
  const app = {
    currentTab: 'clips',
    showToast() {},
    _saveActiveTabState() {},
    updateHeaderClipCount() {},
  };
  const feature = initKeywordsFeature(app);
  const result = feature.reviewClip({ id: 'clip-1', text: 'Marksman' });

  assert.equal(result.ok, true);
  assert.equal(app.currentTab, 'clips');
  assert.equal(elements.get('clipViewerKeywords').hidden, false);
  assert.match(elements.get('clipViewerKeywordsWords').innerHTML, /Marksman/);
  assert.equal(feature.getBank().length, 0);

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => [{
      word: 'marksman',
      meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'a person skilled in shooting' }] }],
    }],
  });
  await feature.reviewToggle('marksman');
  await feature.saveKeyword('viewer');
  assert.equal(feature.getBank()[0].key, 'marksman');
  assert.equal(feature.getBank()[0].sourceLabel, 'Marksman');
  assert.match(elements.get('keywordsFolders').innerHTML, /Marksman/);
  assert.match(elements.get('clipViewerKeywordsDefinition').innerHTML, /a person skilled in shooting/);
  assert.doesNotMatch(elements.get('clipViewerKeywordsDefinition').innerHTML, /dictionary|api/i);

  feature.clearClipReview();
  assert.equal(elements.get('clipViewerKeywords').hidden, true);
  assert.equal(feature.getBank().length, 1);
});
