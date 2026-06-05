const assert = require("assert");
const fs = require("fs");
const path = require("path");

const extensionDir = path.resolve(__dirname, "..", "extension");
const manifestPath = path.join(extensionDir, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const generatedResourceFallbacks = {
  "config.js": "config.example.js",
};

const generatedResourcePrefixes = [
  "lib/",
];

function isGeneratedResource(relativePath) {
  return Boolean(generatedResourceFallbacks[relativePath]) ||
    generatedResourcePrefixes.some((prefix) => relativePath.startsWith(prefix));
}

function assertExtensionFile(relativePath, { allowGenerated = false } = {}) {
  const filePath = path.join(extensionDir, relativePath);
  if (allowGenerated && !fs.existsSync(filePath) && isGeneratedResource(relativePath)) {
    const fallback = generatedResourceFallbacks[relativePath];
    if (fallback) {
      assert.ok(
        fs.existsSync(path.join(extensionDir, fallback)),
        `Missing generated extension file fallback: ${fallback}`
      );
    }
    return;
  }
  assert.ok(fs.existsSync(filePath), `Missing extension file: ${relativePath}`);
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

for (const group of manifest.web_accessible_resources || []) {
  for (const resource of group.resources || []) {
    if (resource.includes("*")) continue;
    assertExtensionFile(resource, { allowGenerated: true });
  }
}

console.log("Extension smoke test passed.");
