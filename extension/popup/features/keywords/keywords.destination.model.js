/** Data for the Save keyword picker: folder counts, the starting pick, and the filtered tree. */

export const DESTINATION_FILTER_MIN = 8;

export function countWordsByFolder(bank) {
  const counts = new Map();
  (Array.isArray(bank) ? bank : []).forEach((item) => {
    const id = item?.folderId;
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  });
  return counts;
}

export function pickStartFolder(folders, ...candidates) {
  const ids = new Set((Array.isArray(folders) ? folders : []).map((folder) => folder.id));
  return candidates.find((id) => id && ids.has(id)) || folders?.[0]?.id || '';
}

function matches(text, query) {
  return String(text || '').toLowerCase().includes(query);
}

export function destinationTree(library, query = '') {
  const files = Array.isArray(library?.files) ? library.files : [];
  const folders = Array.isArray(library?.folders) ? library.folders : [];
  const q = String(query || '').trim().toLowerCase();
  return files
    .map((file) => {
      const inside = folders.filter((folder) => folder.fileId === file.id);
      const fileHit = !q || matches(file.name, q);
      return { file, folders: fileHit ? inside : inside.filter((folder) => matches(folder.name, q)) };
    })
    .filter((group) => !q || group.folders.length);
}

export function folderCount(library) {
  return Array.isArray(library?.folders) ? library.folders.length : 0;
}
