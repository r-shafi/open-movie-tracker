# Visual Audit: Letterboxd Import Wizard (All Steps)

**Component:** Letterboxd Import Wizard Modal  
**Source Template:** [`/home/usign/.temp/open-movie-tracker/src/app/settings/letterboxd-import-modal/letterboxd-import-modal.component.html`](file:///home/usign/.temp/open-movie-tracker/src/app/settings/letterboxd-import-modal/letterboxd-import-modal.component.html)  
**Source Component:** [`/home/usign/.temp/open-movie-tracker/src/app/settings/letterboxd-import-modal/letterboxd-import-modal.component.ts`](file:///home/usign/.temp/open-movie-tracker/src/app/settings/letterboxd-import-modal/letterboxd-import-modal.component.ts)  
**Audited Viewports:** 360x800, 390x844, 768x1024, 1024x768, 1440x900.  

---

## 1. Step-by-Step Visual Inventory & Findings

### Step 1: Configure & Detected Files
- **Layout:**
  - 2-column grid showing detected status for `diary.csv`, `reviews.csv`, `ratings.csv`, `watched.csv`, `watchlist.csv`, and custom lists.
  - Checkmark circles (green) for found files; grey cross circles for absent files.
- **Privacy Notice Card:**
  - Prominent green shield banner displaying:
    `"Privacy Guarantee: Email address, pronoun, family name, location, and website are NEVER parsed or stored."`
  - Opt-in toggle for Profile Name & Bio (defaults to OFF).

### Step 2: Matching Progress
- **Layout:**
  - Centered animated download icon, title counter (`Matching: "Inception" (14/350)`), and progress bar.
  - Concurrency limiter and exponential backoff keep UI thread responsive (no frame drops).

### Step 3: Ambiguous Match Disambiguation
- **Layout:**
  - Displays Letterboxd source title and year.
  - List of candidate matches with poster thumbnail, title, release year, TMDb score, and "Choose" button.
- **Deficiencies Identified for Phase C:**
  - **Observation:** Currently only single-item "Choose" or "Skip" is available. Disambiguating 20+ titles requires repetitive clicks.
  - **Remediation:** Add bulk actions toolbar ("Accept All Top Matches", "Skip All Ambiguous").

### Step 4: Dry Run Summary & Confirmation
- **Layout:**
  - 4-stat grid: Confident Watched, Watchlist Items, Custom Lists, and Unmatched items.
  - Download button for `unmatched-letterboxd-titles.csv` if any titles could not be resolved.
  - Notice reminding user of the automatic atomic backup and 1-tap undo capability.

### Step 5: Committing & Step 6: Success
- **Layout:**
  - Committing state displays spinner and progress status.
  - Success screen displays green checkmark, summary counts, and "Close & View Collection" button.
