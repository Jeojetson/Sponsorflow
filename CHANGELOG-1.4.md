# SponsorFlow 1.4 changelog

## Theme and visibility

- Rebuilt the light and dark color tokens for predictable contrast.
- Corrected hard-coded white surfaces so dialogs, task cards, tables, analytics, calendar panels, and outreach forms adapt to dark mode.
- Restored intentional white text inside the dark homepage, outreach, and planner hero areas.
- Improved muted-text, required-field, success, warning, and verified-sponsor colors.
- Changed the theme control to display the current mode instead of an ambiguous destination label.
- Applied the saved theme before the stylesheet paints to reduce theme flashing during page load.

## Header and navigation

- Prevented an older responsive rule from turning the phone header into an oversized vertical column.
- Added iPhone safe-area padding with `viewport-fit=cover`.
- Reduced phone header height while keeping the brand and theme control fully tappable.
- Refined the floating phone navigation to follow screen edges and home-indicator spacing.
- Added scroll-aware phone navigation: it moves out of the way while scrolling down and returns when scrolling up, near the top, or near the bottom.

## Calendar

- Rebuilt the phone month layout as a compact seven-column calendar rather than a desktop-width horizontal canvas.
- Replaced event labels inside small phone cells with status dots; full event information remains in the agenda.
- Corrected old minimum-width rules that could push the month heading outside the screen.
- Aligned month navigation as a single segmented control.
- Kept Subscribe and Download `.ics` as equal phone actions.
- Reduced oversized empty-agenda spacing.
- Preserved editable events, custom calendars, snapshots, and live subscriptions.

## Planner

- Improved contrast for metrics, Board cards, Gantt rows, tables, Insights, filters, and form controls.
- Refined phone hero actions, board controls, filters, and metric stacking.
- Preserved intentionally contained horizontal scrolling for the Kanban board.
- Replaced the clipped mobile task-editor tab row with a clear two-by-two section grid.

## Dialogs and forms

- Corrected the negative event-header margin that clipped calendar-event headings on phones.
- Made task and event dialogs use safe full-screen phone layouts.
- Kept sticky save controls accessible without hiding the form content.
- Standardized inputs, selects, textareas, buttons, focus rings, borders, and placeholder contrast.

## Quality assurance

The final build was checked with mocked shared data at:

- 1440 × 1000 in light and dark mode
- 390 × 844 in light and dark mode
- Home, Outreach, Planner, and Calendar pages
- Planner task dialogs at desktop and phone sizes
- Calendar manager and event dialogs at desktop and phone sizes

No page-level overflow or JavaScript errors were found in the tested public pages. Kanban columns intentionally scroll inside their board container on phones.
