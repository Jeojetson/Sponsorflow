/** ASME Games extension for the existing SponsorFlow Apps Script project. */
const SF_GAMES = Object.freeze({
  SHEETS: { Players: 'Games Players', Results: 'Games Results' },
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
      'version',
      'elapsedMs',
      'mistakes',
      'accuracy',
      'accuracyPoints',
      'speedPoints',
    ],
  },
});

function setupGames() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000))
    throw new Error('SponsorFlow is busy. Try setup again in a moment.');
  try {
    return gamesEnsureSchema_().getUrl();
  } finally {
    lock.releaseLock();
  }
}
function gamesBook_() {
  // Reuse SponsorFlow's existing spreadsheet and configuration. Games setup
  // never runs the main schema migration, reseeds data, or changes properties.
  const id =
    PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SponsorFlow spreadsheet is not configured.');
  return SpreadsheetApp.openById(id);
}
// Header names define the schema. Officers may reorder columns or keep extra
// notes; neither changes the meaning of stored player IDs and score records.
function gamesCheckHeaders_(sheet, name) {
  const actual = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(header => String(header).trim());
  const required = name === 'Results' ? SF_GAMES.HEADERS.Results.slice(0, 9) : SF_GAMES.HEADERS.Players;
  const missing = required.filter(header => !actual.includes(header));
  const duplicated = SF_GAMES.HEADERS[name].filter(header => actual.filter(value => value === header).length > 1);
  if (missing.length || duplicated.length) {
    const error = new Error(SF_GAMES.SHEETS[name] + ' has different columns. ' +
      (missing.length ? 'Missing: ' + missing.join(', ') + '. ' : '') +
      (duplicated.length ? 'Duplicate: ' + duplicated.join(', ') + '. ' : '') +
      'Ask an officer to check the header row. Existing data was left unchanged.');
    error.code = 'GAMES_SCHEMA';
    throw error;
  }
  return actual;
}
// Called only while holding the Games write lock. Preflight every existing
// sheet first, then append missing timing headers without rewriting any rows.
function gamesEnsureSchema_() {
  const book = gamesBook_();
  const checked = {};
  for (const name of Object.keys(SF_GAMES.HEADERS)) {
    const sheet = book.getSheetByName(SF_GAMES.SHEETS[name]);
    checked[name] = { sheet, headers: sheet && sheet.getLastRow() ? gamesCheckHeaders_(sheet, name) : null };
  }
  for (const name of Object.keys(SF_GAMES.HEADERS)) {
    let sheet = checked[name].sheet;
    if (!sheet) sheet = book.insertSheet(SF_GAMES.SHEETS[name]);
    if (!sheet.getLastRow()) {
      sheet.getRange(1, 1, sheet.getMaxRows(), SF_GAMES.HEADERS[name].length).setNumberFormat('@');
      sheet.appendRow(SF_GAMES.HEADERS[name]);
      sheet.setFrozenRows(1);
    } else {
      const headers = checked[name].headers;
      const missing = SF_GAMES.HEADERS[name].filter(header => !headers.includes(header));
      if (missing.length) sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    }
  }
  return book;
}
function gamesSheet_(name) {
  const sheet = gamesBook_().getSheetByName(SF_GAMES.SHEETS[name]);
  if (!sheet || !sheet.getLastRow())
    throw new Error('The club leaderboard needs setup. Ask an officer to run setupGames in Apps Script.');
  return sheet;
}
function gamesRows_(name) {
  const sheet = gamesSheet_(name);
  const headers = gamesCheckHeaders_(sheet, name);
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues()
    .map((row, index) => {
      const obj = { _row: index + 2 };
      headers.forEach((key, i) => { if (SF_GAMES.HEADERS[name].includes(key)) obj[key] = row[i]; });
      return obj;
    }).filter(row => row.id || row.playerId);
}
function gamesWrite_(name, object, existing) {
  const sheet = gamesSheet_(name);
  const headers = gamesCheckHeaders_(sheet, name);
  if (!existing) {
    sheet.appendRow(headers.map(header => Object.prototype.hasOwnProperty.call(object, header) ? object[header] : ''));
    return;
  }
  // Write only owned columns, leaving custom cells and their formulas intact.
  for (let start = 0; start < headers.length;) {
    if (!Object.prototype.hasOwnProperty.call(object, headers[start])) { start++; continue; }
    let end = start + 1;
    while (end < headers.length && Object.prototype.hasOwnProperty.call(object, headers[end])) end++;
    sheet.getRange(existing._row, start + 1, 1, end - start)
      .setValues([headers.slice(start, end).map(header => object[header])]);
    start = end;
  }
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
function gamesName_(value) {
  const name = String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!/^[\p{L}\p{N}][\p{L}\p{M}\p{N} ._'’\-]{1,39}$/u.test(name))
    throw new Error('Use 2–40 letters, numbers, spaces, apostrophes, or hyphens for your name.');
  return name;
}
function gamesPeople_() {
  const players = gamesRows_('Players'), byName = new Map(), aliases = new Map();
  // Keep the first existing player ID and every historical row intact.
  players.forEach(player => {
    const key = SFGamesMetrics.nameKey(player.name);
    if (!byName.has(key)) byName.set(key, player);
    aliases.set(player.playerId, byName.get(key));
  });
  return { players, byName, aliases };
}
function gamesProfile_(input) {
  const people = gamesPeople_();
  if (input.name) {
    const player = people.byName.get(SFGamesMetrics.nameKey(gamesName_(input.name)));
    if (player) return player;
  } else if (input.code) {
    // Compatibility for an already-open 5.1 page; new clients use names only.
    const old = people.players.find(r => r.codeHash === gamesHash_(input.code));
    if (old) return people.aliases.get(old.playerId);
  }
  throw new Error('Join the club leaderboard before submitting a score.');
}
function gamesRecords_(people) {
  return gamesRows_('Results').map(row => {
    const player = people.aliases.get(row.playerId);
    return gamesPublicRecord_(Object.assign({}, row, { playerId: player ? player.playerId : row.playerId }), player ? player.name : 'Club member');
  });
}
function gamesPublicRecord_(r, name) {
  return {
    playerId: r.playerId,
    name: name || '',
    day: gamesDateOnly_(r.day),
    game: r.game,
    points: Number(r.points),
    win: r.win === true || String(r.win) === 'true',
    detail: String(r.detail),
    completedAt: r.completedAt instanceof Date ? r.completedAt.toISOString() : String(r.completedAt || ''),
    version: Number(r.version || 1),
    elapsedMs: Number(r.elapsedMs || 0),
    mistakes: Number(r.mistakes || 0),
    accuracy: Number(r.accuracy || 0),
    accuracyPoints: Number(r.accuracyPoints || 0),
    speedPoints: Number(r.speedPoints || 0),
    synced: true,
  };
}
function gamesDateOnly_(value) {
  if (value instanceof Date)
    return Utilities.formatDate(
      value,
      'America/Indiana/Indianapolis',
      'yyyy-MM-dd',
    );
  return String(value || '').slice(0, 10);
}
function gamesNewRevision_() {
  return gamesHash_(Date.now() + ':' + Math.random()).slice(0, 24);
}
function gamesRevision_(cache) {
  let revision = cache.get('ASME_GAMES_REVISION_V52');
  if (!revision) {
    revision = gamesNewRevision_();
    cache.put('ASME_GAMES_REVISION_V52', revision, 21600);
  }
  return revision;
}
function gamesInvalidate_() {
  // New reads use a new namespace. An older in-flight read can only fill its
  // old namespace, so it cannot republish stale standings after a score save.
  CacheService.getScriptCache().put('ASME_GAMES_REVISION_V52', gamesNewRevision_(), 21600);
}
function gamesJoin_(input) {
  const name = gamesName_(input.name), nameKey = SFGamesMetrics.nameKey(name);
  let people = gamesPeople_(), player = people.byName.get(nameKey);
  if (!player) {
    const now = new Date().toISOString();
    player = { playerId: gamesHash_('name:' + nameKey).slice(0, 24),
      codeHash: /^[a-f0-9]{48}$/.test(String(input.code || '')) ? gamesHash_(input.code) : '',
      name, nameKey, createdAt: now, updatedAt: now };
    gamesWrite_('Players', player);
    gamesInvalidate_();
    people = gamesPeople_();
  }
  const cutoff = SFGamesMetrics.shift(gamesDay_(), -35);
  const all = gamesRecords_(people).filter(r => r.playerId === player.playerId && r.day >= cutoff);
  return { identityMode: 'name', playerId: player.playerId, name: player.name,
    results: all.filter(r => r.version === 1).concat(SFGamesMetrics.records(all, gamesDay_())) };
}
function gamesScore_(input) {
  const player = gamesProfile_(input);
  const day = String(input.day || ''),
    game = String(input.game || '');
  const version = Number(input.version || 1);
  if (![1, SFGames.SCORING_VERSION].includes(version))
    throw new Error('Refresh the games page before syncing this result.');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    (!SFGames.GAMES.some((g) => g.id === game) &&
      !(version === 1 && game === 'kart'))
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
  const result =
    version === 2
      ? SFGames.scoreTimed(game, gamesPuzzle_(game, day), proof)
      : SFGames.validate(game, gamesPuzzle_(game, day), proof);
  const aliases = gamesPeople_().aliases;
  const id =
      player.playerId +
      ':' +
      day +
      ':' +
      game +
      (version === 1 ? '' : ':v' + version),
    existing = gamesRows_('Results').filter(r =>
      aliases.get(r.playerId)?.playerId === player.playerId &&
      gamesDateOnly_(r.day) === day && r.game === game && Number(r.version || 1) === version)
      .sort((a, b) => {
        const left = a.completedAt instanceof Date ? a.completedAt.toISOString() : String(a.completedAt || '');
        const right = b.completedAt instanceof Date ? b.completedAt.toISOString() : String(b.completedAt || '');
        return left.localeCompare(right);
      })[0];
  // Puzzles keep the first result; racing keeps the best. Retried writes are idempotent.
  if (existing && (game !== 'kart' || Number(existing.points) >= result.points))
    return { record: gamesPublicRecord_(Object.assign({}, existing, { playerId: player.playerId }), player.name) };
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
    version,
    elapsedMs: result.elapsedMs || '',
    mistakes: result.mistakes || 0,
    accuracy: result.accuracy || '',
    accuracyPoints: result.accuracyPoints || 0,
    speedPoints: result.speedPoints || 0,
  };
  gamesWrite_('Results', record, existing);
  gamesInvalidate_();
  return { record: gamesPublicRecord_(record, player.name) };
}
function gamesPuzzle_(game, day) {
  const key = 'ASME_PUZZLE_V1:' + day + ':' + game;
  const cache = CacheService.getScriptCache();
  const saved = cache.get(key);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (_) {}
  }
  const puzzle = SFGames.puzzle(game, day);
  cache.put(key, JSON.stringify(puzzle), 21600);
  return puzzle;
}
function gamesLeaderboard_(input) {
  const version = Number(input.version || 1);
  if (![1, 2].includes(version))
    throw new Error('Refresh Games to load the current rankings.');
  const period = String(input.period || 'today'),
    game = String(input.game || 'all'),
    day = gamesDay_();
  if (
    !['today', 'week', 'month'].includes(period) ||
    !['all']
      .concat(
        version === 1 ? ['kart'] : [],
        SFGames.GAMES.map((g) => g.id),
      )
      .includes(game)
  )
    throw new Error('Invalid standings filter.');
  const cache = CacheService.getScriptCache(),
    key =
      'ASME_GAMES_BOARD_V3:' + version + ':' + day + ':' + period + ':' + game + ':' + gamesRevision_(cache);
  const saved = cache.get(key);
  if (saved) return JSON.parse(saved);
  const raw = gamesRecords_(gamesPeople_()).filter(r => r.version === version);
  const records = version === 2 ? SFGamesMetrics.records(raw, day) : raw;
  const result = {
    version,
    day,
    rows: SFGames.rank(records, period, day, game).slice(0, 200),
    updatedAt: new Date().toISOString(),
  };
  const text = JSON.stringify(result);
  if (text.length < 90000) cache.put(key, text, 60);
  return result;
}
function gamesReadSnapshot_(cache, key) {
  try {
    const manifest = cache.get(key);
    if (!manifest) return null;
    const keys = JSON.parse(manifest).chunks;
    if (!Array.isArray(keys)) return null;
    const parts = keys.map(part => cache.get(part));
    return parts.every(part => part != null) ? JSON.parse(parts.join('')) : null;
  } catch (_) { return null; }
}
function gamesCacheSnapshot_(cache, key, snapshot) {
  // CacheService limits each value to 100 KB. Publish a manifest last so
  // concurrent readers never combine chunks from different snapshots.
  try {
    const text = Array.from(JSON.stringify(snapshot)), chunks = [], values = {};
    const revision = gamesHash_(Date.now() + ':' + Math.random()).slice(0, 16);
    for (let i = 0; i < text.length; i += 20000) {
      const chunk = key + ':' + revision + ':' + chunks.length;
      chunks.push(chunk); values[chunk] = text.slice(i, i + 20000).join('');
    }
    cache.putAll(values, 90);
    cache.put(key, JSON.stringify({ chunks }), 60);
  } catch (_) {} // A cache eviction/outage never prevents a fresh response.
}
function gamesInsights_(input) {
  const day = gamesDay_(), cache = CacheService.getScriptCache(), key = 'ASME_GAMES_INSIGHTS_V1:' + day + ':' + gamesRevision_(cache);
  let snapshot = gamesReadSnapshot_(cache, key);
  if (!snapshot) {
    snapshot = SFGamesMetrics.build(gamesRecords_(gamesPeople_()), day);
    snapshot.updatedAt = new Date().toISOString();
    gamesCacheSnapshot_(cache, key, snapshot);
  }
  const nameKey = SFGamesMetrics.nameKey(input.name);
  const player = snapshot.players.find(p => SFGamesMetrics.nameKey(p.name) === nameKey) || null;
  return { identityMode: 'name', day, windowDays: snapshot.windowDays, updatedAt: snapshot.updatedAt,
    club: snapshot.club, daily: snapshot.daily, games: snapshot.games, winners: snapshot.winners, player,
    players: snapshot.players.map(p => ({ playerId: p.playerId, name: p.name })),
    champions: snapshot.players.filter(p => p.dayWins > 0)
      .sort((a, b) => b.dayWins - a.dayWins || b.points - a.points || a.name.localeCompare(b.name))
      .slice(0, 10).map(p => ({ playerId: p.playerId, name: p.name, dayWins: p.dayWins })) };
}
function asmeGamesGet_(e) {
  const p = e?.parameter || {};
  if (!['gamesLeaderboard', 'gamesInsights'].includes(p.action)) return null;
  const callback = String(p.callback || '');
  if (!/^__asmeGames_[a-f0-9]{32}$/.test(callback))
    return ContentService.createTextOutput('Invalid callback');
  let response;
  try {
    validateFrontendOrigin_(String(p.origin || ''));
    response = { ok: true, data: p.action === 'gamesInsights' ? gamesInsights_(p) : gamesLeaderboard_(p) };
  } catch (error) {
    response = { ok: false, error: error.message, code: error.code || '' };
  }
  return ContentService.createTextOutput(
    callback + '(' + JSON.stringify(response).replace(/</g, '\\u003c') + ');',
  ).setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function asmeGamesPost_(e) {
  const p = e?.parameter || {};
  if (!['gamesJoin', 'gamesScore'].includes(p.action)) return null;
  const response = { type: 'asme-games', callId: String(p.callId || '') };
  try {
    validateFrontendOrigin_(String(p.origin || ''));
    if (!/^[a-f0-9]{32}$/.test(response.callId))
      throw new Error('This site is not allowed to submit game results.');
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000))
      throw new Error(
        'The leaderboard is busy. Your score is saved; please retry.',
      );
    try {
      gamesEnsureSchema_();
      if (p.action === 'gamesJoin') response.data = gamesJoin_(p);
      else if (p.action === 'gamesScore') response.data = gamesScore_(p);
      else throw new Error('Unknown game action.');
      response.ok = true;
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    response.ok = false;
    response.error = error.message;
    response.code = error.code || '';
  }
  const data = JSON.stringify(response).replace(/</g, '\\u003c');
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8"><script>window.top.postMessage(' +
      data +
      ',' +
      JSON.stringify(String(p.origin || '')).replace(/</g, '\\u003c') +
      ');</script>',
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
