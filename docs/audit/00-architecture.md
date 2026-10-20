# Phase 0: Codebase Comprehension & Architecture Map

Date of audit: 2026-10-20
Target repository: `/home/usign/.temp/open-movie-tracker`
Application: Open Movie Tracker (v0.12.0)

---

## 1. Routing Map & Page/Component Inventory

### 1.1 Complete Route Table

The routing is configured in `/home/usign/.temp/open-movie-tracker/src/app/app-routing.module.ts`, `/home/usign/.temp/open-movie-tracker/src/app/tabs/tabs-routing.module.ts`, and `/home/usign/.temp/open-movie-tracker/src/app/profile/profile-routing.module.ts`.

| URL Path | Module | Page / Component | Services Injected | Description |
|---|---|---|---|---|
| `/` | `TabsPageModule` | Redirects to `/tabs/home` | - | Root redirect |
| `/tabs/home` | `HomePageModule` | `HomePage` | `TmdbService`, `NetworkService` | Home dashboard: trending hero carousel, horizontal carousels for popular, now playing, upcoming movies and TV |
| `/tabs/discover` | `DiscoverPageModule` | `DiscoverPage` | `TmdbService`, `UserDataService`, `Location`, `Router`, `ActivatedRoute` | Three modes: Explore (trending/popular grids), Browse (filter by genre, year, sort), and List (see all from home) |
| `/tabs/search` | `SearchPageModule` | `SearchPage` | `TmdbService`, `NetworkService`, `Router` | Debounced multi-search (movies, TV, people), recent searches, browse genres |
| `/tabs/profile` | `ProfilePageModule` | `ProfilePage` | `UserDataService`, `ModalController`, `AlertController`, `ActionSheetController`, `ChangeDetectorRef` | Profile overview, 6 quick links, stats cards, rating & momentum charts, favorites (up to 4), custom lists, activity feed |
| `/tabs/profile/watched` | `WatchedPageModule` | `WatchedPage` | `UserDataService`, `ActionSheetController`, `Router` | Filterable (all/movies/tv, search) and sortable (newest, oldest, rating, title) list of all logged items |
| `/tabs/profile/watchlist` | `WatchlistPageModule` | `WatchlistPage` | `UserDataService`, `ActionSheetController`, `Router` | Watchlist management with search and media type filter |
| `/tabs/profile/favorite` | `FavoritePageModule` | `FavoritePage` | `UserDataService` | View and remove favorites filtered by movie or TV |
| `/tabs/profile/liked` | `LikedPageModule` | `LikedPage` | `UserDataService` | Watched entries flagged as liked |
| `/tabs/profile/diary` | `DiaryPageModule` | `DiaryPage` | `UserDataService`, `ActionSheetController`, `Router` | Chronological diary grouped by month and year |
| `/tabs/profile/ratings` | `RatingsPageModule` | `RatingsPage` | `UserDataService` | All rated entries sorted by highest, lowest, or most recent |
| `/tabs/profile/reviews` | `UserReviewsPageModule` | `UserReviewsPage` | `UserDataService` | Written user reviews with search filter |
| `/movie/:id` | `FilmPageModule` | `FilmPage` | `TmdbService`, `UserDataService`, `LogSheetService`, `ToastService`, `ModalController`, `ActionSheetController`, `ActivatedRoute` | Movie details: overview, backdrop slideshow, poster viewer, cast, director, trailers, similar, recommendations, reviews, featured TMDb lists |
| `/movie/:id/reviews` | `ReviewsPageModule` | `ReviewsPage` | `TmdbService`, `ActivatedRoute` | TMDb critic/user reviews for a movie with search and sorting |
| `/movie/:id/lists` | `FilmListsPageModule` | `FilmListsPage` | `TmdbService`, `UserDataService`, `Router`, `ActivatedRoute` | TMDb lists containing the movie, with bookmarking |
| `/tv/:id` | `TvPageModule` | `TvPage` | `TmdbService`, `UserDataService`, `LogSheetService`, `ToastService`, `ModalController`, `ActionSheetController`, `ActivatedRoute` | TV show details: backdrop slideshow, cast, seasons list, trailers, similar, recommendations, reviews, featured TMDb lists |
| `/tv/:id/reviews` | `ReviewsPageModule` | `ReviewsPage` | `TmdbService`, `ActivatedRoute` | TMDb reviews for a TV show |
| `/tv/:id/season/:seasonNumber` | `TvSeasonPageModule` | `TvSeasonPage` | `TmdbService`, `UserDataService`, `ActivatedRoute` | Episode list with toggleable watched state per episode |
| `/tv/:id/lists` | `TvListsPageModule` | `TvListsPage` | `TmdbService`, `UserDataService`, `Router`, `ActivatedRoute` | TMDb lists containing the TV show, with bookmarking |
| `/person/:id` | `PersonPageModule` | `PersonPage` | `TmdbService`, `ModalController`, `ChangeDetectorRef`, `ActivatedRoute` | Person biography, combined credits (acting/crew), photo gallery |
| `/settings` | `SettingsPageModule` | `SettingsPage` | `UserDataService`, `UpdateService`, `ToastService`, `AlertController`, `ChangeDetectorRef` | Theme, primary color, language exclusion, safe search, export/import JSON, clear logs, update checker |
| `/list/:id` | `ListDetailPageModule` | `ListDetailPage` | `TmdbService`, `UserDataService`, `ActivatedRoute` | TMDb list detail with infinite scroll and bookmark toggle. (Bug note: does not handle custom local user lists!) |
| Unrouted | `MoviesPageModule` | `MoviesPage` | None | Dead stub page in `/home/usign/.temp/open-movie-tracker/src/app/movies/` |

