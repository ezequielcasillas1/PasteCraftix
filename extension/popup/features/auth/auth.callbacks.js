/** OAuth and password-reset callback handling from storage / URL. */

import { rememberVerifiedEmail } from './auth.email-cache.js';

export async function checkOAuthCallback() {
  try {
    const result = await chrome.storage.local.get('oauth_callback');
    if (result.oauth_callback) {
      const { access_token, refresh_token } = result.oauth_callback;

      try {
        const { error } = await Promise.race([
          pasteCraftSupabase.client.auth.setSession({ access_token, refresh_token }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('setSession timeout')), 3000)),
        ]);

        if (!error) {
          try {
            const { data: { user } } = await Promise.race([
              pasteCraftSupabase.client.auth.getUser(),
              new Promise((_, rej) => setTimeout(() => rej(new Error('getUser timeout')), 3000)),
            ]);

            if (user) {
              await pasteCraftSupabase.createUserSubscription(user.id, user.email);
              if (user.email) await rememberVerifiedEmail(user.email);
            }
          } catch (_) {}
        } else {
          console.error('[checkOAuthCallback] Failed to set session:', error);
        }
      } catch (_) {
        // Session bridge may still restore auth after timeout.
      }

      await chrome.storage.local.remove('oauth_callback');
    }
  } catch (error) {
    console.error('[checkOAuthCallback]', error);
  }
}

export async function checkPasswordResetCallback() {
  try {
    const result = await chrome.storage.local.get('password_reset_callback');

    if (result.password_reset_callback) {
      const { access_token, refresh_token, type } = result.password_reset_callback;

      if (type === 'recovery') {
        const { error } = await pasteCraftSupabase.client.auth.setSession({
          access_token,
          refresh_token,
        });

        if (!error) {
          await chrome.storage.local.remove('password_reset_callback');
          return true;
        }
        console.error('[checkPasswordResetCallback] Failed to set session:', error);
      }
    }
  } catch (error) {
    console.error('[checkPasswordResetCallback]', error);
  }
  return false;
}

export async function setPasswordResetSession(accessToken, refreshToken) {
  try {
    const { error } = await pasteCraftSupabase.client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      console.error('[setPasswordResetSession]', error);
    }
  } catch (error) {
    console.error('[setPasswordResetSession]', error);
  }
}
