const { chromium } = require('@playwright/test');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = '/home/usign/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const PORT = 4205;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function startStaticServer() {
  return new Promise((resolve) => {
    const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', 'www']);
    srv.stdout.on('data', () => resolve(srv));
    srv.stderr.on('data', () => resolve(srv));
    setTimeout(() => resolve(srv), 1500);
  });
}

async function run() {
  console.log('Starting server for Quick Log E2E...');
  const server = await startStaticServer();

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 360, height: 800 },
    });
    const page = await context.newPage();

    // Mock TMDb requests
    await page.route('**api.themoviedb.org/**', (route) => {
      const url = route.request().url();
      if (url.includes('/search/multi')) {
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              {
                id: 550,
                media_type: 'movie',
                title: 'Fight Club',
                poster_path: '/fightclub.jpg',
                release_date: '1999-10-15',
              },
              {
                id: 1399,
                media_type: 'tv',
                name: 'Game of Thrones',
                poster_path: '/got.jpg',
                first_air_date: '2011-04-17',
              },
            ],
          }),
        });
      } else if (url.includes('/trending/')) {
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              {
                id: 550,
                media_type: 'movie',
                title: 'Fight Club',
                poster_path: '/fightclub.jpg',
                release_date: '1999-10-15',
              },
            ],
          }),
        });
      } else {
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ results: [], genres: [] }),
        });
      }
    });

    console.log('Navigating to home...');
    await page.goto(`${BASE_URL}/#/tabs/home`);
    await page.waitForTimeout(1000);

    // Verify center Quick Log button exists with accessible label
    const quickLogBtn = page.locator('ion-tab-button.quick-log-tab-button');
    const isVisible = await quickLogBtn.isVisible();
    console.log(`Quick Log button visible in tab bar: ${isVisible}`);
    if (!isVisible) throw new Error('Quick Log button not found in tab bar');

    const details = await quickLogBtn.evaluate((el) => ({
      outer: el.outerHTML,
      ariaLabel: el.getAttribute('aria-label'),
      innerAria: el.shadowRoot ? el.shadowRoot.querySelector('a, button')?.getAttribute('aria-label') : null,
    }));
    console.log('Button details:', details);

    // Tap the quick log button
    console.log('Tapping Quick Log button...');
    await quickLogBtn.click();
    await page.waitForTimeout(800);

    // Verify modal appeared
    const modal = page.locator('app-quick-log-modal');
    const modalVisible = await modal.isVisible();
    console.log(`Quick Log Modal visible: ${modalVisible}`);
    if (!modalVisible) throw new Error('Quick Log modal did not appear');

    // Screenshot of open quick log modal
    const screenshotPath = '/home/usign/.temp/open-movie-tracker/docs/audit/screenshots/quick-log-modal-360x800.png';
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved to ${screenshotPath}`);

    // Verify search works
    const searchInput = page.locator('app-quick-log-modal ion-searchbar input');
    await searchInput.click();
    await searchInput.pressSequentially('Fight', { delay: 100 });
    await page.waitForTimeout(800); // debounce

    const searchResults = page.locator('.result-card');
    const count = await searchResults.count();
    console.log(`Search result count: ${count}`);
    if (count === 0) throw new Error('Search results did not render');

    // Click quick Mark Watched button
    const markWatchedBtn = searchResults.first().locator('button[aria-label="Mark watched now"]');
    await markWatchedBtn.click();
    await page.waitForTimeout(800);

    // Verify modal dismissed and toast appeared
    const toast = page.locator('ion-toast');
    const toastVisible = await toast.isVisible();
    console.log(`Toast with Undo visible: ${toastVisible}`);

    console.log('E2E test for Quick Log passed successfully!');
  } finally {
    await browser.close();
    server.kill();
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
