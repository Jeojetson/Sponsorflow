# SponsorFlow v6 — UI cleanup update

This release is a frontend-only repair and polish update. It does not change the Google Sheet schema or Apps Script backend.

## What it fixes

- Repairs the oversized progress card that covered the timeline heading. A CSS class used for both the summary card and its progress bar was causing the card to become absolutely positioned.
- Prevents timeline titles, metrics, filters, and action buttons from overlapping or being clipped.
- Makes the board columns fit more cleanly on desktop and scroll predictably on smaller screens.
- Adds visible, stable horizontal scrollbars to the Board, Timeline, and Table views.
- Improves control hitboxes, checkbox alignment, focus states, and select-field sizing.
- Makes the control deck, metrics, toolbar, action row, and navigation responsive at tablet and phone sizes.
- Removes the large blank space that could appear above the summary cards on medium-size screens.
- Improves long-title wrapping and protects the page from accidental whole-page horizontal scrolling.
- Improves mobile navigation so all four destinations are visible instead of being cut off.
- Bumps asset versions to `v=6` so GitHub Pages and browsers load the corrected files.

## Install

1. Download and extract the v6 update ZIP.
2. In the GitHub repository, upload the files from the extracted folder and replace the matching files.
3. Keep the existing `assets/config.js`. The update package does not include it.
4. Commit the changes to `main`.
5. Wait for **Actions → pages build and deployment** to show a green check.
6. Open the live site and press **Command + Shift + R**.

## No Apps Script work is required

Do not replace `Code.gs`, run a Sheet migration, or redeploy Apps Script for this update. Your tasks, teams, funding opportunities, comments, and sponsor records are unchanged.

## Quick verification

Open the Project Planner and confirm:

- The four summary cards appear as equal cards with no giant overlay.
- The timeline heading is fully visible.
- At narrower browser widths, the action buttons move beneath the heading rather than covering it.
- The Board scrolls inside its own area instead of widening the whole webpage.
- On a phone, the top navigation appears as a two-column grid.
