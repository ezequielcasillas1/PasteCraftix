/**
 * @forward-slice
 * Header decor: dithered shooting-star particle field (dot-matrix trail +
 * glowing sparkle head + pointer-repel physics). Mounts under both
 * html[data-theme="light"] (baby-blue header) and html[data-theme="blue"]
 * (navy premium header) with per-theme palettes from THEME_TUNING.
 * Blue-theme canvas/container CSS lives in assets/styles/theme-blue-phase2.css;
 * this module owns all behavior. Fallback: static star PNG
 * (assets/images/star-shooting.png) when 2D canvas is unavailable.
 */

const CANVAS_CLASS = 'header-starlight';
const FALLBACK_CLASS = 'header-starlight-fallback';
const STAR_IMG_URL = 'assets/images/star-shooting.png';

const CELL = 3; /* dot-matrix grid pitch (CSS px) */
const DOT = 2; /* dot size */
const FRAME_MS = 84; /* ~12fps idle shimmer */
const TOUCH_RADIUS = 52; /* pointer repel radius (CSS px) */
const TOUCH_FORCE = 3.2; /* impulse strength at pointer center */
const SPRING_K = 0.08; /* pull back toward home position */
const DAMPING = 0.86; /* velocity decay per frame */
const ENERGY_IDLE = 0.4; /* below this, return to idle shimmer cadence */

/* 4x4 Bayer ordered-dither thresholds, normalized 0..1 */
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16));

/* Per-theme palettes: pastel dither on baby blue; luminous trail on navy. */
const THEME_TUNING = {
  light: {
    trailColors: ['#fde047', '#fbbf24', '#fb923c', '#f472b6', '#a78bfa', '#60a5fa', '#34d399'],
    alphaBase: 0.45,
    alphaAmp: 0.4,
    glowRgb: '253, 224, 71',
    sparkleFill: '#fffbeb',
  },
  blue: {
    trailColors: ['#fef9c3', '#fde047', '#f0abfc', '#f472b6', '#67e8f9', '#22d3ee', '#a5b4fc'],
    alphaBase: 0.6,
    alphaAmp: 0.4,
    glowRgb: '250, 204, 21',
    sparkleFill: '#ffffff',
  },
};

let mounted = null;

function _theme() {
  return document.documentElement.getAttribute('data-theme');
}

function _header() {
  return document.querySelector('header.header');
}

function _trailColor(t, colors) {
  const idx = Math.min(colors.length - 1, Math.floor(t * colors.length));
  return colors[idx];
}

/** Density field: 1 at star head, falling off along/away from the trail axis. */
function _density(px, py, head, tail) {
  const ax = tail.x - head.x;
  const ay = tail.y - head.y;
  const len2 = ax * ax + ay * ay || 1;
  let t = ((px - head.x) * ax + (py - head.y) * ay) / len2;
  t = Math.max(0, Math.min(1.15, t));
  const cx = head.x + ax * t;
  const cy = head.y + ay * t;
  const d = Math.hypot(px - cx, py - cy);
  const spread = 3 + t * 14; /* trail disperses toward the tail */
  const along = Math.pow(Math.max(0, 1 - t / 1.05), 1.35);
  return along * Math.exp(-(d * d) / (2 * spread * spread));
}

function _buildParticles(width, height, colors) {
  const head = { x: width * 0.7, y: height * 0.34 };
  const tail = { x: width * 0.12, y: height * 0.92 };
  const particles = [];
  for (let gy = 0; gy * CELL < height; gy++) {
    for (let gx = 0; gx * CELL < width; gx++) {
      const px = gx * CELL + CELL / 2;
      const py = gy * CELL + CELL / 2;
      const v = _density(px, py, head, tail);
      if (v > BAYER4[gy % 4][gx % 4]) {
        const ax = tail.x - head.x;
        const ay = tail.y - head.y;
        const len2 = ax * ax + ay * ay || 1;
        const t = Math.max(0, Math.min(1, ((px - head.x) * ax + (py - head.y) * ay) / len2));
        particles.push({
          x: px,
          y: py,
          ox: 0,
          oy: 0,
          vx: 0,
          vy: 0,
          color: _trailColor(t, colors),
          phase: Math.random() * Math.PI * 2,
          speed: 0.9 + Math.random() * 1.4,
        });
      }
    }
  }
  return { head, particles };
}

function _drawSparkle(ctx, { x, y, r, alpha, fill, glowRgb }) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.shadowColor = `rgba(${glowRgb}, 0.9)`;
  ctx.shadowBlur = r * 1.6;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
  ctx.restore();
}

