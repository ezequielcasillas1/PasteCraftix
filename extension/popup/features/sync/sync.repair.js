/**
 * Normalizes legacy clip shapes and stabilizes clip ids for local storage merges.
 */

export function repairLocalClipIds(clipsRaw, searchOnlyRaw) {
  const normalize = (raw) => {
    const arr = Array.isArray(raw) ? raw : [];
    const seen = new Set();
    let changed = false;

    const hashText = (t) => {
      const s = String(t || '');
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      return (h >>> 0).toString(36);
    };

    const toObj = (clip, i) => {
      if (typeof clip === 'string') {
        changed = true;
        const ts = Date.now();
        return {
          id: `${ts}_${hashText(clip)}_${i}`,
          text: clip,
          category: 'Uncategorized',
          timestamp: ts
        };
      }
      if (clip && typeof clip === 'object') return { ...clip };
      changed = true;
      return null;
    };

    const out = [];
    for (let i = 0; i < arr.length; i++) {
      const c = toObj(arr[i], i);
      if (!c) continue;
      if (!c.text) { changed = true; continue; }

      const ts = typeof c.timestamp === 'number' ? c.timestamp : Date.now();
      if (typeof c.timestamp !== 'number') { c.timestamp = ts; changed = true; }

      let id = c.id ?? c.clip_id ?? c.clipId ?? null;
      if (id == null) {
        id = `${ts}_${hashText(c.text)}_${i}`;
        c.id = id;
        changed = true;
      } else if (c.id == null) {
        c.id = id;
        changed = true;
      }

      const key = String(c.id);
      if (seen.has(key)) {
        const contentKey = `${hashText(c.text)}:${Math.floor(ts / 3000)}:${String(c.category || 'Uncategorized')}`;
        const hasSameContentAlready = out.some(x =>
          `${hashText(x.text)}:${Math.floor((x.timestamp || 0) / 3000)}:${String(x.category || 'Uncategorized')}` === contentKey
        );
        if (hasSameContentAlready) {
          changed = true;
          continue;
        }
        c.id = `${key}__r${ts}_${i}`;
        changed = true;
      }
      seen.add(String(c.id));
      out.push(c);
    }

    return { out, changed };
  };

  const active = normalize(clipsRaw);
  const archived = normalize(searchOnlyRaw);

  return {
    changed: !!(active.changed || archived.changed),
    activeChanged: !!active.changed,
    archivedChanged: !!archived.changed,
    clips: active.out,
    searchOnlyClips: archived.out
  };
}
