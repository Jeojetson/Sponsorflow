# SponsorFlow 5.3 — Reels, Saved, and Messages

Reels embeds member-shared YouTube Shorts inside SponsorFlow. The same section includes synced saved reels and conversations where members can send text or attach a reel. The existing name prompt is used throughout; no additional account, video hosting, or YouTube API key is required for this link-sharing implementation.

## Install in the existing Apps Script project

1. Add a **Script** file named **Reels**. Paste the complete [reels-backend/Reels.gs](reels-backend/Reels.gs) into it and save. Do not replace Games.gs, Admin.html, or the current attendance/planner code.
2. At the beginning of the existing `doGet(e)` in **Code.gs**, immediately after the opening brace, insert:

   ```javascript
   const reelsResponse = asmeReelsGet_(e);
   if (reelsResponse) return reelsResponse;
   ```

3. At the beginning of the existing `doPost(e)`, immediately after its opening brace, insert:

   ```javascript
   const reelsResponse = asmeReelsPost_(e);
   if (reelsResponse) return reelsResponse;
   ```

   Keep all existing Games, Performance, attendance, calendar, and outreach routing below these lines. Add each pair once; do not create another `doGet` or `doPost`.
4. Run **setupReels** once. It creates **Reels Posts**, **Reels Saves**, **Reels Messages**, and **Reels Reads** in the existing Sheet. Rerunning it preserves existing records and extra columns. Existing incompatible headers are reported before setup edits any tables.
5. **Deploy → Manage deployments → Edit → New version → Deploy** on the existing web app. Keep its current URL and access settings. [Google's deployment instructions](https://developers.google.com/apps-script/concepts/deployments#edit_a_versioned_deployment).
6. Publish the website update. Open **Reels → Add a Short** and paste the first YouTube Shorts link. The feed begins with member submissions; it does not contain fabricated demo posts or automatically scrape YouTube.
7. Check two devices: save a reel, use the same name on another device, and find it under Saved. Send it to another name, switch to that name, and open Messages. Verify an existing game, attendance check-in page, calendar, and officer dashboard still load.

Do not rerun SponsorFlow Initial setup or replace the repository's historical Code.gs/Admin.html over the deployed versions. Only Reels.gs and the four routing lines are new backend requirements.

## Feed and playback

- **Karting first** mixes two karting submissions with one other submission when both are available. **Karting only** and **Newest** are also available. Categories are chosen by the person submitting a link, not inferred from YouTube.
- Members can add Shorts, standard YouTube watch links, and youtu.be links. Matching video IDs are deduplicated. A link's format does not prove the video is a Short or that its owner permits embedding.
- Search operates on loaded titles, captions, and submitters. Load more retrieves the next page of 24 posts. Refresh gets new submissions.
- One YouTube player is loaded on demand. Leaving the viewer, opening a dialog, switching tabs, or hiding the browser stops the player. Optional next-reel playback starts muted and only when more than half of the player is visible. Reduced-motion users retain manual playback.
- YouTube branding, controls, captions, and fullscreen remain available. Private, deleted, restricted, or non-embeddable videos show an **Open on YouTube** fallback. YouTube may require sign-in for some videos; SponsorFlow cannot remove those restrictions. [Player reference](https://developers.google.com/youtube/iframe_api_reference), [embedding requirements](https://developers.google.com/youtube/terms/required-minimum-functionality).
- Permanent reel links, clipboard copy, native device sharing where supported, keyboard navigation, and swipes beside the player are supported. Touches inside the cross-origin YouTube player belong to YouTube.
- A useful source of karting Shorts to submit is Rotax's official **Deep Dive with Darrell** series, linked from its [guide page](https://www.rotax-racing.com/guides). This is an external source recommendation, not an automatically imported feed.

## Saved reels and messages

**These inboxes are not private.** This release intentionally follows the requested name-only model. Anyone entering a person's name can open that person's saved list and inbox and send messages as them. The interface says this above Messages and when choosing a recipient. There is no password, authentication, verified sender, or encryption promise.

- Matching ignores capitalization, repeated/leading/trailing spaces, and Unicode normalization differences. Different names select different inboxes and saved lists.
- Send a text message, a reel, or both. Choose a recipient by their exact name; suggestions come from current submissions and conversations. This is a SponsorFlow inbox, not a YouTube message.
- Unread counts track incoming messages since the conversation was opened. Opening older history does not move the read position backward. This is an unread indicator, not a delivery/read-receipt guarantee shown to senders.
- The newest 50 messages load first, with an Earlier messages button. While Messages is visible, it refreshes about every 30 seconds; hidden tabs do not poll. Refresh is also available manually.
- Drafts and uncertain send IDs are saved on the browser under the current name and recipient. Retrying an unchanged send after a timeout is idempotent. Name changes clear the current view immediately, and in-flight results stay attached to their original names.
- Saves and delivered messages live in the Google Sheet and work across devices. Drafts stay on their browser. Blocked browser storage uses an in-memory fallback for the session.

## Officer maintenance and limits

To remove a reel, set its **hidden** cell to `true` in **Reels Posts**. It disappears from the refreshed feed and saved lists; its old message attachment shows that it was removed. Do not delete its row: keeping the ID prevents the same URL being reposted. Change category/title/caption in that Sheet for curation. All message text is visible to spreadsheet editors.

Basic limits keep a small club's sheet manageable: 10 submitted reels per name / 100 total per rolling day; 60 sent messages per name / 1,000 total per rolling hour; 500 active saved reels per name. These limits are not identity verification: changing names can bypass a per-name limit. This is intended for casual club use, not a secure or high-volume messaging service.

## Verification

`npm run test:reels` uses an isolated Apps Script fixture and simulated YouTube player events. It exercises supported/malformed URLs, formula and HTML escaping, duplicate posts and sends, same-name cross-device saves, inbox switching, old history/read positions, removed reels, feed pagination, and preservation of all existing Sheets and legacy routes. Browser tests cover Reels/Saved/Messages, drafts, sending a reel, lost-response retry, deep links, player failure handling, layout, and contrast at 320, 390, 768, and 1440 pixels in both themes. These tests block production writes.

Live YouTube playback still depends on Google, network conditions, browser playback rules, and each video's settings. Fixture results do not claim that every real video embeds or that the live Apps Script deployment has been updated.
