# Profile Page Overhaul Design Specification

**Document Version:** 1.0.0  
**Status:** Approved for Implementation  
**Target Viewports:** 360x800 (Phone), 390x844 (iPhone), 412x915 (Android Large), 768x1024 (Tablet Portrait), 820x1180 (iPad Air), 1024x768 (Tablet Landscape), 1440x900 (Desktop)  
**Themes Supported:** Dark & Light modes with dual primary colors (Emerald `#76c893` and Crimson `#d90429`).

---

## 1. Visual Hierarchy & Spatial Layout

The revised profile page replaces the previous disorganized layout with a purposeful, compact, high-density cinematic interface:

```
┌─────────────────────────────────────────────────────────────┐
│ COVER BANNER (2.35:1 Cinematic Aspect Ratio)               │
│ - TMDb Backdrop from #1 Favorite (Default)                  │
│ - Or Highest-Rated Watched Title / Custom Backdrop Choice   │
│ - Fallback: Elegant primary gradient scrim                 │
│                                                             │
│ [Avatar & Display Name Overlap Bottom Border]               │
└─────────────────────────────────────────────────────────────┘
  │ USER IDENTITY & BIO STRIP (Compact, joined date, bio)
  │
  │ SUMMARY METRIC STRIP (5 Compact Tiles)
  │ [Films]  [Hours]  [Avg Rating]  [Rewatches]  [This Year]
  │
  │ COVERAGE BANNER (Appears only when metadata is partial)
  │ ℹ️ Based on 840 of 1,012 films · [Refresh Data Button]
  │
  │ FAVORITES SECTION (Top 4 Films / Add Slot)
  │
  │ LIBRARY & LIST PREVIEWS (Shared 4-poster list cards)
  │ - Watched Collection · Watchlist · Liked Films · Diary
  │ - Custom Lists & Bookmarked Lists
  │
  │ ANALYTICS HUB (Grouped Tabs with Year Filter)
  │ Filter Chips: [All Time] [2024] [2023] [2022] ...
  │ Section Chips: [Overview] [Ratings] [Time] [People] [Genres & Places]
  │
  │ - Ratings: Star Histogram (0.5★ – 5.0★) & Crowd Controversy
  │ - Overview: Movie vs TV Donut & Decade Distribution
  │ - Time: Monthly Activity & 52-Week Heatmap with Streaks
  │ - People: Top Directors & Top Cast (with Person IDs & Avatars)
  │ - Genres & Places: Categorical Genre Bars, Languages, Countries
└─────────────────────────────────────────────────────────────
```

---

## 2. Component Design & Architectural Details

### A. 2.35:1 Cinematic Cover (`aspect-ratio: 2.35 / 1`)
- **Aspect Ratio:** Fixed `2.35 / 1` container that scales fluidly with viewport width.
- **Default Resolution:**
  - Phone: `w780`
  - Tablet & Desktop: `w1280`
- **Fallback:** Smooth linear gradient derived from the active primary color to dark background base, eliminating any blank block or layout shift.
- **Cover Selection Flow:**
  - Tap cover opens Action Sheet: "Choose from Favorites", "Search Any Title", "Use Top Favorite (Default)", "Remove Cover".
  - Dedicated `SetCoverModalComponent` displays available backdrops from TMDb `/movie/{id}/images` or `/tv/{id}/images` with language-neutral filtering.
  - Persisted in `AppSettings.customCover` with schema migration safety.

### B. Shared List Card (`<app-list-card>`)
- Extracted from `src/app/film/film.page.html` (`.list-card`) into a single source of truth:
  - 4-cell poster collage (`cover-grid`) with lazy loading and film icon fallback for empty slots.
  - Title, badge count, creator/subtitle, and interactive bookmark button.
  - Uniform press feedback (`transform: scale(0.97)` on active, ripple support).
  - Used uniformly for:
    1. Watched Collection
    2. Watchlist
    3. Liked Films
    4. Diary Logs
    5. Rated Titles
    6. Written Reviews
    7. User Custom Lists

### C. Visualizations (Inline SVG & CSS)
- **Star Rating Histogram:**
  - Pure SVG bar chart displaying 10 rating buckets (0.5 to 5.0 in 0.5 increments).
  - Highlights peak rating bucket with accent color and displays count above peak.
- **Donut Chart (Movies vs TV):**
  - SVG circle with `stroke-dasharray` and `stroke-dashoffset` for zero-dependency high-DPI rendering.
- **Top Directors & Top Cast:**
  - Horizontal bar rankings with TMDb person ID aggregation.
  - Displays film count and average star rating (only where ratings sample $\ge 3$).
- **Color-Blind Safe Categorical Palette:**
  - Drama: `#06b6d4` (Cyan)
  - Action: `#f97316` (Orange)
  - Comedy: `#f59e0b` (Amber)
  - Sci-Fi: `#8b5cf6` (Purple)
  - Thriller: `#ef4444` (Rose)
  - Animation: `#10b981` (Emerald)
  - Horror: `#6366f1` (Indigo)
  - Meets WCAG AA contrast against dark (`#212529`) and light (`#f8fafc`) surfaces.
- **Activity Heatmap & Streaks:**
  - 52-week calendar grid displaying daily watch frequency levels (0 to 4).
  - Current streak and longest streak indicators.

### D. Performance & Change Detection
- Memoized stats calculation caching results based on `(selectedYear, watchedCount, enrichedCount)`.
- Prevents repetitive `localStorage` reads and JSON deserialization on change detection cycles.
- Renders lightweight skeleton during initial calculation.
