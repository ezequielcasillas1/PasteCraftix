/** Dictionary port: Free Dictionary → Wiktionary → Wikipedia (study sectors). */

import {
  DICTIONARY_ATTRIBUTION,
  DICTIONARY_SOURCES,
  FREE_DICTIONARY_ENDPOINT,
  LOOKUP_TIMEOUT_MS,
  MAX_SENSES,
  STORED_SENSES,
  STUDY_SECTOR_ALIASES,
  WIKIPEDIA_SUMMARY_ENDPOINT,
  WIKTIONARY_ENDPOINT,
} from './keywords.constants.js';

function emptyResult() {
  return { found: false, error: false };
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/\.[\w-]+(?:\s+\.[\w-]+)*\s*\{[^}]*\}/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanTerms(values, word, limit = 6) {
  const skip = String(word || '').trim().toLowerCase();
  const terms = [];
  for (const value of values || []) {
    const term = String(value || '').trim().toLowerCase();
    if (!term || term === skip || terms.includes(term)) continue;
    terms.push(term);
    if (terms.length >= limit) break;
  }
  return terms;
}

function relatedTerms(html, word) {
  const titles = [];
  for (const match of String(html || '').matchAll(/<a\b[^>]*\btitle="([^"]+)"/gi)) {
    const title = match[1].replace(/#.*$/, '').replace(/_/g, ' ').trim();
    titles.push(title);
  }
  return cleanTerms(titles, word);
}

function takeSenses(senses) {
  return senses.filter((sense) => sense.definition).slice(0, STORED_SENSES);
}

const OFFICE_SENSE = /\b(committees?|organi[sz]ations?|directors?|trustees?|governors?|councils?|bureau)\b/i;
const FUNCTION_SENSE = /\b(functions?|positions?|offices?|dut(?:y|ies)|responsibilit(?:y|ies))\b/i;

export function selectEmphasisSenses(entry, phraseWords) {
  const senses = entry?.senses || [];
  if (senses.length <= 1) return senses;
  const word = String(entry.word || '').toLowerCase();
  const others = (phraseWords || [])
    .map((item) => String(item || '').toLowerCase())
    .filter((item) => item && item !== word);
  const officeContext = others.some((item) => (
    item === 'role'
    || item === 'office'
    || item === 'member'
    || item === 'director'
    || item === 'trustee'
    || item === 'nonprofit'
    || item === 'charity'
  ));
  if (word === 'role' && others.length) {
    return [senses.find((sense) => FUNCTION_SENSE.test(sense.definition)) || senses[0]];
  }
  if (officeContext) {
    return [senses.find((sense) => OFFICE_SENSE.test(sense.definition)) || senses[0]];
  }
  return [senses[0]];
}

export function displaySenses(entry) {
  const senses = entry?.senses || [];
  const shown = senses.slice(0, MAX_SENSES);
  const office = senses.find((sense) => OFFICE_SENSE.test(sense.definition));
  if (office && !shown.includes(office)) shown.push(office);
  return shown;
}

export function normalizeFreeDictionary(payload, word) {
  const entry = Array.isArray(payload) ? payload[0] : null;
  if (!entry || typeof entry !== 'object') return emptyResult();

  const phonetic = entry.phonetic
    || entry.phonetics?.find((item) => item?.text)?.text
    || '';
  const senses = [];
  for (const meaning of entry.meanings || []) {
    const partOfSpeech = String(meaning?.partOfSpeech || '').trim();
    let usedMeaningSynonyms = false;
    for (const definition of meaning?.definitions || []) {
      const ownSynonyms = cleanTerms(definition?.synonyms, entry.word || word);
      const meaningSynonyms = cleanTerms(meaning?.synonyms, entry.word || word);
      const synonyms = ownSynonyms.length || usedMeaningSynonyms ? ownSynonyms : meaningSynonyms;
      if (!ownSynonyms.length && synonyms.length) usedMeaningSynonyms = true;
      senses.push({
        partOfSpeech,
        definition: stripHtml(definition?.definition),
        example: stripHtml(definition?.example),
        synonyms,
        related: [],
      });
    }
  }
  const kept = takeSenses(senses);
  if (!kept.length) return emptyResult();
  return {
    found: true,
    error: false,
    word: entry.word || word,
    phonetic: stripHtml(phonetic),
    source: DICTIONARY_SOURCES.FREE,
    attribution: DICTIONARY_ATTRIBUTION[DICTIONARY_SOURCES.FREE],
    senses: kept,
  };
}

export function normalizeWiktionary(payload, word) {
  const groups = payload?.en;
  if (!Array.isArray(groups)) return emptyResult();

  const senses = [];
  for (const group of groups) {
    if (group?.language && group.language !== 'English') continue;
    const partOfSpeech = String(group?.partOfSpeech || '').trim();
    for (const definition of group?.definitions || []) {
      const examples = Array.isArray(definition?.examples) ? definition.examples : [];
      senses.push({
        partOfSpeech,
        definition: stripHtml(definition?.definition),
        example: stripHtml(examples[0]),
        synonyms: [],
        related: relatedTerms(definition?.definition, word),
      });
    }
  }
  const kept = takeSenses(senses);
  if (!kept.length) return emptyResult();
  return {
    found: true,
    error: false,
    word,
    phonetic: '',
    source: DICTIONARY_SOURCES.WIKTIONARY,
    attribution: DICTIONARY_ATTRIBUTION[DICTIONARY_SOURCES.WIKTIONARY],
    senses: kept,
  };
}

