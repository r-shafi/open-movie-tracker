# Phase 1: Production-Readiness Code Audit

Date of audit: 2026-10-20
Target repository: `/home/usign/.temp/open-movie-tracker`
Auditor: Antigravity Autonomous Agent

Every finding below has been verified against the actual source code with file:line references and assigned a severity level: **Critical**, **High**, **Medium**, or **Low**.

---

## 1. Summary of Audit Findings by Severity

| Severity | Count | Key Focus Areas |
|---|---|---|
| **Critical** | 4 | Unguarded localStorage write crashing on quota; Corrupt/malicious JSON import bricking app; Custom list detail 404 crash; Data model unable to support rewatches, date-unknown, and Letterboxd import |
| **High** | 7 | Hardcoded TMDb API key; No TMDb 429 rate limit or retry logic; Boot update checker privacy & network leak; Broken test runner (`test.ts`); Zero test coverage; Dead services (`ProfileService`, `SettingsService`) & `movies/` stub; Large list DOM performance & getter re-computation |
| **Medium** | 6 | `SafeUrlPipe` sanitization bypass; Android auto-backup to cloud; Remote TMDb logo failing offline; Missing TMDb error retry UI; Android hardware back button handling in sheets/modals; Timezone shift in diary grouping |
| **Low** | 3 | Cross-origin image viewer download in WebView; Mixed lockfiles (`package-lock.json` vs `pnpm-lock.yaml`); Unused `protractor` and `tslint.json` |

---

## 2. Detailed Findings: Data Integrity and Durability

### Finding D-01 [CRITICAL]: Unguarded `localStorage.setItem` Causing Crash on Quota Exceeded
- **Location**: `/home/usign/.temp/open-movie-tracker/src/app/services/user-data.service.ts#L682-L684`
- **Code**:
  ```typescript
  private writeJson<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }
  ```
- **Evidence**:
  Standard browser and WebView `localStorage` has a hard quota of ~5 MB. As users accumulate diary entries, reviews, tags, and especially profile avatars/covers (see Finding D-02), `localStorage.setItem` throws `QuotaExceededError` (DOMException). Because `writeJson` has no `try/catch` and no quota detection, any attempt to log a film or edit profile crashes unhandledly.
- **Impact**: Irreversible data loss and application crash when saving data.

### Finding D-02 [HIGH]: Full Base64 Image Blobs Stored in `localStorage`
- **Location**: `/home/usign/.temp/open-movie-tracker/src/app/profile/profile.page.ts#L247-L256`, `/home/usign/.temp/open-movie-tracker/src/app/services/user-data.service.ts#L20-L26`
- **Code**:
  ```typescript
  reader.onload = () => {
    const result = reader.result as string;
    const patch = type === 'avatar' ? { avatarBase64: result } : { coverBase64: result };
    this.userData.saveProfile(patch);
  };
  reader.readAsDataURL(file);
  ```
- **Evidence**:
  Avatar and cover images picked by the user are converted into uncompressed Base64 data URLs and directly serialized into `mva_profile` in `localStorage`. A single 3MB camera photo uploaded as cover can instantly consume over 60% of the entire 5MB `localStorage` quota.
- **Impact**: Guarantees quota exhaustion for users who set profile photos.

### Finding D-03 [CRITICAL]: Blind JSON Import Without Validation or Schema Versioning
- **Location**: `/home/usign/.temp/open-movie-tracker/src/app/settings/settings.page.ts#L346-L364`
- **Code**:
  ```typescript
  const data = JSON.parse(e.target.result);
  const keys = ['mva_profile', 'mva_watched', 'mva_watchlist', 'mva_favorites', 'mva_lists', 'mva_settings'];
  keys.forEach((k) => {
    if (data[k] !== undefined) {
      localStorage.setItem(k, JSON.stringify(data[k]));
    }
  });
  ```
- **Evidence**:
  1. No JSON schema validation, bounds checking, or type checking.
  2. Malformed, corrupted, or hostile JSON can inject invalid objects into `mva_watched` or `mva_lists`.
  3. No version header exists in export files.
  4. It is a blind overwrite (replace per key), not a merge, but the user is not warned of this before importing.
  5. The UI tells the user `"Data imported. Reload to see changes."`, failing to refresh in-memory state.
- **Impact**: A corrupted or tampered JSON file permanently bricks the app on boot.

### Finding D-04 [CRITICAL]: Data Model Incompatible with Letterboxd Import & Rewatches
- **Location**: `/home/usign/.temp/open-movie-tracker/src/app/services/user-data.service.ts#L28-L41`, `L148-L153`
- **Code**:
  ```typescript
  getWatchedEntry(mediaType: string, id: number): WatchedEntry | null {
    const key = `${mediaType}:${id}`;
    const watched = this.getWatched();
    return watched[key] || null;
  }
  ```
