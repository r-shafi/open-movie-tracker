# Visual Audit: Rated Entries (`/profile/ratings`)

**Page:** Ratings  
**Route:** `/profile/ratings`  
**Source Template:** [`/home/usign/.temp/open-movie-tracker/src/app/profile/ratings/ratings.page.html`](file:///home/usign/.temp/open-movie-tracker/src/app/profile/ratings/ratings.page.html)  
**Source Component:** [`/home/usign/.temp/open-movie-tracker/src/app/profile/ratings/ratings.page.ts`](file:///home/usign/.temp/open-movie-tracker/src/app/profile/ratings/ratings.page.ts)  
**Audited Viewports:**
- Small Phone: 360x800 ([`ratings-phone-360x800.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/ratings-phone-360x800.png))
- iPhone Class: 390x844 ([`ratings-iphone-390x844.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/ratings-iphone-390x844.png))
- Tablet Portrait: 768x1024 ([`ratings-tablet-768x1024.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/ratings-tablet-768x1024.png))
- Tablet Landscape: 1024x768 ([`ratings-tablet-landscape-1024x768.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/ratings-tablet-landscape-1024x768.png))
- Desktop Monitor: 1440x900 ([`ratings-desktop-1440x900.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/ratings-desktop-1440x900.png))

---

## 1. Visual Findings & Concrete Observations

1. **Star Badge Overlays:**
   - Every rated entry displays its exact star rating (e.g. `★ 4.5`, `★ 5.0`) overlaying the bottom of the poster.
2. **Sort Options:**
   - Dropdown enables sorting by Highest Rating, Lowest Rating, and Newest.
3. **Responsive Grid:**
   - Maintains uniform aspect ratio across phone, tablet, and desktop viewports.