function dictionaryKey(word) {
  return String(word || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Resolve a study-sector alias to a Wikipedia article title, or null. */
export function resolveStudySectorTitle(word) {
  const key = dictionaryKey(word);
  return STUDY_SECTOR_ALIASES[key] || null;
}

function wiktionaryUrl(key) {
  return `${WIKTIONARY_ENDPOINT}${encodeURIComponent(key.replace(/ /g, '_'))}`;
}

function wikipediaTitle(keyOrTitle) {
  return String(keyOrTitle || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/^./, (ch) => ch.toUpperCase());
}

function wikipediaUrl(title) {
  return `${WIKIPEDIA_SUMMARY_ENDPOINT}${encodeURIComponent(wikipediaTitle(title))}`;
}

export function normalizeWikipedia(payload, word) {
  if (!payload || typeof payload !== 'object') return emptyResult();
  if (payload.type === 'disambiguation') return emptyResult();
  if (typeof payload.type === 'string' && payload.type.includes('not_found')) return emptyResult();

  const extract = stripHtml(payload.extract);
  const description = stripHtml(payload.description);
  const definition = extract || description;
  if (!definition) return emptyResult();

  return {
    found: true,
    error: false,
    word: stripHtml(payload.title) || word,
    phonetic: '',
    source: DICTIONARY_SOURCES.WIKIPEDIA,
    attribution: DICTIONARY_ATTRIBUTION[DICTIONARY_SOURCES.WIKIPEDIA],
    senses: takeSenses([{
      partOfSpeech: 'field',
      definition,
      example: description && extract && description !== extract ? description : '',
      synonyms: [],
      related: [],
    }]),
  };
}

async function readPayload(fetchImpl, url) {
  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });
  if (!response?.ok) return null;
  return response.json();
}

async function lookupWikipedia(title, word, fetchImpl) {
  try {
    const payload = await readPayload(fetchImpl, wikipediaUrl(title));
    const entry = normalizeWikipedia(payload, word);
    return { entry, responded: true };
  } catch {
    return { entry: emptyResult(), responded: false };
  }
}

export async function lookupWord(word, fetchImpl = globalThis.fetch) {
  const key = dictionaryKey(word);
  if (!key || typeof fetchImpl !== 'function') return emptyResult();

  let responded = false;
  const studyTitle = resolveStudySectorTitle(key);

  // Study majors/fields: Wikipedia first so Wiktionary cannot steal "premed" etc.
  if (studyTitle) {
    const study = await lookupWikipedia(studyTitle, key, fetchImpl);
    responded = responded || study.responded;
    if (study.entry.found) return study.entry;
  }

  let freePayload = null;
  try {
    freePayload = await readPayload(fetchImpl, `${FREE_DICTIONARY_ENDPOINT}${encodeURIComponent(key)}`);
    responded = true;
  } catch {
    freePayload = null;
  }
  const fromFree = normalizeFreeDictionary(freePayload, key);
  if (fromFree.found) return fromFree;

  let wikiPayload = null;
  try {
    wikiPayload = await readPayload(fetchImpl, wiktionaryUrl(key));
    responded = true;
  } catch {
    wikiPayload = null;
  }
  const fromWiki = normalizeWiktionary(wikiPayload, key);
  if (fromWiki.found) return fromWiki;

  if (!studyTitle) {
    const fallback = await lookupWikipedia(key, key, fetchImpl);
    responded = responded || fallback.responded;
    if (fallback.entry.found) return fallback.entry;
  }

  if (!responded) return { found: false, error: true };
  return emptyResult();
}

function emphasisResult(phrase, parts) {
  const anyFound = parts.some((part) => part.entry?.found);
  const allFailed = parts.every((part) => part.entry?.error);
  if (!anyFound && allFailed) {
    return { found: false, error: true, kind: 'emphasis', phrase, parts };
  }
  return { found: anyFound, error: false, kind: 'emphasis', phrase, parts };
}

export async function lookupEmphasis(phrase, fetchImpl = globalThis.fetch) {
  const key = dictionaryKey(phrase);
  if (!key || typeof fetchImpl !== 'function') return emptyResult();
  if (!key.includes(' ')) {
    const entry = await lookupWord(key, fetchImpl);
    return {
      found: !!entry.found,
      error: !!entry.error,
      kind: 'entry',
      phrase: key,
      entry,
    };
  }

  const phraseEntry = await lookupWord(key, fetchImpl);
  if (phraseEntry.found) {
    return { found: true, error: false, kind: 'entry', phrase: key, entry: phraseEntry };
  }

  const parts = await Promise.all(key.split(' ').map(async (word) => ({
    word,
    entry: await lookupWord(word, fetchImpl),
  })));
  return emphasisResult(key, parts);
}
