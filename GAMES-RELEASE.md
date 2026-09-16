# ASME Games

Seven original games, daily challenges shared by the club, and a separate Google-hosted leaderboard service:

| Game | Play | Daily points |
| --- | --- | --- |
| Word Sprint | Five-letter word, six guesses | 100 down to 50 for a win |
| Common Ground | Four groups of four related words | 100 minus 15 per mistake; four mistakes end the round |
| Crown Grid | One crown in every row, column, and region; no touching | 100 when solved |
| Equal Split | Balanced sun/moon grid; no triples or duplicate lines | 100 when solved |
| Waypoint | Visit all 25 squares, following checkpoints in order | 100 when solved |
| Number Garage | Combine four numbers into a target | 100 when solved |
| Kart Sprint | 45-second, three-lane kart challenge | Up to 100; best daily run counts |

Daily puzzles reset at midnight in Indianapolis. Practice rounds are unranked. Games use original daily answers, category sets, and visuals, with no copied NYT/LinkedIn puzzle feeds, logos, or assets. Accepted guesses use a public-domain English word list; its source and license are included in `assets/games/WORDS-LICENSE.txt`.

Member navigation includes Games. On phones, the six-tab bar retains Home, Outreach, Projects, Calendar, Attendance, and Games; Admin remains available in the header and footer. Opening a game gives it a focused screen and a visible All games return button.

Progress is saved per game and date. Keyboard, touch, and on-screen controls are supported; game colors adapt to the existing light/dark themes. Symbols, region letters, clue markers, and text labels provide alternatives to color. Kart racing pauses on tab changes and supports reduced-motion lane markings.

## Shared leaderboard activation

The new Google service must be deployed once and its URL added to `assets/games/config.js`. Follow [games-backend/README.md](games-backend/README.md). The generated `games-backend/Code.gs` is ready to paste into a **new** Google Apps Script project. It creates its own spreadsheet. Existing attendance, outreach, planning, calendar, and officer services are unchanged.

Until activated, every game works with local progress and clearly labels shared standings as unavailable. Do not describe the shared leaderboard as live until it has been deployed and verified from two devices.

## Validation

- Shared core tests generate 120 daily sets, validate their solutions, verify uniqueness for Crown Grid and Equal Split, and reject invalid results.
- Server contract tests cover player restore, name collisions, renaming, idempotent scores, better kart runs, date/version bounds, callback validation, and origin checks.
- Browser tests use a local in-memory version of the new service, with external traffic blocked. They cover all seven games, touch/keyboard input, score submission, second-device restoration, saved progress, practice, and kart pause/retry.
- Layout coverage: the hub and all seven play screens at 1440, 900, 390, and 320 pixels in both themes, plus 667-pixel-tall phones with explicit keyboard/steering visibility checks. Chrome was used for desktop and touch emulation; a physical iPhone/Safari check is still recommended before launch.
- Existing workspace regression tests continue to cover attendance, project, and calendar workflows.

Serve the repository, then run `npm run test:games`. No real attendance, project, or leaderboard records are touched by tests.
