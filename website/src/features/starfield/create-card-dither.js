/** @forward-slice website starfield */
import { CARD_DITHER } from './starfield.constants.js';
import { createDitherStamper } from './dither-utils.js';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function pick(palette) {
  return palette[Math.floor(Math.random() * palette.length)];
}

/**
 * Visible white card shell inside a `.showcase-card` wrapper.
 * @param {HTMLElement} card
 * @returns {HTMLElement}
 */
function resolveShell(card) {
  const child = card.firstElementChild;
  return child instanceof HTMLElement ? child : card;
}

/**
 * Corner radius for the shell's padding box (css px).
 * Subtracts border width so the formation hugs the visible rounded edge
 * instead of tracing the outer border-box radius on the smaller content box.
 * @param {HTMLElement} shell
 * @returns {number}
 */
function readCornerRadiusCss(shell) {
  const style = getComputedStyle(shell);
  const outer = Number.parseFloat(style.borderTopLeftRadius || '');
  const borderW = Number.parseFloat(style.borderTopWidth || '') || 0;
  if (Number.isFinite(outer) && outer > 0) {
    return Math.max(0, outer - borderW);
  }
  return CARD_DITHER.cornerRadiusCss;
}

/**
 * Sample points along a rounded-rectangle perimeter in buffer space.
 * `sparkPad` keeps stampSpark (grows +x/+y) from painting past the outer edge.
 * @param {number} w
 * @param {number} h
 * @param {number} inset
 * @param {number} radius
 * @param {number} spacing
 * @param {number} sparkPad
 * @returns {{ x: number, y: number }[]}
 */
function sampleRoundedRectBorder(w, h, inset, radius, spacing, sparkPad = 0) {
  const left = inset;
  const top = inset;
  const right = w - 1 - inset - sparkPad;
  const bottom = h - 1 - inset - sparkPad;
  const rw = Math.max(0, right - left);
  const rh = Math.max(0, bottom - top);
  const r = Math.max(0, Math.min(radius, rw / 2, rh / 2));
  const points = [];

  const pushArc = (cx, cy, start, end) => {
    const arcLen = Math.abs(end - start) * r;
    const steps = Math.max(1, Math.ceil(arcLen / spacing));
    for (let i = 0; i < steps; i += 1) {
      const t = start + ((end - start) * i) / steps;
      points.push({ x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r });
    }
  };

  const pushLine = (x0, y0, x1, y1) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(len / spacing));
    for (let i = 0; i < steps; i += 1) {
      const t = i / steps;
      points.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t });
    }
  };

  if (rw < 1 || rh < 1) return points;

  // Top edge (left → right), then clockwise.
  pushLine(left + r, top, right - r, top);
  pushArc(right - r, top + r, -Math.PI / 2, 0);
  pushLine(right, top + r, right, bottom - r);
  pushArc(right - r, bottom - r, 0, Math.PI / 2);
  pushLine(right - r, bottom, left + r, bottom);
  pushArc(left + r, bottom - r, Math.PI / 2, Math.PI);
  pushLine(left, bottom - r, left, top + r);
  pushArc(left + r, top + r, Math.PI, (Math.PI * 3) / 2);

  return points;
}

/**
 * Sparse lattice homes across the card face (inset so it stays inside the border).
 * @param {number} w
 * @param {number} h
 * @param {number} inset
 * @param {number} spacing
 * @returns {{ x: number, y: number }[]}
 */
function sampleFaceLattice(w, h, inset, spacing) {
  const points = [];
  const pad = inset + spacing * 0.5;
  for (let y = pad; y < h - pad; y += spacing) {
    for (let x = pad; x < w - pad; x += spacing) {
      points.push({ x, y });
    }
  }
  return points;
}

/**
 * Particle-formed dither overlay for a showcase card.
 * Mounts on the visible inner shell (not the outer `.showcase-card` wrapper).
 * Border + sparse face lattice hold the shell silhouette as home positions.
 * Pointer scatters particles outward; spring+damping reassembles the card.
 *
 * @param {HTMLElement} card
 * @returns {() => void} dispose
 */
