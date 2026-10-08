/** Paint the Keywords tab from in-memory review state. */

import { COMMON_WORDS, KEYWORD_ACTIONS, KEYWORD_SELECTORS } from './keywords.constants.js';
import { displaySenses, selectEmphasisSenses } from './keywords.dictionary.js';
import { visibleKeywords } from './keywords.extract.js';

function escapeHtml(app, value) {
  if (typeof app?.escapeHtml === 'function') return app.escapeHtml(value);
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTermLine(app, label, terms) {
  if (!terms?.length) return '';
  return `<p class="keywords-synonyms"><span class="keywords-synonyms-label">${label}:</span> ${escapeHtml(app, terms.join(', '))}</p>`;
}

function renderSense(app, sense) {
  const speech = sense.partOfSpeech
    ? `<p class="keywords-pos">${escapeHtml(app, sense.partOfSpeech)}</p>`
    : '';
  const example = sense.example
    ? `<p class="keywords-example">${escapeHtml(app, sense.example)}</p>`
    : '';
  const references = sense.synonyms?.length
    ? renderTermLine(app, 'Synonyms', sense.synonyms)
    : renderTermLine(app, 'Related', sense.related);
  return `<article class="keywords-sense">${speech}<p class="keywords-definition-text">${escapeHtml(app, sense.definition)}</p>${example}${references}</article>`;
}

function renderSenses(app, senses) {
  return (senses || []).map((sense) => renderSense(app, sense)).join('');
}

function renderEntry(app, entry, label) {
  const phonetic = entry.phonetic
    ? `<p class="keywords-phonetic">${escapeHtml(app, entry.phonetic)}</p>`
    : '';
  return `
    <h4 class="keywords-card-word">${escapeHtml(app, label || entry.word)}</h4>
    ${phonetic}
    ${renderSenses(app, displaySenses(entry))}
    <p class="keywords-attribution">${escapeHtml(app, entry.attribution)}</p>
  `;
}

function renderPart(app, part, label, phraseWords) {
  const heading = `<h5 class="keywords-part-word">${escapeHtml(app, label || part.word)}</h5>`;
  if (part.entry?.error) {
    return `<section class="keywords-part">${heading}<p class="keywords-status">Could not reach the dictionary.</p></section>`;
  }
  if (!part.entry?.found) {
    return `<section class="keywords-part">${heading}<p class="keywords-status">Not in the dictionary.</p></section>`;
  }
  const phonetic = part.entry.phonetic
    ? `<p class="keywords-phonetic">${escapeHtml(app, part.entry.phonetic)}</p>`
    : '';
  const senses = selectEmphasisSenses(part.entry, phraseWords);
  return `<section class="keywords-part">${heading}${phonetic}${renderSenses(app, senses)}</section>`;
}

function renderEmphasis(app, result, label) {
  const labels = String(label || result.phrase || '').split(' ');
  const phraseWords = (result.parts || []).map((part) => part.word);
  const items = (result.parts || []).map((part, index) => ({
    part,
    label: labels[index] || part.word,
  }));
  const content = items.filter((item) => !COMMON_WORDS.has(item.part.word));
  const focus = content.length ? content : items;
  const grammar = content.length ? items.filter((item) => COMMON_WORDS.has(item.part.word)) : [];
  const parts = focus.map((item) => renderPart(app, item.part, item.label, phraseWords)).join('');
  const grammarNote = grammar.length
    ? `<p class="keywords-phrase-note">Grammar words in this phrase: ${escapeHtml(app, grammar.map((item) => item.label).join(', '))}</p>`
    : '';
  const attribution = [...new Set((result.parts || []).map((part) => part.entry?.attribution).filter(Boolean))].join(' · ');
  const credit = attribution
    ? `<p class="keywords-attribution">${escapeHtml(app, attribution)}</p>`
    : '';
  return `
    <h4 class="keywords-card-word">${escapeHtml(app, label || result.phrase)}</h4>
    <p class="keywords-phrase-note">No single dictionary entry for this phrase. Closest sense of each main word:</p>
    ${parts}
    ${grammarNote}
    ${credit}
  `;
}

function renderRecord(app, record, label) {
  if (!record || record.status === 'loading') {
    const title = label
      ? `<h4 class="keywords-card-word">${escapeHtml(app, label)}</h4>`
      : '';
    const what = String(label || '').includes(' ') ? 'phrase' : 'word';
    return `${title}<p class="keywords-status">Looking up this ${what}…</p>`;
  }
  if (record.status === 'error') {
    return '<p class="keywords-status">Could not reach the dictionary. Try again.</p>';
  }
  if (record.status !== 'ready') {
    return '<p class="keywords-status">Not in the dictionary.</p>';
  }
  if (record.result?.kind === 'emphasis') return renderEmphasis(app, record.result, label);
  if (record.result?.entry?.found) return renderEntry(app, record.result.entry, label);
  return '<p class="keywords-status">Not in the dictionary.</p>';
}

export function renderKeywordsPage(app, state, selectors = KEYWORD_SELECTORS) {
  const source = document.getElementById(selectors.SOURCE);
  const list = document.getElementById(selectors.WORD_LIST);
  const card = document.getElementById(selectors.DEFINITION);
  const toggle = document.getElementById(selectors.HIDE_COMMON);
  const inViewer = selectors.ROOT === 'clipViewerKeywords';
  if (!list || !card) return;

  if (toggle) {
    toggle.checked = !!state.hideCommon;
    toggle.disabled = state.words.length === 0;
  }

  if (!state.words.length) {
    if (source) {
      source.textContent = inViewer
        ? 'This clip has no words to review.'
        : 'Send text from Clips to review its words.';
    }
    list.innerHTML = inViewer
      ? '<p class="keywords-empty">This clip has no words to review.</p>'
      : '<p class="keywords-empty">Type in the clip composer, or select saved clips, then send them here.</p>';
    card.innerHTML = '';
    card.hidden = true;
    return;
  }

  if (source) source.textContent = state.sourceLabel || 'Clip text';
  const words = visibleKeywords(state.words, state.hideCommon);
  const selected = new Set(state.selectedKeys || []);
  if (!words.length) {
    list.innerHTML = '<p class="keywords-empty">Only common words are in this text. Turn off Hide common words to see them.</p>';
  } else {
    const clear = selected.size
      ? `<button type="button" class="keywords-clear" data-action="${KEYWORD_ACTIONS.CLEAR}">Clear</button>`
      : '';
    list.innerHTML = words.map((word) => {
      const pressed = selected.has(word.key);
      const selectedClass = pressed ? ' is-selected' : '';
      return `<button type="button" class="keywords-word${selectedClass}" data-action="${KEYWORD_ACTIONS.LOOKUP}" data-word="${escapeHtml(app, word.key)}" aria-pressed="${pressed ? 'true' : 'false'}">${escapeHtml(app, word.text)}</button>`;
    }).join('') + clear;
  }

  card.hidden = false;
  if (!state.phraseKey) {
    card.innerHTML = '<p class="keywords-status">Click a word for its definition. Click more words to define the phrase they make.</p>';
    return;
  }

  card.innerHTML = renderRecord(app, state.entries.get(state.phraseKey), state.phraseLabel);
}
