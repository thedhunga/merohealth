// Diagnostic twin of check-page-weight.mjs: same server, same viewport, same
// throttle — but prints every response's transfer size, largest first. When
// the budget gate fails, run this first; it names the bytes instead of the
// total. Requires a prior `next build`.
// Run: node scripts/weight-breakdown.mjs [path]  (defaults to /)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(fileURLToPath(import.meta.url), '../..');
const TARGET_PATH = process.argv[2] ?? '/';
const VIEWPORT = { width: 375, height: 812 };
const THROTTLE = { latencyMs: 150, downloadThroughput: (1600 * 1000) / 8, uploadThroughput: (750 * 1000) / 8 };

const port = await new Promise((resolve, reject) => {
  const s = createServer();
  s.unref();
  s.on('error', reject);
  s.listen(0, () => {
    const p = s.address().port;
    s.close(() => resolve(p));
  });
});

const server = spawn('pnpm', ['exec', 'next', 'start', '--port', String(port)], {
  cwd: webRoot,
  shell: true,
  stdio: 'ignore',
});

const base = `http://localhost:${port}`;
const deadline = Date.now() + 60_000;
for (;;) {
  try {
    const r = await fetch(base);
    if (r.ok) break;
  } catch {}
  if (Date.now() > deadline) throw new Error('server never came up');
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORT, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', {
  offline: false,
  latency: THROTTLE.latencyMs,
  downloadThroughput: THROTTLE.downloadThroughput,
  uploadThroughput: THROTTLE.uploadThroughput,
});
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

const sizes = new Map();
const urls = new Map();
cdp.on('Network.responseReceived', (e) => urls.set(e.requestId, e.response.url));
cdp.on('Network.loadingFinished', (e) => sizes.set(e.requestId, e.encodedDataLength));

await page.goto(base + TARGET_PATH, { waitUntil: 'networkidle', timeout: 90_000 });
await page.waitForTimeout(2000);

const rows = [...sizes.entries()]
  .map(([id, bytes]) => ({ url: (urls.get(id) ?? '?').replace(base, ''), kb: bytes / 1024 }))
  .sort((a, b) => b.kb - a.kb);
const total = rows.reduce((a, r) => a + r.kb, 0);
console.log(`${TARGET_PATH} — TOTAL ${total.toFixed(1)} KB in ${rows.length} requests\n`);
for (const r of rows.slice(0, 30)) console.log(`${r.kb.toFixed(1).padStart(8)} KB  ${r.url.slice(0, 110)}`);
const byType = {};
for (const r of rows) {
  const t = /\.woff2?/.test(r.url) ? 'font' : /\/_next\/static\/chunks/.test(r.url) ? 'js' : /\.css/.test(r.url) ? 'css' : /image|\.webp|\.png|\.jpg|\.svg/.test(r.url) ? 'img' : /^\/$|^\/\?/.test(r.url) ? 'html' : 'other';
  byType[t] = (byType[t] ?? 0) + r.kb;
}
console.log('\nBy type:', Object.entries(byType).map(([k, v]) => `${k}=${v.toFixed(0)}KB`).join(' '));

await browser.close();
server.kill();
process.exit(0);