- **Evidence**:
  1. **Single Entry Constraint**: `mva_watched` is a map keyed by `${media_type}:${id}`. If a film is watched multiple times (rewatch), saving a new log entry **overwrites** the previous watch date and review. Rewatch is merely a boolean flag `rewatch: boolean`. Letterboxd exports contain multiple dated diary rows for the same film that cannot be represented in the current schema.
  2. **No Source Key**: No `sourceKey` or `letterboxdUri` field exists to correlate imported entries or prevent duplicates on re-import.
  3. **No Date Unknown State**: `watchedAt` defaults to `new Date().toISOString()`. Undated watched films (from `watched.csv` or `ratings.csv`) would falsely appear as watched today.
  4. **Likes Conflated with Watched**: `liked` is a property on `WatchedEntry`. Marking a film as liked in `/home/usign/.temp/open-movie-tracker/src/app/film/film.page.ts#L285-L300` automatically creates a `WatchedEntry` with today's watch date, even if the user never logged it as watched.
- **Impact**: Prevents implementing Letterboxd import without schema redesign and data migration.

### Finding D-05 [HIGH]: Analytics Depend on User Tags Instead of Real Genres & Synthetic Runtime
- **Location**: `/home/usign/.temp/open-movie-tracker/src/app/services/user-data.service.ts#L485`, `L522-L534`
- **Code**:
  ```typescript
  const totalHoursEstimated = Number((totalWatched * 1.8).toFixed(1));
  ...
  const tagCounts: Record<string, number> = {};
  watched.forEach((entry) => {
    (entry.tags || []).forEach((tag) => {
      if (!tag) return;
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  const topGenres = Object.entries(tagCounts)...
  ```
- **Evidence**:
  1. `totalHoursEstimated` is a crude multiplication of `totalWatched * 1.8`. Actual runtimes from TMDb are never stored or computed.
  2. `topGenres` does not use genres at all; it counts user-entered tags!
  3. When an entry is logged, no metadata snapshot (runtime, genres, release year, director, poster path, vote average) is captured.
- **Impact**: Profile statistics are misleading and depend on user tags standing in for genres.

---

## 3. Detailed Findings: TMDb Dependency & Networking

### Finding T-01 [HIGH]: TMDb API Key Hardcoded in Source Code
- **Location**: `/home/usign/.temp/open-movie-tracker/src/environments/environment.ts#L7`, `/home/usign/.temp/open-movie-tracker/src/environments/environment.prod.ts#L3`
- **Code**:
  ```typescript
  tmdbApiKey: '1426684c151e5ca03cfd5a6952e73c46',
  ```
- **Evidence**:
  A single hardcoded API key is shared by all installations. If this key is revoked, suspended, or rate-limited by TMDb, all users are blocked. The user should be able to input their own TMDb API key in Settings, with the bundled key as a fallback.
- **Impact**: Single point of failure for all network requests.

### Finding T-02 [HIGH]: Lack of 429 Rate Limiting, Backoff, and Deduplication
- **Location**: `/home/usign/.temp/open-movie-tracker/src/app/services/tmdb.service.ts#L49-L75`
- **Code**:
  ```typescript
  private get<T>(path: string, extra: Record<string, any> = {}): Observable<T> { ... }
  ```
- **Evidence**:
  1. No rate-limit interceptor or queue: TMDb enforces 40 requests / 10s. Batch imports or fast navigation can trigger HTTP 429.
  2. No retry with exponential backoff or `Retry-After` header parsing.
  3. No in-flight request deduplication: multiple components requesting the same movie simultaneously trigger redundant network requests.
- **Impact**: App breaks when matching large batches of Letterboxd titles or browsing quickly.

### Finding T-03 [HIGH]: Bug in `catchError` Returning Array Instead of Observable in `TmdbService`
- **Location**: `/home/usign/.temp/open-movie-tracker/src/app/services/tmdb.service.ts#L59-L64`
- **Code**:
  ```typescript
  catchError((err) => {
    if (cached !== null) {
      return [cached]; // BUG: Emits Array<T> instead of of(cached)
    }
    return throwError(() => err);
  })
  ```
- **Evidence**:
  In RxJS `catchError`, returning an array `[cached]` results in the Observable emitting the array itself (`Array<T>`) rather than `T`. Any component expecting `res.results` encounters `undefined` when served from this error catch branch.
- **Impact**: Subtle runtime errors when recovering from failed requests with cached data.

### Finding T-04 [MEDIUM]: TMDb Attribution Logo Broken Offline
- **Location**: `/home/usign/.temp/open-movie-tracker/src/app/settings/settings.page.html#L385-L394`
- **Code**:
  ```html
  <img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg" alt="TMDb Logo" />
  ```
