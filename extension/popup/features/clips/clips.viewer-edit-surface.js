/**
 * @forward-slice clips
 * Visual study editor. The saved text still uses mark syntax; the box shows the highlight.
 */

import { DEFAULT_STUDY_HIGHLIGHT, normalizeStudyColor } from './clips.viewer-marks.js';

const MARK_AT = /^<mark style="background-color:(#[0-9a-fA-F]{6})">/;
const U_OPEN = '<u>';
const U_CLOSE = '</u>';
const BOLD = '**';

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function tokenAt(text, index) {
  if (text.startsWith(BOLD, index)) {
    const close = text.indexOf(BOLD, index + BOLD.length);
    if (close > index + BOLD.length) {
      return { kind: 'bold', innerStart: index + BOLD.length, innerEnd: close, end: close + BOLD.length };
    }
  }
  if (text.startsWith(U_OPEN, index)) {
    const close = text.indexOf(U_CLOSE, index + U_OPEN.length);
    if (close !== -1) {
      return {
        kind: 'underline',
        innerStart: index + U_OPEN.length,
        innerEnd: close,
        end: close + U_CLOSE.length,
      };
    }
  }
  const mark = MARK_AT.exec(text.slice(index));
  if (mark) {
    const innerStart = index + mark[0].length;
    const close = text.toLowerCase().indexOf('</mark>', innerStart);
    if (close !== -1) {
      return {
        kind: 'highlight',
        color: mark[1].toLowerCase(),
        innerStart,
        innerEnd: close,
        end: close + '</mark>'.length,
      };
    }
  }
  return null;
}

function renderSlice(text) {
  let html = '';
  let index = 0;
  while (index < text.length) {
    const token = tokenAt(text, index);
    if (token) {
      const inner = renderSlice(text.slice(token.innerStart, token.innerEnd));
      if (token.kind === 'bold') html += `<strong>${inner}</strong>`;
      else if (token.kind === 'underline') html += `<u>${inner}</u>`;
      else html += `<mark style="background-color:${token.color}">${inner}</mark>`;
      index = token.end;
      continue;
    }
    let next = index + 1;
    while (next < text.length && !tokenAt(text, next)) next += 1;
    html += escapeHtml(text.slice(index, next)).replace(/\n/g, '<br>');
    index = next;
  }
  return html;
}

export function renderStudyEditHtml(text) {
  return renderSlice(String(text ?? '').replace(/\r\n?/g, '\n'));
}

function markOpen(node) {
  const hex = normalizeStudyColor(node.style?.backgroundColor) || DEFAULT_STUDY_HIGHLIGHT;
  return `<mark style="background-color:${hex}">`;
}

function isBlock(node) {
  return node.nodeName === 'DIV' || node.nodeName === 'P';
}

function appendSource(state, value) {
  state.text += value;
}

function notePoint(state, node, offset) {
  const range = state.range;
  if (!range) return;
  if (!state.startSet && range.startContainer === node && range.startOffset === offset) {
    state.selectionStart = state.text.length;
    state.startSet = true;
  }
  if (!state.endSet && range.endContainer === node && range.endOffset === offset) {
    state.selectionEnd = state.text.length;
    state.endSet = true;
  }
}

function walk(node, state) {
  if (node.nodeType === 3) {
    const value = String(node.nodeValue || '').replace(/\u00a0/g, ' ');
    for (let i = 0; i < value.length; i += 1) {
      notePoint(state, node, i);
      appendSource(state, value[i]);
    }
    notePoint(state, node, value.length);
    return;
  }
  if (node.nodeName === 'BR') {
    notePoint(state, node, 0);
    appendSource(state, '\n');
    return;
  }

  const wrap = node.nodeName === 'MARK'
    ? [markOpen(node), '</mark>']
    : node.nodeName === 'U'
      ? [U_OPEN, U_CLOSE]
      : node.nodeName === 'STRONG' || node.nodeName === 'B'
        ? [BOLD, BOLD]
        : null;

  if (wrap) appendSource(state, wrap[0]);
  const children = node.childNodes ? [...node.childNodes] : [];
  notePoint(state, node, 0);
  children.forEach((child, index) => {
    if (isBlock(child) && (index > 0 || state.text.length > 0) && !state.text.endsWith('\n')) {
      appendSource(state, '\n');
    }
    notePoint(state, node, index);
    walk(child, state);
  });
  notePoint(state, node, children.length);
  if (wrap) appendSource(state, wrap[1]);
}

export function readStudyEditSurface(root) {
  if (!root) return null;
  const selection = root.ownerDocument?.getSelection?.();
  const range = selection && selection.rangeCount && root.contains(selection.anchorNode)
    ? selection.getRangeAt(0)
    : null;
  const state = {
    text: '',
    range,
    selectionStart: 0,
    selectionEnd: 0,
    startSet: false,
    endSet: false,
  };
  walk(root, state);
  if (!state.startSet) state.selectionStart = state.text.length;
  if (!state.endSet) state.selectionEnd = state.selectionStart;
  if (state.selectionEnd < state.selectionStart) {
    const swap = state.selectionStart;
    state.selectionStart = state.selectionEnd;
    state.selectionEnd = swap;
  }
  return {
    text: state.text,
    selectionStart: state.selectionStart,
    selectionEnd: state.selectionEnd,
  };
}

function pointAt(root, target) {
  const state = { text: '', range: null, point: null };
  const mark = (node, offset) => {
    if (!state.point && state.text.length >= target) state.point = { node, offset };
  };
  const visit = (node) => {
    if (state.point) return;
    if (node.nodeType === 3) {
      const value = String(node.nodeValue || '').replace(/\u00a0/g, ' ');
      if (state.text.length + value.length >= target) {
        state.point = { node, offset: target - state.text.length };
        state.text += value;
        return;
      }
      state.text += value;
      mark(node, value.length);
      return;
    }
    if (node.nodeName === 'BR') {
      if (state.text.length >= target) state.point = { node, offset: 0 };
      state.text += '\n';
      return;
    }
    const wrap = node.nodeName === 'MARK'
      ? [markOpen(node), '</mark>']
      : node.nodeName === 'U'
        ? [U_OPEN, U_CLOSE]
        : node.nodeName === 'STRONG' || node.nodeName === 'B'
          ? [BOLD, BOLD]
          : null;
    if (wrap) state.text += wrap[0];
    const children = [...(node.childNodes || [])];
    children.forEach((child, index) => {
      if (state.point) return;
      if (isBlock(child) && (index > 0 || state.text.length > 0) && !state.text.endsWith('\n')) {
        state.text += '\n';
      }
      mark(node, index);
      visit(child);
    });
    mark(node, children.length);
    if (wrap && !state.point) state.text += wrap[1];
  };
  visit(root);
  return state.point || { node: root, offset: root.childNodes?.length || 0 };
}

export function paintStudyEditSurface(root, text) {
  if (!root) return;
  root.innerHTML = renderStudyEditHtml(text);
}

export function placeStudyEditSelection(root, start, end) {
  if (!root?.ownerDocument) return;
  const doc = root.ownerDocument;
  const selection = doc.getSelection?.();
  if (!selection) return;
  const from = pointAt(root, Math.max(0, start));
  const to = pointAt(root, Math.max(0, end));
  const range = doc.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  selection.removeAllRanges();
  selection.addRange(range);
}
