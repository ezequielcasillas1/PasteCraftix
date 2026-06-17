/**
 * Run: node --test tests/protocol-share.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { openEmailShare, openProtocolUrl } from '../extension/popup/shared/protocol-share.js';

function installDomMock() {
  const clicks = [];
  const links = [];

  globalThis.document = {
    body: {
      appendChild(node) {
        links.push(node);
      },
    },
    createElement() {
      const link = {
        href: '',
        rel: '',
        click() {
          clicks.push(link.href);
        },
        remove() {},
      };
      return link;
    },
  };

  globalThis.window = {
    location: { href: '' },
  };

  return {
    getClicks() {
      return [...clicks];
    },
    getLocationHref() {
      return window.location.href;
    },
  };
}

test('openProtocolUrl clicks anchor with href', () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;

  try {
    const dom = installDomMock();
    openProtocolUrl('mailto:test@example.com');

    assert.deepEqual(dom.getClicks(), ['mailto:test@example.com']);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test('openEmailShare encodes subject and body in mailto URL', () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;

  try {
    const dom = installDomMock();
    openEmailShare({ subject: 'Hello & hi', body: 'Line one\nLine two' });

    assert.equal(dom.getClicks().length, 1);
    const href = dom.getClicks()[0];
    assert.ok(href.startsWith('mailto:?'));
    assert.ok(href.includes('subject=Hello%20%26%20hi'));
    assert.ok(href.includes('body=Line%20one%0ALine%20two'));
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});
