/**
 * Splits extension/background.js into background/* ES modules
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const srcPath = path.join(root, 'extension', 'background.js');
const bgDir = path.join(root, 'extension', 'background');

const lines = fs.readFileSync(srcPath, 'utf8').split(/\r?\n/);

const extMsgStart = lines.findIndex((l) => l.includes('// EXTERNAL MESSAGE LISTENER'));
const intMsgStart = lines.findIndex((l) => l.includes('// INTERNAL MESSAGE LISTENER'));

if (extMsgStart < 0 || intMsgStart < 0) throw new Error('listener markers not found');

let shared = lines.slice(0, extMsgStart).join('\n');
shared = shared.replace(/^function /gm, 'export function ');
shared = shared.replace(/^async function /gm, 'export async function ');

const externalBlock = lines.slice(extMsgStart, intMsgStart).join('\n');
const internalBlock = lines.slice(intMsgStart).join('\n');

fs.mkdirSync(path.join(bgDir, 'handlers'), { recursive: true });
fs.writeFileSync(path.join(bgDir, 'shared.js'), `${shared}\n`);

fs.writeFileSync(
  path.join(bgDir, 'handlers', 'messages-external.js'),
  `${externalBlock}\n`
);

fs.writeFileSync(
  path.join(bgDir, 'handlers', 'messages-internal.js'),
  `import {
  normalizeArray,
  safeTabsSendMessage,
  getExtensionPageUrl,
  saveTextDirectly,
  getQuickViewClips,
} from '../shared.js';

${internalBlock}
`
);

const sw = `import './handlers/messages-external.js';
import './handlers/messages-internal.js';
`;

fs.writeFileSync(path.join(bgDir, 'service-worker.js'), sw);

fs.writeFileSync(
  srcPath,
  `// Backward-compat background entry (manifest)\nimport './background/service-worker.js';\n`
);

console.log('Background split OK');
