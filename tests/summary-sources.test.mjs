import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(join(__dirname, '..', 'extension/shared/summary-sources.js')).href;
const {
  applyCitationMarkup,
  attachSourceLabels,
  collectSummarySources,
  ensureCitationMarkers,
  ensureSummarySources,
  getHistoryEntrySources,
  hasSourcesSection,
  mergeSummarySources,
  parseSourceLabels,
  renderSourcesPanelHtml,
  resolveSourcesForDisplay,
} = await import(url);

const labeled = '[Source: Whirligig World | https://example.edu/mission-of-gravity]\nHal Clement essay.';
const modelBody = 'Purpose: explain the novel Mission of Gravity.';
const clipSources = [{ title: 'Whirligig World', url: 'https://example.edu/mission-of-gravity' }];

const alreadyCited = `${modelBody}\n\n## Sources\n- "Whirligig World" — https://example.edu/mission-of-gravity`;
assert.equal(hasSourcesSection(alreadyCited), true);
assert.equal(ensureSummarySources(alreadyCited, labeled).includes('## Sources'), true);
assert.equal(ensureSummarySources(alreadyCited, labeled).split('## Sources').length, 2);

const appended = ensureSummarySources(modelBody, labeled);
assert.match(appended, /Purpose: explain/);
assert.match(appended, /## Sources/);
assert.match(appended, /Whirligig World/);
assert.match(appended, /https:\/\/example\.edu\/mission-of-gravity/);
assert.equal(appended.split('## Sources').length, 2);

const fromClipMeta = ensureSummarySources(modelBody, 'Essay with no source line in the Summary field.', clipSources);
assert.match(fromClipMeta, /## Sources/);
assert.match(fromClipMeta, /https:\/\/example\.edu\/mission-of-gravity/);
assert.match(fromClipMeta, /\[1\]/);

const noDuplicate = ensureSummarySources(alreadyCited, 'Essay with no source line.', clipSources);
assert.equal(noDuplicate.split('## Sources').length, 2);

const plain = ensureSummarySources(modelBody, 'Manual paste with no clip metadata.');
assert.equal(hasSourcesSection(plain), false);
assert.equal(parseSourceLabels('Manual paste with no clip metadata.').length, 0);
assert.equal(collectSummarySources('Manual paste with no clip metadata.').length, 0);
assert.equal(mergeSummarySources([], 'Manual paste with no clip metadata.').length, 0);

const noInvent = ensureSummarySources(modelBody, '[Source: Encyclopedia article]');
assert.match(noInvent, /## Sources/);
assert.match(noInvent, /Encyclopedia article/);
assert.equal(/https?:\/\//.test(noInvent), false);

const rejected = ensureSummarySources(modelBody, '[Source: Bad | javascript:alert(1)]');
assert.match(rejected, /## Sources/);
assert.equal(rejected.includes('javascript:'), false);

const fromLooseUrl = ensureSummarySources(modelBody, 'See https://example.edu/whirligig-world for the essay.');
assert.match(fromLooseUrl, /## Sources/);
assert.match(fromLooseUrl, /https:\/\/example\.edu\/whirligig-world/);

const display = resolveSourcesForDisplay(modelBody, 'No [Source:] in the textarea.', clipSources);
assert.equal(display.sources.length, 1);
assert.equal(display.sources[0].title, 'Whirligig World');
assert.match(display.sources[0].url, /mission-of-gravity/);
assert.match(display.body, /\[1\]/);

const panel = renderSourcesPanelHtml(display.sources);
assert.match(panel, /class="pc-ai-sources"/);
assert.match(panel, />Sources</);
assert.match(panel, /Whirligig World/);
assert.match(panel, /href="https:\/\/example\.edu\/mission-of-gravity"/);
assert.match(panel, /data-cite-card="1"/);
assert.match(panel, /example\.edu/);
assert.equal(renderSourcesPanelHtml([]), '');

const citedHtml = applyCitationMarkup('Claim [1] follows.', display.sources);
assert.match(citedHtml, /data-action="ai-cite"/);
assert.match(citedHtml, /data-cite="1"/);
assert.equal(applyCitationMarkup('Claim [9] is unknown.', display.sources), 'Claim [9] is unknown.');

const marked = ensureCitationMarkers('A claim about gravity.', clipSources);
assert.equal(marked.endsWith('[1]'), true);
assert.equal(ensureCitationMarkers('Already cited [1].', clipSources), 'Already cited [1].');

const requestText = attachSourceLabels('Essay body only.', clipSources);
assert.match(requestText, /\[Source: Whirligig World \| https:\/\/example\.edu\/mission-of-gravity\]/);
assert.match(requestText, /Essay body only/);
assert.equal(attachSourceLabels(labeled, clipSources), labeled);

const historySources = getHistoryEntrySources({
  threads: [{ sources: clipSources }],
});
assert.equal(historySources.length, 1);
assert.equal(historySources[0].url, clipSources[0].url);

const serverSources = [{ title: 'Cursor Docs', url: 'https://cursor.com/docs', domain: 'cursor.com' }];
const fromServer = resolveSourcesForDisplay(
  modelBody,
  'Potential Benefits and Drawbacks of Using Cursor AI',
  serverSources,
);
assert.equal(fromServer.sources.length, 1);
assert.equal(fromServer.sources[0].url, 'https://cursor.com/docs');
assert.match(fromServer.body, /\[1\]/);
assert.match(renderSourcesPanelHtml(fromServer.sources), /cursor\.com/);

const invented = ensureSummarySources(
  `${modelBody}\n\n## Sources\n- Wikipedia — https://en.wikipedia.org/wiki/Cursor_(code_editor)`,
  'Potential Benefits and Drawbacks of Using Cursor AI',
);
assert.equal(hasSourcesSection(invented), false);
assert.equal(/wikipedia/i.test(invented), false);
assert.equal(resolveSourcesForDisplay(invented, 'typed topic only').sources.length, 0);
assert.equal(renderSourcesPanelHtml([]), '');

const clipPlusServer = mergeSummarySources(clipSources, clipSources, serverSources);
assert.equal(clipPlusServer.length, 2);
assert.equal(ensureSummarySources(alreadyCited, labeled, clipSources).split('## Sources').length, 2);

console.log('summary-sources.test.mjs ok');
