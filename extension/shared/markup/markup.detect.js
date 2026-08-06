/**
 * @forward-slice markup
 * Markup type detection (unchanged heuristics).
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;
  const BADGE_MAP = ns.BADGE_MAP;

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

    // 1b. Clipboard KaTeX/MathJax HTML (Unicode plain text has no TeX commands)
    if (meta && typeof meta.html === 'string' && meta.html) {
      const htmlLooksMath =
        /class=["'][^"']*\bkatex\b|katex-html|mjx-container|MathJax|application\/x-tex|math\/tex/i.test(
          meta.html,
        );
      if (htmlLooksMath && !/\\(?:frac|underbrace|begin|sum|int)\b|\$\$/.test(t)) {
        return 'html';
      }
    }

    // 2. JSON
    if ((t[0] === '{' && t[t.length - 1] === '}') || (t[0] === '[' && t[t.length - 1] === ']')) {
      try { JSON.parse(t); return 'json'; } catch (_) { /* not JSON */ }
    }

    // 3. XML
    if (/^<\?xml[\s>]/i.test(t)) return 'xml';

    // 4. LaTeX signals (may yield markdown when mixed with prose — enrich renders both)
    const hasLatex =
      /\\begin\{|\\end\{|\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\\frac\{|\\sqrt\{|\\sum(?:_|\b)|\\int(?:_|\b)|\\prod(?:_|\b)|\\lim(?:_|\b)|\\underbrace\b|\\overbrace\b|\\alpha\b|\\beta\b|\\gamma\b|\\delta\b|\\theta\b|\\lambda\b|\\pi\b|\\sigma\b|\\omega\b|\\infty\b|\\left[(\[]|\\right[)\]]|\\mathbf\{|\\mathrm\{|\\mathbb\{|\\text\{|\\pm\b|\\cdot\b|\\times\b|\\cdots\b|\\ldots\b/i.test(t);

    // 5. Mermaid diagram (pure diagram source)
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

    // 10. Markdown (common patterns) — prefer over pure latex when prose+math mix
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
      // Prose paragraphs around $$ / \( math → markdown + enrich
      if (hasLatex) {
        const lines = t.split('\n').filter((l) => l.trim());
        const prose = lines.filter((l) => {
          const s = l.trim();
          return s && !/^\$\$/.test(s) && !/^\\\[/.test(s) && !/^\\begin\{/.test(s) && !/\\frac\{|\\sqrt\{|\\sum|\\int/.test(s);
        });
        if (prose.length >= 1) mdScore += 2;
      }
      if (mdScore >= 2) return 'markdown';
    }

    if (hasLatex) return 'latex';

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
        const indented = lines.filter(l => /^[ \t]{2,}\S/.test(l)).length;
        if (indented / lines.length >= 0.3) codeScore += 2;
        if (/[{};]\s*$/.test(t) || (t.match(/[{};]\s*$/gm) || []).length >= 2) codeScore++;
        if (/\(\)|\(.*,.*\)/.test(t)) codeScore++;
        if (/\b(?:const|let|var|function|=>|async|await|import\s+\{|export\s+(?:default|const|function|class)|require\(|module\.exports|console\.log)\b/.test(t)) codeScore += 3;
        if (/\b(?:def\s+\w+\(|class\s+\w+[:(]|import\s+\w+|from\s+\w+\s+import|if\s+__name__|print\(|self\.|elif\s|except\s|lambda\s)\b/.test(t)) codeScore += 3;
        if (/\b(?:public\s+(?:static|class|void|int|String)|private\s+\w|protected\s+\w|System\.out|Console\.Write|fun\s+\w+\(|val\s+\w+|var\s+\w+:\s*\w+)\b/.test(t)) codeScore += 3;
        if (/\b(?:#include\s*[<"]|int\s+main\s*\(|printf\s*\(|std::|nullptr|sizeof\s*\(|malloc\s*\(|void\s+\w+\s*\()\b/.test(t)) codeScore += 3;
        if (/\b(?:func\s+\w+\(|package\s+\w+|fmt\.Print|go\s+func|:=\s)/.test(t)) codeScore += 3;
        if (/\b(?:fn\s+\w+|let\s+mut\s|impl\s+\w|pub\s+fn|use\s+\w+::|println!\(|match\s+\w+\s*\{)/.test(t)) codeScore += 3;
        if (/\b(?:def\s+\w+|end$|puts\s|require\s+['"]|attr_accessor|class\s+\w+\s*<)/.test(t) && /\bend\b/m.test(t)) codeScore += 3;
        if (/\b(?:<\?php|\$\w+\s*=|function\s+\w+\s*\(|echo\s|->|namespace\s+\w)/.test(t)) codeScore += 3;
        if (/\b(?:func\s+\w+|var\s+\w+:\s*\w|let\s+\w+:\s*\w|guard\s+let|import\s+(?:UIKit|Foundation|SwiftUI))/.test(t)) codeScore += 3;
        if (/\b(?:SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|WHERE\s+\w+|JOIN\s+\w+|GROUP\s+BY)\b/i.test(t)) codeScore += 3;
        if (/^(?:#!\/bin\/(?:bash|sh|zsh)|(?:if|then|fi|do|done|for|while|case|esac)\b)/m.test(t) || /\b(?:echo\s|chmod\s|mkdir\s|grep\s|awk\s|sed\s|curl\s|apt\s|npm\s|pip\s)/m.test(t)) codeScore += 2;
        if (/\/\/\s*\w|\/\*[\s\S]*?\*\/|#\s+\w.*\n.*(?:def |class |import )/.test(t)) codeScore++;
        if (/\b(?:return\s|throw\s|try\s*\{|catch\s*\(|if\s*\(|else\s*\{|while\s*\(|for\s*\(|switch\s*\()/.test(t)) codeScore += 2;
        if (codeScore >= 5) return 'code';
      }
    }

    return 'text';
  }

  ns.detectMarkupType = detectMarkupType;
})();
