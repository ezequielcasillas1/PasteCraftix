/**
 * @forward-slice markup
 * Strategy: orgmode
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  ns.registerStrategy({
    type: 'orgmode',
    render(text) {
      let html = ns.escapeHtml(text);
      html = html.replace(/^(\*{1,5})\s+(.+)$/gm, (_, stars, title) => {
        const level = Math.min(stars.length, 6);
        return `<h${level}>${title}</h${level}>`;
      });
      html = html.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
      html = html.replace(/\/([^/]+)\//g, '<em>$1</em>');
      html = html.replace(/~([^~]+)~/g, '<code>$1</code>');
      html = html.replace(/=([^=]+)=/g, '<code>$1</code>');
      html = html.replace(/\+([^+]+)\+/g, '<del>$1</del>');
      html = html.replace(/\n/g, '<br>');
      return ns.sanitize(html);
    },
  });
})();
