/** Synchronous boot probe — runs before popup.js (visible in Console → Errors). */
(function pcTabNavProbeBoot() {
  'use strict';
  var buf = (window.__pcTabNavProbe = window.__pcTabNavProbe || []);

  function push(message, data) {
    var entry = {
      ts: Date.now(),
      perfMs: typeof performance !== 'undefined' ? performance.now() : 0,
      message: message,
      data: data || {},
    };
    buf.push(entry);
    console.error('[PasteCraft:tabnav:BOOT]', message, entry);
    return entry;
  }

  window.dumpPcTabNavProbe = function dumpPcTabNavProbe() {
    console.table(buf);
    return buf;
  };

  push('probe boot script executed', {
    href: String(location.href || ''),
    readyState: document.readyState,
  });
})();
