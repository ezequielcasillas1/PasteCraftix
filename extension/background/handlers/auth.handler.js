// PasteCraft Auth Handler
// Handles authentication-related messages from external sources

import { STORAGE_KEYS } from '../../shared/constants.js';
import { getStorageItems, setStorageItems, removeStorageItems } from '../../shared/storage-adapter.js';

const ALLOWED_ORIGIN = 'https://auth.pastecraft.com';
const STATE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Handle external messages (from auth.pastecraft.com)
 * @param {Object} message - Message object
 * @param {Object} sender - Sender info
 * @returns {Promise<Object>} Response
 */
export async function handleExternalMessage(message, sender) {
  // Validate origin
  const senderUrl = sender?.url ? String(sender.url) : '';
  let senderOrigin = '';
  try {
    senderOrigin = senderUrl ? new URL(senderUrl).origin : '';
  } catch (_) {
    senderOrigin = '';
  }

  console.log('[AuthHandler] External message:', {
    type: message?.type,
    from: senderOrigin,
    hasAccessToken: !!message?.access_token
  });

  if (senderOrigin !== ALLOWED_ORIGIN) {
    return { success: false, error: 'unauthorized_origin' };
  }

  const type = message?.type ? String(message.type) : '';

  if (type === 'password_reset') {
    return handlePasswordReset(message);
  }

  return { success: false, error: 'Unknown message type' };
}

/**
 * Handle password reset callback from web
 * @param {Object} message - Message with tokens
 * @returns {Promise<Object>} Response
 */
async function handlePasswordReset(message) {
  const accessToken = typeof message.access_token === 'string' ? message.access_token : '';
  const refreshToken = typeof message.refresh_token === 'string' ? message.refresh_token : '';
  const state = typeof message.state === 'string' ? message.state : '';

  // Validate payload
  if (!accessToken || accessToken.length > 4096) {
    return { success: false, error: 'invalid_payload' };
  }
  if (refreshToken && refreshToken.length > 4096) {
    return { success: false, error: 'invalid_payload' };
  }
  if (state && state.length > 256) {
    return { success: false, error: 'invalid_payload' };
  }

  // Verify state token
  const result = await getStorageItems([STORAGE_KEYS.PASSWORD_RESET_STATE]);
  const expected = result[STORAGE_KEYS.PASSWORD_RESET_STATE];
  const expectedState = expected?.state ? String(expected.state) : '';
  const createdAt = typeof expected?.createdAt === 'number' ? expected.createdAt : 0;
  const isFresh = createdAt && (Date.now() - createdAt) < STATE_TTL_MS;

  if (!state || !expectedState || !isFresh || state !== expectedState) {
    return { success: false, error: 'state_mismatch' };
  }

  // Consume state (one-time use)
  await removeStorageItems([STORAGE_KEYS.PASSWORD_RESET_STATE]);

  // Store tokens for the reset UI
  await setStorageItems({
    password_reset_callback: {
      access_token: accessToken,
      refresh_token: refreshToken,
      type: 'recovery',
      timestamp: Date.now()
    }
  });

  return { success: true };
}

/**
 * Generate and store a password reset state token
 * @returns {Promise<string>} State token
 */
export async function generateResetState() {
  const state = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  
  await setStorageItems({
    [STORAGE_KEYS.PASSWORD_RESET_STATE]: {
      state,
      createdAt: Date.now()
    }
  });

  return state;
}

/**
 * Clear stored password reset callback
 */
export async function clearResetCallback() {
  await removeStorageItems(['password_reset_callback']);
}

/**
 * Get stored password reset callback
 * @returns {Promise<Object|null>}
 */
export async function getResetCallback() {
  const result = await getStorageItems(['password_reset_callback']);
  return result.password_reset_callback || null;
}
