/**
 * Strict HTML sanitization for user-generated clip / markup content.
 * Load after DOMPurify (classic script). API: globalThis.PCSanitize.strictSanitize(html)
 */
(function initStrictSanitize(global) {
  'use strict';

  const FORBID_TAGS = [
    'script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'meta', 'base',
    'template', 'style', 'audio', 'video', 'source', 'track', 'frame', 'frameset', 'applet',
    'marquee', 'foreignObject', 'set', 'handler',
  ];

  const FORBID_ATTR = [
    'style', 'formaction', 'form', 'xmlns:xlink', 'xlink:href', 'action', 'background',
    'dynsrc', 'lowsrc', 'ping', 'srcdoc', 'srcset',
  ];

  const ALLOWED_TAGS = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'div', 'span',
    'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'mark', 'small', 'sub', 'sup',
    'a', 'img',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
    'blockquote', 'pre', 'code',
    'details', 'summary',
    'figure', 'figcaption',
    'abbr', 'cite', 'q', 'var', 'kbd', 'samp', 'time',
    'svg', 'path', 'g', 'circle', 'rect', 'line', 'polyline', 'polygon', 'text', 'tspan', 'defs',
  ];

  const ALLOWED_ATTR = [
    'href', 'target', 'rel', 'src', 'alt', 'title', 'width', 'height', 'class',
    'colspan', 'rowspan', 'scope', 'align', 'valign',
    'viewBox', 'xmlns', 'd', 'fill', 'stroke', 'stroke-width', 'transform', 'cx', 'cy', 'r', 'x', 'y',
    'x1', 'y1', 'x2', 'y2', 'points', 'font-size', 'text-anchor', 'aria-hidden', 'role',
  ];

  function isBlockedUri(value) {
    const v = String(value || '').trim();
    if (/^(?:javascript|vbscript|file|blob):/i.test(v)) return true;
    if (/^data:/i.test(v) && !/^data:image\//i.test(v)) return true;
    return false;
  }

  let hooksRegistered = false;

  function isAllowedImageSrc(src) {
    const value = String(src || '').trim();
    if (!value) return false;
    if (/^https?:\/\//i.test(value)) return true;
    return /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);(?:base64,|charset=utf-8,)/i.test(value);
  }

  function isAllowedLinkHref(href) {
    const value = String(href || '').trim();
    if (!value || value === '#') return false;
    if (isBlockedUri(value)) return false;
    try {
      const parsed = new URL(value, 'https://example.invalid');
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:' || parsed.protocol === 'tel:';
    } catch (_) {
      return /^https?:\/\//i.test(value) || /^mailto:/i.test(value) || /^tel:/i.test(value);
    }
  }

  function stripEventHandlerAttrs(node) {
    if (!node || !node.attributes) return;
    const toRemove = [];
    for (let i = 0; i < node.attributes.length; i += 1) {
      const name = node.attributes[i].name;
      if (/^on/i.test(name)) toRemove.push(name);
    }
    toRemove.forEach((name) => node.removeAttribute(name));
  }

  function ensureHooks() {
    if (hooksRegistered || typeof DOMPurify === 'undefined') return;
    hooksRegistered = true;

    DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
      const name = data.attrName;
      const value = String(data.attrValue || '').trim();

      if (/^on/i.test(name)) {
        data.keepAttr = false;
        return;
      }

      if (name === 'src' || name === 'href') {
        if (isBlockedUri(value)) {
          data.keepAttr = false;
          return;
        }
        if (name === 'src') {
          if (!isAllowedImageSrc(value) && node.tagName !== 'A') {
            data.keepAttr = false;
          }
          return;
        }
        if (name === 'href' && !isAllowedLinkHref(value)) {
          data.keepAttr = false;
        }
      }
    });

    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      stripEventHandlerAttrs(node);

      if (node.tagName === 'A') {
        const href = node.getAttribute('href');
        if (!href || !isAllowedLinkHref(href)) {
          node.removeAttribute('href');
          node.setAttribute('data-pc-stripped-href', '1');
        } else {
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer');
        }
      }

      if (node.tagName === 'IMG') {
        const src = node.getAttribute('src');
        if (!isAllowedImageSrc(src)) {
          node.removeAttribute('src');
          node.setAttribute('alt', node.getAttribute('alt') || 'Blocked image source');
        }
      }
    });
  }

  function fallbackEscape(html) {
    const div = document.createElement('div');
    div.textContent = String(html ?? '');
    return div.innerHTML;
  }

  function strictSanitize(html) {
    const input = String(html ?? '');
    if (!input) return '';

    if (typeof DOMPurify === 'undefined') {
      return fallbackEscape(input);
    }

    ensureHooks();

    return DOMPurify.sanitize(input, {
      USE_PROFILES: { html: true },
      SAFE_FOR_TEMPLATES: true,
      ALLOW_UNKNOWN_PROTOCOLS: false,
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      FORBID_TAGS,
      FORBID_ATTR,
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target', 'rel'],
      ALLOWED_URI_REGEXP:
        /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    });
  }

  /**
   * Build safe link markup for display (http(s) only). Unsafe URLs render as plain text.
   */
  function buildSafeUrlDisplayHtml(url, escapeHtml) {
    const raw = String(url || '').trim();
    const esc = typeof escapeHtml === 'function' ? escapeHtml : fallbackEscape;
    if (!raw) return '';
    if (!isAllowedLinkHref(raw)) {
      return `<span class="pc-url-display">${esc(raw)}</span>`;
    }
    const safe = esc(raw);
    return `<a data-pc-open-url="1" href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`;
  }

  const api = {
    strictSanitize,
    isAllowedImageSrc,
    isAllowedLinkHref,
    buildSafeUrlDisplayHtml,
  };

  global.PCSanitize = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
