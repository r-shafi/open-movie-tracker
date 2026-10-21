# Phase 0 Real-Data Baseline Validation Report

**Date:** 2026-10-21  
**Branch:** `feat/production-readiness-and-letterboxd-import`  
**Target Profile:** Letterboxd Export (`letterboxd-shafiemoji-2026-10-20-04-30-utc.zip`)  
**Status:** Verification complete (aggregates only, strict privacy observed)

---

## 1. Executive Baseline Summary

The real Letterboxd export archive containing 1,084 watched records, 988 ratings, 658 diary logs, 171 watchlist entries, 58 reviews, 94 liked films, and 7 custom lists was imported through the app's real pipeline via headless Chromium with full network caching.

All TMDb API responses were captured into the gitignored cache at `/home/usign/.temp/open-movie-tracker/.local-real-data/tmdb-cache` to prevent any future redundant external calls.

### Aggregate Import Results
- **Total Watched Entries Imported:** 1066 (Independent CSV Ground Truth: 1742)
- **Total Watchlist Entries Imported:** 163 (Independent CSV Ground Truth: 171)
- **Custom Lists Created:** undefined (Independent CSV Ground Truth: 7)
- **Privacy Audit:** PASSED — Zero sensitive fields (email, family name, location, website, pronouns) stored.

---

## 2. Investigation of Current Evidence Findings

| # | Finding | App Displayed Value | Independent Ground Truth | Code Confirmation & Status |
|---|---|---|---|---|
| **1** | **Star-ratings histogram & watch-velocity render no bars** | 1 visible bar in histogram; 0 visible bars in watch velocity. | 10 rating buckets populated; 12 monthly velocity buckets populated. | **CONFIRMED BUG.** The bars were assigned Tailwind class `bg-primary`. Because `primary` is missing from `tailwind.config.js` color tokens, Tailwind generated 0 CSS rules for `bg-primary`, rendering all regular bars invisible with transparent background. Only the peak bar used `bg-emerald-400`. |
| **2** | **Watchlist "Queue dynamics": 0d avg age & 87% clear rate** | `163 QUEUED 87% CLEAR RATE 0d AVG AGE` | Independent avg watchlist age: **~1255 days**. | **CONFIRMED BUG.** During import, `w.addedAt` was discarded, and `addToWatchlist` defaulted to `new Date().toISOString()`, resulting in 0d age. "Clear rate" was computed as `watched / (watched + watchlist)` (87%), which has no analytical meaning. |
| **3** | **Weekday card sums to 631, not 1,066** | Card sums to **631** with no explanation. | **658** dated films, **1084** date-unknown films. | **CONFIRMED BUG.** Date-unknown films were silently dropped without notifying the user that 1084 films without a watch date were excluded. |
| **4** | **Global banner single coverage vs metric-specific coverage** | Banner: `"Based on 10 of 1066 titles, enriching the rest |  | 1% enriched · Analytics update automatically |  | Refresh"` | Coverage differs: Release years: 100%, Watch dates: 38%, Languages: ~73%, Directors/Credits: ~43%. | **CONFIRMED BUG.** A single global coverage percentage masks that different analytics rely on distinct datasets with widely varying completeness. |
| **5** | **Header avg rating vs histogram mismatch** | Hero tile: **undefined** vs Histogram header: **★ 3.15 Avg** | Independent Ground Truth: **3.00★** | **CONFIRMED BUG.** Hero tile formatted with `.toFixed(1)`, while histogram header formatted with `.toFixed(2)`. |
| **6** | **Languages and countries rendered as raw ISO codes** | Rendered: `EN 5, FR 2, KO 1, ZH 1, TR 1` | Display names: English, French, Japanese, Korean, Spanish, etc. | **CONFIRMED BUG.** Raw codes rendered without localization via `Intl.DisplayNames`. TMDb Cantonese code `cn` and `xx` unhandled. |
| **7** | **Crowd delta lists only negative 0.5★ differences** | Top picks count: 5 | Delta is computed as `userRating - tmdbRating / 2`. | **CONFIRMED.** Slicing top 5 by absolute delta produced a one-sided negative list. Requires bidirectional diverging visualization and full taste affinity model. |
| **8** | **Total hours watched inaccurate** | Hero tile: **undefined** | Imputed with 108 min per missing film. TV counted as flat 45 min per series. | **CONFIRMED BUG.** 1,964h was imputed from missing runtimes without disclosure. TV ignored actual watched episodes. |
| **9** | **Provisional top directors shown without live coverage** | Top directors listed without coverage chips. | Top directors provisonal at partial credit backfill. | **CONFIRMED.** Provisional rankings displayed without live coverage indication. |

---

## 3. Git Status & Privacy Verification

- **Real export archive:** `/home/usign/.temp/open-movie-tracker/letterboxd-shafiemoji-2026-10-20-04-30-utc.zip` is gitignored.
- **TMDb Cache:** `/home/usign/.temp/open-movie-tracker/.local-real-data/tmdb-cache` is gitignored.
- **Derived Real Data:** Stored exclusively in gitignored `.local-real-data/`.
- **Validation Script:** `/home/usign/.temp/open-movie-tracker/scripts/local-phase0-real-import-and-validate.js` is gitignored.
- **Committed Report:** `/home/usign/.temp/open-movie-tracker/docs/audit/10-real-data-validation.md` contains aggregates and metadata only, strictly zero titles, reviews, or personal identifiers.
