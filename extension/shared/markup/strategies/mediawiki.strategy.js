/**
 * @forward-slice markup
 * Strategy: mediawiki
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  ns.registerStrategy({
    type: 'mediawiki',
    render(text) {
      let html = ns.escapeHtml(text);
      html = html.replace(/^(={2,5})\s*(.+?)\s*\1\s*$/gm, (_, eq, title) => {
        const level = Math.min(eq.length, 6);
        return `<h${level}>${title}</h${level}>`;
      });
      html = html.replace(/&#x27;&#x27;&#x27;([^&]+?)&#x27;&#x27;&#x27;/g, '<strong>$1</strong>');
      html = html.replace(/&#x27;&#x27;([^&]+?)&#x27;&#x27;/g, '<em>$1</em>');
      html = html.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<a href="#" title="$1">$2</a>');
      html = html.replace(/\[\[([^\]]+)\]\]/g, '<a href="#" title="$1">$1</a>');
      html = html.replace(/\[(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/g, '<a href="$1" target="_blank" rel="noreferrer">$2</a>');
      html = html.replace(/\{\{([^}]+)\}\}/g, '<code>{{$1}}</code>');
      html = html.replace(/^\*+\s+(.+)$/gm, '<li>$1</li>');
      html = html.replace(/^#+\s+(.+)$/gm, '<li>$1</li>');
      html = html.replace(/^-{4,}$/gm, '<hr>');
      html = html.replace(/\n/g, '<br>');
      return ns.sanitize(html);
    },
  });
})();
