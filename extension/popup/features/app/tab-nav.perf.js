/** Tab-switch performance probes — always available via window.__pcTabNavProbe */

const SESSION_ID = 'tabnav';
const SLOW_MS = 50;
const MAX_PROBE_ENTRIES = 80;

function ensureProbeBuffer() {
  if (!Array.isArray(window.__pcTabNavProbe)) {
    window.__pcTabNavProbe = [];
  }
  return window.__pcTabNavProbe;
}

export function pcTabPerfPush(message, extra = {}) {
  const entry = {
    ts: Date.now(),
    perfMs: typeof performance !== 'undefined' ? performance.now() : 0,
    message: String(message || ''),
    ...extra,
  };

  const buf = ensureProbeBuffer();
  buf.push(entry);
  if (buf.length > MAX_PROBE_ENTRIES) {
    buf.splice(0, buf.length - MAX_PROBE_ENTRIES);
  }

  // #region agent log
  console.warn(`[PasteCraft:debug:${SESSION_ID}]`, {
    hypothesisId: extra.hypothesisId || 'TAB-PROBE',
    location: extra.location || 'tab-nav.perf:push',
    message: entry.message,
    data: entry,
    runId: extra.runId || 'investigate',
  });
  // #endregion

  return entry;
}

export function pcTabPerfStart(tabName, fromTab) {
  const mark = `pc-tab-${tabName}-${performance.now().toFixed(0)}`;
  try {
    performance.mark(`${mark}-start`);
  } catch (_) {}

  pcTabPerfPush(`tab switch start ${fromTab || '?'} → ${tabName}`, {
    hypothesisId: 'TAB-START',
    location: 'tab-nav.perf:start',
    tabName,
    fromTab,
  });

  return {
    tabName,
    fromTab,
    mark,
    t0: performance.now(),
    phases: {},
  };
}

export function pcTabPerfPhase(ctx, phase) {
  if (!ctx) return;
  ctx.phases[phase] = Math.round(performance.now() - ctx.t0);
}

export function pcTabPerfEnd(ctx, extra = {}) {
  if (!ctx) return;
  const totalMs = Math.round(performance.now() - ctx.t0);

  try {
    performance.mark(`${ctx.mark}-end`);
    performance.measure(`tab:${ctx.fromTab}->${ctx.tabName}`, `${ctx.mark}-start`, `${ctx.mark}-end`);
  } catch (_) {}

  pcTabPerfPush(`tab switch end ${ctx.fromTab || '?'} → ${ctx.tabName}`, {
    hypothesisId: totalMs >= SLOW_MS ? 'TAB-SLOW' : 'TAB-OK',
    location: 'tab-nav.perf:end',
    totalMs,
    phases: ctx.phases,
    skippedRender: extra.skippedRender === true,
    tabName: ctx.tabName,
    fromTab: ctx.fromTab,
    ...extra,
  });
}

export function installTabNavProbeConsoleHelpers() {
  if (window.__pcTabNavProbeInstalled) return;
  window.__pcTabNavProbeInstalled = true;

  window.dumpPcTabNavProbe = () => {
    const rows = ensureProbeBuffer();
    console.table(rows);
    return rows;
  };

  pcTabPerfPush('tab-nav probe installed — run dumpPcTabNavProbe() or filter Warnings for PasteCraft:debug:tabnav', {
    hypothesisId: 'TAB-BOOT',
    location: 'tab-nav.perf:install',
    runId: 'boot',
  });
}
