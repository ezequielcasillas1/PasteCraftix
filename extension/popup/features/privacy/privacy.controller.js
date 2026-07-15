import { PRIVACY_NOTICE_VERSION, PRIVACY_URLS } from './privacy.constants.js';
import { initPrivacyEvents } from './privacy.events.js';
import { ensureDisclosureListRendered, refreshPrivacyDisclosure, wireAuthPrivacyLinks } from './privacy.render.js';
import {
  acknowledgePrivacyNotice,
  getPrivacyAckVersion,
  needsPrivacyChangeNotice,
} from './privacy.storage.js';

export function initPrivacyFeature(app) {
  try {
    initPrivacyEvents(app);
  } catch (e) {
    console.error('[Privacy] event init failed:', e);
  }

  return {
    constants: { PRIVACY_NOTICE_VERSION, PRIVACY_URLS },
    storage: {
      getPrivacyAckVersion,
      acknowledgePrivacyNotice,
      needsPrivacyChangeNotice,
    },
    render: {
      refresh: refreshPrivacyDisclosure,
      ensureDisclosureListRendered,
      wireAuthPrivacyLinks,
    },
    events: {
      initPrivacyEvents: () => initPrivacyEvents(app),
    },
  };
}
