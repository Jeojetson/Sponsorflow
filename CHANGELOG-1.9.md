# SponsorFlow 1.9 — Integrated Attendance Admin

## Main change
Attendance analytics now live inside the existing Google Apps Script SponsorFlow Admin dashboard as a fourth sidebar tab. The separate GitHub Pages attendance analytics dashboard is deprecated and redirects to Admin → Attendance.

## Attendance dashboard
The integrated officer view includes:
- Latest meeting turnout
- Average turnout
- Unique attendees
- Repeat attendees and return percentage
- Meetings tracked
- Turnout trend for recent meetings
- Recent meeting headcounts
- Member attendance leaderboard
- Meeting coverage by member
- Last-seen dates
- Average turnout by meeting group/team
- Time-window and team filters
- CSV export of the filtered attendance records

Attendance metrics use the same admin login/session as sponsor review. No second password prompt or second admin session is required.

## UX cleanup
- Removed the separate Attendance Insights link from the public admin landing page.
- Attendance meeting management now links to the main Admin → Attendance view for metrics.
- The legacy `attendance-admin.html` URL redirects to the main admin dashboard.
- Admin login copy now reflects both sponsor outreach and attendance responsibilities.

## Google backend
`getAdminData()` now includes an attendance snapshot so the primary officer dashboard can render metrics with the same authenticated request used for sponsor administration.

No attendance records are migrated or rewritten.
