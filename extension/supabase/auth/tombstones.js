/** Vertical slice: tombstone helpers (soft-delete guards for sync). */

export const tombstonesMixin = {
  /**
   * Fetch entity ids that are already soft-deleted on Supabase for the current user.
   * Queries by user_id only — never filters sync source-of-truth by device_id.
   *
   * @param {string} tableName
   * @param {string} idColumn
   * @returns {Promise<Set<string>>}
   */
  async _fetchTombstonedIds(tableName, idColumn) {
    const empty = new Set();
    if (!this.client) return empty;
    try {
      const userId = await this.getSyncUserId();
      if (!userId) return empty;
      const { data, error } = await this.client
        .from(tableName)
        .select(idColumn + ',deleted_at')
        .eq('user_id', userId)
        .not('deleted_at', 'is', null);
      if (error) throw error;
      const set = new Set();
      (Array.isArray(data) ? data : []).forEach((row) => {
        const id = row && row[idColumn] != null ? String(row[idColumn]) : '';
        if (id) set.add(id);
      });
      return set;
    } catch (err) {
      console.warn(`⚠️ Failed to fetch tombstoned ids from ${tableName}:`, err?.message || err);
      return empty;
    }
  },

  /**
   * Persist discovered remote tombstones into local pc_deleted_<entity> storage.
   * Non-fatal on error. Does not rename storage keys.
   */
  async _mergeTombstonesIntoLocal(storageKey, tombstonedIds) {
    try {
      if (!storageKey || !(tombstonedIds instanceof Set) || tombstonedIds.size === 0) return;
      const current = await new Promise((resolve) => {
        chrome.storage.local.get([storageKey], (res) => resolve(res || {}));
      });
      const existing = Array.isArray(current[storageKey]) ? current[storageKey] : [];
      const byId = new Map();
      existing.forEach((item) => {
        const id = item && item.id != null ? String(item.id) : '';
        if (id) byId.set(id, item);
      });
      const nowMs = Date.now();
      let added = 0;
      tombstonedIds.forEach((id) => {
        if (!byId.has(id)) {
          byId.set(id, { id, deletedAt: nowMs, updatedAt: nowMs });
          added++;
        }
      });
      if (added > 0) {
        await new Promise((resolve) => {
          chrome.storage.local.set({ [storageKey]: Array.from(byId.values()) }, resolve);
        });
      }
    } catch (_) {
      // Non-fatal.
    }
  },
};
