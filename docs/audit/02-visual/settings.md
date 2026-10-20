# Visual Audit: Settings, Interop & Data Management (`/settings`)

**Page:** Settings  
**Route:** `/settings`  
**Source Template:** [`/home/usign/.temp/open-movie-tracker/src/app/settings/settings.page.html`](file:///home/usign/.temp/open-movie-tracker/src/app/settings/settings.page.html)  
**Source Component:** [`/home/usign/.temp/open-movie-tracker/src/app/settings/settings.page.ts`](file:///home/usign/.temp/open-movie-tracker/src/app/settings/settings.page.ts)  
**Audited Viewports:**
- Small Phone: 360x800 ([`settings-phone-360x800.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/settings-phone-360x800.png))
- iPhone Class: 390x844 ([`settings-iphone-390x844.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/settings-iphone-390x844.png))
- Tablet Portrait: 768x1024 ([`settings-tablet-768x1024.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/settings-tablet-768x1024.png))
- Tablet Landscape: 1024x768 ([`settings-tablet-landscape-1024x768.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/settings-tablet-landscape-1024x768.png))
- Desktop Monitor: 1440x900 ([`settings-desktop-1440x900.png`](file:///home/usign/.temp/open-movie-tracker/docs/audit/screenshots/settings-desktop-1440x900.png))

---

## 1. Visual Findings & Concrete Observations

1. **Theme & Color Selection:**
   - Theme toggle (System / Light / Dark) and primary color picker (Green / Red) respond instantly.
   - Checked icon clearly highlights the active option.
2. **Custom TMDb API Key Input (Finding T-01 Verification):**
   - Password-masked input field with "Show / Hide" toggle button.
   - Status badge indicates whether the active key is "Custom" or "Bundled (Default)".
   - "Reset to default" button restores original bundled key cleanly.
3. **Data Management & Backup Section:**
   - JSON Backup export button downloads structured `.json` snapshot.
   - Import JSON button offers "Merge with existing data" or "Replace all data" confirmation alert.
   - Letterboxd Import trigger button opens the multi-step import wizard.
   - Letterboxd Export button generates `.zip` export bundle.
   - "Undo Last Import" button is prominently displayed when a pre-import backup exists.
4. **Offline TMDb Attribution (Finding T-04 Verification):**
   - Uses local asset [`/home/usign/.temp/open-movie-tracker/src/assets/tmdb-logo.svg`](file:///home/usign/.temp/open-movie-tracker/src/assets/tmdb-logo.svg).
   - Renders cleanly even when airplane mode / offline is enabled.
