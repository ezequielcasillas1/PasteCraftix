/**
 * Extract readable text from a viewport region (DOM + image metadata).
 */

function rectsOverlap(a, b) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

function normalizeExtractedText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectTextNodeLines(rect) {
  const lines = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || parent.closest('[data-field="pc-merchant-strip-host"], [data-field="pc-merchant-dock-host"], [data-field="pc-merchant-snip-overlay"]')) {
        return NodeFilter.FILTER_REJECT;
      }
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = range.getClientRects();
      for (let i = 0; i < rects.length; i += 1) {
        const r = rects[i];
        if (rectsOverlap(rect, { x: r.x, y: r.y, width: r.width, height: r.height })) {
          return NodeFilter.FILTER_ACCEPT;
        }
      }
      return NodeFilter.FILTER_REJECT;
    },
  });

  while (walker.nextNode()) {
    const text = normalizeExtractedText(walker.currentNode.textContent);
    if (text) lines.push(text);
  }
  return lines;
}

function collectImageMetaLines(rect) {
  const lines = [];
  const selectors = [
    'img[data-ocr-text]',
    'img[alt]',
    '[data-ocr-text]',
    'svg[data-ocr-text]',
  ];

  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((el) => {
      if (el.closest('[data-field="pc-merchant-strip-host"], [data-field="pc-merchant-dock-host"], [data-field="pc-merchant-snip-overlay"]')) {
        return;
      }
      const bounds = el.getBoundingClientRect();
      if (!rectsOverlap(rect, bounds)) return;

      const ocrText = el.getAttribute('data-ocr-text');
      const altText = el.getAttribute('alt');
      const titleText = el.getAttribute('title');
      const value = normalizeExtractedText(ocrText || altText || titleText);
      if (value) lines.push(value);
    });
  }
  return lines;
}

function dedupeLines(lines) {
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

/** Return combined text from DOM nodes and image metadata in the region. */
export function extractTextFromRegion(rect) {
  if (!rect || rect.width < 1 || rect.height < 1) return '';

  const lines = dedupeLines([
    ...collectTextNodeLines(rect),
    ...collectImageMetaLines(rect),
  ]);

  if (lines.length === 0) return '';
  if (lines.length === 1) return lines[0];
  return lines.join('\n');
}
