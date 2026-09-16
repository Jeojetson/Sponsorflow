# SponsorFlow 2.1 — Faster attendance loading

This release focuses on the member check-in path.

## Attendance performance

- The public attendance endpoint no longer scans the full Attendance Records sheet just to render open meetings.
- Open meeting details are cached server-side for five minutes.
- Saving, closing, or archiving a meeting refreshes that cache immediately.
- Renaming a planner team invalidates the attendance cache so team labels stay current.
- The Attendance page keeps a short-lived local copy of public meeting details. Returning members can see the meeting list immediately while SponsorFlow refreshes in the background.
- The selected meeting is preserved when the background refresh completes.
- Check-in no longer reloads the full public meeting list after a successful submission.
- The page refreshes meeting data when a backgrounded phone/browser tab becomes active again.
- Added preconnect hints for Google Apps Script hosts.

## Data and security

The browser cache only contains public meeting information already visible on the Attendance page: meeting title, date/time, team, location, and notes. It does not contain meeting passwords, password hashes, member attendance records, or admin data.

No Google Sheet columns or tabs are changed in this release.
