/**
 * PasteCraft Markup Renderer
 * Detects and renders markup languages in clips.
 * Depends on: marked, DOMPurify, hljs, katex (loaded globally via popup.html)
 * Mermaid is lazy-loaded only when needed.
 */
(() => {
  'use strict';

  /* ──────────────────────────────────────────────
     Badge config: type → { label, color }
     ────────────────────────────────────────────── */
  const BADGE_MAP = {
    markdown: { label: 'MD', bg: '#3b82f6', fg: '#fff' },
    html:     { label: 'HTML', bg: '#e34c26', fg: '#fff' },
    json:     { label: 'JSON', bg: '#f59e0b', fg: '#fff' },
    yaml:     { label: 'YAML', bg: '#cb171e', fg: '#fff' },
    xml:      { label: 'XML', bg: '#f97316', fg: '#fff' },
    toml:     { label: 'TOML', bg: '#9d4edd', fg: '#fff' },
    csv:      { label: 'CSV', bg: '#10b981', fg: '#fff' },
    tsv:      { label: 'TSV', bg: '#10b981', fg: '#fff' },
    latex:    { label: 'LaTeX', bg: '#008080', fg: '#fff' },
    mermaid:  { label: 'Diagram', bg: '#ff3670', fg: '#fff' },
    bbcode:   { label: 'BBCode', bg: '#6366f1', fg: '#fff' },
    slack:    { label: 'Slack', bg: '#4a154b', fg: '#fff' },
    asciidoc: { label: 'ADoc', bg: '#e40046', fg: '#fff' },
    rst:      { label: 'rST', bg: '#0a0a0a', fg: '#fff' },
    orgmode:    { label: 'Org', bg: '#77aa99', fg: '#fff' },
    mediawiki:  { label: 'Wiki', bg: '#006699', fg: '#fff' },
    textile:    { label: 'Textile', bg: '#c7254e', fg: '#fff' },
    jira:       { label: 'JIRA', bg: '#0052cc', fg: '#fff' },
    code:       { label: 'Code', bg: '#1e293b', fg: '#10b981' },
    text:       null, // no badge for plain text
  };

  /* ──────────────────────────────────────────────
     DETECTION
     ────────────────────────────────────────────── */
  function detectMarkupType(text, meta) {
    if (!text || typeof text !== 'string') return 'text';
    const t = text.trim();
    if (!t) return 'text';

    // 0. Explicit markup hint from Quick Save (user-selected format)
    if (meta && meta.markupHint && typeof meta.markupHint === 'string') {
      const hint = meta.markupHint.toLowerCase();
      if (BADGE_MAP.hasOwnProperty(hint) && hint !== 'text') return hint;
    }

    // 1. Explicit meta.kind shortcuts
    if (meta && meta.kind === 'image') return 'text';
    if (meta && meta.kind === 'url') return 'text';

    // 2. JSON
    if ((t[0] === '{' && t[t.length - 1] === '}') || (t[0] === '[' && t[t.length - 1] === ']')) {
      try { JSON.parse(t); return 'json'; } catch (_) { /* not JSON */ }
    }

    // 3. XML
    if (/^<\?xml[\s>]/i.test(t)) return 'xml';

    // 4. LaTeX
    if (/\\begin\{|\\end\{|\$\$.+?\$\$|\\frac\{|\\sum[^a-z]|\\int[^a-z]|\\alpha|\\beta|\\gamma|\\left[(\[]|\\right[)\]]/s.test(t)) return 'latex';

    // 5. Mermaid diagram
    if (/^(graph\s+(TD|TB|BT|RL|LR)|flowchart\s+(TD|TB|BT|RL|LR)|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|journey|mindmap|timeline|sankey|xychart|block-beta)/m.test(t)) return 'mermaid';

    // 6. YAML (frontmatter or key:value-heavy)
    if (/^---\s*\n/.test(t)) return 'yaml';
    {
      const yamlLines = t.split('\n').slice(0, 10);
      const kvCount = yamlLines.filter(l => /^[\w][\w.-]*:\s/.test(l)).length;
      if (kvCount >= 3) return 'yaml';
    }

    // 7. TOML
    if (/^\[[\w.-]+\]\s*$/m.test(t) && /^[\w.-]+\s*=\s*/m.test(t)) return 'toml';

    // 8. BBCode
    if (/\[(?:b|i|u|s|url|img|code|quote|color|size|list|spoiler)\]/i.test(t) &&
        /\[\/(?:b|i|u|s|url|img|code|quote|color|size|list|spoiler)\]/i.test(t)) return 'bbcode';

    // 9. Fenced code block (```lang ... ```) - check before general markdown
    if (/^```[\w-]*\s*\n[\s\S]+?\n```\s*$/m.test(t) && !/^#{1,6}\s/m.test(t)) return 'code';

    // 10. Markdown (common patterns)
    {
      let mdScore = 0;
      if (/^#{1,6}\s.+$/m.test(t)) mdScore += 2;
      if (/\*\*[^*]+\*\*/m.test(t)) mdScore++;
      if (/^[-*+]\s/m.test(t)) mdScore++;
      if (/^\d+\.\s/m.test(t)) mdScore++;
      if (/```[\s\S]*?```/m.test(t)) mdScore += 2;
      if (/\[.+?\]\(.+?\)/.test(t)) mdScore += 2;
      if (/^\|.+\|$/m.test(t) && /^\|[-:| ]+\|$/m.test(t)) mdScore += 2;
      if (/^>\s/m.test(t)) mdScore++;
      if (/!\[.*?\]\(.*?\)/.test(t)) mdScore++;
      if (mdScore >= 2) return 'markdown';
    }

    // 11. HTML tags in text (guard: skip if text looks like JSX/template code)
    if (/<(?:div|span|p|h[1-6]|table|thead|tbody|tr|td|th|ul|ol|li|a|img|br|hr|strong|em|code|pre|blockquote|section|article|nav|header|footer|form|input|button|select|textarea)[^>]*>/i.test(t)) {
      const tagCount = (t.match(/<\/?[a-z][a-z0-9]*[^>]*>/gi) || []).length;
      const looksLikeCode = /^(?:import\s|export\s|const\s|let\s|var\s|function\s|class\s|def\s|from\s+\w+\s+import|package\s|#include\s)/m.test(t);
      if (tagCount >= 2 && !looksLikeCode) return 'html';
    }

    // 12. CSV / TSV
    {
      const lines = t.split('\n').filter(l => l.trim());
      if (lines.length >= 2) {
        const tabs0 = (lines[0].match(/\t/g) || []).length;
        if (tabs0 >= 1 && lines.slice(0, 5).every(l => Math.abs((l.match(/\t/g) || []).length - tabs0) <= 1)) return 'tsv';
        const commas0 = (lines[0].match(/,/g) || []).length;
        if (commas0 >= 2 && lines.slice(0, 5).every(l => Math.abs((l.match(/,/g) || []).length - commas0) <= 1)) return 'csv';
      }
    }

    // 13. AsciiDoc (before Slack — uses * and _ which overlap)
    if (/^={1,5}\s.+$/m.test(t) && /^\.[\w ]+$/m.test(t)) return 'asciidoc';
    if (/^\[source,\s*\w+\]/m.test(t)) return 'asciidoc';

    // 14. reStructuredText
    if (/^[=\-~^"]{3,}$/m.test(t) && /^\.\.\s[\w-]+::/m.test(t)) return 'rst';

    // 15. Org-mode
    if (/^\*{1,5}\s.+$/m.test(t) && /^#\+[\w]+:/m.test(t)) return 'orgmode';

    // 16. MediaWiki
    if (/^(={2,5})\s*.+?\s*\1\s*$/m.test(t) && (/\[\[.+?\]\]/.test(t) || /'''[^']+'''/.test(t) || /\{\{[^}]+\}\}/.test(t))) return 'mediawiki';
    if (/\[\[.+?\]\]/.test(t) && /'''[^']+'''/.test(t)) return 'mediawiki';

    // 17. JIRA / Confluence (before Textile — has distinctive {macro} blocks)
    if (/^h[1-6]\.\s/m.test(t) && /\{[a-z]+(?::[^}]*)?\}/i.test(t)) return 'jira';
    if (/\{code(?::[^}]*)?\}[\s\S]*?\{code\}/i.test(t)) return 'jira';
    if (/\{noformat\}[\s\S]*?\{noformat\}/i.test(t)) return 'jira';
    if (/\[~[^\]]+\]/.test(t) && /\{[a-z]+\}/i.test(t)) return 'jira';

    // 18. Textile (before Slack — uses h1., bq., p. which are distinctive)
    if (/^h[1-6]\.\s/m.test(t) && (/\*[^*]+\*/.test(t) || /_[^_]+_/.test(t) || /^[*#]+\s/m.test(t))) return 'textile';
    if (/^bq\.\s/m.test(t) || (/^p\.\s/m.test(t) && /\*[^*]+\*/.test(t))) return 'textile';

    // 19. Slack/Discord (LAST among text markups — uses most generic symbols: * _ ~ `)
    if (/\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`|>>>.+/m.test(t) && !/^#{1,6}\s/m.test(t)) {
      let slackScore = 0;
      if (/\*[^*\n]+\*/.test(t)) slackScore++;
      if (/_[^_\n]+_/.test(t)) slackScore++;
      if (/~[^~\n]+~/.test(t)) slackScore++;
      if (/`[^`\n]+`/.test(t)) slackScore++;
      if (slackScore >= 2) return 'slack';
    }

    // 20. XML-like (generous)
    if (/^<[a-z][\w-]*[^>]*>[\s\S]*<\/[a-z][\w-]*>\s*$/is.test(t)) return 'xml';

    // 21. Raw unfenced code (heuristic — must score high to avoid false positives)
    {
      const lines = t.split('\n');
      if (lines.length >= 2) {
        let codeScore = 0;
        // Structural signals (indentation, braces, semicolons)
        const indented = lines.filter(l => /^[ \t]{2,}\S/.test(l)).length;
        if (indented / lines.length >= 0.3) codeScore += 2;
        if (/[{};]\s*$/.test(t) || (t.match(/[{};]\s*$/gm) || []).length >= 2) codeScore++;
        if (/\(\)|\(.*,.*\)/.test(t)) codeScore++; // function calls
        // Language keyword patterns
        // JS/TS
        if (/\b(?:const|let|var|function|=>|async|await|import\s+\{|export\s+(?:default|const|function|class)|require\(|module\.exports|console\.log)\b/.test(t)) codeScore += 3;
        // Python
        if (/\b(?:def\s+\w+\(|class\s+\w+[:(]|import\s+\w+|from\s+\w+\s+import|if\s+__name__|print\(|self\.|elif\s|except\s|lambda\s)\b/.test(t)) codeScore += 3;
        // Java / C# / Kotlin
        if (/\b(?:public\s+(?:static|class|void|int|String)|private\s+\w|protected\s+\w|System\.out|Console\.Write|fun\s+\w+\(|val\s+\w+|var\s+\w+:\s*\w+)\b/.test(t)) codeScore += 3;
        // C / C++
        if (/\b(?:#include\s*[<"]|int\s+main\s*\(|printf\s*\(|std::|nullptr|sizeof\s*\(|malloc\s*\(|void\s+\w+\s*\()\b/.test(t)) codeScore += 3;
        // Go
        if (/\b(?:func\s+\w+\(|package\s+\w+|fmt\.Print|go\s+func|:=\s)/.test(t)) codeScore += 3;
        // Rust
        if (/\b(?:fn\s+\w+|let\s+mut\s|impl\s+\w|pub\s+fn|use\s+\w+::|println!\(|match\s+\w+\s*\{)/.test(t)) codeScore += 3;
        // Ruby
        if (/\b(?:def\s+\w+|end$|puts\s|require\s+['"]|attr_accessor|class\s+\w+\s*<)/.test(t) && /\bend\b/m.test(t)) codeScore += 3;
        // PHP
        if (/\b(?:<\?php|\$\w+\s*=|function\s+\w+\s*\(|echo\s|->|namespace\s+\w)/.test(t)) codeScore += 3;
        // Swift
        if (/\b(?:func\s+\w+|var\s+\w+:\s*\w|let\s+\w+:\s*\w|guard\s+let|import\s+(?:UIKit|Foundation|SwiftUI))/.test(t)) codeScore += 3;
        // SQL
        if (/\b(?:SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|WHERE\s+\w+|JOIN\s+\w+|GROUP\s+BY)\b/i.test(t)) codeScore += 3;
        // Shell / Bash
        if (/^(?:#!\/bin\/(?:bash|sh|zsh)|(?:if|then|fi|do|done|for|while|case|esac)\b)/m.test(t) || /\b(?:echo\s|chmod\s|mkdir\s|grep\s|awk\s|sed\s|curl\s|apt\s|npm\s|pip\s)/m.test(t)) codeScore += 2;
        // Generic strong signals
        if (/\/\/\s*\w|\/\*[\s\S]*?\*\/|#\s+\w.*\n.*(?:def |class |import )/.test(t)) codeScore++; // comments
        if (/\b(?:return\s|throw\s|try\s*\{|catch\s*\(|if\s*\(|else\s*\{|while\s*\(|for\s*\(|switch\s*\()/.test(t)) codeScore += 2;
        // Threshold: need strong confidence to avoid plain-text false positives
        if (codeScore >= 5) return 'code';
      }
    }

    return 'text';
  }

  /* ──────────────────────────────────────────────
     SANITIZE HELPER (delegates to shared/sanitize-html.js)
     ────────────────────────────────────────────── */
  function sanitize(html) {
    if (typeof PCSanitize !== 'undefined' && typeof PCSanitize.strictSanitize === 'function') {
      return PCSanitize.strictSanitize(html);
    }
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /* ──────────────────────────────────────────────
     PER-TYPE RENDERERS
     ────────────────────────────────────────────── */

  function renderMarkdown(text) {
    if (typeof marked === 'undefined') return `<pre>${escapeHtml(text)}</pre>`;
    const html = marked.parse(text, { gfm: true, breaks: true });
    return sanitize(html);
  }

  function renderHTML(text, meta) {
    const raw = (meta && meta.html) ? meta.html : text;
    return sanitize(raw);
  }

  function renderJSON(text) {
    try {
      const obj = JSON.parse(text.trim());
      const pretty = JSON.stringify(obj, null, 2);
      const highlighted = highlightCode(pretty, 'json');
      return `<pre class="pc-code-block"><code>${highlighted}</code></pre>`;
    } catch (_) {
      return `<pre class="pc-code-block"><code>${escapeHtml(text)}</code></pre>`;
    }
  }

  function renderYAML(text) {
    const highlighted = highlightCode(text, 'yaml');
    return `<pre class="pc-code-block"><code>${highlighted}</code></pre>`;
  }

  function renderXML(text) {
    const highlighted = highlightCode(text, 'xml');
    return `<pre class="pc-code-block"><code>${highlighted}</code></pre>`;
  }

  function renderTOML(text) {
    // highlight.js has ini which is close to TOML
    const highlighted = highlightCode(text, 'ini');
    return `<pre class="pc-code-block"><code>${highlighted}</code></pre>`;
  }

  function renderCodeBlock(text) {
    // Extract language from fenced code block
    const match = text.match(/^```([\w-]*)\s*\n([\s\S]+?)\n```\s*$/m);
    if (match) {
      const lang = match[1] || '';
      const code = match[2];
      const highlighted = highlightCode(code, lang);
      return `<pre class="pc-code-block"><code>${highlighted}</code></pre>`;
    }
    const highlighted = highlightCode(text, '');
    return `<pre class="pc-code-block"><code>${highlighted}</code></pre>`;
  }

  function renderCSV(text, delimiter) {
    const sep = delimiter || ',';
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return `<pre>${escapeHtml(text)}</pre>`;
    const rows = lines.map(l => parseCSVRow(l, sep));
    let html = '<table class="pc-csv-table"><thead><tr>';
    rows[0].forEach(cell => { html += `<th>${escapeHtml(cell)}</th>`; });
    html += '</tr></thead><tbody>';
    for (let i = 1; i < rows.length; i++) {
      html += '<tr>';
      rows[i].forEach(cell => { html += `<td>${escapeHtml(cell)}</td>`; });
      html += '</tr>';
    }
    html += '</tbody></table>';
    return sanitize(html);
  }

  function parseCSVRow(line, sep) {
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === sep) { cells.push(current); current = ''; }
        else { current += ch; }
      }
    }
    cells.push(current);
    return cells;
  }

  function renderLaTeX(text) {
    if (typeof katex === 'undefined') return `<pre>${escapeHtml(text)}</pre>`;
    try {
      // Check for display math ($$...$$ or \[...\])
      let processed = text;
      // Replace display math $$...$$ 
      processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
        try { return sanitize(katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false })); }
        catch (e) { return `<code>${escapeHtml(expr)}</code>`; }
      });
      // Replace \[...\]
      processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_, expr) => {
        try { return sanitize(katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false })); }
        catch (e) { return `<code>${escapeHtml(expr)}</code>`; }
      });
      // Replace inline math $...$
      processed = processed.replace(/\$([^$\n]+?)\$/g, (_, expr) => {
        try { return sanitize(katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false })); }
        catch (e) { return `<code>${escapeHtml(expr)}</code>`; }
      });
      // Replace \(...\)
      processed = processed.replace(/\\\(([\s\S]+?)\\\)/g, (_, expr) => {
        try { return sanitize(katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false })); }
        catch (e) { return `<code>${escapeHtml(expr)}</code>`; }
      });
      // If no replacements happened, try rendering the whole thing as display math
      if (processed === text) {
        // Try entire string as LaTeX
        const stripped = text.replace(/^\\\[|\\\]$|^\$\$|\$\$$|^\\begin\{.*?\}|\\end\{.*?\}$/g, '').trim();
        return sanitize(katex.renderToString(stripped || text, { displayMode: true, throwOnError: false }));
      }
      return `<div class="pc-latex-rendered">${sanitize(processed)}</div>`;
    } catch (_) {
      return `<pre>${escapeHtml(text)}</pre>`;
    }
  }

  let _mermaidLoaded = false;
  let _mermaidLoadPromise = null;

  async function ensureMermaid() {
    if (_mermaidLoaded && typeof mermaid !== 'undefined') return true;
    if (_mermaidLoadPromise) return _mermaidLoadPromise;
    _mermaidLoadPromise = new Promise((resolve) => {
      // Mermaid should already be loaded via script tag. If not, we can't lazy-load in extension CSP.
      if (typeof mermaid !== 'undefined') {
        try {
          mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' });
          _mermaidLoaded = true;
        } catch (_) {}
        resolve(_mermaidLoaded);
      } else {
        resolve(false);
      }
    });
    return _mermaidLoadPromise;
  }

  async function renderMermaid(text) {
    const ready = await ensureMermaid();
    if (!ready) return `<pre class="pc-code-block"><code>${escapeHtml(text)}</code></pre>`;
    try {
      const id = 'pc-mermaid-' + Date.now() + Math.random().toString(36).slice(2, 6);
      const { svg } = await mermaid.render(id, text.trim());
      return `<div class="pc-mermaid-rendered">${sanitize(svg)}</div>`;
    } catch (_) {
      return `<pre class="pc-code-block"><code>${escapeHtml(text)}</code></pre>`;
    }
  }

  function renderBBCode(text) {
    let html = escapeHtml(text);
    html = html.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>');
    html = html.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>');
    html = html.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>');
    html = html.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<del>$1</del>');
    html = html.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, '<pre><code>$1</code></pre>');
    html = html.replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, '<blockquote>$1</blockquote>');
    html = html.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, '<a href="$1" target="_blank" rel="noreferrer">$2</a>');
    html = html.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');
    html = html.replace(/\[img\]([\s\S]*?)\[\/img\]/gi, '<img src="$1" alt="image" style="max-width:100%;">');
    html = html.replace(/\[color=([^\]]+)\]([\s\S]*?)\[\/color\]/gi, '<span style="color:$1">$2</span>');
    html = html.replace(/\[size=([^\]]+)\]([\s\S]*?)\[\/size\]/gi, '<span style="font-size:$1">$2</span>');
    html = html.replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (_, inner) => {
      const items = inner.split(/\[\*\]/g).filter(i => i.trim());
      return '<ul>' + items.map(i => `<li>${i.trim()}</li>`).join('') + '</ul>';
    });
    html = html.replace(/\n/g, '<br>');
    return sanitize(html);
  }

  function renderSlack(text) {
    let html = escapeHtml(text);
    html = html.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');
    html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');
    html = html.replace(/~([^~\n]+)~/g, '<del>$1</del>');
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    html = html.replace(/^&gt;&gt;&gt;\s*([\s\S]+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/^&gt;\s*(.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/\n/g, '<br>');
    return sanitize(html);
  }

  function renderAsciiDoc(text) {
    let html = escapeHtml(text);
    // Headings
    html = html.replace(/^(={1,5})\s+(.+)$/gm, (_, eq, title) => {
      const level = Math.min(eq.length, 6);
      return `<h${level}>${title}</h${level}>`;
    });
    // Bold / italic
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\n/g, '<br>');
    return sanitize(html);
  }

  function renderRST(text) {
    let html = escapeHtml(text);
    // Headings (line followed by === or --- underline)
    html = html.replace(/^(.+)\n([=\-~^"]+)$/gm, (_, title, underline) => {
      const ch = underline[0];
      const level = ch === '=' ? 1 : ch === '-' ? 2 : ch === '~' ? 3 : 4;
      return `<h${level}>${title}</h${level}>`;
    });
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/``([^`]+)``/g, '<code>$1</code>');
    html = html.replace(/\n/g, '<br>');
    return sanitize(html);
  }

  function renderOrgMode(text) {
    let html = escapeHtml(text);
    // Headings
    html = html.replace(/^(\*{1,5})\s+(.+)$/gm, (_, stars, title) => {
      const level = Math.min(stars.length, 6);
      return `<h${level}>${title}</h${level}>`;
    });
    html = html.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
    html = html.replace(/\/([^/]+)\//g, '<em>$1</em>');
    html = html.replace(/~([^~]+)~/g, '<code>$1</code>');
    html = html.replace(/=([^=]+)=/g, '<code>$1</code>');
    html = html.replace(/\+([^+]+)\+/g, '<del>$1</del>');
    html = html.replace(/\n/g, '<br>');
    return sanitize(html);
  }

  function renderMediaWiki(text) {
    let html = escapeHtml(text);
    // Headings: == H2 == ... ===== H5 =====
    html = html.replace(/^(={2,5})\s*(.+?)\s*\1\s*$/gm, (_, eq, title) => {
      const level = Math.min(eq.length, 6);
      return `<h${level}>${title}</h${level}>`;
    });
    // Bold '''text'''
    html = html.replace(/&#x27;&#x27;&#x27;([^&]+?)&#x27;&#x27;&#x27;/g, '<strong>$1</strong>');
    // Italic ''text''
    html = html.replace(/&#x27;&#x27;([^&]+?)&#x27;&#x27;/g, '<em>$1</em>');
    // Internal links [[Page]] and [[Page|Label]]
    html = html.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<a href="#" title="$1">$2</a>');
    html = html.replace(/\[\[([^\]]+)\]\]/g, '<a href="#" title="$1">$1</a>');
    // External links [http://url label]
    html = html.replace(/\[(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/g, '<a href="$1" target="_blank" rel="noreferrer">$2</a>');
    // Templates {{name}} → show as code badge
    html = html.replace(/\{\{([^}]+)\}\}/g, '<code>{{$1}}</code>');
    // Unordered lists (* item)
    html = html.replace(/^\*+\s+(.+)$/gm, '<li>$1</li>');
    // Ordered lists (# item)
    html = html.replace(/^#+\s+(.+)$/gm, '<li>$1</li>');
    // Horizontal rule ----
    html = html.replace(/^-{4,}$/gm, '<hr>');
    html = html.replace(/\n/g, '<br>');
    return sanitize(html);
  }

  function renderTextile(text) {
    let html = escapeHtml(text);
    // Headings: h1. Title ... h6. Title
    html = html.replace(/^h([1-6])\.\s+(.+)$/gm, (_, level, title) => `<h${level}>${title}</h${level}>`);
    // Bold *text*
    html = html.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');
    // Italic _text_
    html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');
    // Strikethrough -text-
    html = html.replace(/-([^-\n]+)-/g, '<del>$1</del>');
    // Underline +text+
    html = html.replace(/\+([^+\n]+)\+/g, '<u>$1</u>');
    // Superscript ^text^
    html = html.replace(/\^([^^]+)\^/g, '<sup>$1</sup>');
    // Subscript ~text~
    html = html.replace(/~([^~]+)~/g, '<sub>$1</sub>');
    // Inline code @text@
    html = html.replace(/@([^@\n]+)@/g, '<code>$1</code>');
    // Blockquote bq. text
    html = html.replace(/^bq\.\s+(.+)$/gm, '<blockquote>$1</blockquote>');
    // Paragraph p. text (just render normally)
    html = html.replace(/^p\.\s+(.+)$/gm, '<p>$1</p>');
    // Unordered list items (* / ** / ***)
    html = html.replace(/^\*+\s+(.+)$/gm, '<li>$1</li>');
    // Ordered list items (# / ## / ###)
    html = html.replace(/^#+\s+(.+)$/gm, '<li>$1</li>');
    // Links "label":url
    html = html.replace(/&quot;([^&]+)&quot;:(https?:\/\/[^\s<]+)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
    // Image !url!
    html = html.replace(/!([^!\s]+)!/g, '<img src="$1" alt="image" style="max-width:100%;">');
    html = html.replace(/\n/g, '<br>');
    return sanitize(html);
  }

  function renderJIRA(text) {
    let html = escapeHtml(text);
    // Headings: h1. Title ... h6. Title
    html = html.replace(/^h([1-6])\.\s+(.+)$/gm, (_, level, title) => `<h${level}>${title}</h${level}>`);
    // Bold *text*
    html = html.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');
    // Italic _text_
    html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');
    // Strikethrough -text-
    html = html.replace(/-([^-\n]+)-/g, '<del>$1</del>');
    // Underline +text+
    html = html.replace(/\+([^+\n]+)\+/g, '<u>$1</u>');
    // Superscript ^text^
    html = html.replace(/\^([^^]+)\^/g, '<sup>$1</sup>');
    // Subscript ~text~
    html = html.replace(/~([^~]+)~/g, '<sub>$1</sub>');
    // Monospace {{text}}
    html = html.replace(/\{\{([^}]+)\}\}/g, '<code>$1</code>');
    // {code} blocks
    html = html.replace(/\{code(?::([^}]*))?\}([\s\S]*?)\{code\}/gi, (_, params, code) => {
      return `<pre class="pc-code-block"><code>${code.trim()}</code></pre>`;
    });
    // {noformat} blocks
    html = html.replace(/\{noformat\}([\s\S]*?)\{noformat\}/gi, (_, content) => {
      return `<pre>${content.trim()}</pre>`;
    });
    // {quote} blocks
    html = html.replace(/\{quote\}([\s\S]*?)\{quote\}/gi, '<blockquote>$1</blockquote>');
    // {color} spans
    html = html.replace(/\{color:([^}]+)\}([\s\S]*?)\{color\}/gi, '<span style="color:$1">$2</span>');
    // Panels {panel:title=X}...{panel}
    html = html.replace(/\{panel(?::title=([^}]*))?\}([\s\S]*?)\{panel\}/gi, (_, title, content) => {
      const heading = title ? `<div style="font-weight:700;margin-bottom:4px;">${title}</div>` : '';
      return `<div style="border:1px solid #ddd;border-radius:6px;padding:8px;margin:4px 0;">${heading}${content.trim()}</div>`;
    });
    // Links [label|url]
    html = html.replace(/\[([^\]|]+)\|([^\]]+)\]/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
    // User mentions [~username]
    html = html.replace(/\[~([^\]]+)\]/g, '<code>@$1</code>');
    // Unordered list (* / ** / ***)
    html = html.replace(/^\*+\s+(.+)$/gm, '<li>$1</li>');
    // Ordered list (# / ## / ###)
    html = html.replace(/^#+\s+(.+)$/gm, '<li>$1</li>');
    // Horizontal rule ----
    html = html.replace(/^-{4,}$/gm, '<hr>');
    html = html.replace(/\n/g, '<br>');
    return sanitize(html);
  }

  /* ──────────────────────────────────────────────
     HIGHLIGHT HELPER
     ────────────────────────────────────────────── */
  function highlightCode(code, lang) {
    if (typeof hljs !== 'undefined') {
      try {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
        }
        return hljs.highlightAuto(code).value;
      } catch (_) {}
    }
    return escapeHtml(code);
  }

  /* ──────────────────────────────────────────────
     MAIN RENDER FUNCTION
     ────────────────────────────────────────────── */
  /**
   * @param {string} text - Clip text content
   * @param {object} [meta] - Clip meta object
   * @param {object} [options] - { type?: string }
   * @returns {string|Promise<string>} Sanitized HTML
   */
  function renderMarkup(text, meta, options) {
    if (!text || typeof text !== 'string') return escapeHtml(text || '');
    const type = (options && options.type) || detectMarkupType(text, meta);

    try {
      switch (type) {
        case 'markdown': return renderMarkdown(text);
        case 'html':     return renderHTML(text, meta);
        case 'json':     return renderJSON(text);
        case 'yaml':     return renderYAML(text);
        case 'xml':      return renderXML(text);
        case 'toml':     return renderTOML(text);
        case 'csv':      return renderCSV(text, ',');
        case 'tsv':      return renderCSV(text, '\t');
        case 'latex':    return renderLaTeX(text);
        case 'mermaid':  return renderMermaid(text); // returns Promise
        case 'bbcode':   return renderBBCode(text);
        case 'slack':    return renderSlack(text);
        case 'code':     return renderCodeBlock(text);
        case 'asciidoc': return renderAsciiDoc(text);
        case 'rst':      return renderRST(text);
        case 'orgmode':   return renderOrgMode(text);
        case 'mediawiki': return renderMediaWiki(text);
        case 'textile':   return renderTextile(text);
        case 'jira':      return renderJIRA(text);
        default:          return `<pre class="pc-plain-text">${escapeHtml(text)}</pre>`;
      }
    } catch (_) {
      return `<pre class="pc-plain-text">${escapeHtml(text)}</pre>`;
    }
  }

  /* ──────────────────────────────────────────────
     PREVIEW RENDER (for chip cards, search, etc.)
     ────────────────────────────────────────────── */
  function renderMarkupPreview(text, meta, maxChars) {
    if (!text || typeof text !== 'string') return escapeHtml(text || '');
    const type = detectMarkupType(text, meta);
    if (type === 'text') return '';  // empty means caller should use default plain text

    // For previews, render a truncated version
    const truncated = text.length > (maxChars || 200) ? text.substring(0, maxChars || 200) : text;
    try {
      switch (type) {
        case 'markdown': return renderMarkdown(truncated);
        case 'html':     return renderHTML(truncated, meta);
        case 'json': {
          try {
            const obj = JSON.parse(text.trim());
            const pretty = JSON.stringify(obj, null, 2);
            const short = pretty.substring(0, maxChars || 200);
            return `<pre class="pc-code-block pc-code-preview"><code>${highlightCode(short, 'json')}</code></pre>`;
          } catch (_) {
            return `<pre class="pc-code-block pc-code-preview"><code>${escapeHtml(truncated)}</code></pre>`;
          }
        }
        case 'yaml':
        case 'xml':
        case 'toml':
          return `<pre class="pc-code-block pc-code-preview"><code>${highlightCode(truncated, type === 'toml' ? 'ini' : type)}</code></pre>`;
        case 'code': {
          const match = truncated.match(/^```([\w-]*)\s*\n([\s\S]*)/m);
          const lang = match ? match[1] : '';
          const code = match ? match[2].replace(/\n```\s*$/, '') : truncated;
          return `<pre class="pc-code-block pc-code-preview"><code>${highlightCode(code, lang)}</code></pre>`;
        }
        case 'csv':
        case 'tsv': {
          const lines = truncated.split('\n').slice(0, 3);
          return renderCSV(lines.join('\n'), type === 'tsv' ? '\t' : ',');
        }
        case 'latex':    return renderLaTeX(truncated);
        case 'bbcode':   return renderBBCode(truncated);
        case 'slack':    return renderSlack(truncated);
        case 'asciidoc': return renderAsciiDoc(truncated);
        case 'rst':      return renderRST(truncated);
        case 'orgmode':   return renderOrgMode(truncated);
        case 'mediawiki': return renderMediaWiki(truncated);
        case 'textile':   return renderTextile(truncated);
        case 'jira':      return renderJIRA(truncated);
        case 'mermaid':
          // For preview, just show badge + first line as text (mermaid is async)
          return `<pre class="pc-code-block pc-code-preview"><code>${escapeHtml(truncated)}</code></pre>`;
        default:
          return '';
      }
    } catch (_) {
      return '';
    }
  }

  /* ──────────────────────────────────────────────
     BADGE GENERATOR
     ────────────────────────────────────────────── */
  function getMarkupBadge(type) {
    const badge = BADGE_MAP[type];
    if (!badge) return '';
    return `<span class="pc-markup-badge" style="background:${badge.bg};color:${badge.fg};">${badge.label}</span>`;
  }

  function getMarkupBadgeForClip(text, meta) {
    const type = detectMarkupType(text, meta);
    return getMarkupBadge(type);
  }

  /* ──────────────────────────────────────────────
     EXPOSE API
     ────────────────────────────────────────────── */
  window.PCMarkup = {
    detectMarkupType,
    renderMarkup,
    renderMarkupPreview,
    getMarkupBadge,
    getMarkupBadgeForClip,
    sanitize,
    escapeHtml,
    highlightCode,
  };
})();
