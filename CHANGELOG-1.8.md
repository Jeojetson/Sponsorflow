# SponsorFlow 1.8 — Attendance Insights

## New officer analytics page

SponsorFlow now includes `attendance-admin.html`, an admin-only attendance analytics dashboard using the same shared SponsorFlow admin password as meeting management.

The dashboard includes:

- latest meeting turnout
- average and median turnout
- unique people checked in
- total check-ins
- repeat attendees
- completed meetings tracked
- recent-meeting turnout trend
- meeting-by-meeting turnout history
- member participation leaderboard
- selected-meeting coverage per member
- team-level average turnout comparison
- date-range and meeting-group filters
- filtered CSV export

Attendance Insights intentionally reports check-ins rather than an official attendance percentage because SponsorFlow does not know the club's required membership roster or which subteam meetings each person is expected to attend.

## Navigation

- The Attendance meeting-management tools now include an **Attendance analytics** button.
- The GitHub Pages Admin landing page now includes **Open attendance analytics**.
- Existing admin sessions are reused through the same session token when possible.

## Data and backend

No spreadsheet schema or Apps Script changes are required. The analytics page reads the existing `Attendance Meetings` and `Attendance Records` data through the already-protected `attendanceAdminData` endpoint.
