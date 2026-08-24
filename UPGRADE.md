# SponsorFlow 1.8 upgrade

SponsorFlow 1.8 is a frontend-only UI hardening release. It does not change the Google Sheet schema or Apps Script backend.

## 1. Update GitHub Pages

Upload the 1.8 update files to the root of the existing SponsorFlow repository and replace matching files.

Changed files:

- `index.html`
- `outreach.html`
- `planner.html`
- `calendar.html`
- `attendance.html`
- `admin.html`
- `assets/app.css`

Do **not** replace `assets/config.js`; it contains the deployed Apps Script URL.

All HTML pages now request version `v=18` assets to force browsers and GitHub Pages to load the refreshed stylesheet.

## 2. Google changes

None.

Do not replace `Code.gs`, do not change the Apps Script `Admin.html`, do not run a migration, and do not redeploy Apps Script.

## 3. Refresh

After GitHub Pages finishes deploying, hard-refresh the site with **Command + Shift + R**. On iPhone/Safari, close and reopen the SponsorFlow tab if an older stylesheet remains cached.
