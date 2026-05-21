import * as authService from './auth.service.js';
import * as authSession from './auth.session.js';
import * as authEvents from './auth.events.js';
import * as authCallbacks from './auth.callbacks.js';
import * as authPassword from './auth.password-strength.js';

export function initAuthFeature(app) {
  return {
    service: authService,
    session: authSession,
    events: authEvents,
    callbacks: authCallbacks,
    password: authPassword,
  };
}
