/** Popup UX interaction timing — console.warn probes for DevTools Warnings filter. */

import { relayAgentDebugLog } from '../../shared/agent-debug-log.js';

const SESSION_ID = 'ux-perf';
const WARN_MS = 100;
const SLOW_MS = 300;
const MAX_ENTRIES = 120;

const UX_PERF_CATEGORIES = Object.freeze([
  'nav-tab',
  'nav-feature',
  'nav-ai-lab',
  'nav-modal',
  'action',
  'flow-entry',
  'click',
]);

function ensureBuffer() {
  if (typeof window === 'undefined') return [];
  if (!Array.isArray(window.__pcUxPerf)) {
    window.__pcUxPerf = [];
  }
  return window.__pcUxPerf;
}

function levelForMs(durationMs) {
  if (durationMs >= SLOW_MS) return 'slow';
  if (durationMs >= WARN_MS) return 'warn';
  return 'ok';
}

export function emitUxPerfProbe({
  category,
  label,
  durationMs,
  location,
  runId = 'post-fix',
  data = {},
}) {
  const level = levelForMs(durationMs);
  const payload = {
    hypothesisId: 'PERF',
    location: location || `ux-perf-capture:${category}`,
    message: `${category} ${label} ${durationMs}ms (${level})`,
    data: {
      category,
      label,
      durationMs,
      level,
      warnMs: WARN_MS,
      slowMs: SLOW_MS,
      ...data,
    },
    runId,
  };

  // #region agent log
  console.warn(`[PasteCraft:debug:${SESSION_ID}]`, payload);
  // #endregion

  const entry = { ts: Date.now(), perfMs: performance.now(), ...payload };
  const buf = ensureBuffer();
  buf.push(entry);
  if (buf.length > MAX_ENTRIES) {
    buf.splice(0, buf.length - MAX_ENTRIES);
  }

  relayAgentDebugLog(payload);
  return entry;
}

export function startUxInteraction(category, label, extra = {}) {
  return {
    category,
    label,
    t0: performance.now(),
    extra,
  };
}

export function endUxInteraction(ctx, extra = {}) {
  if (!ctx) return;
  const durationMs = Math.round(performance.now() - ctx.t0);
  return emitUxPerfProbe({
    category: ctx.category,
    label: ctx.label,
    durationMs,
    location: extra.location,
    runId: extra.runId,
    data: { ...ctx.extra, ...extra, afterPaint: extra.afterPaint === true },
  });
}

export function finishUxInteractionAfterPaint(ctx, extra = {}) {
  if (!ctx || typeof requestAnimationFrame !== 'function') {
    endUxInteraction(ctx, extra);
    return;
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      endUxInteraction(ctx, { ...extra, afterPaint: true });
    });
  });
}

export function runUxInteraction(category, label, fn, options = {}) {
  const ctx = startUxInteraction(category, label, options.data);
  const location = options.location || `ux-perf:${category}:${label}`;

  const finish = (more = {}) => {
    if (options.afterPaint) {
      finishUxInteractionAfterPaint(ctx, { location, ...more });
    } else {
      endUxInteraction(ctx, { location, ...more });
    }
  };

  try {
    const result = fn(finish);
    if (result && typeof result.then === 'function') {
      return result
        .then((value) => {
          finish();
          return value;
        })
        .catch((err) => {
          finish({ error: err?.message || String(err) });
          throw err;
        });
    }
    finish();
    return result;
  } catch (err) {
    finish({ error: err?.message || String(err) });
    throw err;
  }
}

export function installGlobalClickPerfCapture() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (document.documentElement.dataset.pcUxClickCapture === '1') return;
  document.documentElement.dataset.pcUxClickCapture = '1';

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!target || typeof target.closest !== 'function') return;

    if (target.closest('.tab-btn, .tab-nav, .ai-lab-tab')) return;

    const actionEl = target.closest('[data-action]');
    if (actionEl) {
      const ctx = startUxInteraction('action', actionEl.dataset.action || 'unknown', {
        tag: actionEl.tagName,
      });
      finishUxInteractionAfterPaint(ctx, {
        location: 'ux-perf-capture:action-click',
      });
      return;
    }

    const ctx = startUxInteraction('click', target.tagName?.toLowerCase() || 'node', {
      id: target.id || undefined,
      className: typeof target.className === 'string' ? target.className.slice(0, 80) : undefined,
    });
    finishUxInteractionAfterPaint(ctx, {
      location: 'ux-perf-capture:global-click',
    });
  }, true);
}

export function installUxPerfConsoleHelpers() {
  if (typeof window === 'undefined') return;
  if (window.__pcUxPerfInstalled) return;
  window.__pcUxPerfInstalled = true;

  window.dumpPcUxPerf = () => {
    const rows = ensureBuffer();
    console.table(rows);
    return rows;
  };

  emitUxPerfProbe({
    category: 'click',
    label: 'ux-perf-installed',
    durationMs: 0,
    location: 'ux-perf-capture:install',
    runId: 'boot',
    data: { categories: UX_PERF_CATEGORIES },
  });
}
