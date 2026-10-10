/**
 * @forward-slice clips
 * Inline study marks for clip viewer edit: bold, underline, highlight.
 */

export const MARK_KINDS = {
  BOLD: 'bold',
  UNDERLINE: 'underline',
  HIGHLIGHT: 'highlight',
};

export const DEFAULT_STUDY_HIGHLIGHT = '#fde047';

const MARK_KIND_SET = new Set(Object.values(MARK_KINDS));
const BOLD_DELIM = '**';
const UNDERLINE_OPEN = '<u>';
const UNDERLINE_CLOSE = '</u>';
const HIGHLIGHT_CLOSE = '</mark>';
const HIGHLIGHT_OPEN_RE = /<mark style="background-color:(#[0-9a-f]{6})">/gi;

const NAMED_COLORS = Object.freeze({
  aliceblue: '#f0f8ff',
  antiquewhite: '#faebd7',
  aqua: '#00ffff',
  aquamarine: '#7fffd4',
  azure: '#f0ffff',
  beige: '#f5f5dc',
  bisque: '#ffe4c4',
  black: '#000000',
  blanchedalmond: '#ffebcd',
  blue: '#0000ff',
  blueviolet: '#8a2be2',
  brown: '#a52a2a',
  burlywood: '#deb887',
  cadetblue: '#5f9ea0',
  chartreuse: '#7fff00',
  chocolate: '#d2691e',
  coral: '#ff7f50',
  cornflowerblue: '#6495ed',
  cornsilk: '#fff8dc',
  crimson: '#dc143c',
  cyan: '#00ffff',
  darkblue: '#00008b',
  darkcyan: '#008b8b',
  darkgoldenrod: '#b8860b',
  darkgray: '#a9a9a9',
  darkgreen: '#006400',
  darkgrey: '#a9a9a9',
  darkkhaki: '#bdb76b',
  darkmagenta: '#8b008b',
  darkolivegreen: '#556b2f',
  darkorange: '#ff8c00',
  darkorchid: '#9932cc',
  darkred: '#8b0000',
  darksalmon: '#e9967a',
  darkseagreen: '#8fbc8f',
  darkslateblue: '#483d8b',
  darkslategray: '#2f4f4f',
  darkslategrey: '#2f4f4f',
  darkturquoise: '#00ced1',
  darkviolet: '#9400d3',
  deeppink: '#ff1493',
  deepskyblue: '#00bfff',
  dimgray: '#696969',
  dimgrey: '#696969',
  dodgerblue: '#1e90ff',
  firebrick: '#b22222',
  floralwhite: '#fffaf0',
  forestgreen: '#228b22',
  fuchsia: '#ff00ff',
  gainsboro: '#dcdcdc',
  ghostwhite: '#f8f8ff',
  gold: '#ffd700',
  goldenrod: '#daa520',
  gray: '#808080',
  green: '#008000',
  greenyellow: '#adff2f',
  grey: '#808080',
  honeydew: '#f0fff0',
  hotpink: '#ff69b4',
  indianred: '#cd5c5c',
  indigo: '#4b0082',
  ivory: '#fffff0',
  khaki: '#f0e68c',
  lavender: '#e6e6fa',
  lavenderblush: '#fff0f5',
  lawngreen: '#7cfc00',
  lemonchiffon: '#fffacd',
  lightblue: '#add8e6',
  lightcoral: '#f08080',
  lightcyan: '#e0ffff',
  lightgoldenrodyellow: '#fafad2',
  lightgray: '#d3d3d3',
  lightgreen: '#90ee90',
  lightgrey: '#d3d3d3',
  lightpink: '#ffb6c1',
  lightsalmon: '#ffa07a',
  lightseagreen: '#20b2aa',
  lightskyblue: '#87cefa',
  lightslategray: '#778899',
  lightslategrey: '#778899',
  lightsteelblue: '#b0c4de',
  lightyellow: '#ffffe0',
  lime: '#00ff00',
  limegreen: '#32cd32',
  linen: '#faf0e6',
  magenta: '#ff00ff',
  maroon: '#800000',
  mediumaquamarine: '#66cdaa',
  mediumblue: '#0000cd',
  mediumorchid: '#ba55d3',
  mediumpurple: '#9370db',
  mediumseagreen: '#3cb371',
  mediumslateblue: '#7b68ee',
  mediumspringgreen: '#00fa9a',
  mediumturquoise: '#48d1cc',
  mediumvioletred: '#c71585',
  midnightblue: '#191970',
  mintcream: '#f5fffa',
  mistyrose: '#ffe4e1',
  moccasin: '#ffe4b5',
  navajowhite: '#ffdead',
  navy: '#000080',
  oldlace: '#fdf5e6',
  olive: '#808000',
  olivedrab: '#6b8e23',
  orange: '#ffa500',
  orangered: '#ff4500',
  orchid: '#da70d6',
  palegoldenrod: '#eee8aa',
  palegreen: '#98fb98',
  paleturquoise: '#afeeee',
  palevioletred: '#db7093',
  papayawhip: '#ffefd5',
  peachpuff: '#ffdab9',
  peru: '#cd853f',
  pink: '#ffc0cb',
  plum: '#dda0dd',
  powderblue: '#b0e0e6',
  purple: '#800080',
  rebeccapurple: '#663399',
  red: '#ff0000',
  rosybrown: '#bc8f8f',
  royalblue: '#4169e1',
  saddlebrown: '#8b4513',
  salmon: '#fa8072',
  sandybrown: '#f4a460',
  seagreen: '#2e8b57',
  seashell: '#fff5ee',
  sienna: '#a0522d',
  silver: '#c0c0c0',
  skyblue: '#87ceeb',
  slateblue: '#6a5acd',
  slategray: '#708090',
  slategrey: '#708090',
  snow: '#fffafa',
  springgreen: '#00ff7f',
  steelblue: '#4682b4',
  tan: '#d2b48c',
  teal: '#008080',
  thistle: '#d8bfd8',
  tomato: '#ff6347',
  turquoise: '#40e0d0',
  violet: '#ee82ee',
  wheat: '#f5deb3',
  white: '#ffffff',
  whitesmoke: '#f5f5f5',
  yellow: '#ffff00',
  yellowgreen: '#9acd32',
});

