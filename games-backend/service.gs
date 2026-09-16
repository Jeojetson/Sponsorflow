/** Standalone ASME Games service. Deploy in its OWN Apps Script project. */
const GAMES = Object.freeze({
  ORIGIN: 'https://jeojetson.github.io',
  HEADERS: {
    Players: [
      'playerId',
      'codeHash',
      'name',
      'nameKey',
      'createdAt',
      'updatedAt',
    ],
    Results: [
      'id',
      'playerId',
      'day',
      'game',
      'points',
      'win',
      'detail',
      'proofHash',
      'completedAt',
    ],
  },
});

function setupGames() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('GAMES_SHEET_ID'))
    return SpreadsheetApp.openById(
      props.getProperty('GAMES_SHEET_ID'),
    ).getUrl();
  const book = SpreadsheetApp.create('ASME Games Leaderboard');
  for (const name of Object.keys(GAMES.HEADERS)) {
    const sheet = book.insertSheet(name);
    sheet.appendRow(GAMES.HEADERS[name]);
    sheet.setFrozenRows(1);
    // Keep ISO dates and identifiers as text; scores remain numbers.
    sheet
      .getRange(1, 1, sheet.getMaxRows(), GAMES.HEADERS[name].length)
      .setNumberFormat('@');
  }
  const first = book.getSheets().find((s) => !GAMES.HEADERS[s.getName()]);
  if (first) book.deleteSheet(first);
  props.setProperty('GAMES_SHEET_ID', book.getId());
  console.log(book.getUrl());
  return book.getUrl();
}
function gamesBook_() {
  const id =
    PropertiesService.getScriptProperties().getProperty('GAMES_SHEET_ID');
  if (!id) throw new Error('The club leaderboard is not open yet.');
  return SpreadsheetApp.openById(id);
}
function gamesRows_(name) {
  const sheet = gamesBook_().getSheetByName(name);
  if (!sheet) throw new Error('Leaderboard storage is unavailable.');
  const headers = GAMES.HEADERS[name];
  if (sheet.getLastRow() < 2) return [];
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, headers.length)
    .getValues()
    .map((row, index) => {
      const obj = { _row: index + 2 };
      headers.forEach((key, i) => (obj[key] = row[i]));
      return obj;
    });
}
function gamesHash_(text) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(text),
    Utilities.Charset.UTF_8,
  )
    .map((b) => ((b + 256) % 256).toString(16).padStart(2, '0'))
    .join('');
}
function gamesDay_() {
  return Utilities.formatDate(
    new Date(),
    'America/Indiana/Indianapolis',
    'yyyy-MM-dd',
  );
}
function gamesProfile_(code) {
  if (!/^[a-f0-9]{48}$/.test(String(code || '')))
    throw new Error(
      'Your player code is invalid. Open Your player to restore it.',
    );
  const hash = gamesHash_(code);
  const player = gamesRows_('Players').find((r) => r.codeHash === hash);
  if (!player)
    throw new Error('Join the club leaderboard before submitting a score.');
  return player;
}
function gamesPublicRecord_(r, name) {
  return {
    playerId: r.playerId,
    name: name || '',
    day: String(r.day),
    game: r.game,
    points: Number(r.points),
    win: r.win === true || String(r.win) === 'true',
    detail: String(r.detail),
    completedAt: r.completedAt,
    synced: true,
  };
}
function gamesInvalidate_() {
  const keys = [];
  for (const period of ['today', 'week', 'month'])
    for (const game of ['all'].concat(SFGames.GAMES.map((g) => g.id)))
      keys.push('board:' + gamesDay_() + ':' + period + ':' + game);
  CacheService.getScriptCache().removeAll(keys);
}
function gamesJoin_(input) {
  const name = String(input.name || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._'’\-]{1,39}$/u.test(name))
    throw new Error(
      'Use 2–40 letters, numbers, spaces, apostrophes, or hyphens for your name.',
    );
  const code = String(input.code || '');
  if (!/^[a-f0-9]{48}$/.test(code))
    throw new Error('Your player code is invalid.');
  const hash = gamesHash_(code),
    players = gamesRows_('Players'),
    existing = players.find((r) => r.codeHash === hash),
    nameKey = name.toLocaleLowerCase();
  if (players.some((r) => r.nameKey === nameKey && r.codeHash !== hash))
    throw new Error(
      'That name is already on the leaderboard. Restore your player code or choose a different display name.',
    );
  const now = new Date().toISOString();
  const player = {
    playerId: existing?.playerId || hash.slice(0, 24),
    codeHash: hash,
    name,
    nameKey,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  const sheet = gamesBook_().getSheetByName('Players'),
    values = GAMES.HEADERS.Players.map((k) => player[k]);
  if (existing)
    sheet.getRange(existing._row, 1, 1, values.length).setValues([values]);
  else sheet.appendRow(values);
  gamesInvalidate_();
  const cutoff = new Date(Date.now() - 35 * 86400000)
    .toISOString()
    .slice(0, 10);
  return {
    playerId: player.playerId,
    name,
    results: gamesRows_('Results')
      .filter((r) => r.playerId === player.playerId && String(r.day) >= cutoff)
      .map((r) => gamesPublicRecord_(r, name)),
  };
}
function gamesScore_(input) {
  const player = gamesProfile_(input.code);
  const day = String(input.day || ''),
    game = String(input.game || '');
  if (Number(input.version) !== SFGames.VERSION)
    throw new Error('Refresh the games page before syncing this result.');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !SFGames.GAMES.some((g) => g.id === game)
  )
    throw new Error('Invalid challenge.');
  const date = new Date(day + 'T12:00:00Z');
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== day
  )
    throw new Error('Invalid challenge date.');
  const oldest = new Date(Date.now() - 35 * 86400000)
    .toISOString()
    .slice(0, 10);
  if (day > gamesDay_() || day < oldest)
    throw new Error('Only results from the last 35 days can be synced.');
  const proofText = String(input.proof || '');
  if (proofText.length > 60000) throw new Error('This result is too large.');
  let proof;
  try {
    proof = JSON.parse(proofText);
  } catch (_) {
    throw new Error('Invalid result.');
  }
  const result = SFGames.validate(game, SFGames.puzzle(game, day), proof);
  const id = player.playerId + ':' + day + ':' + game,
    existing = gamesRows_('Results').find((r) => r.id === id);
  // Puzzles keep the first result; racing keeps the best. Retried writes are idempotent.
  if (existing && (game !== 'kart' || Number(existing.points) >= result.points))
    return { record: gamesPublicRecord_(existing, player.name) };
  const record = {
    id,
    playerId: player.playerId,
    day,
    game,
    points: result.points,
    win: result.win,
    detail: result.detail,
    proofHash: gamesHash_(proofText),
    completedAt: new Date().toISOString(),
  };
  const sheet = gamesBook_().getSheetByName('Results'),
    values = GAMES.HEADERS.Results.map((k) => record[k]);
  if (existing)
    sheet.getRange(existing._row, 1, 1, values.length).setValues([values]);
  else sheet.appendRow(values);
  gamesInvalidate_();
  return { record: gamesPublicRecord_(record, player.name) };
}
function gamesLeaderboard_(input) {
  const period = String(input.period || 'today'),
    game = String(input.game || 'all'),
    day = gamesDay_();
  if (
    !['today', 'week', 'month'].includes(period) ||
    !['all'].concat(SFGames.GAMES.map((g) => g.id)).includes(game)
  )
    throw new Error('Invalid standings filter.');
  const cache = CacheService.getScriptCache(),
    key = 'board:' + day + ':' + period + ':' + game;
  const saved = cache.get(key);
  if (saved) return JSON.parse(saved);
  const players = gamesRows_('Players'),
    names = {};
  players.forEach((p) => (names[p.playerId] = p.name));
  const records = gamesRows_('Results').map((r) =>
    gamesPublicRecord_(r, names[r.playerId] || 'Club member'),
  );
  const result = {
    day,
    rows: SFGames.rank(records, period, day, game).slice(0, 200),
    updatedAt: new Date().toISOString(),
  };
  const text = JSON.stringify(result);
  if (text.length < 90000) cache.put(key, text, 60);
  return result;
}
function doGet(e) {
  const p = e?.parameter || {};
  if (p.action !== 'leaderboard')
    return ContentService.createTextOutput('ASME Games leaderboard service');
  const callback = String(p.callback || '');
  if (!/^__asmeGames_[a-f0-9]{32}$/.test(callback))
    return ContentService.createTextOutput('Invalid callback');
  let response;
  try {
    if (p.origin !== GAMES.ORIGIN)
      throw new Error('This site is not allowed to load the leaderboard.');
    response = { ok: true, data: gamesLeaderboard_(p) };
  } catch (error) {
    response = { ok: false, error: error.message };
  }
  return ContentService.createTextOutput(
    callback + '(' + JSON.stringify(response).replace(/</g, '\\u003c') + ');',
  ).setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function doPost(e) {
  const p = e?.parameter || {};
  const response = { type: 'asme-games', callId: String(p.callId || '') };
  try {
    if (p.origin !== GAMES.ORIGIN || !/^[a-f0-9]{32}$/.test(response.callId))
      throw new Error('This site is not allowed to submit game results.');
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000))
      throw new Error(
        'The leaderboard is busy. Your score is saved; please retry.',
      );
    try {
      if (p.action === 'join') response.data = gamesJoin_(p);
      else if (p.action === 'score') response.data = gamesScore_(p);
      else throw new Error('Unknown game action.');
      response.ok = true;
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    response.ok = false;
    response.error = error.message;
  }
  const data = JSON.stringify(response).replace(/</g, '\\u003c');
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8"><script>window.top.postMessage(' +
      data +
      ',' +
      JSON.stringify(GAMES.ORIGIN) +
      ');</script>',
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
