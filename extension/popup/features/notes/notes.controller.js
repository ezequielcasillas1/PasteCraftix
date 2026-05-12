import * as noteRender from './notes.render.js';
import * as noteEvents from './notes.events.js';
import * as noteState from './notes.state.js';
import * as noteService from './notes.service.js';
import * as noteEditor from './notes.editor.js';
import * as noteAlbum from './notes.album.js';

export function initNotesFeature(_app) {
  return {
    render: noteRender,
    events: noteEvents,
    state: noteState,
    service: noteService,
    editor: noteEditor,
    album: noteAlbum,
  };
}
