/** Vertical slice: sync-notes.js */
export const syncNotesMixin = {
// NOTES SYNC METHODS
// =====================================================

// Pick the winning row when two rows share the same (user_id, note_id):
// newest updated_ms wins; on tie a tombstoned row beats a live row so a
// pending delete is never silently resurrected.
_pickPreferredNoteRow(existing, candidate) {
  const existingMs = Number.isFinite(existing?.updated_ms) ? existing.updated_ms : 0;
  const candidateMs = Number.isFinite(candidate?.updated_ms) ? candidate.updated_ms : 0;
  if (candidateMs > existingMs) return candidate;
  if (candidateMs < existingMs) return existing;
  if (candidate?.deleted_at && !existing?.deleted_at) return candidate;
  return existing;
},

_dedupeNotesByKey(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const map = new Map();
  rows.forEach(row => {
    const key = `${row.user_id}::${String(row.note_id)}`;
    const existing = map.get(key);
    map.set(key, existing ? this._pickPreferredNoteRow(existing, row) : row);
  });
  return Array.from(map.values());
},

_filterSnapshotsToRows(snapshots, rows) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) return [];
  const allowed = new Set(rows.map(r => `${r.user_id}::${String(r.note_id)}`));
  return snapshots.filter(s => allowed.has(`${s.user_id}::${String(s.note_id)}`));
},

buildDbNotesForUpsert(localNotes, userId, deviceId) {
  const allNotes = Array.isArray(localNotes) ? localNotes : [];
  const notes = allNotes.filter(note => {
    const originDeviceId = String(note?.origin_device_id || '').trim();
    return !originDeviceId || originDeviceId === deviceId;
  });
  const rows = [];
  const snapshots = [];

  const hash = (s) => {
    const str = String(s || '');
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  };

  notes.forEach((note, index) => {
    const rawId = note?.id ?? note?.note_id ?? `note_${Date.now()}_${index}`;
    const noteId = String(rawId);
    const noteType = note?.type || note?.note_type || 'note';
    const createdAtMs = Number.isFinite(note?.createdAt) ? note.createdAt : Date.now();
    const updatedAtMs = Number.isFinite(note?.updatedAt) ? note.updatedAt : createdAtMs;
    const deletedAtMs = Number.isFinite(note?.deletedAt) ? note.deletedAt : null;

    let attachments = [];
    let noteRefs = [];
    let sourceNoteIds = [];

    const clips = Array.isArray(note?.clips) ? note.clips : [];
    const images = Array.isArray(note?.images) ? note.images : [];
    const urls = Array.isArray(note?.urls) ? note.urls : [];
    attachments = [
      ...clips.map(c => ({ ...c, type: 'clip' })),
      ...images.map(i => ({ ...i, type: 'image' })),
      ...urls.map(u => ({ ...u, type: 'url' }))
    ];

    if (noteType === 'album') {
      noteRefs = Array.isArray(note?.noteRefs) ? note.noteRefs : [];
      sourceNoteIds = Array.isArray(note?.sourceNoteIds) ? note.sourceNoteIds : [];
    }

    const contentHash = hash([
      note?.title || '',
      note?.description || '',
      note?.body || '',
      JSON.stringify(attachments),
      JSON.stringify(noteRefs)
    ].join('|'));

    const row = {
      user_id: userId,
      note_id: noteId,
      note_type: noteType,
      title: note?.title || '',
      description: note?.description || '',
      body: note?.body || '',
      attachments,
      note_refs: noteRefs,
      source_note_ids: sourceNoteIds,
      created_at: new Date(createdAtMs).toISOString(),
      updated_at: new Date(updatedAtMs).toISOString(),
      updated_ms: updatedAtMs,
      deleted_at: Number.isFinite(deletedAtMs) ? new Date(deletedAtMs).toISOString() : null,
      device_id: deviceId || null,
      content_hash: contentHash
    };

    rows.push(row);
    snapshots.push({
      user_id: userId,
      note_id: noteId,
      snapshot: {
        id: noteId,
        type: noteType,
        title: row.title,
        description: row.description,
        body: row.body,
        clips: Array.isArray(note?.clips) ? note.clips : [],
        images: Array.isArray(note?.images) ? note.images : [],
        urls: Array.isArray(note?.urls) ? note.urls : [],
        noteRefs,
        sourceNoteIds,
        createdAt: createdAtMs,
        updatedAt: updatedAtMs,
        deletedAt: Number.isFinite(deletedAtMs) ? deletedAtMs : null
      },
      device_id: deviceId || null
    });
  });

  return { rows, snapshots };
},

