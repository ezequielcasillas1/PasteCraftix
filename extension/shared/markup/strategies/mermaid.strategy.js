/**
 * @forward-slice markup
 * Strategy: mermaid (lazy-loaded)
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;
  const root = typeof window !== 'undefined' ? window : globalThis;

  let _mermaidLoaded = false;
  let _mermaidLoadPromise = null;

  function mermaidTheme() {
    try {
      if (typeof document !== 'undefined'
        && document.documentElement.getAttribute('data-theme') === 'blue') {
        return 'dark';
      }
    } catch (_) { /* ignore */ }
    return 'default';
  }

  function applyMermaidTheme() {
    if (!root.mermaid) return false;
    root.mermaid.initialize({
      startOnLoad: false,
      theme: mermaidTheme(),
      securityLevel: 'strict',
      htmlLabels: false,
    });
    return true;
  }

  function initializeMermaidLibrary() {
    if (!applyMermaidTheme()) return false;
    _mermaidLoaded = true;
    return true;
  }

  async function loadAndInitializeMermaid() {
    try {
      if (!root.mermaid) {
        const loader = root.PasteCraftResourceLoader;
        if (!loader?.loadScript) return false;
        await loader.loadScript('mermaid');
      }
      return initializeMermaidLibrary();
    } catch (_) {
      return false;
    }
  }

  function retainSuccessfulMermaidPromise(ready) {
    if (!ready) _mermaidLoadPromise = null;
    return ready;
  }

  function ensureMermaid() {
    if (_mermaidLoaded && root.mermaid) return Promise.resolve(true);
    if (_mermaidLoadPromise) return _mermaidLoadPromise;
    _mermaidLoadPromise = loadAndInitializeMermaid().then(retainSuccessfulMermaidPromise);
    return _mermaidLoadPromise;
  }

  async function renderMermaid(text) {
    const ready = await ensureMermaid();
    if (!ready) return `<pre class="pc-code-block"><code>${ns.escapeHtml(text)}</code></pre>`;
    const mermaidApi = root.mermaid;
    const source = String(text || '').trim();
    if (!source) return `<pre class="pc-code-block"><code>${ns.escapeHtml(text)}</code></pre>`;

    const likelyMermaid = /^(graph\s+(TD|TB|BT|RL|LR)|flowchart\s+(TD|TB|BT|RL|LR)|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|journey|mindmap|timeline|sankey|xychart|block-beta)\b/m.test(source);
    if (!likelyMermaid) return `<pre class="pc-code-block"><code>${ns.escapeHtml(text)}</code></pre>`;

    let parsedOk = true;
    if (typeof mermaidApi.parse === 'function') {
      try {
        const parseResult = await mermaidApi.parse(source, { suppressErrors: true });
        parsedOk = parseResult !== false;
      } catch (_) {
        try {
          const parseResult = await mermaidApi.parse(source);
          parsedOk = parseResult !== false;
        } catch (_) {
          parsedOk = false;
        }
      }
    }
    if (!parsedOk) return `<pre class="pc-code-block"><code>${ns.escapeHtml(text)}</code></pre>`;

    try {
      applyMermaidTheme();
      const id = 'pc-mermaid-' + Date.now() + Math.random().toString(36).slice(2, 6);
      const { svg } = await mermaidApi.render(id, source);
      if (/syntax\s+error\s+in\s+text/i.test(svg) || /class="error-icon"/i.test(svg)) {
        return `<pre class="pc-code-block"><code>${ns.escapeHtml(text)}</code></pre>`;
      }
      return `<div class="pc-mermaid-rendered">${ns.sanitize(svg)}</div>`;
    } catch (_) {
      return `<pre class="pc-code-block"><code>${ns.escapeHtml(text)}</code></pre>`;
    }
  }

  ns.registerStrategy({
    type: 'mermaid',
    render(text) {
      return renderMermaid(text);
    },
    renderPreview(text, _meta, maxChars) {
      const truncated = text.length > (maxChars || 200) ? text.substring(0, maxChars || 200) : text;
      return `<pre class="pc-code-block pc-code-preview"><code>${ns.escapeHtml(truncated)}</code></pre>`;
    },
  });
})();
