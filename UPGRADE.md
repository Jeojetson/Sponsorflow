# SponsorFlow 1.2 calendar cleanup

SponsorFlow 1.2 simplifies the calendar picker and fixes the alignment issues shown in Safari.

## What changes

The calendar picker now contains only:

- All calendars
- Important club events
- General timeline
- One calendar for each active subteam

Individual project-timeline calendars are no longer duplicated in the main picker or subscription screen. Tasks are still saved to their underlying project timeline, so no planning data is removed.

The calendar page also has:

- one event/subscription action area instead of duplicated buttons;
- aligned name and calendar controls;
- a clearer month navigation row;
- improved agenda and subscription-card alignment;
- cleaner tablet and phone layouts.

## Install

1. Back up the GitHub repository or download its current ZIP.
2. Extract `asme-sponsorflow-1.2-update.zip`.
3. Upload these files to the repository root, replacing the existing copies:
   - `calendar.html`
   - `assets/calendar.js`
   - `assets/app.css`
4. Do not replace `assets/config.js`.
5. Commit to `main` and wait for the GitHub Pages deployment to finish.
6. Refresh the calendar with `Command + Shift + R`.

## Google Apps Script

No Google Sheet migration or Apps Script redeployment is required for version 1.2. Existing live subscription URLs continue to work.
