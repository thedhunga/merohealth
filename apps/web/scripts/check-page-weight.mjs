#!/usr/bin/env node
// Round seven, task S (first box): a repeatable gate for `/`'s first-load
// weight and LCP, so a regression like the 2.5 MB hero video (`0e9eb65`)
// fails a build instead of waiting for the owner to notice on their phone.
//
// Boots the already-built app with `next start`, loads `/` in a fresh
// browser context (no history → the bare-path first-visit screen, see
// `homeVariant` in `src/lib/home-screen.ts`) at a 375x812 phone viewport
// under Lighthouse's documented default mobile throttling profile, and
// fails if either budget is exceeded.
//
// Requires `next build` to have already run (`.next/` present) and a
// Chromium the installed `playwright` can drive — see the README note in
// this file's sibling `check-page-weight.md` if one is ever added; for now
// see the CI workflow, which runs `playwright install --with-deps chromium`
// before this script.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const webRoot = path.resolve(fileURLToPath(import.meta.url), '../..');

const TARGET_PATH = '/';
const VIEWPORT = { width: 375, height: 812 };
const BUDGET_TRANSFERRED_BYTES = 600 * 1024; // 600 KB, the round-seven ceiling
const BUDGET_LCP_MS = 2500;

// Lighthouse's documented default mobile network profile — labelled "Slow
// 4G" today (previously "Fast 3G"): roughly the bottom 25% of 4G / top 25%
// of 3G connections. https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md
// Paired with Lighthouse's own 4x CPU slowdown for mobile, since an
// unthrottled build machine's CPU would make LCP look better than it will
// on the phones this product actually ships to.
const THROTTLE = {
  latencyMs: 150,
  downloadThroughput: (1600 * 1000) / 8, // 1.6 Mbps
  uploadThroughput: (750 * 1000) / 8, // 750 Kbps
};
const CPU_THROTTLE_RATE = 4;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`next start did not respond at ${url} within ${timeoutMs}ms`);
}

async function main() {
  const port = await getFreePort();
  const nextBin = require.resolve('next/dist/bin/next');
  const server = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], {
    cwd: webRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverOutput = '';
  server.stdout?.on('data', (chunk) => (serverOutput += chunk));
  server.stderr?.on('data', (chunk) => (serverOutput += chunk));

  let browser;
  try {
    const origin = `http://127.0.0.1:${port}`;
    await waitForServer(origin, 30_000);

    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);

    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: THROTTLE.latencyMs,
      downloadThroughput: THROTTLE.downloadThroughput,
      uploadThroughput: THROTTLE.uploadThroughput,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE_RATE });

    let transferredBytes = 0;
    const pendingRequestIds = new Set();
    cdp.on('Network.requestWillBeSent', (event) => pendingRequestIds.add(event.requestId));
    cdp.on('Network.loadingFinished', (event) => {
      if (pendingRequestIds.has(event.requestId)) transferredBytes += event.encodedDataLength;
    });

    await page.goto(`${origin}${TARGET_PATH}`, { waitUntil: 'networkidle', timeout: 60_000 });

    // LCP stops updating once the page is hidden or the user interacts;
    // neither happens in this script, so a short settle after network-idle
    // is a reasonable proxy for "final" LCP in a lab run.
    const lcpMs = await page.evaluate(
      () =>
        new Promise((resolve) => {
          let value = 0;
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            if (entries.length > 0) value = entries[entries.length - 1].startTime;
          }).observe({ type: 'largest-contentful-paint', buffered: true });
          setTimeout(() => resolve(value), 500);
        }),
    );

    const transferredKb = transferredBytes / 1024;
    const budgetKb = BUDGET_TRANSFERRED_BYTES / 1024;
    const weightOk = transferredBytes <= BUDGET_TRANSFERRED_BYTES;
    const lcpOk = lcpMs <= BUDGET_LCP_MS;

    console.log(`Page weight check — ${TARGET_PATH} at ${VIEWPORT.width}x${VIEWPORT.height}, throttled 4G`);
    console.log(
      `  Transferred: ${transferredKb.toFixed(1)} KB (budget ${budgetKb.toFixed(0)} KB) — ${weightOk ? 'PASS' : 'FAIL'}`,
    );
    console.log(`  LCP: ${lcpMs.toFixed(0)} ms (budget ${BUDGET_LCP_MS} ms) — ${lcpOk ? 'PASS' : 'FAIL'}`);

    if (!weightOk || !lcpOk) {
      console.error('\nPage weight budget exceeded.');
      process.exitCode = 1;
    }
  } finally {
    await browser?.close();
    server.kill();
    if (process.exitCode) console.error(serverOutput);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
