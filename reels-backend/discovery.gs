/** Separate discovery catalogue. Public reads never call the YouTube Data API. */
const REELS_STARTER_ = [
  ['Jb7ZMp3DZGY', 'A team day at Kiro Karting', 'TPS', 'https://www.tps.com.pt/en/2025/07/11/karting-championship-lisboa-edition-2/'],
  ['RdxY-sNHuC0', 'Meet a young kart racer: Iannis Printsios', 'Academy for Winners', 'https://academyforwinners.com/iannis-printsios-conquista-academy-for-winners-a-soli-11-anni-dopo-il-kart-test-day/'],
  ['WxbGRtaJ3Pg', 'First test in an OKN Junior kart', 'Academy for Winners', 'https://academyforwinners.com/gualtiero-castaldo-inizia-in-okn-junior-con-academy-for-winners/'],
  ['G7BG_LF87p4', 'Inside a karting swap meet', 'Extra Kart Parts', 'https://extrakartparts.com/blog/2025-karting-swap-meet-in-northern-california/']
];
function seedReelsDiscovery_() {
  const known = new Set(reelsRows_('Discovery').map(r => r.id));
  REELS_STARTER_.forEach((v, i) => {
    if (!known.has('REEL-' + v[0])) reelsWrite_('Discovery', { id: 'REEL-' + v[0], videoId: v[0], title: v[1], author: v[2], category: 'karting', caption: '', createdAt: new Date(Date.UTC(2026, 8, 23, 0, 0, 4-i)).toISOString(), hidden: 'false', fetchedAt: 'curated' });
  });
}
function reelsDiscoveryRows_() {
  // Old deployments can keep using club saves/messages until setupReels is rerun.
  return reelsBook_().getSheetByName('Reels Discovery') ? reelsRows_('Discovery') : [];
}
function reelsLookup_() {
  // An officer-hidden club post also suppresses its discovery counterpart.
  return new Map([...reelsDiscoveryRows_(), ...reelsRows_('Posts')].map(r => [r.id, r]));
}
function reelsDiscover_(p) {
  reelsSheet_('Discovery');
  const hidden = new Set(reelsRows_('Posts').filter(r => r.hidden === 'true').map(r => r.id));
  const all = reelsDiscoveryRows_().filter(r => reelsVisible_(r) && !hidden.has(r.id));
  const rows = SFReels.kartingFirst(all.sort(SFReels.compare));
  const after = String(p.after || ''), i = after ? rows.findIndex(r => r.id === after) : -1;
  if (after && i < 0) throw new Error('Discover has new videos. Refresh to start the latest feed.');
  const items = rows.slice(i + 1, i + 13);
  const latest = all.filter(r => r.fetchedAt !== 'curated').map(r => r.fetchedAt).sort().pop() || '';
  return { items: items.map(reelsPublic_), next: rows.length > i + 13 ? items[items.length - 1].id : '', total: rows.length, updatedAt: latest, live: Boolean(latest) };
}
function reelsDurationSeconds_(value) {
  const m = String(value || '').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  return m ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0) : 0;
}
/** Run in the editor after adding Services > YouTube Data API v3. */
function refreshReelsDiscovery() {
  if (typeof YouTube === 'undefined') throw new Error('In Apps Script, add Services > YouTube Data API v3, then run enableReelsDiscovery. Members do not need a YouTube account.');
  // Bounded, scheduled searches keep scrolling fast and independent of API quota.
  const categories = new Map();
  ['karting #shorts', 'go kart racing #shorts', 'motorsport #shorts', 'engineering #shorts'].forEach((q, i) => {
    const result = YouTube.Search.list('id', { q, type: 'video', maxResults: 50, videoDuration: 'short', videoEmbeddable: 'true', videoSyndicated: 'true', safeSearch: 'strict', relevanceLanguage: 'en', order: new Date().getUTCDate() % 2 ? 'relevance' : 'date' });
    (result.items || []).forEach(r => { const id = r.id && r.id.videoId; if (/^[\w-]{11}$/.test(id) && !categories.has(id)) categories.set(id, i < 2 ? 'karting' : 'community'); });
  });
  const ids = Array.from(categories.keys()), found = [];
  for (let offset = 0; offset < ids.length; offset += 50) {
    const result = YouTube.Videos.list('snippet,contentDetails,status', { id: ids.slice(offset, offset+50).join(',') });
    (result.items || []).forEach(v => {
      const seconds = reelsDurationSeconds_(v.contentDetails && v.contentDetails.duration);
      if (seconds <= 0 || seconds > 180 || !v.status || v.status.embeddable !== true || v.status.privacyStatus !== 'public' || v.snippet.liveBroadcastContent !== 'none') return;
      found.push({ id: 'REEL-' + v.id, videoId: v.id, title: String(v.snippet.title || 'YouTube Short').slice(0,100), caption: '', author: String(v.snippet.channelTitle || 'YouTube').slice(0,100), category: categories.get(v.id), createdAt: v.snippet.publishedAt || new Date().toISOString(), fetchedAt: new Date().toISOString() });
    });
  }
  if (!found.length) throw new Error('YouTube returned no playable short videos. The existing catalogue was kept. Try refreshReelsDiscovery later.');
  return reelsLock_(function () {
    const rows = reelsRows_('Discovery'), byId = new Map(rows.map(r => [r.id,r]));
    found.forEach(item => { const old = byId.get(item.id); reelsWrite_('Discovery', Object.assign({}, item, { hidden: old ? old.hidden : 'false' }), old); });
    // Expire API metadata after 28 days. Keep IDs, officer hide choices and extra columns.
    rows.filter(r => r.fetchedAt !== 'curated' && !found.some(v => v.id === r.id) && Date.parse(r.fetchedAt) <= Date.now() - 28*86400000).forEach(r => reelsWrite_('Discovery', { videoId: '', title: '', caption: '', author: '', category: '', createdAt: '', fetchedAt: '' }, r));
    return { refreshed: found.length };
  });
}
function enableReelsDiscovery() {
  setupReels();
  const result = refreshReelsDiscovery();
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'refreshReelsDiscovery')) ScriptApp.newTrigger('refreshReelsDiscovery').timeBased().everyDays(1).atHour(5).create();
  return result;
}
