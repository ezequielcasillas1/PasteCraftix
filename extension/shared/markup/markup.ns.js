/**
 * @forward-slice markup
 * Shared namespace + Strategy registry for PCMarkup.
 */
(() => {
  'use strict';

  const root = typeof window !== 'undefined' ? window : globalThis;
  if (root.__PCMarkupNS) return;

  root.__PCMarkupNS = {
    strategies: Object.create(null),

    registerStrategy(strategy) {
      if (!strategy || typeof strategy.type !== 'string') return;
      this.strategies[strategy.type] = strategy;
    },

    getStrategy(type) {
      return this.strategies[type] || this.strategies.text || null;
    },
  };
})();
