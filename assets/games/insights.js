(() => {
  'use strict';
  const S = window.SFGamesService, C = window.SFGames, M = window.SFGamesMetrics;
  const $ = s => document.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = n => Number(n || 0).toLocaleString();
  function time(ms) {
    if (ms == null) return '—';
    const seconds = Math.round(ms / 1000);
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
  const date = day => new Date(day + 'T12:00:00').toLocaleDateString('en-US', {month:'short', day:'numeric'});
  const gameName = id => C.GAMES.find(g => g.id === id)?.name || id;
  function metric(label, value, note, primary = false) {
    return `<article class="games-stat-kpi${primary ? ' games-stat-primary' : ''}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`;
  }
  function panel(title, subtitle, body, extra = '') {
    return `<article class="games-stat-panel ${extra}"><header><h3>${esc(title)}</h3><p>${esc(subtitle)}</p></header>${body}</article>`;
  }
  function empty(text) { return `<p class="games-stat-empty">${esc(text)}</p>`; }
  function chart(rows, field, label, type = 'bars') {
    const timed = field.endsWith('Ms'), format = timed ? time : number;
    const values = rows.map(r => r[field]);
    if (!values.some(n => n != null && n > 0)) return empty('No ranked activity in the last 30 days yet.');
    const max = Math.max(1, ...values.filter(n => n != null));
    let drawing;
    if (type === 'line') {
      const x = i => 8 + i * 584 / Math.max(1, rows.length - 1), y = v => 148 - v / max * 132;
      const points = rows.flatMap((r, i) => r[field] == null ? [] : [{ x:x(i), y:y(r[field]), i }]);
      // Missing days are gaps, not zero-second solves or invented data points.
      const segments = points.map((p, i) => `${i && p.i === points[i-1].i + 1 ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
      drawing = `<svg viewBox="0 0 600 164" preserveAspectRatio="none" aria-hidden="true"><path class="games-stat-gridline" d="M0 16H600 M0 82H600 M0 148H600"/><path class="games-stat-trend" d="${segments}"/>${points.map(p => `<circle class="games-stat-dot" cx="${p.x}" cy="${p.y}" r="4"/>`).join('')}</svg>`;
    } else {
      drawing = `<div class="games-stat-bars" aria-hidden="true">${rows.map(r => `<span style="--bar:${r[field] / max * 100}%" class="${r[field] ? 'has-activity' : ''}"></span>`).join('')}</div>`;
    }
    return `<figure class="games-stat-chart"><figcaption>${esc(label)} <strong>Peak ${esc(format(max))}</strong></figcaption><div class="games-stat-plot">${drawing}</div><div class="games-stat-axis"><span>${date(rows[0].day)}</span><span>${date(rows[Math.floor(rows.length/2)].day)}</span><span>${date(rows[rows.length-1].day)}</span></div><details class="chart-data"><summary>View daily values</summary><table><caption>${esc(label)} · last 30 days</caption><thead><tr><th scope="col">Date</th><th scope="col">${esc(label)}</th></tr></thead><tbody>${rows.slice().reverse().map(r => `<tr><th scope="row">${date(r.day)}</th><td>${r[field] == null ? '—' : esc(format(r[field]))}</td></tr>`).join('')}</tbody></table></details></figure>`;
  }
  function gameBars(games) {
    const max = Math.max(1, ...games.map(g => g.played));
    return `<div class="games-stat-game-bars">${games.map(g => `<div><div class="games-stat-bar-heading"><strong>${esc(gameName(g.game))}</strong><span>${number(g.played)} played</span></div><div class="games-stat-track"><i style="width:${g.played / max * 100}%"></i></div><p>${g.played ? `${g.solveRate}% solved · ${time(g.medianMs)} median solve` : 'Waiting for the first result'}</p></div>`).join('')}</div>`;
  }
  function renderClub(data) {
    const c = data.club;
    $('#clubStats').innerHTML = `<p class="games-stat-scope">Club totals · all time in the timed scoring season</p><div class="games-stat-kpis club-kpis">${metric('Players',number(c.players),'With a ranked result',true)}${metric('Puzzles played',number(c.played),`${number(c.solved)} solved`)}${metric('Solve rate',c.solveRate == null ? '—' : c.solveRate + '%','Solved ÷ ranked attempts')}${metric('Median solve',time(c.medianMs),`${number(c.timedSolves)} timed solves`)}</div><div class="games-stat-grid">${panel('The daily pulse','Distinct players per day · last 30 days',chart(data.daily,'players','Daily players'))}${panel('What we’re playing','All six games · all-time ranked attempts',gameBars(data.games))}</div><div class="games-stat-grid">${panel('Day-win leaders','Most completed days at the top · all time',data.champions.length ? `<ol class="games-stat-champions">${data.champions.map(p => `<li><button type="button" data-spotlight="${esc(p.name)}">${esc(p.name)}</button><strong>${number(p.dayWins)}<small> day win${p.dayWins === 1 ? '' : 's'}</small></strong></li>`).join('')}</ol>` : empty('The first day winner will appear after midnight in Indianapolis.'))}${panel('Recent daily winners','Combined points across six games · ties shared',data.winners.length ? `<ul class="games-stat-winners">${data.winners.map(w => `<li><span>${date(w.day)}</span><div>${w.players.map(p => `<button type="button" data-spotlight="${esc(p.name)}">${esc(p.name)}</button>`).join('')}<small>${number(w.points)} points${w.players.length > 1 ? ' · shared win' : ''}</small></div></li>`).join('')}</ul>` : empty('Today is still in play. Completed-day winners appear here.'))}</div>`;
  }
  function heatmap(rows) {
    return `<div class="games-stat-heatmap" role="img" aria-label="${rows.filter(r=>r.played).length} active days in the last 30 days">${rows.map(r => `<span data-level="${r.played === 0 ? 0 : r.played < 3 ? 1 : r.played < 6 ? 2 : 3}" title="${date(r.day)}: ${r.played} played" aria-hidden="true">${Number(r.day.slice(-2))}</span>`).join('')}</div><p class="games-stat-legend"><span>Last 30 days</span><span>Empty → all six played</span></p>`;
  }
  function renderPlayer(data, name) {
    const p = data.player;
    $('#playerStatsTitle').textContent = p?.name || name || 'Your game, in focus';
    if (!p) {
      $('#playerMetrics').innerHTML = empty('Play and sync your first daily puzzle to start your player stats.');
      return;
    }
    $('#playerMetrics').innerHTML = `${p.leadingToday ? '<p class="games-stat-leading">Leading today · the day is still in play</p>' : ''}<div class="games-stat-kpis player-kpis">${metric('Day wins',number(p.dayWins),'Completed days · ties shared',true)}${metric('Total points',number(p.points),`${number(p.played)} ranked attempts`)}${metric('Average solve',time(p.averageMs),`${number(p.timedSolves)} solved with a timer`)}${metric('Accuracy',p.accuracy == null ? '—' : p.accuracy+'%','Average of all ranked attempts')}${metric('Current streak',number(p.currentStreak),`Best: ${number(p.bestStreak)} days`)}${metric('Perfect solves',number(p.perfect),'Solved at 100% accuracy')}</div><div class="games-stat-records"><span>Best day <strong>${number(p.bestDay)} pts</strong></span><span>Fastest solve <strong>${time(p.fastestMs)}</strong></span><span>Median solve <strong>${time(p.medianMs)}</strong></span><span>Solve rate <strong>${p.solveRate}%</strong></span></div><div class="games-stat-grid">${panel('Points on the board','Daily total · last 30 days',chart(p.daily,'points','Daily points'))}${panel('Finding your pace','Average solve time by day · solved puzzles only',chart(p.daily,'averageMs','Average solve time','line'))}</div><div class="games-stat-grid">${panel('Your game breakdown','All-time results · compare times within each game',`<div class="games-stat-game-cards">${p.games.map(g => `<article><h4>${esc(gameName(g.game))}</h4><dl><div><dt>Solved</dt><dd>${g.solved} / ${g.played}</dd></div><div><dt>Avg time</dt><dd>${time(g.averageMs)}</dd></div><div><dt>Best time</dt><dd>${time(g.fastestMs)}</dd></div><div><dt>Accuracy</dt><dd>${g.accuracy == null ? '—' : g.accuracy+'%'}</dd></div></dl></article>`).join('')}</div>`)}${panel('Keep showing up',`${p.activeDays} active days all time · ${p.solved} puzzles solved`,heatmap(p.daily) + `<p class="games-stat-footnote">Each square is a day. Darker fill means more of the six daily puzzles played. Open “View daily values” above for exact dates and points.</p>`)}</div>`;
  }
  let selected = '', requestId = 0;
  async function refresh(force = false) {
    const id = ++requestId;
    const name = selected || window.SponsorFlowIdentity.name;
    if (!S.configured()) { $('#insightsStatus').textContent = 'Stats will appear when club rankings are connected.'; return; }
    $('#insightsStatus').textContent = 'Loading player stats…';
    try {
      const data = await S.insights(name, force);
      if (id !== requestId) return;
      const names = data.players.map(p => p.name);
      if (name && !names.some(n => M.nameKey(n) === M.nameKey(name))) names.push(name);
      const select = $('#insightsPlayer');
      select.innerHTML = names.sort((a,b)=>a.localeCompare(b)).map(n => `<option value="${esc(n)}">${esc(n)}${M.nameKey(n) === M.nameKey(window.SponsorFlowIdentity.name) ? ' · You' : ''}</option>`).join('');
      select.value = names.find(n => M.nameKey(n) === M.nameKey(name)) || '';
      renderClub(data); renderPlayer(data, name);
      $('#insightsStatus').textContent = `Synced results · updated ${new Date(data.updatedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}`;
    } catch (error) {
      if (id === requestId) $('#insightsStatus').textContent = `Stats could not refresh. ${error.message}`;
    }
  }
  $('#insightsPlayer').onchange = event => { selected = event.target.value; refresh(); };
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-spotlight]');
    if (!button) return;
    selected = button.dataset.spotlight; refresh();
    $('#playerStats').scrollIntoView({behavior:'smooth',block:'start'});
  });
  window.addEventListener('sponsorflow:identity', () => { selected = ''; refresh(); });
  window.SFGamesInsights = { refresh };
  window.SponsorFlowIdentity.ready.then(() => refresh());
})();
