# Reels extension

Paste the complete **Reels.gs** into a new Script file in the existing SponsorFlow project. Install its two GET and two POST routing lines, run `setupReels`, and deploy a new version of the existing web app. Follow [RELEASE-5.3.md](../RELEASE-5.3.md) for exact steps, identity behavior, limits, and officer curation.

`Reels.gs` is generated from `assets/reels/core.js` and `reels-backend/service.gs`. After editing either source, run `npm run build:reels` and `npm run test:reels`. The generated file has no duplicate `doGet`/`doPost` and only owns the four Reels sheets. It uses the existing `SPREADSHEET_ID`, `FRONTEND_ORIGIN`, origin validator, and script lock.

Messages and saved lists intentionally use unverified names, as requested. Anyone choosing the same name can read and send as that name. No API key, password, or hosting account is needed for sharing existing YouTube links; this does not upload video files to YouTube.
