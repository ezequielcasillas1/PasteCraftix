import {
  resolveClipboardMarkupText,
  extractTexExpressionsFromHtml,
  looksLikeLatexSource,
  looksLikeRenderedMathPlain,
} from './clipboard-markup.js';

const html =
  '<span class="katex"><span class="katex-mathml"><math><annotation encoding="application/x-tex">' +
  'a^{n}=\\underbrace{a\\cdot a\\cdot a\\cdots a}_{n\\text{ times}}' +
  '</annotation></math></span><span class="katex-html">ignored</span></span>';

const texes = extractTexExpressionsFromHtml(html);
console.assert(texes.length === 1, 'expected 1 tex');
console.assert(texes[0].includes('\\underbrace'), 'expected underbrace');

const unicodeDump = 'an=\na·a·a····a\n⏟ ⏟ ⏟\nn times';
console.assert(looksLikeRenderedMathPlain(unicodeDump), 'unicode dump detected');
console.assert(!looksLikeLatexSource(unicodeDump), 'unicode is not latex source');

const resolved = resolveClipboardMarkupText(unicodeDump, html);
console.assert(resolved.usedHtmlTex === true, 'should recover tex from html');
console.assert(resolved.text.includes('\\underbrace'), 'body has underbrace');
console.assert(
  resolved.markupHint === 'latex' || resolved.markupHint === 'markdown',
  'hint latex or markdown',
);

const fromDom = resolveClipboardMarkupText(unicodeDump, '', {
  domTexes: ['a^{n}=\\underbrace{a\\cdot a\\cdot a\\cdots a}_{n\\text{ times}}'],
});
console.assert(fromDom.usedHtmlTex === true, 'dom tex recovery');
console.assert(fromDom.text.includes('\\underbrace'), 'dom body has underbrace');

const htmlOnly =
  '<span class="katex"><span class="katex-html"><span class="mord">a</span></span></span>';
const htmlFallback = resolveClipboardMarkupText(unicodeDump, htmlOnly);
console.assert(htmlFallback.markupHint === 'html', 'html fallback hint');
console.assert(!!htmlFallback.mathHtml, 'mathHtml fragment set');

const { preferTopLevelTexExpressions } = await import('./clipboard-markup.js');
const collapsed = preferTopLevelTexExpressions(['a', 'n', 'a^n', '{a^n} = \\underbrace{a}_{n}']);
console.assert(collapsed.length === 1, 'keep only maximal tex');
console.assert(collapsed[0].includes('underbrace'), 'keep full formula');

console.log('clipboard-markup tests passed');
