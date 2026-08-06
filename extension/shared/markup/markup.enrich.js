/**
 * @forward-slice markup
 * Extract/re-inject LaTeX + Mermaid inside document markups (markdown, prose).
 * Same pipeline AI Lab used — now shared so Clip Viewer / chips benefit too.
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;
  const root = typeof window !== 'undefined' ? window : globalThis;

  const LATEX_CMD_RE = /\\(?:begin|end|frac|sqrt|sum|int|prod|lim|alpha|beta|gamma|delta|theta|lambda|pi|sigma|omega|infty|pm|mp|cdot|times|div|leq|geq|neq|approx|equiv|left|right|mathbf|mathrm|mathbb|text|overline|underline|hat|bar|vec|partial|nabla|cdot|to|rightarrow|leftarrow)\b/;

  function hasEmbeddedLatex(text) {
    const t = String(text || '');
    if (!t) return false;
    if (/\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)/.test(t)) return true;
    if (/\$[^$\n]+\$/.test(t) && LATEX_CMD_RE.test(t)) return true;
    return LATEX_CMD_RE.test(t) && /\\(?:frac|sqrt|sum|int|begin)\{/.test(t);
  }

  function hasEmbeddedMermaid(text) {
    return /```mermaid\b/i.test(String(text || ''));
  }

  const ENRICHABLE_DOC_TYPES = new Set([
    'markdown', 'slack', 'asciidoc', 'textile', 'jira', 'text',
  ]);

  function needsEnrichment(text, type) {
    const t = String(type || '');
    if (t === 'latex') return looksLikeProseWithLatex(text);
    if (!ENRICHABLE_DOC_TYPES.has(t)) return false;
    return hasEmbeddedLatex(text) || hasEmbeddedMermaid(text);
  }

  function looksLikeProseWithLatex(text) {
    const t = String(text || '').trim();
    if (!t) return false;
    const lines = t.split(/\n/).filter((l) => l.trim());
    if (lines.length < 2) return false;
    const proseLines = lines.filter((l) => !/^\$\$|^\\\[|^\\begin\{|^```/.test(l.trim()) && !LATEX_CMD_RE.test(l));
    return proseLines.length >= 1 && hasEmbeddedLatex(t);
  }

  function pushLatex(latexBlocks, expr, display) {
    const type = display ? 'DISPLAY' : 'INLINE';
    const placeholder = `%%LATEX_${type}_${latexBlocks.length}%%`;
    latexBlocks.push({ expr: String(expr || '').trim(), display });
    return placeholder;
  }

  function extractMermaidBlocks(text, mermaidBlocks) {
    return String(text || '').replace(/```mermaid\s*\n([\s\S]*?)```/gi, (_, code) => {
      const placeholder = `%%MERMAID_BLOCK_${mermaidBlocks.length}%%`;
      mermaidBlocks.push(String(code || '').trim());
      return placeholder;
    });
  }

  function extractLatexBlocks(text, latexBlocks) {
    let processed = String(text || '');
    processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => pushLatex(latexBlocks, expr, true));
    processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_, expr) => pushLatex(latexBlocks, expr, true));
    processed = processed.replace(/\$([^$\n]+?)\$/g, (_, expr) => {
      // Avoid currency false-positives: require a latex command or math operator.
      if (!LATEX_CMD_RE.test(expr) && !/[\\^_{}]/.test(expr)) return `$${expr}$`;
      return pushLatex(latexBlocks, expr, false);
    });
    processed = processed.replace(/\\\(([\s\S]+?)\\\)/g, (_, expr) => pushLatex(latexBlocks, expr, false));
    return processed;
  }

  function replaceLatexBlock(html, block, index) {
    const displayPlaceholder = `%%LATEX_DISPLAY_${index}%%`;
    const inlinePlaceholder = `%%LATEX_INLINE_${index}%%`;
    const fallback = `<code>${ns.escapeHtml(block.expr)}</code>`;
    const katexApi = root.katex;
    if (!katexApi || typeof katexApi.renderToString !== 'function') {
      return html.replace(displayPlaceholder, fallback).replace(inlinePlaceholder, fallback);
    }
    try {
      const rendered = katexApi.renderToString(block.expr, {
        displayMode: block.display,
        throwOnError: false,
      });
      return html.replace(displayPlaceholder, rendered).replace(inlinePlaceholder, rendered);
    } catch (_) {
      return html.replace(displayPlaceholder, fallback).replace(inlinePlaceholder, fallback);
    }
  }

  function reinjectLatexBlocks(html, latexBlocks) {
    let output = String(html || '');
    for (let i = 0; i < latexBlocks.length; i++) {
      output = replaceLatexBlock(output, latexBlocks[i], i);
    }
    return output;
  }

  async function reinjectMermaidBlocks(html, mermaidBlocks) {
    let output = String(html || '');
    for (let i = 0; i < mermaidBlocks.length; i++) {
      const placeholder = `%%MERMAID_BLOCK_${i}%%`;
      if (!output.includes(placeholder)) continue;
      try {
        const mermaidHtml = await ns.renderMarkup(mermaidBlocks[i], null, { type: 'mermaid', enrich: false });
        output = output.replace(placeholder, mermaidHtml);
      } catch (_) {
        output = output.replace(
          placeholder,
          `<pre class="pc-code-block"><code>${ns.escapeHtml(mermaidBlocks[i])}</code></pre>`,
        );
      }
    }
    return output;
  }

  function renderBase(text, meta, baseType) {
    const strategy = ns.getStrategy(baseType);
    if (!strategy || typeof strategy.render !== 'function') {
      return `<pre class="pc-plain-text">${ns.escapeHtml(text)}</pre>`;
    }
    return strategy.render(text, meta);
  }

  /**
   * @param {string} text
   * @param {object} [meta]
   * @param {string} baseType
   * @param {{ syncPreview?: boolean }} [opts]
   * @returns {string|Promise<string>}
   */
  function renderEnriched(text, meta, baseType, opts) {
    const mermaidBlocks = [];
    const latexBlocks = [];
    let processed = extractMermaidBlocks(text, mermaidBlocks);
    processed = extractLatexBlocks(processed, latexBlocks);

    const base = baseType === 'text' ? 'markdown' : baseType;
    let html = renderBase(processed, meta, base);
    const finish = (resolvedHtml) => {
      let out = reinjectLatexBlocks(resolvedHtml, latexBlocks);
      if (opts && opts.syncPreview) {
        // Previews stay sync: leave mermaid as fenced-looking code.
        for (let i = 0; i < mermaidBlocks.length; i++) {
          const placeholder = `%%MERMAID_BLOCK_${i}%%`;
          out = out.replace(
            placeholder,
            `<pre class="pc-code-block pc-code-preview"><code>${ns.escapeHtml(mermaidBlocks[i])}</code></pre>`,
          );
        }
        return out;
      }
      if (!mermaidBlocks.length) return out;
      return reinjectMermaidBlocks(out, mermaidBlocks);
    };

    if (html && typeof html.then === 'function') {
      return html.then(finish);
    }
    return finish(html);
  }

  ns.hasEmbeddedLatex = hasEmbeddedLatex;
  ns.hasEmbeddedMermaid = hasEmbeddedMermaid;
  ns.needsEnrichment = needsEnrichment;
  ns.looksLikeProseWithLatex = looksLikeProseWithLatex;
  ns.renderEnriched = renderEnriched;
})();
