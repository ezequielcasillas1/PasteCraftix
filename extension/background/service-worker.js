import './shared.js';
import { initBlocklistSync } from './blocklist-sync.js';
import './handlers/messages-external.js';
import './handlers/messages-internal.js';

initBlocklistSync();
import { initClipExpiryAlarms } from './clip-expiry.js';

initClipExpiryAlarms();
