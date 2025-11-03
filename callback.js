// Unified callback handler for Chrome extension (OAuth + Password Reset)
console.log('=================================');
console.log('🔐 CALLBACK.JS LOADED');
console.log('=================================');
console.log('📍 Full URL:', window.location.href);
console.log('🔍 Location search:', window.location.search);
console.log('🔍 Location hash:', window.location.hash);
console.log('🔍 Location pathname:', window.location.pathname);

// Get the URL hash containing auth tokens
const hash = window.location.hash;
console.log('🔗 Hash extracted:', hash);
console.log('🔗 Hash length:', hash.length);

// Update UI elements
const title = document.getElementById('title');
const message = document.getElementById('message');
console.log('✅ UI elements found:', { title: !!title, message: !!message });

if (hash) {
  console.log('✅ Hash found, parsing parameters...');
  
  // Extract parameters from hash
  const params = new URLSearchParams(hash.substring(1)); // Remove # and parse
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  const type = params.get('type');
  const error_description = params.get('error_description');
  
  console.log('=================================');
  console.log('📦 PARSED PARAMETERS:');
  console.log('=================================');
  console.log('🎫 Access token present:', !!access_token);
  console.log('🎫 Access token length:', access_token?.length || 0);
  console.log('🎫 Refresh token present:', !!refresh_token);
  console.log('🎫 Refresh token length:', refresh_token?.length || 0);
  console.log('🔑 Type:', type);
  console.log('❌ Error:', error_description);
  console.log('=================================');
  
  // Log all parameters for debugging
  console.log('📋 All URL parameters:');
  for (const [key, value] of params.entries()) {
    console.log(`  - ${key}: ${value.substring(0, 20)}...`);
  }
  
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
    console.log('=================================');
    console.log('🔑 PASSWORD RECOVERY DETECTED!');
    console.log('=================================');
    console.log('🎯 This is a password reset callback');
    
    title.textContent = '🔑 Password Reset Ready!';
    message.textContent = 'Click the PasteCraft extension icon to set your new password.';
    
    const resetData = {
      access_token,
      refresh_token,
      type: 'recovery',
      timestamp: Date.now()
    };
    
    console.log('💾 Storing recovery data to chrome.storage.local...');
    console.log('📦 Data to store:', {
      access_token_length: access_token?.length,
      refresh_token_length: refresh_token?.length,
      type: resetData.type,
      timestamp: new Date(resetData.timestamp).toISOString()
    });
    
    // Store recovery tokens and flag
    chrome.storage.local.set({
      password_reset_callback: resetData
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('❌ STORAGE ERROR:', chrome.runtime.lastError);
        title.textContent = '❌ Storage Error';
        message.textContent = chrome.runtime.lastError.message;
        return;
      }
      
      console.log('✅ Recovery tokens stored successfully!');
      console.log('💡 User should now click the extension icon to continue');
      
      // Verify storage
      chrome.storage.local.get('password_reset_callback', (result) => {
        console.log('🔍 Verification - Data in storage:', result);
      });
      
      // Update UI to show success
      title.textContent = '✅ Password Reset Verified!';
      message.textContent = 'Now click the PasteCraft extension icon 📋 in your toolbar to set your new password.';
      
      console.log('⏰ Window will auto-close in 10 seconds');
      
      // Auto-close after 10 seconds (giving user time to read)
      setTimeout(() => {
        console.log('🔒 Closing callback window');
        window.close();
      }, 10000);
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


