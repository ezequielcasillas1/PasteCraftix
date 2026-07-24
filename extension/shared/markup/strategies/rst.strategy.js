/**
 * @forward-slice markup
 * Strategy: rst
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  ns.registerStrategy({
    type: 'rst',
    render(text) {
      let html = ns.escapeHtml(text);
      html = html.replace(/^(.+)\n([=\-~^"]+)$/gm, (_, title, underline) => {
        const ch = underline[0];
        const level = ch === '=' ? 1 : ch === '-' ? 2 : ch === '~' ? 3 : 4;
        return `<h${level}>${title}</h${level}>`;
      });
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      html = html.replace(/``([^`]+)``/g, '<code>$1</code>');
      html = html.replace(/\n/g, '<br>');
      return ns.sanitize(html);
    },
  });
})();