export function isStudyMarkKind(kind) {
  return MARK_KIND_SET.has(kind);
}

function normalizeNewlines(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n');
}

function clampOffset(text, value) {
  const n = Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(n, text.length));
}

function toHex(r, g, b) {
  const byte = (n) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, '0');
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

function isOpaque(token) {
  if (token.endsWith('%')) return Number(token.slice(0, -1)) === 100;
  return Number(token) === 1;
}

function channelByte(token, percent) {
  const n = Number(token);
  if (!Number.isFinite(n)) return null;
  if (percent) return Math.min(255, Math.max(0, Math.round((Math.min(100, Math.max(0, n)) / 100) * 255)));
  return Math.min(255, Math.max(0, Math.round(n)));
}

function parseRgb(raw) {
  const match = raw.match(
    /^rgba?\(\s*([+-]?\d*\.?\d+)(%?)\s*(?:,|\s)\s*([+-]?\d*\.?\d+)(%?)\s*(?:,|\s)\s*([+-]?\d*\.?\d+)(%?)\s*(?:(?:,|\/)\s*([+-]?\d*\.?\d+%?)\s*)?\)$/,
  );
  if (!match) return null;
  const percent = !!(match[2] || match[4] || match[6]);
  if (percent && !(match[2] && match[4] && match[6])) return null;
  if (match[7] != null && !isOpaque(match[7])) return null;
  const r = channelByte(match[1], percent);
  const g = channelByte(match[3], percent);
  const b = channelByte(match[5], percent);
  if (r == null || g == null || b == null) return null;
  return toHex(r, g, b);
}

function hslToHex(h, s, l) {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = light - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return color * 255;
  };
  return toHex(f(0), f(8), f(4));
}

function parseHsl(raw) {
  const match = raw.match(
    /^hsla?\(\s*([+-]?\d*\.?\d+)\s*(?:,|\s)\s*(\d*\.?\d+)%\s*(?:,|\s)\s*(\d*\.?\d+)%\s*(?:(?:,|\/)\s*(\d*\.?\d+%?)\s*)?\)$/,
  );
  if (!match) return null;
  if (match[4] != null && !isOpaque(match[4])) return null;
  let h = Number(match[1]) % 360;
  if (h < 0) h += 360;
  const s = Number(match[2]);
  const l = Number(match[3]);
  if (s < 0 || s > 100 || l < 0 || l > 100) return null;
  return hslToHex(h, s, l);
}

export function normalizeStudyColor(input) {
  const raw = String(input ?? '').trim().toLowerCase();
  if (!raw || raw.length > 64) return null;
  if (/^#[0-9a-f]{3}$/.test(raw)) {
    return `#${raw.slice(1).split('').map((ch) => ch + ch).join('')}`;
  }
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
  if (Object.prototype.hasOwnProperty.call(NAMED_COLORS, raw)) return NAMED_COLORS[raw];
  return parseRgb(raw) || parseHsl(raw);
}

