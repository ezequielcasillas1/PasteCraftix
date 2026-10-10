/**
 * In-panel HSV color picker for Study Formats.
 * Avoids Chromium's native <input type="color"> PagePopup, which glitches
 * under modal backdrop-filter / transform compositing in the extension popup.
 */

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function hexToHsv(hex) {
  const raw = String(hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return { h: 50, s: 90, v: 95 };
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;
  return { h, s, v };
}

export function hsvToHex(h, s, v) {
  const hue = ((Number(h) % 360) + 360) % 360;
  const sat = clamp(Number(s), 0, 100) / 100;
  const val = clamp(Number(v), 0, 100) / 100;
  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const byte = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

function hueCss(h) {
  return `hsl(${Math.round(h)} 100% 50%)`;
}

/**
 * @param {{
 *   root: HTMLElement,
 *   getHex: () => string,
 *   setHex: (hex: string) => void,
 * }} opts
 */
export function bindStudyColorPicker(opts) {
  const { root, getHex, setHex } = opts;
  if (!root || root.dataset.pcColorBound === '1') return;
  root.dataset.pcColorBound = '1';

  const plane = root.querySelector('[data-field="study-sv"]');
  const thumb = root.querySelector('[data-field="study-sv-thumb"]');
  const hueInput = root.querySelector('[data-field="study-hue"]');
  const swatch = root.querySelector('[data-field="study-swatch"]');
  if (!plane || !thumb || !hueInput) return;

  let hsv = hexToHsv(getHex());
  let dragging = false;

  const paint = () => {
    plane.style.setProperty('--pc-study-hue', hueCss(hsv.h));
    thumb.style.left = `${clamp(hsv.s, 0, 100)}%`;
    thumb.style.top = `${clamp(100 - hsv.v, 0, 100)}%`;
    hueInput.value = String(Math.round(hsv.h));
    if (swatch) swatch.style.backgroundColor = hsvToHex(hsv.h, hsv.s, hsv.v);
    plane.setAttribute('aria-valuetext', `Saturation ${Math.round(hsv.s)}%, brightness ${Math.round(hsv.v)}%`);
  };

  const commit = () => {
    const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
    paint();
    setHex(hex);
  };

  const syncFromHex = (hex) => {
    hsv = hexToHsv(hex);
    paint();
  };

  const pickFromPointer = (event) => {
    const rect = plane.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    hsv = { ...hsv, s: x * 100, v: (1 - y) * 100 };
    commit();
  };

  plane.addEventListener('pointerdown', (event) => {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    plane.setPointerCapture?.(event.pointerId);
    dragging = true;
    pickFromPointer(event);
  });
  plane.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    pickFromPointer(event);
  });
  const endDrag = (event) => {
    if (!dragging) return;
    dragging = false;
    try {
      plane.releasePointerCapture?.(event.pointerId);
    } catch {
      /* ignore */
    }
  };
  plane.addEventListener('pointerup', endDrag);
  plane.addEventListener('pointercancel', endDrag);

  plane.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 5 : 2;
    let next = { ...hsv };
    if (event.key === 'ArrowLeft') next.s -= step;
    else if (event.key === 'ArrowRight') next.s += step;
    else if (event.key === 'ArrowUp') next.v += step;
    else if (event.key === 'ArrowDown') next.v -= step;
    else return;
    event.preventDefault();
    hsv = { h: next.h, s: clamp(next.s, 0, 100), v: clamp(next.v, 0, 100) };
    commit();
  });

  hueInput.addEventListener('input', () => {
    hsv = { ...hsv, h: clamp(Number(hueInput.value) || 0, 0, 360) };
    commit();
  });

  syncFromHex(getHex());
  return { syncFromHex };
}
