# SponsorFlow 1.1 changelog

## Calendar reliability

- Fixed Google Sheets date auto-conversion by normalizing planner dates to `YYYY-MM-DD`.
- Fixed calendar comparisons against timestamp-shaped values.
- Fixed the agenda showing the first day of a month when a Sheet cell contained a Date object.
- Added post-save verification so the calendar confirms the exact saved start and end dates.
- Added a dedicated calendar page with month, agenda, team/timeline scopes, event editing, `.ics` downloads, and live subscriptions.
- Added direct links from live subscribed events back to the relevant calendar item.

## Information architecture

- Added a new workspace splash page at `index.html`.
- Moved sponsor outreach to `outreach.html`.
- Kept project planning focused on Board, Timeline, Table, and Insights.
- Moved calendar creation and subscription controls to `calendar.html`.
- Unified navigation across Home, Outreach, Planner, Calendar, Team Site, and Admin.

## Interface polish

- Standardized control heights, radii, spacing, focus targets, and responsive behavior.
- Added a compact standalone calendar toolbar and clear calendar selector.
- Added a focused event editor that preserves project-task fields.
- Improved dialog sizing and mobile layouts.
- Reduced planner action duplication and replaced the embedded calendar entry point with a clear Calendar link.
- Applied the simpler card and spacing system across the workspace.

## Data preservation

- The 1.1 migration is additive and date-normalizing only.
- It does not refresh or overwrite existing sponsors, templates, tasks, event content, owners, status, progress, comments, or funding research.
