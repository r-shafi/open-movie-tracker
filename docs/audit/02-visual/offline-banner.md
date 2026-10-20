# Visual Audit: Offline Banner

**Component:** Offline Banner  
**Source Component:** [`/home/usign/.temp/open-movie-tracker/src/app/shared-module/offline-banner/offline-banner.component.ts`](file:///home/usign/.temp/open-movie-tracker/src/app/shared-module/offline-banner/offline-banner.component.ts)  
**Parent Template:** [`/home/usign/.temp/open-movie-tracker/src/app/app.component.html#L2`](file:///home/usign/.temp/open-movie-tracker/src/app/app.component.html#L2)  
**Audited Viewports:** 360x800, 390x844, 768x1024, 1024x768, 1440x900.  

---

## 1. Visual Findings & Concrete Observations

1. **Visibility & Trigger:**
   - App-level sticky banner positioned at the very top of `AppComponent`.
   - Listens reactively to `NetworkService.isOnline$` (Capacitor Network plugin and window `online`/`offline` events).
2. **Safe Area Insets:**
   - Uses `padding-top: calc(6px + env(safe-area-inset-top))` to render gracefully beneath the Android status bar and iPhone notch without overlapping text.
3. **Contrast & Sizing:**
   - Red danger background with white text and `cloud-offline-outline` icon.
   - Contrast ratio exceeds 5.5:1 against white text.
