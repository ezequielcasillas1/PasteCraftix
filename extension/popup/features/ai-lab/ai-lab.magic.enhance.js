// @forward-slice AI Lab magic — content enhancement
export function _enhanceContent(text, contentType) {
  if (!text) return text;
  const cleaned = _normalizeWhitespace(text);
  return _applyTypeEnhancement(cleaned, contentType);
}

function _normalizeWhitespace(text) {
  let result = text.replace(/\r\n/g, '\n');
  result = result.replace(/\n{4,}/g, '\n\n\n');
  result = result.replace(/[ \t]+$/gm, '');
  return result.trim();
}

function _enhanceUrl(text) {
  try {
    const url = new URL(text);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid']
      .forEach(p => url.searchParams.delete(p));
    return url.toString();
  } catch (_) {
    return text;
  }
}

function _enhanceJson(text) {
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch (_) { return text; }
}

function _enhanceXml(text) {
  return text.replace(/\s*\/>/g, ' />');
}

function _enhanceYamlToml(text) {
  return text.endsWith('\n') ? text : text + '\n';
}

function _enhanceCsvTsv(text) {
  return text.split('\n').filter(l => l.trim()).join('\n');
}

function _enhanceEmail(text) {
  return text.toLowerCase().trim();
}

const TYPE_ENHANCERS = {
  url: _enhanceUrl,
  json: _enhanceJson,
  xml: _enhanceXml,
  yaml: _enhanceYamlToml,
  toml: _enhanceYamlToml,
  csv: _enhanceCsvTsv,
  tsv: _enhanceCsvTsv,
  email: _enhanceEmail,
};

function _applyTypeEnhancement(text, contentType) {
  const enhancer = TYPE_ENHANCERS[contentType];
  return enhancer ? enhancer(text) : text;
}
