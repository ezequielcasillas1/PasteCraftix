/**
 * Splits extension/supabase-client.js into extension/supabase/* mixins.
 * Run: node scripts/split-supabase-client.mjs
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const srcPath = path.join(root, 'extension', 'supabase-client.js');
const outDir = path.join(root, 'extension', 'supabase');

const SLICES = [
  { file: 'ai-workflow.js', export: 'aiWorkflowMixin', start: /^\s*\/\/ AI WORKFLOW/, end: /^\s*\/\/ NETWORK HELPERS/ },
  { file: 'core.js', export: 'coreMixin', start: /^\s*\/\/ NETWORK HELPERS/, end: /^\s*\/\/ SUBSCRIPTION CACHE/ },
  { file: 'subscription.js', export: 'subscriptionMixin', start: /^\s*\/\/ SUBSCRIPTION CACHE/, end: /^\s*\/\/ AUTH SESSION BRIDGE/ },
  { file: 'auth-bridge.js', export: 'authBridgeMixin', start: /^\s*\/\/ AUTH SESSION BRIDGE/, end: /^\s*\/\/ CONNECTION & OFFLINE/ },
  { file: 'sync-queue.js', export: 'syncQueueMixin', start: /^\s*\/\/ CONNECTION & OFFLINE/, end: /^\s*\/\/ REALTIME SUBSCRIPTIONS/ },
  { file: 'realtime.js', export: 'realtimeMixin', start: /^\s*\/\/ REALTIME SUBSCRIPTIONS/, end: /^\s*\/\/ PROFILE IMAGE URL NORMALIZATION/ },
  { file: 'profile-images.js', export: 'profileImagesMixin', start: /^\s*\/\/ PROFILE IMAGE URL NORMALIZATION/, end: /^\s*\/\/ OpenAI Integration Methods/ },
  { file: 'ai-functions.js', export: 'aiFunctionsMixin', start: /^\s*\/\/ OpenAI Integration Methods/, end: /^\s*\/\/ REAL-TIME DATA SYNC METHODS/ },
  { file: 'identity.js', export: 'identityMixin', start: /^\s*\/\/ REAL-TIME DATA SYNC METHODS/, end: /^\s*\/\/ CLIPS SYNC METHODS/ },
  { file: 'sync-clips.js', export: 'syncClipsMixin', start: /^\s*\/\/ CLIPS SYNC METHODS/, end: /^\s*\/\/ CATEGORIES SYNC METHODS/ },
  { file: 'sync-categories.js', export: 'syncCategoriesMixin', start: /^\s*\/\/ CATEGORIES SYNC METHODS/, end: /^\s*\/\/ ARCHIVED CLIPS SYNC METHODS/ },
  { file: 'sync-archived.js', export: 'syncArchivedMixin', start: /^\s*\/\/ ARCHIVED CLIPS SYNC METHODS/, end: /^\s*\/\/ NOTES SYNC METHODS/ },
  { file: 'sync-notes.js', export: 'syncNotesMixin', start: /^\s*\/\/ NOTES SYNC METHODS/, end: /^\s*\/\/ SETTINGS SYNC METHODS/ },
  { file: 'sync-settings.js', export: 'syncSettingsMixin', start: /^\s*\/\/ SETTINGS SYNC METHODS/, end: /^\s*\/\/ AI HISTORY SYNC METHODS/ },
  { file: 'ai-history-sync.js', export: 'aiHistorySyncMixin', start: /^\s*\/\/ AI HISTORY SYNC METHODS/, end: /^\s*\/\/ USER PROFILE SYNC METHODS/ },
  { file: 'profile-sync.js', export: 'profileSyncMixin', start: /^\s*\/\/ USER PROFILE SYNC METHODS/, end: /^\s*\/\/ AUTHENTICATION METHODS/ },
  { file: 'auth.js', export: 'authMixin', start: /^\s*\/\/ AUTHENTICATION METHODS/, end: /^\s*\/\/ FULL SYNC METHOD/ },
  { file: 'full-sync.js', export: 'fullSyncMixin', start: /^\s*\/\/ FULL SYNC METHOD/, end: /^}$/ },
];

const raw = fs.readFileSync(srcPath, 'utf8');
const lines = raw.split(/\r?\n/);

function findLineIndex(pattern, from = 0) {
  for (let i = from; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i;
  }
  return -1;
}

function extractSlice(startPat, endPat) {
  const start = findLineIndex(startPat);
  const end = findLineIndex(endPat, start + 1);
  if (start < 0 || end < 0) throw new Error(`Slice not found: ${startPat} -> ${endPat} (start=${start}, end=${end})`);
  return lines.slice(start, end);
}

function toMixinBody(sliceLines) {
  return sliceLines
    .map((line) => (line.startsWith('  ') ? line.slice(2) : line))
    .join('\n');
}

const classStart = lines.findIndex((l) => l.includes('class PasteCraftSupabase'));
let ctorEnd = -1;
for (let i = classStart; i < lines.length; i++) {
  if (lines[i].trim() === '}' && lines[i - 1]?.includes('setupConnectionMonitor')) {
    ctorEnd = i;
    break;
  }
}
if (ctorEnd < 0) throw new Error('constructor end not found');

const classShell = [
  '// PasteCraftSupabase — constructor shell',
  'export class PasteCraftSupabase {',
  ...lines.slice(classStart + 1, ctorEnd + 1),
  '}',
  '',
].join('\n');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'class.js'), classShell);

const mixinExports = [];

for (const slice of SLICES) {
  const sliceLines = extractSlice(slice.start, slice.end);
  const body = toMixinBody(sliceLines);
  const content = [
    `/** Vertical slice: ${slice.file} */`,
    `export const ${slice.export} = {`,
    body,
    '};',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, slice.file), content);
  mixinExports.push(slice);
}

const importLines = mixinExports.map((s) => `import { ${s.export} } from './${s.file}';`).join('\n');
const assignLines = mixinExports
  .map((s) => `Object.assign(PasteCraftSupabase.prototype, ${s.export});`)
  .join('\n');

const index = `// Supabase vertical slices
import { PasteCraftSupabase } from './class.js';
${importLines}

${assignLines}

export { PasteCraftSupabase };
export const pasteCraftSupabase = new PasteCraftSupabase();
`;

fs.writeFileSync(path.join(outDir, 'index.js'), index);

const barrel = `// Backward-compat barrel — global singleton for popup.html script order
import { pasteCraftSupabase, PasteCraftSupabase } from './supabase/index.js';

globalThis.pasteCraftSupabase = pasteCraftSupabase;
globalThis.PasteCraftSupabase = PasteCraftSupabase;

export { pasteCraftSupabase, PasteCraftSupabase };
`;

fs.writeFileSync(srcPath, barrel);

console.log('OK:', mixinExports.length, 'mixins ->', outDir);
