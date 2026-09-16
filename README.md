# SponsorFlow 4.0 — ASME Indianapolis workspace

A shared workspace for project work, calendars, sponsor outreach, and meeting attendance. GitHub Pages serves the website; the existing Google Apps Script deployment and Google Sheet hold shared records.

## Games

Seven mobile-friendly daily games and a shared club leaderboard: Word Sprint, Common Ground, Crown Grid, Equal Split, Waypoint, Number Garage, and Kart Sprint. Games save progress on the device, offer unranked practice, and share scores through a separate Google Apps Script service. See `GAMES-RELEASE.md` and `games-backend/README.md` for the one-time leaderboard setup. Existing Google Sheets and services are unchanged.

## Workspace redesign

- One theme system in `assets/brand.css`, with Mona Sans and the ASME gold, slate, and blue palette.
- Projects organized in a team/project sidebar. List, Board, Schedule, and Reports share the same records and filters.
- Quick filters for My work, Due this week (the next seven days), and Needs attention. Detailed filters are available on demand.
- Calendar sidebar for club, teams, projects, and existing custom calendars; Month and Agenda views, search, and event/deadline filters. Phones default to Agenda.
- Viewing no longer requires entering a name; attribution is requested when editing.
- Editors preserve exact progress percentages, due-date-only records, and dependencies absent from the active task list. A successful save retains its assigned ID if the follow-up refresh fails.
- Restored access to My requests in Outreach and connected Attendance to the 2.1 loading/cache implementation already present in the repository.

## Data compatibility

No schema migration, reseeding, bulk update, or record deletion is required. Existing API action names, board/task IDs, preference keys, calendar feed endpoints, and `assets/config.js` are retained. "Project" is the interface name for an existing planner board; it does not create a replacement record.

The historical `apps-script/Code.gs` and `apps-script/Admin.html` in this repository are older than the 1.9/2.1 files described in the project history. **Do not deploy those historical copies as part of this website update.** Keep the currently deployed backend. An optional appearance-only `apps-script/Brand.html` snippet can be inserted into the current Admin.html; it does not replace officer features or data logic.

## Resources and Bell MT

The home page reserves a resources entry. Set `window.ASME_RESOURCES.url` in `assets/resources.js` to the shared OneDrive HTTPS URL when ready. An empty URL shows a clear Coming soon state, with no dead link.

Mona Sans is included locally. Bell MT uses a local font when available; a web-licensed Bell MT file is still needed for consistent banners on every device. See `assets/fonts/README.md`.

## Preview and verification

Serve this directory over HTTP, for example `python3 -m http.server 8765 --bind 127.0.0.1`. The real service may restrict preview origins. Regression tests replace the API with synthetic data and block external requests, so they never create real tasks or attendance records.

Install development dependencies with `npm install`, then run `npm test` while the server is running. The tests use Google Chrome by default. Set `SPONSORFLOW_BROWSER=chromium` if using Playwright's bundled Chromium, `SPONSORFLOW_BASE_URL` for a different server, or `SPONSORFLOW_QA_DIR` for screenshots. The tests cover desktop/tablet/phone layouts in both themes, project and calendar filtering, field preservation, optimistic-concurrency errors, retry behavior, and attendance member/officer workflows: password errors, duplicate check-in, meeting creation/editing/closing/archiving/restoring, roster removal and CSV export, session sign-out, analytics links, selection retention, and service outages.

See `RELEASE-3.0.md` for rollout and remaining brand inputs.
