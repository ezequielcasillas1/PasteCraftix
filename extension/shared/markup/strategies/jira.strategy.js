/**
 * @forward-slice markup
 * Strategy: jira
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  ns.registerStrategy({
    type: 'jira',
    render(text) {
      let html = ns.escapeHtml(text);
      html = html.replace(/^h([1-6])\.\s+(.+)$/gm, (_, level, title) => `<h${level}>${title}</h${level}>`);
      html = html.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');
      html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');
      html = html.replace(/-([^-\n]+)-/g, '<del>$1</del>');
      html = html.replace(/\+([^+\n]+)\+/g, '<u>$1</u>');
      html = html.replace(/\^([^^]+)\^/g, '<sup>$1</sup>');
      html = html.replace(/~([^~]+)~/g, '<sub>$1</sub>');
      html = html.replace(/\{\{([^}]+)\}\}/g, '<code>$1</code>');
      html = html.replace(/\{code(?::([^}]*))?\}([\s\S]*?)\{code\}/gi, (_, params, code) => {
        return `<pre class="pc-code-block"><code>${code.trim()}</code></pre>`;
      });
      html = html.replace(/\{noformat\}([\s\S]*?)\{noformat\}/gi, (_, content) => {
        return `<pre>${content.trim()}</pre>`;
      });
      html = html.replace(/\{quote\}([\s\S]*?)\{quote\}/gi, '<blockquote>$1</blockquote>');
      html = html.replace(/\{color:([^}]+)\}([\s\S]*?)\{color\}/gi, '<span style="color:$1">$2</span>');
      html = html.replace(/\{panel(?::title=([^}]*))?\}([\s\S]*?)\{panel\}/gi, (_, title, content) => {
        const heading = title ? `<div style="font-weight:700;margin-bottom:4px;">${title}</div>` : '';
        return `<div style="border:1px solid #ddd;border-radius:6px;padding:8px;margin:4px 0;">${heading}${content.trim()}</div>`;
      });
      html = html.replace(/\[([^\]|]+)\|([^\]]+)\]/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
      html = html.replace(/\[~([^\]]+)\]/g, '<code>@$1</code>');
      html = html.replace(/^\*+\s+(.+)$/gm, '<li>$1</li>');
      html = html.replace(/^#+\s+(.+)$/gm, '<li>$1</li>');
      html = html.replace(/^-{4,}$/gm, '<hr>');
      html = html.replace(/\n/g, '<br>');
      return ns.sanitize(html);
    },
  });
})();
