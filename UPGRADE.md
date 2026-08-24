# Upgrade to SponsorFlow 1.9

## 1. Back up the Sheet
Use **File → Make a copy** in the SponsorFlow Google Sheet.

## 2. Update GitHub Pages
Upload the 1.9 update files and replace matching files.

The important public files are:
- `admin.html`
- `attendance.html`
- `attendance-admin.html`
- `assets/theme.js`

Do **not** replace `assets/config.js`.

The old `attendance-admin.html` now redirects to the main admin dashboard, so existing bookmarks do not strand officers on a second dashboard.

## 3. Update Google Apps Script Code.gs
Open **Google Sheet → Extensions → Apps Script → Code.gs** and replace the file with `SponsorFlow-1.9-Code.gs`.

## 4. Update Google Apps Script Admin.html
This release DOES change the Google Apps Script `Admin.html` file.

Open **Apps Script → Admin.html** and replace its entire contents with `SponsorFlow-1.9-Admin.html`.

## 5. Run the 1.9 upgrade
Reload the Google Sheet and choose:

**SponsorFlow → Upgrade to SponsorFlow 1.9**

This is additive/safe. Existing sponsor outreach, attendance meetings, attendance records, planner data, calendars, and comments are preserved.

## 6. Redeploy the existing Apps Script web app
Go to:

**Deploy → Manage deployments → pencil icon → Version → New version → Deploy**

Update the existing deployment so the `/exec` URL does not change.

## 7. Test
Open the normal SponsorFlow Admin dashboard and sign in once. The sidebar should now contain:
- Review queue
- Sponsor contacts
- Email templates
- Attendance

Open **Attendance** and verify that the latest meeting headcount, trend chart, member participation table, and team comparison render.
