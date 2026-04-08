/**
 * Chromium Browser Extension Test Runner
 * Tests PasteCraft extension across all Chromium browsers
 * 
 * Supported: Chrome, Edge, Brave, Arc, Comet (Perplexity)
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Browser executable paths (Windows)
const BROWSER_PATHS = {
  chrome: [
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ],
  edge: [
    process.env.LOCALAPPDATA + '\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ],
  brave: [
    process.env.LOCALAPPDATA + '\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
  ],
  comet: [
    process.env.LOCALAPPDATA + '\\Comet\\Application\\comet.exe',
    process.env.LOCALAPPDATA + '\\Perplexity\\Comet\\Application\\comet.exe',
    'C:\\Program Files\\Comet\\Application\\comet.exe',
    'C:\\Program Files\\Perplexity\\Comet\\Application\\comet.exe'
  ],
  arc: [
    process.env.LOCALAPPDATA + '\\Arc\\Application\\arc.exe',
    'C:\\Program Files\\Arc\\Application\\arc.exe'
  ]
};

const EXTENSION_PATH = path.resolve(__dirname, '..', 'extension');
const TEST_PROFILE_BASE = path.resolve(__dirname, '.browser-profiles');

function findBrowserPath(browser) {
  const paths = BROWSER_PATHS[browser] || [];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function ensureProfileDir(browser) {
  const profileDir = path.join(TEST_PROFILE_BASE, browser);
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }
  return profileDir;
}

function launchBrowser(browser, options = {}) {
  const browserPath = findBrowserPath(browser);
  
  if (!browserPath) {
    console.error(`[ERROR] ${browser} not found. Searched paths:`);
    (BROWSER_PATHS[browser] || []).forEach(p => console.log(`  - ${p}`));
    return null;
  }

  const profileDir = ensureProfileDir(browser);
  
  const args = [
    `--load-extension=${EXTENSION_PATH}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    options.url || 'chrome://extensions/'
  ];

  if (options.devtools) {
    args.push('--auto-open-devtools-for-tabs');
  }

  console.log(`\n[LAUNCH] ${browser.toUpperCase()}`);
  console.log(`  Path: ${browserPath}`);
  console.log(`  Profile: ${profileDir}`);
  console.log(`  Extension: ${EXTENSION_PATH}`);

  const proc = spawn(browserPath, args, { 
    detached: true, 
    stdio: 'ignore' 
  });
  
  proc.unref();
  console.log(`  PID: ${proc.pid}`);
  
  return proc;
}

function listAvailableBrowsers() {
  console.log('\n=== Available Chromium Browsers ===\n');
  
  for (const browser of Object.keys(BROWSER_PATHS)) {
    const browserPath = findBrowserPath(browser);
    const status = browserPath ? '✓ FOUND' : '✗ NOT FOUND';
    console.log(`${browser.padEnd(10)} ${status}`);
    if (browserPath) console.log(`           ${browserPath}`);
  }
}

function printUsage() {
  console.log(`
PasteCraft Chromium Browser Test Runner

Usage:
  node chromium-browser-test.js <command> [browser]

Commands:
  list              List available browsers
  launch <browser>  Launch browser with extension loaded
  all               Launch all available browsers

Browsers:
  chrome, edge, brave, comet, arc

Examples:
  node chromium-browser-test.js list
  node chromium-browser-test.js launch comet
  node chromium-browser-test.js launch chrome
  node chromium-browser-test.js all
`);
}

// CLI
const args = process.argv.slice(2);
const command = args[0];
const browser = args[1];

switch (command) {
  case 'list':
    listAvailableBrowsers();
    break;
    
  case 'launch':
    if (!browser) {
      console.error('Specify browser: chrome, edge, brave, comet, arc');
      process.exit(1);
    }
    if (!BROWSER_PATHS[browser]) {
      console.error(`Unknown browser: ${browser}`);
      process.exit(1);
    }
    launchBrowser(browser, { devtools: true });
    break;
    
  case 'all':
    console.log('Launching all available browsers...');
    for (const b of Object.keys(BROWSER_PATHS)) {
      if (findBrowserPath(b)) {
        launchBrowser(b, { devtools: true });
      }
    }
    break;
    
  default:
    printUsage();
}
