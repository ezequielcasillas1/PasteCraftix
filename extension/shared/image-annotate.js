/** @forward-slice — Shared image annotate editor (draw / text / move / note pads). */
/**
 * Public API for notes + clips (no cross-slice imports).
 */

const HOST_VALUE = 'pc-image-annotate';
const PAD_STEP_RATIO = 0.6;
const PAD_MAX_RATIO = 3;
const PAD_WHITE = '#ffffff';
const PAD_BLACK = '#000000';
const HIT_PAD = 10;
const TEXT_SHADOW = 'rgba(0,0,0,0.35)';
const SELECT_STROKE = 'rgba(37, 99, 235, 0.85)';

let _host = null;
let _session = null;
let _resultResolve = null;

function removeHost() {
  if (_host?.parentNode) _host.parentNode.removeChild(_host);
  _host = null;
  _session = null;
}

function settleResult(payload) {
  const resolve = _resultResolve;
  _resultResolve = null;
  if (typeof resolve === 'function') resolve(payload);
}

function canvasCursorForTool(tool) {
  if (tool === 'text') return 'text';
  if (tool === 'move') return 'move';
  return 'crosshair';
}

function applyCanvasToolUi(canvas, tool) {
  if (!canvas) return;
  canvas.style.cursor = canvasCursorForTool(tool);
  canvas.classList.toggle('is-tool-move', tool === 'move');
}

function setTool(tool) {
  if (!_session) return;
  _session.tool = tool;
  _session.selectedIndex = -1;
  _host?.querySelectorAll('[data-action="annotate-tool"]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.getAttribute('data-tool') === tool);
  });
  applyCanvasToolUi(_session.canvas, tool);
}

function textFont(obj) {
  const size = Math.max(16, Math.round(obj?.fontSize || _session?.fontSize || 22));
  return `bold ${size}px system-ui,sans-serif`;
}

function paintTextObject(ctx, obj) {
  if (!obj?.text) return;
  ctx.save();
  ctx.fillStyle = obj.color || '#ef4444';
  ctx.font = textFont(obj);
  ctx.textBaseline = 'top';
  ctx.shadowColor = TEXT_SHADOW;
  ctx.shadowBlur = 2;
  ctx.fillText(obj.text, obj.x, obj.y);
  ctx.restore();
}

