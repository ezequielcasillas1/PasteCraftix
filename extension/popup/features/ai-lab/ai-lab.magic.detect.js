// @forward-slice AI Lab magic — content type detection
export function _magicTypeLabels() {
  return {
    url: '🔗 Link', email: '📧 Email', phone: '📞 Phone', note: '📝 Note', text: '⚡ Text',
    code: '💻 Code', json: '📊 JSON', yaml: '📊 YAML', toml: '📊 TOML', xml: '📊 XML', csv: '📊 CSV', tsv: '📊 TSV',
    markdown: '📄 MD', html: '📄 HTML', latex: '📄 LaTeX', bbcode: '📄 BBCode',
    asciidoc: '📄 ADoc', rst: '📄 rST', orgmode: '📄 Org', mediawiki: '📄 Wiki',
    textile: '📄 Textile', jira: '📄 JIRA', slack: '📄 Slack', mermaid: '📐 Diagram',
  };
}

export function _skipAiFormatTypes() {
  return new Set(['url', 'email', 'phone', 'code', 'json', 'yaml', 'toml', 'xml', 'csv', 'tsv', 'html', 'latex', 'mermaid']);
}

const CATEGORY_SUGGESTION_MAP = {
  url:       { name: 'Links', icon: '🔗' },
  email:     { name: 'Contacts', icon: '📧' },
  phone:     { name: 'Contacts', icon: '📧' },
  note:      { name: 'Notes', icon: '📝' },
  text:      { name: 'Quick', icon: '⚡' },
  code:      { name: 'Code', icon: '💻' },
  json:      { name: 'Data', icon: '📊' },
  yaml:      { name: 'Data', icon: '📊' },
  toml:      { name: 'Data', icon: '📊' },
  xml:       { name: 'Data', icon: '📊' },
  csv:       { name: 'Data', icon: '📊' },
  tsv:       { name: 'Data', icon: '📊' },
  markdown:  { name: 'Markup', icon: '📄' },
  html:      { name: 'Markup', icon: '📄' },
  latex:     { name: 'Markup', icon: '📄' },
  bbcode:    { name: 'Markup', icon: '📄' },
  asciidoc:  { name: 'Markup', icon: '📄' },
  rst:       { name: 'Markup', icon: '📄' },
  orgmode:   { name: 'Markup', icon: '📄' },
  mediawiki: { name: 'Markup', icon: '📄' },
  textile:   { name: 'Markup', icon: '📄' },
  jira:      { name: 'Markup', icon: '📄' },
  slack:     { name: 'Markup', icon: '📄' },
  mermaid:   { name: 'Diagrams', icon: '📐' },
};

export function _suggestCategory(contentType) {
  return CATEGORY_SUGGESTION_MAP[contentType] || CATEGORY_SUGGESTION_MAP.text;
}

// ────────────────────────────────────────────────────────────
// Content type detection (decomposed from cc=14)
// ────────────────────────────────────────────────────────────

export function _detectContentType(text, meta) {
  if (!text || typeof text !== 'string') return 'text';
  const trimmed = text.trim();

  const simpleType = _detectSimpleContentType(trimmed);
  if (simpleType) return simpleType;

  const markupType = _detectMarkupContentType(trimmed, meta);
  if (markupType) return markupType;

  return _detectFallbackContentType(trimmed);
}

function _detectSimpleContentType(trimmed) {
  if (/^https?:\/\/\S+$/i.test(trimmed) || /^www\.\S+\.\S+/i.test(trimmed)) return 'url';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'email';
  if (/^[\+]?[\d\s\-\(\)\.]{7,20}$/.test(trimmed) && /\d{3,}/.test(trimmed)) return 'phone';
  return null;
}

function _detectMarkupContentType(trimmed, meta) {
  if (!window.PCMarkup || typeof window.PCMarkup.detectMarkupType !== 'function') return null;
  const markupType = window.PCMarkup.detectMarkupType(trimmed, meta);
  if (markupType && markupType !== 'text') return markupType;
  return null;
}

function _detectFallbackContentType(trimmed) {
  if (trimmed.split('\n').length > 3 || trimmed.length > 300) return 'note';
  return 'text';
}
