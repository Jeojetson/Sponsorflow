# SponsorFlow 1.1 upgrade

SponsorFlow 1.1 fixes calendar date storage, moves the calendar into its own website section, adds a new workspace splash page, and applies one visual system across outreach, planning, calendar, and admin links.

## Important: back up the Sheet first

In the SponsorFlow Google Sheet, choose **File → Make a copy**.

## 1. Update the GitHub Pages files

Upload the contents of the 1.1 update package to the root of the existing GitHub repository and replace matching files.

New files:

- `outreach.html`
- `calendar.html`
- `assets/calendar.js`

Replaced files:

- `index.html`
- `planner.html`
- `admin.html`
- `assets/app.css`
- `assets/planner.js`

Do **not** replace or delete:

- `assets/config.js`
- `assets/img/`

The old sponsor portal that previously lived at `index.html` now lives at `outreach.html`. The new `index.html` is the workspace home page.

Commit the changes to `main`, then wait for **Actions → pages build and deployment** to finish.

## 2. Replace the Google Apps Script backend

Open the SponsorFlow Sheet, then choose:

**Extensions → Apps Script → Code.gs**

Replace all contents of `Code.gs` with the SponsorFlow 1.1 source and save it.

The Google Apps Script `Admin.html` file does not change in this release.

## 3. Run the date repair migration

Reload the Google Sheet and choose:

**SponsorFlow → Upgrade to SponsorFlow 1.1**

This migration:

- converts planner and calendar date cells to stable `YYYY-MM-DD` text values;
- repairs dates that Google Sheets previously auto-converted into Date objects;
- preserves existing tasks, events, sponsors, owners, statuses, progress, comments, funding research, and timelines;
- adds only missing starter records.

This step fixes the bug where an event appeared as the first day of a month or appeared in the agenda but not in the calendar grid.

## 4. Redeploy Apps Script

Choose:

**Deploy → Manage deployments → pencil icon → Version: New version → Deploy**

Edit the existing deployment so the `/exec` URL remains unchanged. You do not need to edit `assets/config.js`.

## 5. Refresh the website

After the GitHub Pages workflow is green, open the site and press:

**Command + Shift + R**

The site now has these main pages:

- `index.html` — workspace home
- `outreach.html` — sponsor outreach
- `planner.html` — project planner
- `calendar.html` — shared club calendar
- `admin.html` — secure admin dashboard link

## Acceptance test

1. Open `calendar.html`.
2. Enter your name.
3. Click a day in the month and create an all-day event.
4. Save it and verify it appears inside the correct day cell and in the agenda.
5. Edit its date and verify it moves to the new day.
6. Refresh the page and verify the date remains unchanged.
7. Create a timed event with a location.
8. Download the event as `.ics`.
9. Open Live subscriptions and verify the team calendars still load.
10. Open Planner and verify Board, Timeline, Table, and Insights still work.
