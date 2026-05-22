/**
 * Splits extension/content-script.js into extension/content/*
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const srcPath = path.join(root, 'extension', 'content-script.js');
const contentDir = path.join(root, 'extension', 'content');

const lines = fs.readFileSync(srcPath, 'utf8').split(/\r?\n/);

const qpStart = lines.findIndex((l) => l.startsWith('class QuickPasteInterface'));
const widgetStart = lines.findIndex((l) => l.startsWith('class PasteCraftFloatingWidget'));
const bootStart = lines.findIndex((l) => l.includes('// Initialize Quick Paste when DOM is ready'));

if (qpStart < 0 || widgetStart < 0 || bootStart < 0) {
  throw new Error(`markers not found: qp=${qpStart} widget=${widgetStart} boot=${bootStart}`);
}

const shared = lines.slice(0, qpStart).join('\n');
const qpClass = lines.slice(qpStart, widgetStart).join('\n');
const widgetClass = lines.slice(widgetStart, bootStart).join('\n');
const boot = lines.slice(bootStart).join('\n');

fs.mkdirSync(path.join(contentDir, 'quick-paste'), { recursive: true });
fs.mkdirSync(path.join(contentDir, 'widget'), { recursive: true });

fs.writeFileSync(
  path.join(contentDir, 'shared.js'),
  `${shared}\n\nexport { safeRuntimeSendMessage, pastecraftGetURL, PASTECRAFT_PAGE_ORIGIN };\n`
);

fs.writeFileSync(
  path.join(contentDir, 'quick-paste', 'quick-paste.js'),
  `import { safeRuntimeSendMessage, pastecraftGetURL, PASTECRAFT_PAGE_ORIGIN } from '../shared.js';\n\nexport ${qpClass.replace(/^class /, 'class ')}\n`
);

fs.writeFileSync(
  path.join(contentDir, 'widget', 'widget.js'),
  `import { safeRuntimeSendMessage, pastecraftGetURL, PASTECRAFT_PAGE_ORIGIN } from '../shared.js';\n\nexport ${widgetClass.replace(/^class /, 'class ')}\n`
);

const entry = `import { QuickPasteInterface } from './quick-paste/quick-paste.js';
import { PasteCraftFloatingWidget } from './widget/widget.js';

${boot}
`;

fs.writeFileSync(path.join(contentDir, 'content.js'), entry);

const barrel = `// Backward-compat content script entry (manifest)
import './content/content.js';
`;

fs.writeFileSync(srcPath, barrel);

console.log('Content split OK:', {
  shared: qpStart,
  quickPaste: widgetStart - qpStart,
  widget: bootStart - widgetStart,
  boot: lines.length - bootStart,
});
