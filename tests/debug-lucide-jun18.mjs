/**
 * Automated Lucide debug — writes NDJSON to debug-f21b72.log (session f21b72)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const logPath = path.join(root, 'debug-f21b72.log');
const extensionDir = path.join(root, 'extension');

const runId = process.argv[2] || 'auto-pre';

function log(hypothesisId, location, message, data) {
  const line = JSON.stringify({
    sessionId: 'f21b72',
    runId,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  });
  fs.appendFileSync(logPath, line + '\n');
  console.log(`[${hypothesisId}] ${message}`, data);
}

const lucidePath = path.join(extensionDir, 'lib', 'lucide.min.js');
const popupHtml = fs.readFileSync(path.join(extensionDir, 'popup.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(extensionDir, 'manifest.json'), 'utf8'));

const lucideExists = fs.existsSync(lucidePath);
const lucideSize = lucideExists ? fs.statSync(lucidePath).size : 0;
const popupReferencesLucide = popupHtml.includes('lib/lucide.min.js');
const manifestRefsLucide = JSON.stringify(manifest).includes('lucide.min.js');
const placeholderCount = (popupHtml.match(/data-lucide="/g) || []).length;

log('A', 'debug-lucide-jun18.mjs', 'lucide file on disk', {
  lucideExists,
  lucideSize,
  popupReferencesLucide,
  manifestRefsLucide,
  placeholderCount,
});

// Simulate boot: window.lucide undefined when file missing
const simulatedHasLucide = lucideExists && lucideSize > 1000;
log('A', 'debug-lucide-jun18.mjs', 'simulated window.lucide at boot', {
  hasLucide: simulatedHasLucide,
  hasCreateIcons: simulatedHasLucide,
  runLucideOnRootWouldSkip: !simulatedHasLucide,
});

let smokeOk = false;
let smokeError = null;
try {
  execSync('node tests/extension-smoke.test.js', { cwd: root, stdio: 'pipe' });
  smokeOk = true;
} catch (e) {
  smokeError = (e.stderr?.toString() || e.stdout?.toString() || e.message).trim().slice(0, 300);
}
log('A', 'debug-lucide-jun18.mjs', 'extension-smoke result', { smokeOk, smokeError });

// If lucide file present, verify it exports createIcons (UMD global pattern)
if (lucideExists && lucideSize > 1000) {
  const src = fs.readFileSync(lucidePath, 'utf8');
  const hasCreateIcons = src.includes('createIcons');
  log('C', 'debug-lucide-jun18.mjs', 'lucide bundle sanity', { hasCreateIcons, bytes: lucideSize });
}

console.log(`\nLogs written to ${logPath}`);
