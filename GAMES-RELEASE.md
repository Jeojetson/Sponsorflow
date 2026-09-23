# ASME Games — timed scoring

Six daily puzzles share club rankings in the existing SponsorFlow spreadsheet: Word Sprint, Common Ground, Crown Grid, Equal Split, Waypoint, and Number Garage. Kart Sprint is removed from the hub and current standings; its old records remain intact.

## Scoring

A solved puzzle earns up to **1,000 points**: 800 for accuracy and 200 for speed. Failed Word Sprint and Common Ground rounds earn zero. Every member gets the same daily puzzles, using the Indianapolis date, and the first daily result is retained. Practice is unranked.

- Accuracy starts at 100% and drops by 10 percentage points per incorrect submitted word/group or correction, to a minimum of 10% for a solved puzzle.
- In Crown Grid and Equal Split, failed checks, Undo, and Reset count as corrections. In Waypoint, backtracking, failed checks, Undo, and Reset count. In Number Garage, Undo, Reset, and failed final checks count. Draft cell/number selections are not graded guesses.
- Accuracy points equal accuracy × 8. Speed points equal `round(200 × exp(-(elapsedMs - 1000) / (targetSeconds × 1000)))`, with a one-second minimum elapsed time. Target seconds are 120 for Word Sprint, Waypoint, and Number Garage; 180 for Common Ground, Crown Grid, and Equal Split.
- The timer runs from opening to completion, including time away, reloads, and resets. The visible timer and result breakdown explain the score.
- Today's combined maximum is 6,000. Today, rolling seven-day, and current-month standings support individual-game filters. Equal totals share a rank.

The server validates puzzle solutions and calculates points. Elapsed time and correction counts originate in the browser; player names are self-selected and puzzle code is public. These are casual club rankings, not verified membership, attendance credit, or cheat-resistant competition.

## Sync and existing data

Results are first saved on the device and explicitly marked pending until the server confirms them. **Sync scores** retries pending results and refreshes standings. The same normalized name reconnects to existing scores on another device without a player code; unfinished boards stay on their original device. Offline timed results can sync for 35 days.

Scoring version 2 separates these scores from the previous 100-point format. Historical version-1 rows and kart results remain in the spreadsheet. Old local runs and pending records are retained separately. Version 5.2 reconnects players by normalized name without codes; existing IDs and scores are preserved. Puzzle generation version 1 stays unchanged.

Follow [RELEASE-5.2.md](RELEASE-5.2.md) to replace Games.gs, run `setupGames` once, and update the existing web app deployment. This uses the same spreadsheet and API URL. Current Code.gs routing hooks and Admin.html remain in place. An older backend produces a clear update-needed message and keeps new scores on the device.

## Development and verification

`node games-backend/build.cjs` builds Games.gs from the shared core and server source. Serve the repository locally and run `npm run test:games`. Tests use a synthetic in-memory backend and block live requests. They cover 120 daily sets, unique logic solutions, invalid proofs, time/accuracy math, score versions, safe schema upgrades, idempotent submissions, names/identity restoration, and retained attendance/planner routing. Browser checks play all six games with keyboard/touch input, restore another device, test practice, resume timers, count corrections, and verify short-phone controls in both themes.

Games use original daily answers, categories, and visuals. Accepted guesses use a public-domain word list; attribution is in `assets/games/WORDS-LICENSE.txt`.
