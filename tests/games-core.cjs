const assert = require('node:assert/strict');
const C = require('../assets/games/core.js');
const makeBackend = require('./games-backend-fixture.cjs');
assert.deepEqual(C.wordMarks('SHEEP', 'SPEED'), [2, 0, 2, 2, 1]);
assert.deepEqual(C.wordMarks('LEVEL', 'LEVER'), [2, 2, 2, 2, 0]);
assert.equal(C.dayKey(new Date('2026-09-17T03:59:59Z')), '2026-09-16');
assert.equal(C.dayKey(new Date('2026-09-17T04:00:00Z')), '2026-09-17');
assert(C.WORDS.includes('CRUSH'));
assert(C.WORDS.includes('AROSE'));
assert(C.ANSWERS.every((w) => C.WORDS.includes(w)));
assert.equal(new Set(C.WORDS).size, C.WORDS.length);
for (let i = 0; i < 120; i++) {
  const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
  for (const id of ['word', 'groups', 'queens', 'binary', 'path', 'numbers']) {
    const p = C.puzzle(id, day);
    assert.deepEqual(C.puzzle(id, day), p);
    let proof;
    if (id === 'word') proof = { guesses: [p.answer] };
    if (id === 'groups') {
      assert.equal(new Set(p.words).size, 16);
      proof = { attempts: p.groups.map((g) => g.words) };
    }
    if (id === 'queens') {
      assert.equal(C.queenSolutions(p.regions).length, 1);
      proof = { cells: p.solution.map((v, r) => r * 6 + v) };
    }
    if (id === 'binary') {
      assert.equal(C.binarySolutions(p.givens).length, 1);
      proof = { cells: p.solution };
    }
    if (id === 'path') proof = { cells: p.solution };
    if (id === 'numbers') proof = { tree: p.solution };
    assert.equal(C.validate(id, p, proof).points, 100, id + ' ' + day);
  }
}
const today = C.dayKey(),
  p = C.puzzle('word', today);
assert.throws(() => C.validate('word', p, { guesses: ['ZZZZZ'] }));
assert.throws(() => C.validate('word', p, { guesses: [p.answer, p.answer] }));
assert.throws(() =>
  C.validate('numbers', C.puzzle('numbers', today), { tree: ['+', 0, 0] }),
);
assert.throws(() =>
  C.validate('path', C.puzzle('path', today), { cells: Array(25).fill(1) }),
);
// The exact same controls reproduce the same collision events and score.
const seed = C.puzzle('kart', today).seed,
  run = C.raceInitial(),
  events = [];
let lane = 1;
while (!run.ended) {
  const threat = run.objects.find(
    (o) => o.kind === 'cone' && o.y > 0.69 && !o.checked,
  );
  if (threat && threat.lane === lane) {
    lane = (lane + 1) % 3;
    events.push([run.frame, lane]);
  }
  C.raceStep(run, seed, lane);
}
assert.equal(run.frame, 2700);
assert.deepEqual(C.raceReplay(seed, events, 2700), run);
assert.equal(
  C.validate('kart', { seed }, { events, frames: 2700 }).points,
  C.raceScore(run),
);
assert.throws(() =>
  C.validate('kart', { seed }, { events: [[0, 7]], frames: 2700 }),
);
assert.throws(() => C.validate('kart', { seed }, { events: [], frames: 100 }));
const ranked = C.rank(
  [
    {
      playerId: 'a',
      name: 'A',
      day: today,
      game: 'word',
      points: 100,
      win: true,
    },
    {
      playerId: 'a',
      name: 'A',
      day: today,
      game: 'word',
      points: 50,
      win: true,
    },
    {
      playerId: 'b',
      name: 'B',
      day: today,
      game: 'word',
      points: 100,
      win: true,
    },
  ],
  'today',
  today,
);
assert.equal(ranked.length, 2);
assert.equal(ranked[0].rank, 1);
assert.equal(ranked[1].rank, 1);
assert.equal(ranked[0].points, 100);
const backend = makeBackend(),
  ctx = backend.context;
const code = 'a'.repeat(48),
  other = 'b'.repeat(48);
