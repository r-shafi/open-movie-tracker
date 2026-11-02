const { chromium } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 4265;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const CHROME_PATH = '/home/usign/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const ZIP_PATH = '/home/usign/.temp/open-movie-tracker/letterboxd-shafiemoji-2026-10-20-04-30-utc.zip';
const CACHE_DIR = '/home/usign/.temp/open-movie-tracker/.local-real-data/tmdb-cache';
const WWW_DIR = '/home/usign/.temp/open-movie-tracker/www';
const ASSETS_DIR = '/home/usign/.temp/open-movie-tracker/assets';
const FASTLANE_DIR = '/home/usign/.temp/open-movie-tracker/fastlane/metadata/android/en-US/images/phoneScreenshots';

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function getCacheKey(urlStr) {
  const u = new URL(urlStr);
  u.searchParams.delete('api_key');
  const normalized =
    u.pathname +
    '?' +
    Array.from(u.searchParams.entries())
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function createSpaServer() {
  return http
    .createServer((req, res) => {
      const rawPath = req.url.split('?')[0];
      let filePath = path.join(WWW_DIR, rawPath);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        const fallbackPath = path.join(WWW_DIR, path.basename(rawPath));
        if (fs.existsSync(fallbackPath) && fs.statSync(fallbackPath).isFile()) {
          filePath = fallbackPath;
        }
      }
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        res.writeHead(200, {
          'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(path.join(WWW_DIR, 'index.html')).pipe(res);
      }
    })
    .listen(PORT);
}

async function run() {
  console.log('Starting local SPA server on port', PORT);
  const server = createSpaServer();

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 414, height: 846 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  });

  // Serve TMDB API queries from cache if available to speed up loading
  if (fs.existsSync(CACHE_DIR)) {
    await context.route('**api.themoviedb.org/**', async (route) => {
      const url = route.request().url();
      const key = getCacheKey(url);
      const cacheFile = path.join(CACHE_DIR, `${key}.json`);
      if (fs.existsSync(cacheFile)) {
        const data = fs.readFileSync(cacheFile, 'utf8');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: data,
        });
      } else {
        await route.continue();
      }
    });
  }

  const page = await context.newPage();

  // Step 1: Inject file input helper for upload
  await page.addInitScript(() => {
    const origCreate = document.createElement.bind(document);
    document.createElement = function (tag, opts) {
      const el = origCreate(tag, opts);
      if (tag.toLowerCase() === 'input') {
        const origClick = el.click.bind(el);
        el.click = function () {
          if (el.type === 'file') {
            el.id = 'dynamic-file-input';
            el.style.display = 'none';
            document.body.appendChild(el);
          }
          return origClick();
        };
      }
      return el;
    };
  });

  console.log('Navigating to /settings to import real Letterboxd archive...');
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Click Import from Letterboxd
  const importBtn = page.locator('button:has-text("Import from Letterboxd")');
  await importBtn.click();

  const fileInput = page.locator('#dynamic-file-input');
  await fileInput.setInputFiles(ZIP_PATH);

  console.log('Waiting for import modal detection...');
  await page.waitForSelector('ion-button:has-text("Start TMDb Matching")', {
    timeout: 30000,
  });

  // Enable profile import toggle if present
  const profileToggle = page.locator('text=Import Profile Name & Bio').locator('..').locator('ion-toggle');
  if (await profileToggle.count() > 0) {
    const isChecked = await profileToggle.getAttribute('aria-checked');
    if (isChecked !== 'true') {
      await profileToggle.click();
    }
  }

  console.log('Clicking "Start TMDb Matching"...');
  await page.click('ion-button:has-text("Start TMDb Matching")');

  const startTime = Date.now();
  let matchDone = false;
  while (!matchDone) {
    await page.waitForTimeout(1000);
    const resolveBtn = await page.$('ion-button:has-text("Accept All Top")');
    if (resolveBtn) {
      console.log('Resolving ambiguous matches with "Accept All Top"...');
      await resolveBtn.click();
      await page.waitForTimeout(1000);
    }
    const commitBtn = await page.$('ion-button:has-text("Confirm & Import Now")');
    if (commitBtn) {
      console.log('Import summary reached. Clicking "Confirm & Import Now"...');
      await commitBtn.click();
      matchDone = true;
      break;
    }
    if (Date.now() - startTime > 120000) {
      throw new Error('TMDb matching timed out');
    }
  }

  await page.waitForSelector('ion-button:has-text("Close & View Collection")', {
    timeout: 120000,
  });
  console.log('Import completed successfully!');
  await page.click('ion-button:has-text("Close & View Collection")');
  await page.waitForTimeout(2000);

  // Enrich snapshots from cache if available so analytics graphs have full data
  if (fs.existsSync(CACHE_DIR)) {
    const cacheFiles = fs.readdirSync(CACHE_DIR);
    const movieCache = new Map();
    cacheFiles.forEach((f) => {
      try {
        const d = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, f), 'utf8'));
        if (d.id && d.credits && d.runtime !== undefined) {
          movieCache.set(d.id, d);
        }
      } catch (e) {}
    });

    await page.evaluate((cacheMapObj) => {
      const raw = localStorage.getItem('mva_watched');
      if (!raw) return;
      const watched = JSON.parse(raw);
      let count = 0;
      Object.values(watched).forEach((w) => {
        if (!w.snapshot && cacheMapObj[w.id]) {
          const d = cacheMapObj[w.id];
          const directors = (d.credits?.crew || [])
            .filter((c) => c.job === 'Director')
            .map((c) => ({ id: c.id, name: c.name, profilePath: c.profile_path || null }));
          const topCast = (d.credits?.cast || [])
            .slice(0, 5)
            .map((c) => ({ id: c.id, name: c.name, profilePath: c.profile_path || null }));
          w.snapshot = {
            runtimeMinutes: d.runtime || 0,
            genres: d.genres || [],
            releaseYear: d.release_date ? parseInt(d.release_date.slice(0, 4), 10) : undefined,
            releaseDate: d.release_date || '',
            originalLanguage: d.original_language || undefined,
            productionCountries: (d.production_countries || []).map((c) => c.iso_3166_1).filter(Boolean),
            directors,
            topCast,
            tmdbVoteAverage: d.vote_average || undefined,
            posterPath: d.poster_path || null,
            backdropPath: d.backdrop_path || null,
          };
          count++;
        }
      });
      localStorage.setItem('mva_watched', JSON.stringify(watched));
    }, Object.fromEntries(movieCache));
  }

  // Ensure favorites and profile cover look realistic
  await page.evaluate(() => {
    // 4 real Letterboxd favorites
    const favs = [
      { id: 60243, media_type: 'movie', title: 'A Separation', poster_path: '/xQadpnoLokxzN3hRpCPbBGpxsiz.jpg' },
      { id: 290098, media_type: 'movie', title: 'The Handmaiden', poster_path: '/dLlH4aNHdnmf62umnInL8xPlPzw.jpg' },
      { id: 37185, media_type: 'movie', title: 'Comrades: Almost a Love Story', poster_path: '/hjlRaJEa8zuN72LmMATQ3FcCTb0.jpg' },
      { id: 2013, media_type: 'movie', title: 'The Diving Bell and the Butterfly', poster_path: '/6NkJ4gnLrvLj0PZDW6sNM85JMbj.jpg' },
    ];
    localStorage.setItem('mva_favorites', JSON.stringify(favs));

    // Profile info
    const profile = JSON.parse(localStorage.getItem('mva_profile') || '{}');
    profile.displayName = 'Shafi';
    profile.bio = 'I have a tendency to watch bad films.';
    localStorage.setItem('mva_profile', JSON.stringify(profile));

    // Settings dark theme
    const settings = JSON.parse(localStorage.getItem('mva_settings') || '{}');
    settings.theme = 'dark';
    settings.primaryColor = 'green';
    localStorage.setItem('mva_settings', JSON.stringify(settings));
  });

  async function saveScreenshot(assetName, fastlaneNum) {
    const assetPath = path.join(ASSETS_DIR, assetName);
    const fastlanePath = path.join(FASTLANE_DIR, `${fastlaneNum}.png`);
    await page.screenshot({ path: assetPath });
    fs.copyFileSync(assetPath, fastlanePath);
    console.log(`Captured: ${assetName} -> ${fastlaneNum}.png`);
  }

  console.log('\n--- Capturing Screenshots ---\n');

  // 1. Home screen
  console.log('1. Home Screen...');
  await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await saveScreenshot('home_screen.png', '01');

  // 2. Explore / Discover screen
  console.log('2. Explore Screen...');
  await page.goto(`${BASE_URL}/discover`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await saveScreenshot('explore_screen.png', '02');

  // 3. Search screen
  console.log('3. Search Screen...');
  await page.goto(`${BASE_URL}/search`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await saveScreenshot('search_screen.png', '03');

  // 4. Movie detail screen (The Handmaiden)
  console.log('4. Movie Detail Screen...');
  await page.goto(`${BASE_URL}/movie/290098`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  await saveScreenshot('movie_screen.png', '04');

  // 5. Movie detail meta information (scrolled down)
  console.log('5. Movie Detail Meta Information Screen...');
  await page.evaluate(() => {
    const content = document.querySelector('ion-content');
    if (content?.scrollToPoint) {
      content.scrollToPoint(0, 520, 0);
    } else {
      window.scrollTo(0, 520);
    }
  });
  await page.waitForTimeout(2000);
  await saveScreenshot('movie_screen_meta_information.png', '05');

  // 6. Movie logging sheet
  console.log('6. Movie Logging Sheet...');
  await page.evaluate(() => {
    const content = document.querySelector('ion-content');
    if (content?.scrollToTop) content.scrollToTop(0);
  });
  await page.waitForTimeout(500);
  const logBtn = page.locator('ion-button:has-text("Log"), ion-button:has-text("Edit log")').first();
  await logBtn.click();
  await page.waitForTimeout(1500);
  await saveScreenshot('movie_logging.png', '06');

  // Dismiss modal
  await page.evaluate(() => {
    const cancelBtn = document.querySelector('ion-modal button, ion-modal ion-button');
    if (cancelBtn) cancelBtn.click();
  });
  await page.waitForTimeout(500);

  // 7. Movie in lists screen
  console.log('7. Movie In Lists Screen...');
  await page.goto(`${BASE_URL}/movie/290098/lists`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  await saveScreenshot('movie_in_lists_screen.png', '07');

  // 8. Custom list screen
  console.log('8. Custom List Screen...');
  await page.goto(`${BASE_URL}/list/43`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  await saveScreenshot('custom_list_screen.png', '08');

  // 9. Reviews screen
  console.log('9. Reviews Screen...');
  await page.goto(`${BASE_URL}/movie/278/reviews`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  await saveScreenshot('reviews_screen.png', '09');

  // 10. Profile screen
  console.log('10. Profile Screen...');
  await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await saveScreenshot('profile_screen.png', '10');

  // 11. Profile analytics screen
  console.log('11. Profile Analytics Screen...');
  const ratingsBtn = page.locator('.analytics-nav-tabs button:has-text("Ratings"), button:has-text("Ratings")').first();
  if (await ratingsBtn.count() > 0) {
    await ratingsBtn.click();
    await page.waitForTimeout(800);
  }
  await page.evaluate(() => {
    const content = document.querySelector('ion-content');
    if (content?.scrollToPoint) {
      content.scrollToPoint(0, 320, 0);
    } else {
      window.scrollTo(0, 320);
    }
  });
  await page.waitForTimeout(1500);
  await saveScreenshot('profile_analytics.png', '11');

  await browser.close();
  server.close();
  console.log('\nAll 11 screenshots successfully captured and saved!\n');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
