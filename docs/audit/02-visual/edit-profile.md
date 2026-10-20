# Visual Audit: Edit Profile Modal (`/profile/edit-profile`)

**Component:** Edit Profile Modal  
**Source Template:** [`/home/usign/.temp/open-movie-tracker/src/app/profile/edit-profile/edit-profile.component.html`](file:///home/usign/.temp/open-movie-tracker/src/app/profile/edit-profile/edit-profile.component.html)  
**Source Component:** [`/home/usign/.temp/open-movie-tracker/src/app/profile/edit-profile/edit-profile.component.ts`](file:///home/usign/.temp/open-movie-tracker/src/app/profile/edit-profile/edit-profile.component.ts)  
**Audited Viewports:** 360x800, 390x844, 768x1024, 1024x768, 1440x900.  

---

## 1. Visual Findings & Concrete Observations

1. **Avatar and Cover Upload Pickers:**
   - Visual preview updates immediately when an image is picked.
   - Camera icon overlay signals editable photo slots.
2. **Input Fields:**
   - Display name and Bio input fields provide character counters.
   - Inputs adjust properly when virtual keyboard is engaged.
3. **Android Hardware Back Button (Finding Q-05):**
   - Modal lacks hardware back button handler; tapping device back button closes underlying view or leaves modal open.
   - Remediation: Implement `Platform.backButton.subscribeWithPriority(100)`.
