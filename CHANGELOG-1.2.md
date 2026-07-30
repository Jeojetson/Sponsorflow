# SponsorFlow 1.2 changelog

## Calendar organization

- Renamed the aggregate view to **All calendars**.
- Added a dedicated **General timeline** view for the existing Club-wide planning workspace.
- Kept **Important club events** as its own calendar.
- Added exactly one selectable calendar per active subteam.
- Removed individual timeline entries from the calendar selector and live-subscription list.
- Preserved old saved calendar selections by mapping them to the new structure.
- Preserved direct task links that contain a board identifier by mapping them to the correct team calendar.

## Interface cleanup

- Removed duplicated event and subscription buttons from the page header.
- Aligned the name field, save-name button, calendar picker, month controls, and action buttons.
- Simplified the month toolbar.
- Improved subscription cards and modal sizing.
- Improved tablet and mobile wrapping.
- Updated asset cache keys to version 12.

## Data safety

- No tasks, teams, timelines, comments, dates, or subscriptions are deleted.
- No Google Sheet columns are changed.
- No Apps Script deployment update is required.
