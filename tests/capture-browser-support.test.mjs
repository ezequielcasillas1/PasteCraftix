import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CAPTURE_BROWSER_BRANDS,
  detectCaptureBrowserBrand,
  getCaptureToolsBlockReason,
  isCaptureToolsSupported,
} from '../extension/shared/capture-browser-support.js';

const CHROME_UA = 'Mozilla/5.0 Chrome/142.0.0.0 Safari/537.36';
const OPERA_UA = 'Mozilla/5.0 Chrome/142.0.0.0 Safari/537.36 OPR/128.0.0.0';
const EDGE_UA = 'Mozilla/5.0 Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0';

test('Chrome UA stays eligible and is not treated as Arc', () => {
  const brand = detectCaptureBrowserBrand({ userAgent: CHROME_UA, brands: [{ brand: 'Google Chrome' }] });
  assert.equal(brand.id, CAPTURE_BROWSER_BRANDS.CHROME);
  assert.equal(isCaptureToolsSupported({ userAgent: CHROME_UA, brands: [{ brand: 'Google Chrome' }] }), true);
  assert.equal(getCaptureToolsBlockReason({ userAgent: CHROME_UA }), null);
});

test('Edge stays eligible', () => {
  assert.equal(detectCaptureBrowserBrand({ userAgent: EDGE_UA }).id, CAPTURE_BROWSER_BRANDS.EDGE);
  assert.equal(isCaptureToolsSupported({ userAgent: EDGE_UA }), true);
});

test('Opera OPR token is ineligible', () => {
  const brand = detectCaptureBrowserBrand({ userAgent: OPERA_UA });
  assert.equal(brand.id, CAPTURE_BROWSER_BRANDS.OPERA);
  assert.equal(isCaptureToolsSupported({ userAgent: OPERA_UA }), false);
  assert.equal(getCaptureToolsBlockReason({ userAgent: OPERA_UA }), 'opera_optional_host_grant');
});

test('Opera GX Edition token is still Opera', () => {
  const ua = `${OPERA_UA} (Edition std-1)`;
  assert.equal(detectCaptureBrowserBrand({ userAgent: ua }).id, CAPTURE_BROWSER_BRANDS.OPERA);
  assert.equal(isCaptureToolsSupported({ userAgent: ua }), false);
});

test('Arc palette cluster is ineligible without treating Chrome UA as Arc', () => {
  const input = { userAgent: CHROME_UA, arcPaletteHits: 2 };
  assert.equal(detectCaptureBrowserBrand(input).id, CAPTURE_BROWSER_BRANDS.ARC);
  assert.equal(isCaptureToolsSupported(input), false);
  assert.equal(isCaptureToolsSupported({ userAgent: CHROME_UA, arcPaletteHits: 0 }), true);
  assert.equal(isCaptureToolsSupported({ userAgent: CHROME_UA, arcPaletteHits: 1 }), true);
});

test('Brave and Vivaldi stay eligible', () => {
  assert.equal(isCaptureToolsSupported({ userAgent: CHROME_UA, isBrave: true }), true);
  assert.equal(
    isCaptureToolsSupported({ userAgent: 'Mozilla/5.0 Chrome/142.0.0.0 Safari/537.36 Vivaldi/7.0.0' }),
    true,
  );
});

test('Comet brand or UA token is eligible and is not Opera or Arc', () => {
  const cometUa = `${CHROME_UA} Comet/1.0.0`;
  const cometBrands = [{ brand: 'Chromium' }, { brand: 'Comet' }, { brand: 'Google Chrome' }];
  assert.equal(detectCaptureBrowserBrand({ userAgent: cometUa }).id, CAPTURE_BROWSER_BRANDS.COMET);
  assert.equal(isCaptureToolsSupported({ userAgent: cometUa }), true);
  assert.equal(getCaptureToolsBlockReason({ userAgent: cometUa }), null);
  assert.equal(detectCaptureBrowserBrand({ userAgent: CHROME_UA, brands: cometBrands }).id, CAPTURE_BROWSER_BRANDS.COMET);
  assert.equal(isCaptureToolsSupported({ userAgent: CHROME_UA, brands: cometBrands }), true);
  assert.equal(
    detectCaptureBrowserBrand({ userAgent: CHROME_UA, brands: [{ brand: 'Perplexity Comet' }] }).id,
    CAPTURE_BROWSER_BRANDS.COMET,
  );
  assert.equal(isCaptureToolsSupported({ userAgent: CHROME_UA, brands: cometBrands, arcPaletteHits: 2 }), true);
});

test('Chrome-identical Comet UA stays eligible as Chrome', () => {
  const input = {
    userAgent: CHROME_UA,
    brands: [{ brand: 'Chromium' }, { brand: 'Google Chrome' }, { brand: 'Not_A Brand' }],
  };
  assert.equal(detectCaptureBrowserBrand(input).id, CAPTURE_BROWSER_BRANDS.CHROME);
  assert.equal(isCaptureToolsSupported(input), true);
});
