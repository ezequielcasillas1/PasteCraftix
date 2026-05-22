import { FILES_STORAGE_KEYS } from './files.constants.js';

export async function loadFilesData(app) {
  const result = await chrome.storage.local.get([
    FILES_STORAGE_KEYS.FILES,
    FILES_STORAGE_KEYS.FILE_CATEGORIES
  ]);
  
  app.categoryFiles = result[FILES_STORAGE_KEYS.FILES] || [];
  app.fileCategories = result[FILES_STORAGE_KEYS.FILE_CATEGORIES] || [];
  app.selectedFileId = null; // Currently selected file filter
}

export async function saveCategoryFile(app, fileData) {
  const now = Date.now();
  const isNew = !fileData.id;
  
  const newFile = {
    id: fileData.id || `${now}_${Math.random().toString(36).slice(2)}`,
    name: fileData.name,
    colorAccent: fileData.colorAccent || '#3b82f6',
    createdAt: fileData.createdAt || now,
    updatedAt: now
  };

  if (isNew) {
    app.categoryFiles.push(newFile);
  } else {
    const index = app.categoryFiles.findIndex(f => f.id === newFile.id);
    if (index !== -1) {
      app.categoryFiles[index] = newFile;
    }
  }

  await chrome.storage.local.set({ [FILES_STORAGE_KEYS.FILES]: app.categoryFiles });
  
  if (app._idbReady && app.idb && typeof app.idb.syncEntityFromLocalStorage === 'function') {
    try {
      await app.idb.syncEntityFromLocalStorage(FILES_STORAGE_KEYS.FILES, app.categoryFiles);
    } catch (_) {}
  }
  
  if (typeof app.triggerSync === 'function') {
    app.triggerSync('syncCategoryFiles', app.categoryFiles);
  }
  return newFile;
}

export async function deleteCategoryFile(app, fileId) {
  if (!Array.isArray(app.categoryFiles)) app.categoryFiles = [];
  if (!Array.isArray(app.fileCategories)) app.fileCategories = [];
  
  app.categoryFiles = app.categoryFiles.filter(f => f.id !== fileId);
  app.fileCategories = app.fileCategories.filter(fc => fc.fileId !== fileId);
  
  if (app.selectedFileId === fileId) {
    app.selectedFileId = null;
  }

  await chrome.storage.local.set({ 
    [FILES_STORAGE_KEYS.FILES]: app.categoryFiles,
    [FILES_STORAGE_KEYS.FILE_CATEGORIES]: app.fileCategories
  });

  if (app._idbReady && app.idb) {
    try {
      if (typeof app.idb.syncEntityFromLocalStorage === 'function') {
        await app.idb.syncEntityFromLocalStorage(FILES_STORAGE_KEYS.FILES, app.categoryFiles);
        await app.idb.syncEntityFromLocalStorage(FILES_STORAGE_KEYS.FILE_CATEGORIES, app.fileCategories);
      }
      if (typeof app.idb.saveDeletedItem === 'function') {
        await app.idb.saveDeletedItem({ id: fileId }, FILES_STORAGE_KEYS.FILES);
      }
    } catch (_) {}
  }

  if (typeof app.triggerSync === 'function') {
    app.triggerSync('syncCategoryFiles', app.categoryFiles);
    app.triggerSync('syncDeletedCategoryFiles', [fileId]);
    app.triggerSync('syncFileCategories', app.fileCategories);
  }
}

export async function saveFileCategories(app, fileId, categoryIds) {
  // Ensure fileCategories array exists
  if (!Array.isArray(app.fileCategories)) {
    app.fileCategories = [];
  }
  
  // Remove existing mappings for this file
  app.fileCategories = app.fileCategories.filter(fc => fc.fileId !== fileId);
  
  const now = Date.now();
  const newMappings = categoryIds.map(catId => ({
    id: `${now}_${Math.random().toString(36).slice(2)}`,
    fileId,
    categoryId: catId,
    createdAt: now
  }));

  app.fileCategories.push(...newMappings);

  await chrome.storage.local.set({ [FILES_STORAGE_KEYS.FILE_CATEGORIES]: app.fileCategories });

  if (app._idbReady && app.idb && typeof app.idb.syncEntityFromLocalStorage === 'function') {
    try {
      await app.idb.syncEntityFromLocalStorage(FILES_STORAGE_KEYS.FILE_CATEGORIES, app.fileCategories);
    } catch (_) {}
  }

  if (typeof app.triggerSync === 'function') {
    app.triggerSync('syncFileCategories', app.fileCategories);
  }
  
  console.log('✅ Saved file categories:', { fileId, categoryIds, total: app.fileCategories.length });
}