async syncNotesToSupabase(localNotes) {
  if (!this.client) {
    console.warn('⚠️ Supabase not initialized - skipping notes sync');
    return false;
  }

  try {
    const userId = await this.getSyncUserId();
    const deviceId = await this.getDeviceId();
    await this.setUserContext(userId);

    const { rows, snapshots } = this.buildDbNotesForUpsert(localNotes, userId, deviceId);
    if (rows.length === 0) return true;

    // TOMBSTONE GUARD: prevent resurrection of deleted notes.
    const tombstoned = await this._fetchTombstonedIds('notes', 'note_id');
    const safeRows = rows.filter(r => {
      const idStr = String(r.note_id || '');
      const hasLocalTombstone = r.deleted_at != null;
      return !(tombstoned.has(idStr) && !hasLocalTombstone);
    });
    const safeSnapshots = snapshots.filter(s => {
      const idStr = String(s.note_id || '');
      return safeRows.some(r => String(r.note_id || '') === idStr);
    });
    if (safeRows.length !== rows.length) {
      console.log(`🛡️ Tombstone guard skipped ${rows.length - safeRows.length} already-deleted notes`);
      await this._mergeTombstonesIntoLocal('pc_deleted_notes', tombstoned);
    }
    if (safeRows.length === 0) {
      console.log('⚠️ All local notes were already tombstoned remotely');
      return true;
    }

    // Dedupe by (user_id, note_id) — Postgres ON CONFLICT cannot tolerate
    // duplicate keys in the same batch (error code 21000). Keep the row
    // with the latest updated_ms; on ties prefer a tombstoned row so a
    // pending delete is never lost to a stale resurrection.
    const dedupedRows = this._dedupeNotesByKey(safeRows);
    const dedupedSnapshots = this._filterSnapshotsToRows(safeSnapshots, dedupedRows);

    const { error } = await this.client
      .from('notes')
      .upsert(dedupedRows, {
        onConflict: 'user_id,note_id',
        ignoreDuplicates: false
      });
    if (error) throw error;

    try {
      if (Array.isArray(dedupedSnapshots) && dedupedSnapshots.length > 0) {
        await this.client.from('note_versions').insert(dedupedSnapshots);
      }
    } catch (_) {
      // Versioning should not block core sync
    }

    return true;
  } catch (error) {
    console.error('❌ Failed to sync notes to Supabase:', error);
    return false;
  }
},

/**
 * Sync notes from Supabase (all devices for automatic cross-device sync)
 */
async syncNotesFromSupabase() {
  if (!this.client) {
    console.warn('⚠️ Supabase not initialized - skipping notes sync');
    return null;
  }

  try {
    const userId = await this.getSyncUserId();
    await this.setUserContext(userId);

    const { data, error } = await this.client
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) throw error;

    const notes = data.map(row => {
      const noteType = row.note_type || 'note';
      const attachments = Array.isArray(row.attachments) ? row.attachments : [];
      const noteRefs = Array.isArray(row.note_refs) ? row.note_refs : [];
      const sourceNoteIds = Array.isArray(row.source_note_ids) ? row.source_note_ids : [];

      const clips = attachments.filter(a => a?.type === 'clip');
      const images = attachments.filter(a => a?.type === 'image');
      const urls = attachments.filter(a => a?.type === 'url');

      return {
        id: row.note_id,
        type: noteType,
        title: row.title || '',
        description: row.description || '',
        body: row.body || '',
        clips,
        images,
        urls,
        noteRefs,
        sourceNoteIds,
        createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
        updatedAt: Number.isFinite(row.updated_ms) ? row.updated_ms : (row.updated_at ? Date.parse(row.updated_at) : Date.now()),
        deletedAt: row.deleted_at ? Date.parse(row.deleted_at) : null,
        deviceId: row.device_id || null
      };
    });

    console.log(`✅ Fetched ${notes.length} notes from Supabase (all devices)`);
    return notes;
  } catch (error) {
    console.error('❌ Failed to sync notes from Supabase:', error);
    return null;
  }
},