---

### 1.2 Modal & Shared Components Inventory

Located in `/home/usign/.temp/open-movie-tracker/src/app/shared-module/` and sub-directories:

- `app-hero-banner` (`/home/usign/.temp/open-movie-tracker/src/app/shared-module/hero-banner/`): Hero backdrop carousel with auto-cycling, backdrop transition, movie metadata, and detail navigation.
- `app-media-carousel` (`/home/usign/.temp/open-movie-tracker/src/app/shared-module/media-carousel/`): Horizontally scrollable list of poster cards with header title and "See All" navigation link.
- `app-movie-card` (`/home/usign/.temp/open-movie-tracker/src/app/shared-module/movie-card/`): Card with poster, title, year, rating, and action sheet for logging / watchlist / favorites.
- `app-poster-card` (`/home/usign/.temp/open-movie-tracker/src/app/shared-module/poster-card/`): Compact vertical poster card with long-press gesture to open `LogSheetComponent`.
- `app-skeleton-card` (`/home/usign/.temp/open-movie-tracker/src/app/shared-module/skeleton-card/`): Animated placeholder skeleton card for loading states.
- `app-star-rating` (`/home/usign/.temp/open-movie-tracker/src/app/shared-module/star-rating/`): Interactive 5-star rating control supporting 0.5 step increments.
- `app-image-viewer` (`/home/usign/.temp/open-movie-tracker/src/app/shared-module/image-viewer/`): Fullscreen image modal for viewing posters/backdrops with a download anchor button.
- `app-offline-banner` (`/home/usign/.temp/open-movie-tracker/src/app/shared-module/offline-banner/`): Sticky warning banner indicating lack of network connection.
- `app-log-sheet` (`/home/usign/.temp/open-movie-tracker/src/app/shared-module/log-sheet/`): Ionic bottom-sheet modal for logging a title: rating, like flag, rewatch flag, date picker, review text, custom tags, watchlist toggle, and custom list membership.
- `app-edit-profile` (`/home/usign/.temp/open-movie-tracker/src/app/profile/edit-profile/`): Modal to edit display name and bio.
- `app-add-favorite-modal` (`/home/usign/.temp/open-movie-tracker/src/app/profile/add-favorite-modal/`): Search modal querying TMDb to select up to 4 favorites.

---

## 2. Local Data Model

All active application data is managed through `/home/usign/.temp/open-movie-tracker/src/app/services/user-data.service.ts` and stored in `localStorage` under `mva_` prefixed keys (with a few un-prefixed outliers in other components):

### 2.1 Key Inventory & Shapes

#### 1. `mva_profile`
- **Type**: `UserProfile`
- **Shape**:
  ```typescript
  interface UserProfile {
    displayName: string;
    bio: string;
    avatarBase64: string | null;
    coverBase64: string | null;
    joinedAt: string; // ISO 8601
  }
  ```
- **Readers**: `ProfilePage`, `SettingsPage`, `UserDataService.getProfile()`
- **Writers**: `UserDataService.saveProfile()`, `SettingsPage.importData()`