function isWordChar(ch) {
  return !!ch && !/[\s*<>]/.test(ch);
}

function wordRangeAt(text, index) {
  if (index < 0 || index > text.length) return null;
  let i = index;
  if (i === text.length || !isWordChar(text[i])) {
    if (i === 0 || !isWordChar(text[i - 1])) return null;
    i -= 1;
  }
  let start = i;
  while (start > 0 && isWordChar(text[start - 1])) start -= 1;
  let end = i + 1;
  while (end < text.length && isWordChar(text[end])) end += 1;
  if (start >= end) return null;
  return { start, end };
}

function collectBoldRegions(text) {
  const regions = [];
  let i = 0;
  while (i < text.length - 1) {
    if (text[i] !== '*' || text[i + 1] !== '*') {
      i += 1;
      continue;
    }
    const close = text.indexOf(BOLD_DELIM, i + 2);
    if (close === -1) break;
    if (close === i + 2) {
      i += 2;
      continue;
    }
    regions.push({
      start: i,
      end: close + BOLD_DELIM.length,
      innerStart: i + BOLD_DELIM.length,
      innerEnd: close,
    });
    i = close + BOLD_DELIM.length;
  }
  return regions;
}

function collectTagRegions(text, open, close) {
  const regions = [];
  let from = 0;
  while (from < text.length) {
    const start = text.indexOf(open, from);
    if (start === -1) break;
    const innerStart = start + open.length;
    const innerEnd = text.indexOf(close, innerStart);
    if (innerEnd === -1) break;
    regions.push({
      start,
      end: innerEnd + close.length,
      innerStart,
      innerEnd,
    });
    from = innerEnd + close.length;
  }
  return regions;
}

function collectHighlightRegions(text) {
  const regions = [];
  const re = new RegExp(HIGHLIGHT_OPEN_RE.source, 'gi');
  let match = re.exec(text);
  while (match) {
    const innerStart = match.index + match[0].length;
    const innerEnd = text.toLowerCase().indexOf(HIGHLIGHT_CLOSE, innerStart);
    if (innerEnd === -1) break;
    regions.push({
      start: match.index,
      end: innerEnd + HIGHLIGHT_CLOSE.length,
      innerStart,
      innerEnd,
      color: match[1].toLowerCase(),
    });
    re.lastIndex = innerEnd + HIGHLIGHT_CLOSE.length;
    match = re.exec(text);
  }
  return regions;
}

function covers(region, start, end) {
  if (start === end) return start >= region.start && start < region.end;
  if (region.start === start && region.end === end) return true;
  return region.innerStart <= start && region.innerEnd >= end && region.innerStart < region.innerEnd;
}

function smallestCovering(regions, start, end) {
  let best = null;
  regions.forEach((region) => {
    if (!covers(region, start, end)) return;
    if (!best || region.end - region.start < best.end - best.start) best = region;
  });
  return best;
}

function snapCaretOutOfClosers(text, index) {
  let i = index;
  for (let pass = 0; pass < 6; pass += 1) {
    let next = i;
    while (next > 0 && /[ \t]/.test(text[next - 1])) next -= 1;
    const lower = text.slice(0, next).toLowerCase();
    if (lower.endsWith('</mark>')) {
      i = next - '</mark>'.length;
      continue;
    }
    if (lower.endsWith('</u>')) {
      i = next - '</u>'.length;
      continue;
    }
    if (text.slice(next - 2, next) === '**') {
      i = next - 2;
      continue;
    }
    return next;
  }
  return i;
}

function resolveTarget(text, start, end, regions) {
  if (start !== end) {
    return { start, end, region: smallestCovering(regions, start, end) };
  }
  const snapped = snapCaretOutOfClosers(text, start);
  const inside = smallestCovering(regions, snapped, snapped);
  if (inside) return { start: inside.innerStart, end: inside.innerEnd, region: inside };
  const word = wordRangeAt(text, snapped);
  if (!word) return null;
  return {
    start: word.start,
    end: word.end,
    region: smallestCovering(regions, word.start, word.end),
  };
}

function unchanged(text, start, end, kind, extra = {}) {
  return {
    text,
    selectionStart: start,
    selectionEnd: end,
    kind,
    toggledOff: false,
    applied: false,
    ...extra,
  };
}

