/** Paint keyword review modules and saved word cards. */

import {
  CLIP_VIEWER_KEYWORD_SELECTORS,
  COMMON_WORDS,
  KEYWORD_ACTIONS,
  KEYWORD_COPY,
} from './keywords.constants.js';
import { displaySenses, selectEmphasisSenses } from './keywords.dictionary.js';
import { visibleKeywords } from './keywords.extract.js';

export function escapeHtml(app, value) {
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

function renderSaveControl(app, state, record) {
  const phraseKey = state.phraseKey;
  if (!phraseKey || !record || record.status === 'loading' || record.status === 'error') return '';
  const saved = state.savedKeys?.has?.(phraseKey);
  const label = saved ? KEYWORD_COPY.SAVED : KEYWORD_COPY.SAVE;
  const savedClass = saved ? ' is-saved' : '';
  const place = saved ? state.savedPlaces?.get?.(phraseKey) : state.saveTarget;
  const hint = place
    ? `<span class="keywords-save-hint">${saved ? KEYWORD_COPY.SAVED_IN : KEYWORD_COPY.SAVES_TO} ${escapeHtml(app, place)}</span>`
    : '';
  return `<div class="keywords-save-row"><button type="button" class="keywords-save${savedClass}" data-action="${KEYWORD_ACTIONS.SAVE}">${label}</button>${hint}</div>`;
}

function renderRemoveControl(app, item) {
  return `<button type="button" class="keywords-remove" data-action="${KEYWORD_ACTIONS.REMOVE}" data-word="${escapeHtml(app, item.key)}" data-name="${escapeHtml(app, item.text)}">${KEYWORD_COPY.REMOVE}</button>`;
}

function formatSavedAt(savedAt) {
  const time = Number(savedAt);
  if (!Number.isFinite(time) || time <= 0) return '';
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return '';
  const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `Saved ${label}`;
}

function renderHistoryLine(app, item) {
  const from = item?.sourceLabel ? `From ${item.sourceLabel}` : '';
  const when = formatSavedAt(item?.savedAt);
  const text = [from, when].filter(Boolean).join(' · ');
  if (!text) return '';
  return `<p class="keywords-bank-meta">${escapeHtml(app, text)}</p>`;
}

function renderEntry(app, entry, label) {
  const phonetic = entry.phonetic
    ? `<p class="keywords-phonetic">${escapeHtml(app, entry.phonetic)}</p>`
    : '';
  return `
    <h4 class="keywords-card-word">${escapeHtml(app, label || entry.word)}</h4>
    ${phonetic}
    ${renderSenses(app, displaySenses(entry))}
  `;
}

function renderPart(app, part, label, phraseWords) {
  const heading = `<h5 class="keywords-part-word">${escapeHtml(app, label || part.word)}</h5>`;
  if (part.entry?.error) {
    return `<section class="keywords-part">${heading}<p class="keywords-status">Could not look this up. Try again.</p></section>`;
  }
  if (!part.entry?.found) {
    return `<section class="keywords-part">${heading}<p class="keywords-status">No meaning found for this word.</p></section>`;
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
  return `
    <h4 class="keywords-card-word">${escapeHtml(app, label || result.phrase)}</h4>
    <p class="keywords-phrase-note">No single meaning for this phrase. Closest sense of each main word:</p>
    ${parts}
    ${grammarNote}
  `;
}

function renderStoredPart(app, part) {
  const heading = `<h5 class="keywords-part-word">${escapeHtml(app, part.word)}</h5>`;
  if (!part.found || !part.senses?.length) {
    return `<section class="keywords-part">${heading}<p class="keywords-status">No meaning found for this word.</p></section>`;
  }
  const phonetic = part.phonetic
    ? `<p class="keywords-phonetic">${escapeHtml(app, part.phonetic)}</p>`
    : '';
  return `<section class="keywords-part">${heading}${phonetic}${renderSenses(app, part.senses)}</section>`;
}

function renderMoveControl(app, item, library) {
  const folders = library?.folders || [];
  if (folders.length < 2) return '';
  const options = (library.files || []).map((file) => {
    const group = folders
      .filter((folder) => folder.fileId === file.id)
      .map((folder) => {
        const selected = folder.id === item.folderId ? ' selected' : '';
        return `<option value="${escapeHtml(app, folder.id)}"${selected}>${escapeHtml(app, folder.name)}</option>`;
      })
      .join('');
    if (!group) return '';
    return `<optgroup label="${escapeHtml(app, file.name)}">${group}</optgroup>`;
  }).join('');
  return `<label class="keywords-move"><span>${KEYWORD_COPY.MOVE}</span><select data-action="${KEYWORD_ACTIONS.MOVE}" data-word="${escapeHtml(app, item.key)}" aria-label="${KEYWORD_COPY.MOVE}">${options}</select></label>`;
}

function renderStoredBody(app, item) {
  if (item.kind === 'emphasis') {
    const parts = (item.parts || []).map((part) => renderStoredPart(app, part)).join('');
    return `<p class="keywords-phrase-note">No single meaning for this phrase. Closest sense of each main word:</p>${parts}`;
  }
  if (item.senses?.length) {
    const phonetic = item.phonetic
      ? `<p class="keywords-phonetic">${escapeHtml(app, item.phonetic)}</p>`
      : '';
    return `${phonetic}${renderSenses(app, item.senses)}`;
  }
  return '<p class="keywords-status">No meaning found for this word.</p>';
}

export function renderStoredCard(app, item, library) {
  return `
    <h4 class="keywords-card-word">${escapeHtml(app, item.text)}</h4>
    ${renderStoredBody(app, item)}
    ${renderHistoryLine(app, item)}
    <div class="keywords-card-actions">
      ${renderMoveControl(app, item, library)}
      ${renderRemoveControl(app, item)}
    </div>
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
    return '<p class="keywords-status">Could not look this up. Try again.</p>';
  }
  if (record.status !== 'ready') {
    return '<p class="keywords-status">No meaning found for this word.</p>';
  }
  if (record.result?.kind === 'emphasis') return renderEmphasis(app, record.result, label);
  if (record.result?.entry?.found) return renderEntry(app, record.result.entry, label);
  return '<p class="keywords-status">No meaning found for this word.</p>';
}

export function renderKeywordsPage(app, state, selectors) {
  const source = document.getElementById(selectors.SOURCE);
  const list = document.getElementById(selectors.WORD_LIST);
  const card = document.getElementById(selectors.DEFINITION);
  const toggle = document.getElementById(selectors.HIDE_COMMON);
  const inClip = selectors.ROOT === CLIP_VIEWER_KEYWORD_SELECTORS.ROOT;
  if (!list || !card) return;

  if (toggle) {
    toggle.checked = !!state.hideCommon;
    toggle.disabled = state.words.length === 0;
  }

  if (!state.words.length) {
    const empty = inClip ? 'This clip has no words to save.' : 'This text has no words to save.';
    if (source) source.textContent = empty;
    list.innerHTML = `<p class="keywords-empty">${empty}</p>`;
    card.innerHTML = '';
    card.hidden = true;
    return;
  }

  if (source) source.textContent = state.sourceLabel || 'Saved text';
  const words = visibleKeywords(state.words, state.hideCommon);
  const selected = new Set(state.selectedKeys || []);
  const savedKeys = state.savedKeys;
  if (!words.length) {
    list.innerHTML = '<p class="keywords-empty">Only common words are in this text. Turn off Hide common words to see them.</p>';
  } else {
    const clear = selected.size
      ? `<button type="button" class="keywords-clear" data-action="${KEYWORD_ACTIONS.CLEAR}">Clear</button>`
      : '';
    list.innerHTML = words.map((word) => {
      const pressed = selected.has(word.key);
      const selectedClass = pressed ? ' is-selected' : '';
      const savedClass = savedKeys?.has?.(word.key) ? ' is-saved' : '';
      return `<button type="button" class="keywords-word${savedClass}${selectedClass}" data-action="${KEYWORD_ACTIONS.LOOKUP}" data-word="${escapeHtml(app, word.key)}" aria-pressed="${pressed ? 'true' : 'false'}">${escapeHtml(app, word.text)}</button>`;
    }).join('') + clear;
  }

  card.hidden = false;
  if (!state.phraseKey) {
    card.innerHTML = `<p class="keywords-status">${KEYWORD_COPY.REVIEW_HINT} Click more words to see the phrase they make.</p>`;
    return;
  }

  const record = state.entries.get(state.phraseKey);
  card.innerHTML = renderRecord(app, record, state.phraseLabel)
    + renderSaveControl(app, state, record);
}
