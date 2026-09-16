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
assert.equal(backend.sheets.get('Results').rows.length, 2);
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
assert.equal(backend.sheets.get('Results').rows.length, 3);
assert.match(
  backend.post({ action: 'score', origin: 'https://untrusted.test', ...input }),
  /not allowed/,
);
assert.equal(
  backend.get({ action: 'leaderboard', callback: 'alert(1)' }),
  'Invalid callback',
);
assert.throws(
  () => ctx.gamesScore_({ ...input, day: '2099-01-01' }),
  /35 days/,
);
assert.throws(() => ctx.gamesScore_({ ...input, version: 2 }), /Refresh/);
// Equal point totals share a place even if the points came from different games.
const differentWins = C.rank([
  { playerId: 'a', name: 'A', day: today, game: 'word', points: 100, win: true },
  { playerId: 'b', name: 'B', day: today, game: 'kart', points: 100, win: false },
], 'today', today);
assert.deepEqual(differentWins.map(row => row.rank), [1, 1]);
console.log(
  'PASS: 120 daily sets, unique logic puzzles, all solutions, invalid proofs, deterministic kart replay, date rollover, ties, server identity, duplicate writes, restore, rename, origin and version checks.',
);
