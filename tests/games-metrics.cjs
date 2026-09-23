const assert = require('node:assert/strict');
const M = require('../assets/games/metrics.js');
const backend = require('./games-backend-fixture.cjs')();
const today = '2026-09-23';
const record = (playerId, day, points, extra = {}) => ({playerId,name:playerId,day,game:'word',points,win:points>0,version:2,elapsedMs:60000,accuracy:90,completedAt:day+'T18:00:00Z',...extra});
const rows = [record('A','2026-09-20',900),record('B','2026-09-20',900),record('A','2026-09-21',0,{win:false,elapsedMs:999000,accuracy:0}),record('B','2026-09-21',0,{win:false,accuracy:0}),record('A','2026-09-22',700,{elapsedMs:30000}),record('B','2026-09-22',800),record('A',today,1000,{elapsedMs:1000,accuracy:100})];
rows.push(record('A','2026-09-20',1000,{completedAt:'2026-09-20T19:00:00Z'})); // Duplicate: first score remains authoritative.
rows.push(record('A',today,100,{version:1}),record('A',today,1000,{game:'kart'}),record('C','2026-09-24',1000));
const data = M.build(rows,today), a = data.players.find(p=>p.playerId==='A'), b = data.players.find(p=>p.playerId==='B');
assert.equal(data.club.played,7);
assert.equal(data.club.solved,5);
assert.equal(a.dayWins,1);assert.equal(b.dayWins,2);assert.equal(a.leadingToday,true);
assert.equal(data.winners.length,2);assert.equal(data.winners[1].players.length,2);
assert.equal(a.averageMs,30333);assert.equal(a.medianMs,30000);assert.equal(a.fastestMs,1000);
assert.equal(a.currentStreak,4);assert.equal(a.bestStreak,4);assert.equal(a.points,2600);assert.equal(a.accuracy,70);
assert.equal(a.daily.length,30);assert.equal(a.daily[29].played,1);assert.equal(a.games[0].played,4);
assert.equal(M.streak(['2026-09-21','2026-09-22'],today).currentStreak,2);
assert.equal(M.streak(['2026-09-20','2026-09-21'],today).currentStreak,0);
assert.equal(M.build([],today).club.medianMs,null);
assert.equal(M.build([record('A',today,0,{win:false})],today).club.averageMs,null);
assert.equal(M.stats([record('A',today,900,{elapsedMs:1000}),record('B',today,900,{elapsedMs:3000})]).medianMs,2000);
assert.equal(M.shift('2026-03-09',-1),'2026-03-08');
assert.equal(M.nameKey(' JORDAN   Lee '),'jordan lee');
assert.equal(M.nameKey('Jose\u0301'),M.nameKey('José'));
// Existing code-based players keep IDs, custom cells, and results. Same-name
// aliases are resolved at read time, without rewriting historical rows.
const ctx=backend.context, day=ctx.gamesDay_();
ctx.gamesWrite_('Players',{playerId:'old-a',codeHash:'old-hash',name:'Jordan Lee',nameKey:'jordan lee',createdAt:'old',updatedAt:'old'});
ctx.gamesWrite_('Players',{playerId:'old-b',codeHash:'other-hash',name:' JORDAN  LEE ',nameKey:' JORDAN  LEE ',createdAt:'old',updatedAt:'old'});
ctx.gamesWrite_('Results',{id:'legacy',...record('old-a',day,900,{completedAt:new Date(day+'T18:00:00Z')})});
ctx.gamesWrite_('Results',{id:'alias',...record('old-b',day,990,{completedAt:day+'T19:00:00Z'})});
const before=JSON.stringify([...backend.sheets].map(([name,s])=>[name,s.rows]));
const player=ctx.gamesJoin_({name:'jordan lee'});
assert.equal(player.playerId,'old-a');assert.equal(player.results.length,1);assert.equal(player.results[0].points,900);
assert.equal(JSON.stringify([...backend.sheets].map(([name,s])=>[name,s.rows])),before);
assert.equal(ctx.gamesLeaderboard_({version:2}).rows[0].points,900);
assert.equal(ctx.gamesInsights_({name:'JORDAN LEE'}).player.points,900);
assert.equal(ctx.gamesInsights_({name:'Nobody Yet'}).player,null);
assert.equal(ctx.gamesInsights_({name:'JORDAN LEE'}).players.length,1);
const C=require('../assets/games/core.js');
assert.equal(ctx.gamesScore_({name:'jordan lee',day,game:'word',version:2,proof:JSON.stringify({guesses:[C.puzzle('word',day).answer],elapsedMs:1000,corrections:0})}).record.points,900);
assert.equal(backend.sheets.get('Games Results').rows.length,3);
assert.match(backend.get({action:'gamesInsights',name:'Jordan Lee'}),/"identityMode":"name"/);
assert.equal(backend.get({action:'gamesInsights',callback:'bad()'}),'Invalid callback');
console.log('PASS: name migration, alias deduplication, first attempts, shared daily wins, provisional today, zero-score days, solve-only timing, medians, streaks, season isolation, and empty history.');
// Chunked snapshots stay below CacheService's byte limit and recover from
// partial eviction. Successful writes invalidate completed-day winners too.
const cache=b=>({get:k=>b.cache.get(k),put:(k,v)=>b.cache.set(k,v),putAll:v=>Object.entries(v).forEach(([k,v])=>b.cache.set(k,v))});
const large={text:'𐐀'.repeat(80000)};
ctx.gamesCacheSnapshot_(cache(backend),'test-large',large);
const keys=JSON.parse(backend.cache.get('test-large')).chunks;
assert(keys.length>1);
keys.forEach(key=>assert(Buffer.byteLength(backend.cache.get(key),'utf8')<100000));
assert.equal(ctx.gamesReadSnapshot_(cache(backend),'test-large').text,large.text);
backend.cache.delete(keys[1]);assert.equal(ctx.gamesReadSnapshot_(cache(backend),'test-large'),null);
const oldDay=M.shift(day,-1);
ctx.gamesJoin_({name:'Late Finisher'});
ctx.gamesScore_({name:'Late Finisher',day:oldDay,game:'word',version:2,proof:JSON.stringify({guesses:[C.puzzle('word',oldDay).answer],elapsedMs:5000,corrections:0})});
assert.equal(ctx.gamesInsights_({name:'Late Finisher'}).player.dayWins,1);
console.log('PASS: bounded cache chunks, Unicode round-trip, eviction fallback, and late-sync daily wins.');
// A read started before a score save must not republish stale cached stats.
for(const action of ['gamesInsights_','gamesLeaderboard_']) {
 const race=require('./games-backend-fixture.cjs')(), r=race.context;
 const person=r.gamesJoin_({name:'Overlap Player'});
 const original=r.gamesRecords_;
 r.gamesRecords_=people=>{
  const old=original(people);
  r.gamesRecords_=original;
  r.gamesWrite_('Results',{id:'overlap',...record(person.playerId,day,950)});
  r.gamesInvalidate_();
  return old;
 };
 r[action]({name:'Overlap Player',version:2});
 const fresh=r[action]({name:'Overlap Player',version:2});
 assert.equal(action==='gamesInsights_'?fresh.player.points:fresh.rows[0].points,950);
}
console.log('PASS: overlapping score saves cannot republish stale analytics or standings.');
