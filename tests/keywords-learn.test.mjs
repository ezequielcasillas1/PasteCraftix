import assert from 'node:assert/strict';
import test from 'node:test';
import { lookupStudyTitle, resolveStudySectorTitle } from '../extension/popup/features/keywords/keywords.dictionary.js';
import { MAJOR_SUBJECT_KEYWORDS } from '../extension/popup/features/keywords/keywords.learn.majors.js';
import { learnBankDraft, listLearnGroups, pickBestLearnKeyword, searchLearnCatalog, searchSubjectKeywords } from '../extension/popup/features/keywords/keywords.learn.js';

test('lists a non-empty catalog group for each study sector', () => {
  const groups = listLearnGroups();
  assert.equal(groups.length, 6);
  const ids = groups.map((group) => group.id);
  assert.deepEqual(ids, ['majors', 'software', 'nonprofit', 'trades', 'continuing', 'states']);
  for (const group of groups) {
    assert.ok(group.entries.length > 0, group.id);
    assert.ok(group.label);
  }
});

test('resolves premed, comptia, and a state phrase inside their groups', () => {
  assert.equal(searchLearnCatalog('premed', 'majors')[0].title, 'Pre-medical');
  assert.equal(searchLearnCatalog('comptia', 'continuing')[0].title, 'CompTIA');
  assert.equal(
    searchLearnCatalog('continuing education texas', 'states')[0].title,
    'Texas Higher Education Coordinating Board',
  );
});

test('an empty query stays inside the selected group', () => {
  const majors = searchLearnCatalog('', 'majors');
  const software = searchLearnCatalog('', 'software');
  assert.ok(majors.length > 0);
  assert.ok(software.length > 0);
  assert.ok(majors.every((card) => card.groupId === 'majors'));
  assert.ok(software.every((card) => card.groupId === 'software'));
  assert.equal(searchLearnCatalog('devops', 'majors').length, 0);
  assert.equal(searchLearnCatalog('devops', 'software')[0].title, 'DevOps');
});

test('every catalog group has a keyword list; states stay subject-only', () => {
  const majors = listLearnGroups().find((group) => group.id === 'majors');
  assert.deepEqual(
    Object.keys(MAJOR_SUBJECT_KEYWORDS).sort(),
    majors.entries.map((entry) => entry.title).sort(),
  );
  for (const entry of majors.entries) {
    assert.ok(entry.keywords.length >= 6, entry.title);
  }
  for (const id of ['software', 'nonprofit', 'trades', 'continuing']) {
    const group = listLearnGroups().find((item) => item.id === id);
    assert.ok(group.entries.length > 0, id);
    for (const entry of group.entries) {
      assert.ok(entry.keywords.length >= 6, `${id}:${entry.title}`);
    }
  }
  const states = listLearnGroups().find((group) => group.id === 'states');
  assert.ok(states.entries.every((entry) => entry.keywords.length === 0));
  assert.equal(resolveStudySectorTitle('mitosis'), null);
  assert.equal(resolveStudySectorTitle('stoichiometry'), null);
});

test('software, nonprofit, trades, and continuing searches hit keyword lists', () => {
  const refactor = searchLearnCatalog('refactoring', 'software');
  assert.ok(refactor.some((card) => card.subjectTitle === 'Code refactoring'));
  const fiduciary = searchLearnCatalog('fiduciary', 'nonprofit');
  assert.ok(fiduciary.some((card) => card.title === 'Fiduciary'));
  const scaffold = searchLearnCatalog('scaffolding', 'trades');
  assert.ok(scaffold.some((card) => card.subjectTitle === 'Scaffolding' || card.title === 'Scaffolding'));
  assert.equal(searchLearnCatalog('pmp', 'continuing')[0].title, 'Project Management Professional');
  assert.equal(searchSubjectKeywords('welding', 'trades', 'Gas metal arc welding')[0].title, 'Welding');
});

test('a subject keyword search stays inside that subject', () => {
  const hits = searchSubjectKeywords('algorithm', 'majors', 'Computer science');
  assert.equal(hits[0].title, 'Algorithm');
  const all = searchSubjectKeywords('', 'majors', 'Computer science');
  assert.ok(all.length >= 6);
  assert.ok(all.every((card) => card.subjectTitle === 'Computer science'));
  assert.equal(searchLearnCatalog('', 'majors').some((card) => card.title === 'Algorithm'), false);
  assert.equal(searchLearnCatalog('algorithm', 'majors')[0].title, 'Algorithm');
});

test('search shows append and binary from the computer science keyword list', () => {
  const append = searchLearnCatalog('append', 'majors');
  assert.equal(append[0].title, 'Append');
  assert.equal(append[0].subjectTitle, 'Computer science');
  const binary = searchLearnCatalog('binary', 'majors').map((card) => card.title);
  assert.equal(binary[0], 'Binary number');
  assert.ok(binary.includes('Binary search'));
  assert.ok(binary.includes('Binary tree'));
  assert.equal(pickBestLearnKeyword('append', 'majors').title, 'Append');
  assert.equal(pickBestLearnKeyword('binary', 'majors').title, 'Binary number');
  assert.equal(pickBestLearnKeyword('bi', 'majors'), null);
  assert.equal(resolveStudySectorTitle('append'), null);
});

test('catalog search does not call fetch', () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error('fetch');
  };
  try {
    const hits = searchLearnCatalog('biology', 'majors');
    assert.equal(hits[0].title, 'Biology');
  } finally {
    globalThis.fetch = original;
  }
});

test('opens a catalog title on Wikipedia and skips the word chain', async () => {
  const calls = [];
  const entry = await lookupStudyTitle('Scrum (project management)', async (url) => {
    calls.push(String(url));
    return {
      ok: true,
      json: async () => ({
        type: 'standard',
        title: 'Scrum (project management)',
        extract: 'Scrum is a project framework.',
        content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Scrum_(project_management)' } },
      }),
    };
  });
  assert.equal(entry.found, true);
  assert.equal(entry.source, 'wikipedia');
  assert.match(entry.senses[0].definition, /project framework/i);
  assert.equal(entry.articleUrl, 'https://en.wikipedia.org/wiki/Scrum_(project_management)');
  assert.equal(calls.length, 1);
  assert.match(calls[0], /wikipedia\.org/);
  assert.doesNotMatch(calls[0], /dictionaryapi/);
});

test('builds a Learn bank row from a Wikipedia summary', () => {
  const draft = learnBankDraft({
    found: true,
    word: 'CompTIA',
    senses: [{ partOfSpeech: 'field', definition: 'A certification vendor.', example: '', synonyms: [], related: [] }],
  });
  assert.equal(draft.kind, 'entry');
  assert.equal(draft.sourceLabel, 'Learn');
  assert.equal(draft.key, 'comptia');
  assert.equal(draft.text, 'CompTIA');
  assert.equal(draft.senses[0].definition, 'A certification vendor.');
  assert.equal(learnBankDraft({ found: false }), null);
});
