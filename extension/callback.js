// Unified callback handler for Chrome extension (OAuth + Password Reset)

const hash = window.location.hash;
const title = document.getElementById('title');
const message = document.getElementById('message');

if (hash) {
  const params = new URLSearchParams(hash.substring(1));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  const type = params.get('type');
  const error_description = params.get('error_description');

  if (error_description) {
    title.textContent = '❌ Authentication Error';
    message.textContent = error_description;
    console.error('[callback] Auth error:', error_description);
    setTimeout(() => { window.close(); }, 5000);
    return;
  }

  if (type === 'recovery') {
    title.textContent = '🔑 Password Reset Ready!';
    message.textContent = 'Click the PasteCraft extension icon to set your new password.';

    const resetData = {
      access_token,
      refresh_token,
      type: 'recovery',
      timestamp: Date.now()
    };

    chrome.storage.local.set({ password_reset_callback: resetData }, () => {
      if (chrome.runtime.lastError) {
        console.error('[callback] Storage error:', chrome.runtime.lastError.message);
        title.textContent = '❌ Storage Error';
        message.textContent = chrome.runtime.lastError.message;
        return;
      }

      title.textContent = '✅ Password Reset Verified!';
      message.textContent = 'Now click the PasteCraft extension icon 📋 in your toolbar to set your new password.';

      setTimeout(() => { window.close(); }, 10000);
    });
    return;
  }

  if (access_token) {
    title.textContent = '✅ Signed in successfully!';
    message.textContent = 'You can close this window and reopen the extension.';

    chrome.storage.local.set({
      oauth_callback: { access_token, refresh_token, timestamp: Date.now() }
    }, () => {
      setTimeout(() => { window.close(); }, 2000);
    });
  }
} else {
  title.textContent = '❌ No authentication data';
  message.textContent = 'This page should be opened from an authentication link.';
}


