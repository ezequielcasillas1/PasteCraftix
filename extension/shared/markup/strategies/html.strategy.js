/**
 * @forward-slice markup
 * Strategy: html
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  ns.registerStrategy({
    type: 'html',
    render(text, meta) {
      const raw = (meta && meta.html) ? meta.html : text;
      return ns.sanitize(raw);
    },
  });
})();
