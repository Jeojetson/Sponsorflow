# SponsorFlow 1.5 upgrade

SponsorFlow 1.5 fixes the remaining calendar/mobile reliability issues and simplifies the calendar interface.

## What changes

- Mobile and Safari bootstrap requests now use a cross-origin script response instead of relying only on a hidden iframe.
- Bootstrap requests retry once and allow up to 60 seconds for an Apps Script cold start.
- Failed calendar loads include a visible **Retry** button.
- Important Club Events no longer includes any Funding task, even when that task is critical, a milestone, or manually marked important.
- The calendar page now exposes one primary **+ Event** action and one **More** menu for subscription/download actions.
- Duplicate calendar links were removed from the planner board header.
- Home-page hero content now has proper internal padding and cannot clip against its dark panel.
- Phone navigation, calendar controls, and action menus are more compact and better contained.

## 1. Back up the Sheet

In Google Sheets, use **File → Make a copy**.

## 2. Update GitHub Pages

Upload the contents of the 1.5 update ZIP to the root of the existing repository and replace matching files.

Do not replace or delete:

- `assets/config.js`
- `assets/img/`

Commit to `main` and wait for the GitHub Pages deployment action to complete.

## 3. Replace Google Apps Script `Code.gs`

Open:

**Google Sheet → Extensions → Apps Script → Code.gs**

Replace all of `Code.gs` with the supplied SponsorFlow 1.5 version and save.

The Google Apps Script `Admin.html` file does not change.

## 4. Run the safe upgrade

Reload the Google Sheet and choose:

**SponsorFlow → Upgrade to SponsorFlow 1.5**

There are no new columns or replacement sheets in this release. The upgrade checks the existing structure and normalizes date cells without deleting or rewriting club data.

## 5. Redeploy the web app

In Apps Script:

**Deploy → Manage deployments → pencil icon → Version: New version → Deploy**

Update the existing deployment so the `/exec` URL stays unchanged.

## 6. Refresh the site

After GitHub Pages deploys, hard-refresh with **Command + Shift + R**.

## Verification checklist

1. Open Calendar on an iPhone or Safari private tab.
2. Confirm data loads without the 30-second iframe timeout.
3. Select Important Club Events and confirm finance/funding applications are absent.
4. Confirm race, competition, meeting, inspection, milestone, and critical non-funding dates remain.
5. Open **More → Subscribe** and **More → Download .ics**.
6. Open the home page and confirm the hero heading has padding on every edge.
