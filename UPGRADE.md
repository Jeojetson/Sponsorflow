# Upgrade SponsorFlow to version 2

This update preserves the existing Google Sheet data and adds:

- Name-based request access instead of browser-saved edit codes
- Member-submitted sponsor companies and emails with an **Unverified sponsor** badge
- Officer verification before approval or sending
- Improved built-in sponsorship templates
- Public club statistics and member leaderboards
- A cumulative graph of sponsor emails marked sent
- Responsive UI cleanup
- Safe spreadsheet schema migration that does not clear existing rows

## Part 1 — Update GitHub Pages

Upload or replace these files in the GitHub repository:

```text
index.html
admin.html
assets/app.css
assets/member.js
```

You may also upload `assets/api.js`, although it is unchanged.

**Do not overwrite `assets/config.js`** unless you are intentionally re-entering the Apps Script `/exec` URL.

After committing the files:

1. Open the repository's **Actions** tab.
2. Wait for **pages build and deployment** to finish with a green check.
3. Hard-refresh the live site with `Command + Shift + R`.

## Part 2 — Update Apps Script

Open the SponsorFlow Google Sheet, then choose **Extensions → Apps Script**.

Replace the contents of:

```text
Code.gs
Admin.html
```

with the matching files in the `apps-script` folder. Copy the raw source code, not the rendered page.

Click **Save**.

## Part 3 — Run the migration and refresh templates

Return to the Google Sheet and reload it. Choose:

```text
SponsorFlow → Upgrade to v2 + refresh templates
```

This action:

- Adds the new `sponsorVerification` request column
- Preserves existing contacts and requests
- Refreshes the six built-in templates
- Leaves custom templates untouched

Existing version-1 requests are treated as verified when they already reference a directory contact.

## Part 4 — Redeploy Apps Script

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

## Part 5 — Test the new workflow

1. Open the public portal.
2. Enter a consistent full name.
3. Select **Suggest a sponsor**.
4. Enter an email address you control.
5. Submit a test request.
6. Open the admin dashboard.
7. Confirm the request displays **Unverified**.
8. Click **Verify & add to directory**.
9. Approve it, copy it, and mark it sent.
10. Open **Club stats** and confirm the sent total and graph update.

## Name-based access behavior

Requests are now retrieved by a case-insensitive, whitespace-normalized version of the member name. For example, `Colin Ternus` and `  colin   ternus ` match the same request history.

There are intentionally no member passwords or edit codes. Anyone entering the same name can view that name's requests. Do not use SponsorFlow for confidential, financial, medical, academic, or private personal information.