const player = ctx.gamesJoin_({ name: 'Jordan Lee', code });
assert.equal(player.results.length, 0);
assert.throws(
  () => ctx.gamesJoin_({ name: 'Jordan Lee', code: other }),
  /already/,
);
assert.throws(
  () => ctx.gamesJoin_({ name: '=IMPORTRANGE()', code: other }),
  /Use/,
);
assert.throws(
  () =>
    ctx.gamesScore_({
      code: other,
      day: today,
      game: 'word',
      proof: '{}',
      version: 1,
    }),
  /Join/,
);
const input = {
  code,
  day: today,
  game: 'word',
  version: 1,
  proof: JSON.stringify({ guesses: [p.answer] }),
};
assert.equal(ctx.gamesScore_(input).record.points, 100);
ctx.gamesScore_(input);
assert.equal(backend.sheets.get('Games Results').rows.length, 2);
assert.equal(
  ctx.gamesLeaderboard_({ period: 'today', game: 'all' }).rows[0].points,
  100,
);
ctx.gamesJoin_({ name: 'Jordan L.', code });
assert.equal(
  ctx.gamesLeaderboard_({ period: 'today', game: 'all' }).rows[0].name,
  'Jordan L.',
);
assert.equal(ctx.gamesJoin_({ name: 'Jordan L.', code }).results.length, 1);
const racing = {
  code,
  day: today,
  game: 'kart',
  version: 1,
  proof: JSON.stringify({ events, frames: 2700 }),
};
ctx.gamesScore_(racing);
ctx.gamesScore_(racing);
assert.equal(backend.sheets.get('Games Results').rows.length, 3);
assert.match(
  backend.post({
    action: 'gamesScore',
    origin: 'https://untrusted.test',
    ...input,
  }),
  /not allowed/,
);
assert.equal(
  backend.get({ action: 'gamesLeaderboard', callback: 'alert(1)' }),
  'Invalid callback',
);
assert.throws(
  () => ctx.gamesScore_({ ...input, day: '2099-01-01' }),
  /35 days/,
);
assert.throws(() => ctx.gamesScore_({ ...input, version: 3 }), /Refresh/);
// Equal point totals share a place even if the points came from different games.
const differentWins = C.rank(
  [
    {
      playerId: 'a',
      name: 'A',
      day: today,
      game: 'word',
      points: 100,
      win: true,
    },
    {
      playerId: 'b',
      name: 'B',
      day: today,
      game: 'kart',
      points: 100,
      win: false,
    },
  ],
  'today',
  today,
);
assert.deepEqual(
  differentWins.map((row) => row.rank),
  [1, 1],
);
console.log(
  'PASS: 120 daily sets, unique logic puzzles, all solutions, invalid proofs, deterministic kart replay, date rollover, ties, server identity, duplicate writes, restore, rename, origin and version checks.',
);

// The Games extension shares the existing workbook without modifying its data,
// settings, attendance cache, or officer sessions.
const integrated = makeBackend(undefined, { setup: false });
const snapshot = () =>
  JSON.stringify(
    [...integrated.sheets].map(([name, sheet]) => [name, sheet.rows]),
  );
const legacyRows = snapshot();
const legacyProperties = JSON.stringify([...integrated.properties]);
const legacyCache = JSON.stringify([...integrated.cache]);
assert.equal(integrated.context.setupGames(), integrated.book.getUrl());
assert.equal(integrated.sheets.size, 15);
assert.equal(
  JSON.stringify(
    [...integrated.sheets]
      .filter(([name]) => !name.startsWith('Games '))
      .map(([name, sheet]) => [name, sheet.rows]),
  ),
  legacyRows,
);
const afterSetup = snapshot();
integrated.context.setupGames();
assert.equal(snapshot(), afterSetup);
assert.equal(JSON.stringify([...integrated.properties]), legacyProperties);
assert.equal(JSON.stringify([...integrated.cache]), legacyCache);
const routeContext = integrated.context;
assert.equal(routeContext.asmeGamesGet_(), null);
assert.equal(routeContext.asmeGamesPost_(), null);
for (const action of integrated.legacyActions) {
  assert.equal(routeContext.asmeGamesPost_({ parameter: { action } }), null);
  assert.equal(JSON.parse(integrated.post({ action })).data.legacy, action);
}
for (const action of ['bootstrap', 'plannerBootstrap', 'attendanceBootstrap']) {
  assert.match(
    integrated.get({ action }),
    new RegExp('"legacy":"' + action + '"'),
  );
}
assert.equal(
  routeContext.doGet({ parameter: { view: 'admin' } }).text,
  'existing Admin.html',
);
assert.equal(
  routeContext.doGet({ parameter: { feed: 'calendar' } }).text,
  'existing calendar feed',
);
assert.match(
  integrated.post({ action: 'gamesJoin', name: 'Test Member', code }),
  /"ok":true/,
);
assert.match(integrated.get({ action: 'gamesLeaderboard' }), /"rows":\[\]/);
assert.equal(JSON.stringify([...integrated.properties]), legacyProperties);
assert.equal(
  integrated.cache.get('ATTENDANCE_PUBLIC_BOOTSTRAP_V21'),
  'existing attendance cache',
);
assert.equal(
  integrated.cache.get('ADMIN_SESSION_existing'),
  'existing session',
);
const collision = makeBackend(undefined, { setup: false });
collision.book
  .insertSheet('Games Results')
  .appendRow(['existing', 'unrelated', 'data']);
