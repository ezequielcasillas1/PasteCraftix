import * as authService from './auth.service.js';
import * as authSession from './auth.session.js';
import * as authEvents from './auth.events.js';

export function initAuthFeature(app) {
  return {
    service: authService,
    session: authSession,
    events: authEvents,
  };
}
