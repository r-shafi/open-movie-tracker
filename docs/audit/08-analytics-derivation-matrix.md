# Open Movie Tracker — Analytics Derivation Matrix & Data Inventory

**Document:** `docs/audit/08-analytics-derivation-matrix.md`  
**Date:** 2026-10-21  
**Branch:** `feat/production-readiness-and-letterboxd-import`  
**Scope:** Data inventory, TMDb metadata schema extension, and multi-dataset derived analytics matrix.

---

## 1. Data Inventory & Field Coverage

We surveyed all fields across the three available operational sources:
1. **Local User Actions:** Watched entries, ratings, rewatches, reviews, tags, likes, undated flags.
2. **Watchlist & Lists:** Watchlist items (with imported `addedAt` timestamp) and custom user lists.
3. **TMDb Metadata Snapshot:** Stored per-title metadata cache.

### Dataset Field Inventory & Coverage Audit

| Dataset / Field | Type / Source | Real Profile Coverage (1,066) | Synthetic 1,000 Fixture | Synthetic 30% Fixture | Notes / Validation Status |
|---|---|---|---|---|---|
| **Local Watched Logs** | | | | | |
| `entryId` | UUID string | 1,066 / 1,066 (100%) | 1,000 (100%) | 1,000 (100%) | Stable unique identifier per log event |
| `id` & `media_type` | number & 'movie'\|'tv' | 1,066 / 1,066 (100%) | 1,000 (100%) | 1,000 (100%) | Foreign key to TMDb entity |
| `watchedAt` | ISO date string | 631 / 1,066 (59.2%) | 966 (96.6%) | 966 (96.6%) | Exact watch date from `diary.csv` |
| `dateUnknown` | boolean | 435 / 1,066 (40.8%) | 34 (3.4%) | 34 (3.4%) | Undated entries from `ratings.csv` / `watched.csv` |
| `approximateDate` | boolean | 0 / 1,066 (0%) | 0 (0%) | 0 (0%) | Opt-in Letterboxd mark date |
| `rating` | number (0.5 to 5.0) | 979 / 1,066 (91.8%) | 800 (80.0%) | 800 (80.0%) | 10 rating steps (0.5★ increments) |
| `rewatch` | boolean | 54 / 1,066 (5.1%) | 143 (14.3%) | 143 (14.3%) | Explicit rewatch flag |
| `review` | string | 53 / 1,066 (5.0%) | 250 (25.0%) | 250 (25.0%) | User review text |
| `tags` | string[] | 0 / 1,066 (0%) | 1,000 (100%) | 1,000 (100%) | Tag taxonomy |
| `liked` | boolean | 91 / 1,066 (8.5%) | 334 (33.4%) | 334 (33.4%) | Heart / like status |
| **Watchlist & Lists** | | | | | |
| `watchlist.addedAt` | ISO date string | 163 / 163 (100%) | 1 (100%) | 1 (100%) | Fixed: preserved from `watchlist.csv` |
| `customLists` | object records | 7 lists, 70 items | 1 list, 2 items | 1 list, 2 items | User curated list bundles |
| **TMDb Snapshot (Current)** | | | | | |
| `runtimeMinutes` | number | ~43% (in progress) | 1,000 (100%) | 300 (30.0%) | Movie runtime; requires TV episode fix |
| `genres` | `{ id, name }[]` | ~43% (in progress) | 1,000 (100%) | 300 (30.0%) | Categorical genres |
| `releaseYear` / `releaseDate`| number / string | 1,066 / 1,066 (100%) | 1,000 (100%) | 1,000 (100%) | Year from CSV fallback + TMDb exact date |
| `originalLanguage` | string (ISO-639) | ~43% (in progress) | 1,000 (100%) | 300 (30.0%) | Original language |
| `productionCountries` | string[] (ISO-3166) | ~43% (in progress) | 1,000 (100%) | 300 (30.0%) | Production country codes |
| `directors` | `{ id, name }[]` | ~43% (in progress) | 1,000 (100%) | 300 (30.0%) | Director crew credits |
| `topCast` | `{ id, name }[]` | ~43% (in progress) | 1,000 (100%) | 300 (30.0%) | Top 5 billed actors |
| `tmdbVoteAverage` | number | ~43% (in progress) | 1,000 (100%) | 300 (30.0%) | Community average (0-10) |

---

## 2. TMDb Snapshot Extension Analysis

