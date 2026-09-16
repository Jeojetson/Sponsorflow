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
    const book = gamesBook_();
    // Preflight both names before adding or formatting anything. Existing data
    // under either reserved name must already match this Games schema.
    for (const name of Object.keys(SF_GAMES.HEADERS)) {
      const sheet = book.getSheetByName(SF_GAMES.SHEETS[name]);
      if (sheet && sheet.getLastRow() > 0)
        gamesCheckHeaders_(sheet, name, true);
    }
    for (const name of Object.keys(SF_GAMES.HEADERS)) {
      let sheet = book.getSheetByName(SF_GAMES.SHEETS[name]);
      if (sheet && sheet.getLastRow() > 0) {
        const existingColumns = sheet.getLastColumn();
        const missing = SF_GAMES.HEADERS[name].slice(existingColumns);
        if (missing.length)
          sheet
            .getRange(1, existingColumns + 1, 1, missing.length)
            .setValues([missing]);
        continue;
      }
      if (!sheet) sheet = book.insertSheet(SF_GAMES.SHEETS[name]);
      const headers = SF_GAMES.HEADERS[name];
      sheet
        .getRange(1, 1, sheet.getMaxRows(), headers.length)
        .setNumberFormat('@');
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
    }
    return book.getUrl();
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
function gamesCheckHeaders_(sheet, name, allowUpgrade) {
  const expected = SF_GAMES.HEADERS[name];
  const width = sheet.getLastColumn();
  const previous = name === 'Results' && width === 9 && allowUpgrade;
  const actual = sheet.getRange(1, 1, 1, width).getValues()[0];
  if (
    (!previous && width !== expected.length) ||
    actual.some((header, i) => expected[i] !== header)
  ) {
    throw new Error(
      SF_GAMES.SHEETS[name] +
        ' has different columns. Existing data was left unchanged.',
    );
  }
}
function gamesSheet_(name) {
  const sheet = gamesBook_().getSheetByName(SF_GAMES.SHEETS[name]);
  if (!sheet || !sheet.getLastRow())
    throw new Error('The club leaderboard is not open yet.');
  gamesCheckHeaders_(sheet, name);
  return sheet;
}
function gamesRows_(name) {
  const sheet = gamesSheet_(name);
  const headers = SF_GAMES.HEADERS[name];
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
    day: gamesDateOnly_(r.day),
    game: r.game,
    points: Number(r.points),
    win: r.win === true || String(r.win) === 'true',
    detail: String(r.detail),
    completedAt: r.completedAt,
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
function gamesInvalidate_() {
  const keys = [];
  for (const period of ['today', 'week', 'month'])
    for (const game of ['all', 'kart'].concat(SFGames.GAMES.map((g) => g.id)))
      for (const version of [1, 2])
        keys.push(
          'ASME_GAMES_BOARD_V2:' +
            version +
            ':' +
            gamesDay_() +
            ':' +
            period +
            ':' +
            game,
        );
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
  const sheet = gamesSheet_('Players'),
    values = SF_GAMES.HEADERS.Players.map((k) => player[k]);
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
      .filter(
        (r) =>
          r.playerId === player.playerId && gamesDateOnly_(r.day) >= cutoff,
      )
      .map((r) => gamesPublicRecord_(r, name)),
  };
}
function gamesScore_(input) {
  const player = gamesProfile_(input.code);
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
  const id =
      player.playerId +
      ':' +
      day +
      ':' +
      game +
      (version === 1 ? '' : ':v' + version),
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
    version,
    elapsedMs: result.elapsedMs || '',
    mistakes: result.mistakes || 0,
    accuracy: result.accuracy || '',
    accuracyPoints: result.accuracyPoints || 0,
    speedPoints: result.speedPoints || 0,
  };
  const sheet = gamesSheet_('Results'),
    values = SF_GAMES.HEADERS.Results.map((k) => record[k]);
  if (existing)
    sheet.getRange(existing._row, 1, 1, values.length).setValues([values]);
  else sheet.appendRow(values);
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
      'ASME_GAMES_BOARD_V2:' + version + ':' + day + ':' + period + ':' + game;
  const saved = cache.get(key);
  if (saved) return JSON.parse(saved);
  const players = gamesRows_('Players'),
    names = {};
  players.forEach((p) => (names[p.playerId] = p.name));
  const records = gamesRows_('Results')
    .map((r) => gamesPublicRecord_(r, names[r.playerId] || 'Club member'))
    .filter(
      (record) =>
        record.version === version && (version === 1 || record.game !== 'kart'),
    );
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
function asmeGamesGet_(e) {
  const p = e?.parameter || {};
  if (p.action !== 'gamesLeaderboard') return null;
  const callback = String(p.callback || '');
  if (!/^__asmeGames_[a-f0-9]{32}$/.test(callback))
    return ContentService.createTextOutput('Invalid callback');
  let response;
  try {
    validateFrontendOrigin_(String(p.origin || ''));
    response = { ok: true, data: gamesLeaderboard_(p) };
  } catch (error) {
    response = { ok: false, error: error.message };
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