/* Spring-damper back to home, then paint. Returns total kinetic energy. */
function _updateAndDrawParticles(ctx, particles, t, tuning) {
  let energy = 0;
  for (const p of particles) {
    p.vx = (p.vx - p.ox * SPRING_K) * DAMPING;
    p.vy = (p.vy - p.oy * SPRING_K) * DAMPING;
    p.ox += p.vx;
    p.oy += p.vy;
    energy += Math.abs(p.vx) + Math.abs(p.vy);
    const alpha = tuning.alphaBase + tuning.alphaAmp * Math.sin(t * p.speed + p.phase);
    if (alpha <= 0.08) continue;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x + p.ox - DOT / 2, p.y + p.oy - DOT / 2, DOT, DOT);
  }
  return energy;
}

function _mountFallback(header) {
  const img = document.createElement('img');
  img.className = FALLBACK_CLASS;
  img.src = STAR_IMG_URL;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  header.prepend(img);
}

function _mount(header, theme) {
  if (mounted || !header) return;
  const tuning = THEME_TUNING[theme] || THEME_TUNING.light;

  const canvas = document.createElement('canvas');
  canvas.className = CANVAS_CLASS;
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    /* Particle dither infeasible without 2D canvas — static star fallback. */
    _mountFallback(header);
    mounted = { fallback: true, theme };
    return;
  }
  header.prepend(canvas);

  const state = { head: null, particles: [], raf: 0, last: 0, lastPointer: 0, energy: 0, running: true };

  /* Pointer events live on .header (canvas stays pointer-events:none) so
     logo / model select / action buttons keep their clicks untouched. */
  function onPointer(ev) {
    const rect = header.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
    state.lastPointer = performance.now();
    const r2 = TOUCH_RADIUS * TOUCH_RADIUS;
    for (const p of state.particles) {
      const dx = p.x + p.ox - px;
      const dy = p.y + p.oy - py;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2 || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      const f = (1 - d / TOUCH_RADIUS) * TOUCH_FORCE;
      p.vx += (dx / d) * f;
      p.vy += (dy / d) * f;
    }
  }
  header.addEventListener('pointermove', onPointer, { passive: true });
  header.addEventListener('pointerdown', onPointer, { passive: true });

  function rebuild() {
    const rect = header.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const built = _buildParticles(rect.width, rect.height, tuning.trailColors);
    state.head = built.head;
    state.particles = built.particles;
  }

  function frame(now) {
    if (!state.running) return;
    state.raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    /* Full-rate frames while interaction energy is live; throttled shimmer otherwise. */
    const interacting = now - state.lastPointer < 400 || state.energy > ENERGY_IDLE;
    if (!interacting && now - state.last < FRAME_MS) return;
    state.last = now;
    const t = now / 1000;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    state.energy = _updateAndDrawParticles(ctx, state.particles, t, tuning);

    if (state.head) {
      const pulse = 0.75 + 0.25 * Math.sin(t * 2.2);
      const glow = ctx.createRadialGradient(state.head.x, state.head.y, 0, state.head.x, state.head.y, 16);
      glow.addColorStop(0, `rgba(${tuning.glowRgb}, ${0.5 * pulse})`);
      glow.addColorStop(1, `rgba(${tuning.glowRgb}, 0)`);
      ctx.globalAlpha = 1;
      ctx.fillStyle = glow;
      ctx.fillRect(state.head.x - 16, state.head.y - 16, 32, 32);
      _drawSparkle(ctx, { x: state.head.x, y: state.head.y, r: 9 * pulse, alpha: 0.95, fill: tuning.sparkleFill, glowRgb: tuning.glowRgb });
    }
    ctx.globalAlpha = 1;
  }

  rebuild();
  state.ro = new ResizeObserver(rebuild);
  state.ro.observe(header);
  state.raf = requestAnimationFrame(frame);

  mounted = {
    canvas,
    theme,
    dispose() {
      state.running = false;
      cancelAnimationFrame(state.raf);
      state.ro.disconnect();
      header.removeEventListener('pointermove', onPointer);
      header.removeEventListener('pointerdown', onPointer);
      canvas.remove();
    },
  };
}

function _unmount() {
  if (!mounted) return;
  if (!mounted.fallback) mounted.dispose();
  else document.querySelector(`.${FALLBACK_CLASS}`)?.remove();
  mounted = null;
}

export function initHeaderStarlight() {
  if (initHeaderStarlight._started) return;
  initHeaderStarlight._started = true;

  /* Theme switch = remount with the new palette (rebuild is cheap). */
  const sync = () => {
    const theme = _theme();
    if (!THEME_TUNING[theme]) {
      _unmount();
      return;
    }
    if (mounted && mounted.theme === theme) return;
    _unmount();
    _mount(_header(), theme);
  };

  new MutationObserver(sync).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sync, { once: true });
  } else {
    sync();
  }
}
