// PasteCraft Notes Module
// Handles notes/albums management

import { STORAGE_KEYS } from '../../shared/constants.js';
import { getStorageItems, setStorageItems, normalizeArray, touchLocalUpdatedAt } from '../../shared/storage-adapter.js';
import { toast } from '../components/toast.js';
import { confirm } from '../components/modal.js';

const NOTE_TYPES = {
  NOTE: 'note',
  ALBUM: 'album'
};

/**
 * Load notes from storage
 * @param {Object} options
 * @param {string} options.type - Filter by type ('note' | 'album')
 * @returns {Promise<Array>}
 */
export async function loadNotes(options = {}) {
  const result = await getStorageItems([STORAGE_KEYS.NOTES]);
  let notes = normalizeArray(result[STORAGE_KEYS.NOTES]);

  if (options.type) {
    notes = notes.filter(n => n.type === options.type);
  }

  return notes;
}

/**
 * Save notes to storage
 * @param {Array} notes
 */
export async function saveNotes(notes) {
  await setStorageItems({ [STORAGE_KEYS.NOTES]: notes });
  await touchLocalUpdatedAt();
}

/**
 * Create a new note
 * Note: ID is generated locally. Server will assign UUID on sync.
 * @param {Object} noteData
 * @param {string} noteData.title - Note title
 * @param {string} noteData.description - Note description
 * @param {string} noteData.body - Note body/content
 * @param {string} noteData.type - 'note' | 'album'
 * @param {Array} noteData.attachments - Attachments array
 * @returns {Promise<Object>} Created note
 */
export async function createNote(noteData) {
  const {
    title = '',
    description = '',
    body = '',
    type = NOTE_TYPES.NOTE,
    attachments = []
  } = noteData;

  const notes = await loadNotes();
  const timestamp = Date.now();
  const localId = `${timestamp}_${Math.random().toString(36).slice(2, 10)}`;

  const newNote = {
    id: localId,
    type,
    title: String(title).trim(),
    description: String(description).trim(),
    body: String(body),
    attachments: Array.isArray(attachments) ? attachments : [],
    noteRefs: [],
    sourceNoteIds: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };

  notes.unshift(newNote);
  await saveNotes(notes);

  return newNote;
}

/**
 * Update a note
 * @param {string} noteId - Note ID
 * @param {Object} updates
 * @returns {Promise<Object|null>} Updated note or null
 */
export async function updateNote(noteId, updates) {
  if (!noteId) return null;

  const notes = await loadNotes();
  const index = notes.findIndex(n => String(n.id) === String(noteId));
  
  if (index === -1) return null;

  notes[index] = {
    ...notes[index],
    ...updates,
    updatedAt: Date.now()
  };

  await saveNotes(notes);
  return notes[index];
}

/**
 * Delete a note
 * @param {string} noteId - Note ID
 * @returns {Promise<boolean>}
 */
export async function deleteNote(noteId) {
  if (!noteId) return false;

  const notes = await loadNotes();
  const newNotes = notes.filter(n => String(n.id) !== String(noteId));

  if (newNotes.length === notes.length) return false;

  await saveNotes(newNotes);
  return true;
}

/**
 * Get a note by ID
 * @param {string} noteId
 * @returns {Promise<Object|null>}
 */
export async function getNoteById(noteId) {
  const notes = await loadNotes();
  return notes.find(n => String(n.id) === String(noteId)) || null;
}

/**
 * Add attachment to note
 * @param {string} noteId - Note ID
 * @param {Object} attachment - { type, content, name, timestamp }
 * @returns {Promise<Object|null>} Updated note
 */
export async function addAttachment(noteId, attachment) {
  const note = await getNoteById(noteId);
  if (!note) return null;

  const attachments = [...(note.attachments || []), {
    ...attachment,
    id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    addedAt: Date.now()
  }];

  return updateNote(noteId, { attachments });
}

/**
 * Remove attachment from note
 * @param {string} noteId - Note ID
 * @param {string} attachmentId - Attachment ID
 * @returns {Promise<Object|null>} Updated note
 */
export async function removeAttachment(noteId, attachmentId) {
  const note = await getNoteById(noteId);
  if (!note) return null;

  const attachments = (note.attachments || []).filter(
    a => String(a.id) !== String(attachmentId)
  );

  return updateNote(noteId, { attachments });
}

/**
 * Search notes
 * @param {string} query - Search query
 * @param {Object} options
 * @param {string} options.type - Filter by type
 * @returns {Promise<Array>}
 */
export async function searchNotes(query, options = {}) {
  const notes = await loadNotes(options);
  const q = String(query).toLowerCase().trim();

  if (!q) return notes;

  return notes.filter(note => {
    const title = String(note.title || '').toLowerCase();
    const description = String(note.description || '').toLowerCase();
    const body = String(note.body || '').toLowerCase();
    return title.includes(q) || description.includes(q) || body.includes(q);
  });
}

/**
 * Get albums (notes with type 'album')
 * @returns {Promise<Array>}
 */
export async function loadAlbums() {
  return loadNotes({ type: NOTE_TYPES.ALBUM });
}

/**
 * Create an album
 * @param {Object} albumData
 * @returns {Promise<Object>}
 */
export async function createAlbum(albumData) {
  return createNote({
    ...albumData,
    type: NOTE_TYPES.ALBUM
  });
}

/**
 * Confirm and delete note with UI feedback
 * @param {Object} note
 * @param {Function} onDelete
 */
export async function confirmDeleteNote(note, onDelete) {
  const title = note.title || 'Untitled';
  const type = note.type === NOTE_TYPES.ALBUM ? 'album' : 'note';

  const confirmed = await confirm({
    title: `Delete ${type}`,
    message: `Delete "${title}"? This cannot be undone.`,
    confirmText: 'Delete',
    confirmType: 'danger'
  });

  if (!confirmed) return;

  const success = await deleteNote(note.id);

  if (success) {
    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted`);
    if (onDelete) onDelete(note);
  } else {
    toast.error(`Failed to delete ${type}`);
  }
}

/**
 * Format note date
 * @param {number} timestamp
 * @returns {string}
 */
export function formatNoteDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export { NOTE_TYPES };
