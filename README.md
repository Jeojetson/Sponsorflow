# SponsorFlow 5.4 — Purdue ASME workspace

A shared workspace for project work, calendars, sponsor outreach, and meeting attendance. GitHub Pages serves the website; the existing Google Apps Script deployment and Google Sheet hold shared records.

## Reels

Discover opens a clean, continuously scrolling video feed; Club keeps member posts separate. Saved reels and name-only Messages share the same identity. Phones show one inbox or conversation at a time. **Inboxes are not private:** anyone using the same name can read and send as that person. Follow [RELEASE-5.4.md](RELEASE-5.4.md) to update Reels.gs and enable optional daily discovery through the YouTube Apps Script service. Without it, Discover contains four starter picks. This is a shared catalogue, not YouTube's personalized Shorts feed. Run `npm run test:reels` for backend and browser coverage.

## Games

Six daily puzzles with time-and-accuracy scoring and shared club rankings. Kart Sprint is removed; previous scores are preserved separately. Players reconnect by name without codes. Mobile standings, daily wins, solve-time trends, streaks, and club activity charts are included. Follow [RELEASE-5.2.md](RELEASE-5.2.md) for the existing Apps Script update, and [GAMES-RELEASE.md](GAMES-RELEASE.md) for scoring rules.

The homepage uses supplied chapter art and a large Mona Sans Expanded Black heading. Dark mode is the default, with an optional persistent light theme. Finance records remain accessible under their own sidebar section while being hidden from combined project/calendar views. Every list sort supports ascending and descending order.

## Workspace redesign

- One theme system in `assets/brand.css`, with Mona Sans and the ASME gold, slate, and blue palette.
- Projects organized in a team/project sidebar. List, Board, Schedule, and Reports share the same records and filters.
- Quick filters for My work, Due this week (the next seven days), and Needs attention. Detailed filters are available on demand.
- Calendar sidebar for club, teams, projects, and existing custom calendars; Month and Agenda views, search, and event/deadline filters. Agenda is the default on every device; saved view choices are respected.
- A welcome prompt collects a name on first entry; the shared name button switches the active Games player and supplies attribution across the workspace.
- Editors preserve exact progress percentages, due-date-only records, and dependencies absent from the active task list. A successful save retains its assigned ID if the follow-up refresh fails.
- Restored access to My requests in Outreach and connected Attendance to the 2.1 loading/cache implementation already present in the repository.

## Data compatibility

The Games update appends scoring columns to Games Results. Existing attendance, planning, calendar, and outreach schemas do not change; no reseeding, bulk record update, or deletion is required. Existing API action names, board/task IDs, preference keys, calendar feed endpoints, and `assets/config.js` are retained. "Project" is the interface name for an existing planner board; it does not create a replacement record.

The historical `apps-script/Code.gs` and `apps-script/Admin.html` in this repository are older than the 1.9/2.1 files described in the project history. **Do not deploy those historical copies as part of this website update.** Keep the currently deployed backend. An optional appearance-only `apps-script/Brand.html` snippet can be inserted into the current Admin.html; it does not replace officer features or data logic.

## Resources and Bell MT

The home page reserves a resources entry. Set `window.ASME_RESOURCES.url` in `assets/resources.js` to the shared OneDrive HTTPS URL when ready. An empty URL shows a clear Coming soon state, with no dead link.

Mona Sans is included locally. The large homepage heading follows the updated Mona Sans Expanded Black direction. Bell MT remains restricted to optional large banners and is never used for body copy. See `assets/fonts/README.md`.

## Preview and verification

Serve this directory over HTTP, for example `python3 -m http.server 8765 --bind 127.0.0.1`. The real service may restrict preview origins. Regression tests replace the API with synthetic data and block external requests, so they never create real tasks or attendance records.

Install development dependencies with `npm install`, then run `npm test` while the server is running. The tests use Google Chrome by default. Set `SPONSORFLOW_BROWSER=chromium` if using Playwright's bundled Chromium, `SPONSORFLOW_BASE_URL` for a different server, or `SPONSORFLOW_QA_DIR` for screenshots. The tests cover desktop/tablet/phone layouts in both themes, project and calendar filtering, field preservation, optimistic-concurrency errors, retry behavior, and attendance member/officer workflows: password errors, duplicate check-in, meeting creation/editing/closing/archiving/restoring, roster removal and CSV export, session sign-out, analytics links, selection retention, and service outages.

See `RELEASE-5.4.md` for the Reels rollout and validation, and `RELEASE-5.2.md` for the earlier Games rollout. Run `npm run test:reels` for Reels, saves, and messaging coverage, and `npm run test:games` for puzzle, identity, analytics, transport, and mobile dashboard coverage.