function unwrap(text, region, kind) {
  const inner = text.slice(region.innerStart, region.innerEnd);
  return {
    text: text.slice(0, region.start) + inner + text.slice(region.end),
    selectionStart: region.start,
    selectionEnd: region.start + inner.length,
    kind,
    toggledOff: true,
    applied: true,
  };
}

function wrap(text, start, end, open, close, kind) {
  const inner = text.slice(start, end);
  return {
    text: text.slice(0, start) + open + inner + close + text.slice(end),
    selectionStart: start + open.length,
    selectionEnd: start + open.length + inner.length,
    kind,
    toggledOff: false,
    applied: true,
  };
}

function applyResolved(text, start, end, regions, open, close, kind) {
  const target = resolveTarget(text, start, end, regions);
  if (!target) return unchanged(text, start, end, kind);
  if (target.region) return unwrap(text, target.region, kind);
  return wrap(text, target.start, target.end, open, close, kind);
}

function replaceHighlight(text, region, hex) {
  const open = `<mark style="background-color:${hex}">`;
  const inner = text.slice(region.innerStart, region.innerEnd);
  return {
    text: text.slice(0, region.start) + open + inner + HIGHLIGHT_CLOSE + text.slice(region.end),
    selectionStart: region.start + open.length,
    selectionEnd: region.start + open.length + inner.length,
    kind: MARK_KINDS.HIGHLIGHT,
    toggledOff: false,
    applied: region.color !== hex,
    color: hex,
  };
}

function applyHighlight(text, start, end, hex, options) {
  const regions = collectHighlightRegions(text);
  const target = resolveTarget(text, start, end, regions);
  if (!target) return unchanged(text, start, end, MARK_KINDS.HIGHLIGHT);
  if (target.region) {
    if (options.recolorOnly || target.region.color !== hex) {
      return replaceHighlight(text, target.region, hex);
    }
    return unwrap(text, target.region, MARK_KINDS.HIGHLIGHT);
  }
  if (options.recolorOnly) return unchanged(text, start, end, MARK_KINDS.HIGHLIGHT);
  return wrap(
    text,
    target.start,
    target.end,
    `<mark style="background-color:${hex}">`,
    HIGHLIGHT_CLOSE,
    MARK_KINDS.HIGHLIGHT,
  );
}

export function applyStudyMark(text, selectionStart, selectionEnd, kind, color, options = {}) {
  const src = normalizeNewlines(text);
  let start = clampOffset(src, selectionStart);
  let end = clampOffset(src, selectionEnd);
  if (end < start) {
    const swap = start;
    start = end;
    end = swap;
  }
  if (kind === MARK_KINDS.HIGHLIGHT) {
    const hex = normalizeStudyColor(color);
    if (!hex) return unchanged(src, start, end, kind, { invalidColor: true });
    return applyHighlight(src, start, end, hex, options);
  }
  if (kind === MARK_KINDS.BOLD) {
    return applyResolved(src, start, end, collectBoldRegions(src), BOLD_DELIM, BOLD_DELIM, kind);
  }
  if (kind === MARK_KINDS.UNDERLINE) {
    return applyResolved(
      src,
      start,
      end,
      collectTagRegions(src, UNDERLINE_OPEN, UNDERLINE_CLOSE),
      UNDERLINE_OPEN,
      UNDERLINE_CLOSE,
      kind,
    );
  }
  return unchanged(src, start, end, kind);
}

export function detectStudyMarks(text, selectionStart, selectionEnd) {
  const src = normalizeNewlines(text);
  let start = clampOffset(src, selectionStart);
  let end = clampOffset(src, selectionEnd);
  if (end < start) {
    const swap = start;
    start = end;
    end = swap;
  }
  const highlight = smallestCovering(collectHighlightRegions(src), start, end);
  return {
    bold: !!smallestCovering(collectBoldRegions(src), start, end),
    underline: !!smallestCovering(collectTagRegions(src, UNDERLINE_OPEN, UNDERLINE_CLOSE), start, end),
    highlight: highlight?.color || null,
  };
}

function regionHasText(region, text) {
  return text.slice(region.innerStart, region.innerEnd).trim().length > 0;
}

export function hasStudyInlineMarks(text) {
  const src = normalizeNewlines(text);
  if (collectBoldRegions(src).some((region) => regionHasText(region, src))) return true;
  if (collectTagRegions(src, UNDERLINE_OPEN, UNDERLINE_CLOSE).some((region) => regionHasText(region, src))) {
    return true;
  }
  return collectHighlightRegions(src).some((region) => regionHasText(region, src));
}
