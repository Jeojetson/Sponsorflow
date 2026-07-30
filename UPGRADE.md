# SponsorFlow v8 upgrade

Version 8 adds live calendar subscriptions, editable calendar events, separate team calendars, an Important Dates feed, and a club-wide portfolio that includes Finance & Sponsorship.

## Back up first

In the SponsorFlow Google Sheet, choose **File → Make a copy**.

## 1. Update GitHub Pages

Upload the contents of `asme-sponsorflow-v8-update.zip` to the root of the GitHub repository and replace matching files.

The update intentionally does **not** include `assets/config.js`, so the working Apps Script URL will not be overwritten.

Important frontend files:

- `planner.html`
- `index.html`
- `admin.html`
- `assets/app.css`
- `assets/planner.js`

Commit to `main`, then wait for **Actions → pages build and deployment** to finish.

## 2. Replace Code.gs

Open the SponsorFlow Google Sheet and choose:

**Extensions → Apps Script**

Replace all content in `Code.gs` with the v8 source from:

- `apps-script/Code.gs`, or
- `SponsorFlow-v8-Code.txt`

Save the project.

`Admin.html` does not need to change for this upgrade.

## 3. Run the v8 migration

Reload the Google Sheet. Choose:

**SponsorFlow → Upgrade to v8 + live calendar subscriptions**

This safely adds the new `importantDate` planner field and preserves existing contacts, requests, teams, timelines, tasks, comments, and activity history.

## 4. Redeploy Apps Script

In Apps Script choose:

**Deploy → Manage deployments → pencil icon → Version: New version → Deploy**

Keep the same deployment and the same `/exec` URL. No change to `assets/config.js` is required.

## 5. Refresh the website

After the GitHub Pages deployment is complete, reload the planner. A hard refresh on macOS is:

`Command + Shift + R`

## First test

1. Open **Project planner → Club-wide → Club-wide portfolio · all teams**.
2. Confirm Finance & Sponsorship tasks appear with the other teams.
3. Open **Calendar** and click a date to create an event.
4. Mark it **Important date**, save it, and reopen it to confirm editing works.
5. Select **Live subscriptions**.
6. Copy the Important Dates URL and open it in a browser. It should display iCalendar text beginning with `BEGIN:VCALENDAR`.
7. Subscribe using Apple Calendar, Outlook, or Google Calendar.

## Important limitation

Live calendar subscriptions are read-only in external calendar apps. Edit the event in SponsorFlow; the calendar app will retrieve the updated feed on its own refresh schedule. Refresh timing is controlled by Apple, Google, Microsoft, or the user's calendar client and is not instant.
