#!/usr/bin/env node
/**
 * Apply dependency fixes from fix-plan.json (direct bumps, overrides, npm audit fix).
 * Usage: node scripts/apply-dependency-fixes.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const REPORT_DIR = process.env.SNYK_OUTPUT_DIR || '/tmp/snyk-reports';
const DRY_RUN = process.argv.includes('--dry-run');

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function saveJson(path, data) {
  if (DRY_RUN) {
    console.log(`[dry-run] would write ${path}`);
    return;
  }
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

function projectDir(projectPath) {
  return projectPath === 'website' ? join(ROOT, 'website') : ROOT;
}

function pkgPath(projectPath) {
  return join(projectDir(projectPath), 'package.json');
}

function run(cmd, cwd) {
  console.log(`> ${cmd}`);
  if (!DRY_RUN) execSync(cmd, { cwd, stdio: 'inherit' });
}

function bumpDirectDep(pkg, packageName, newVersion) {
  const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
  for (const section of sections) {
    if (!pkg[section]?.[packageName]) continue;
    const current = pkg[section][packageName];
    const prefix = current.match(/^[\^~]/)?.[0] || '^';
    pkg[section][packageName] = `${prefix}${newVersion}`;
    return true;
  }
  return false;
}

function setOverride(pkg, packageName, newVersion) {
  if (!pkg.overrides) pkg.overrides = {};
  pkg.overrides[packageName] = newVersion;
}

function cleanVersion(value) {
  if (!value) return null;
  const m = String(value).match(/\d+\.\d+\.\d+(?:-[\w.]+)?/);
  return m ? m[0] : String(value).trim();
}

const planPath = join(REPORT_DIR, 'fix-plan.json');
if (!existsSync(planPath)) {
  console.log('No fix plan found. Run build-fix-plan.mjs first.');
  process.exit(0);
}

const plan = loadJson(planPath);
if (!plan.findings?.length) {
  console.log('Fix plan is empty — nothing to apply.');
  process.exit(0);
}

const projectsTouched = new Set();

// Step 1: npm audit fix per project (quick wins)
const auditFixApplied = [];
for (const projectPath of ['.', 'website']) {
  const dir = projectDir(projectPath);
  const auditCache = join(REPORT_DIR, projectPath === 'website' ? 'npm-audit-website.json' : 'npm-audit-root.json');
  if (!existsSync(auditCache)) continue;
  try {
    run('npm audit fix', dir);
    auditFixApplied.push({ projectPath, method: 'npm-audit-fix' });
    projectsTouched.add(projectPath);
  } catch {
    console.warn(`npm audit fix had remaining issues in ${projectPath} (will apply plan overrides)`);
  }
}

// Step 2: apply plan entries
const applied = [];
const skipped = [];

for (const finding of plan.findings) {
  const projectPath = finding.projectPath || (finding.project === 'website' ? 'website' : '.');
  const path = pkgPath(projectPath);
  if (!existsSync(path)) {
    skipped.push({ ...finding, reason: 'package.json missing' });
    continue;
  }

  if (!finding.newVersion) {
    skipped.push({ ...finding, reason: 'no fix version available' });
    continue;
  }

  const fixVersion = cleanVersion(finding.newVersion);
  if (!fixVersion) {
    skipped.push({ ...finding, reason: 'invalid fix version' });
    continue;
  }

  const pkg = loadJson(path);
  let didApply = false;

  if (finding.fixStrategy === 'direct' || finding.isDirect) {
    didApply = bumpDirectDep(pkg, finding.package, fixVersion);
    if (!didApply) {
      setOverride(pkg, finding.package, fixVersion);
      didApply = true;
    }
  } else {
    setOverride(pkg, finding.package, fixVersion);
    didApply = true;
  }

  if (didApply) {
    saveJson(path, pkg);
    projectsTouched.add(projectPath);
    applied.push({ ...finding, newVersion: cleanVersion(finding.newVersion) });
    console.log(`Applied: ${projectPath} ${finding.package} → ${cleanVersion(finding.newVersion)} (${finding.advisoryId})`);
  }
}

// Step 3: regenerate lockfiles
for (const projectPath of projectsTouched) {
  run('npm install', projectDir(projectPath));
}

const logPath = join(REPORT_DIR, 'fix-applied.json');
saveJson(logPath, {
  appliedAt: new Date().toISOString(),
  dryRun: DRY_RUN,
  auditFixApplied,
  applied,
  skipped,
});

console.log('');
console.log(`Applied ${applied.length} fix(es), skipped ${skipped.length}.`);
console.log(`Log: ${logPath}`);

process.exit(applied.length > 0 ? 0 : 1);
