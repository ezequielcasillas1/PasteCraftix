const assert = require("assert");
const fs = require("fs");
const path = require("path");

const extensionDir = path.resolve(__dirname, "..", "extension");
const manifestPath = path.join(extensionDir, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function assertExtensionFile(relativePath) {
  const filePath = path.join(extensionDir, relativePath);
  assert.ok(fs.existsSync(filePath), `Missing extension file: ${relativePath}`);
}

/** config.js is gitignored; accept config.example.js as the checked-in stand-in. */
function assertConfigPresent() {
  const config = path.join(extensionDir, "config.js");
  const example = path.join(extensionDir, "config.example.js");
  assert.ok(
    fs.existsSync(config) || fs.existsSync(example),
    "Missing extension config.js (or config.example.js)",
  );
}

assert.strictEqual(manifest.manifest_version, 3, "Extension must use Manifest V3");
assert.ok(Array.isArray(manifest.permissions), "Manifest permissions must be an array");
assert.ok(Array.isArray(manifest.content_scripts), "Manifest content_scripts must be an array");

if (manifest.background?.service_worker) {
  assertExtensionFile(manifest.background.service_worker);
}

for (const script of manifest.content_scripts) {
  for (const file of script.js || []) {
    assertExtensionFile(file);
  }
}

/** Vendored min libs may be absent in sparse checkouts; skip soft deps under lib/. */
const SOFT_WAR_PREFIXES = ["lib/"];

for (const group of manifest.web_accessible_resources || []) {
  for (const resource of group.resources || []) {
    if (resource.includes("*")) continue;
    if (resource === "config.js") {
      assertConfigPresent();
      continue;
    }
    if (SOFT_WAR_PREFIXES.some((p) => resource.startsWith(p))) {
      const full = path.join(extensionDir, resource);
      if (!fs.existsSync(full)) {
        console.warn(`[smoke] soft-skip missing vendored WAR: ${resource}`);
        continue;
      }
    }
    assertExtensionFile(resource);
  }
}

// --- PR #145 expansion: Quick Paste qp.* vertical slice wiring ---
const qpFiles = [
  "content/quick-paste/quick-paste.js",
  "content/quick-paste/qp.controller.js",
  "content/quick-paste/qp.clips-actions.js",
  "content/quick-paste/qp.constants.js",
  "content/quick-paste/qp.helpers.js",
  "content/content.js",
];
for (const rel of qpFiles) {
  assertExtensionFile(rel);
}

const wars = (manifest.web_accessible_resources || []).flatMap(
  (group) => group.resources || [],
);
assert.ok(
  wars.some((r) => r.includes("content/quick-paste")),
  "Manifest WAR must include content/quick-paste modules for dynamic import",
);

const quickPasteEntry = fs.readFileSync(
  path.join(extensionDir, "content/quick-paste/quick-paste.js"),
  "utf8",
);
assert.match(
  quickPasteEntry,
  /export\s*\{\s*QuickPasteInterface\s*\}\s*from\s*['"]\.\/qp\.controller\.js['"]/,
  "quick-paste.js must re-export QuickPasteInterface from qp.controller.js",
);

const contentEntry = fs.readFileSync(
  path.join(extensionDir, "content/content.js"),
  "utf8",
);
assert.match(
  contentEntry,
  /from\s*['"]\.\/quick-paste\/quick-paste\.js['"]/,
  "content.js must import QuickPasteInterface via quick-paste entry",
);

console.log("Extension smoke test passed.");