function paintStrokeObject(ctx, obj) {
  const pts = obj?.points;
  if (!Array.isArray(pts) || pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = obj.color || '#ef4444';
  ctx.lineWidth = obj.lineWidth || 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

function paintObject(ctx, obj) {
  if (!obj) return;
  if (obj.type === 'text') paintTextObject(ctx, obj);
  else if (obj.type === 'stroke') paintStrokeObject(ctx, obj);
}

function textBounds(ctx, obj) {
  ctx.save();
  ctx.font = textFont(obj);
  const metrics = ctx.measureText(String(obj.text || ''));
  ctx.restore();
  const fontSize = Math.max(16, Math.round(obj.fontSize || 22));
  return {
    x: obj.x,
    y: obj.y,
    w: Math.max(8, metrics.width || 0),
    h: fontSize * 1.25,
  };
}

function expandBounds(bounds, p) {
  bounds.minX = Math.min(bounds.minX, p.x);
  bounds.minY = Math.min(bounds.minY, p.y);
  bounds.maxX = Math.max(bounds.maxX, p.x);
  bounds.maxY = Math.max(bounds.maxY, p.y);
}

function strokeBounds(obj) {
  const pts = obj?.points;
  if (!Array.isArray(pts) || !pts.length) return null;
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of pts) expandBounds(bounds, p);
  const pad = (obj.lineWidth || 4) / 2 + 4;
  return {
    x: bounds.minX - pad,
    y: bounds.minY - pad,
    w: bounds.maxX - bounds.minX + pad * 2,
    h: bounds.maxY - bounds.minY + pad * 2,
  };
}

function beginSelectionStroke(ctx) {
  ctx.save();
  ctx.strokeStyle = SELECT_STROKE;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
}

function paintSelectionOutline(ctx, obj) {
  if (!obj) return;
  beginSelectionStroke(ctx);
  if (obj.type === 'text') {
    const b = textBounds(ctx, obj);
    ctx.strokeRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
  } else if (obj.type === 'stroke') {
    const b = strokeBounds(obj);
    if (b) ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  ctx.restore();
}

function syncCanvasSize(session) {
  const { totalW, totalH } = getPadExtents(session);
  if (session.canvas.width !== totalW || session.canvas.height !== totalH) {
    session.canvas.width = totalW;
    session.canvas.height = totalH;
  }
}

function paintSessionObjects(session) {
  const objects = Array.isArray(session.objects) ? session.objects : [];
  for (const obj of objects) paintObject(session.ctx, obj);
  if (session.draftStroke) paintStrokeObject(session.ctx, session.draftStroke);
  const selected = objects[session.selectedIndex];
  if (selected) paintSelectionOutline(session.ctx, selected);
}

function redrawScene() {
  const session = _session;
  if (!canPaintSession(session)) return;
  syncCanvasSize(session);
  paintBaseAndPad(session.ctx, session);
  paintSessionObjects(session);
}

function pointerPos(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / Math.max(1, rect.width);
  const scaleY = canvas.height / Math.max(1, rect.height);
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function distPointToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.0001) return Math.hypot(point.x - a.x, point.y - a.y);
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function hitTestText(ctx, obj, x, y) {
  const b = textBounds(ctx, obj);
  const insideX = x >= b.x - HIT_PAD && x <= b.x + b.w + HIT_PAD;
  const insideY = y >= b.y - HIT_PAD && y <= b.y + b.h + HIT_PAD;
  return insideX && insideY;
}

function hitTestStroke(obj, point) {
  const pts = obj?.points;
  if (!Array.isArray(pts) || pts.length < 2) return false;
  const threshold = (obj.lineWidth || 4) / 2 + HIT_PAD;
  for (let i = 1; i < pts.length; i += 1) {
    if (distPointToSegment(point, pts[i - 1], pts[i]) <= threshold) return true;
  }
  return false;
}

function objectHitsAt(ctx, obj, x, y) {
  if (!obj) return false;
  if (obj.type === 'text') return hitTestText(ctx, obj, x, y);
  if (obj.type === 'stroke') return hitTestStroke(obj, { x, y });
  return false;
}

function hitTestObjects(ctx, objects, x, y) {
  for (let i = objects.length - 1; i >= 0; i -= 1) {
    if (objectHitsAt(ctx, objects[i], x, y)) return i;
  }
  return -1;
}

function translateText(obj, dx, dy) {
  obj.x += dx;
  obj.y += dy;
}

function translateStroke(obj, dx, dy) {
  if (!Array.isArray(obj.points)) return;
  for (const p of obj.points) {
    p.x += dx;
    p.y += dy;
  }
}

function hasDelta(dx, dy) {
  return Boolean(dx || dy);
}

function translateObject(obj, dx, dy) {
  if (!obj || !hasDelta(dx, dy)) return;
  if (obj.type === 'text') translateText(obj, dx, dy);
  else if (obj.type === 'stroke') translateStroke(obj, dx, dy);
}

function createTextObject(x, y, text) {
  const value = String(text || '').trim();
  if (!value) return null;
  return {
    type: 'text',
    x,
    y,
    text: value,
    color: _session?.color || '#ef4444',
    fontSize: _session?.fontSize || 22,
  };
}

function createStrokeObject() {
  return {
    type: 'stroke',
    points: [],
    color: _session?.color || '#ef4444',
    lineWidth: _session?.lineWidth || 4,
  };
}

function beginStrokeAt(x, y) {
  const stroke = createStrokeObject();
  stroke.points.push({ x, y });
  _session.draftStroke = stroke;
}

function isSamePoint(a, b) {
  return Boolean(a && b && a.x === b.x && a.y === b.y);
}

function extendStrokeTo(x, y) {
  const draft = _session?.draftStroke;
  if (!draft) return;
  const last = draft.points[draft.points.length - 1];
  if (isSamePoint(last, { x, y })) return;
  draft.points.push({ x, y });
  redrawScene();
}

function commitStroke() {
  const draft = _session?.draftStroke;
  _session.draftStroke = null;
  if (draft && draft.points.length >= 2) {
    _session.objects.push(draft);
  }
  redrawScene();
}

function placeTextAt(x, y) {
  const text = window.prompt('Text to place:', '');
  if (text == null) return;
  const obj = createTextObject(x, y, text);
  if (!obj) return;
  _session.objects.push(obj);
  redrawScene();
}

function beginMoveAt(x, y) {
  const idx = hitTestObjects(_session.ctx, _session.objects, x, y);
  _session.selectedIndex = idx;
  _session.drag = idx >= 0 ? { lastX: x, lastY: y } : null;
  redrawScene();
  return idx >= 0;
}

function dragMoveTo(x, y) {
  const drag = _session?.drag;
  const obj = _session?.objects?.[_session.selectedIndex];
  if (!drag || !obj) return;
  translateObject(obj, x - drag.lastX, y - drag.lastY);
  drag.lastX = x;
  drag.lastY = y;
  redrawScene();
}

function endMove() {
  if (!_session) return;
  _session.drag = null;
  redrawScene();
}

function tryCapture(canvas, pointerId) {
  try { canvas.setPointerCapture(pointerId); } catch (_) {}
}

function tryRelease(canvas, pointerId) {
  try { canvas.releasePointerCapture(pointerId); } catch (_) {}
}

function onPointerDown(canvas, event, state) {
  if (!_session || event.button !== 0) return;
  const p = pointerPos(canvas, event);
  const tool = _session.tool;

  if (tool === 'text') {
    placeTextAt(p.x, p.y);
    return;
  }
  if (tool === 'move') {
    state.moving = beginMoveAt(p.x, p.y);
    if (state.moving) tryCapture(canvas, event.pointerId);
    return;
  }
  if (tool !== 'draw') return;
  state.drawing = true;
  beginStrokeAt(p.x, p.y);
  tryCapture(canvas, event.pointerId);
}

function onPointerMove(canvas, event, state) {
  if (!_session) return;
  const p = pointerPos(canvas, event);
  if (state.moving && _session.tool === 'move') {
    dragMoveTo(p.x, p.y);
    return;
  }
  if (state.drawing && _session.tool === 'draw') {
    extendStrokeTo(p.x, p.y);
  }
}

function onPointerEnd(canvas, event, state) {
  if (state.drawing) {
    state.drawing = false;
    commitStroke();
    tryRelease(canvas, event.pointerId);
    return;
  }
  if (state.moving) {
    state.moving = false;
    endMove();
    tryRelease(canvas, event.pointerId);
  }
}

function bindPointer(canvas) {
  const state = { drawing: false, moving: false };
  canvas.addEventListener('pointerdown', (event) => onPointerDown(canvas, event, state));
  canvas.addEventListener('pointermove', (event) => onPointerMove(canvas, event, state));
  const endPointer = (event) => onPointerEnd(canvas, event, state);
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
}

function isStandaloneAnnotatePage() {
  try {
    return /(?:clip|note)-image-annotate\.html/i.test(String(location?.pathname || ''));
  } catch (_) {
    return false;
  }
}

function buildChrome() {
  const pageMode = isStandaloneAnnotatePage();
  const closeLabel = pageMode ? 'Close' : '✕';
  const closeAria = pageMode ? 'Close window' : 'Close';

  const chrome = document.createElement('div');
  chrome.className = 'pc-annotate-chrome';
  chrome.innerHTML = `
    <div class="pc-annotate-topnav">
      <span class="pc-annotate-title">Image annotate</span>
      <button type="button" class="pc-annotate-btn pc-annotate-close-btn" data-action="annotate-cancel" aria-label="${closeAria}">${closeLabel}</button>
    </div>
    <div class="pc-annotate-toolbar">
      <button type="button" class="pc-annotate-btn is-active" data-action="annotate-tool" data-tool="draw" aria-label="Draw">Draw</button>
      <button type="button" class="pc-annotate-btn" data-action="annotate-tool" data-tool="text" aria-label="Text">Text</button>
      <button type="button" class="pc-annotate-btn" data-action="annotate-tool" data-tool="move" aria-label="Move">Move</button>
      <label class="pc-annotate-color" title="Color">
        <input type="color" data-field="annotate-color" value="#ef4444" />
      </label>
      <button type="button" class="pc-annotate-btn pc-annotate-pad-btn pc-annotate-pad-btn--white" data-action="annotate-pad" data-pad="${PAD_WHITE}" aria-label="Add white note pad">White pad</button>
      <button type="button" class="pc-annotate-btn pc-annotate-pad-btn pc-annotate-pad-btn--black" data-action="annotate-pad" data-pad="${PAD_BLACK}" aria-label="Add black note pad">Black pad</button>
      <button type="button" class="pc-annotate-btn" data-action="annotate-clear" aria-label="Clear drawings">Clear</button>
      <span class="pc-annotate-spacer"></span>
      <button type="button" class="pc-annotate-btn pc-annotate-btn--primary" data-action="annotate-save" aria-label="Save">Save</button>
    </div>
  `;
  return chrome;
}

function positiveDim(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getPadExtents(session) {
  const fallbackW = positiveDim(session?.canvas?.width, 1);
  const fallbackH = positiveDim(session?.canvas?.height, 1);
  const imageW = positiveDim(session?.imageW, fallbackW);
  const imageH = positiveDim(session?.imageH, fallbackH);
  const padExtraH = Math.max(0, Number(session?.padExtraH) || 0);
  const padExtraW = Math.max(0, Number(session?.padExtraW) || 0);
  return {
    imageW,
    imageH,
    padExtraH,
    padExtraW,
    totalW: imageW + padExtraW,
    totalH: imageH + padExtraH,
  };
}

function hasPadSpace(session) {
  const extraH = Number(session?.padExtraH) || 0;
  const extraW = Number(session?.padExtraW) || 0;
  return Boolean(session?.padColor) && (extraH > 0 || extraW > 0);
}

function paintBaseAndPad(ctx, session) {
  const { imageW, imageH, totalW, totalH } = getPadExtents(session);
  ctx.clearRect(0, 0, totalW, totalH);
  if (hasPadSpace(session)) {
    ctx.fillStyle = session.padColor;
    ctx.fillRect(0, 0, totalW, totalH);
  }
  if (session?.baseImg) {
    ctx.drawImage(session.baseImg, 0, 0, imageW, imageH);
  }
}

function rebuildCanvasWithPad(session, nextExtraH, nextExtraW, padColor) {
  const canvas = session.canvas;
  if (!canvas) return;

  const { imageW, imageH } = getPadExtents(session);
  canvas.width = imageW + nextExtraW;
  canvas.height = imageH + nextExtraH;

  session.padExtraH = nextExtraH;
  session.padExtraW = nextExtraW;
  session.padColor = padColor;
  redrawScene();
}

function syncAnnotatePadContrast() {
  _host?.classList.toggle('has-black-pad', _session?.padColor === PAD_BLACK);
}

function appendNotePad(color) {
  if (!_session?.canvas || !_session?.ctx) return false;
  const padColor = color === PAD_BLACK ? PAD_BLACK : PAD_WHITE;
  const imageH = Math.max(1, _session.imageH || _session.canvas.height);
  const maxExtraH = Math.round(imageH * PAD_MAX_RATIO);
  const step = Math.max(120, Math.round(imageH * PAD_STEP_RATIO));
  const prevExtraH = Math.max(0, _session.padExtraH || 0);
  const nextExtraH = Math.min(maxExtraH, prevExtraH + step);
  const nextExtraW = Math.max(0, _session.padExtraW || 0);

  if (nextExtraH <= prevExtraH) {
    _session.padColor = padColor;
    syncAnnotatePadContrast();
    redrawScene();
    return false;
  }

  rebuildCanvasWithPad(_session, nextExtraH, nextExtraW, padColor);
  syncAnnotatePadContrast();
  return true;
}

function loadBaseImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image_load_failed'));
    img.src = dataUrl;
  });
}

