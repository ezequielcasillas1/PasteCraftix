import * as activityService from './activity.service.js';
import * as activityRender from './activity.render.js';
import * as activityEvents from './activity.events.js';

export function initActivityFeature(app) {
  app.activityEntries = [];
  app.activityOffset = 0;
  app.activityFilter = 'all';
  app.activityHasMore = true;

  return {
    service: activityService,
    render: activityRender,
    events: activityEvents,
  };
}
