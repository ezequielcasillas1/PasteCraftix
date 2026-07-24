/**
 * @forward-slice markup
 * Strategy: bbcode
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  ns.registerStrategy({
    type: 'bbcode',
    render(text) {
      let html = ns.escapeHtml(text);
      html = html.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>');
      html = html.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>');
      html = html.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>');
      html = html.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<del>$1</del>');
      html = html.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, '<pre><code>$1</code></pre>');
      html = html.replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, '<blockquote>$1</blockquote>');
      html = html.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, '<a href="$1" target="_blank" rel="noreferrer">$2</a>');
      html = html.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');
      html = html.replace(/\[img\]([\s\S]*?)\[\/img\]/gi, '<img src="$1" alt="image" style="max-width:100%;">');
      html = html.replace(/\[color=([^\]]+)\]([\s\S]*?)\[\/color\]/gi, '<span style="color:$1">$2</span>');
      html = html.replace(/\[size=([^\]]+)\]([\s\S]*?)\[\/size\]/gi, '<span style="font-size:$1">$2</span>');
      html = html.replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (_, inner) => {
        const items = inner.split(/\[\*\]/g).filter(i => i.trim());
        return '<ul>' + items.map(i => `<li>${i.trim()}</li>`).join('') + '</ul>';
      });
      html = html.replace(/\n/g, '<br>');
      return ns.sanitize(html);
    },
  });
})();
