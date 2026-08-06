/**
 * Recover markup sources (esp. LaTeX) from clipboard HTML + live DOM selection.
 * Selecting rendered KaTeX usually copies .katex-html glyphs (Unicode), not TeX —
 * the TeX lives in a hidden .katex-mathml annotation on the parent .katex node.
 * When TeX is unavailable, keep/render the KaTeX/MathJax HTML so clips look the same.
 */

const LATEX_SIGNAL_RE =
  /\\(?:begin\{|end\{|frac\{|sqrt\{|sum(?:_|\b)|int(?:_|\b)|prod(?:_|\b)|lim(?:_|\b)|underbrace\b|overbrace\b|alpha\b|beta\b|gamma\b|delta\b|theta\b|lambda\b|pi\b|sigma\b|omega\b|infty\b|left[(\[]|right[)\]]|mathbf\{|mathrm\{|mathbb\{|text\{|cdot\b|dots\b|ldots\b|cdots\b)|\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)/;

/** Plain text that looks like a failed Unicode dump of rendered math (not source). */
const RENDERED_MATH_PLAIN_RE =
  /[·⋅⋯…⏟⏞√∞≈≠≤≥±×÷]|[ⁿ²³¹⁰ⁱ]|[₀-₉]|\\underbrace|an\s*=\s*a|[\u{1D400}-\u{1D7FF}]/u;

const TEX_HTML_PATTERNS = [
  /<annotation[^>]*encoding=["']application\/x-tex["'][^>]*>([\s\S]*?)<\/annotation>/gi,
  /<script[^>]*type=["']math\/tex(?:;?\s*mode\s*=\s*(?:display|inline))?["'][^>]*>([\s\S]*?)<\/script>/gi,
  /\b(?:data-latex|data-tex|data-formula)=["']([^"']+)["']/gi,
];

const MATH_ROOT_SELECTOR =
  '.katex, .katex-display, .MathJax, .MathJax_Display, mjx-container, math[xmlns], .math.display, .math.inline';

const MATH_HTML_SIGNAL_RE =
  /class=["'][^"']*\bkatex\b|class=["'][^"']*katex-html|mjx-container|MathJax|application\/x-tex|math\/tex/i;

export function looksLikeLatexSource(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  return LATEX_SIGNAL_RE.test(t);
}

export function looksLikeRenderedMathPlain(text) {
  const t = String(text || '').trim();
  if (!t || looksLikeLatexSource(t)) return false;
  return RENDERED_MATH_PLAIN_RE.test(t);
}

export function clipboardHtmlHasMathRenderer(html) {
  return MATH_HTML_SIGNAL_RE.test(String(html || ''));
}

function decodeHtmlEntities(value) {
  const raw = String(value || '');
  if (!raw.includes('&')) return raw;
  try {
    if (typeof document !== 'undefined') {
      const el = document.createElement('textarea');
      el.innerHTML = raw;
      return el.value;
    }
  } catch (_) { /* fall through */ }
  return raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function pushUniqueTex(out, expr) {
  const cleaned = decodeHtmlEntities(String(expr || '').trim());
  if (!cleaned || cleaned.length > 8000) return;
  if (out.includes(cleaned)) return;
  out.push(cleaned);
}

function collectRegexMatches(src, pattern, out) {
  const re = new RegExp(pattern.source, pattern.flags);
  let match;
  while ((match = re.exec(src))) {
    pushUniqueTex(out, match[1]);
  }
}

function collectAltTextTex(src, out) {
  const altTextRe = /<math[^>]*\balttext=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = altTextRe.exec(src))) {
    const alt = match[1];
    if (LATEX_SIGNAL_RE.test(alt) || /[\\^_{}]/.test(alt)) pushUniqueTex(out, alt);
  }
}

/**
 * Pull TeX sources out of KaTeX / MathJax / MathML clipboard HTML.
 * @param {string} html
 * @returns {string[]}
 */
export function extractTexExpressionsFromHtml(html) {
  const src = String(html || '');
  if (!src) return [];
  const out = [];
  for (const pattern of TEX_HTML_PATTERNS) collectRegexMatches(src, pattern, out);
  collectAltTextTex(src, out);
  return preferTopLevelTexExpressions(out);
}

/**
 * MathJax assistive MathML emits TeX for every subexpression (a, n, …).
 * Keep maximal formulas only.
 * @param {string[]} texes
 * @returns {string[]}
 */
export function preferTopLevelTexExpressions(texes) {
  const cleaned = [];
  const seen = Object.create(null);
  for (const raw of texes || []) {
    const t = String(raw || '').trim();
    if (!t || seen[t]) continue;
    seen[t] = true;
    cleaned.push(t);
  }
  cleaned.sort((a, b) => b.length - a.length);
  const kept = [];
  for (const t of cleaned) {
    if (t.length <= 2 && !/\\/.test(t)) continue;
    if (kept.some((k) => k !== t && k.includes(t))) continue;
    kept.push(t);
  }
  return kept;
}

/**
 * Prefer isolated KaTeX/MathJax nodes from a messy clipboard HTML wrapper.
 * @param {string} html
 * @returns {string}
 */
export function extractMathHtmlFragment(html) {
  const src = String(html || '');
  if (!src || !clipboardHtmlHasMathRenderer(src)) return '';
  try {
    if (typeof DOMParser === 'undefined') return src;
    const doc = new DOMParser().parseFromString(src, 'text/html');
    const nodes = doc.querySelectorAll(
      '.katex-display, .katex, mjx-container, .MathJax_Display, .MathJax',
    );
    if (!nodes.length) return src;
    return Array.from(nodes)
      .map((n) => n.outerHTML)
      .join('<div class="pc-math-gap"></div>');
  } catch (_) {
    return src;
  }
}

function normalizeMathRoot(el) {
  if (!el || el.nodeType !== 1) return null;
  const katex = el.closest?.('.katex-display, .katex');
  if (katex) return katex;
  const mjx = el.closest?.('mjx-container, .MathJax_Display, .MathJax');
  if (mjx) return mjx;
  if (el.matches?.(MATH_ROOT_SELECTOR)) return el;
  return null;
}

function extractTexFromMathElement(el, out) {
  if (!el) return;

  const ann = el.querySelector?.('annotation[encoding="application/x-tex"]');
  if (ann?.textContent) {
    pushUniqueTex(out, ann.textContent);
    return;
  }

  const assistive = el.querySelector?.('mjx-assistive-mml annotation[encoding="application/x-tex"]');
  if (assistive?.textContent) {
    pushUniqueTex(out, assistive.textContent);
    return;
  }

  for (const attr of ['data-latex', 'data-tex', 'data-formula', 'data-original']) {
    const v = el.getAttribute?.(attr);
    if (v) {
      pushUniqueTex(out, v);
      return;
    }
  }

  const aria = el.getAttribute?.('aria-label');
  if (aria && (LATEX_SIGNAL_RE.test(aria) || /[\\^_{}]/.test(aria))) {
    pushUniqueTex(out, aria);
    return;
  }

  const texScript = el.querySelector?.('script[type^="math/tex"]');
  if (texScript?.textContent) {
    pushUniqueTex(out, texScript.textContent);
    return;
  }

  let sib = el.previousElementSibling;
  for (let i = 0; i < 3 && sib; i++, sib = sib.previousElementSibling) {
    const type = String(sib.getAttribute?.('type') || '');
    if (sib.tagName === 'SCRIPT' && type.startsWith('math/tex') && sib.textContent) {
      pushUniqueTex(out, sib.textContent);
      return;
    }
  }

  const mathEl = el.tagName === 'MATH' ? el : el.querySelector?.('math');
  const alt = mathEl?.getAttribute?.('alttext');
  if (alt && (LATEX_SIGNAL_RE.test(alt) || /[\\^_{}]/.test(alt))) {
    pushUniqueTex(out, alt);
  }
}

function addClosestMathRoot(node, roots) {
  if (!node) return;
  const el = node.nodeType === 1 ? node : node.parentElement;
  if (!el) return;
  const root = normalizeMathRoot(el);
  if (root) roots.add(root);
}

/** Geometric overlap — intersectsNode alone is too loose on MathJax pages. */
function rangeOverlapsElement(range, el) {
  if (!range || !el) return false;
  try {
    if (!range.intersectsNode(el)) return false;
  } catch (_) {
    return false;
  }
  const elRect = el.getBoundingClientRect?.();
  if (!elRect) return true;
  const rects = range.getClientRects?.() || [];
  if (!rects.length) return true;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (r.width === 0 && r.height === 0) continue;
    const separate =
      elRect.right < r.left ||
      elRect.left > r.right ||
      elRect.bottom < r.top ||
      elRect.top > r.bottom;
    if (!separate) return true;
  }
  return false;
}

/**
 * Only math containers that belong to the selection — never every mjx on the page.
 * @param {Selection|null} [selection]
 * @returns {Set<Element>}
 */
export function collectMathRootsFromSelection(selection) {
  const sel =
    selection ||
    (typeof window !== 'undefined' && window.getSelection ? window.getSelection() : null);
  const roots = new Set();
  if (!sel || sel.rangeCount === 0) return roots;

  addClosestMathRoot(sel.anchorNode, roots);
  addClosestMathRoot(sel.focusNode, roots);

  for (let i = 0; i < sel.rangeCount; i++) {
    const range = sel.getRangeAt(i);
    const ca = range.commonAncestorContainer;
    const caEl = ca?.nodeType === 1 ? ca : ca?.parentElement;
    addClosestMathRoot(ca, roots);

    // Prose + formula: CA is outside math — take overlapping math under CA only.
    if (caEl && !normalizeMathRoot(caEl)) {
      const candidates = caEl.querySelectorAll?.(MATH_ROOT_SELECTOR) || [];
      candidates.forEach((child) => {
        if (!rangeOverlapsElement(range, child)) return;
        const root = normalizeMathRoot(child);
        if (root) roots.add(root);
      });
    }
  }

  return roots;
}

/**
 * MathJax often puts empty text/html on the clipboard — grab live outerHTML instead.
 * @param {Selection|null} [selection]
 * @returns {string}
 */
export function captureSelectedMathHtml(selection) {
  const roots = collectMathRootsFromSelection(selection);
  if (!roots.size) return '';
  return Array.from(roots)
    .filter((r) => r && r.isConnected)
    .map((r) => r.outerHTML)
    .join('<div class="pc-math-gap"></div>');
}

/**
 * Walk the live selection: parent .katex still holds the TeX annotation
 * even when the user only highlighted the visible .katex-html glyphs.
 * @param {Selection|null} [selection]
 * @returns {string[]}
 */
export function extractTexFromSelection(selection) {
  const sel =
    selection ||
    (typeof window !== 'undefined' && window.getSelection ? window.getSelection() : null);
  if (!sel || sel.rangeCount === 0) return [];

  const roots = collectMathRootsFromSelection(sel);

  const out = [];
  for (const root of roots) {
    extractTexFromMathElement(root, out);
  }
  return preferTopLevelTexExpressions(out);
}

function normalizeTexForKatex(expr) {
  return String(expr || '')
    .replace(/\\mbox\s*\{/g, '\\text{')
    .replace(/\\protect\s*/g, '');
}

function wrapDisplayTex(expr) {
  let t = normalizeTexForKatex(expr).trim();
  if (!t) return '';
  if (/^\$\$[\s\S]+\$\$$/.test(t) || /^\\\[[\s\S]+\\\]$/.test(t)) return t;
  return `$$\n${t}\n$$`;
}

function shouldKeepProseAroundTex(body, texes) {
  if (!body || !texes.length) return false;
  const prose = body
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l && !looksLikeRenderedMathPlain(l));
  // Keep surrounding sentences only when there is real prose (not a pure math dump).
  return prose.length > 0 && prose.join(' ').length >= 8;
}

function mergeTexLists(...lists) {
  const out = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const expr of list) pushUniqueTex(out, expr);
  }
  return out;
}

/**
 * Prefer recoverable TeX over Unicode plain text from rendered math pages.
 * Falls back to markupHint=html when only KaTeX/MathJax HTML is available.
 * @param {string} plain
 * @param {string} html
 * @param {{ domTexes?: string[] }} [options]
 * @returns {{ text: string, markupHint: string|null, usedHtmlTex: boolean, mathHtml?: string }}
 */
export function resolveClipboardMarkupText(plain, html, options = {}) {
  const body = String(plain || '').trim();
  const fromHtml = extractTexExpressionsFromHtml(html);
  const texes = preferTopLevelTexExpressions(
    mergeTexLists(options.domTexes, fromHtml),
  );
  const htmlHasMath = clipboardHtmlHasMathRenderer(html);
  let result;

  if (!texes.length) {
    if (htmlHasMath) {
      const mathHtml = extractMathHtmlFragment(html);
      result = {
        text: body,
        markupHint: 'html',
        usedHtmlTex: false,
        mathHtml: mathHtml || String(html || ''),
      };
    } else {
      result = {
        text: body,
        markupHint: looksLikeLatexSource(body) ? 'latex' : null,
        usedHtmlTex: false,
      };
    }
  } else if (looksLikeLatexSource(body) && !looksLikeRenderedMathPlain(body)) {
    result = { text: body, markupHint: 'latex', usedHtmlTex: false };
  } else {
    const rebuilt = texes.map(wrapDisplayTex).filter(Boolean).join('\n\n');
    if (!rebuilt) {
      result = { text: body, markupHint: null, usedHtmlTex: false };
    } else if (shouldKeepProseAroundTex(body, texes)) {
      const prose = body
        .split(/\n+/)
        .map((l) => l.trim())
        .filter((l) => l && !looksLikeRenderedMathPlain(l))
        .join('\n\n');
      if (prose) {
        result = {
          text: `${prose}\n\n${rebuilt}`,
          markupHint: 'markdown',
          usedHtmlTex: true,
        };
      }
    }
    if (!result) {
      result = {
        text: rebuilt,
        markupHint: 'latex',
        usedHtmlTex: true,
      };
    }
  }

  return result;
}
