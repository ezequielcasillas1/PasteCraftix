#!/usr/bin/env node
/**
 * Build a unified fix plan from npm audit + Snyk JSON reports.
 * Usage: node scripts/build-fix-plan.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const REPORT_DIR = process.env.SNYK_OUTPUT_DIR || '/tmp/snyk-reports';
const SEVERITY_ORDER = ['low', 'medium', 'moderate', 'high', 'critical'];
const MIN_SEVERITY = (process.env.FIX_SEVERITY_THRESHOLD || 'moderate').toLowerCase();

function severityRank(s) {
  const n = (s || '').toLowerCase();
  const idx = SEVERITY_ORDER.indexOf(n === 'moderate' ? 'moderate' : n);
  return idx >= 0 ? idx : 0;
}

function meetsThreshold(severity) {
  return severityRank(severity) >= severityRank(MIN_SEVERITY);
}

function loadJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function cleanVersion(value) {
  if (!value) return null;
  const m = String(value).match(/\d+\.\d+\.\d+(?:-[\w.]+)?/);
  return m ? m[0] : String(value).trim();
}

function npmViewVersion(spec) {
  try {
    const out = execSync(`npm view "${spec}" version`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    return cleanVersion(out.split('\n').pop());
  } catch {
    return null;
  }
}

function bumpPatchVersion(version) {
  const parts = version.split('.').map(Number);
  if (parts.some(Number.isNaN)) return null;
  parts[parts.length - 1] += 1;
  return parts.join('.');
}

function resolveFixVersion(packageName, vulnRange, via) {
  const viaObjs = Array.isArray(via) ? via.filter((v) => typeof v === 'object' && v.range) : [];

  for (const item of viaObjs) {
    const lt = item.range.match(/^<(?:=)?([\d.]+)/);
    if (lt) {
      const bound = lt[1];
      const op = lt[0].startsWith('<=') ? '>' : '>=';
      const resolved = npmViewVersion(`${packageName}@${op}${bound}`);
      if (resolved) return resolved;
      return op === '>' ? bumpPatchVersion(bound) : bound;
    }

    const lte = item.range.match(/<=\s*([\d.]+)/);
    if (lte) {
      const resolved = npmViewVersion(`${packageName}@>${lte[1]}`);
      if (resolved) return resolved;
    }
  }

  const hyphen = (vulnRange || '').match(/([\d.]+)\s*-\s*([\d.]+)/);
  if (hyphen) {
    const upper = hyphen[2];
    const resolved = npmViewVersion(`${packageName}@>${upper}`);
    if (resolved) return resolved;
  }

  const gteLt = (vulnRange || '').match(/>=([\d.]+)\s*<(?:=)?([\d.]+)/);
  if (gteLt) {
    const resolved = npmViewVersion(`${packageName}@>${gteLt[2]}`);
    if (resolved) return resolved;
  }

  return npmViewVersion(`${packageName}@latest`);
}

function parseNpmAudit(auditPath, projectLabel, projectPath) {
  const data = loadJson(auditPath);
  if (!data?.vulnerabilities) return [];

  const findings = [];
  for (const [name, vuln] of Object.entries(data.vulnerabilities)) {
    const severity = vuln.severity || 'unknown';
    if (!meetsThreshold(severity)) continue;
    if (!vuln.fixAvailable) continue;

    const via = Array.isArray(vuln.via) ? vuln.via.find((v) => typeof v === 'object') : null;
    const advisoryId = via?.url?.match(/GHSA-[a-z0-9-]+/i)?.[0] || via?.source?.toString() || 'n/a';
    const title = via?.title || name;
    const newVersion = resolveFixVersion(name, vuln.range, vuln.via);

    findings.push({
      package: name,
      project: projectLabel,
      projectPath,
      severity,
      isDirect: Boolean(vuln.isDirect),
      advisoryId,
      title,
      source: 'npm-audit',
      fixStrategy: vuln.isDirect ? 'direct' : 'override',
      range: vuln.range || '',
      newVersion,
    });
  }
  return findings;
}

function parseSnykVuln(vuln, projectLabel, projectPath) {
  const severity = vuln.severity || 'unknown';
  if (!meetsThreshold(severity)) return null;

  const fixedIn = vuln.fixedIn || vuln.fix || [];
  const upgrades = vuln.upgradePath || [];
  let newVersion = fixedIn[0] || null;

  if (!newVersion && upgrades.length > 0) {
    const last = upgrades[upgrades.length - 1];
    if (Array.isArray(last) && last.length >= 2) newVersion = last[1];
  }

  if (!newVersion) return null;

  const advisoryId =
    vuln.id ||
    vuln.identifiers?.CVE?.[0] ||
    vuln.identifiers?.GHSA?.[0] ||
    vuln.identifiers?.SNYK?.[0] ||
    'n/a';

  const isDirect = Boolean(vuln.isDirect || vuln.from?.length <= 2);

  return {
    package: vuln.packageName || vuln.name,
    project: projectLabel,
    projectPath,
    severity,
    oldVersion: vuln.version || '',
    newVersion,
    isDirect,
    advisoryId,
    title: vuln.title || vuln.packageName,
    source: 'snyk',
    fixStrategy: isDirect ? 'direct' : 'override',
    range: vuln.semver?.vulnerable?.[0] || '',
  };
}

function parseSnykReport(snykPath) {
  const data = loadJson(snykPath);
  if (!data) return [];

  const projects = Array.isArray(data) ? data : [data];
  const findings = [];

  for (const project of projects) {
    const projectPath = project.path || project.projectName || '.';
    let label = 'root';
    if (projectPath.includes('website')) label = 'website';
    else if (projectPath !== '.' && projectPath !== ROOT) {
      label = projectPath.replace(ROOT, '').replace(/^\//, '') || 'root';
    }

    for (const vuln of project.vulnerabilities || []) {
      const f = parseSnykVuln(vuln, label, label === 'website' ? 'website' : '.');
      if (f) findings.push(f);
    }
  }
  return findings;
}

function dedupeKey(f) {
  return `${f.project}:${f.package}:${f.advisoryId}:${f.source}`;
}

function mergeFindings(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const f of list) {
      const key = dedupeKey(f);
      const existing = map.get(key);
      if (!existing || severityRank(f.severity) > severityRank(existing.severity)) {
        map.set(key, f);
      } else if (existing && !existing.newVersion && f.newVersion) {
        map.set(key, { ...existing, newVersion: f.newVersion, source: `${existing.source}+${f.source}` });
      }
    }
  }
  return [...map.values()].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

mkdirSync(REPORT_DIR, { recursive: true });

const npmRoot = parseNpmAudit(join(REPORT_DIR, 'npm-audit-root.json'), 'root', '.');
const npmWebsite = parseNpmAudit(join(REPORT_DIR, 'npm-audit-website.json'), 'website', 'website');
const snyk = parseSnykReport(join(REPORT_DIR, 'snyk-test.json'));

const findings = mergeFindings(npmRoot, npmWebsite, snyk);

const plan = {
  generatedAt: new Date().toISOString(),
  severityThreshold: MIN_SEVERITY,
  findingCount: findings.length,
  findings,
};

const outPath = join(REPORT_DIR, 'fix-plan.json');
writeFileSync(outPath, JSON.stringify(plan, null, 2));

console.log(`Fix plan: ${findings.length} actionable finding(s) at ${MIN_SEVERITY}+`);
console.log(`Output: ${outPath}`);

for (const f of findings.slice(0, 30)) {
  const ver = f.newVersion ? ` → ${f.newVersion}` : '';
  console.log(`  [${f.severity}] ${f.project}/${f.package}${ver} (${f.advisoryId}) [${f.source}]`);
}

process.exit(findings.length > 0 ? 1 : 0);
