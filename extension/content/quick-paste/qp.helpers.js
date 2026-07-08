/** @forward-slice — pure Quick Paste helpers (no DOM/state). */

export function clipIdKey(id) {
  return String(id);
}

export function fnv1a36(str) {
  const s = String(str || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function getTimeAgo(timestamp) {
  if (!timestamp) return 'Unknown';

  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Lightweight markup type detector for Quick Paste badges (no heavy libs). */
export function detectQuickBadge(text) {
  if (!text || typeof text !== 'string') return '';
  const t = text.trim();
  if (!t) return '';
  const badgeStyle = 'display:inline-block;font-size:9px;font-weight:700;padding:1px 4px;border-radius:3px;margin-right:4px;vertical-align:middle;line-height:1;';
  // JSON
  if ((t[0] === '{' || t[0] === '[') && (t[t.length - 1] === '}' || t[t.length - 1] === ']')) {
    try { JSON.parse(t); return `<span style="${badgeStyle}background:#f59e0b;color:#fff;">JSON</span>`; } catch (_) {}
  }
  // XML
  if (/^<\?xml/i.test(t)) return `<span style="${badgeStyle}background:#f97316;color:#fff;">XML</span>`;
  // LaTeX
  if (/\\begin\{|\\frac\{|\$\$.+\$\$/s.test(t)) return `<span style="${badgeStyle}background:#008080;color:#fff;">LaTeX</span>`;
  // Markdown
  if (/^#{1,6}\s/m.test(t) || (/\*\*[^*]+\*\*/m.test(t) && /^[-*+]\s/m.test(t))) return `<span style="${badgeStyle}background:#3b82f6;color:#fff;">MD</span>`;
  // HTML tags
  if (/<(?:div|p|table|ul|ol|h[1-6])[^>]*>/i.test(t)) return `<span style="${badgeStyle}background:#e34c26;color:#fff;">HTML</span>`;
  // YAML
  if (/^---\s*\n/.test(t)) return `<span style="${badgeStyle}background:#cb171e;color:#fff;">YAML</span>`;
  // Code block
  if (/^```[\w-]*\s*\n/m.test(t)) return `<span style="${badgeStyle}background:#1e293b;color:#2563eb;">Code</span>`;
  // MediaWiki
  if (/^={2,5}\s*.+?\s*={2,5}\s*$/m.test(t) && /\[\[.+?\]\]/.test(t)) return `<span style="${badgeStyle}background:#006699;color:#fff;">Wiki</span>`;
  // Textile
  if (/^h[1-6]\.\s/m.test(t) && (/\*[^*]+\*/.test(t) || /_[^_]+_/.test(t))) return `<span style="${badgeStyle}background:#c7254e;color:#fff;">Textile</span>`;
  // JIRA/Confluence
  if (/\{code(?::[^}]*)?\}/i.test(t) || (/^h[1-6]\.\s/m.test(t) && /\{[a-z]+\}/i.test(t))) return `<span style="${badgeStyle}background:#0052cc;color:#fff;">JIRA</span>`;
  // Raw unfenced code (lightweight check for Quick Paste)
  if (t.split('\n').length >= 3) {
    let cs = 0;
    if (/\b(?:const|let|var|function|=>|import\s+\{|export\s|require\(|console\.log)\b/.test(t)) cs += 3;
    if (/\b(?:def\s+\w+\(|class\s+\w+[:(]|from\s+\w+\s+import|print\(|self\.)\b/.test(t)) cs += 3;
    if (/\b(?:public\s+(?:static|class|void)|#include\s*[<"]|int\s+main\s*\(|func\s+\w+\(|fn\s+\w+)\b/.test(t)) cs += 3;
    if (/\b(?:return\s|if\s*\(|for\s*\(|while\s*\()\b/.test(t)) cs += 2;
    if (/[{};]\s*$/m.test(t)) cs++;
    if (cs >= 5) return `<span style="${badgeStyle}background:#1e293b;color:#2563eb;">Code</span>`;
  }
  return '';
}

/** Light inline formatting for Quick Paste previews (bold, code, headers via regex). */
export function lightFormatPreview(text) {
  if (!text || typeof text !== 'string') return '';
  let html = escapeHtml(text);
  // Bold **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  // Inline code `text`
  html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.06);padding:0 3px;border-radius:3px;font-size:0.9em;">$1</code>');
  // Markdown heading (# at start)
  html = html.replace(/^(#{1,3})\s+(.+)/m, (_, hashes, title) => `<b>${title}</b>`);
  return html;
}
