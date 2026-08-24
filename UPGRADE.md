# Upgrade to SponsorFlow 1.3

SponsorFlow 1.3 adds member-created calendars, a complete light/dark theme system, and a phone-specific application layout.

## 1. Back up the Google Sheet

Open the SponsorFlow Sheet and choose:

`File → Make a copy`

The migration is additive, but keeping a backup before any Apps Script upgrade is good practice.

## 2. Update the GitHub Pages files

Extract the GitHub update ZIP and upload its contents to the root of the existing GitHub repository, replacing matching files.

Replace:

- `index.html`
- `outreach.html`
- `planner.html`
- `calendar.html`
- `admin.html`
- `assets/app.css`
- `assets/calendar.js`

Add:

- `assets/theme.js`

Do not replace or delete:

- `assets/config.js`
- `assets/img/`

Commit the changes to `main` and wait for the Pages deployment action to finish.

## 3. Replace Google Apps Script Code.gs

Open:

`Google Sheet → Extensions → Apps Script → Code.gs`

Replace the complete contents with `SponsorFlow-1.3-Code.txt`, then save.

The Google Apps Script `Admin.html` file does not change in this release.

## 4. Run the additive Sheet migration

Reload the Google Sheet and choose:

`SponsorFlow → Upgrade to SponsorFlow 1.3`

This creates the `Planner Calendars` sheet. It does not rewrite existing tasks, dates, sponsors, requests, comments, teams, timelines, or funding opportunities.

## 5. Redeploy the existing Apps Script web app

In Apps Script choose:

`Deploy → Manage deployments → Pencil icon → Version: New version → Deploy`

Edit the existing deployment rather than creating a second deployment. This preserves the `/exec` URL already stored in `assets/config.js`.

## 6. Refresh the website

After GitHub Pages finishes deploying, open the site and use:

`Command + Shift + R`

The website should display a theme button in the header. On phones it should also show the bottom application navigation.

## Acceptance test

1. Open Calendar and enter your name.
2. Select **Manage calendars**.
3. Create a calendar named `Race Readiness`.
4. Select Mechanical Design, Kart Setup, Wiring Harness, and Battery.
5. Include the general timeline and save.
6. Confirm the new calendar appears in the selector.
7. Open **Subscribe** and confirm the custom feed appears.
8. Edit the custom calendar and change its teams or accent.
9. Remove it and confirm the underlying tasks remain visible in their original team calendars.
10. Switch between light and dark mode, then reload the page.
11. Open the site on a phone and confirm the bottom navigation and full-screen editors work.
