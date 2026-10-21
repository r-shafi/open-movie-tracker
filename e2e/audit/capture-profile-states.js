const { chromium } = require('@playwright/test');
const { generateSeedData } = require('./seed-data');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = '/home/usign/.temp/open-movie-tracker/docs/audit/screenshots';
const CHROME_PATH = '/home/usign/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const PORT = 4204;
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

  console.log('Launching browser...');
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const runScenario = async (config) => {
    const { filename, seedState, width = 360, height = 800, theme = 'dark', primaryColor = 'green', customCover = null, fullPage = false } = config;
    console.log(`Capturing ${filename} (${width}x${height}, ${theme}, ${primaryColor})...`);

    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: theme === 'light' ? 'light' : 'dark',
    });
    const page = await context.newPage();

    // Mock TMDb requests
    await page.route('**api.themoviedb.org/**', (route) => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ results: [], genres: [] }),
      });
    });

    // Mock image requests with SVG dummy so images render cleanly offline
    await page.route('**image.tmdb.org/**', (route) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="281" viewBox="0 0 500 281">
        <rect width="500" height="281" fill="#343a40"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#76c893" font-size="24" font-family="sans-serif">Backdrop Artwork</text>
      </svg>`;
      route.fulfill({
        contentType: 'image/svg+xml',
        body: svg,
      });
    });

    // Seed data
    let seed = generateSeedData(seedState);
    if (!seed.mva_settings) seed.mva_settings = {};
    seed.mva_settings.theme = theme;
    seed.mva_settings.primaryColor = primaryColor;
    if (customCover) {
      seed.mva_settings.customCover = customCover;
    }

    await page.goto(`${BASE_URL}/home`);
    await page.evaluate((data) => {
      localStorage.clear();
      for (const [k, v] of Object.entries(data)) {
        localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
      }
    }, seed);

    // Navigate to profile
    await page.goto(`${BASE_URL}/tabs/profile`);
    await page.waitForTimeout(1000);

    // Apply light class if light theme
    if (theme === 'light') {
      await page.evaluate(() => {
        document.documentElement.classList.add('light');
        document.body.classList.add('light');
      });
    }

    // Apply primary color
    await page.evaluate((color) => {
      const root = document.documentElement;
      if (color === 'red') {
        root.style.setProperty('--ion-color-primary', '#d90429');
        root.style.setProperty('--ion-color-primary-rgb', '217,4,41');
        root.style.setProperty('--ion-color-primary-contrast', '#ced4da');
      } else {
        root.style.setProperty('--ion-color-primary', '#76c893');
        root.style.setProperty('--ion-color-primary-rgb', '118,200,147');
        root.style.setProperty('--ion-color-primary-contrast', '#212529');
      }
    }, primaryColor);

    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, filename),
      fullPage,
    });

    await context.close();
  };

  try {
    // 1. Empty profile (0 films, no cover -> gradient fallback)
    await runScenario({
      filename: 'profile-empty-360x800.png',
      seedState: 'empty',
      width: 360,
      height: 800,
    });

    // 2. Small profile (~10 films)
    await runScenario({
      filename: 'profile-small-360x800.png',
      seedState: 'light',
      width: 360,
      height: 800,
    });

    // 3. 1,000-film fixture
    await runScenario({
      filename: 'profile-1000-360x800.png',
      seedState: 'synthetic-1000',
      width: 360,
      height: 800,
    });

    // 4. Partial-metadata variant (30% enriched) showing coverage notice and enrichment progress bar
    await runScenario({
      filename: 'profile-30pct-coverage-360x800.png',
      seedState: 'synthetic-30pct',
      width: 360,
      height: 800,
    });

    // 5. With cover (custom backdrop chosen) vs without cover
    await runScenario({
      filename: 'profile-custom-cover-360x800.png',
      seedState: 'synthetic-1000',
      width: 360,
      height: 800,
      customCover: {
        media_type: 'movie',
        id: 550,
        backdrop_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
      },
    });

    await runScenario({
      filename: 'profile-no-cover-gradient-360x800.png',
      seedState: 'empty',
      width: 360,
      height: 800,
    });

    // 6. Viewports
    const viewports = [
      { name: '390x844', width: 390, height: 844 },
      { name: '412x915', width: 412, height: 915 },
      { name: '768x1024', width: 768, height: 1024 },
      { name: '820x1180', width: 820, height: 1180 },
      { name: '1024x768', width: 1024, height: 768 },
      { name: '1440x900', width: 1440, height: 900 },
    ];
    for (const vp of viewports) {
      await runScenario({
        filename: `profile-1000-${vp.name}.png`,
        seedState: 'synthetic-1000',
        width: vp.width,
        height: vp.height,
      });
    }

    // 7. Light & Dark, Green & Red
    await runScenario({
      filename: 'profile-1000-360x800-light-green.png',
      seedState: 'synthetic-1000',
      width: 360,
      height: 800,
      theme: 'light',
      primaryColor: 'green',
    });

    await runScenario({
      filename: 'profile-1000-360x800-dark-red.png',
      seedState: 'synthetic-1000',
      width: 360,
      height: 800,
      theme: 'dark',
      primaryColor: 'red',
    });

    await runScenario({
      filename: 'profile-1000-360x800-light-red.png',
      seedState: 'synthetic-1000',
      width: 360,
      height: 800,
      theme: 'light',
      primaryColor: 'red',
    });

    console.log('All screenshots captured successfully!');
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
