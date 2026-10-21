# Phase 3 Analytics Design Specification & Component Architecture

## 1. Overview & Architecture

The Open Movie Tracker profile analytics section is redesigned to deliver paid-tier visual and quantitative depth (comparable to Letterboxd Pro/Patron and Trakt VIP), engineered with privacy-first client-side calculations, high-density SVG/CSS visual encodings, and strict responsive accessibility.

### Visual Principles
- **No Invisible Bars:** Every chart element maps directly to tested CSS design system tokens (`--ion-color-primary`, `--ion-color-step-*`, `--app-border`, `--app-bg-secondary`) rather than unmapped utility classes like `bg-primary`.
- **Honest & Metric-Specific Coverage:** Every metric card displays its exact sample size and coverage status (e.g., `directors: 456/1,066`, `runtimes: 804/1,000`). No partial data is disguised as full catalog truth.
- **Undated Data Footnotes:** Any card aggregating time-series or calendar data (Velocity, Activity Heatmap, Day-of-Week) includes an explicit disclosure: *"N films without a watch date are not shown"*.
- **Horizontal People Carousel:** Directorial and acting rankings use circular `w185` portraits with rank badges, film counts, relative rating chips, and router links to `/person/:id` via TMDb person ID.
- **Degenerate Data Handling:** Monotonous or single-category representations (e.g. 100% movies format donut) collapse into compact, informative stat tiles.

---

## 2. Component Design System

```
src/app/profile/analytics/
├── components/
│   ├── ratings-histogram/        # 10-bucket half-star SVG/CSS histogram with peak & mean
│   ├── watch-velocity-chart/     # 12-month rolling bar chart with monthly counts & trend
│   ├── diverging-crowd-chart/    # Split-axis (-5 to +5) crowd divergence with contrarian index
│   ├── activity-calendar/        # 365-day GitHub-style calendar with month headers & streaks
│   ├── people-carousel/          # Snap-scrolling circular portraits linking to /person/:id
│   └── taste-insights-card/      # Derived taste affinity, hipster index, rewatch dynamics
└── services/
    └── analytics-taste.ts        # Pure calculation engine for Bayesian affinity & predictions
```

---

## 3. Component Details & Specs

### 3.1 Star Ratings Histogram (`ratings-histogram`)
- **Buckets:** 10 discrete intervals (`0.5★` to `5.0★`).
- **Styling:**
  - Standard bars: `rgba(var(--ion-color-primary-rgb), 0.5)` with subtle top rounded border.
  - Peak bar: `var(--ion-color-primary)` (100% opacity) with glow effect or accent highlight.
  - Baseline: subtle `1px solid var(--app-border)`.
- **Header:** Displays average rating formatted via `formatRating(avg, 1)` and `formatRating(avg, 2)` tooltip, plus total rated titles.
- **Accessibility:** `role="img"`, individual bar `aria-label="3.5 stars: 214 films"`.

### 3.2 12-Month Watch Velocity Chart (`watch-velocity-chart`)
- **Domain:** Trailing 12 calendar months in chronological order.
- **Encoding:** Vertical bars with visible heights mapped to `(count / maxCount) * 100%`.
- **Theme Binding:** Explicit CSS style using `var(--ion-color-primary)`.
- **Labels:** 3-letter month abbreviations (`Jan`, `Feb`, etc.) and active film count floating above non-zero bars.
- **Footnote:** Explains undated items excluded.

### 3.3 Diverging Crowd Delta Chart (`diverging-crowd-chart`)
- **Concept:** Visualizes how user taste diverges from TMDb global community (`User Rating - TMDb Rating / 2`).
- **Layout:** Centered 0 line:
  - Left bars (Rose `#fb7185`): User rated lower than consensus (*"Harsher than crowd"*).
  - Right bars (Emerald `#34d399`): User rated higher than consensus (*"More generous than crowd"*).
- **Summary Metrics:**
  - **Contrarian Score:** Mean absolute divergence $\frac{1}{N}\sum |R_u - R_c|$.
  - **Generosity Score:** Signed mean divergence $\frac{1}{N}\sum (R_u - R_c)$.

### 3.4 365-Day Activity Calendar (`activity-calendar`)
- **Structure:** 53 columns (weeks) $\times$ 7 rows (days, Sunday through Saturday or Monday through Sunday).
- **Trailing Window:** Ending today, exactly 365 days.
- **Intensity Levels:**
  - Level 0: `var(--ion-color-step-100, #2c3035)`
  - Level 1 (1 film): `rgba(16, 185, 129, 0.35)`
  - Level 2 (2 films): `rgba(16, 185, 129, 0.60)`
  - Level 3 (3 films): `rgba(16, 185, 129, 0.85)`
  - Level 4 (4+ films): `#34d399` (Emerald 400)
- **Controls:** Month headers positioned at the start of each month; day-of-week axis labels.
- **Streaks:** Current streak and longest streak in days.

### 3.5 Horizontal People Carousel (`people-carousel`)
- **Element:** Horizontally scrollable flex container with CSS `scroll-snap-type: x mandatory`.
- **Avatar:** 72px circular portraits, TMDb `w185` resolution (`https://image.tmdb.org/t/p/w185${profilePath}`).
- **Fallback:** Two-letter initials badge on background gradient when `profilePath` is null.
- **Badge:** Top-left rank badge (`#1`, `#2`, ...).
- **Link:** `[routerLink]="['/person', person.id]"` verified against `/person/:id` route parameter.
- **Metrics:** Name, film count (`8 films` or `8 films · 2 shows`), and relative rating chip (green if $> \bar{R} + 0.3$, rose if $< \bar{R} - 0.3$).
- **Coverage Chip:** Displays live enrichment coverage (e.g., `"Coverage: 43% · Provisional"`).

### 3.6 Multi-Dataset Derived Taste Insights (`taste-insights-card`)
- **Taste Affinity (Bayesian):** Computes top affinity genres and directors where $N \ge 3$, applying shrinkage toward personal mean $\bar{R}$.
- **Obscurity / Hipster Index:** Distribution percentile based on TMDb community `vote_count` (lower vote count = higher obscurity percentile).
- **Film Age at Viewing:** Time delta between release date and watch date ($T_{\text{watch}} - T_{\text{release}}$ in years), showing preferences for contemporary vs vintage cinema.
- **Rewatch Dynamics:** Frequency of rewatches, days between repeat viewings, and rating shift on rewatch ($\Delta R$).
- **Watchlist Recommendation Score:** Predicted user rating for queued titles based on user's affinity for director, lead cast, and genres.

---

## 4. Responsive Viewports & Layout Plan
- **Mobile (360px - 414px):** Single-column stacked cards, compact hero durations, horizontal scroll for people and heatmap.
- **Tablet (768px - 820px):** 2-column grid for overview cards, full-width calendar heatmap, 6 visible people cards per scroll.
- **Desktop (1024px+):** 2 or 3-column responsive layout with sticky year navigation.
