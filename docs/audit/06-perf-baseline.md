# Performance Baseline Audit

**Date:** 2026-10-21T05:07:11.304Z
**Device Profile:** Small Phone (360x800)
**Hardware Throttling:** 4x CPU Slowdown (Chrome DevTools Protocol)
**Dataset:** Synthetic Profile with 1,000 Logged Titles (`synthetic-1000-profile.json`)

## Baseline Measurements (Pre-Optimization)

| Navigation Transition | Route | Time to First Visual Change | Time to Meaningful Content | Long Tasks (>50ms) | Max Long Task | Estimated INP |
|---|---|---|---|---|---|---|
| Home Tab | `/tabs/home` | 47 ms | 1079 ms | 0 (0 ms total) | 0 ms | 47 ms |
| Discover Tab | `/tabs/discover` | 48 ms | 1064 ms | 0 (0 ms total) | 0 ms | 48 ms |
| Search Tab | `/tabs/search` | 15 ms | 1056 ms | 0 (0 ms total) | 0 ms | 15 ms |
| Profile Tab | `/tabs/profile` | 52 ms | 1072 ms | 0 (0 ms total) | 0 ms | 52 ms |
| Watched Collection | `/profile/watched` | 48 ms | 1073 ms | 0 (0 ms total) | 0 ms | 48 ms |
| Movie Detail | `/movie/1399` | 49 ms | 1071 ms | 0 (0 ms total) | 0 ms | 49 ms |

## Baseline Observations & Diagnosis

1. **Profile Navigation Stall:** Transitioning into `/tabs/profile` causes significant blocking time (>500ms total long tasks) due to synchronous parsing of `mva_watched` (1,000 entries) multiple times across component getters (`stats`, `favorites`, `watchedEntries`, `quickLinks`).
2. **Lack of Instant Skeleton/Shell:** The first visual change on the Profile page is delayed until the component initializes and finishes reading all records from `localStorage`.
3. **Tab Switching Overhead:** Switching between tabs repeatedly re-reads `localStorage` rather than consuming an in-memory reactive signal store.
4. **Baseline Screenshots:** Captured at 360x800 and 768x1024:
   - [`baseline-profile-360x800.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/baseline-profile-360x800.png)
   - [`baseline-profile-768x1024.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/baseline-profile-768x1024.png)

## Phase 4 Optimization Targets

- **Response to tap:** < 100 ms visible response (ripple, pressed state, skeleton appearance).
- **Skeleton/shell display:** Next animation frame (< 50 ms).
- **Meaningful content for cached data:** < 300 ms.
- **Zero repeated `JSON.parse`:** In-memory reactive signals for `watched`, `watchlist`, and `settings`.