export function createCardDither(card) {
  if (!(card instanceof HTMLElement)) return () => {};

  const shell = resolveShell(card);

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.cardDither = 'shell';
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '5',
  });

  const shellRadius = readCornerRadiusCss(shell);
  canvas.style.borderRadius = `${shellRadius}px`;

  if (getComputedStyle(shell).position === 'static') {
    shell.style.position = 'relative';
  }
  shell.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return () => {};
  }
  const buffer = document.createElement('canvas');
  const bctx = buffer.getContext('2d');
  if (!bctx) {
    canvas.remove();
    return () => {};
  }

  const { stampDot, stampSpark } = createDitherStamper(bctx, CARD_DITHER.sparkSize);
  const scale = CARD_DITHER.scale;
  const reduced = prefersReducedMotion();

  let bw = 0;
  let bh = 0;
  let cornerRadiusCss = shellRadius;
  /** @type {{ homeX: number, homeY: number, x: number, y: number, vx: number, vy: number, color: string, base: number, layer: 'border' | 'face', phase: number, intensity: number }[]} */
  let dots = [];
  let inView = false;

  const pointer = { x: 0, y: 0, tx: 0, ty: 0, hover: false };

  function seedFormation() {
    dots = [];
    const inset = CARD_DITHER.insetCss / scale;
    const radius = cornerRadiusCss / scale;
    const sparkPad = Math.max(0, CARD_DITHER.sparkSize - 1);
    const borderHomes = sampleRoundedRectBorder(
      bw,
      bh,
      inset,
      radius,
      CARD_DITHER.borderSpacing,
      sparkPad,
    );
    const faceHomes = sampleFaceLattice(bw, bh, inset, CARD_DITHER.faceSpacing);

    for (const home of borderHomes) {
      dots.push({
        homeX: home.x,
        homeY: home.y,
        x: home.x,
        y: home.y,
        vx: 0,
        vy: 0,
        color: pick(CARD_DITHER.borderColors),
        base: CARD_DITHER.borderIntensity,
        layer: 'border',
        phase: Math.random() * Math.PI * 2,
        intensity: CARD_DITHER.borderIntensity,
      });
    }
    for (const home of faceHomes) {
      dots.push({
        homeX: home.x,
        homeY: home.y,
        x: home.x,
        y: home.y,
        vx: 0,
        vy: 0,
        color: pick(CARD_DITHER.faceColors),
        base: CARD_DITHER.faceIntensity,
        layer: 'face',
        phase: Math.random() * Math.PI * 2,
        intensity: CARD_DITHER.faceIntensity,
      });
    }
  }

  function isShellVisible() {
    const rect = shell.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth
    );
  }

  function resize() {
    const { clientWidth, clientHeight } = shell;
    if (!clientWidth || !clientHeight) return;
    cornerRadiusCss = readCornerRadiusCss(shell);
    canvas.style.borderRadius = `${cornerRadiusCss}px`;

    const dpr = Math.min(window.devicePixelRatio || 1, CARD_DITHER.maxDpr);
    canvas.width = Math.floor(clientWidth * dpr);
    canvas.height = Math.floor(clientHeight * dpr);
    bw = Math.max(1, Math.floor(clientWidth / scale));
    bh = Math.max(1, Math.floor(clientHeight / scale));
    buffer.width = bw;
    buffer.height = bh;
    ctx.imageSmoothingEnabled = false;
    seedFormation();
    // Always paint the home formation after a reseed (covers reduced-motion
    // and the first frame before rAF / IntersectionObserver kicks in).
    draw();
    if (!reduced && isShellVisible()) {
      inView = true;
      start();
    }
  }

  function update(time) {
    pointer.x += (pointer.tx - pointer.x) * CARD_DITHER.pointerLerp;
    pointer.y += (pointer.ty - pointer.y) * CARD_DITHER.pointerLerp;

    const px = pointer.x / scale;
    const py = pointer.y / scale;
    const radius = CARD_DITHER.pointerRadius / scale;

    for (const dot of dots) {
      // Spring toward home formation (frame-rate spring + damping).
      dot.vx += (dot.homeX - dot.x) * CARD_DITHER.springK;
      dot.vy += (dot.homeY - dot.y) * CARD_DITHER.springK;

      if (pointer.hover) {
        const dx = dot.x - px;
        const dy = dot.y - py;
        const dist = Math.hypot(dx, dy);
        if (dist < radius && dist > 0.001) {
          const falloff = (1 - dist / radius) ** 2;
          const nx = dx / dist;
          const ny = dy / dist;
          // Outward scatter + light tangential swirl (buffer units / frame).
          dot.vx += nx * CARD_DITHER.pointerRepel * falloff;
          dot.vy += ny * CARD_DITHER.pointerRepel * falloff;
          dot.vx += -ny * CARD_DITHER.pointerSwirl * falloff;
          dot.vy += nx * CARD_DITHER.pointerSwirl * falloff;
        }
      }

      dot.vx *= CARD_DITHER.damping;
      dot.vy *= CARD_DITHER.damping;
      dot.x += dot.vx;
      dot.y += dot.vy;

      // Snap home when nearly settled so the silhouette fully reassembles.
      if (!pointer.hover) {
        const hx = dot.homeX - dot.x;
        const hy = dot.homeY - dot.y;
        if (
          Math.hypot(hx, hy) < CARD_DITHER.settleEpsilon &&
          Math.hypot(dot.vx, dot.vy) < CARD_DITHER.settleEpsilon
        ) {
          dot.x = dot.homeX;
          dot.y = dot.homeY;
          dot.vx = 0;
          dot.vy = 0;
        }
      }

      dot.intensity =
        dot.base + Math.sin(time * CARD_DITHER.twinkleSpeed + dot.phase) * CARD_DITHER.twinkleAmp;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Face lattice first (faint).
    bctx.clearRect(0, 0, bw, bh);
    for (const dot of dots) {
      if (dot.layer !== 'face') continue;
      stampDot(dot.x, dot.y, dot.intensity ?? dot.base, dot.color);
    }
    ctx.globalAlpha = CARD_DITHER.faceAlpha;
    ctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);

    // Border ring on top (primary silhouette).
    bctx.clearRect(0, 0, bw, bh);
    for (const dot of dots) {
      if (dot.layer !== 'border') continue;
      stampSpark(dot.x, dot.y, dot.intensity ?? dot.base, dot.color);
    }
    ctx.globalAlpha = CARD_DITHER.borderAlpha;
    ctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }

  let raf = 0;
  let running = false;

  function tick(t) {
    if (!running) return;
    update(t * 0.001);
    draw();
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (running || reduced || !inView || document.hidden) return;
    running = true;
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function onPointerEnter(event) {
    pointer.hover = true;
    const rect = shell.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.tx = pointer.x;
    pointer.ty = pointer.y;
  }

  function onPointerMove(event) {
    const rect = shell.getBoundingClientRect();
    pointer.tx = event.clientX - rect.left;
    pointer.ty = event.clientY - rect.top;
  }

  function onPointerLeave() {
    pointer.hover = false;
  }

  function onVisibility() {
    if (document.hidden) stop();
    else start();
  }

  const observer = new IntersectionObserver(
    (entries) => {
      inView = entries.some((entry) => entry.isIntersecting);
      if (inView) start();
      else stop();
    },
    { threshold: 0.1 },
  );
  observer.observe(shell);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(shell);

  shell.addEventListener('pointerenter', onPointerEnter, { passive: true });
  shell.addEventListener('pointermove', onPointerMove, { passive: true });
  shell.addEventListener('pointerleave', onPointerLeave, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);

  resize();

  return () => {
    stop();
    observer.disconnect();
    resizeObserver.disconnect();
    shell.removeEventListener('pointerenter', onPointerEnter);
    shell.removeEventListener('pointermove', onPointerMove);
    shell.removeEventListener('pointerleave', onPointerLeave);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.remove();
  };
}
