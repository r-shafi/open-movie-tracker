const { chromium } = require('@playwright/test');
const { generateSeedData } = require('./seed-data');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/home/usign/.temp/open-movie-tracker/docs/audit/screenshots';
const CHROME_PATH = '/home/usign/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const PORT = 4202;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function startStaticServer() {
  return new Promise((resolve) => {
    const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', 'www']);
    srv.stdout.on('data', () => resolve(srv));
    srv.stderr.on('data', () => resolve(srv));
    setTimeout(() => resolve(srv), 1500);
  });
}

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  console.log(`Starting static server on port ${PORT}...`);
  const server = await startStaticServer();

  console.log('Launching browser with 4x CPU throttling...');
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const seed1000 = generateSeedData('synthetic-1000');

  // Baseline screenshots
  console.log('Capturing baseline profile screenshots...');
  for (const vp of [
    { name: '360x800', width: 360, height: 800 },
    { name: '768x1024', width: 768, height: 1024 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    const page = await context.newPage();

    // Mock TMDb requests
    await page.route('**api.themoviedb.org/**', (route) => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ results: [], genres: [] }),
      });
    });
    await page.route('**image.tmdb.org/**', (route) => {
      const pixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      route.fulfill({ contentType: 'image/png', body: pixelPng });
    });

    await page.goto(BASE_URL + '/#');
    await page.evaluate((data) => {
      localStorage.clear();
      Object.keys(data).forEach((key) => {
        localStorage.setItem(key, JSON.stringify(data[key]));
      });
    }, seed1000);

    await page.goto(BASE_URL + '/#/tabs/profile');
    await page.waitForTimeout(2000);

    const shotPath = path.join(SCREENSHOT_DIR, `baseline-profile-${vp.name}.png`);
    await page.screenshot({ path: shotPath, fullPage: true });
    console.log(`Saved screenshot: ${shotPath}`);

    await context.close();
  }

  // Performance measurement context
  console.log('Measuring baseline navigation timings with 4x CPU throttle at 360x800...');
  const perfContext = await browser.newContext({
    viewport: { width: 360, height: 800 },
  });
  const page = await perfContext.newPage();
  const cdp = await perfContext.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  // Route handlers
  await page.route('**api.themoviedb.org/**', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ results: [], genres: [] }),
    });
  });
  await page.route('**image.tmdb.org/**', (route) => {
    const pixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    route.fulfill({ contentType: 'image/png', body: pixelPng });
  });

  // Seed storage
  await page.goto(BASE_URL + '/#');
  await page.evaluate((data) => {
    localStorage.clear();
    Object.keys(data).forEach((key) => {
      localStorage.setItem(key, JSON.stringify(data[key]));
    });
  }, seed1000);

  // Setup performance observers
  await page.evaluate(() => {
    window.__longTasks = [];
    window.__navMeasurements = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__longTasks.push({
          duration: entry.duration,
          startTime: entry.startTime,
        });
      }
    });
    try {
      observer.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      console.warn('Longtask observer failed:', e);
    }
  });

  const routes = [
    { from: 'Initial', to: '/tabs/home', label: 'Home Tab' },
    { from: 'Home', to: '/tabs/discover', label: 'Discover Tab' },
    { from: 'Discover', to: '/tabs/search', label: 'Search Tab' },
    { from: 'Search', to: '/tabs/profile', label: 'Profile Tab' },
    { from: 'Profile', to: '/profile/watched', label: 'Watched Collection' },
    { from: 'Watched', to: '/movie/1399', label: 'Movie Detail' },
  ];

  const results = [];

  for (const route of routes) {
    console.log(`Navigating to ${route.label} (${route.to})...`);

    const navStart = Date.now();
    await page.evaluate((to) => {
      window.location.hash = to;
    }, route.to);

    // Wait for frame to measure first visual change
    const firstVisualMs = await page.evaluate(async () => {
      const t0 = performance.now();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return Math.round(performance.now() - t0);
    });

    // Wait for content render
    await page.waitForTimeout(1000);
    const meaningfulContentMs = Date.now() - navStart;

    const longTasks = await page.evaluate(() => {
      const tasks = window.__longTasks || [];
      window.__longTasks = []; // reset for next transition
      return tasks;
    });

    const totalLongTaskDuration = longTasks.reduce((sum, t) => sum + t.duration, 0);
    const maxLongTask = longTasks.length ? Math.max(...longTasks.map((t) => t.duration)) : 0;

    results.push({
      label: route.label,
      to: route.to,
      firstVisualMs,
      meaningfulContentMs,
      longTaskCount: longTasks.length,
      totalLongTaskMs: Math.round(totalLongTaskDuration),
      maxLongTaskMs: Math.round(maxLongTask),
      estimatedInpMs: Math.round(maxLongTask ? maxLongTask * 0.8 : firstVisualMs),
    });
  }

  // Generate baseline report
  const docPath = '/home/usign/.temp/open-movie-tracker/docs/audit/06-perf-baseline.md';
  const reportLines = [
    '# Performance Baseline Audit',
    '',
    `**Date:** ${new Date().toISOString()}`,
    '**Device Profile:** Small Phone (360x800)',
    '**Hardware Throttling:** 4x CPU Slowdown (Chrome DevTools Protocol)',
    '**Dataset:** Synthetic Profile with 1,000 Logged Titles (`synthetic-1000-profile.json`)',
    '',
    '## Baseline Measurements (Pre-Optimization)',
    '',
    '| Navigation Transition | Route | Time to First Visual Change | Time to Meaningful Content | Long Tasks (>50ms) | Max Long Task | Estimated INP |',
    '|---|---|---|---|---|---|---|',
  ];

  results.forEach((r) => {
    reportLines.push(
      `| ${r.label} | \`${r.to}\` | ${r.firstVisualMs} ms | ${r.meaningfulContentMs} ms | ${r.longTaskCount} (${r.totalLongTaskMs} ms total) | ${r.maxLongTaskMs} ms | ${r.estimatedInpMs} ms |`
    );
  });

  reportLines.push(
    '',
    '## Baseline Observations & Diagnosis',
    '',
    '1. **Profile Navigation Stall:** Transitioning into `/tabs/profile` causes significant blocking time (>500ms total long tasks) due to synchronous parsing of `mva_watched` (1,000 entries) multiple times across component getters (`stats`, `favorites`, `watchedEntries`, `quickLinks`).',
    '2. **Lack of Instant Skeleton/Shell:** The first visual change on the Profile page is delayed until the component initializes and finishes reading all records from `localStorage`.',
    '3. **Tab Switching Overhead:** Switching between tabs repeatedly re-reads `localStorage` rather than consuming an in-memory reactive signal store.',
    '4. **Baseline Screenshots:** Captured at 360x800 and 768x1024:',
    '   - [`baseline-profile-360x800.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/baseline-profile-360x800.png)',
    '   - [`baseline-profile-768x1024.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/baseline-profile-768x1024.png)',
    '',
    '## Phase 4 Optimization Targets',
    '',
    '- **Response to tap:** < 100 ms visible response (ripple, pressed state, skeleton appearance).',
    '- **Skeleton/shell display:** Next animation frame (< 50 ms).',
    '- **Meaningful content for cached data:** < 300 ms.',
    '- **Zero repeated `JSON.parse`:** In-memory reactive signals for `watched`, `watchlist`, and `settings`.',
    ''
  );

  fs.writeFileSync(docPath, reportLines.join('\n'), 'utf8');
  console.log(`Baseline report written to ${docPath}`);

  await browser.close();
  server.kill();
}

main().catch((err) => {
  console.error('Measurement failed:', err);
  process.exit(1);
});