#### 2. `mva_watched`
- **Type**: `Record<string, WatchedEntry>` where the key is formatted as `"${media_type}:${id}"` (e.g. `"movie:550"` or `"tv:1399"`).
- **Shape**:
  ```typescript
  interface WatchedEntry {
    id: number;
    media_type: 'movie' | 'tv';
    title: string;
    poster_path: string | null;
    watchedAt: string; // ISO 8601 string
    rewatch: boolean;
    rating: number | null; // 0.5 to 5.0 in 0.5 steps
    review: string;
    tags: string[];
    liked: boolean;
    release_date?: string;
    first_air_date?: string;
  }
  ```
- **Readers**: `UserDataService`, `ProfilePage`, `WatchedPage`, `DiaryPage`, `RatingsPage`, `UserReviewsPage`, `LikedPage`, `FilmPage`, `TvPage`, `LogSheetComponent`
- **Writers**: `UserDataService.logEntry()`, `UserDataService.removeWatched()`, `SettingsPage.clearWatchLog()`, `SettingsPage.importData()`

#### 3. `mva_watchlist`
- **Type**: `Record<string, WatchlistEntry>` keyed by `"${media_type}:${id}"`.
- **Shape**:
  ```typescript
  interface WatchlistEntry {
    id: number;
    media_type: 'movie' | 'tv';
    title: string;
    poster_path: string | null;
    addedAt: string; // ISO 8601
    release_date?: string;
    first_air_date?: string;
  }
  ```
- **Readers**: `UserDataService.getWatchlist()`, `WatchlistPage`, `LogSheetComponent`
- **Writers**: `UserDataService.addToWatchlist()`, `UserDataService.removeFromWatchlist()`, `SettingsPage.importData()`

#### 4. `mva_favorites`
- **Type**: `FavoriteEntry[]` (capped at 4 items).
- **Shape**:
  ```typescript
  interface FavoriteEntry {
    id: number;
    media_type: 'movie' | 'tv';
    title: string;
    poster_path: string | null;
  }
  ```
- **Readers**: `UserDataService.getFavorites()`, `ProfilePage`, `FavoritePage`
- **Writers**: `UserDataService.addFavorite()`, `UserDataService.removeFavorite()`, `UserDataService.reorderFavorites()`, `SettingsPage.importData()`

#### 5. `mva_lists`
- **Type**: `Record<string, UserList>` keyed by UUID string.
- **Shape**:
  ```typescript
  interface UserList {
    id: string; // UUID
    name: string;
    description: string;
    createdAt: string; // ISO 8601
    items: WatchlistEntry[];
  }
  ```
- **Readers**: `UserDataService.getLists()`, `UserDataService.getList()`, `ProfilePage`, `LogSheetComponent`
- **Writers**: `UserDataService.createList()`, `UserDataService.deleteList()`, `UserDataService.addToList()`, `UserDataService.removeFromList()`, `SettingsPage.importData()`

#### 6. `mva_settings`
- **Type**: `SettingsRecord`
- **Shape**:
  ```typescript
  interface AppSettings {
    theme: 'system' | 'light' | 'dark';
    language: string;
    region: string;
    includeAdult: boolean;
    displayName: string;
    excludeLanguages: string[];
    fadeWatched: boolean;
    defaultMediaTab: 'movies' | 'tv';
    primaryColor: 'green' | 'red';
  }
  // Internal extension:
  type SettingsRecord = AppSettings & {
    episodeWatched?: Record<string, boolean>; // Keyed by "${tvId}-${season}-${episode}"
  };
  ```
- **Readers**: `UserDataService.getSettings()`, `TmdbService`, `AppComponent`, `SettingsPage`
- **Writers**: `UserDataService.saveSetting()`, `UserDataService.toggleEpisodeWatched()`, `UserDataService.markSeasonWatched()`

#### 7. `mva_bookmarked_lists`
- **Type**: Array of bookmarked TMDb list objects.
- **Readers**: `UserDataService.getBookmarkedLists()`, `ProfilePage`, `FilmListsPage`, `TvListsPage`, `ListDetailPage`
- **Writers**: `UserDataService.bookmarkList()`, `UserDataService.unbookmarkList()`

#### 8. `mva_recent_lists`
- **Type**: Array of up to 10 recently viewed TMDb list objects.
- **Readers**: `UserDataService.getRecentlyViewedLists()`, `DiscoverPage`
- **Writers**: `UserDataService.recordListView()`

#### 9. `mva_list_scroll`
- **Type**: `Record<string, { scrollY: number; tmdbPage: number }>`
- **Readers/Writers**: `UserDataService.saveListScrollState()`, `UserDataService.getListScrollState()`, `ListDetailPage`

