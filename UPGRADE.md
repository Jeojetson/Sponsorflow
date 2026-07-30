# Upgrade SponsorFlow to version 5

Version 5 preserves existing sponsor and planner data. It adds the requested team structure, a research-backed Purdue funding calendar, funding-specific task fields, an Insights dashboard, and larger/cleaner controls.

## 1. Make a backup

Open the SponsorFlow Google Sheet and choose:

```text
File → Make a copy
```

## 2. Update GitHub Pages

Upload/replace the files from the v5 update ZIP.

**Do not replace `assets/config.js`.** The update ZIP intentionally excludes it, preserving your working Apps Script `/exec` URL.

Commit to `main`, then wait for **Actions → pages build and deployment** to finish.

## 3. Replace Apps Script

Open:

```text
Google Sheet → Extensions → Apps Script
```

Replace all of `Code.gs` with `apps-script/Code.gs`. `Admin.html` may also be replaced, although its sponsor-review workflow is unchanged.

## 4. Run the migration

Reload the Sheet and choose:

```text
SponsorFlow → Upgrade to v5 + team planner & funding calendar
```

The migration:

- Preserves sponsor requests, contacts, comments, revisions, planner comments, and activity
- Renames the original default workspaces into the requested teams
- Adds **Kart Setup** and **Software** teams
- Creates/updates timelines for Mechanical Design, Kart Setup, Wiring Harness, Battery, Software, Manufacturing Lead, Finance & Sponsorship, and Club-wide work
- Adds funding metadata columns to Planner Tasks
- Seeds the Purdue Funding & Sponsorship Calendar
- Refreshes system-seeded research metadata without resetting user status, owners, progress, or comments

## 5. Redeploy Apps Script

Saving does not update the live deployment:

```text
Deploy → Manage deployments → pencil icon → New version → Deploy
```

Keep the same `/exec` URL.

## 6. Hard refresh the site

After GitHub Pages finishes:

```text
Command + Shift + R
```

Open **Project planner**, choose **Finance & Sponsorship**, and select **Purdue Funding & Sponsorship Calendar**.

## 7. Test checklist

1. Confirm the requested teams appear.
2. Open the Finance timeline and verify the seeded opportunity tasks.
3. Open a funding task and confirm amount, campus, source confidence, source URL, and requirements appear.
4. Open **Insights** and switch between Current timeline and All teams.
5. Confirm the status donut, priority bars, workload, due-week chart, funding pipeline, and parts pipeline render.
6. Create a new funding opportunity and save it.
7. Create a purchase task and verify the parts pipeline updates.
8. Drag a task on the board and confirm the larger controls work on laptop and phone.

## Accuracy note

Several programs do not yet publish 2026–27 deadlines. SponsorFlow marks them clearly and uses internal preparation targets rather than presenting invented deadlines. Review `PURDUE-FUNDING-RESEARCH.md` for the source and confidence of each seeded opportunity.
