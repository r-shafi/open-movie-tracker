# Visual Audit: TV Season Detail (`/tv/:id/season/:season_number`)

**Page:** TV Season Detail  
**Route:** `/tv/:id/season/:season_number`  
**Source Template:** [`/home/usign/.temp/open-movie-tracker/src/app/tv-season/tv-season.page.html`](file:///home/usign/.temp/open-movie-tracker/src/app/tv-season/tv-season.page.html)  
**Source Component:** [`/home/usign/.temp/open-movie-tracker/src/app/tv-season/tv-season.page.ts`](file:///home/usign/.temp/open-movie-tracker/src/app/tv-season/tv-season.page.ts)  
**Audited Viewports:** 360x800, 390x844, 768x1024, 1024x768, 1440x900.  

---

## 1. Visual Findings & Concrete Observations

1. **Episode List Layout:**
   - Episodes listed with still thumbnail, episode number, title, runtime, overview, and watched toggle button.
2. **Watched Toggle Tap Target:**
   - **Observation:** Episode watched toggle icon button is `36px x 36px` on phone viewports.
   - **Remediation:** Increase hit area to `44px x 44px` using touch target expansion padding.
3. **Overview Clamping:**
   - Episode description clamps to 3 lines with an expandable "more" button, preventing extremely tall items.
4. **Mark All Episodes Action:**
   - Header button allows toggling an entire season as watched in one tap. Meets 44px tap target standard.
