(function initPasteCraftAsyncUtils(globalScope) {
  function withTimeout(promise, { ms, fallback = undefined } = {}) {
    let timeoutId = null;
    let settled = false;

    const wrapped = Promise.resolve()
      .then(() => promise)
      .then((value) => {
        settled = true;
        if (timeoutId != null) clearTimeout(timeoutId);
        return value;
      })
      .catch((error) => {
        settled = true;
        if (timeoutId != null) clearTimeout(timeoutId);
        return fallback;
      });

    const timer = new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve(fallback);
      }, ms);
    });

    return Promise.race([wrapped, timer]);
  }

  globalScope.PasteCraftAsyncUtils = {
    withTimeout
  };
})(typeof window !== 'undefined' ? window : globalThis);
