const assert = require("assert");
const fs = require("fs");
const path = require("path");

const extensionDir = path.resolve(__dirname, "..", "extension");
const manifestPath = path.join(extensionDir, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const OPTIONAL_LOCAL_RESOURCES = new Set([
  "assets/eye.gif",
  "icon.png",
]);

function assertExtensionFile(relativePath) {
  const filePath = path.join(extensionDir, relativePath);
  assert.ok(fs.existsSync(filePath), `Missing extension file: ${relativePath}`);
}

function assertManifestResource(relativePath) {
  if (relativePath === "config.js") {
    assertExtensionFile("config.example.js");
    return;
  }
  if (OPTIONAL_LOCAL_RESOURCES.has(relativePath)) return;
  assertExtensionFile(relativePath);
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
    assertManifestResource(resource);
  }
}

console.log("Extension smoke test passed.");
