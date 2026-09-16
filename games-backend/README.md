# Open the shared Games leaderboard

Games is a separate service. **Do not paste this file into the existing SponsorFlow/attendance Apps Script project.** Nothing here changes the current Google Sheet, API URL, or officer dashboard.

## One-time setup (about five minutes)

1. Open [Google Apps Script](https://script.google.com/home) in the Google account that should own the club leaderboard. Create a **New project** named **ASME Games**.
2. Replace that new project's `Code.gs` with the complete contents of this folder's generated **Code.gs**. It includes the game rules and service in one file; no extra libraries are needed.
3. Save, select **setupGames**, and click **Run**. Approve access for this new script. It creates a separate **ASME Games Leaderboard** spreadsheet with Players and Results tabs. Running setup again reuses it. There are no manual columns or formulas to add.
4. Choose **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Deploy and copy the URL ending in `/exec`. If your university's account policy does not permit public web apps, use an allowed club-managed account or ask its administrator; do not replace the existing SponsorFlow deployment.
5. Put that URL into `API_URL` in `assets/games/config.js`, then publish the games branch to GitHub Pages. Leave `assets/config.js` unchanged.
6. Open Games on two devices. Join the leaderboard on one, finish a game, and confirm the score appears on the other. Use **Your player → Copy player code** and restore it on the second device to verify that both devices share one identity. Keep the code private.

The allowed website origin is `https://jeojetson.github.io`. If the website moves, update `GAMES.ORIGIN` in `service.gs`, rebuild, and update the deployment. The URL cannot distinguish repositories under that same origin; this is a friendly public club leaderboard, not a verified membership or prize system.

[Google's web-app deployment guide](https://developers.google.com/apps-script/guides/web) explains execute-as and access settings. The service uses [script locks](https://developers.google.com/apps-script/reference/lock) to keep simultaneous result writes consistent.

## What gets stored

- Players: a derived ID, a hash of the private player code, display name, and timestamps. The code itself is stored only in that player's browser.
- Results: one row per player, date, and game; points, win status, a short result summary, proof hash, and timestamp. No attendance or project records are read or changed.
- Display names and rankings are public on the games page. Codes are never returned in standings.
- The server calculates the score from the submitted puzzle solution or kart input replay. It does not trust a submitted points total. Puzzles retain their first result; racing retains the best result. Retrying a submission does not create another row.
- Everyone uses the Indianapolis calendar date. Today, last seven days, and current-month filters share the same records. Ties share a rank.
- A player code restores identity and completed results on another device. Unfinished puzzle boards stay on the device where they were started.
- Results that were completed offline can sync for 35 days. The service keeps historical rows. Browser progress retains 35 days of runs.

Players can inspect the puzzle code, and names are self-selected. Validation prevents malformed scores and accidental duplication; it is not a guarantee against a determined cheater. Do not use these standings for prizes or attendance credit.

## Before the service is deployed

Every game is playable and progress saves locally. The standings clearly say they are not open yet; the app does not invent members or present device-only rankings as shared rankings. Results queue on the device. Once the service is configured, the member joins and syncs their saved results.

## Development

`Code.gs` is generated from `assets/games/core.js` and `games-backend/service.gs`:

```sh
node games-backend/build.cjs
node tests/games-core.cjs
```

Always rebuild after changing either source. Deploy a new version of **ASME Games**, keeping its `/exec` URL. Version 1 puzzle rules and seeds must remain stable after launch; introduce a new challenge version for any future rule changes that affect saved results.

The test service is an in-memory emulator of the Google APIs. Automated checks cover its rules and data contracts; the first deployment still needs the two-device check above to verify Google's permissions and iframe/JSONP behavior in the real account.
