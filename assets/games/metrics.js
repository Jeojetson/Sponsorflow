(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SFGamesMetrics = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  /* GAME_METRICS_START */
  const GAME_IDS = ['word', 'groups', 'queens', 'binary', 'path', 'numbers'];
  const nameKey = value => String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
  function shift(day, amount) {
    const date = new Date(day + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
  }
  // First accepted attempt counts, including when historical same-name IDs
  // resolve to one person. Never give duplicate daily attempts extra weight.
  function records(input, day) {
    const seen = new Set();
    return input.filter(r => r.playerId && r.version === 2 && GAME_IDS.includes(r.game) &&
      /^\d{4}-\d{2}-\d{2}$/.test(r.day) && r.day <= day && Number.isFinite(r.points) && r.points >= 0 && r.points <= 1000)
      .slice().sort((a, b) => String(a.completedAt || '').localeCompare(String(b.completedAt || '')))
      .filter(r => { const key = `${r.playerId}:${r.day}:${r.game}`; if (seen.has(key)) return false; seen.add(key); return true; });
  }
  function stats(rows) {
    const solved = rows.filter(r => r.win === true);
    const times = solved.map(r => r.elapsedMs).filter(v => Number.isFinite(v) && v >= 1000).sort((a, b) => a - b);
    const accuracies = rows.map(r => r.accuracy).filter(v => Number.isFinite(v) && v >= 0 && v <= 100);
    const middle = Math.floor(times.length / 2);
    return {
      played: rows.length, solved: solved.length, points: rows.reduce((s, r) => s + r.points, 0),
      solveRate: rows.length ? Math.round(solved.length / rows.length * 100) : null,
      accuracy: accuracies.length ? Math.round(accuracies.reduce((s, n) => s + n, 0) / accuracies.length) : null,
      averageMs: times.length ? Math.round(times.reduce((s, n) => s + n, 0) / times.length) : null,
      medianMs: times.length ? Math.round(times.length % 2 ? times[middle] : (times[middle - 1] + times[middle]) / 2) : null,
      fastestMs: times.length ? times[0] : null,
      timedSolves: times.length,
      perfect: rows.filter(r => r.win && r.accuracy === 100).length,
      activeDays: new Set(rows.map(r => r.day)).size,
      players: new Set(rows.map(r => r.playerId)).size,
    };
  }
  function streak(days, today) {
    const unique = [...new Set(days)].sort();
    let best = 0, count = 0, previous = '';
    for (const day of unique) {
      count = previous && shift(previous, 1) === day ? count + 1 : 1;
      best = Math.max(best, count); previous = day;
    }
    const set = new Set(unique);
    let cursor = set.has(today) ? today : shift(today, -1), current = 0;
    while (set.has(cursor)) { current++; cursor = shift(cursor, -1); }
    return { currentStreak: current, bestStreak: best };
  }
  function build(input, today) {
    const clean = records(input, today), byPlayer = new Map(), byDay = new Map();
    for (const r of clean) {
      if (!byPlayer.has(r.playerId)) byPlayer.set(r.playerId, []);
      byPlayer.get(r.playerId).push(r);
      if (!byDay.has(r.day)) byDay.set(r.day, new Map());
      const totals = byDay.get(r.day);
      totals.set(r.playerId, (totals.get(r.playerId) || 0) + r.points);
    }
    const wins = new Map(), winners = [], todayLeaders = [];
    for (const [day, totals] of byDay) {
      const top = Math.max(...totals.values());
      if (top <= 0) continue;
      const ids = [...totals].filter(([, points]) => points === top).map(([id]) => id);
      if (day === today) { todayLeaders.push(...ids); continue; }
      ids.forEach(id => wins.set(id, (wins.get(id) || 0) + 1));
      winners.push({ day, points: top, players: ids.map(id => ({ playerId: id, name: byPlayer.get(id)[0].name })) });
    }
    const days = Array.from({ length: 30 }, (_, i) => shift(today, i - 29));
    function series(rows) {
      const groups = new Map();
      rows.forEach(r => { if (!groups.has(r.day)) groups.set(r.day, []); groups.get(r.day).push(r); });
      return days.map(day => {
        const s = stats(groups.get(day) || []);
        return { day, played: s.played, points: s.points, players: s.players, averageMs: s.averageMs };
      });
    }
    function games(rows) {
      return GAME_IDS.map(game => ({ game, ...stats(rows.filter(r => r.game === game)) }));
    }
    const players = [...byPlayer].map(([playerId, rows]) => ({
      playerId, name: rows[0].name, ...stats(rows), ...streak(rows.map(r => r.day), today),
      dayWins: wins.get(playerId) || 0, leadingToday: todayLeaders.includes(playerId),
      bestDay: Math.max(...[...byDay.values()].map(totals => totals.get(playerId) || 0)),
      games: games(rows), daily: series(rows),
    })).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
    return { day: today, windowDays: 30, club: stats(clean), daily: series(clean), games: games(clean), players,
      winners: winners.sort((a, b) => b.day.localeCompare(a.day)).slice(0, 7) };
  }
  return { nameKey, shift, records, stats, streak, build };
  /* GAME_METRICS_END */
});
