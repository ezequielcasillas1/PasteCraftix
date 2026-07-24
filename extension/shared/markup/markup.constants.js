/**
 * @forward-slice markup
 * Badge config: type → { label, color }
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  ns.BADGE_MAP = {
    markdown: { label: 'MD', bg: '#3b82f6', fg: '#fff' },
    html:     { label: 'HTML', bg: '#e34c26', fg: '#fff' },
    json:     { label: 'JSON', bg: '#f59e0b', fg: '#fff' },
    yaml:     { label: 'YAML', bg: '#cb171e', fg: '#fff' },
    xml:      { label: 'XML', bg: '#f97316', fg: '#fff' },
    toml:     { label: 'TOML', bg: '#9d4edd', fg: '#fff' },
    csv:      { label: 'CSV', bg: '#2563eb', fg: '#fff' },
    tsv:      { label: 'TSV', bg: '#2563eb', fg: '#fff' },
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
    code:       { label: 'Code', bg: '#1e293b', fg: '#93c5fd' },
    text:       null, // no badge for plain text
  };
})();
