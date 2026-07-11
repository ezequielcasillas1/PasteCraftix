(function initializePasteCraftResourceLoader(global) {
  'use strict';

  if (global.PasteCraftResourceLoader) return;

  const resources = Object.freeze({
    pdf: Object.freeze({ path: 'lib/pdf.min.js', expectedGlobal: 'pdfjsLib' }),
    mermaid: Object.freeze({ path: 'lib/mermaid.min.js', expectedGlobal: 'mermaid' }),
  });
  const scriptPromises = new Map();

  function getResourceUrl(path) {
    if (global.chrome?.runtime?.getURL) return global.chrome.runtime.getURL(path);
    return new URL(path, document.baseURI).href;
  }

  function failLoad(name, script, reject, message) {
    if (scriptPromises.get(name)) scriptPromises.delete(name);
    script.remove?.();
    reject(new Error(message));
  }

  function loadScript(name) {
    const resource = resources[name];
    if (!resource) {
      return Promise.reject(new Error(`Unsupported extension resource: ${String(name)}`));
    }
    if (global[resource.expectedGlobal]) {
      return Promise.resolve(global[resource.expectedGlobal]);
    }
    if (scriptPromises.has(name)) return scriptPromises.get(name);

    let resolvePromise;
    let rejectPromise;
    const promise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    scriptPromises.set(name, promise);

    const script = document.createElement('script');
    script.async = true;
    script.src = getResourceUrl(resource.path);
    script.dataset.pasteCraftResource = name;
    script.onload = () => {
      const loadedGlobal = global[resource.expectedGlobal];
      if (!loadedGlobal) {
        failLoad(
          name,
          script,
          rejectPromise,
          `Extension resource loaded without ${resource.expectedGlobal}: ${resource.path}`,
        );
        return;
      }
      resolvePromise(loadedGlobal);
    };
    script.onerror = () => {
      failLoad(name, script, rejectPromise, `Failed to load extension resource: ${resource.path}`);
    };

    (document.head || document.documentElement).appendChild(script);
    return promise;
  }

  global.PasteCraftResourceLoader = Object.freeze({ loadScript });
})(window);
