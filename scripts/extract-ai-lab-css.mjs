import fs from 'fs';

const popupPath = 'extension/popup.html';
const html = fs.readFileSync(popupPath, 'utf8');
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) throw new Error('no style block');
const lines = styleMatch[1].split('\n');

function extractRange(startMarker, endBeforeMarker) {
  const start = lines.findIndex((l) => l.includes(startMarker));
  if (start === -1) throw new Error(`start not found: ${startMarker}`);
  const end = endBeforeMarker
    ? lines.findIndex((l, i) => i > start && l.includes(endBeforeMarker))
    : lines.length;
  return lines.slice(start, end === -1 ? lines.length : end).map((l) => {
    if (l.includes('/* ============================================')) return l.replace(/^        /, '');
    return l.replace(/^        /, '');
  });
}

function dedent(block) {
  return block.map((l) => l.replace(/^        /, '')).join('\n');
}

const block1 = extractRange('AI LAB STYLES', 'Magic Preview Modal');
const block2 = extractRange('AI Breakdown Page V2 Styles', '.files-section');

const stylesCss = fs.readFileSync('extension/styles.css', 'utf8');
const followupStart = stylesCss.indexOf('/* AI Follow-up Conversation Styles */');
const clipViewerStart = stylesCss.indexOf(
  '/* ============================================\n   Clip Viewer'
);
const followupBlock = stylesCss.slice(followupStart, clipViewerStart).trim();

const headerStart = stylesCss.indexOf('.breakdown-header-content h3');
const headerEnd = stylesCss.indexOf('.breakdown-italics-btn,', headerStart);
const headerBlock = stylesCss.slice(headerStart, headerEnd).trim();

let css = `/**
 * PasteCraft AI Lab Tab — Phase 8
 * #aiTab: summary, breakdown, refactorization, credits, gallery.
 * Requires tokens.css + primitives.css loaded first.
 */

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

${headerBlock}

${dedent(block1)}

${dedent(block2)}

${followupBlock}
`;

// Fix missing brace before out-of-credits card
css = css.replace(
  /(\.ai-lab-credit-custom-buy:disabled \{[\s\S]*?cursor: not-allowed;)\s*\n\s*(\/\* ── Out-of-credits)/,
  '$1\n}\n\n$2'
);
// Remove stray closing brace after credit-banner-pulse
css = css.replace(
  /(\.ai-credit-pack-highlight \{[\s\S]*?animation: credit-banner-pulse[^}]+\})\s*\}/,
  '$1'
);

const tokenMap = [
  [/#ffffff\b/gi, 'var(--pc-bg)'],
  [/#fff\b/gi, 'var(--pc-bg)'],
  [/#f8fafc\b/g, 'var(--pc-surface)'],
  [/#fafbfc\b/g, 'var(--pc-surface)'],
  [/#f1f5f9\b/g, 'var(--pc-surface-2)'],
  [/#e5e7eb\b/g, 'var(--pc-border)'],
  [/#e2e8f0\b/g, 'var(--pc-border)'],
  [/#cbd5e1\b/g, 'var(--pc-text-soft)'],
  [/#94a3b8\b/g, 'var(--pc-text-soft)'],
  [/#64748b\b/g, 'var(--pc-text-muted)'],
  [/#6b7280\b/g, 'var(--pc-text-muted)'],
  [/#374151\b/g, 'var(--pc-text)'],
  [/#1f2937\b/g, 'var(--pc-text)'],
  [/#1e293b\b/g, 'var(--pc-text)'],
  [/#0f172a\b/g, 'var(--pc-primary-900)'],
  [/#3b82f6\b/g, 'var(--pc-secondary-400)'],
  [/#2563eb\b/g, 'var(--pc-secondary-500)'],
  [/#1d4ed8\b/g, 'var(--pc-primary-500)'],
  [/#1e40af\b/g, 'var(--pc-primary-500)'],
  [/#1e3a8a\b/g, 'var(--pc-primary-600)'],
  [/#1a1f5e\b/g, 'var(--pc-primary-700)'],
  [/#eff6ff\b/g, 'var(--pc-secondary-50)'],
  [/#f0f9ff\b/g, 'var(--pc-secondary-50)'],
  [/#dbeafe\b/g, 'var(--pc-secondary-100)'],
  [/#bfdbfe\b/g, 'var(--pc-secondary-200)'],
  [/#93c5fd\b/g, 'var(--pc-secondary-200)'],
  [/#60a5fa\b/g, 'var(--pc-secondary-300)'],
  [/#ef4444\b/g, 'var(--pc-error)'],
  [/#dc2626\b/g, 'var(--pc-error-dark)'],
  [
    /linear-gradient\(135deg, var\(--pc-secondary-400\) 0%, var\(--pc-secondary-500\) 100%\)/g,
    'var(--pc-gradient-brand-soft)',
  ],
  [
    /linear-gradient\(135deg, var\(--pc-secondary-500\) 0%, var\(--pc-primary-500\) 100%\)/g,
    'var(--pc-gradient-brand-soft)',
  ],
  [
    /linear-gradient\(135deg, #faf5ff 0%, #f5f3ff 100%\)/g,
    'linear-gradient(135deg, var(--pc-secondary-50) 0%, var(--pc-surface) 100%)',
  ],
  [/border: 2px solid #e9d5ff/g, 'border: 2px solid var(--pc-secondary-200)'],
  [/border-color: #c4b5fd/g, 'border-color: var(--pc-secondary-200)'],
  [/background: #faf5ff/g, 'background: var(--pc-secondary-50)'],
  [/background: #f5f3ff/g, 'background: var(--pc-secondary-50)'],
  [/border: 1px solid #e9d5ff/g, 'border: 1px solid var(--pc-secondary-200)'],
  [/border: 1.5px solid #e9d5ff/g, 'border: 1.5px solid var(--pc-secondary-200)'],
  [/color: #5b21b6/g, 'color: var(--pc-primary-600)'],
  [
    /border: 1px solid rgba\(139, 92, 246, 0\.35\)/g,
    'border: 1px solid rgba(37, 99, 235, 0.35)',
  ],
  [
    /box-shadow: 0 6px 16px rgba\(139, 92, 246, 0\.4\)/g,
    'box-shadow: var(--pc-shadow-brand)',
  ],
];

for (const [re, rep] of tokenMap) css = css.replace(re, rep);

fs.writeFileSync('extension/assets/styles/ai-lab.css', css);
console.log(`Wrote ai-lab.css (${css.split('\n').length} lines)`);
