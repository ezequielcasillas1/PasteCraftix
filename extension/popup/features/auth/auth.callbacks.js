/** OAuth and password-reset callback handling from storage / URL. */

export async function checkOAuthCallback() {
  try {
    const result = await chrome.storage.local.get('oauth_callback');
    if (result.oauth_callback) {
      const { access_token, refresh_token } = result.oauth_callback;
      console.log('?? Found OAuth callback tokens, completing sign in...');

      try {
        const { error } = await Promise.race([
          pasteCraftSupabase.client.auth.setSession({ access_token, refresh_token }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('setSession timeout')), 3000)),
        ]);

        if (!error) {
          console.log('? OAuth sign in completed!');
          try {
            const { data: { user } } = await Promise.race([
              pasteCraftSupabase.client.auth.getUser(),
              new Promise((_, rej) => setTimeout(() => rej(new Error('getUser timeout')), 3000)),
            ]);

            if (user) {
              await pasteCraftSupabase.createUserSubscription(user.id, user.email);
            }
          } catch (_) {}
        } else {
          console.error('? Failed to set session:', error);
        }
      } catch (timeoutErr) {
        console.warn('?? setSession timed out, session bridge will handle auth');
      }

      await chrome.storage.local.remove('oauth_callback');
    }
  } catch (error) {
    console.error('? Error checking OAuth callback:', error);
  }
}

export async function checkPasswordResetCallback() {
  try {
    console.log('=================================');
    console.log('?? CHECKING PASSWORD RESET CALLBACK');
    console.log('=================================');
    console.log('?? Reading from chrome.storage.local...');

    const result = await chrome.storage.local.get('password_reset_callback');
    console.log('?? Storage result:', result);

    if (result.password_reset_callback) {
      const { access_token, refresh_token, type, timestamp } = result.password_reset_callback;
      console.log('? Password reset callback data found!');
      console.log('?? Data details:', {
        access_token_length: access_token?.length,
        refresh_token_length: refresh_token?.length,
        type,
        timestamp: new Date(timestamp).toISOString(),
        age_seconds: (Date.now() - timestamp) / 1000,
      });

      if (type === 'recovery') {
        console.log('?? Type is "recovery" - setting database session...');

        const { error } = await pasteCraftSupabase.client.auth.setSession({
          access_token,
          refresh_token,
        });

        if (!error) {
          console.log('? Password reset session established successfully!');

          const { data: { user } } = await pasteCraftSupabase.client.auth.getUser();
          console.log('?? Current user after session:', user?.email);

          console.log('?? Clearing temporary tokens from storage...');
          await chrome.storage.local.remove('password_reset_callback');
          console.log('? Tokens cleared');

          return true;
        }
        console.error('? Failed to set password reset session:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
      } else {
        console.warn('?? Type is not "recovery":', type);
      }
    } else {
      console.log('?? No password reset callback data in storage');
    }
  } catch (error) {
    console.error('? Error checking password reset callback:', error);
    console.error('Error stack:', error.stack);
  }
  return false;
}

export async function setPasswordResetSession(accessToken, refreshToken) {
  try {
    console.log('?? Setting password reset session from URL tokens');

    const { error } = await pasteCraftSupabase.client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (!error) {
      console.log('? Password reset session established from URL!');
    } else {
      console.error('? Failed to set password reset session:', error);
    }
  } catch (error) {
    console.error('? Error setting password reset session:', error);
  }
}
