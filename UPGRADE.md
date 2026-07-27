# Upgrade SponsorFlow to version 3

This update preserves existing Google Sheet data and adds duplicate-outreach protection, official sponsor-program research, application-form routes, and upgraded templates.

## Part 1 — Back up the Sheet

Before upgrading, open the SponsorFlow Google Sheet and choose:

```text
File → Make a copy
```

The migration is designed to preserve all rows, but a backup gives the club a simple rollback point.

## Part 2 — Update GitHub Pages

Upload or replace these files in the GitHub repository:

```text
index.html
admin.html
assets/app.css
assets/api.js
assets/member.js
```

You may also upload the research documents:

```text
validated-sponsors.csv
VALIDATED-SPONSORS.md
README.md
SECURITY.md
UPGRADE.md
```

**Do not overwrite `assets/config.js`.** Your existing Apps Script `/exec` URL is already stored there, and the drop-in update package intentionally excludes that file.

Commit the files to `main`, then wait for **Actions → pages build and deployment** to finish with a green check.

## Part 3 — Update Apps Script

Open the SponsorFlow Google Sheet and choose:

```text
Extensions → Apps Script
```

Replace the complete contents of:

```text
Code.gs
Admin.html
```

with the version-3 files in the `apps-script` folder. Copy the raw source, not a browser-rendered page. Click **Save**.

## Part 4 — Run the v3 migration and sponsor import

Reload the Google Sheet. From the new **SponsorFlow** menu, choose:

```text
Upgrade to v3 + import sponsor research
```

This action:

- Adds outreach-route and duplicate-acknowledgement columns where needed
- Preserves all existing rows
- Refreshes the six built-in templates
- Imports 18 official sponsor opportunities
- Marks newly imported official routes verified and active
- Preserves an officer's active/verified choices on later research refreshes

You can later run **SponsorFlow → Import or refresh validated sponsors** to refresh the seeded research without clearing your own contacts.

## Part 5 — Redeploy Apps Script

Saving Apps Script does not update the live `/exec` deployment by itself.

Choose:

```text
Deploy → Manage deployments
```

Then:

1. Click the pencil icon beside the current deployment.
2. Choose **New version**.
3. Click **Deploy**.

Keep the same deployment and URL. You do not need to edit `assets/config.js` again.

## Part 6 — Refresh GitHub Pages

After the GitHub Pages workflow succeeds, hard-refresh the live site:

```text
Command + Shift + R
```

The version-3 files use `?v=3` cache-busting, but a hard refresh is still useful after a major update.

## Part 7 — Test duplicate protection

1. Select an imported sponsor with no prior outreach.
2. Confirm the page shows **No prior outreach**.
3. Submit a test request and approve/mark it sent in the admin dashboard.
4. Start a second request to the same company.
5. Confirm the page shows **Contacted 1×** and requires acknowledgement.
6. Create a request to the same company while the first request is still pending.
7. Confirm the page shows **Active outreach exists**.
8. Type the same company manually in **Suggest a sponsor** and verify the duplicate warning still appears.

## Part 8 — Review imported sponsor opportunities

The Contacts sheet will contain official email or form routes, suggested asks, eligibility constraints, personalization ideas, and source URLs. Before real outreach:

- Open the official source
- Confirm the program is still accepting requests
- Coordinate faculty or Purdue authorization where the record says it is required
- Tailor the request to a concrete EV-Kart engineering need
- Avoid submitting to two routes at the same company without officer coordination

## Matching behavior

SponsorFlow matches prior outreach by contact ID, exact email, or normalized company name. Company matching ignores capitalization, punctuation, and common suffixes such as `Inc.`, `LLC`, and `Corporation`.

An intentional follow-up is still allowed, but the member must explicitly acknowledge the previous outreach. The backend enforces this requirement independently of the browser.