const beforeCollision = JSON.stringify(
  [...collision.sheets].map(([name, sheet]) => [name, sheet.rows]),
);
assert.throws(() => collision.context.setupGames(), /different columns/);
assert.equal(
  JSON.stringify(
    [...collision.sheets].map(([name, sheet]) => [name, sheet.rows]),
  ),
  beforeCollision,
);
assert.equal(collision.sheets.has('Games Players'), false);
const missingConfig = makeBackend(undefined, { setup: false });
missingConfig.properties.delete('SPREADSHEET_ID');
assert.throws(() => missingConfig.context.setupGames(), /not configured/);
assert.equal(missingConfig.sheets.size, 13);
console.log(
  'PASS: existing spreadsheet reuse, additive/idempotent setup, collision preflight, all 23 legacy POST routes, attendance/bootstrap/admin/calendar fallback, property and cache preservation.',
);

// Timed scoring keeps legacy records and new rankings in separate versions.
const fast = C.scoreTimed('word', p, { guesses: [p.answer], elapsedMs: 1000 });
const slow = C.scoreTimed('word', p, {
  guesses: [p.answer],
  elapsedMs: 121000,
});
assert.equal(fast.points, 1000);
assert.equal(fast.accuracy, 100);
assert.equal(fast.accuracyPoints, 800);
assert.equal(fast.speedPoints, 200);
assert.equal(slow.accuracyPoints, 800);
assert(slow.speedPoints < 200);
const wrong = C.WORDS.find((w) => w !== p.answer);
assert.equal(
  C.scoreTimed('word', p, { guesses: [wrong, p.answer], elapsedMs: 1000 })
    .accuracy,
  90,
);
const queenPuzzle = C.puzzle('queens', today),
  queenProof = {
    cells: queenPuzzle.solution.map((v, r) => r * 6 + v),
    elapsedMs: 1000,
    corrections: 2,
  };
assert.equal(C.scoreTimed('queens', queenPuzzle, queenProof).points, 840);
assert.equal(
  C.scoreTimed('queens', queenPuzzle, { ...queenProof, corrections: 200 })
    .accuracy,
  10,
);
assert.equal(
  C.scoreTimed('word', p, { guesses: Array(6).fill(wrong), elapsedMs: 1000 })
    .points,
  0,
);
for (const elapsedMs of [0, 999, NaN, Infinity, -1, 35 * 86400000 + 1])
  assert.throws(() =>
    C.scoreTimed('word', p, { guesses: [p.answer], elapsedMs }),
  );
assert.throws(() =>
  C.scoreTimed('queens', queenPuzzle, { ...queenProof, corrections: -1 }),
);
assert.throws(() =>
  C.scoreTimed('kart', { seed }, { events, frames: 2700, elapsedMs: 45000 }),
);
const timed = {
  ...input,
  version: 2,
  proof: JSON.stringify({ guesses: [p.answer], elapsedMs: 1000 }),
};
assert.equal(ctx.gamesScore_(timed).record.points, 1000);
assert.equal(
  ctx.gamesScore_({
    ...timed,
    proof: JSON.stringify({ guesses: [p.answer], elapsedMs: 999999 }),
  }).record.points,
  1000,
);
const timedBoard = ctx.gamesLeaderboard_({
  version: 2,
  period: 'today',
  game: 'all',
});
assert.equal(timedBoard.rows[0].points, 1000);
assert.equal(timedBoard.rows[0].played, 1);
assert.equal(
  ctx.gamesLeaderboard_({ version: 1, period: 'today', game: 'word' }).rows[0]
    .points,
  100,
);
const upgrade = makeBackend(undefined, { setup: false });
upgrade.book
  .insertSheet('Games Players')
  .appendRow([
    'playerId',
    'codeHash',
    'name',
    'nameKey',
    'createdAt',
    'updatedAt',
  ]);