function clearAnnotationState(session) {
  session.objects = [];
  session.selectedIndex = -1;
  session.draftStroke = null;
  session.drag = null;
}

function resetSessionAfterBake(outUrl, canvas) {
  return loadBaseImage(outUrl).then((img) => {
    if (!_session) return;
    _session.baseImg = img;
    _session.imageW = Math.max(1, canvas.width);
    _session.imageH = Math.max(1, canvas.height);
    _session.padExtraH = 0;
    _session.padExtraW = 0;
    _session.padColor = null;
    clearAnnotationState(_session);
    syncAnnotatePadContrast();
    redrawScene();
  });
}

function canPaintSession(session) {
  return Boolean(session?.ctx && session?.canvas && session?.baseImg);
}

function clearCanvas() {
  const session = _session;
  if (!canPaintSession(session)) return;
  clearAnnotationState(session);
  redrawScene();
}

function cancelAnnotate() {
  const onCancel = _session?.onCancel;
  removeHost();
  try { onCancel?.(); } catch (_) {}
  settleResult({ ok: false, cancelled: true });
}

async function saveAnnotation() {
  const session = _session;
  if (!session?.canvas) return;
  redrawScene();
  const outUrl = session.canvas.toDataURL('image/png');
  try {
    await session.onSave?.(outUrl);
  } catch (err) {
    session.ui?.showToast?.(err?.message || 'Save failed', 'error');
    return;
  }
  if (session.saveBehavior === 'bake') {
    await resetSessionAfterBake(outUrl, session.canvas);
    return;
  }
  removeHost();
  settleResult({ ok: true, dataUrl: outUrl });
}

