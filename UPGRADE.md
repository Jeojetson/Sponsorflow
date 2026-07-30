# Upgrade SponsorFlow to 1.0

SponsorFlow 1.0 is a stability and usability release for the Project Planner. It preserves the existing sponsor directory, requests, teams, timelines, tasks, comments, funding opportunities, and activity history.

## Before upgrading

1. Open the SponsorFlow Google Sheet.
2. Choose **File → Make a copy**.
3. Keep that copy until you have completed the tests below.

## 1. Update the GitHub Pages files

Extract `asme-sponsorflow-1.0-update.zip` and upload its contents to the root of the existing GitHub repository, replacing matching files.

The update intentionally does **not** contain `assets/config.js`. Do not delete or replace your working config file.

The principal changed files are:

```text
planner.html
index.html
admin.html
assets/app.css
assets/planner.js
apps-script/Code.gs
```

Commit the files to `main`, then wait for **Actions → pages build and deployment** to complete.

## 2. Replace the Apps Script backend

Open:

```text
Google Sheet → Extensions → Apps Script → Code.gs
```

Replace the entire contents of `Code.gs` with the SponsorFlow 1.0 version and save it.

A plain-text copy is also supplied as `SponsorFlow-1.0-Code.txt`.

## 3. Run the schema upgrade

Reload the Google Sheet, then choose:

```text
SponsorFlow → Upgrade to SponsorFlow 1.0
```

This adds these planner columns when they do not already exist:

```text
allDay
startTime
endTime
location
```

Existing rows are preserved. The 1.0 upgrade is additive-only: it creates missing columns and missing starter records, but it does not rewrite existing sponsors, templates, teams, timelines, tasks, dates, owners, progress, comments, or funding research. Existing dated tasks default to all-day items unless times are added.

## 4. Redeploy the Apps Script web app

Saving Code.gs does not update the public deployment by itself.

Open:

```text
Deploy → Manage deployments → pencil icon
```

Choose **New version**, enter a description such as `SponsorFlow 1.0`, and deploy the existing web-app deployment. Keep the same `/exec` URL.

## 5. Refresh GitHub Pages

Open the live planner and press:

```text
Command + Shift + R
```

The page now requests the `v=10` frontend assets, which should also prevent older cached layouts from returning.

## Acceptance test

1. Open **Calendar**.
2. Click a day or choose **+ Event**.
3. Create a one-day all-day event and save it.
4. Reopen the event and confirm its title, date, owner, and location remain intact.
5. Create a timed event by clearing **All-day event** and entering start/end times.
6. Open a regular task and check the **Schedule** tab. Its health card should reflect the visible due date.
7. Edit a task, close without saving, and confirm the discard warning appears.
8. Begin another edit, refresh the page before saving, reopen the same task, and confirm the browser offers to restore the unsaved draft.
9. Open **Subscribe** and verify the live calendar links still load.

## What changed

- Dedicated quick calendar-event editor
- Reliable single-day and multi-day events
- Optional event times and locations
- Server-confirmed saves before the UI reports success
- Local draft recovery for unsaved task and event edits
- Unsaved-change warnings
- Task editor split into Overview, Schedule, Details, and Comments & History
- Corrected task-health date preview
- Compact planner header and simpler action menus
- Responsive layouts with no page-level or modal horizontal overflow
- Timed events supported by downloaded and subscribed `.ics` calendars
