/**
 * @forward-slice markup
 * Strategy: slack
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  ns.registerStrategy({
    type: 'slack',
    render(text) {
      let html = ns.escapeHtml(text);
      html = html.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');
      html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');
      html = html.replace(/~([^~\n]+)~/g, '<del>$1</del>');
      html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
      html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
      html = html.replace(/^&gt;&gt;&gt;\s*([\s\S]+)$/gm, '<blockquote>$1</blockquote>');
      html = html.replace(/^&gt;\s*(.+)$/gm, '<blockquote>$1</blockquote>');
      html = html.replace(/\n/g, '<br>');
      return ns.sanitize(html);
    },
  });
})();
