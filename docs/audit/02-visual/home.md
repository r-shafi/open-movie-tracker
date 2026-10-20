# Visual Audit: Home Dashboard (`/tabs/home`)

**Page:** Home Dashboard  
**Route:** `/tabs/home`  
**Source Template:** [`/home/usign/.temp/open-movie-tracker/src/app/home/home.page.html`](file:///home/usign/.temp/open-movie-tracker/src/app/home/home.page.html)  
**Source Component:** [`/home/usign/.temp/open-movie-tracker/src/app/home/home.page.ts`](file:///home/usign/.temp/open-movie-tracker/src/app/home/home.page.ts)  
**Audited Viewports:**
- Small Phone: 360x800 ([`home-phone-360x800.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/home-phone-360x800.png))
- iPhone Class: 390x844 ([`home-iphone-390x844.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/home-iphone-390x844.png))
- Tablet Portrait: 768x1024 ([`home-tablet-768x1024.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/home-tablet-768x1024.png))
- Tablet Landscape: 1024x768 ([`home-tablet-landscape-1024x768.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/home-tablet-landscape-1024x768.png))
- Desktop Monitor: 1440x900 ([`home-desktop-1440x900.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/home-desktop-1440x900.png))
**Themes Tested:** Light / Dark, Primary Accent: Green / Red.

---

## 1. Visual Findings & Concrete Observations

1. **Horizontal Overflow & Viewport Bounds:**
   - Scroll width strictly equals client width across all viewports (`0px` overflow delta).
   - Horizontal carousels use CSS snap scrolling without creating page-level scrollbars.
2. **Tablet Landscape & Desktop Space Utilization:**
   - **Observation:** On 1024px and 1440px wide viewports, the hero banner stretches across the entire screen width, resulting in letterboxing of backdrop imagery and excessive empty spacing between poster cards in the carousels.
   - **Code Location:** [`/home/usign/.temp/open-movie-tracker/src/app/home/home.page.html#L39`](file:///home/usign/.temp/open-movie-tracker/src/app/home/home.page.html#L39) directly nests `app-hero-banner` inside unconstrained `ion-content`.
   - **Remediation:** Add a responsive maximum content width container (e.g. `max-w-6xl mx-auto`) for tablet and desktop viewports.
3. **Empty / Network Error State:**
   - **Observation:** When offline without cached TMDb items, or if TMDb returns 500, `isLoading` turns false and `heroItems` is empty. The screen renders a blank header with empty carousels and no user feedback.
   - **Code Location:** [`/home/usign/.temp/open-movie-tracker/src/app/home/home.page.html#L38-L103`](file:///home/usign/.temp/open-movie-tracker/src/app/home/home.page.html#L38-L103) lacks an `@if (!isLoading && !heroItems.length)` error/retry card.
   - **Remediation:** Provide an offline/empty state card with a "Tap to Retry" button.
4. **Touch Target Sizing:**
   - Toolbar settings button: measures 48x48px on Android mode (`Pass`).
   - Carousel "See all" chevron: text button with touch target height of 36px (`Needs 44px padding constraint`).
5. **Loading Skeletons:**
   - Hero banner and media carousel skeletons animate cleanly without layout shift when transitioning to loaded state.
