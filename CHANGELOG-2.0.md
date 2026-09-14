# SponsorFlow 2.0

## Attendance feedback

- Successful check-ins now open a clear confirmation dialog.
- The confirmation shows the member name, meeting, and recorded time.
- Duplicate check-ins show an explicit **Already checked in** state.
- The original inline status message remains as an accessibility fallback.

## Navigation and alignment

- Standardized the desktop header grid across all public pages.
- Standardized navigation button height, padding, active states, and Admin styling.
- Reworked tablet and phone header spacing.
- Tightened the mobile bottom navigation and safe-area spacing.
- Added one shared UI override layer so page-specific legacy rules no longer fight each other as often.

## Light and dark modes

- Light is now the predictable first-run default.
- The user's explicit Light/Dark selection is remembered.
- Removed automatic live switching when the operating system changes appearance.
- Normalized surfaces, controls, borders, text, dialogs, calendars, planner cards, and attendance panels against the same theme tokens.
- Preserved intentionally dark hero/header surfaces in both themes for consistent contrast.

## Copy cleanup

- Rewrote the homepage, outreach, planner, calendar, attendance, public Admin page, and Google Admin headings/help text.
- Removed marketing-style phrases and overly generic wording.
- Labels now describe the action directly: **Build draft**, **Submit for review**, **Check in**, **Project planner**, **Club calendar**, and similar.

## Google side

- `Admin.html` changes only.
- `Code.gs` is unchanged.
- No Google Sheet migration is required.
