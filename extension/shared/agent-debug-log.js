/** Optional relay for popup debug probes — primary sink is console.warn in DevTools. */

const RELAY_TYPE = 'pcAgentDebugLog';

export function relayAgentDebugLog(payload) {
  if (!payload || typeof payload !== 'object') return;
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: RELAY_TYPE, payload }).catch(() => {});
    }
  } catch (_) {}
}
