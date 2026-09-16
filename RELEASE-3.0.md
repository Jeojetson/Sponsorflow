# SponsorFlow 3.0 rollout

## Website

Review the redesign branch and its preview, then merge to the GitHub Pages publishing branch. Publish the public HTML and `assets` directory together so the new styles, fonts, and behavior use the same version. Keep `assets/config.js` unchanged. No Google Sheet migration is required.

Existing data is read through the same API. Task IDs, project/board IDs, custom-calendar IDs, comments, activity history, ownership, parts, funding, and dependencies retain their existing storage. Filtering only changes the view.

Rollback: restore the previous website commit. There is no new data schema to roll back.

## Officer dashboard

The repository contains historical Apps Script source, not a verified copy of the current deployed officer dashboard. Do not overwrite the live dashboard with those older files. For matching appearance, paste the contents of the new `apps-script/Brand.html` directly before `</head>` in the current deployed `Admin.html`. Publish a new version of the existing Apps Script deployment, keeping its URL. This snippet only changes appearance and adds a theme toggle. It requires the 3.0 public font asset to be published first.

The current live Apps Script source was not available for integration testing; the optional snippet should be checked in that deployment before release.

## Remaining brand inputs

- OneDrive resources folder URL.
- Web-licensed Bell MT font file for consistent banner typography. Until supplied, Bell MT is used when installed and Mona Sans is the fallback.

## Validation boundary

Browser regression tests use synthetic data and block all external requests. Save tests verify payload preservation and failure handling locally; they do not constitute a live production save test. No real records were edited during this redesign.
