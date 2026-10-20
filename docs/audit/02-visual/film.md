# Visual Audit: Film Detail (`/movie/:id`)

**Page:** Film Detail  
**Route:** `/movie/:id`  
**Source Template:** [`/home/usign/.temp/open-movie-tracker/src/app/film/film.page.html`](file:///home/usign/.temp/open-movie-tracker/src/app/film/film.page.html)  
**Source Component:** [`/home/usign/.temp/open-movie-tracker/src/app/film/film.page.ts`](file:///home/usign/.temp/open-movie-tracker/src/app/film/film.page.ts)  
**Audited Viewports:** 360x800, 390x844, 768x1024, 1024x768, 1440x900.  

---

## 1. Visual Findings & Concrete Observations

1. **Backdrop Slideshow Hero:**
   - Smooth crossfading transition between backdrop images.
   - Text gradient overlay (`from-black/[0.98] via-black/75 to-black/25`) provides sufficient contrast for title and tagline over bright backdrops.
2. **Logged Title Fallback on TMDb 404 / Offline Failure (Finding T-05):**
   - **Observation:** If an imported or previously logged film returns 404 from TMDb (e.g. delisted or offline with empty cache), `movie` remains undefined. The template only renders content under `@if (!isLoading && movie)`. The entire screen becomes completely blank with no title, poster, rating, or review displayed from local storage.
   - **Code Location:** [`/home/usign/.temp/open-movie-tracker/src/app/film/film.page.html#L27`](file:///home/usign/.temp/open-movie-tracker/src/app/film/film.page.html#L27) and [`/home/usign/.temp/open-movie-tracker/src/app/film/film.page.ts#L48-L100`](file:///home/usign/.temp/open-movie-tracker/src/app/film/film.page.ts#L48-L100).
   - **Remediation:** In `ngOnInit()`, check `userData.getWatchedEntry('movie', id)`. If TMDb fails, populate a fallback movie object with local title, poster, release date, and user review. Render an offline/local-only badge.
3. **Quick-Action Logging Bar:**
   - Log sheet trigger button, watchlist toggle, and favorite heart buttons are prominent.
   - Action buttons meet 44px minimum tap target guidelines.
4. **Cast & Crew Horizontal Scroll:**
   - Actor avatars and character roles are neatly laid out in a horizontal carousel without scroll clipping.
5. **Trailer Video Embedding:**
   - YouTube iframe embeds securely via `safeUrl` pipe without breaking out of layout bounds.
