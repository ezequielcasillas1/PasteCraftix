/**
 * @forward-slice markup
 * Sanitize / escape / highlight helpers.
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  function sanitize(html) {
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          'h1','h2','h3','h4','h5','h6','p','br','hr','div','span',
          'strong','b','em','i','u','s','del','ins','mark','small','sub','sup',
          'a','img',
          'ul','ol','li','dl','dt','dd',
          'table','thead','tbody','tfoot','tr','th','td','caption','colgroup','col',
          'blockquote','pre','code',
          'details','summary',
          'figure','figcaption',
          'abbr','cite','q','var','kbd','samp','time',
          'svg','path','g','circle','rect','line','polyline','polygon','text','tspan','defs','use',
          // KaTeX MathML mirror + clipboard MathML
          'math','annotation','semantics','mrow','mi','mo','mn','ms','mtext','mspace',
          'mfrac','msup','msub','msubsup','msqrt','mroot','mstyle','mtable','mtr','mtd',
          'munder','mover','munderover','menclose','mpadded','mphantom',
        ],
        ALLOWED_ATTR: [
          'href','target','rel','src','alt','title','width','height','class','id','style',
          'colspan','rowspan','scope','align','valign',
          'viewBox','xmlns','d','fill','stroke','stroke-width','transform','cx','cy','r','x','y',
          'x1','y1','x2','y2','points','font-size','text-anchor',
          'encoding','display','mathvariant','mathsize','mathcolor','stretchy','fence',
          'separator','lspace','rspace','symmetric','maxsize','minsize','alttext',
        ],
        ALLOW_DATA_ATTR: false,
        ADD_ATTR: ['target'],
      });
    }
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function highlightCode(code, lang) {
    if (typeof hljs !== 'undefined') {
      try {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
        }
        return hljs.highlightAuto(code).value;
      } catch (_) {}
    }
    return escapeHtml(code);
  }

  ns.sanitize = sanitize;
  ns.escapeHtml = escapeHtml;
  ns.highlightCode = highlightCode;
})();
