/**
 * @forward-slice markup
 * Strategy: html (including KaTeX/MathJax clipboard fragments)
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  function wrapMathFragment(raw) {
    let html = String(raw || '');
    if (!html.trim()) return html;

    const hasKatexRoot = /class=["'][^"']*\bkatex\b/.test(html);
    const hasKatexBits = /class=["'][^"']*(katex-html|mord|mbin|mrel|mopen|mclose|minner)/.test(html);
    const hasMjx = /mjx-container|MathJax/.test(html);

    if (!hasKatexRoot && hasKatexBits) {
      html = `<span class="katex"><span class="katex-html" aria-hidden="true">${html}</span></span>`;
    }

    if (hasKatexRoot || hasKatexBits || hasMjx) {
      return `<div class="pc-math-html pc-latex-rendered">${html}</div>`;
    }
    return html;
  }

  ns.registerStrategy({
    type: 'html',
    render(text, meta) {
      const raw = (meta && meta.html) ? meta.html : text;
      return ns.sanitize(wrapMathFragment(raw));
    },
  });
})();
