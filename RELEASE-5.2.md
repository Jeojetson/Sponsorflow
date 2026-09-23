# SponsorFlow 5.2 — names, mobile standings, and player stats

Games now reconnects people by name, replaces cramped phone leaderboard columns with labeled cards, and adds player and club statistics. The six puzzles and their scoring rules are unchanged.

## Install

1. Replace **Games.gs** in the **existing Apps Script project** with the complete [games-backend/Games.gs](games-backend/Games.gs) file. Save.
2. Run **setupGames** once. It preserves existing rows and supports the earlier, reordered, or partially upgraded Games columns.
3. Update the **existing web app deployment** to a **new version** through **Deploy → Manage deployments → Edit → New version → Deploy**, keeping its current URL and access settings. Saving a script alone does not update a versioned deployment. [Google's deployment instructions](https://developers.google.com/apps-script/concepts/deployments#edit_a_versioned_deployment).
4. Merge the website pull request into GitHub Pages and reload Games. Use **Sync scores** for any pending results.

Only Games.gs needs replacing for this release. Keep the current Code.gs, Admin.html, and optional Performance.gs. No new spreadsheet, replacement API URL, manual formulas, or Initial setup run is needed. The historical files in the repository's apps-script directory are not deployment replacements.

Deploy the backend before the website. A cached 5.1 page can still submit using its existing identity; new pages send names only. If the website arrives first, results remain on the device and the page explains that the new Games deployment is needed.

## Identity and preservation

- Enter the same name on any device to use the same player. Matching ignores capitalization and repeated/leading/trailing spaces and normalizes Unicode accents. No password, player code, or restore step is required.
- The existing site's welcome prompt and name button control the active player. A different name selects a different player; it does not rename or transfer the previous player's scores. Local unfinished puzzles and queued results stay with their original names, including while a score request is in flight.
- Existing names reuse their original player IDs. If historical rows contain multiple IDs for the same normalized name, reads combine them without rewriting the Sheet. For a duplicate daily game, the first accepted result counts.
- Historical codeHash cells stay in place for compatibility, but the new interface neither creates nor sends player codes. Name-only access is intentional.
- A returning player's server-accepted daily results replace uncertain local copies. Practice stays unranked; unfinished boards stay on their device. Pending scores can sync for 35 days, while the spreadsheet retains all historical results.

## Metrics

All totals use synced version-2 daily results from the current timed scoring season. Practice, old 100-point scores, and kart results are excluded.

- **Day wins:** most combined points across the six games on a completed Indianapolis calendar day. Positive-score ties share a win. Zero-point-only days award none. Today's lead is provisional; late syncs can change past winners.
- **Time to solve:** average, median, and fastest time use solved attempts with a recorded timer. The timer starts when a puzzle opens and includes breaks. Per-game breakdowns help compare like puzzles.
- **Accuracy:** mean accuracy of ranked attempts, including failed rounds at 0%. Perfect solves have 100% accuracy.
- **Streaks:** consecutive calendar days with at least one ranked attempt. The current streak may end today or yesterday; best streak covers the full timed season.
- **Player charts:** 30-day points, average solve-time trends, activity grid, per-game results, best day, and solve rate. Every time-series chart has an expandable table of exact daily values. Anyone can explore another player's stats.
- **Club charts:** daily active players, game popularity and median solve times, all-time player/attempt/solve counts, day-win leaders, and recent daily winners.

Statistics read separately from standings and gameplay. They cache shared aggregates for 60 seconds, invalidate after scores, and use bounded cache chunks for larger player bases. Only the selected player's chart data is sent to the browser. This respects [Apps Script CacheService's per-value size limit](https://developers.google.com/apps-script/reference/cache/cache).

## Validation

Automated checks use isolated Google API fixtures and block production writes. They cover all six games, first-attempt scoring, second-device name recovery, name switching during an upload, legacy IDs and duplicate-name aliases, cache invalidation and eviction, shared daily wins, timing/median calculations, streaks, failed/empty/old-season results, and preservation of attendance/planner/outreach routes and Sheet data.

Populated standings and dashboards are checked at 320, 390, 768, and 1440 pixels in both themes, including long names, overlapping-cell detection, horizontal overflow, and text contrast. The workspace regression suite checks existing project/calendar/attendance behavior and name entry.

The live Apps Script deployment still requires the installation steps above; local fixture tests do not deploy it.
