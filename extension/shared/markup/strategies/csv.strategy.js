/**
 * @forward-slice markup
 * Strategy: csv / tsv
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

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

  function renderCSV(text, delimiter) {
    const sep = delimiter || ',';
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return `<pre>${ns.escapeHtml(text)}</pre>`;
    const rows = lines.map(l => parseCSVRow(l, sep));
    let html = '<table class="pc-csv-table"><thead><tr>';
    rows[0].forEach(cell => { html += `<th>${ns.escapeHtml(cell)}</th>`; });
    html += '</tr></thead><tbody>';
    for (let i = 1; i < rows.length; i++) {
      html += '<tr>';
      rows[i].forEach(cell => { html += `<td>${ns.escapeHtml(cell)}</td>`; });
      html += '</tr>';
    }
    html += '</tbody></table>';
    return ns.sanitize(html);
  }

  ns.parseCSVRow = parseCSVRow;
  ns.renderCSV = renderCSV;

  ns.registerStrategy({
    type: 'csv',
    render(text) {
      return renderCSV(text, ',');
    },
    renderPreview(text, _meta, maxChars) {
      const truncated = text.length > (maxChars || 200) ? text.substring(0, maxChars || 200) : text;
      const lines = truncated.split('\n').slice(0, 3);
      return renderCSV(lines.join('\n'), ',');
    },
  });

  ns.registerStrategy({
    type: 'tsv',
    render(text) {
      return renderCSV(text, '\t');
    },
    renderPreview(text, _meta, maxChars) {
      const truncated = text.length > (maxChars || 200) ? text.substring(0, maxChars || 200) : text;
      const lines = truncated.split('\n').slice(0, 3);
      return renderCSV(lines.join('\n'), '\t');
    },
  });
})();
