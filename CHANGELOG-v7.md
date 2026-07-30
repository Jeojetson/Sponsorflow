# SponsorFlow v7 changelog

## Layout repairs

- Renamed the progress-summary tone from `metric-progress` to `metric-completion` to eliminate compatibility with the old conflicting CSS selector.
- Reworked native `<dialog>` sizing so the dialog and its card share the same width.
- Set explicit maximum dialog heights using the dynamic viewport and internal scrolling.
- Added robust `min-width: 0` protections to task-editor columns and fields.
- Made the task side panel sticky on wide screens and normally stacked on smaller screens.
- Added a sticky task action footer.
- Improved workspace dialog wrapping and one-column behavior.
- Increased modal close-button size and visible keyboard focus.
- Bumped static assets to version 7 to defeat stale GitHub Pages caches.

## Calendar and iCalendar

- Added a monthly Calendar planner view.
- Added an agenda alongside the month grid.
- Added event status styling and priority markers.
- Added whole-timeline `.ics` export.
- Added per-task `.ics` export from the task editor and agenda.
- Included task description, team, timeline, status, priority, owners, funding context, parts context, requirements, and official URL in event descriptions when available.
- Used exclusive `DTEND` dates as required for all-day iCalendar events.

## Data safety

No backend tables or stored records are modified by this release.
