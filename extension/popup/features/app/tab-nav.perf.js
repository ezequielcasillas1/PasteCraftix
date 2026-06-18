/** Tab-switch performance probes — filter DevTools Console → Warnings: PasteCraft:debug:tabnav */

const SESSION_ID = 'tabnav';
const SLOW_MS = 50;

export function pcTabPerfStart(tabName, fromTab) {
  const mark = `pc-tab-${tabName}-${performance.now().toFixed(0)}`;
  performance.mark(`${mark}-start`);
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
  performance.mark(`${ctx.mark}-end`);
  try {
    performance.measure(`tab:${ctx.fromTab}->${ctx.tabName}`, `${ctx.mark}-start`, `${ctx.mark}-end`);
  } catch (_) {}

  console.warn(`[PasteCraft:debug:${SESSION_ID}]`, {
    hypothesisId: totalMs >= SLOW_MS ? 'TAB-SLOW' : 'TAB-OK',
    location: 'tab-nav.perf:end',
    message: `tab switch ${ctx.fromTab || '?'} → ${ctx.tabName}`,
    data: {
      totalMs,
      phases: ctx.phases,
      skippedRender: extra.skippedRender === true,
      ...extra,
    },
    runId: 'investigate',
  });
}