To unlock pro-grade analytics without extra HTTP latency or breaking storage budgets, we analyze candidate fields obtainable via endpoints already invoked by the application (`/movie/{id}?append_to_response=credits,keywords` and `/tv/{id}?append_to_response=credits,aggregate_credits`):

| Proposed Field | Source TMDb Endpoint / Property | Added Payload Size | Extra API Calls | Analytics Unlocked | Recommendation |
|---|---|---|---|---|---|
| `directors[].profilePath` | `credits.crew[job='Director'].profile_path` | ~35 bytes / person | 0 calls | Circular portraits in People Carousel (Req B) | **ADD (P0)** |
| `topCast[].profilePath` | `credits.cast[].profile_path` | ~35 bytes / person | 0 calls | Circular portraits in People Carousel (Req B) | **ADD (P0)** |
| `tmdbVoteCount` | Movie/TV root `vote_count` | ~8 bytes / film | 0 calls | Obscurity / Hipster Index; Bayesian weight | **ADD (P0)** |
| `tmdbPopularity` | Movie/TV root `popularity` | ~8 bytes / film | 0 calls | Obscurity vs Rating 4-Quadrant Scatter | **ADD (P0)** |
| `belongsToCollection` | Movie root `belongs_to_collection` | ~50 bytes / film | 0 calls | Franchise & Universe Completionist Tracking | **ADD (P1)** |
| `productionCompanies` | Movie root `production_companies` | ~45 bytes / film | 0 calls | Studio & Producer Affinity (A24, Ghibli, etc.) | **ADD (P1)** |
| `keywords` | `keywords.keywords` | ~80 bytes / film | 0 calls (in append) | Thematic seasonality (holiday, noir, heist) | **ADD (P1)** |
| `budget` & `revenue` | Movie root `budget`, `revenue` | ~16 bytes / film | 0 calls | Indie vs Blockbuster taste ratio | **ADD (P2)** |
| `tvEpisodes` | TV season details or `episode_run_time` | ~120 bytes / series | 0 calls (fallback) / 1 per season | Exact TV watch time based on watched episodes | **ADD (P0)** |

**Storage Impact Assessment:**  
The baseline `MediaMetadataSnapshot` occupies ~340 bytes per entry. Adding `profilePath`, `voteCount`, `popularity`, `belongsToCollection`, and `productionCompanies` increases snapshot size to ~480 bytes (+140 bytes, +41%). For a 1,000-film catalog, this adds ~140 KB total in `localStorage`—well within the 5 MB to 10 MB web storage ceiling.

---

## 3. Analytics Derivation Matrix

Every metric combines **two or more independent data sources** (e.g., User Log × TMDb Metadata, Watchlist × Taste Model, Diary Time × TMDb Duration).

### Priority Definitions
- **P0 (Build Now — Core Pro):** Critical for parity with Letterboxd Pro / Trakt VIP, resolving all bugs, and delivering graphical insights.
- **P1 (Build Now — Extended Taste):** High user value derived metrics feasible within current sprint without external dependencies.
- **P2 (Deferred / Roadmap):** Requires external filmography scraping or sparse TMDb fields.

---

### Matrix Table