async function handleAnnotateAction(action, tool, padColor) {
  if (action === 'annotate-tool') {
    setTool(tool || 'draw');
    redrawScene();
    return;
  }
  if (action === 'annotate-pad') {
    const grew = appendNotePad(padColor);
    if (!grew) _session?.ui?.showToast?.('Note pad at max size');
    return;
  }
  if (action === 'annotate-clear') {
    clearCanvas();
    return;
  }
  if (action === 'annotate-cancel') {
    cancelAnnotate();
    return;
  }
  if (action === 'annotate-save' && _session) {
    await saveAnnotation();
  }
}

function mountAnnotateUi(baseImg) {
  const host = document.createElement('div');
  host.className = 'pc-annotate-overlay';
  host.setAttribute('data-field', HOST_VALUE);

  const stage = document.createElement('div');
  stage.className = 'pc-annotate-stage';

  const canvas = document.createElement('canvas');
  canvas.className = 'pc-annotate-canvas';
  canvas.width = Math.max(1, baseImg.naturalWidth || baseImg.width);
  canvas.height = Math.max(1, baseImg.naturalHeight || baseImg.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(baseImg, 0, 0);

  stage.appendChild(canvas);
  host.appendChild(buildChrome());
  host.appendChild(stage);
  document.body.appendChild(host);
  return { host, canvas, ctx };
}

function bindAnnotateChrome(host) {
  host.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn || !host.contains(btn)) return;
    handleAnnotateAction(
      btn.getAttribute('data-action'),
      btn.getAttribute('data-tool'),
      btn.getAttribute('data-pad'),
    ).catch(() => {});
  });

  host.querySelector('[data-field="annotate-color"]')?.addEventListener('input', (event) => {
    if (_session) _session.color = event.target.value || '#ef4444';
  });

  document.addEventListener('keydown', function onKey(event) {
    if (event.key === 'Escape' && _host) {
      cancelAnnotate();
      document.removeEventListener('keydown', onKey, true);
    }
  }, true);
}

