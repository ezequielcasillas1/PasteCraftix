/** PasteCraft Merchant — background service worker (auth/sync hooks added in later phases). */

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    console.info('[PasteCraft Merchant] installed');
  }
});
