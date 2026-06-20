const assert = require("assert");
const fs = require("fs");
const path = require("path");

const extensionDir = path.resolve(__dirname, "..", "extension");
const manifestPath = path.join(extensionDir, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const optionalGeneratedResources = [
  /^config\.js$/,
  /^icon\.png$/,
  /^assets\/eye\.gif$/,
  /^lib\/(?!lucide\.min\.js$)/,
];

function isOptionalGeneratedResource(relativePath) {
  return optionalGeneratedResources.some((pattern) => pattern.test(relativePath));
}

function assertExtensionFile(relativePath) {
  const filePath = path.join(extensionDir, relativePath);
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
    if (isOptionalGeneratedResource(resource)) continue;
    assertExtensionFile(resource);
  }
}

const lucidePath = path.join(extensionDir, "lib", "lucide.min.js");
assert.ok(fs.existsSync(lucidePath), "Missing extension/lib/lucide.min.js");
assert.ok(fs.statSync(lucidePath).size > 1000, "lucide.min.js is empty or too small");
assert.ok(
  fs.readFileSync(lucidePath, "utf8").includes("createIcons"),
  "lucide.min.js must export createIcons"
);

console.log("Extension smoke test passed.");
