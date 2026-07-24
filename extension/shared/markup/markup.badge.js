/**
 * @forward-slice markup
 * Badge helpers.
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  function getMarkupBadge(type) {
    const badge = ns.BADGE_MAP[type];
    if (!badge) return '';
    return `<span class="pc-markup-badge" style="background:${badge.bg};color:${badge.fg};">${badge.label}</span>`;
  }

  function getMarkupBadgeForClip(text, meta) {
    const type = ns.detectMarkupType(text, meta);
    return getMarkupBadge(type);
  }

  ns.getMarkupBadge = getMarkupBadge;
  ns.getMarkupBadgeForClip = getMarkupBadgeForClip;
})();
