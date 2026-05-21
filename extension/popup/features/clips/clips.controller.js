import { CLIPS_LIMITS } from './clips.constants.js';
import * as clipRender from './clips.render.js';
import * as clipEvents from './clips.events.js';
import * as clipService from './clips.service.js';
import * as clipState from './clips.state.js';
import * as clipViewer from './clips.viewer.js';
import * as clipPreview from './clips.preview.js';
import * as clipPdf from './clips.pdf.js';
import * as clipTitle from './clips.title.js';
import * as clipShare from './clips.share.js';

export function initClipsFeature(app) {
  app.clipsPerPage = CLIPS_LIMITS.CLIPS_PER_PAGE;
  app.maxPages = CLIPS_LIMITS.MAX_PAGES;
  app.maxClips = app.clipsPerPage * app.maxPages;

  return {
    render: clipRender,
    events: clipEvents,
    service: clipService,
    state: clipState,
    viewer: clipViewer,
    preview: clipPreview,
    pdf: clipPdf,
    title: clipTitle,
    share: clipShare,
  };
}
