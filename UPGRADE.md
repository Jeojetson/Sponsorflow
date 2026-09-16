# Upgrade to SponsorFlow 2.1

SponsorFlow 2.1 speeds up the member Attendance page and reduces the amount of Google Sheet data read for each visitor.

## 1. Update GitHub Pages

Replace these files in the repository:

- `attendance.html`
- `assets/attendance.js`

Do not replace `assets/config.js`.

Commit the changes to `main` and wait for GitHub Pages to finish deploying.

## 2. Replace Google Apps Script Code.gs

Open the SponsorFlow Google Sheet and go to:

`Extensions → Apps Script → Code.gs`

Replace the existing Code.gs with `SponsorFlow-2.1-Code.gs` supplied with this update and save.

The Google Apps Script `Admin.html` file does not change.

## 3. Warm the attendance cache

Reload the Google Sheet and choose:

`SponsorFlow → Upgrade to SponsorFlow 2.1`

This does not change spreadsheet data. It simply verifies the schema and preloads the current open-meeting snapshot.

## 4. Redeploy Apps Script

Use:

`Deploy → Manage deployments → Edit → New version → Deploy`

Update the existing deployment so the `/exec` URL remains unchanged.

## 5. Refresh the Attendance page

After GitHub Pages finishes deploying, hard-refresh the Attendance page once.

## What users should notice

Returning users should normally see the last known open meeting list almost immediately. SponsorFlow then refreshes it silently from Google. First-time users still depend on an Apps Script request, but the server now reads far less data and can serve a cached response after the first request.