#### Outliers (Non-`mva_` keys still in use):
- `recentSearches`: Used directly by `/home/usign/.temp/open-movie-tracker/src/app/search/search.page.ts` (array of strings, up to 10). Not managed by `UserDataService`.
- `tmdb_cache_v2:<path>?<params>`: Used directly by `/home/usign/.temp/open-movie-tracker/src/app/services/tmdb.service.ts` for HTTP response caching.

---

## 3. Existing Export / Import Implementation

Located in `/home/usign/.temp/open-movie-tracker/src/app/settings/settings.page.ts` (lines 310–369):

### 3.1 Export
- **Format**: Plain JSON file (`movieapp-backup.json`).
- **Keys exported**: Only 6 keys: `['mva_profile', 'mva_watched', 'mva_watchlist', 'mva_favorites', 'mva_lists', 'mva_settings']`.
- **Omissions**: `mva_bookmarked_lists`, `mva_recent_lists`, `mva_list_scroll`, and `recentSearches` are **not** exported.
- **Versioning**: There is **no schema version** or metadata in the exported JSON file.
- **Mechanism**: Dynamically creates a Blob and triggers `<a download="movieapp-backup.json">.click()`.
- **Platform risk**: Web download fails silently or opens as raw text on Android WebViews without Capacitor Filesystem.

### 3.2 Import
- **Validation**: **Zero validation**. It calls `JSON.parse(e.target.result)` and immediately iterates through the 6 known keys:
  ```typescript
  keys.forEach((k) => {
    if (data[k] !== undefined) {
      localStorage.setItem(k, JSON.stringify(data[k]));
    }
  });
  ```
- **Merge vs Replace**: **Blind replace** per key. It overwrites the existing key with whatever was in the file.
- **Feedback**: Displays a toast `"Data imported. Reload to see changes."` (Does not trigger state refresh or reload window).
- **Security & Stability Risk**:
  - Malformed or oversized files (e.g. 50MB) can exhaust `localStorage` quota or freeze the browser.
  - Can inject arbitrary corrupted object structures into `mva_watched`, causing runtime null dereferences across the entire app.

### 3.3 Limitations of Current `WatchedEntry` for Letterboxd Import
1. **No Multiple Entries per Title (Rewatches)**:
   - In `UserDataService`, `WatchedEntry` is keyed as `"${media_type}:${id}"`.
   - Storing a new watch record for an already watched title **overwrites** the existing entry. Rewatch is merely a boolean flag `rewatch: true` on the single entry.
   - Multiple dated logs for the same film cannot be stored in the current schema.
2. **No Stable External Source Key**:
   - There is no field for an external identifier (e.g. Letterboxd URI `https://boxd.it/...`).
3. **No "Date Unknown" State**:
   - `watchedAt` is typed as `string` and defaults to `new Date().toISOString()`.
   - Logging an item without a specific date fabricates today's timestamp, corrupting chronological diary records.

---

## 4. TMDb ID Storage & Media Type Distinguishability

- **Storage in `WatchedEntry`**:
  `id: number`, `media_type: 'movie' | 'tv'`. Distinguishable via `media_type`. Key format is `${media_type}:${id}`.
- **Storage in `WatchlistEntry`**:
  `id: number`, `media_type: 'movie' | 'tv'`. Key format is `${media_type}:${id}`.
- **Storage in `FavoriteEntry`**:
  `id: number`, `media_type: 'movie' | 'tv'`. Array of up to 4 objects.
- **Storage in `UserList`**:
  Contains `items: WatchlistEntry[]` where each item has `id` and `media_type`.
- **Legacy migration risk**:
  In `UserDataService.migrateFromLegacy()`, legacy keys were split into `watchedMovies` vs `watchedTv`. Some items lacked `media_type` and inferred it via `item.first_air_date ? 'tv' : 'movie'`.

---

## 5. TMDb Usage Map

Implemented in `/home/usign/.temp/open-movie-tracker/src/app/services/tmdb.service.ts`:

### 5.1 Endpoints Called
- Trending:
  - `GET /trending/all/{timeWindow}`
  - `GET /trending/movie/{timeWindow}`
  - `GET /trending/tv/{timeWindow}`
  - `GET /trending/person/{timeWindow}`
