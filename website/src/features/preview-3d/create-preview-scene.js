/** @forward-slice website preview-3d */
import * as THREE from 'three';
import { PREVIEW_3D } from './preview-3d.constants.js';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function createBackdropMesh(radius = 3.4) {
  const geo = new THREE.CircleGeometry(radius, 64);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#1d4ed8'),
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = -0.85;
  return mesh;
}

function resolvePlaneSize(video) {
  const vw = video.videoWidth || PREVIEW_3D.videoWidth;
  const vh = video.videoHeight || PREVIEW_3D.videoHeight;
  const aspect = vw > 0 && vh > 0 ? vw / vh : PREVIEW_3D.videoWidth / PREVIEW_3D.videoHeight;
  const h = PREVIEW_3D.planeHeight;
  return { w: h * aspect, h };
}

function createFrameMesh(width, height) {
  const shape = new THREE.Shape();
  const w = width / 2 + 0.06;
  const h = height / 2 + 0.06;
  const r = 0.12;
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);

  const hole = new THREE.Path();
  const iw = width / 2;
  const ih = height / 2;
  const ir = 0.08;
  hole.moveTo(-iw + ir, -ih);
  hole.lineTo(iw - ir, -ih);
  hole.quadraticCurveTo(iw, -ih, iw, -ih + ir);
  hole.lineTo(iw, ih - ir);
  hole.quadraticCurveTo(iw, ih, iw - ir, ih);
  hole.lineTo(-iw + ir, ih);
  hole.quadraticCurveTo(-iw, ih, -iw, ih - ir);
  hole.lineTo(-iw, -ih + ir);
  hole.quadraticCurveTo(-iw, -ih, -iw + ir, -ih);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#0b122e'),
    metalness: 0.35,
    roughness: 0.45,
    emissive: new THREE.Color('#2563eb'),
    emissiveIntensity: 0.35,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = -0.04;
  return mesh;
}

/**
 * @param {HTMLElement} root
 * @returns {() => void} dispose
 */
export function createPreviewScene(root) {
  const canvas = root.querySelector(PREVIEW_3D.canvasSelector);
  const video = root.querySelector(PREVIEW_3D.videoSelector);
  const fallback = root.querySelector(PREVIEW_3D.fallbackSelector);

  if (!(canvas instanceof HTMLCanvasElement) || !(video instanceof HTMLVideoElement)) {
    return () => {};
  }

  if (prefersReducedMotion()) {
    root.dataset.mode = 'fallback';
    if (fallback instanceof HTMLElement) fallback.hidden = false;
    canvas.hidden = true;
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    void video.play().catch(() => {});
    return () => {
      video.pause();
    };
  }

  root.dataset.mode = 'webgl';
  if (fallback instanceof HTMLElement) fallback.hidden = true;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PREVIEW_3D.maxDpr));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
  camera.position.set(0, 0, 6.2);

  const key = new THREE.DirectionalLight(0x93c5fd, 1.35);
  key.position.set(2.4, 2.2, 3.2);
  const fill = new THREE.DirectionalLight(0x38bdf8, 0.55);
  fill.position.set(-2.6, 0.4, 1.8);
  const rim = new THREE.PointLight(0x60a5fa, 1.8, 12);
  rim.position.set(0, -0.4, 2.4);
  const ambient = new THREE.AmbientLight(0xa5b4fc, 0.45);
  scene.add(key, fill, rim, ambient);

  video.muted = true;
  video.playsInline = true;
  video.loop = true;
  video.crossOrigin = 'anonymous';

  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const { w, h } = resolvePlaneSize(video);
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: texture }),
  );
  const frame = createFrameMesh(w, h);
  const backdrop = createBackdropMesh(Math.max(w, h) * 0.95);
  const group = new THREE.Group();
  group.add(backdrop, frame, panel);
  scene.add(group);

  const fitCamera = () => {
    const { clientWidth, clientHeight } = root;
    if (!clientWidth || !clientHeight) return;
    camera.aspect = clientWidth / clientHeight;
    const vFov = (camera.fov * Math.PI) / 180;
    const fitH = (h * 0.58) / Math.tan(vFov / 2);
    const fitW = ((w * 0.58) / Math.tan(vFov / 2)) / camera.aspect;
    camera.position.z = Math.max(fitH, fitW, 4.8);
    camera.updateProjectionMatrix();
  };

  let raf = 0;
  let running = false;
  let disposed = false;

  const resize = () => {
    const { clientWidth, clientHeight } = root;
    if (!clientWidth || !clientHeight) return;
    renderer.setSize(clientWidth, clientHeight, false);
    fitCamera();
  };

  const tick = (t) => {
    if (!running || disposed) return;
    const time = t * 0.001;
    group.rotation.y = Math.sin(time * 0.45) * 0.12;
    group.rotation.x = Math.sin(time * 0.35) * 0.04 + 0.02;
    group.position.y = Math.sin(time * 0.85) * 0.05;
    rim.intensity = 1.5 + Math.sin(time * 1.4) * 0.35;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };

  const start = async () => {
    if (disposed || running) return;
    resize();
    try {
      await video.play();
    } catch {
      root.dataset.mode = 'fallback';
      if (fallback instanceof HTMLElement) fallback.hidden = false;
      canvas.hidden = true;
      return;
    }
    running = true;
    raf = requestAnimationFrame(tick);
  };

  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
    video.pause();
  };

  const onVisibility = (entries) => {
    const visible = entries.some((e) => e.isIntersecting);
    if (visible) void start();
    else stop();
  };

  const observer = new IntersectionObserver(onVisibility, { threshold: 0.2 });
  observer.observe(root);

  const onResize = () => resize();
  window.addEventListener('resize', onResize);

  resize();

  return () => {
    disposed = true;
    stop();
    observer.disconnect();
    window.removeEventListener('resize', onResize);
    texture.dispose();
    panel.geometry.dispose();
    panel.material.dispose();
    frame.geometry.dispose();
    frame.material.dispose();
    backdrop.geometry.dispose();
    backdrop.material.dispose();
    renderer.dispose();
  };
}
