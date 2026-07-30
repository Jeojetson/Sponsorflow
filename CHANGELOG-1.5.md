# SponsorFlow 1.5 changelog

## Reliability

- Added a JSONP-style read channel for `bootstrap` and `plannerBootstrap`.
- Kept the existing POST/iframe channel for changes and approvals.
- Increased request timeout from 30 to 60 seconds.
- Added one automatic retry for cold-start read requests.
- Added a user-visible Retry control to calendar load errors.

## Calendar

- Funding tasks are excluded from Important Club Events in both the website filter and live iCalendar feed.
- Simplified visible actions to `+ Event` and `More`.
- Moved Subscribe and Download .ics into a compact overflow menu.
- Removed duplicate calendar action from the planner timeline header.
- Improved mobile name/calendar control alignment.

## UI

- Added real padding and containment to the home hero.
- Reduced phone navigation height and improved safe-area spacing.
- Improved command-bar alignment, menu positioning, and touch targets.
- Added cache-busting version 15 asset URLs.

## Data

No records, tasks, contacts, timelines, calendars, comments, or sponsor requests are deleted or migrated to a new format.