- Movies:
  - `GET /movie/popular`
  - `GET /movie/top_rated`
  - `GET /movie/now_playing`
  - `GET /movie/upcoming`
  - `GET /movie/{id}?append_to_response=release_dates`
  - `GET /movie/{id}/credits`
  - `GET /movie/{id}/videos`
  - `GET /movie/{id}/images`
  - `GET /movie/{id}/similar`
  - `GET /movie/{id}/recommendations`
  - `GET /movie/{id}/reviews`
  - `GET /collection/{collectionId}`
  - `GET /movie/{id}/keywords`
  - `GET /discover/movie`
  - `GET /genre/movie/list`
- TV:
  - `GET /tv/popular`
  - `GET /tv/top_rated`
  - `GET /tv/airing_today`
  - `GET /tv/on_the_air`
  - `GET /tv/{id}?append_to_response=content_ratings`
  - `GET /tv/{id}/credits`
  - `GET /tv/{id}/videos`
  - `GET /tv/{id}/images`
  - `GET /tv/{id}/similar`
  - `GET /tv/{id}/recommendations`
  - `GET /tv/{id}/reviews`
  - `GET /tv/{tvId}/season/{seasonNumber}`
  - `GET /discover/tv`
  - `GET /genre/tv/list`
- People:
  - `GET /person/{id}?append_to_response=combined_credits,external_ids`
  - `GET /person/{id}/combined_credits`
  - `GET /person/{id}/images`
- Lists:
  - `GET /movie/{id}/lists`
  - `GET /tv/{id}/lists`
  - `GET /list/{id}`
- Search:
  - `GET /search/multi`
  - `GET /search/movie`
  - `GET /search/tv`
  - `GET /search/person`

### 5.2 Caching Behavior
- Prefix: `tmdb_cache_v2:`
- Storage: `localStorage`
- TTL: 7 days (`1000 * 60 * 60 * 24 * 7`)
- Max entries: 250 items, pruned by oldest timestamp when quota exceeds 250.
- Fallback: On network error or offline (`!navigator.onLine`), returns cached payload if available.
- **Bug in `catchError`**: In line 61 of `/home/usign/.temp/open-movie-tracker/src/app/services/tmdb.service.ts`:
  ```typescript
  catchError((err) => {
    if (cached !== null) {
      return [cached]; // BUG: Emits Array<T> rather than of(cached) / Observable<T>
    }
    return throwError(() => err);
  })
  ```

### 5.3 Rate-Limit & Concurrency Behavior
- TMDb has rate limits (40 requests per 10 seconds per IP, HTTP 429).
- Currently: **No rate limit handling, no retry/backoff, no request queuing, no concurrency limiting, and no in-flight request deduplication.**

### 5.4 Language, Region & Safe Search Handling
- Query parameters `language`, `region`, and `include_adult` are appended automatically via `this.userData.getSettings()`.
- Language blocking: `excludeLanguages` filters out responses where `original_language` matches blocked codes (post-filtered in client memory).

---

## 6. State Management, Change Detection & Logic Duplication

### 6.1 State Management & Reactivity
- The app uses standard Angular Zone.js (`zone.js ~0.15.1`).
- `UserDataService` does **not** expose reactive streams (`Observable` / `Signal`) for its primary state (`mva_watched`, `mva_profile`, `mva_watchlist`, etc.).
- Instead, pages call synchronous getters (`this.userData.getWatched()`, `this.userData.getSettings()`, etc.).
- Multiple components use `ChangeDetectionStrategy.OnPush` with custom property getters (e.g. `ProfilePage.stats`, `ProfilePage.watchedEntries`, `DiaryPage.groupedEntries`, `WatchedPage.filteredEntries`). Because they are getters in the template, every change detection cycle re-reads and re-parses from `localStorage`!
- Updates to `UserDataService` do not automatically trigger change detection in distant components unless navigated or manually forced with `markForCheck()`.

### 6.2 Duplication & Architecture Smells
- **Backdrop Slideshow Logic**: Identical 100-line backdrop slideshow timer, sizing, and transition logic duplicated in both `/home/usign/.temp/open-movie-tracker/src/app/film/film.page.ts` and `/home/usign/.temp/open-movie-tracker/src/app/tv/tv.page.ts`.
- **List Fetching & Bookmark Logic**: Identical sorting, pagination, and bookmark animation logic duplicated in `/home/usign/.temp/open-movie-tracker/src/app/film-lists/film-lists.page.ts` and `/home/usign/.temp/open-movie-tracker/src/app/tv-lists/tv-lists.page.ts`.
- **Genre Colors & Icons**: Identical 100-line dictionary maps of TMDb genre IDs to CSS gradients and IonIcons duplicated in both `/home/usign/.temp/open-movie-tracker/src/app/discover/discover.page.ts` and `/home/usign/.temp/open-movie-tracker/src/app/search/search.page.ts`.