const oldSheet = upgrade.book.insertSheet('Games Results');
oldSheet.appendRow([
  'id',
  'playerId',
  'day',
  'game',
  'points',
  'win',
  'detail',
  'proofHash',
  'completedAt',
]);
oldSheet.appendRow([
  'old-id',
  'old-player',
  new Date(today + 'T12:00:00Z'),
  'word',
  100,
  true,
  'Solved',
  'hash',
  'saved',
]);
const oldRow = JSON.stringify(oldSheet.rows[1]);
upgrade.context.setupGames();
assert.equal(oldSheet.rows[0].length, 15);
assert.equal(JSON.stringify(oldSheet.rows[1]), oldRow);
upgrade.context.setupGames();
assert.equal(oldSheet.rows.length, 2);
assert.equal(
  upgrade.context.gamesLeaderboard_({
    version: 1,
    period: 'today',
    game: 'all',
  }).rows[0].points,
  100,
);
assert.equal(
  upgrade.context.gamesLeaderboard_({
    version: 2,
    period: 'today',
    game: 'all',
  }).rows.length,
  0,
);
console.log(
  'PASS: time/accuracy scoring, score bounds, failed rounds, version-separated standings, stable retries, date cells, and lossless v1 schema upgrade.',
);
// Production regression: old/partially upgraded, reordered and extra columns
// must all retain their existing cells while reads/writes use header names.
const flexible = makeBackend(undefined, { setup: false });
const flexiblePlayers=flexible.book.insertSheet('Games Players');
flexiblePlayers.appendRow(['notes','name','playerId','codeHash','createdAt','nameKey','updatedAt']);
const flexibleResults=flexible.book.insertSheet('Games Results');
flexibleResults.appendRow(['notes','game','playerId','day','id','points','win','detail','completedAt','proofHash','accuracy']);
flexibleResults.appendRow(['=KEEP()', 'word','historical',today,'old-record',95,true,'Historical','saved','hash',90]);
const preservedFlexibleRow=JSON.stringify(flexibleResults.rows[1]);
assert.equal(flexible.context.gamesLeaderboard_({version:1,period:'today',game:'all'}).rows[0].points,95);
assert.equal(flexibleResults.rows[0].length,11,'read must not mutate headers');
const flexCode='d'.repeat(48);
assert.match(flexible.post({action:'gamesJoin',name:'Morgan Rivera',code:flexCode}),/"ok":true/);
assert.equal(flexibleResults.rows[0].length,16,'a normal join safely adds missing timing headers');
assert.equal(JSON.stringify(flexibleResults.rows[1]),preservedFlexibleRow);
flexiblePlayers.rows[1][0]='=KEEP_PLAYER_NOTE()';
const flexProof=JSON.stringify({guesses:[C.puzzle('word',today).answer],elapsedMs:12000,corrections:0});
assert.match(flexible.post({action:'gamesScore',code:flexCode,day:today,game:'word',proof:flexProof,version:2}),/"ok":true/);
const flexBoard=flexible.context.gamesLeaderboard_({version:2,period:'today',game:'all'});
assert.equal(flexBoard.rows[0].name,'Morgan Rivera');
assert(flexBoard.rows[0].points>=800);
assert.match(flexible.post({action:'gamesJoin',name:'Morgan R',code:flexCode}),/"ok":true/);
assert.equal(flexiblePlayers.rows[1][0],'=KEEP_PLAYER_NOTE()');
assert.equal(JSON.stringify(flexibleResults.rows[1]),preservedFlexibleRow);
flexibleResults.rows[0].push('playerId');
const beforeDuplicate=JSON.stringify([...flexible.sheets].map(([name,s])=>[name,s.rows]));
assert.throws(()=>flexible.context.setupGames(),/Duplicate: playerId/);
assert.equal(JSON.stringify([...flexible.sheets].map(([name,s])=>[name,s.rows])),beforeDuplicate);
console.log('PASS: legacy reads, automatic additive upgrade, reordered/custom columns, formula preservation, and duplicate-header refusal.');
