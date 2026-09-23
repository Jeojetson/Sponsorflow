# SponsorFlow 5.4 — a simpler Reels experience

Reels now opens directly into **Discover**, a scrolling video viewer. **Club** contains only member-shared links. **Saved** and **Messages** remain separate tabs. The viewer shows one video, its creator/title, and three small actions. Search, filters, playback preferences, copying links, and external sharing live behind the options/details buttons.

On phones, Messages shows the inbox or one conversation. A back button returns to the inbox; a compact composer and reel attachment cards replace the stacked forms. Names, saves, drafts, messages, and the explicit non-private-inbox notice remain intact.

## Install

1. Replace **Reels.gs** in the current Apps Script project with the complete generated [Reels.gs](reels-backend/Reels.gs).
2. Run **setupReels** once. It adds **Reels Discovery**, preserves the four existing Reels sheets and all other club records, and installs four starter picks only in Discovery. Code.gs already contains the Reels routing from 5.3; no new routing lines are needed.
3. To enable fresh discovery, use **Services → + → YouTube Data API → v3 → Add** in Apps Script. Then run **enableReelsDiscovery** in the editor and authorize the owner account. It fetches a batch and installs one daily refresh trigger. Running it again does not create a duplicate trigger. If the script uses a standard Google Cloud project, also enable the YouTube Data API for that project. [Google's advanced service setup](https://developers.google.com/apps-script/guides/services/advanced#enable_advanced_services), [YouTube service](https://developers.google.com/apps-script/advanced/youtube).
4. Deploy a **New version** of the existing web app, keeping its URL and access settings. Publish the website update separately.

The copy-ready **Complete Scripts** delivery also includes the full Code.gs, Games.gs, and Performance.gs if replacing entire files is easier. Keep current Admin.html. Do not run Initial setup or older migrations.

## What continuous discovery does

- Continuous scroll is on by default. As the member approaches the end of the loaded page, the next 12 discovery videos load automatically. The viewer stays on the same video while the list grows. Club posts paginate independently. Switching tabs never mixes discovery into the Club feed.
- The initial four videos have links on their publishers' websites and had valid YouTube oEmbed responses when checked on September 23, 2026. This is a small starter selection, not a claim of an unlimited catalogue. Enable the YouTube service for fresh batches.
- The daily refresh searches for karting, go-kart racing, motorsport, and engineering Shorts. It uses public, embeddable, syndicated results with strict SafeSearch, then checks video duration (up to three minutes), public visibility, live status, and embedding permission. Karting receives priority in the mix. Search and duration filtering cannot guarantee that every result is a vertical YouTube Short. [Search parameters](https://developers.google.com/youtube/v3/docs/search/list).
- YouTube's supported embeds expose videos and playlists, not a person's native Shorts recommendation feed. Discover is SponsorFlow's shared selection. No member YouTube login, API key, or password is required. One officer enables the Apps Script service. [Embed options](https://developers.google.com/youtube/player_parameters).
- Public scrolling reads the prepared catalogue, so every swipe does not make another YouTube search. A refresh uses four searches and at most four video-detail calls. Failed searches keep the existing catalogue. API metadata expires from display after 28 days and is cleared by a subsequent successful refresh. Officer hidden flags and extra columns are preserved. Disable/remove the `refreshReelsDiscovery` trigger in Apps Script to stop scheduled refreshes.
- The feed ends honestly when the available catalogue is exhausted. It does not silently repeat videos or claim unlimited recommendations. Members can return to the first reel or refresh from Feed options.

## Playback and messaging

Only one YouTube iframe is active. Thumbnails load lazily. The first video requires a tap; subsequent visible videos can play muted while scrolling, and playback can advance after a video ends. This can be disabled in Feed options; reduced-motion settings default to manual playback. Leaving the video, opening a dialog, switching tabs, or hiding the page stops playback. Failed embeds have a More → Open on YouTube fallback. YouTube controls and branding remain unobscured. Touch gestures inside the YouTube iframe are controlled by YouTube; scroll beside the player or use keyboard arrows/desktop next buttons. [Player API](https://developers.google.com/youtube/iframe_api_reference).

Discover videos can be saved or attached to messages without posting them to Club. Existing links, club saves, and conversations continue to resolve. The inbox still uses names without authentication: anyone entering a name can read and send as that name. The notice is visible above Messages and in the recipient picker. Unread state, per-name drafts, and retry IDs remain supported.

## Verification

`npm run test:reels` covers discovery isolation, automatic pagination, saves and attachments across both feeds, setup preservation, duplicate trigger prevention, API filtering and failure retention, expired metadata, player visibility, send retries, identity switches, drafts, link escaping, and phone/desktop layout and contrast at 320, 390, 768, and 1440 pixels in both themes. Tests run against isolated Google/YouTube fixtures and never write production data. They do not claim a live deployment or real playback on every device.

Starter link sources (editorial titles in the catalogue):

- [TPS karting day](https://www.tps.com.pt/en/2025/07/11/karting-championship-lisboa-edition-2/)
- [Academy for Winners: Iannis](https://academyforwinners.com/iannis-printsios-conquista-academy-for-winners-a-soli-11-anni-dopo-il-kart-test-day/)
- [Academy for Winners: Gualtiero](https://academyforwinners.com/gualtiero-castaldo-inizia-in-okn-junior-con-academy-for-winners/)
- [Extra Kart Parts swap meet](https://extrakartparts.com/blog/2025-karting-swap-meet-in-northern-california/)
