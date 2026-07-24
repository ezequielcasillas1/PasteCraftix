/**
 * @forward-slice markup
 * Strategy: asciidoc
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  ns.registerStrategy({
    type: 'asciidoc',
    render(text) {
      let html = ns.escapeHtml(text);
      html = html.replace(/^(={1,5})\s+(.+)$/gm, (_, eq, title) => {
        const level = Math.min(eq.length, 6);
        return `<h${level}>${title}</h${level}>`;
      });
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
      html = html.replace(/__([^_]+)__/g, '<em>$1</em>');
      html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
      html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
      html = html.replace(/\n/g, '<br>');
      return ns.sanitize(html);
    },
  });
})();