function createAnnotateSession(uiMount, baseImg, src, options) {
  const imageW = Math.max(1, uiMount.canvas.width);
  const imageH = Math.max(1, uiMount.canvas.height);
  return {
    canvas: uiMount.canvas,
    ctx: uiMount.ctx,
    baseImg,
    tool: 'draw',
    color: '#ef4444',
    lineWidth: 4,
    fontSize: 22,
    src,
    imageW,
    imageH,
    padExtraH: 0,
    padExtraW: 0,
    padColor: null,
    objects: [],
    selectedIndex: -1,
    draftStroke: null,
    drag: null,
    ui: options.ui || null,
    onSave: typeof options.onSave === 'function' ? options.onSave : null,
    onCancel: typeof options.onCancel === 'function' ? options.onCancel : null,
    saveBehavior: options.saveBehavior === 'bake' ? 'bake' : 'close',
    awaitResult: options.awaitResult === true,
  };
}

/**
 * Open the annotate editor for a data:image URL.
 *
 * @param {object} options
 * @param {string} options.dataUrl
 * @param {{ showToast?: Function }} [options.ui]
 * @param {(dataUrl: string) => void|Promise<void>} [options.onSave]
 * @param {() => void} [options.onCancel]
 * @param {'close'|'bake'} [options.saveBehavior='close'] bake = keep editor open after save (standalone page)
 * @param {boolean} [options.awaitResult=false] if true, resolves when user saves or cancels
 * @returns {Promise<{ ok: boolean, dataUrl?: string, cancelled?: boolean }>}
 */
async function loadAnnotateBase(src, ui) {
  if (!src.startsWith('data:image/')) {
    ui?.showToast?.('No image to annotate', 'error');
    return null;
  }
  try {
    return await loadBaseImage(src);
  } catch (_) {
    ui?.showToast?.('Failed to load image', 'error');
    return null;
  }
}

function startAnnotateSession(uiMount, baseImg, src, options) {
  _host = uiMount.host;
  _session = createAnnotateSession(uiMount, baseImg, src, options);
  bindPointer(uiMount.canvas);
  setTool('draw');
  bindAnnotateChrome(uiMount.host);
  if (!_session.awaitResult) return Promise.resolve({ ok: true });
  return new Promise((resolve) => {
    _resultResolve = resolve;
  });
}

export async function openImageAnnotate(options = {}) {
  closeImageAnnotate();
  const src = typeof options.dataUrl === 'string' ? options.dataUrl : '';
  const baseImg = await loadAnnotateBase(src, options.ui);
  if (!baseImg) return { ok: false };

  const uiMount = mountAnnotateUi(baseImg);
  if (!uiMount) {
    options.ui?.showToast?.('Canvas unavailable', 'error');
    return { ok: false };
  }
  return startAnnotateSession(uiMount, baseImg, src, options);
}

export function closeImageAnnotate() {
  if (_resultResolve) {
    settleResult({ ok: false, cancelled: true });
  }
  removeHost();
}

/** True when src can be opened in the annotate canvas editor. */
export function canAnnotateImageSrc(src) {
  return typeof src === 'string' && src.startsWith('data:image/');
}
