import * as widgetsService from './widgets.service.js';
import * as widgetsRender from './widgets.render.js';
import * as widgetsEvents from './widgets.events.js';

/** @forward-slice Popup Widgets tab (embed gallery). */
export function initWidgetsFeature(app) {
  app.embedWidgets = Array.isArray(app.embedWidgets) ? app.embedWidgets : [];
  app._widgetsEventsBound = false;

  return {
    service: widgetsService,
    render: widgetsRender,
    events: widgetsEvents,
  };
}
