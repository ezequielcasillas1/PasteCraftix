/**
 * @forward-slice clips
 * Study list strategies for clip viewer (bullet vs numbered).
 */

import { hasStudyInlineMarks } from './clips.viewer-marks.js';

export const LIST_STYLES = {
  BULLET: 'bullet',
  DOT: 'dot',
  NUMBERED: 'numbered',
};

const DASH_RE = /^(\s*)[-*+]\s+/;
const DOT_RE = /^(\s*)[•·]\s+/;
const NUMBERED_RE = /^(\s*)(\d+)[.)]\s+/;
const STUDY_STYLE_SET = new Set(Object.values(LIST_STYLES));

export function isStudyListStyle(style) {
  return STUDY_STYLE_SET.has(style);
}

function normalizeNewlines(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n');
}

function parseLine(line) {
  const numbered = line.match(NUMBERED_RE);
  if (numbered) {
    return {
      style: LIST_STYLES.NUMBERED,
      indent: numbered[1],
      n: Number(numbered[2]),
      body: line.slice(numbered[0].length),
    };
  }
  const dash = line.match(DASH_RE);
  if (dash) {
    return {
      style: LIST_STYLES.BULLET,
      indent: dash[1],
      n: null,
      body: line.slice(dash[0].length),
    };
  }
  const dot = line.match(DOT_RE);
  if (dot) {
    return {
      style: LIST_STYLES.DOT,
      indent: dot[1],
      n: null,
      body: line.slice(dot[0].length),
    };
  }
  const indent = (line.match(/^\s*/) || [''])[0];
  return {
    style: null,
    indent,
    n: null,
    body: line.slice(indent.length),
  };
}

function prefixForStyle(style, n) {
  if (style === LIST_STYLES.DOT) return '• ';
  if (style === LIST_STYLES.BULLET) return '- ';
  return `${n}. `;
}

function formatLine(parsed, style, n) {
  return `${parsed.indent}${prefixForStyle(style, n)}${parsed.body}`;
}

export function toMarkdownStudyLists(text) {
  return normalizeNewlines(text).replace(/^(\s*)[•·]\s+/gm, '$1- ');
}

function lineRange(text, start, end) {
  const from = Math.max(0, Math.min(start, end, text.length));
  const to = Math.max(0, Math.min(Math.max(start, end), text.length));
  const lineStart = text.lastIndexOf('\n', from - 1) + 1;
  let lineEnd = text.indexOf('\n', to);
  if (lineEnd === -1) lineEnd = text.length;
  if (to > from && text[to - 1] === '\n' && to === lineEnd) {
    lineEnd = to - 1;
  }
  return { lineStart, lineEnd };
}

export function shouldRenderStudyLists(text) {
  return normalizeNewlines(text)
    .split('\n')
    .some((line) => {
      const parsed = parseLine(line);
      return !!parsed.style && parsed.body.trim().length > 0;
    });
}

export function resolveStudyListMarkupHint(existingHint, text) {
  if (!shouldRenderStudyLists(text) && !hasStudyInlineMarks(text)) return null;
  const current = String(existingHint || '').toLowerCase();
  if (current && current !== 'text' && current !== 'markdown') return null;
  return 'markdown';
}

export function detectStudyListStyle(text, selectionStart, selectionEnd) {
  const src = normalizeNewlines(text);
  const start = Number.isFinite(selectionStart) ? selectionStart : 0;
  const end = Number.isFinite(selectionEnd) ? selectionEnd : src.length;
  const { lineStart, lineEnd } = lineRange(src, start, end);
  const lines = src.slice(lineStart, lineEnd).split('\n');
  const styles = new Set(
    lines
      .filter((line) => line.trim())
      .map((line) => parseLine(line).style)
      .filter(Boolean),
  );
  if (styles.size === 1) return [...styles][0];
  return null;
}

export function applyStudyListFormat(text, selectionStart, selectionEnd, style) {
  const src = normalizeNewlines(text);
  const start = Number.isFinite(selectionStart) ? selectionStart : 0;
  const end = Number.isFinite(selectionEnd) ? selectionEnd : start;
  const { lineStart, lineEnd } = lineRange(src, start, end);
  const block = src.slice(lineStart, lineEnd);
  const lines = block.length ? block.split('\n') : [''];
  const parsedLines = lines.map(parseLine);
  const content = parsedLines.filter((_, i) => lines[i].trim() !== '');
  const allMatch = content.length > 0 && content.every((parsed) => parsed.style === style);

  let n = 0;
  const nextLines = lines.map((line, i) => {
    const parsed = parsedLines[i];
    if (!line.trim() && content.length > 0) return line;
    if (allMatch) return `${parsed.indent}${parsed.body}`;
    n += 1;
    return formatLine(parsed, style, n);
  });

  const nextBlock = nextLines.join('\n');
  return {
    text: src.slice(0, lineStart) + nextBlock + src.slice(lineEnd),
    selectionStart: lineStart,
    selectionEnd: lineStart + nextBlock.length,
    style,
    toggledOff: allMatch,
  };
}

export function applyStudyListEnter(text, caret) {
  const src = normalizeNewlines(text);
  const pos = Math.max(0, Math.min(Number(caret) || 0, src.length));
  const { lineStart, lineEnd } = lineRange(src, pos, pos);
  const parsed = parseLine(src.slice(lineStart, lineEnd));
  if (!parsed.style) return null;

  if (!parsed.body.trim()) {
    const nextText = `${src.slice(0, lineStart)}${parsed.indent}${src.slice(lineEnd)}`;
    const nextCaret = lineStart + parsed.indent.length;
    return {
      text: nextText,
      selectionStart: nextCaret,
      selectionEnd: nextCaret,
      exited: true,
    };
  }

  const prefix = prefixForStyle(parsed.style, (parsed.n || 1) + 1);
  const insert = `\n${parsed.indent}${prefix}`;
  const nextCaret = pos + insert.length;
  return {
    text: src.slice(0, pos) + insert + src.slice(pos),
    selectionStart: nextCaret,
    selectionEnd: nextCaret,
    exited: false,
  };
}
