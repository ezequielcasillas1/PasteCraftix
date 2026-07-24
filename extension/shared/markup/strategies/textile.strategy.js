/**
 * @forward-slice markup
 * Strategy: textile
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  ns.registerStrategy({
    type: 'textile',
    render(text) {
      let html = ns.escapeHtml(text);
      html = html.replace(/^h([1-6])\.\s+(.+)$/gm, (_, level, title) => `<h${level}>${title}</h${level}>`);
      html = html.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');
      html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');
      html = html.replace(/-([^-\n]+)-/g, '<del>$1</del>');
      html = html.replace(/\+([^+\n]+)\+/g, '<u>$1</u>');
      html = html.replace(/\^([^^]+)\^/g, '<sup>$1</sup>');
      html = html.replace(/~([^~]+)~/g, '<sub>$1</sub>');
      html = html.replace(/@([^@\n]+)@/g, '<code>$1</code>');
      html = html.replace(/^bq\.\s+(.+)$/gm, '<blockquote>$1</blockquote>');
      html = html.replace(/^p\.\s+(.+)$/gm, '<p>$1</p>');
      html = html.replace(/^\*+\s+(.+)$/gm, '<li>$1</li>');
      html = html.replace(/^#+\s+(.+)$/gm, '<li>$1</li>');
      html = html.replace(/&quot;([^&]+)&quot;:(https?:\/\/[^\s<]+)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
      html = html.replace(/!([^!\s]+)!/g, '<img src="$1" alt="image" style="max-width:100%;">');
      html = html.replace(/\n/g, '<br>');
      return ns.sanitize(html);
    },
  });
})();
