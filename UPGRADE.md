# Upgrade to SponsorFlow 1.4

SponsorFlow 1.4 is a frontend-only UI finalization release. It does not change Google Sheets, `Code.gs`, the Apps Script `Admin.html`, or live calendar feed behavior.

## 1. Update the GitHub Pages files

Extract the 1.4 update ZIP and upload its contents to the root of the existing GitHub repository, replacing matching files.

Replace:

- `index.html`
- `outreach.html`
- `planner.html`
- `calendar.html`
- `admin.html`
- `assets/app.css`
- `assets/theme.js`

Do not replace or delete:

- `assets/config.js`
- `assets/img/`

Commit the changes to `main` and wait for the GitHub Pages deployment workflow to show a green check.

## 2. Refresh the website

Open the live site and use:

`Command + Shift + R`

The HTML files now request the version 14 stylesheet and theme script, so browsers should not reuse the older theme files.

## No Google changes

For this release, do not:

- Replace `Code.gs`
- Replace the Google Apps Script `Admin.html`
- Run a Sheet migration
- Create or update an Apps Script deployment

All existing tasks, events, calendars, sponsors, requests, comments, funding opportunities, subscriptions, and Sheet data remain unchanged.

## Acceptance test

1. Open each public page in light mode and dark mode.
2. Confirm text, inputs, buttons, cards, and badges remain readable in both themes.
3. On a phone, confirm the header stays on one row and does not create a large blank area.
4. Scroll down on a phone and confirm the bottom navigation moves out of the way; scroll upward to bring it back.
5. Open Calendar and confirm the month grid fits the phone width without horizontal page scrolling.
6. Confirm **Subscribe** and **Download .ics** sit next to each other on phones.
7. Open a calendar event editor on a phone and confirm the title and eyebrow are not clipped.
8. Open a planner task editor on a phone and confirm all four task sections are visible in a two-by-two tab grid.
9. Open Board, Timeline, Table, and Insights at desktop and phone widths.
10. Confirm there is no page-level horizontal scrollbar. The Kanban board and Gantt view may scroll inside their own contained areas by design.
