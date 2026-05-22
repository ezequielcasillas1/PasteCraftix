/** Vertical slice: core.js */
export const coreMixin = {
// NETWORK HELPERS (avoid "hang forever")
// =====================================================
async _fetchWithTimeout(url, options = {}, timeoutMs = 30000, timeoutMessage = 'Request timed out') {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error(timeoutMessage);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// =====================================================
};