| Metric Name | Inputs Combined | Mathematical Formula / Algorithm | Minimum Sample $n$ | Caveats / Edge Cases | User Value | Cost | Priority |
|---|---|---|---|---|---|---|---|
| **1. Taste Affinity (Shrinkage)** | User Ratings $\times$ TMDb Metadata (Genres, Directors, Actors, Decades, Countries) | Empirical Bayes Shrinkage toward user mean $\mu$:<br>$\hat{R}_c = \frac{v \cdot \bar{r}_c + m \cdot \mu}{v + m}$<br>where $m=3$, $v$ is sample count. Difference displayed as $\Delta = \hat{R}_c - \mu$. | $n \ge 3$ for directors/cast;<br>$n \ge 5$ for genres/decades. | Small samples naturally shrink toward $\mu$ rather than skewing with $1 \times 5.0\text{★}$. | **High (L)** | Pure computation (memoized) | **P0** |
| **2. Diverging Crowd Delta** | User Ratings $\times$ TMDb `tmdbVoteAverage` | Normalized delta: $\delta_i = r_i - \frac{\text{tmdbVoteAverage}_i}{2}$.<br>Generosity: $\frac{1}{N}\sum \delta_i$.<br>Contrarian Score: $\frac{1}{N}\sum |\delta_i|$.<br>Diverging chart showing user above/below. | $n \ge 5$ rated & enriched films. | TMDb scores are skewed 6.0–8.0 (3.0–4.0★); normalize clearly. | **High (L)** | Stored data | **P0** |
| **3. Obscurity / Hipster Index** | Watched Entries $\times$ TMDb `tmdbVoteCount` & `tmdbPopularity` | Percentile rank $P_i = \text{percentile}(\text{voteCount}_i)$ against global log distribution.<br>Library Obscurity Score: $100 - \text{median}(P)$.<br>Quadrant: Rating vs Popularity. | $n \ge 10$ enriched films. | Older films naturally have fewer TMDb votes; normalize against release decade. | **High (L)** | Stored data | **P0** |
| **4. Film Age at Viewing** | `watchedAt` (Diary) $\times$ `releaseYear` (TMDb) | Film Age: $\text{year}(\text{watchedAt}) - \text{releaseYear}$.<br>Share of New Releases ($\le 1\text{ yr}$) vs Catalog ($> 1\text{ yr}$); median film age per viewing year. | $n \ge 10$ dated films. | Date-unknown entries excluded with standard note. | **Medium (M)** | Stored data | **P0** |
| **5. Precise Time Spent** | Watched Movies (Runtimes) $+$ Watched TV Episodes (Episode Runtimes) $\times$ Rewatch count | Total Minutes: $\sum (\text{movie runtime} \times \text{views}) + \sum_{\text{episodes}} \text{episode runtime}$.<br>Format via shared human duration formatter. | None (show coverage $k/N$). | Imputed runtimes explicitly labeled as estimates; rewatches counted per viewing. | **High (L)** | Stored data | **P0** |
| **6. Rewatch Dynamics** | Multiple entries per film $\times$ User Ratings $\times$ `watchedAt` | Delta on rewatch: $r_{\text{rewatch}} - r_{\text{first}}$.<br>Interval days: $\text{days}(\text{watchedAt}_2 - \text{watchedAt}_1)$.<br>Most rewatched ranking. | $n \ge 1$ rewatched film. | Films imported without multiple dated entries use boolean `rewatch` flag. | **Medium (M)** | Stored data | **P0** |
| **7. Activity Heatmap & Streaks** | `watchedAt` (Diary local calendar dates) $\times$ Entry counts | Trailing 365 days ending today grid (53 cols $\times$ 7 rows).<br>Streak: consecutive active calendar days (alive if active today or yesterday). | 365 calendar days. | Date-unknown excluded; locale week start handled. | **High (L)** | Pure SVG | **P0** |
| **8. Watchlist Queue Dynamics & Predictive Rating** | Watchlist (`addedAt`) $\times$ User Taste Affinity $\times$ TMDb Metadata | Real median age: $\text{median}(\text{now} - \text{addedAt})$.<br>Predicted rating for watchlist item $j$:<br>$\hat{r}_j = \mu + \sum_{g \in \text{genres}} \Delta_g \cdot w_g + \Delta_{\text{dir}} \cdot w_d$. Explainable factors. | $n \ge 10$ rated films in history. | Predictions require transparent explanations (e.g. "+0.6 for Korean, +0.4 director"). | **High (L)** | Pure computation | **P0** |
| **9. Marathon & Binge Detection** | `watchedAt` (Diary) $\times$ Movie Count $+$ Watched TV Episodes | Binge Day: $\ge 3$ films or $\ge 5$ TV episodes in 1 calendar day.<br>Peak watch days and longest marathon session hours. | $n \ge 1$ dated entry. | Excludes date-unknown entries. | **Medium (M)** | Stored data | **P1** |
| **10. Decade $\times$ Genre Matrix** | TMDb `releaseYear` $\times$ TMDb `genres` $\times$ User Ratings | 2D matrix heatmap: Decade on Y-axis, Genre on X-axis.<br>Cell value: film count and average rating. | $n \ge 10$ enriched films. | Handle multi-genre films without double counting library totals. | **High (L)** | SVG matrix | **P1** |
| **11. World Cinema & Language Diversity** | TMDb `productionCountries` & `originalLanguage` $\times$ `watchedAt` | Non-English share over time.<br>Shannon Diversity Index: $H = -\sum p_i \ln p_i$.<br>Tile-grid production country map. | $n \ge 10$ enriched films. | Raw codes normalized via `Intl.DisplayNames`. | **Medium (M)** | SVG tile map | **P1** |
| **12. Liked vs Rated Dissonance** | User `liked` flag $\times$ User `rating` | Like rate per star tier: $P(\text{liked} \mid \text{rating}=k)$.<br>Guilty pleasures ($<2.5\text{★} \wedge \text{liked}$) vs Disappointments ($\ge 4\text{★} \wedge \neg\text{liked}$). | $n \ge 10$ rated films. | Lettersboxd likes correlate strongly with rating; surface outliers. | **Medium (M)** | Stored data | **P1** |
| **13. Collaboration Pairs** | TMDb `directors` $\times$ TMDb `topCast` | Frequency of Director-Actor pairs $(D, A)$ and Actor-Actor pairs $(A_1, A_2)$ in user's library. | Pair count $\ge 2$. | Requires person ID join. | **Low (S)** | Stored data | **P1** |
| **14. Seasonality & Thematic Trends** | `watchedAt` month/season $\times$ TMDb `genres` & `keywords` | Proportion of Horror in October, Holiday/Family in December, Romance in February. | $n \ge 20$ dated films across 12 months. | Needs multi-month distribution. | **Medium (M)** | Stored data | **P1** |
| **15. Tag & Review Analytics** | User `review` text & `tags` $\times$ User `rating` | Word count vs rating correlation.<br>Average rating per tag ($n \ge 3$). | $n \ge 5$ reviews/tags. | Local text metrics only (no external NLP). | **Medium (M)** | Stored data | **P1** |
| **16. Franchise / Collection Completion** | TMDb `belongsToCollection` $\times$ Watched IDs | Viewed $k$ of $M$ films in collection. Missing titles identified. | $n \ge 1$ franchise in library. | Requires TMDb collection lookup for $M$. | **Medium (M)** | Extra fetch for full collection | **P2** (Deferred) |
| **17. Person Full Filmography Completion** | TMDb `person_id` $\times$ Watched IDs | Directed/Starred in $k$ of $M$ films. | Top 5 people. | Requires scraping full filmographies from TMDb person credits. | **Medium (M)** | Extra API calls per person | **P2** (Deferred) |

