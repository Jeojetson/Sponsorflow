# Upgrade to SponsorFlow 1.8

SponsorFlow 1.8 is a frontend-only attendance analytics update.

## 1. Back up your current GitHub repository

Optional but recommended before replacing files.

## 2. Upload the 1.8 update to GitHub

Replace the matching files in the repository root with:

- `attendance-admin.html` (new)
- `attendance.html`
- `admin.html`
- `assets/attendance-admin.js` (new)
- `assets/app.css`
- `assets/theme.js`

Do **not** delete or replace `assets/config.js`.

Commit the files to `main` and wait for GitHub Pages to finish deploying.

## 3. Google Apps Script

No Google-side changes are needed for 1.8.

Do not replace `Code.gs`, modify the Google Apps Script `Admin.html`, run a Sheet migration, or redeploy the Apps Script web app.

## 4. Open Attendance Insights

Use either:

- `Attendance → Manage meetings → Attendance analytics`, or
- `Admin → Open attendance analytics`.

Enter the same SponsorFlow admin password used for meeting management. If you already unlocked the meeting tools in the same browser tab, the analytics page can reuse that session.

## 5. Verify

Check that:

1. the latest completed meeting shows the correct turnout;
2. the meeting history matches the `Attendance Meetings` sheet;
3. member counts match the `Attendance Records` sheet;
4. changing the time-range and meeting-group filters updates the metrics;
5. CSV export downloads the filtered attendance records.