async mergeNotes(localNotes, remoteNotes) {
  const merged = new Map();
  const deletedById = new Map();

  // Local ids are numbers (Date.now()), remote ids are strings (Postgres
  // TEXT). Without normalization the Map treats them as different keys and
  // every realtime echo or full sync writes a duplicate copy of every
  // recently-touched note (root cause of the 21000 ON CONFLICT failures).
  const idKey = (note) => (note?.id != null ? String(note.id) : '');

  remoteNotes.forEach(note => {
    const id = idKey(note);
    if (!id || !note?.deletedAt) return;
    deletedById.set(id, note.deletedAt);
  });

  try {
    const local = await new Promise((resolve) => {
      chrome.storage.local.get(['pc_deleted_notes'], (res) => resolve(res || {}));
    });
    const localTombs = Array.isArray(local?.pc_deleted_notes) ? local.pc_deleted_notes : [];
    localTombs.forEach((t) => {
      const id = idKey(t);
      if (!id) return;
      const when = Number.isFinite(t?.deletedAt) ? t.deletedAt : Date.now();
      const prev = deletedById.get(id) || 0;
      if (when > prev) deletedById.set(id, when);
    });
  } catch (_) { /* non-fatal */ }

  const shouldDrop = (note) => {
    if (!note) return true;
    const id = idKey(note);
    const deletedAt = id ? deletedById.get(id) : null;
    const updatedAt = Number.isFinite(note?.updatedAt) ? note.updatedAt : 0;
    return deletedAt && deletedAt >= updatedAt;
  };

  localNotes.forEach(note => {
    const id = idKey(note);
    if (!id) return;
    if (!shouldDrop(note)) merged.set(id, note);
  });

  remoteNotes.forEach(remoteNote => {
    const id = idKey(remoteNote);
    if (!id) return;
    if (shouldDrop(remoteNote)) {
      merged.delete(id);
      return;
    }
    const localNote = merged.get(id);
    if (!localNote) {
      merged.set(id, remoteNote);
      return;
    }
    const localUpdatedAt = Number.isFinite(localNote?.updatedAt) ? localNote.updatedAt : 0;
    const remoteUpdatedAt = Number.isFinite(remoteNote?.updatedAt) ? remoteNote.updatedAt : 0;
    if (remoteUpdatedAt >= localUpdatedAt) merged.set(id, remoteNote);
  });

  return Array.from(merged.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
},

async syncDeletedNotesToSupabase(deletedNotes) {
  if (!this.client) {
    console.warn('⚠️ Supabase not initialized - skipping deleted notes sync');
    return false;
  }

  const items = Array.isArray(deletedNotes) ? deletedNotes : [];
  if (items.length === 0) return true;

  try {
    const userId = await this.getSyncUserId();
    const deviceId = await this.getDeviceId();
    await this.setUserContext(userId);

    const normalized = items.map(note => ({
      ...note,
      deletedAt: Number.isFinite(note?.deletedAt) ? note.deletedAt : Date.now()
    }));
    const { rows } = this.buildDbNotesForUpsert(normalized, userId, deviceId);

    const { error } = await this.client
      .from('notes')
      .upsert(rows, {
        onConflict: 'user_id,note_id',
        ignoreDuplicates: false
      });
    if (error) throw error;

    await this.insertAuditLogs(rows.map(note => ({
      user_id: userId,
      entity_type: 'note',
      entity_id: String(note.note_id),
      action: 'soft_delete',
      data: { title: note.title, note_type: note.note_type },
      device_id: deviceId || null
    })));

    return true;
  } catch (error) {
    console.error('❌ Failed to sync deleted notes to Supabase:', error);
    return false;
  }
},

/**
 * Get total notes count for the user (for pagination).
 * Filters by user_id only (no device_id sync source filter).
 */
async getNotesCount() {
  if (!this.client) return 0;

  try {
    const userId = await this.getSyncUserId();
    if (!userId) return 0;

    const { count, error } = await this.client
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) throw error;
    return count || 0;
  } catch (e) {
    console.error('Failed to get notes count:', e);
    return 0;
  }
},

/**
 * Fetch a single page of notes for lazy loading
 */
async fetchNotesPage(offset, limit) {
  if (!this.client) return [];

  try {
    const userId = await this.getSyncUserId();
    if (!userId) return [];

    const end = offset + limit - 1;

    const { data, error } = await this.client
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .range(offset, end);

    if (error) throw error;

    return (data || []).map(note => ({
      id: note.note_id,
      type: note.note_type || 'note',
      title: note.title || '',
      description: note.description || '',
      body: note.body || '',
      clips: note.attachments?.filter(a => a.type === 'clip') || [],
      images: note.attachments?.filter(a => a.type === 'image') || [],
      urls: note.attachments?.filter(a => a.type === 'url') || [],
      noteRefs: note.note_refs || [],
      createdAt: note.created_at ? Date.parse(note.created_at) : Date.now(),
      updatedAt: note.updated_at ? Date.parse(note.updated_at) : Date.now(),
      deviceId: note.device_id || null
    }));
  } catch (e) {
    console.error(`Failed to fetch notes page (offset=${offset}, limit=${limit}):`, e);
    return [];
  }
}

// =====================================================
};
