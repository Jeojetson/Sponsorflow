# Upgrade SponsorFlow to version 4

This update preserves existing contacts, templates, sponsor requests, revisions, audit history, and statistics. It adds the collaborative project planner and five new Sheet tabs.

## 1. Back up the Google Sheet

Open the SponsorFlow Sheet and choose:

```text
File → Make a copy
```

Keep the copy until the v4 planner has been tested.

## 2. Update GitHub Pages

Upload or replace these files in the repository:

```text
index.html
admin.html
planner.html
assets/app.css
assets/api.js
assets/member.js
assets/planner.js
README.md
SECURITY.md
UPGRADE.md
```

**Do not replace `assets/config.js`.** It contains your working Apps Script `/exec` URL. The drop-in v4 update ZIP intentionally excludes that file.

Commit the files to `main`, then wait for **Actions → pages build and deployment** to finish with a green check.

## 3. Update Apps Script

Open the SponsorFlow Google Sheet and choose:

```text
Extensions → Apps Script
```

Replace all content in `Code.gs` with the v4 `apps-script/Code.gs` source and click **Save**.

`Admin.html` can also be replaced with the included file, although the sponsor-review dashboard itself is unchanged in this release.

## 4. Run the v4 migration

Reload the Google Sheet so the SponsorFlow menu refreshes. Choose:

```text
SponsorFlow → Upgrade to v4 + project planner
```

The migration will:

- Preserve every existing sponsor row
- Add the five planner tabs
- Add six starter teams
- Add one starter timeline for each team
- Refresh the built-in sponsor templates and validated sponsor catalog
- Leave existing contacts and officer choices intact

The starter teams and timelines can be renamed or expanded from the planner’s **Teams & timelines** button.

## 5. Redeploy Apps Script

Saving code does not update the live web-app version.

Choose:

```text
Deploy → Manage deployments
```

Then:

1. Click the pencil icon beside the current deployment.
2. Choose **New version**.
3. Click **Deploy**.

Keep the same deployment and `/exec` URL. No `config.js` change is required.

## 6. Refresh GitHub Pages

After the Pages action succeeds, open the site and hard-refresh:

```text
Command + Shift + R
```

Open **Project planner** from the navigation.

## 7. Recommended test

1. Enter your full name.
2. Open **Teams & timelines** and confirm the six starter teams appear.
3. Select **Battery Systems Roadmap**.
4. Add a task with owners, priority, dates, and a part requiring a quote.
5. Add a second task that depends on the first.
6. Drag the first task from Planned to In progress.
7. Open the Timeline view and confirm both tasks appear.
8. Add a comment and verify it appears in task history.
9. Open the site in another browser, edit the same task, and confirm changes are shared.
10. Export the board CSV.

## Public editing tradeoff

The planner intentionally has no individual login. Entered names provide attribution but are not verified identities. Anyone with the site URL can edit. Keep routine project data in the planner, retain a Sheet backup, and restrict direct access to the underlying Google Sheet to officers or trusted maintainers.