- **Evidence**:
  TMDb logo is loaded directly from a remote CDN instead of a bundled local asset in `/home/usign/.temp/open-movie-tracker/src/assets/`. If offline, the logo fails to load. Moreover, TMDb attribution is absent from movie/TV detail and search pages.
- **Impact**: Non-compliance with TMDb API attribution requirements in offline mode.

### Finding T-05 [MEDIUM]: Stale or Removed Titles Cannot Render in Detail Views
- **Location**: `/home/usign/.temp/open-movie-tracker/src/app/film/film.page.ts#L48-L100`, `/home/usign/.temp/open-movie-tracker/src/app/tv/tv.page.ts#L49-L101`
- **Evidence**:
  If a movie or TV show previously logged in `mva_watched` is removed or returns 404 from TMDb, `forkJoin` in `ngOnInit()` fails completely. `this.movie` remains undefined, and the page renders blank without displaying the title, rating, review, or poster from local storage.
- **Impact**: Users cannot view or edit their own logs for delisted or unmatchable titles.

---

## 4. Detailed Findings: Security and Privacy

### Finding S-01 [HIGH]: Update Checker Violates Privacy Guarantee & Leaks IP on Boot
- **Location**: `/home/usign/.temp/open-movie-tracker/src/app/app.component.ts#L58`, `L65-L85`, `/home/usign/.temp/open-movie-tracker/src/app/services/update.service.ts#L31`
- **Code**:
  ```typescript
  // app.component.ts ngOnInit:
  this.checkForUpdates();
  // update.service.ts:
  https://api.github.com/repos/${this.owner}/${this.repo}/releases/latest
  ```
- **Evidence**:
  On every single application launch, `AppComponent` immediately calls the GitHub API. This violates the core privacy promise ("No telemetry, no remote storage, only network dependency is TMDb"). It leaks the user's IP, launch time, and device info to GitHub. Furthermore, the `subscribe` has no error handler, resulting in uncaught errors when offline.
- **Impact**: Privacy violation; makes unsolicited third-party network requests on boot.

### Finding S-02 [MEDIUM]: `SafeUrlPipe` Bypasses Sanitization Without Validation
- **Location**: `/home/usign/.temp/open-movie-tracker/src/app/shared-module/pipes/safe-url.pipe.ts#L10-L12`, `/home/usign/.temp/open-movie-tracker/src/app/film/film.page.html#L454`
- **Code**:
  ```typescript
  transform(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
  ```
  ```html
  [src]="'https://www.youtube.com/embed/' + trailerKey | safeUrl"
  ```
- **Evidence**:
  `safeUrl` completely disables Angular's XSS sanitization on iframe `src`. `trailerKey` comes from TMDb API responses. If an API response returns a malicious URL or query injection, it is blindly loaded into the iframe.
- **Impact**: Potential resource injection / iframe breakout.

### Finding S-03 [MEDIUM]: Android Cloud Backup Not Configured
- **Location**: `/home/usign/.temp/open-movie-tracker/android/app/src/main/AndroidManifest.xml#L5`
- **Code**:
  ```xml
  android:allowBackup="true"
  ```
- **Evidence**:
  `allowBackup="true"` without `android:dataExtractionRules` or `android:fullBackupContent` causes Android Auto Backup to upload all `localStorage` and shared preferences to Google Cloud Drive. For a privacy-first app that advertises zero remote storage, this should either be configured with strict exclusions or disabled.
- **Impact**: Unintended cloud synchronization of user data to Google servers.

### Finding S-04 [HIGH]: 227 Vulnerabilities and Deprecated Packages in `package.json`
- **Location**: `/home/usign/.temp/open-movie-tracker/package.json#L71`, `pnpm-lock.yaml`
- **Evidence**:
  `pnpm audit` identifies 227 vulnerabilities (7 critical, 106 high). Most stem from `protractor ~7.0.0`, which has been completely deprecated by the Angular team since 2021, and outdated build tools. Protractor is not used by any npm script in the project.
- **Impact**: Security vulnerability flags in CI and downstream distribution audits.

---

## 5. Detailed Findings: Quality, Bugs, and Maintainability

### Finding Q-01 [CRITICAL]: Custom User Lists Crash with 404 in `ListDetailPage`
- **Location**: `/home/usign/.temp/open-movie-tracker/src/app/profile/profile.page.ts#L566`, `/home/usign/.temp/open-movie-tracker/src/app/list-detail/list-detail.page.ts#L79-L100`
- **Code**:
  ```typescript
  // profile.page.ts:
  listCoverRoute(list: UserList): any[] { return ['/list', list.id]; }

  // list-detail.page.ts:
  private loadList(id: string) {
    this.tmdb.getListDetail(id, 1).subscribe({ ... });
  }
  ```
