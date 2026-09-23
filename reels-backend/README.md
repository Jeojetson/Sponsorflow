# Reels extension

Replace the complete **Reels.gs** and run `setupReels`. Existing Code.gs routing from 5.3 remains valid. This update adds a fifth Reels sheet, **Reels Discovery**, for a scrolling feed separate from member posts. Follow [RELEASE-5.4.md](../RELEASE-5.4.md) to enable the YouTube advanced service and daily discovery refresh. Four publisher-linked starter picks work without that service.

`Reels.gs` is generated from `assets/reels/core.js`, `reels-backend/service.gs`, and `reels-backend/discovery.gs`. After editing them, run `npm run build:reels` and `npm run test:reels`. Only one copy of the generated file belongs in Apps Script; do not also paste the source pieces.

The five Reels sheets are separate from Games, attendance, planning, calendars, and outreach. Inboxes and saved lists intentionally use unverified names. Anyone choosing the same name can read and send as that name.
