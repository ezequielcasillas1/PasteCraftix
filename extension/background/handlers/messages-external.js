// EXTERNAL MESSAGE LISTENER (Password Reset from Web)
// =====================================================
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  // Never log secrets from external pages.
  const senderUrl = sender && sender.url ? String(sender.url) : '';
  let senderOrigin = '';
  try { senderOrigin = senderUrl ? (new URL(senderUrl)).origin : ''; } catch (_) { senderOrigin = ''; }
  console.log('📨 External message received:', {
    type: message?.type,
    from: senderOrigin,
    hasAccessToken: !!message?.access_token
  });

  const allowedOrigin = 'https://auth.pastecraft.com';
  if (senderOrigin !== allowedOrigin) {
    sendResponse({ success: false, error: 'unauthorized_origin' });
    return false;
  }
  
  // Strict schema check
  const type = message && typeof message.type === 'string' ? message.type : '';

  if (type === 'password_reset') {
    const accessToken = message && typeof message.access_token === 'string' ? message.access_token : '';
    const refreshToken = message && typeof message.refresh_token === 'string' ? message.refresh_token : '';
    const state = message && typeof message.state === 'string' ? message.state : '';

    if (!accessToken || accessToken.length > 4096 || (refreshToken && refreshToken.length > 4096) || (state && state.length > 256)) {
      sendResponse({ success: false, error: 'invalid_payload' });
      return false;
    }

    // Require one-time state match (prevents any allowed origin page from blindly injecting tokens).
    chrome.storage.local.get(['pc_password_reset_state_v1'], (res) => {
      const expected = res && res.pc_password_reset_state_v1 ? res.pc_password_reset_state_v1 : null;
      const expectedState = expected && typeof expected.state === 'string' ? expected.state : '';
      const createdAt = expected && typeof expected.createdAt === 'number' ? expected.createdAt : 0;
      const isFresh = !!createdAt && (Date.now() - createdAt) < (2 * 60 * 60 * 1000); // 2h

      if (!state || !expectedState || !isFresh || state !== expectedState) {
        sendResponse({ success: false, error: 'state_mismatch' });
        return;
      }

      // Consume the state so it can't be replayed.
      chrome.storage.local.remove(['pc_password_reset_state_v1'], () => {
        // Store the reset tokens for the extension's reset UI.
        chrome.storage.local.set({
          password_reset_callback: {
            access_token: accessToken,
            refresh_token: refreshToken,
            type: 'recovery',
            timestamp: Date.now()
          }
        }, () => {
          sendResponse({ success: true });
        });
      });
    });

    return true; // Keep message channel open for async response
  }
  
  sendResponse({ success: false, error: 'Unknown message type' });
});

// =====================================================
