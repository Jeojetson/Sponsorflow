# SponsorFlow 5.1 — shared identity and leaderboard recovery

The deployed leaderboard was returning `Games Results has different columns. Existing data was left unchanged.` on September 23, 2026. The previous backend required every column to match a fixed position and width. A legacy or partially upgraded schema, reordered columns, or extra officer notes could stop the entire leaderboard.

## Install the fix

1. In the **existing** Apps Script project, replace **Games.gs** with [games-backend/Games.gs](games-backend/Games.gs). Save.
2. Select **setupGames** in the function selector and run it once. It checks both Games tabs before changing anything, appends missing scoring headers, and keeps existing cells. Subsequent Games saves also perform this safe upgrade automatically.
3. Choose **Deploy → Manage deployments → Edit → New version → Deploy** on the current web app. Keep the existing URL and access settings. [Google’s deployment instructions](https://developers.google.com/apps-script/concepts/deployments#edit_a_versioned_deployment) explain why saving alone does not update the public app.
4. Merge this website update into GitHub Pages. Refresh Games and select **Sync scores** if any results are pending.

No new spreadsheet or manual cell edits are required. The existing Code.gs routing and Admin.html remain in place. Do not replace them with the historical files in the repository's apps-script folder. The live route was confirmed reachable; only Games.gs needs replacing for this repair.

If setup reports missing or duplicate identity/result headers, it stops before changing either tab and names the affected columns. That indicates an unrecognized schema rather than a known old version. Keep the data and inspect the reported headers before changing them.

## Member experience

- A required welcome prompt collects a name on first entry, prefilling an existing Games/planner name when available. The browser remembers the confirmed name across pages. Attendance, project attribution, and outreach fields use it; the name button edits it.
- Opening Games connects that name to a player automatically. Existing player codes are reused. A name alone does not authenticate someone or recover an account: use **Your player → Already play on another device?** and the private code to restore existing shared scores.
- Signup saves its recovery code before the network request. Retrying an interrupted signup reuses the same identity. If persistent browser storage is unavailable, registration pauses rather than creating an unrecoverable account.
- Failed score proofs remain on the device but no longer prevent other games from syncing. New results arriving during an upload or standings refresh are picked up. Network/setup outages stop repeated uploads, and standings can still load independently.
- Restoring a player reconciles local copies with the server's first daily results. It does not silently overwrite the server with a second attempt.
- Light-mode skip links, outreach step numbers, muted project counts, and attendance arrows have corrected contrast. The header keeps the full chapter name, name button, and theme control aligned on phones.

Scoring still awards up to 800 points for accuracy and 200 for time. Puzzle solutions are validated on the server; elapsed time and correction counts are browser-reported. This is a casual club competition. Historical version 1 scores and kart records are preserved separately from current timed standings.

## Validation

Tests use isolated Sheets fixtures and block all production writes. Coverage includes legacy/partial/reordered schemas, custom cells and formulas, duplicate-header refusal, interrupted signup/retry, rejected scores alongside valid scores, second-device restoration, six game flows, phone/desktop layouts, required name entry, theme persistence, task-field preservation, and attendance member/officer workflows. The contrast test checks rendered solid-background text in both themes; artwork and gradients also require visual review.

The fix must be deployed to the existing Apps Script web app before the live sheet error is resolved. Local tests do not establish that the account's deployed version has changed.
