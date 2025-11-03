// Unified callback handler for Chrome extension (OAuth + Password Reset)
console.log('🔐 Authentication callback page loaded');

// Get the URL hash containing auth tokens
const hash = window.location.hash;
console.log('🔗 Hash:', hash);

// Update UI elements
const title = document.getElementById('title');
const message = document.getElementById('message');

if (hash) {
  // Extract parameters from hash
  const params = new URLSearchParams(hash.substring(1)); // Remove # and parse
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  const type = params.get('type');
  const error_description = params.get('error_description');
  
  console.log('🎫 Access token present:', !!access_token);
  console.log('🎫 Refresh token present:', !!refresh_token);
  console.log('🔑 Type:', type);
  console.log('❌ Error:', error_description);
  
  // Check if this is an error callback
  if (error_description) {
    title.textContent = '❌ Authentication Error';
    message.textContent = error_description;
    console.error('❌ Callback error:', error_description);
    
    setTimeout(() => {
      window.close();
    }, 5000);
    return;
  }
  
  // Check if this is a password recovery callback
  if (type === 'recovery') {
    console.log('🔑 Password recovery callback detected');
    title.textContent = '🔑 Password Reset';
    message.textContent = 'Redirecting to set your new password...';
    
    // Store recovery tokens and flag
    chrome.storage.local.set({
      password_reset_callback: {
        access_token,
        refresh_token,
        type: 'recovery',
        timestamp: Date.now()
      }
    }, () => {
      console.log('✅ Recovery tokens stored, opening popup...');
      
      // Open the extension popup with reset flag
      const popupUrl = chrome.runtime.getURL('popup.html?reset=true');
      chrome.tabs.create({ url: popupUrl }, () => {
        // Close callback window after popup opens
        setTimeout(() => {
          window.close();
        }, 500);
      });
    });
    return;
  }
  
  // Otherwise, it's OAuth sign-in
  if (access_token) {
    console.log('🔐 OAuth sign-in callback detected');
    title.textContent = '✅ Signed in successfully!';
    message.textContent = 'You can close this window and reopen the extension.';
    
    // Store OAuth tokens
    chrome.storage.local.set({
      oauth_callback: {
        access_token,
        refresh_token,
        timestamp: Date.now()
      }
    }, () => {
      console.log('✅ OAuth tokens stored, closing window in 2 seconds...');
      
      // Close this window after a short delay
      setTimeout(() => {
        window.close();
      }, 2000);
    });
  }
} else {
  console.log('❌ No hash found in URL');
  title.textContent = '❌ No authentication data';
  message.textContent = 'This page should be opened from an authentication link.';
}


