/**
 * @forward-slice markup
 * Canonical classic-script load order for PCMarkup modules.
 * Consumed by tests / docs; popup.html lists the same paths.
 */
(() => {
  'use strict';

  const root = typeof window !== 'undefined' ? window : globalThis;
  root.__PCMarkupLoadOrder = [
    'shared/markup/markup.ns.js',
    'shared/markup/markup.constants.js',
    'shared/markup/markup.sanitize.js',
    'shared/markup/markup.detect.js',
    'shared/markup/strategies/markdown.strategy.js',
    'shared/markup/strategies/html.strategy.js',
    'shared/markup/strategies/json.strategy.js',
    'shared/markup/strategies/yaml.strategy.js',
    'shared/markup/strategies/xml.strategy.js',
    'shared/markup/strategies/toml.strategy.js',
    'shared/markup/strategies/csv.strategy.js',
    'shared/markup/strategies/latex.strategy.js',
    'shared/markup/strategies/mermaid.strategy.js',
    'shared/markup/strategies/bbcode.strategy.js',
    'shared/markup/strategies/slack.strategy.js',
    'shared/markup/strategies/code.strategy.js',
    'shared/markup/strategies/asciidoc.strategy.js',
    'shared/markup/strategies/rst.strategy.js',
    'shared/markup/strategies/orgmode.strategy.js',
    'shared/markup/strategies/mediawiki.strategy.js',
    'shared/markup/strategies/textile.strategy.js',
    'shared/markup/strategies/jira.strategy.js',
    'shared/markup/strategies/text.strategy.js',
    'shared/markup/markup.enrich.js',
    'shared/markup/markup.render.js',
    'shared/markup/markup.badge.js',
    'shared/markup/markup.api.js',
    'markup-renderer.js',
  ];
})();
