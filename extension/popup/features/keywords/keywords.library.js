/** Keyword files and folders. Saved words keep their meanings and stay in one folder. */

import {
  DEFAULT_KEYWORD_FILE_ID,
  DEFAULT_KEYWORD_FOLDER_ID,
  KEYWORD_COPY,
} from './keywords.constants.js';

const NAME_LIMIT = 40;

export function cleanKeywordName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, NAME_LIMIT);
}

export function createKeywordId(prefix, now = Date.now()) {
  return `${prefix}_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function finiteTime(value, fallback) {
  const time = Number(value);
  return Number.isFinite(time) ? time : fallback;
}

function takeName(name, siblings, kind) {
  const clean = cleanKeywordName(name);
  if (!clean) return { ok: false, error: 'Enter a name.' };
  const used = siblings.some((item) => item.name.toLowerCase() === clean.toLowerCase());
  if (used) return { ok: false, error: `A ${kind} already has that name.` };
  return { ok: true, name: clean };
}

function homeFileName(files) {
  const used = new Set(files.map((file) => file.name.toLowerCase()));
  return used.has(KEYWORD_COPY.DEFAULT_FILE.toLowerCase()) ? 'Saved words' : KEYWORD_COPY.DEFAULT_FILE;
}

function homeFolderName(folders) {
  const used = new Set(folders.map((folder) => folder.name.toLowerCase()));
  return used.has(KEYWORD_COPY.DEFAULT_FOLDER.toLowerCase()) ? 'Saved words' : KEYWORD_COPY.DEFAULT_FOLDER;
}

export function ensureKeywordLibrary(raw, bank, now = Date.now()) {
  let changed = !raw || typeof raw !== 'object';
  const source = changed ? {} : raw;
  const files = [];
  const fileIds = new Set();
  const fileNames = new Set();

  (Array.isArray(source.files) ? source.files : []).forEach((item) => {
    const id = String(item?.id || '').trim().slice(0, 48);
    const name = cleanKeywordName(item?.name);
    if (!id || !name || fileIds.has(id) || fileNames.has(name.toLowerCase())) {
      changed = true;
      return;
    }
    if (name !== String(item?.name || '')) changed = true;
    fileIds.add(id);
    fileNames.add(name.toLowerCase());
    files.push({ id, name, createdAt: finiteTime(item?.createdAt, now) });
  });

  if (!fileIds.has(DEFAULT_KEYWORD_FILE_ID)) {
    changed = true;
    const name = homeFileName(files);
    files.unshift({ id: DEFAULT_KEYWORD_FILE_ID, name, createdAt: 0 });
    fileIds.add(DEFAULT_KEYWORD_FILE_ID);
  }

  const keptFiles = files;
  const keptFileIds = new Set(keptFiles.map((file) => file.id));

  const folders = [];
  const folderIds = new Set();
  const namesByFile = new Map();
  (Array.isArray(source.folders) ? source.folders : []).forEach((item) => {
    const id = String(item?.id || '').trim().slice(0, 48);
    let fileId = String(item?.fileId || '').trim();
    const name = cleanKeywordName(item?.name);
    if (!keptFileIds.has(fileId)) {
      fileId = DEFAULT_KEYWORD_FILE_ID;
      changed = true;
    }
    const used = namesByFile.get(fileId) || new Set();
    if (!id || !name || folderIds.has(id) || used.has(name.toLowerCase())) {
      changed = true;
      return;
    }
    if (name !== String(item?.name || '')) changed = true;
    used.add(name.toLowerCase());
    namesByFile.set(fileId, used);
    folderIds.add(id);
    folders.push({ id, fileId, name, createdAt: finiteTime(item?.createdAt, now) });
  });

  if (!folders.some((folder) => folder.id === DEFAULT_KEYWORD_FOLDER_ID)) {
    changed = true;
    const homeFolders = folders.filter((folder) => folder.fileId === DEFAULT_KEYWORD_FILE_ID);
    folders.unshift({
      id: DEFAULT_KEYWORD_FOLDER_ID,
      fileId: DEFAULT_KEYWORD_FILE_ID,
      name: homeFolderName(homeFolders),
      createdAt: 0,
    });
  }

  const keptFolders = folders;
  const validFolders = new Set(keptFolders.map((folder) => folder.id));

  let fileId = String(source.selection?.fileId || '');
  let folderId = String(source.selection?.folderId || '');
  if (!keptFileIds.has(fileId)) {
    fileId = DEFAULT_KEYWORD_FILE_ID;
    changed = true;
  }
  const inFile = keptFolders.filter((folder) => folder.fileId === fileId);
  if (!inFile.some((folder) => folder.id === folderId)) {
    folderId = inFile[0]?.id || DEFAULT_KEYWORD_FOLDER_ID;
    changed = true;
  }

  const nextBank = (Array.isArray(bank) ? bank : []).map((item) => {
    if (!item || typeof item !== 'object') return item;
    if (item.folderId && validFolders.has(item.folderId)) return item;
    changed = true;
    return { ...item, folderId: DEFAULT_KEYWORD_FOLDER_ID };
  });

  return {
    library: {
      files: keptFiles,
      folders: keptFolders,
      selection: { fileId, folderId },
    },
    bank: nextBank,
    changed,
  };
}

export function addKeywordFile(library, name, now = Date.now()) {
  const taken = takeName(name, library.files, 'file');
  if (!taken.ok) return taken;
  const id = createKeywordId('kwf', now);
  const folderId = createKeywordId('kwd', now);
  return {
    ok: true,
    fileId: id,
    folderId,
    library: {
      ...library,
      files: [...library.files, { id, name: taken.name, createdAt: now }],
      folders: [...library.folders, {
        id: folderId,
        fileId: id,
        name: KEYWORD_COPY.FIRST_FOLDER,
        createdAt: now,
      }],
    },
  };
}

export function addKeywordFolder(library, fileId, name, now = Date.now()) {
  if (!library.files.some((file) => file.id === fileId)) {
    return { ok: false, error: 'Choose a file first.' };
  }
  const siblings = library.folders.filter((folder) => folder.fileId === fileId);
  const taken = takeName(name, siblings, 'folder');
  if (!taken.ok) return taken;
  const id = createKeywordId('kwd', now);
  return {
    ok: true,
    folderId: id,
    library: {
      ...library,
      folders: [...library.folders, { id, fileId, name: taken.name, createdAt: now }],
    },
  };
}

export function renameKeywordFile(library, fileId, name) {
  const file = library.files.find((item) => item.id === fileId);
  if (!file) return { ok: false, error: 'File not found.' };
  const taken = takeName(name, library.files.filter((item) => item.id !== fileId), 'file');
  if (!taken.ok) return taken;
  if (file.name === taken.name) return { ok: true, library };
  return {
    ok: true,
    library: {
      ...library,
      files: library.files.map((item) => (item.id === fileId ? { ...item, name: taken.name } : item)),
    },
  };
}

export function renameKeywordFolder(library, folderId, name) {
  const folder = library.folders.find((item) => item.id === folderId);
  if (!folder) return { ok: false, error: 'Folder not found.' };
  const siblings = library.folders.filter((item) => item.fileId === folder.fileId && item.id !== folderId);
  const taken = takeName(name, siblings, 'folder');
  if (!taken.ok) return taken;
  if (folder.name === taken.name) return { ok: true, library };
  return {
    ok: true,
    library: {
      ...library,
      folders: library.folders.map((item) => (item.id === folderId ? { ...item, name: taken.name } : item)),
    },
  };
}

function folderName(library, folderId) {
  return library.folders.find((folder) => folder.id === folderId)?.name || KEYWORD_COPY.DEFAULT_FOLDER;
}

export function removeKeywordFile(library, bank, fileId) {
  if (fileId === DEFAULT_KEYWORD_FILE_ID) {
    return { ok: false, error: 'Saved stays so your words have a home.' };
  }
  if (!library.files.some((file) => file.id === fileId)) {
    return { ok: false, error: 'File not found.' };
  }
  const folderIds = new Set(
    library.folders.filter((folder) => folder.fileId === fileId).map((folder) => folder.id),
  );
  const nextBank = (Array.isArray(bank) ? bank : []).map((item) => (
    folderIds.has(item?.folderId) ? { ...item, folderId: DEFAULT_KEYWORD_FOLDER_ID } : item
  ));
  const selection = library.selection?.fileId === fileId
    ? { fileId: DEFAULT_KEYWORD_FILE_ID, folderId: DEFAULT_KEYWORD_FOLDER_ID }
    : library.selection;
  return {
    ok: true,
    library: {
      ...library,
      files: library.files.filter((file) => file.id !== fileId),
      folders: library.folders.filter((folder) => folder.fileId !== fileId),
      selection,
    },
    bank: nextBank,
  };
}

export function removeKeywordFolder(library, bank, folderId) {
  if (folderId === DEFAULT_KEYWORD_FOLDER_ID) {
    return { ok: false, error: `${folderName(library, folderId)} stays so your words have a home.` };
  }
  const folder = library.folders.find((item) => item.id === folderId);
  if (!folder) return { ok: false, error: 'Folder not found.' };
  const siblings = library.folders.filter((item) => item.fileId === folder.fileId && item.id !== folderId);
  if (!siblings.length) return { ok: false, error: 'Each file keeps one folder.' };
  const home = siblings[0].id;
  const nextBank = (Array.isArray(bank) ? bank : []).map((item) => (
    item?.folderId === folderId ? { ...item, folderId: home } : item
  ));
  const selection = library.selection?.folderId === folderId
    ? { fileId: library.folders.find((item) => item.id === home)?.fileId || DEFAULT_KEYWORD_FILE_ID, folderId: home }
    : library.selection;
  return {
    ok: true,
    library: {
      ...library,
      folders: library.folders.filter((item) => item.id !== folderId),
      selection,
    },
    bank: nextBank,
  };
}

export function describeKeywordPlace(library, folderId) {
  const folder = library?.folders?.find((item) => item.id === folderId);
  const file = library?.files?.find((item) => item.id === folder?.fileId);
  return `${file?.name || KEYWORD_COPY.DEFAULT_FILE} / ${folder?.name || KEYWORD_COPY.DEFAULT_FOLDER}`;
}

export function chooseKeywordFolder(library, folderId) {
  const folder = library.folders.find((item) => item.id === folderId);
  if (!folder) return { ok: false, error: 'Folder not found.' };
  return {
    ok: true,
    library: { ...library, selection: { fileId: folder.fileId, folderId: folder.id } },
  };
}

export function placeKeyword(bank, library, key, folderId) {
  const folder = library.folders.find((item) => item.id === folderId);
  if (!folder) return { ok: false, error: 'Folder not found.' };
  const target = String(key || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!(Array.isArray(bank) ? bank : []).some((item) => item?.key === target)) {
    return { ok: false, error: 'Word not found.' };
  }
  return {
    ok: true,
    bank: bank.map((item) => (item?.key === target ? { ...item, folderId } : item)),
  };
}