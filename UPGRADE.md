# SponsorFlow 2.0 upgrade

SponsorFlow 2.0 is a UI and copy cleanup release. It does not change the Google Sheet schema or `Code.gs`.

## 1. Back up the current site

Keep a copy of your current GitHub repository before replacing files.

## 2. Update GitHub Pages

Upload the contents of `asme-sponsorflow-2.0-update.zip` to the repository root and replace matching files.

The update changes:

- `index.html`
- `outreach.html`
- `planner.html`
- `calendar.html`
- `attendance.html`
- `admin.html`
- `assets/theme.js`
- `assets/attendance.js`
- `assets/planner.js`
- `assets/ui-20.css` (new)

Do **not** replace `assets/config.js`. The update ZIP does not include it.

Commit to `main` and wait for the GitHub Pages deployment to finish.

## 3. Update the Google Apps Script Admin.html

`Code.gs` does **not** change in this release.

Open the Google Sheet, then:

1. **Extensions → Apps Script**
2. Open `Admin.html`
3. Replace the entire file with `SponsorFlow-2.0-Admin.html`
4. Save
5. **Deploy → Manage deployments → Edit → New version → Deploy**

Keep the existing deployment so the `/exec` URL does not change.

No Sheet migration is required.

## 4. Refresh

After GitHub Pages and Apps Script finish deploying, reload the site. On Safari, use **Command + Shift + R** once if an old stylesheet is cached.

## Attendance confirmation test

1. Open Attendance.
2. Enter a name, meeting, and correct meeting password.
3. Submit.
4. A large confirmation dialog should say **You're checked in** and show the meeting and check-in time.
5. Submitting the same name again should show **Already checked in** instead of creating a second record.

## Theme test

Check both Light and Dark on Home, Outreach, Planner, Calendar, Attendance, and the public Admin link page. The theme now stays on the selected mode until the user changes it; it no longer changes automatically when the device appearance changes.
