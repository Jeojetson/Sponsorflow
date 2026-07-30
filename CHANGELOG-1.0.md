# SponsorFlow 1.0 changelog

## Calendar reliability

- Added a dedicated event editor instead of forcing simple dates through the full task form.
- A one-day event stores the same start and end date and appears correctly in the month view.
- Added all-day, optional start time, optional end time, and location fields.
- Calendar cells and agenda items open events in the quick editor.
- Regular project tasks continue to open in the full task editor.
- Live `.ics` subscriptions and snapshot downloads now emit timed events using the `America/Indiana/Indianapolis` time zone when times are present.

## Data stability

- Made the 1.0 Sheet migration additive-only. Running it again cannot overwrite existing planner or sponsor work.
- Removed legacy migration commands from the main Sheet menu to reduce accidental resets.
- A save is not reported as complete until the backend confirms the write and the planner data is read back from the Google Sheet.
- Unsaved task and event forms are retained as browser drafts.
- Closing a dirty form requires confirmation.
- Drafts are removed only after a successful shared save.
- Existing tasks remain compatible and default to all-day when the new fields are blank.

## Interface cleanup

- Replaced the oversized landing hero with a compact planner header.
- Reduced duplicated actions and moved secondary actions into a clear **More** menu.
- Added separate **+ Task** and **+ Event** actions.
- Rebuilt the task editor as four focused tabs.
- Replaced the wide task sidebar with a contained Schedule health panel and dedicated collaboration tab.
- Rebuilt sticky action bars so they do not cover form content.
- Improved mobile and tablet behavior.
- Increased primary hit targets and standardized button sizing.
- Removed page-level horizontal overflow; only dense boards and timelines scroll locally.

## Fixes

- Fixed the task-health card showing “No due date” while visible dates were present.
- Fixed calendar event creation defaulting to a long timeline end date.
- Fixed form fields appearing to reset after saves or reloads.
- Fixed modal clipping, footer overlap, and hidden left-side content.
- Fixed disabled aggregate-timeline editing controls by hiding unavailable actions instead.
