# SponsorFlow 1.7 changelog

## Attendance tracker

- Added a dedicated `attendance.html` workspace.
- Members check in with their name and a meeting-specific password.
- Officers unlock meeting management with the existing shared SponsorFlow admin password.
- Officers can create/edit meetings, choose team/date/time/location, open or close check-in, rotate the meeting password, archive meetings, review rosters, export attendance CSV, and remove accidental records.
- Duplicate attendance entries are prevented by normalized member name per meeting.
- Meeting passwords are salted and hashed before storage.
- Added `Attendance Meetings` and `Attendance Records` Google Sheet tabs.
- Attendance read loading uses the same JSONP-compatible path as the planner/calendar bootstrap for better mobile Safari reliability.

## Calendar range cleanup

- Multi-day tasks and events no longer appear on every day in their date range.
- Ranged work appears on the start date and the due/end date only.
- Start markers read `Starts`; end markers read `Due`, or `Ends` for meeting/event items.
- Mobile calendar labels use compact `S`, `D`, and `E` endpoint prefixes.
- Monthly agenda entries and `.ics` exports still retain the complete range.

## Navigation and home

- Added Attendance to desktop navigation.
- Added Attendance to the mobile app navigation.
- Added an Attendance module to the home page.
- Added an Attendance shortcut to the GitHub Pages admin landing page.
- Updated asset versions to v17 to avoid stale GitHub Pages/browser caches.
