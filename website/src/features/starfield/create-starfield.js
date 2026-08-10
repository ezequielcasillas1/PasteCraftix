/** @forward-slice website starfield */
import { STARFIELD } from './starfield.constants.js';
import { createDitherStamper } from './dither-utils.js';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function pickColor() {
  const palette = STARFIELD.colors;
  return palette[Math.floor(Math.random() * palette.length)];
}

/**
 * Dithered star particle field: idle drift, periodic explosion bursts,
 * pointer repulsion + swirl. Rendered on a low-res buffer with a Bayer 4x4
 * threshold so the mass reads as ordered-dither grain when upscaled.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {() => void} dispose
 */
export function createStarfield(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const buffer = document.createElement('canvas');
  const bctx = buffer.getContext('2d');
  if (!bctx) return () => {};

  const scale = STARFIELD.scale;
  let bw = 0;
  let bh = 0;
  let cssW = 0;
  let cssH = 0;

  const stars = [];
  let sparks = [];

  const pointer = {
    x: -9999,
    y: -9999,
    tx: -9999,
    ty: -9999,
    active: false,
  };

  const reduced = prefersReducedMotion();

  const { stampDot, stampSpark } = createDitherStamper(bctx, STARFIELD.sparkSize);

  function seedStars() {
    stars.length = 0;
    const target = Math.min(
      STARFIELD.maxStars,
      Math.floor((bw * bh * scale * scale) / STARFIELD.starDensity),
    );
    for (let i = 0; i < target; i += 1) {
      stars.push({
        x: Math.random() * bw,
        y: Math.random() * bh,
        vx: 0,
        vy: 0,
        dir: Math.random() * Math.PI * 2,
        speed: randomBetween(STARFIELD.minSpeed, STARFIELD.maxSpeed) / scale,
        phase: Math.random() * Math.PI * 2,
        base: randomBetween(0.25, 0.75),
        color: pickColor(),
      });
    }
  }

  function spawnBurst(cx, cy, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.45;
      const speed = randomBetween(STARFIELD.sparkSpeedMin, STARFIELD.sparkSpeedMax) / scale;
      sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: randomBetween(STARFIELD.sparkLifeMin, STARFIELD.sparkLifeMax),
        age: 0,
        color: pickColor(),
      });
    }
  }

  function resize() {
    cssW = window.innerWidth;
    cssH = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, STARFIELD.maxDpr);
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    bw = Math.max(1, Math.floor(cssW / scale));
    bh = Math.max(1, Math.floor(cssH / scale));
    buffer.width = bw;
    buffer.height = bh;
    ctx.imageSmoothingEnabled = false;
    seedStars();
    if (reduced) renderStatic();
  }

  function applyPointerForce(body, dt) {
    if (!pointer.active) return;
    const px = pointer.x / scale;
    const py = pointer.y / scale;
    const dx = body.x - px;
    const dy = body.y - py;
    const dist = Math.hypot(dx, dy);
    const radius = STARFIELD.pointerRadius / scale;
    if (dist >= radius || dist === 0) return;
    const falloff = 1 - dist / radius;
    const repel = (STARFIELD.pointerRepel / scale) * falloff * dt;
    const swirl = (STARFIELD.pointerSwirl / scale) * falloff * dt;
    body.vx += (dx / dist) * repel - (dy / dist) * swirl;
    body.vy += (dy / dist) * repel + (dx / dist) * swirl;
  }

  function update(dt, time) {
    pointer.x += (pointer.tx - pointer.x) * STARFIELD.pointerLerp;
    pointer.y += (pointer.ty - pointer.y) * STARFIELD.pointerLerp;

    for (const star of stars) {
      star.x += (Math.cos(star.dir) * star.speed + star.vx) * dt;
      star.y += (Math.sin(star.dir) * star.speed + star.vy) * dt;
      star.vx *= 0.92;
      star.vy *= 0.92;
      applyPointerForce(star, dt);
      if (star.x < -2) star.x = bw + 2;
      if (star.x > bw + 2) star.x = -2;
      if (star.y < -2) star.y = bh + 2;
      if (star.y > bh + 2) star.y = -2;
      star.intensity =
        star.base + Math.sin(time * STARFIELD.twinkleSpeed + star.phase) * 0.3;
    }

    sparks = sparks.filter((spark) => {
      spark.age += dt;
      if (spark.age >= spark.life) return false;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vx *= 0.96;
      spark.vy *= 0.96;
      applyPointerForce(spark, dt);
      return true;
    });
  }

  function draw() {
    bctx.clearRect(0, 0, bw, bh);
    for (const star of stars) {
      stampDot(star.x, star.y, star.intensity ?? star.base, star.color);
    }
    for (const spark of sparks) {
      const fade = 1 - spark.age / spark.life;
      stampSpark(spark.x, spark.y, fade, spark.color);
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
  }

  function renderStatic() {
    for (const star of stars) {
      star.intensity = star.base;
    }
    draw();
  }

  let raf = 0;
  let running = false;
  let lastTime = 0;
  let nextBurstAt = 0;

  function tick(t) {
    if (!running) return;
    const time = t * 0.001;
    const dt = Math.min(0.05, lastTime ? time - lastTime : 0.016);
    lastTime = time;

    if (t >= nextBurstAt) {
      spawnBurst(
        Math.random() * bw,
        Math.random() * bh,
        Math.floor(randomBetween(STARFIELD.sparkCountMin, STARFIELD.sparkCountMax)),
      );
      nextBurstAt = t + randomBetween(STARFIELD.burstIntervalMinMs, STARFIELD.burstIntervalMaxMs);
    }

    update(dt, time);
    draw();
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (running || reduced) return;
    running = true;
    lastTime = 0;
    nextBurstAt = performance.now() + 600;
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function updatePointer(clientX, clientY) {
    pointer.tx = clientX;
    pointer.ty = clientY;
    if (!pointer.active) {
      pointer.x = pointer.tx;
      pointer.y = pointer.ty;
      pointer.active = true;
    }
  }

  function onPointerMove(event) {
    updatePointer(event.clientX, event.clientY);
  }

  function onPointerOver(event) {
    if (event.target !== canvas) updatePointer(event.clientX, event.clientY);
  }

  function onPointerLeave() {
    pointer.active = false;
    pointer.tx = -9999;
    pointer.ty = -9999;
    pointer.x = -9999;
    pointer.y = -9999;
  }

  function onPointerDown(event) {
    if (reduced) return;
    spawnBurst(event.clientX / scale, event.clientY / scale, STARFIELD.clickSparks);
  }

  function onCanvasEnter(event) {
    if (typeof event.clientX === 'number') updatePointer(event.clientX, event.clientY);
  }

  function onVisibility() {
    if (document.hidden) stop();
    else start();
  }

  let resizeTimer = 0;
  function onResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 150);
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  document.addEventListener('pointerover', onPointerOver, { passive: true });
  canvas.addEventListener('pointerenter', onCanvasEnter, { passive: true });
  document.documentElement.addEventListener('pointerleave', onPointerLeave);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', onResize);

  resize();
  start();

  return () => {
    stop();
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('pointerover', onPointerOver);
    canvas.removeEventListener('pointerenter', onCanvasEnter);
    document.documentElement.removeEventListener('pointerleave', onPointerLeave);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', onResize);
    window.clearTimeout(resizeTimer);
  };
}
