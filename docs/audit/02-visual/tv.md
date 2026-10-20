# Visual Audit: TV Show Detail (`/tv/:id`)

**Page:** TV Show Detail  
**Route:** `/tv/:id`  
**Source Template:** [`/home/usign/.temp/open-movie-tracker/src/app/tv/tv.page.html`](file:///home/usign/.temp/open-movie-tracker/src/app/tv/tv.page.html)  
**Source Component:** [`/home/usign/.temp/open-movie-tracker/src/app/tv/tv.page.ts`](file:///home/usign/.temp/open-movie-tracker/src/app/tv/tv.page.ts)  
**Audited Viewports:** 360x800, 390x844, 768x1024, 1024x768, 1440x900.  

---

## 1. Visual Findings & Concrete Observations

1. **Hero & Season Carousel:**
   - TV backdrop slideshow hero mirrors film page layout.
   - Season list displays season poster cards with episode counts and air years.
2. **Episode Progress Display:**
   - Checkmarks and progress bars indicate episode completion per season cleanly.
3. **Offline / Delisted Title Fallback (Finding T-05):**
   - **Observation:** If TMDb returns 404 for a logged TV show, page renders completely empty without fallback to local storage metadata.
   - **Code Location:** [`/home/usign/.temp/open-movie-tracker/src/app/tv/tv.page.html#L36`](file:///home/usign/.temp/open-movie-tracker/src/app/tv/tv.page.html#L36).
   - **Remediation:** Fall back to local `WatchedEntry` metadata snapshot if TMDb request errors.
4. **Touch Targets & Spacing:**
   - Season navigation rows offer ample touch height (48px).
   - Status badge ("Ended", "Returning Series") is easily readable.