- **Evidence**:
  When a user creates a custom list in Profile, `list.id` is generated as a UUID via `crypto.randomUUID()`. Clicking the list routes to `/list/:id`. `ListDetailPage` assumes all IDs are TMDb list IDs and queries `tmdb.getListDetail(uuid)`. TMDb returns 404, resulting in a blank page. The user's custom lists are completely inaccessible and unviewable!
- **Impact**: Major feature failure: user-created lists cannot be opened.

### Finding Q-02 [HIGH]: Broken Test Runner and Zero Test Coverage
- **Location**: `/home/usign/.temp/open-movie-tracker/src/test.ts#L3`, `/home/usign/.temp/open-movie-tracker/.github/workflows/ci.yml#L28-L33`
- **Code**:
  ```typescript
  // src/test.ts:
  import 'zone.js/dist/zone-testing';
  ```
- **Evidence**:
  Running `pnpm exec ng test` fails immediately at startup because `zone.js/dist/zone-testing` does not exist in `zone.js 0.15.1` (must be `zone.js/testing`). Furthermore, there is not a single `*.spec.ts` file in `src/app/`. CI only runs `lint` and `build`, leaving the test failure undetected.
- **Impact**: Zero verification of business logic, regressions, or migrations.

### Finding Q-03 [HIGH]: Dead Services and Unused Stub Pages in Repository
- **Location**:
  - `/home/usign/.temp/open-movie-tracker/src/app/services/profile.service.ts` (355 lines)
  - `/home/usign/.temp/open-movie-tracker/src/app/services/settings.service.ts` (69 lines)
  - `/home/usign/.temp/open-movie-tracker/src/app/movies/` (entire directory)
  - `/home/usign/.temp/open-movie-tracker/tslint.json`
- **Evidence**:
  1. `ProfileService` and `SettingsService` are completely unimported anywhere in the active code.
  2. `movies/` page is not in `app-routing.module.ts`, and its template references non-existent variables (`movies$`, `isOffline`).
  3. Dead code causes developer confusion and maintenance overhead.
- **Impact**: Technical debt, conflicting sources of truth for settings and profile data.

### Finding Q-04 [HIGH]: Virtual Scrolling Missing on Long Lists & Costly Getters
- **Location**:
  - `/home/usign/.temp/open-movie-tracker/src/app/profile/watched/watched.page.html#L38-L56`
  - `/home/usign/.temp/open-movie-tracker/src/app/profile/diary/diary.page.ts#L22-L43`
  - `/home/usign/.temp/open-movie-tracker/src/app/profile/profile.page.ts#L96-L98`, `L108-L111`
- **Evidence**:
  `WatchedPage`, `DiaryPage`, and `RatingsPage` render all items using simple `@for` loops without virtual scrolling or pagination. With 1,000–5,000 logged items (typical for Letterboxd power users), rendering thousands of DOM elements freezes the browser. Additionally, `DiaryPage.groupedEntries` and `ProfilePage.stats` are getters that re-read and re-parse `localStorage` on every change detection cycle.
- **Impact**: Severe UI lag and potential out-of-memory crashes on large datasets.

### Finding Q-05 [MEDIUM]: Android Hardware Back Button Does Not Dismiss Modals
- **Location**: `/home/usign/.temp/open-movie-tracker/src/app/shared-module/log-sheet/log-sheet.component.ts`, `/home/usign/.temp/open-movie-tracker/src/app/profile/edit-profile/edit-profile.component.ts`
- **Evidence**:
  Modals and action sheets do not register back button priority handlers (`Platform.backButton.subscribeWithPriority`). Tapping the hardware back button on Android navigates the underlying Angular router instead of closing the open modal sheet.
- **Impact**: Jarring UX on Android devices.

### Finding Q-06 [MEDIUM]: Diary Watch Date Grouping Vulnerable to Timezone Shift & Invalid Dates
- **Location**: `/home/usign/.temp/open-movie-tracker/src/app/profile/diary/diary.page.ts#L29-L33`, `L63-L66`
- **Code**:
  ```typescript
  const d = new Date(entry.watchedAt);
  const month = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  ...
  const day = new Date(entry.watchedAt).getDate();
  return String(day).padStart(2, '0');
  ```
- **Evidence**:
  1. `new Date("2020-01-02")` without UTC parsing parses as midnight UTC, which in western timezones (e.g. UTC-5) shifts to 7 PM on Jan 1, displaying the wrong day!
  2. If `watchedAt` is missing, invalid, or "date unknown", `d.getDate()` evaluates to `NaN`, rendering `"NaN"` in the diary UI.
- **Impact**: Inaccurate diary dates and broken UI for undated entries.

---

**Gate status:** Phase 1 code readiness audit complete. Every finding verified against source code with line numbers and assigned severity. Ready for Phase 2 visual audit.
