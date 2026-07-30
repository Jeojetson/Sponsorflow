# SponsorFlow v7 — definitive layout repair + calendar exports

This is a frontend-only update. It does not change the Google Sheet schema, sponsor records, planner tasks, or Apps Script backend.

## What v7 fixes

- Permanently removes the oversized Overall Progress overlay by renaming the card tone to `metric-completion`. This remains safe even if a browser briefly retains an older stylesheet.
- Bumps all public asset URLs to `v=7`, forcing GitHub Pages and browsers to retrieve the corrected CSS and JavaScript.
- Makes the task editor dialog size itself at the dialog level instead of placing a 1,180-pixel form inside a narrower 930-pixel dialog.
- Eliminates the clipped left side, horizontal form drift, and unusable submenu layouts shown in the screenshots.
- Makes task and workspace dialogs responsive, centered, internally scrollable, and bounded to the visible browser height.
- Adds a sticky task footer so Save, Archive, and calendar controls remain reachable.
- Improves close-button hitboxes, focus rings, long text wrapping, workspace lists, and mobile dialog stacking.

## New Calendar view

The Project Planner now has a fifth view: **Calendar**.

It includes:

- A responsive monthly calendar populated from task start and due dates
- Clickable events that open the task editor
- A month agenda with owners, statuses, priorities, and date ranges
- Previous month, Today, and next month controls
- A `.ics` download for the entire selected timeline
- A per-task `.ics` download from the agenda
- An **Add to calendar (.ics)** button inside the task editor

The exported iCalendar files work with Apple Calendar, Outlook, and Google Calendar import. Events are exported as all-day events; multi-day tasks use their start and due dates.

## Install

1. Make a backup or download a ZIP of your GitHub repository.
2. Extract the v7 update ZIP.
3. Upload its contents to the root of the GitHub repository, replacing matching files.
4. Keep your existing `assets/config.js`. The update ZIP intentionally does not contain it.
5. Commit the changes to `main`.
6. Wait for **Actions → pages build and deployment** to show a green check.
7. Open the live planner. The HTML now requests `app.css?v=7` and `planner.js?v=7`, so a normal reload should retrieve the fix. On Safari, use **Command + Shift + R** once.

## No Apps Script work is required

Do not replace `Code.gs`, run a Sheet migration, or redeploy Apps Script. V7 uses the existing task dates already stored in the planner.

## Verification checklist

- The Overall Progress card is the same size as the other summary cards.
- The timeline title remains fully visible above the summary cards.
- Opening a task shows the complete left and right columns with no horizontal page scrollbar.
- The task dialog is centered and remains within the browser window.
- At narrower widths, the task editor becomes one column instead of clipping.
- The Calendar tab displays dated tasks.
- **Download calendar** produces an `.ics` file.
- A task with a start or due date shows **Add to calendar (.ics)** in its editor.
