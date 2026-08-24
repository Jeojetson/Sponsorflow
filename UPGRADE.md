# SponsorFlow 1.7 upgrade

SponsorFlow 1.7 adds a shared attendance tracker and simplifies ranged calendar items so long-running work no longer fills every day of the month view.

## Before you upgrade

Make a backup of the Google Sheet with **File → Make a copy**.

## 1. Update GitHub Pages

Upload the 1.7 update files to the root of your existing repository and replace matching files.

Important changed files:

- `index.html`
- `outreach.html`
- `planner.html`
- `calendar.html`
- `admin.html`
- `attendance.html` (new)
- `assets/app.css`
- `assets/api.js`
- `assets/calendar.js`
- `assets/attendance.js` (new)
- `assets/theme.js`

Do **not** replace your existing `assets/config.js`; it contains your deployed Apps Script URL.

Commit to `main` and wait for GitHub Pages to finish deploying.

## 2. Replace Google Apps Script `Code.gs`

In the SponsorFlow Google Sheet, open **Extensions → Apps Script**. Replace the entire contents of `Code.gs` with the SponsorFlow 1.7 Code.gs file and save.

The Google Apps Script `Admin.html` file does **not** change in this release.

## 3. Run the additive migration

Reload the Google Sheet and choose:

**SponsorFlow → Upgrade to SponsorFlow 1.7**

This creates two new tabs if they do not already exist:

- `Attendance Meetings`
- `Attendance Records`

Existing sponsor outreach, planner, calendar, funding, comments, and task data are preserved.

## 4. Redeploy Apps Script

Open **Deploy → Manage deployments → Edit (pencil) → Version → New version → Deploy**.

Update the existing deployment so the `/exec` URL stays the same. You do not need to edit `assets/config.js`.

## 5. Refresh the website

After GitHub Pages finishes deploying, hard-refresh with **Command + Shift + R** or reopen the site.

The new `Attendance` workspace will appear in the site navigation and on the home page.

## Attendance workflow

1. An officer opens **Attendance → Manage meetings**.
2. The officer unlocks the meeting tools with the shared SponsorFlow admin password.
3. Create a meeting, choose its date/team, and set a meeting-specific password.
4. Leave **Check-in is open** enabled while attendance is being collected.
5. Members open Attendance, enter their name, choose the meeting, and enter the meeting password.
6. Duplicate check-ins by the same normalized name are prevented.
7. Officers can view the roster, export CSV, remove accidental records, close check-in, rotate the meeting password, or archive the meeting.

Meeting passwords are stored as salted hashes rather than readable text in the Google Sheet.

## Calendar behavior change

A ranged item now appears only at meaningful endpoints:

- once on its start date as **Starts**
- once on its due/end date as **Due** or **Ends**

It no longer creates a marker on every date between those endpoints. The agenda and `.ics` data still preserve the full date range.