---

## 4. Production "Build Now" Scope Selection

To deliver **production-ready, zero-stub quality** without incomplete work:

### Phase 2 "Build Now" (Correctness & Foundations)
1. **Shared Formatting Module:** Human-friendly durations (`~82 days` / `2 months, 21 days, 20 hours`), rating formatting (1 decimal), count rounding, `Intl.DisplayNames` normalization (`cn` Cantonese, `xx` No Language).
2. **Watchlist Import & Migration:** Preserve real `Date` from `watchlist.csv` as `addedAt`, migrate existing 163 watchlist records to version 4, replace 87% clear rate with median age and backlog runtime.
3. **Hours Watched Correctness:** Movies from confirmed runtimes with coverage + labeled estimates; TV from watched episodes in `settings.episodeWatched`.
4. **Per-Metric Live Coverage:** Replace single global banner with individual metric coverage chips.
5. **Time Disclaimers:** Visible "N films without a watch date are not shown" on every temporal card.

### Phase 3 "Build Now" (Design System & Reusable Components)
1. **Bar Charts:** Star rating histogram and 12-month watch velocity with valid CSS tokens and SVG rendering.
2. **Diverging Bar Chart:** User vs TMDb Crowd Delta (both positive and negative).
3. **GitHub-Style 365-Day Heatmap:** Trailing 365 days ending today, locale week start, touch scroll, streak badges.
4. **Horizontally Scrollable People Carousel:** Circular portraits (`w185`), rank badge, film count, rating chip, routing to `/person/:id`.
5. **Layout Streamlining:** Sticky year dropdown/sheet, auto-generated Insights strip, collapsible card sections.

### Phase 4 "Build Now" (Derived Analytics Engine)
1. **Taste Affinity Engine:** Genre, decade, director, and actor affinities with Bayesian shrinkage.
2. **Obscurity / Hipster Metric:** Percentile distribution and mainstream vs obscure score.
3. **Film Age at Viewing:** Catalog vs new release share and median age.
4. **Rewatch Analytics:** Score deltas on rewatch and interval days.
5. **Watchlist Intelligence:** Predicted rating with transparent factor breakdown.
6. **Reactive Backfill State:** Live progress bar, rate, ETA, pause/resume, and throttled UI updates.

---

## 5. Gate Verification Checklist

- [x] Full inventory of local, watchlist, list, and metadata fields documented.
- [x] Field coverage computed across real profile and synthetic variants.
- [x] TMDb metadata snapshot extension proposed with zero extra HTTP calls.
- [x] Derivation matrix created with mathematical formulations, minimum samples, and multi-dataset combinations.
- [x] Pragmatic "Build Now" set defined with deferred items documented.
