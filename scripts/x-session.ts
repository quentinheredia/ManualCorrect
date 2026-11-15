/**
 * Opens a visible Chromium with the unpacked extension from dist/ and a
 * persistent profile in .x-profile/, so an X login survives between runs.
 *
 * The browser is started as a plain process, not through Playwright's
 * launcher: a Playwright-launched browser marks itself as automated
 * (navigator.webdriver, the "controlled by automated software" bar) and X
 * refuses to log in from it. Test scripts attach afterwards over the local
 * DevTools port with `chromium.connectOverCDP('http://127.0.0.1:9333')`.
 *
 * Log in by hand in the window. Nothing here types, stores or reads
 * credentials; the session lives only in the gitignored .x-profile/ folder.
 *
 *   npm run build            (or MC_DRY_RUN=1 npm run build)
 *   npm run x-session
 *
 * Env: MC_CHROMIUM=<path to chrome.exe> to pick a browser, MC_CDP_PORT to change the port.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const profile = path.join(root, '.x-profile');
const cdpPort = Number(process.env.MC_CDP_PORT ?? 9333);

/** Playwright's expected browser, else the newest Chromium Playwright has installed. */
function findChromium(): string {
  if (process.env.MC_CHROMIUM) return process.env.MC_CHROMIUM;
  const expected = chromium.executablePath();
  if (fs.existsSync(expected)) return expected;
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH ?? path.join(
    process.platform === 'win32' ? (process.env.LOCALAPPDATA ?? '') : path.join(os.homedir(), process.platform === 'darwin' ? 'Library/Caches' : '.cache'),
    'ms-playwright',
  );
  const installed = fs.existsSync(cache)
    ? fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)))
    : [];
  const relative: Record<string, string> = {
    win32: 'chrome-win64/chrome.exe',
    darwin: 'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    linux: 'chrome-linux/chrome',
  };
  for (const dir of installed) {
    const candidate = path.join(cache, dir, relative[process.platform] ?? relative.linux);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('No Chromium found. Run `npx playwright-core install chromium` or set MC_CHROMIUM.');
}

async function waitForDevTools(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
      if (response.ok) return true;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

if (!fs.existsSync(path.join(dist, 'manifest.json'))) {
  throw new Error('dist/ is missing. Run `npm run build` first.');
}

const browser = spawn(
  findChromium(),
  [
    `--user-data-dir=${profile}`,
    `--load-extension=${dist}`,
    `--remote-debugging-port=${cdpPort}`,
    '--remote-debugging-address=127.0.0.1',
    '--no-first-run',
    '--no-default-browser-check',
    '--start-maximized',
    'https://x.com/home',
  ],
  { stdio: 'ignore' },
);

if (await waitForDevTools(15000)) {
  console.log(`[x-session] Browser open. Profile: ${profile}`);
  console.log(`[x-session] DevTools endpoint for test scripts: http://127.0.0.1:${cdpPort}`);
  console.log('[x-session] Log in by hand if needed. Close the window to end the session.');
} else {
  console.log('[x-session] Browser started, but the DevTools port did not answer. Is another session already open?');
}

await new Promise<void>((resolve) => browser.on('exit', () => resolve()));
console.log('[x-session] Browser closed.');
