const BACKUP_KEYS = [
  'clips',
  'searchOnlyClips',
  'categories',
  'notes',
  'autoDeletePeriod',
  'quickPasteSettings',
  'albumAttachmentOpenMode',
  'rememberUiLocation',
  'theme',
  'settingsUpdatedAt',
];

function _downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function _safeNameDate() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export async function exportBackupToJson(app) {
  const data = await chrome.storage.local.get(BACKUP_KEYS);
  const payload = {
    app: 'PasteCraft',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };

  _downloadText(
    `pastecraft-backup-${_safeNameDate()}.json`,
    JSON.stringify(payload, null, 2),
    'application/json'
  );
  app.showToast?.('✅ JSON backup exported');
}

function _csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function exportClipsToCsv(app) {
  const active = Array.isArray(app.clips) ? app.clips : [];
  const archived = Array.isArray(app.searchOnlyClips) ? app.searchOnlyClips : [];
  const rows = [['id', 'text', 'category', 'timestamp', 'archived']];

  active.forEach((clip) => rows.push([clip?.id, clip?.text, clip?.category, clip?.timestamp, 'false']));
  archived.forEach((clip) => rows.push([clip?.id, clip?.text, clip?.category, clip?.timestamp, 'true']));

  const csv = rows.map((row) => row.map(_csvEscape).join(',')).join('\n');
  _downloadText(`pastecraft-clips-${_safeNameDate()}.csv`, csv, 'text/csv');
  app.showToast?.('✅ Clips CSV exported');
}

function _entityKey(item) {
  if (item?.id !== undefined && item?.id !== null) return `id:${String(item.id)}`;
  return `fallback:${String(item?.text || item?.name || item?.title || '')}:${String(item?.timestamp || '')}`;
}

function _mergeByKey(current, incoming) {
  const map = new Map();
  (Array.isArray(current) ? current : []).forEach((item) => map.set(_entityKey(item), item));
  (Array.isArray(incoming) ? incoming : []).forEach((item) => {
    if (item && typeof item === 'object') map.set(_entityKey(item), item);
  });
  return Array.from(map.values());
}

function _extractBackupData(raw) {
  if (raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object') return raw.data;
  if (raw && typeof raw === 'object') return raw;
  throw new Error('Invalid backup file');
}

async function _readJsonFile(file) {
  const text = await file.text();
  return JSON.parse(text);
}

async function _persistImportedPopupData(next) {
  const result = await PasteCraftCRUD.saveOperation({
    stateGetter: () => ({
      clips: Array.isArray(next.clips) ? next.clips : [],
      searchOnlyClips: Array.isArray(next.searchOnlyClips) ? next.searchOnlyClips : [],
      categories: Array.isArray(next.categories) ? next.categories : [],
      notes: Array.isArray(next.notes) ? next.notes : [],
      autoDeletePeriod: next.autoDeletePeriod,
      quickPasteSettings: next.quickPasteSettings,
      albumAttachmentOpenMode: next.albumAttachmentOpenMode,
      rememberUiLocation: next.rememberUiLocation,
      theme: next.theme,
      settingsUpdatedAt: next.settingsUpdatedAt,
      pc_local_updatedAt: next.pc_local_updatedAt,
    }),
    stateSetter: async () => {},
    stateKeys: ['clips', 'searchOnlyClips', 'categories', 'notes', 'autoDeletePeriod', 'quickPasteSettings', 'albumAttachmentOpenMode', 'rememberUiLocation', 'theme', 'settingsUpdatedAt', 'pc_local_updatedAt'],
    mutateState: async () => {},
    storageKeys: ['clips', 'searchOnlyClips', 'categories', 'notes', 'autoDeletePeriod', 'quickPasteSettings', 'albumAttachmentOpenMode', 'rememberUiLocation', 'theme', 'settingsUpdatedAt', 'pc_local_updatedAt'],
    buildStorageData: async (state) => ({
      clips: state.clips,
      searchOnlyClips: state.searchOnlyClips,
      categories: state.categories,
      notes: state.notes,
      autoDeletePeriod: state.autoDeletePeriod,
      quickPasteSettings: state.quickPasteSettings,
      albumAttachmentOpenMode: state.albumAttachmentOpenMode,
      rememberUiLocation: state.rememberUiLocation,
      theme: state.theme,
      settingsUpdatedAt: state.settingsUpdatedAt,
      pc_local_updatedAt: state.pc_local_updatedAt,
    }),
    storageWriter: async (data) => {
      await chrome.storage.local.set(data);
    },
    verifier: async () => {
      const stored = await chrome.storage.local.get(['clips', 'searchOnlyClips', 'categories', 'notes']);
      return (
        (Array.isArray(stored.clips) ? stored.clips.length : 0) === (Array.isArray(next.clips) ? next.clips.length : 0) &&
        (Array.isArray(stored.searchOnlyClips) ? stored.searchOnlyClips.length : 0) === (Array.isArray(next.searchOnlyClips) ? next.searchOnlyClips.length : 0) &&
        (Array.isArray(stored.categories) ? stored.categories.length : 0) === (Array.isArray(next.categories) ? next.categories.length : 0) &&
        (Array.isArray(stored.notes) ? stored.notes.length : 0) === (Array.isArray(next.notes) ? next.notes.length : 0)
      );
    },
    successMessage: () => '',
    errorMessage: (error) => `Failed to import backup: ${error.message || 'Unknown error'}`,
    showToast: null,
  });

  if (!result.success) throw new Error(result.error || 'Failed to import backup');
}

export async function importBackupFromJsonMerge(app, file) {
  const backup = _extractBackupData(await _readJsonFile(file));
  const current = await chrome.storage.local.get(BACKUP_KEYS);

  const next = {
    clips: _mergeByKey(current.clips, backup.clips),
    searchOnlyClips: _mergeByKey(current.searchOnlyClips, backup.searchOnlyClips),
    categories: _mergeByKey(current.categories, backup.categories),
    notes: _mergeByKey(current.notes, backup.notes),
    pc_local_updatedAt: Date.now(),
  };

  ['autoDeletePeriod', 'quickPasteSettings', 'albumAttachmentOpenMode', 'rememberUiLocation', 'theme', 'settingsUpdatedAt'].forEach((key) => {
    if (backup[key] !== undefined) next[key] = backup[key];
  });

  await _persistImportedPopupData(next);
  await app.loadData();
  await app.loadSettings();
  app.renderChips();
  app.renderCategories();
  app.updateCategoryFilter();
  app.updatePreview();
  app.updateLastCapture();
  app.showToast?.('✅ Backup imported');
}
