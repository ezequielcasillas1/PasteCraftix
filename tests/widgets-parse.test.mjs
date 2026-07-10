import assert from 'node:assert/strict';
import {
  parseEmbedInput,
  normalizeWidgetRecord,
  sandboxForMode,
  isExternalWidget,
  buildWidgetDataUrl,
} from '../extension/popup/features/widgets/widgets.parse.js';

const iframeSnippet = `<iframe src="https://www.livecoinwatch.com/widgets/coin" width="100%" height="200"></iframe>`;
const parsedIframe = parseEmbedInput(iframeSnippet);
assert.equal(parsedIframe.ok, true);
assert.equal(parsedIframe.mode, 'iframe');
assert.equal(parsedIframe.src, 'https://www.livecoinwatch.com/widgets/coin');

const urlOnly = parseEmbedInput('https://nowprice.io/embed/price/crypto/BTCUSDT');
assert.equal(urlOnly.ok, true);
assert.equal(urlOnly.mode, 'iframe');

const scriptEmbed = parseEmbedInput('<script src="https://www.livecoinwatch.com/static/lcw-widget.js"></script><div class="live-coin-watch-coin" data-coin="btc"></div>');
assert.equal(scriptEmbed.ok, true);
assert.equal(scriptEmbed.mode, 'external');
assert.match(scriptEmbed.srcdoc, /lcw-widget\.js/);
assert.equal(isExternalWidget({ mode: 'external', srcdoc: 'x' }), true);
assert.equal(isExternalWidget({ mode: 'iframe', src: 'https://x.com' }), false);

const bad = parseEmbedInput('javascript:alert(1)');
assert.equal(bad.ok, false);

const record = normalizeWidgetRecord({ title: 'BTC', size: 'sm', embedRaw: iframeSnippet });
assert.equal(record.ok, true);
assert.equal(record.widget.size, 'sm');
assert.equal(sandboxForMode('iframe').includes('allow-same-origin'), true);

const dataUrl = buildWidgetDataUrl(scriptEmbed.srcdoc);
assert.match(dataUrl, /^data:text\/html;charset=utf-8,/);
assert.equal(dataUrl.includes('blob:'), false);
assert.equal(dataUrl.includes('chrome-extension:'), false);

console.log('widgets-parse.test.mjs: ok');
