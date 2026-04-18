/*
 * PasteCraft lightweight page view beacon.
 * - No cookies, no PII. Random visitor_id stored in localStorage, rotated every 30 days.
 * - Writes to Supabase page_views via anon key (RLS policy: anon can INSERT only).
 * - Silent-fail: analytics never breaks page load.
 */
(function () {
  var SUPABASE_URL  = 'https://blpngeeqcegquiydreyu.supabase.co';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJscG5nZWVxY2VncXVpeWRyZXl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MzkyOTAsImV4cCI6MjA3NzUxNTI5MH0.eRuh8Eu66wyAMNu0tRyc9LCGVRp7Dhm_87BiQhnRY2o';

  try {
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

    var key = 'pc_vid';
    var now = Date.now();
    var raw = null;
    try { raw = localStorage.getItem(key); } catch (_) {}

    var vid, issuedAt;
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        vid = parsed.vid;
        issuedAt = parsed.t || 0;
      } catch (_) {}
    }

    var THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    if (!vid || (now - issuedAt) > THIRTY_DAYS) {
      var bytes = new Uint8Array(16);
      (window.crypto || window.msCrypto).getRandomValues(bytes);
      vid = Array.from(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      try { localStorage.setItem(key, JSON.stringify({ vid: vid, t: now })); } catch (_) {}
    }

    var path = location.pathname + (location.search || '');
    if (path.length > 200) path = path.slice(0, 200);

    var refHost = '';
    try {
      if (document.referrer) {
        var u = new URL(document.referrer);
        if (u.host && u.host !== location.host) refHost = u.host;
      }
    } catch (_) {}

    var body = JSON.stringify({
      path: path,
      visitor_id: vid,
      referrer_host: refHost || null
    });

    var url = SUPABASE_URL + '/rest/v1/page_views';
    var headers = {
      'apikey':        SUPABASE_ANON,
      'Authorization': 'Bearer ' + SUPABASE_ANON,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal'
    };

    fetch(url, {
      method:    'POST',
      headers:   headers,
      body:      body,
      keepalive: true,
      mode:      'cors',
      credentials: 'omit'
    }).catch(function () { /* silent */ });
  } catch (_) { /* silent */ }

  // Expose a tiny global helper so other pages can fire attributed usage beacons
  // without duplicating the URL/key. Anonymous events are fine — the edge function
  // attributes to the user only when an Authorization header is present.
  window.pcBeacon = function (event, meta) {
    try {
      fetch(SUPABASE_URL + '/functions/v1/usage-beacon', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        SUPABASE_ANON,
          'Authorization': 'Bearer ' + (window.pcBeaconAuth || SUPABASE_ANON),
        },
        body:      JSON.stringify({ event: event, meta: meta || {} }),
        keepalive: true,
        mode:      'cors',
      }).catch(function () { /* silent */ });
    } catch (_) { /* silent */ }
  };
})();
