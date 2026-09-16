# Add Games to your existing SponsorFlow Google Sheet

**Already installed Games?** Replace only Games.gs, run `setupGames` once to append the timed-scoring columns, and deploy a new version of the existing web app. Keep your existing Code.gs routing hooks and Admin.html. See [RELEASE-5.0.md](../RELEASE-5.0.md) for the full update.

Use the **same Google Sheet, Apps Script project, and web app URL** that already run SponsorFlow. The current Code.gs you supplied includes the 2.1 attendance cache and officer attendance analytics. Keep that file and your current Admin.html; the repository's historical `apps-script/Code.gs` and `apps-script/Admin.html` are not replacements for them.

## Install in the existing project

1. From your existing SponsorFlow spreadsheet, open **Extensions → Apps Script**.
2. Add a **Script** file named **Games**. Paste the complete contents of [Games.gs](Games.gs) into it and save. This file contains the game rules and leaderboard service; it has no duplicate `doGet` or `doPost` functions.
3. In your current **Code.gs**, find `function doGet(e) {`. Insert these two lines immediately after its opening brace, **before** `const p = …` and the existing JSONP routing:

   ```javascript
   const gamesResponse = asmeGamesGet_(e);
   if (gamesResponse) return gamesResponse;
   ```

   The beginning should now read:

   ```javascript
   function doGet(e) {
     const gamesResponse = asmeGamesGet_(e);
     if (gamesResponse) return gamesResponse;
     const p = (e && e.parameter) || {};
     // Keep the rest of your existing function here, unchanged.
   ```

4. Find `function doPost(e) {`. Insert the corresponding two lines immediately after its opening brace:

   ```javascript
   const gamesResponse = asmeGamesPost_(e);
   if (gamesResponse) return gamesResponse;
   ```

   Keep all existing actions below them, including attendance check-in and meeting management. **Admin.html needs no edits.**
5. Save, select **setupGames** in the function menu, and click **Run** once. It adds **Games Players** and **Games Results** tabs inside the existing spreadsheet. There are no columns or formulas to enter manually. Running it again preserves the existing rows. Do not rerun SponsorFlow's Initial setup or any historical upgrade routine for this change.
6. Choose **Deploy → Manage deployments**, select the existing SponsorFlow web app, click **Edit**, choose **New version**, and **Deploy**. Keep its current execute-as and access settings. Updating that deployment preserves its `/exec` URL. See [Google's deployment instructions](https://developers.google.com/apps-script/concepts/deployments#edit_a_versioned_deployment).
7. Publish the Games website update. Games automatically reads the same `API_URL` from `assets/config.js`; no second URL is needed. Do not paste a spreadsheet URL into either config file.
8. Verify on two devices: join the leaderboard on one, finish a game, and confirm its score appears on the other. **Your player → Copy player code** lets you restore the same identity on a second device. Also open attendance, the officer dashboard, and a calendar subscription to confirm the existing routes still work.

Only the four routing lines above change Code.gs. Attendance passwords, officer sessions, planner records, calendars, comments, sponsor data, and the admin password stay in their existing code and tables. Games reads the existing `SPREADSHEET_ID` and `FRONTEND_ORIGIN` settings and uses the existing script lock; it does not change those settings or run SponsorFlow schema migrations.

The previous nine-column Games Results schema is upgraded by appending six columns. For other unrecognized columns in `Games Players` or `Games Results`, setup stops before adding or editing either tab. It never deletes tabs or creates another spreadsheet. Correctly initialized Games tabs keep their rows when setup is rerun.

## What gets stored

- **Games Players**: a derived ID, a hash of the private player code, display name, and timestamps. The raw code stays in that player's browser.
- **Games Results**: one row per player, date, game, and scoring version; points, win status, a short summary, proof hash, timestamp, elapsed time, corrections, and accuracy/speed breakdown. The game service does not read attendance or project rows.
- Display names and rankings are public on the Games page. Player codes and hashes are never returned in standings.
- The server validates puzzle solutions and calculates time/accuracy scores. Browser-reported time and corrections are intended for casual competition. Puzzles retain their first result. Historical kart and 100-point scores are kept separately as version 1. Retrying a submission does not create another row.
- Everyone uses the Indianapolis calendar date. Today, last seven days, and current-month filters share the same records. Ties share a rank.
- A player code restores identity and completed results on another device. Unfinished boards stay on their original device. Offline results can sync for 35 days; the spreadsheet retains historical scores.

Names are self-selected, and puzzle code is public. These are casual club standings, without verified membership or attendance credit.

## Before the backend update

All games remain playable with local progress. If the website reaches your older deployment, it says shared rankings are not open yet and keeps results on the device. Once the backend is updated, members can join and sync. A saved local result is not presented as a successfully synced club score.

## Development

[Games.gs](Games.gs) is generated from `assets/games/core.js` and `games-backend/service.gs`:

```sh
node games-backend/build.cjs
node tests/games-core.cjs
```

Rebuild after changing either source, replace only Games.gs in the existing project, and deploy a new version of the existing web app. Version 1 puzzle rules and seeds must remain stable after launch; introduce a new challenge version for future changes that affect saved results.

Tests use an in-memory Google API fixture. They check all game rules, setup preservation, routing fallthrough, and browser transport. They do not modify your live Google Sheet. The first real deployment still needs the two-device check to verify Google's permissions and response behavior in your account.