---

## 7. Legacy vs Current: Dead Services & Stub Pages

### 7.1 `profile.service.ts`
- **Location**: `/home/usign/.temp/open-movie-tracker/src/app/services/profile.service.ts` (355 lines)
- **Status**: **Completely dead / orphaned**.
- **Evidence**: Grepping across all templates and code shows 0 imports. It still reads/writes legacy keys (`watchedMovies`, `ratings`, `customLists`, `activity`, etc.). Superseded entirely by `user-data.service.ts`.

### 7.2 `settings.service.ts`
- **Location**: `/home/usign/.temp/open-movie-tracker/src/app/services/settings.service.ts` (69 lines)
- **Status**: **Completely dead / orphaned**.
- **Evidence**: Grepping across all templates and code shows 0 imports. Reads/writes legacy `appSettings` key. Superseded entirely by `user-data.service.ts`.

### 7.3 `movies/` Stub Page
- **Location**: `/home/usign/.temp/open-movie-tracker/src/app/movies/`
- **Status**: **Completely dead / unrouted**.
- **Evidence**: It has no route in `app-routing.module.ts`. Furthermore, its template `/home/usign/.temp/open-movie-tracker/src/app/movies/movies.page.html` references non-existent variables (`movies$`, `isOffline`, `loadMoreData`) that do not exist in `/home/usign/.temp/open-movie-tracker/src/app/movies/movies.page.ts`.

---

## 8. Build, Test, Lint, and CI Health Baseline

Commands executed at `/home/usign/.temp/open-movie-tracker`:

### 8.1 Lint (`pnpm run lint`)
- **Result**: PASSED with TypeScript version warning:
  ```
  WARNING: You are currently running a version of TypeScript which is not officially supported by @typescript-eslint/typescript-estree.
  SUPPORTED TYPESCRIPT VERSIONS: >=3.3.1 <4.5.0
  YOUR TYPESCRIPT VERSION: 5.9.3
  All files pass linting.
  ```
- **Finding**: ESLint config uses ancient `@typescript-eslint/parser 5.3.0` and `eslint 7.32.0`, while TypeScript is `5.9.3`. Also dead `tslint.json` file is present in the repository root.

### 8.2 Production Build (`pnpm exec ng build --configuration production`)
- **Result**: PASSED in 27.2s.
- **Bundle Sizes**:
  - Initial Total: ~445 kB (raw JS + CSS)
    - `main.e84242d93e15ba6b.js`: 272.23 kB (gzip: 65.57 kB)
    - `styles.f6ab58f844b20a7b.css`: 113.12 kB (gzip: 15.65 kB)
    - `polyfills.605ec0bc9cfd22f8.js`: 54.89 kB (gzip: 15.54 kB)
    - `runtime.37a7ec4c8b21ba17.js`: 4.54 kB (gzip: 1.83 kB)
  - Lazy Chunks:
    - `3120.3a0058b874cb35be.js`: 152.09 kB (Ionic core components)
    - `profile-profile-module`: 24.16 kB
    - `discover-discover-module`: 22.04 kB
    - `film-film-module`: 20.39 kB
    - `settings-settings-module`: 20.15 kB
    - `tv-tv-module`: 19.38 kB
    - `search-search-module`: 18.23 kB

### 8.3 Test Suite (`pnpm exec ng test --watch=false --browsers=ChromeHeadless`)
- **Result**: **FAILED IMMEDIATELY**.
- **Error**:
  ```
  ./src/test.ts:2:0-35 - Error: Module not found: Error: "./dist/zone-testing" is not exported under the conditions ["es2020","es2015","import","module","webpack","development","browser"] from package /home/usign/.temp/open-movie-tracker/node_modules/zone.js
  ```
- **Root Cause**:
  `/home/usign/.temp/open-movie-tracker/src/test.ts` line 3 imports `'zone.js/dist/zone-testing'`. In `zone.js 0.15.1`, the export path is `'zone.js/testing'`.
- **Test Inventory**: There are **0 spec files** (`*.spec.ts`) in the entire repository. The data layer, services, and components currently have 0% automated test coverage.
- **CI Blindspot**: `.github/workflows/ci.yml` only runs `lint` and `ng build --configuration production`; it **never** runs `ng test`. Hence, broken tests went undetected in CI.

---

**Gate status:** Phase 0 baseline recorded. Ready for Phase 1 investigation.
