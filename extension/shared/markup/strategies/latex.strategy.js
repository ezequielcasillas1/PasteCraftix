/**
 * @forward-slice markup
 * Strategy: latex
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  function renderExpr(expr, displayMode) {
    try {
      return katex.renderToString(expr.trim(), { displayMode, throwOnError: false });
    } catch (_) {
      return `<code>${ns.escapeHtml(expr)}</code>`;
    }
  }

  ns.registerStrategy({
    type: 'latex',
    render(text) {
      if (typeof katex === 'undefined') return `<pre>${ns.escapeHtml(text)}</pre>`;
      try {
        let processed = text;
        processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => renderExpr(expr, true));
        processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_, expr) => renderExpr(expr, true));
        processed = processed.replace(/\$([^$\n]+?)\$/g, (_, expr) => renderExpr(expr, false));
        processed = processed.replace(/\\\(([\s\S]+?)\\\)/g, (_, expr) => renderExpr(expr, false));
        if (processed === text) {
          const stripped = text.replace(/^\\\[|\\\]$|^\$\$|\$\$$|^\\begin\{.*?\}|\\end\{.*?\}$/g, '').trim();
          return `<div class="pc-latex-rendered">${renderExpr(stripped || text, true)}</div>`;
        }
        return `<div class="pc-latex-rendered">${processed}</div>`;
      } catch (_) {
        return `<pre>${ns.escapeHtml(text)}</pre>`;
      }
    },
    renderPreview(text, _meta, maxChars) {
      const limit = maxChars || 80;
      const t = String(text || '');
      const short = t.length > limit ? `${t.substring(0, limit)}…` : t;
      return `<span class="pc-latex-preview">${ns.escapeHtml(short)}</span>`;
    },
  });
})();
