# Visual Audit: Search (`/tabs/search`)

**Page:** Search  
**Route:** `/tabs/search`  
**Source Template:** [`/home/usign/.temp/open-movie-tracker/src/app/search/search.page.html`](file:///home/usign/.temp/open-movie-tracker/src/app/search/search.page.html)  
**Source Component:** [`/home/usign/.temp/open-movie-tracker/src/app/search/search.page.ts`](file:///home/usign/.temp/open-movie-tracker/src/app/search/search.page.ts)  
**Audited Viewports:**
- Small Phone: 360x800 ([`search-phone-360x800.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/search-phone-360x800.png))
- iPhone Class: 390x844 ([`search-iphone-390x844.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/search-iphone-390x844.png))
- Tablet Portrait: 768x1024 ([`search-tablet-768x1024.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/search-tablet-768x1024.png))
- Tablet Landscape: 1024x768 ([`search-tablet-landscape-1024x768.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/search-tablet-landscape-1024x768.png))
- Desktop Monitor: 1440x900 ([`search-desktop-1440x900.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/search-desktop-1440x900.png))

---

## 1. Visual Findings & Concrete Observations

1. **Searchbar & Debounced Input:**
   - Search input debounce (300ms) prevents rapid layout thrashing.
   - Cancel button behavior works seamlessly on mobile viewports.
2. **Results List Display:**
   - **Observation:** On tablet landscape and desktop (1024px+), each search result item (`ion-item`) stretches across the entire window. The poster thumbnail is on the far left, while the media type badge (`Movie`, `TV`, `Person`) is pinned to the far right with over 800px of empty space in between.
   - **Code Location:** [`/home/usign/.temp/open-movie-tracker/src/app/search/search.page.html#L29-L56`](file:///home/usign/.temp/open-movie-tracker/src/app/search/search.page.html#L29-L56).
   - **Remediation:** Enclose results list in a centered container (`max-w-3xl mx-auto`).
3. **Empty States & Recent Searches:**
   - Empty search state displays recent search chips and trending suggestions.
   - "Clear recent" icon button tap target is 36px (`Needs padding to 44px`).
4. **No Results Found:**
   - Icon and text centered appropriately with clear visual hierarchy.
