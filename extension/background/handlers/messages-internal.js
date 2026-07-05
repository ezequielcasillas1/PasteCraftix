import { createInternalMessageRouter } from '../messaging/router.js';
import { createInternalHandlerMap } from './internal/internal-handlers.js';

const routeInternalMessage = createInternalMessageRouter(createInternalHandlerMap());

chrome.runtime.onMessage.addListener((message, sender, sendResponse) =>
  routeInternalMessage(message, sender, sendResponse)
);
