# SponsorFlow 5.0 — member experience

The website now defaults to dark mode, uses the supplied chapter artwork, and puts chapter information ahead of member tools. The large home heading uses Mona Sans Expanded at weight 900. Gold, slate, blue, and warm off-white carry through both themes. An explicitly saved light preference still works.

Projects have ascending and descending sorting for title, status, priority, owner, start date, due date, progress, type, and team. Column headings also sort. Sidebar groups start open. Finance & Sponsorship is excluded from the combined work and calendar views, with its original records still available under **Finance records**. Custom calendars, direct project links, attendance, and existing record IDs are retained.

Calendar defaults to Agenda on every screen size unless the member previously chose Month. The hidden month grid is no longer built in Agenda. Projects and Calendar share a browser snapshot, show saved data immediately, deduplicate concurrent reads, and invalidate snapshots after a write. Each save gets its own response frame. The included server cache reduces repeated spreadsheet scans after it is installed.

## Update the existing Google backend

Use the Apps Script project already bound to the SponsorFlow spreadsheet. Do not replace its current Code.gs or Admin.html with the older copies in this repository. Do not run Initial setup or a historical SponsorFlow upgrade.

1. Replace the contents of the existing **Games.gs** with [games-backend/Games.gs](games-backend/Games.gs). If Games has never been installed, follow [the initial routing instructions](games-backend/README.md) first.
2. Save and run **setupGames** from the Apps Script function selector once. It appends six scoring columns to the existing Games Results tab. Existing player rows, results, attendance, projects, and settings are preserved. No manual spreadsheet-cell edits are needed.
3. Add a Script file named **Performance** and paste [apps-script/Performance.gs](apps-script/Performance.gs).
4. In your **current Code.gs**, change both public planner routing cases (one inside `jsonpReadResponse_`, one inside `doPost`) from:

   ```js
   case 'plannerBootstrap': data = plannerBootstrap_(); break;
   ```

   to:

   ```js
   case 'plannerBootstrap': data = plannerBootstrapCached_(); break;
   ```

5. In the current `withWriteLock_` helper, keep the lock and callback logic, adding invalidation before release:

   ```js
   function withWriteLock_(callback) {
     const lock = LockService.getScriptLock();
     if (!lock.tryLock(20000)) throw new Error('SponsorFlow is busy. Try again in a moment.');
     try {
       return callback();
     } finally {
       invalidatePlannerSnapshot_();
       lock.releaseLock();
     }
   }
   ```

6. Choose **Deploy → Manage deployments → Edit → New version → Deploy** for the existing web app. Keep its current access settings and URL. Save-only changes do not update the deployed app.
7. Publish the website changes on GitHub Pages. Open Games and use **Sync scores** for any pending results. Check the same player from a second device using its player code, and confirm a known existing task and attendance meeting still load.

The Performance addition is optional if you only want the client improvements; its three Code.gs changes and file must be installed together. Games timed rankings do require the new Games.gs and `setupGames`. First loads can still wait for Apps Script to start. Server snapshots expire after 60 seconds; browser snapshots can be reused for 15 seconds. Direct spreadsheet edits can take up to about 75 seconds to appear. Normal website edits invalidate the caches.

**Games is a website navigation item**, not a required Google Sheets menu item. The old “Upgrade to SponsorFlow 2.1” menu label does not indicate which Games backend is deployed. Use the Apps Script function selector for `setupGames`.

## Games and preserved scores

Six puzzles remain: Word Sprint, Common Ground, Crown Grid, Equal Split, Waypoint, and Number Garage. Kart Sprint is removed from the catalog and current rankings.

Each solved daily puzzle awards up to 800 accuracy points and 200 speed points. The timer starts when opened and continues through leaving, reloading, and resetting. The result shows the time, accuracy, point breakdown, and whether the club accepted it. Practice stays unranked. Details and limitations are in [GAMES-RELEASE.md](GAMES-RELEASE.md).

Old 100-point results and kart scores remain in the spreadsheet as version 1. The new leaderboard uses version 2, keeping the two scales separate. Existing player codes still work. Old local unfinished boards and pending results are retained in `legacyRuns` and `legacyPending`; they are not converted into timed scores. Daily puzzle seeds are unchanged.

The service now normalizes dates read from Sheets, retains the first daily result, isolates score versions, and refreshes rankings after a successful sync. Repeated submissions cannot create duplicate rows. Offline or rejected submissions remain explicitly labeled as device-only results.

## Verification

- 48 workspace page/width/theme checks, plus project sorting, theme persistence, Agenda/Month switching, field preservation, conflict and save-retry checks.
- Attendance member and officer workflows: incorrect password, check-in, duplicate prevention, create/edit/close/archive/restore, roster removal, CSV, analytics links, and outages.
- Games layouts at desktop/tablet/phone widths in both themes, short-phone keyboard fit, six complete puzzle submissions through an isolated backend, second-device restoration, timing/correction scores, practice, and old-deployment errors.
- 120 daily puzzle sets, invalid proofs, score bounds, version separation, additive schema upgrade, setup idempotence, and preservation of existing backend routes/settings.
- Real browser transport tests for read deduplication, snapshots, simultaneous saves, cache invalidation, offline fallback, and overlapping reads/writes. Server cache tests cover chunks, eviction, edits, and concurrent invalidation.

Tests block live services and use synthetic records. No production attendance, planner, or leaderboard data was changed. Physical iOS Safari and the account's live deployment remain separate rollout checks.
