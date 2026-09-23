/** Reels and name-only messages for SponsorFlow. No new accounts or API keys. */
const SF_REELS = Object.freeze({
  Posts: ['id', 'videoId', 'title', 'caption', 'category', 'author', 'authorKey', 'createdAt', 'hidden'],
  Saves: ['id', 'nameKey', 'reelId', 'createdAt', 'active'],
  Messages: ['id', 'fromName', 'fromKey', 'toName', 'toKey', 'body', 'reelId', 'createdAt'],
  Reads: ['id', 'nameKey', 'peerKey', 'through']
});
function reelsBook_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SponsorFlow spreadsheet is not configured.');
  return SpreadsheetApp.openById(id);
}
function reelsHeaders_(sheet, type) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  if (SF_REELS[type].some(h => headers.filter(v => v === h).length !== 1)) throw new Error('Reels ' + type + ' has missing or duplicate columns. Ask an officer to check the header row.');
  return headers;
}
function setupReels() {
  return reelsLock_(function () {
    const book = reelsBook_();
    // Check every existing table before creating anything. Extra columns stay intact.
    Object.keys(SF_REELS).forEach(type => {
      const sheet = book.getSheetByName('Reels ' + type);
      if (sheet && sheet.getLastRow()) reelsHeaders_(sheet, type);
    });
    Object.keys(SF_REELS).forEach(type => {
      let sheet = book.getSheetByName('Reels ' + type);
      if (!sheet) sheet = book.insertSheet('Reels ' + type);
      if (!sheet.getLastRow()) {
        sheet.getRange(1, 1, sheet.getMaxRows(), SF_REELS[type].length).setNumberFormat('@');
        sheet.appendRow(SF_REELS[type]); sheet.setFrozenRows(1);
      }
    });
    return book.getUrl();
  });
}
function reelsSheet_(type) {
  const sheet = reelsBook_().getSheetByName('Reels ' + type);
  if (!sheet || !sheet.getLastRow()) throw new Error('Reels needs setup. Ask an officer to install Reels.gs, run setupReels, and update the web app deployment.');
  return sheet;
}
function reelsDecode_(v) {
  if (v instanceof Date) return v.toISOString();
  return String(v == null ? '' : v).replace(/^'(?=[=+@-])/, '');
}
function reelsEncode_(v) { const s = String(v == null ? '' : v); return /^[=+@-]/.test(s) ? "'" + s : s; }
function reelsRows_(type) {
  const sheet = reelsSheet_(type), headers = reelsHeaders_(sheet, type);
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues().map((row, i) => {
    const out = { _row: i + 2 };
    headers.forEach((h, j) => { if (SF_REELS[type].includes(h)) out[h] = reelsDecode_(row[j]); });
    return out;
  }).filter(r => r.id);
}
function reelsWrite_(type, value, old) {
  const sheet = reelsSheet_(type), headers = reelsHeaders_(sheet, type);
  if (!old) { sheet.appendRow(headers.map(h => reelsEncode_(value[h]))); return; }
  headers.forEach((h, i) => { if (Object.prototype.hasOwnProperty.call(value, h)) sheet.getRange(old._row, i + 1, 1, 1).setValues([[reelsEncode_(value[h])]]); });
}
function reelsLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Reels is busy. Please try again.');
  try { return fn(); } finally { lock.releaseLock(); }
}
function reelsHash_(value) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value).map(b => (b + 256).toString(16).slice(-2)).join(''); }
function reelsPublic_(row) {
  return { id: row.id, videoId: row.videoId, title: row.title, caption: row.caption, category: row.category, author: row.author, createdAt: row.createdAt };
}
function reelsVisible_(row) { return /^[\w-]{11}$/.test(row.videoId) && row.id === 'REEL-' + row.videoId && String(row.hidden).toLowerCase() !== 'true'; }
function reelsFeed_(p) {
  let rows = reelsRows_('Posts').filter(reelsVisible_).sort(SFReels.compare);
  if (p.id) rows = rows.filter(r => r.id === String(p.id));
  else if (p.filter === 'karting') rows = rows.filter(r => r.category === 'karting');
  else if (p.filter !== 'newest') rows = SFReels.kartingFirst(rows);
  // Each page follows an existing ID; additions at the top don't duplicate pages.
  const after = String(p.after || '');
  const index = after ? rows.findIndex(r => r.id === after) : -1;
  if (after && index < 0) throw new Error('The feed changed. Refresh to see the latest reels.');
  const page = rows.slice(index + 1, index + 25);
  return { items: page.map(reelsPublic_), next: rows.length > index + 25 ? page[page.length - 1].id : '', total: rows.length };
}
function reelsSubmit_(p) {
  const author = SFReels.name(p.name), authorKey = SFReels.nameKey(author), videoId = SFReels.videoId(p.url);
  const id = 'REEL-' + videoId, rows = reelsRows_('Posts'), old = rows.find(r => r.id === id);
  if (old) {
    if (!reelsVisible_(old)) throw new Error('This reel has been removed from the feed.');
    return { item: reelsPublic_(old), duplicate: true };
  }
  const now = new Date().toISOString(), cutoff = new Date(Date.now() - 86400000).toISOString();
  const recent = rows.filter(r => r.createdAt > cutoff);
  if (recent.filter(r => r.authorKey === authorKey).length >= 10 || recent.length >= 100) throw new Error('The daily sharing limit has been reached. Try again tomorrow.');
  const record = { id, videoId, title: SFReels.text(p.title, 100, 'Title', 2), caption: SFReels.text(p.caption, 500, 'Caption'), category: p.category === 'karting' ? 'karting' : 'community', author, authorKey, createdAt: now, hidden: 'false' };
  reelsWrite_('Posts', record);
  return { item: reelsPublic_(record), duplicate: false };
}
function reelsSaved_(p) {
  const key = SFReels.nameKey(p.name), saves = reelsRows_('Saves').filter(r => r.nameKey === key && r.active === 'true').sort(SFReels.compare);
  const posts = new Map(reelsRows_('Posts').filter(reelsVisible_).map(r => [r.id, r]));
  return { items: saves.filter(s => posts.has(s.reelId)).map(s => reelsPublic_(posts.get(s.reelId))) };
}
function reelsSave_(p) {
  const key = SFReels.nameKey(p.name), reelId = String(p.reelId || ''), active = String(p.active) === 'true';
  if (active && !reelsRows_('Posts').some(r => r.id === reelId && reelsVisible_(r))) throw new Error('That reel is no longer available.');
  const id = reelsHash_(key + '|' + reelId), rows = reelsRows_('Saves'), old = rows.find(r => r.id === id);
  if (active && (!old || old.active !== 'true') && rows.filter(r => r.nameKey === key && r.active === 'true').length >= 500) throw new Error('You have saved 500 reels. Unsave one before adding another.');
  if (!active && !old) return { reelId, active: false };
  reelsWrite_('Saves', { id, nameKey: key, reelId, createdAt: old ? old.createdAt : new Date().toISOString(), active: String(active) }, old);
  return { reelId, active };
}
function reelsMessagePublic_(row, posts) {
  const post = posts.get(row.reelId);
  return { id: row.id, fromName: row.fromName, fromKey: row.fromKey, toName: row.toName, toKey: row.toKey, body: row.body, reelId: row.reelId, reel: post && reelsVisible_(post) ? reelsPublic_(post) : null, createdAt: row.createdAt };
}
function reelsInbox_(p) {
  const key = SFReels.nameKey(p.name), reads = new Map(reelsRows_('Reads').filter(r => r.nameKey === key).map(r => [r.peerKey, r.through]));
  const conversations = new Map();
  reelsRows_('Messages').filter(r => r.fromKey === key || r.toKey === key).sort(SFReels.compare).forEach(row => {
    const incoming = row.toKey === key, peerKey = incoming ? row.fromKey : row.toKey;
    if (!conversations.has(peerKey)) conversations.set(peerKey, { peerKey, name: incoming ? row.fromName : row.toName, preview: row.body || 'Shared a reel', createdAt: row.createdAt, unread: 0 });
    if (incoming && SFReels.orderKey(row) > (reads.get(peerKey) || '')) conversations.get(peerKey).unread++;
  });
  return { conversations: Array.from(conversations.values()), notice: 'Name-only inboxes are not private. Anyone entering your name can read and send messages as you.' };
}
function reelsThread_(p) {
  const key = SFReels.nameKey(p.name), peer = SFReels.nameKey(p.peer);
  const rows = reelsRows_('Messages').filter(r => (r.fromKey === key && r.toKey === peer) || (r.fromKey === peer && r.toKey === key)).sort(SFReels.compare);
  const before = SFReels.text(p.before, 120, 'History cursor');
  const selected = (before ? rows.filter(r => SFReels.orderKey(r) < before) : rows).slice(0, 50);
  const posts = new Map(reelsRows_('Posts').map(r => [r.id, r]));
  if (!before && selected.length && String(p.markRead) === 'true') {
    const id = reelsHash_(key + '|' + peer), old = reelsRows_('Reads').find(r => r.id === id);
    const through = SFReels.orderKey(selected[0]);
    if (!old || through > old.through) reelsWrite_('Reads', { id, nameKey: key, peerKey: peer, through }, old);
  }
  const last = selected[selected.length - 1];
  return { messages: selected.reverse().map(r => reelsMessagePublic_(r, posts)), before: last && rows.some(r => SFReels.orderKey(r) < SFReels.orderKey(last)) ? SFReels.orderKey(last) : '' };
}
function reelsSend_(p) {
  const fromName = SFReels.name(p.name), toName = SFReels.name(p.peer), fromKey = SFReels.nameKey(fromName), toKey = SFReels.nameKey(toName);
  if (fromKey === toKey) throw new Error('Choose another member to message.');
  const body = SFReels.text(p.body, 1000, 'Message'), reelId = SFReels.text(p.reelId, 30, 'Reel');
  if (!body && !reelId) throw new Error('Write a message or choose a reel to share.');
  const requestId = String(p.requestId || '');
  if (!/^[a-f0-9]{32}$/.test(requestId)) throw new Error('Refresh Reels before sending.');
  const id = reelsHash_(fromKey + '|' + requestId), rows = reelsRows_('Messages'), old = rows.find(r => r.id === id);
  const posts = new Map(reelsRows_('Posts').map(r => [r.id, r]));
  if (old) {
    if (old.toKey !== toKey || old.body !== body || old.reelId !== reelId) throw new Error('That send attempt already has different contents. Refresh to check the conversation.');
    return { message: reelsMessagePublic_(old, posts), duplicate: true };
  }
  if (reelId && (!posts.has(reelId) || !reelsVisible_(posts.get(reelId)))) throw new Error('That reel is no longer available.');
  const cutoff = new Date(Date.now() - 3600000).toISOString(), recent = rows.filter(r => r.createdAt > cutoff);
  if (recent.filter(r => r.fromKey === fromKey).length >= 60 || recent.length >= 1000) throw new Error('The messaging limit has been reached. Please try again later.');
  // Serialized sends get distinct timestamps, including within the same millisecond.
  const last = rows.reduce((max, row) => Math.max(max, Date.parse(row.createdAt) || 0), 0);
  const row = { id, fromName, fromKey, toName, toKey, body, reelId, createdAt: new Date(Math.max(Date.now(), last + 1)).toISOString() };
  reelsWrite_('Messages', row);
  return { message: reelsMessagePublic_(row, posts), duplicate: false };
}
function asmeReelsGet_(e) {
  const p = e && e.parameter || {};
  if (p.action !== 'reelsFeed') return null;
  const callback = String(p.callback || '');
  if (!/^__asmeReels_[a-f0-9]{32}$/.test(callback)) return ContentService.createTextOutput('Invalid callback');
  let response;
  try { validateFrontendOrigin_(String(p.origin || '')); response = { ok: true, data: reelsFeed_(p) }; }
  catch (error) { response = { ok: false, error: error.message }; }
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(response).replace(/</g, '\\u003c') + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function asmeReelsPost_(e) {
  const p = e && e.parameter || {}, handlers = { reelsSubmit: reelsSubmit_, reelsSave: reelsSave_, reelsSaved: reelsSaved_, reelsInbox: reelsInbox_, reelsThread: reelsThread_, reelsSend: reelsSend_ };
  if (!Object.prototype.hasOwnProperty.call(handlers, p.action)) return null;
  const response = { type: 'asme-reels', callId: String(p.callId || '') };
  try {
    validateFrontendOrigin_(String(p.origin || ''));
    if (!/^[a-f0-9]{32}$/.test(response.callId)) throw new Error('Refresh Reels and try again.');
    const readOnly = ['reelsSaved', 'reelsInbox'].includes(p.action) || (p.action === 'reelsThread' && String(p.markRead) !== 'true');
    response.data = readOnly ? handlers[p.action](p) : reelsLock_(function () { return handlers[p.action](p); }); response.ok = true;
  } catch (error) { response.ok = false; response.error = error.message; }
  return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><script>window.top.postMessage(' + JSON.stringify(response).replace(/</g, '\\u003c') + ',' + JSON.stringify(String(p.origin || '')).replace(/</g, '\\u003c') + ');</script>').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
