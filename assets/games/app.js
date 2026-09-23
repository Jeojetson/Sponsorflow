(() => {
  'use strict';
  const C = window.SFGames,
    S = window.SFGamesService,
    $ = (s) => document.querySelector(s);
  const esc = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c],
    );
  const symbols = {
    word: '<span class="mini-word">K A R T S</span>',
    groups: '<span class="mini-groups"><i></i><i></i><i></i><i></i></span>',
    queens: '♛',
    binary: '☀ ◐',
    path: '<svg viewBox="0 0 100 65" aria-hidden="true"><path d="M15 15H85V50H15V32H62"/><circle cx="15" cy="15" r="6"/><circle cx="62" cy="32" r="6"/></svg>',
    numbers: '<span class="mini-numbers">8 × 4<br><small>+ 12</small></span>',
  };
  const rules = {
    word: [
      'Guess the five-letter word in six tries. Enter a word with the on-screen keyboard or your keyboard.',
      'A filled gold tile means the right letter in the right place. Blue means the letter is elsewhere. A gray tile means it is not needed. Letters are matched only as many times as they occur.',
      'Up to 1,000 points: accuracy contributes up to 800, speed up to 200. Each extra valid guess reduces accuracy by 10 percentage points. Today’s first result counts.',
    ],
    groups: [
      'Select four words that share a connection, then submit your group. Find all four groups.',
      'Four incorrect groups end the daily puzzle. Each correct group is removed from the board.',
      'Each incorrect group reduces accuracy by 10 percentage points. Speed adds up to 200 points to the accuracy score. Shuffle only changes the word order.',
    ],
    queens: [
      'Place exactly one crown in each row, column, and colored region. Crowns cannot touch, including diagonally.',
      'Tap a square to place or remove a crown. Use the Mark × tool to rule out squares. Region letters and thick borders also identify each region.',
      'Check your grid when ready. Up to 1,000 points for accuracy and speed. Failed checks, undo, and reset each count as a correction.',
    ],
    binary: [
      'Fill each empty square with a sun or a moon. Each row and column needs three of each.',
      'Never place three identical symbols in a row, horizontally or vertically. No two complete rows or columns may match. Locked squares are clues.',
      'Tap to cycle empty → sun → moon → empty. Up to 1,000 points for accuracy and speed. Failed checks, undo, and reset each count as a correction.',
    ],
    path: [
      'Start at checkpoint 1. Draw one continuous path through every square, visiting numbered checkpoints in order and finishing at 5.',
      'Move horizontally or vertically. Tap squares or drag through them. Tap an earlier square to backtrack. Arrow keys extend a route when the grid is focused.',
      'Every square must be visited once. Up to 1,000 points for accuracy and speed. Backtracking, undo, and reset each count as a correction.',
    ],
    numbers: [
      'Combine all four numbers to make the target. Tap a number, an operator, then another number. The two numbers become one.',
      'Use +, −, ×, or ÷. Intermediate answers must be whole numbers and cannot be negative. Order matters for subtraction and division.',
      'Undo a step or reset whenever you need. Earn up to 1,000 points for accuracy and speed. Undo and reset count as corrections.',
    ],
  };
  let day = C.dayKey(),
    category = 'All',
    period = 'today',
    boardGame = 'all',
    current = null,
    boardRequest = 0;
  function message(text, tone = '') {
    const host = $('#gameMessage');
    host.textContent = text;
    host.dataset.tone = tone;
  }
  function notifyService(text) {
    $('#gamesServiceStatus').textContent = text;
  }
  function dailyResults() {
    return S.data.results.filter(
      (r) =>
        r.day === day &&
        r.version === C.SCORING_VERSION &&
        C.GAMES.some((game) => game.id === r.game),
    );
  }
  function renderHub() {
    $('#gamesDate').textContent = new Date(
      day + 'T12:00:00',
    ).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    const results = dailyResults();
    $('#gamesDailyProgress').textContent =
      `${results.length} of 6 played today · ${results.reduce((sum, r) => sum + r.points, 0)} points`;
    $('#gameCatalog').innerHTML = C.GAMES.filter(
      (g) =>
        category === 'All' ||
        g.kind === category ||
        (category === 'Logic' && g.kind === 'Numbers'),
    )
      .map((g) => {
        const result = S.result(day, g.id),
          run = S.getRun(day, g.id);
        return `<button class="game-card game-card-${g.id}" type="button" data-play="${g.id}"><span class="game-art" aria-hidden="true">${symbols[g.icon]}</span><span class="game-card-copy"><span class="game-card-meta">${g.kind} <span>· ${g.minutes}</span></span><strong>${g.name}</strong><span>${g.description}</span><span class="game-card-footer">${result ? `<b>${result.points} points</b><span>${result.synced ? 'On leaderboard' : 'Saved on device'} ↗</span>` : `<b>${run ? 'Continue' : 'Play today'}</b><span>↗</span>`}</span></span></button>`;
      })
      .join('');
    $('#gamesProfileOpen').textContent = S.data.profile
      ? S.data.profile.name + ' · Change name'
      : 'Your name';
  }
  function renderBoard(rows) {
    $('#leaderboardRows').innerHTML = rows?.length
      ? `<div class="leaderboard-table" role="table" aria-label="Club rankings"><div class="leaderboard-row leaderboard-head" role="row"><span role="columnheader">Rank</span><span role="columnheader">Player</span><span role="columnheader">Played</span><span role="columnheader">Points</span></div>${rows.map((r) => `<div class="leaderboard-row${r.playerId === S.data.profile?.playerId ? ' is-you' : ''}" role="row"><span role="cell" class="rank-cell"><small class="mobile-label">Rank </small>${r.rank}</span><strong role="cell" class="player-cell">${esc(r.name)}${r.playerId === S.data.profile?.playerId ? '<small> You</small>' : ''}</strong><span role="cell" class="played-cell">${r.played}<small class="mobile-label"> played</small></span><b role="cell" class="points-cell">${r.points.toLocaleString()}<small class="mobile-label"> points</small></b></div>`).join('')}</div>`
      : '<div class="games-empty"><strong>No scores yet.</strong><p>Complete a daily game to post the first score in this view.</p></div>';
  }
  async function loadBoard(force = false) {
    const request = ++boardRequest;
    $('#leaderboardRefresh').disabled = true;
    if (!S.configured()) {
      $('#leaderboardRows').innerHTML =
        '<div class="games-empty"><strong>Club rankings are coming soon.</strong><p>You can play every game now. Your progress and results stay saved on this device until the club leaderboard opens.</p></div>';
      notifyService('');
      $('#leaderboardRefresh').disabled = false;
      return;
    }
    notifyService('Loading club standings…');
    try {
      const board = await S.leaderboard(period, boardGame, force === true);
      if (request !== boardRequest) return;
      renderBoard(board.rows);
      notifyService(
        'Updated ' +
          new Date(board.savedAt).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          }),
      );
    } catch (e) {
      if (request !== boardRequest) return;
      const cache = S.data.board;
      if (
        cache?.version === C.SCORING_VERSION &&
        cache?.period === period &&
        cache?.game === boardGame
      ) {
        renderBoard(cache.rows);
        notifyService(
          `Showing saved standings from ${new Date(cache.savedAt).toLocaleString()}. ${e.message}`,
        );
      } else {
        $('#leaderboardRows').innerHTML = '';
        notifyService(e.message);
      }
    } finally {
      if (request === boardRequest) $('#leaderboardRefresh').disabled = false;
    }
  }
  function freshRun(id, p) {
    switch (id) {
      case 'word':
        return { guesses: [], input: '' };
      case 'groups':
        return { attempts: [], selected: [], order: p.words.slice() };
      case 'queens':
        return { cells: Array(36).fill(0), mode: 'crown' };
      case 'binary':
        return { cells: p.givens.slice() };
      case 'path':
        return { cells: [] };
      case 'numbers':
        return {
          values: p.numbers.map((value, tree) => ({ value, tree })),
          history: [],
          selected: -1,
          operator: '',
        };
    }
  }
  function persist() {
    if (current && !current.practice)
      S.saveRun(current.day, current.id, current.run);
  }
  function openGame(id, practice = false) {
    const game = C.GAMES.find((g) => g.id === id);
    if (!game) return;
    const seedDay = practice ? day + ':practice:' + Date.now() : day;
    const p = C.puzzle(id, seedDay);
    const run = (!practice && S.getRun(day, id)) || {
      ...freshRun(id, p),
      startedAt: Date.now(),
      corrections: 0,
      scoringVersion: C.SCORING_VERSION,
    };
    current = {
      id,
      game,
      puzzle: p,
      run,
      practice,
      day,
      seedDay,
      result: practice ? null : S.result(day, id),
    };
    document.body.classList.add('game-playing');
    document.body.dataset.game = id;
    $('#gamesHub').hidden = true;
    $('#gamePlayer').hidden = false;
    $('#gameKind').textContent = game.kind;
    $('#gameTitle').textContent = game.name;
    $('#gameDailyLabel').textContent = practice
      ? 'Practice · unranked'
      : new Date(day + 'T12:00:00').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }) + ' · Daily';
    $('#gameDescription').textContent = game.description;
    $('#gamePoints').textContent = practice
      ? 'Practice'
      : current.result
        ? current.result.points + ' points'
        : 'Up to 1,000 points';
    $('#gameResult').hidden = true;
    $('#gameReset').hidden = ['word', 'groups'].includes(id);
    $('#gamePractice').hidden = practice;
    message('');
    renderGame();
    if (current.result) showResult(current.result);
    $('#gameTitle').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
    persist();
    updateTimer();
    if (!practice) history.replaceState(null, '', '#' + id);
  }
  function back() {
    persist();
    current = null;
    document.body.classList.remove('game-playing');
    delete document.body.dataset.game;
    $('#gamesHub').hidden = false;
    $('#gamePlayer').hidden = true;
    history.replaceState(null, '', location.pathname);
    renderHub();
    loadBoard();
    $('#gamesHub h1').setAttribute('tabindex', '-1');
    $('#gamesHub h1').focus({ preventScroll: true });
  }
  function finish(proof) {
    if (!current) return;
    try {
      proof = {
        ...proof,
        elapsedMs: Math.max(1000, Date.now() - current.run.startedAt),
        corrections: current.run.corrections || 0,
      };
      const outcome = C.scoreTimed(current.id, current.puzzle, proof);
      const record = {
        ...outcome,
        day: current.day,
        game: current.id,
        proof,
        completedAt: new Date().toISOString(),
      };
      if (!current.practice) {
        S.saveResult(record);
        current.result = record;
        persist();
      } else current.result = record;
      renderGame();
      showResult(record);
      if (!current.practice && S.data.profile) {
        syncResults();
      }
    } catch (e) {
      current.run.corrections = (current.run.corrections || 0) + 1;
      persist();
      updateTimer();
      message(e.message, 'error');
    }
  }
  function showResult(result) {
    const host = $('#gameResult');
    host.hidden = false;
    const synced = result.synced === true;
    host.innerHTML = `<p class="eyebrow">${current.practice ? 'Practice complete' : result.win ? 'Solved' : 'Today’s result'}</p><h2>${result.win ? 'Challenge complete.' : 'A fresh puzzle tomorrow.'}</h2><p>${esc(result.detail)}${current.id === 'word' ? ` · The word was <strong>${current.puzzle.answer}</strong>.` : ''}</p><div class="score-breakdown"><span><strong>${result.points}</strong>points</span><span><strong>${result.accuracy}%</strong>accuracy</span><span><strong>${Math.floor(result.elapsedMs / 60000)}:${String(Math.floor(result.elapsedMs / 1000) % 60).padStart(2, '0')}</strong>time</span></div><p>${result.accuracyPoints} accuracy points + ${result.speedPoints} speed points.</p><p class="score-sync">${current.practice ? 'Practice is unranked.' : synced ? 'Synced to the club leaderboard.' : S.data.profile ? 'Saved on this device · waiting to sync.' : 'Saved on this device. Join rankings to share your result.'}</p><div class="result-actions"><button class="button button-primary" type="button" data-result-action="next">More games</button><button class="button button-secondary" type="button" data-result-action="share">Copy result</button>${!S.data.profile && !current.practice ? '<button class="button button-ghost" type="button" data-result-action="join">Join rankings</button>' : ''}</div>`;
    updateTimer();
    $('#gamePoints').textContent = result.points + ' points';
    $('#gameReset').hidden = true;
    message('');
  }
  let syncingUi = null, syncAgain = false;
  function syncResults() {
    if (syncingUi) { syncAgain = true; return syncingUi; }
    syncingUi = (async () => {
      do {
        syncAgain = false;
        await syncPlayerResults();
      } while (syncAgain);
    })().finally(() => { syncingUi = null; });
    return syncingUi;
  }
  async function syncPlayerResults() {
    const status = $('#gamesSyncStatus');
    $('#gamesSyncButton').disabled = true;
    try {
      if (!S.data.profile || window.SFGamesMetrics.nameKey(S.data.ownerName) !== window.SFGamesMetrics.nameKey(window.SponsorFlowIdentity.name)) {
        status.textContent = 'Connecting your player…';
        await S.join(window.SponsorFlowIdentity.name);
        renderHub();
      }
      status.textContent = S.data.pending.length ? `Syncing ${S.data.pending.length} result(s)…` : 'Your player is connected.';
      const result = await S.sync();
      status.textContent = result.pending
        ? `${result.pending} result(s) saved on this device and waiting to sync. ${result.errors?.[0]?.message || ''}`
        : S.data.results.some(r => r.synced && r.version === C.SCORING_VERSION)
          ? 'Your saved scores are synced to the club.'
          : 'Ready. Complete a daily game to post your first score.';
      renderHub();
      if (current?.result && !current.practice) {
        current.result = S.result(current.day, current.id) || current.result;
        showResult(current.result);
      }
    } catch (error) {
      status.textContent = error.message + (S.data.pending.length ? ` ${S.data.pending.length} result(s) saved on this device.` : '');
    } finally {
      $('#gamesSyncButton').disabled = !S.configured();
      // Standings remain available even when one player's upload is rejected.
      await Promise.all([loadBoard(true), window.SFGamesInsights?.refresh(true)]);
    }
  }
  let connecting = 0;
  async function connectPlayer() {
    const request = ++connecting;
    if (!S.configured()) { loadBoard(); return; }
    try {
      await S.join(window.SponsorFlowIdentity.name);
      if (request !== connecting) return;
      renderHub();
      if (current && !current.practice) {
        const saved = S.result(current.day, current.id);
        if (saved) { current.result = saved; showResult(saved); }
      }
      if (S.data.pending.length) await syncResults();
      else {
        $('#gamesSyncStatus').textContent = S.data.results.length ? 'Your saved scores are synced to the club.' : 'Ready. Complete a daily game to post your first score.';
        await Promise.all([loadBoard(), window.SFGamesInsights?.refresh()]);
      }
    } catch (error) {
      if (request !== connecting) return;
      $('#gamesSyncStatus').textContent = error.message;
      $('#gamesSyncButton').disabled = false;
      renderHub();
    }
  }

  function updateTimer() {
    if (!current) return;
    const ms =
      current.result?.elapsedMs ||
      Math.max(0, Date.now() - current.run.startedAt);
    const seconds = Math.floor(ms / 1000);
    $('#gameTimer').textContent =
      Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    const count =
      current.id === 'word'
        ? current.run.guesses.filter((guess) => guess !== current.puzzle.answer)
            .length
        : current.id === 'groups'
          ? current.run.attempts.filter(
              (attempt) =>
                !current.puzzle.groups.some((group) =>
                  attempt.every((word) => group.words.includes(word)),
                ),
            ).length
          : current.run.corrections || 0;
    $('#gameCorrections').textContent = current.result?.mistakes ?? count;
  }
  setInterval(updateTimer, 500);
  function button(label, action, extra = '') {
    return `<button class="button button-secondary" type="button" data-game-action="${action}" ${extra}>${label}</button>`;
  }
  function renderGame() {
    const { id, puzzle: p, run: r, result } = current;
    const done = !!result;
    const host = $('#gameStage');
    if (id === 'word') {
      const marks = {};
      for (const g of r.guesses) {
        C.wordMarks(g, p.answer).forEach(
          (m, i) => (marks[g[i]] = Math.max(marks[g[i]] ?? -1, m)),
        );
      }
      host.innerHTML = `<div class="word-board" role="group" aria-label="Word guesses">${Array.from(
        { length: 6 },
        (_, row) => {
          const word =
            r.guesses[row] ||
            (row === r.guesses.length && !done ? r.input : '');
          const grade = r.guesses[row] ? C.wordMarks(word, p.answer) : null;
          return `<div class="word-row" aria-label="Guess ${row + 1}${word ? ': ' + word : ''}">${Array.from({ length: 5 }, (_, col) => `<span class="word-tile${grade ? ' mark-' + grade[col] : word[col] ? ' has-letter' : ''}"${grade ? ' aria-label="' + word[col] + ': ' + ['absent', 'elsewhere', 'correct'][grade[col]] + '"' : ''}>${word[col] || ''}</span>`).join('')}</div>`;
        },
      ).join(
        '',
      )}</div><div class="word-legend"><span><i class="mark-2"></i>Right place</span><span><i class="mark-1"></i>Elsewhere</span><span><i class="mark-0"></i>Absent</span></div><div class="word-keyboard" aria-label="Letter keyboard">${['QWERTYUIOP', 'ASDFGHJKL', '↵ZXCVBNM⌫'].map((row) => `<div>${[...row].map((k) => `<button type="button" data-letter="${k}" class="${['↵', '⌫'].includes(k) ? 'wide ' : ''}${marks[k] !== undefined ? 'mark-' + marks[k] : ''}" aria-label="${k === '↵' ? 'Enter guess' : k === '⌫' ? 'Delete letter' : k}"${done ? ' disabled' : ''}>${k === '↵' ? 'Enter' : k}</button>`).join('')}</div>`).join('')}</div>`;
    }
    if (id === 'groups') {
      const solved = [],
        mistakes = [];
      for (const a of r.attempts) {
        const index = p.groups.findIndex((g) =>
          a.every((w) => g.words.includes(w)),
        );
        if (index >= 0) solved.push(index);
        else mistakes.push(a);
      }
      const revealed = done ? p.groups.map((_, i) => i) : solved;
      host.innerHTML = `<div class="group-solved">${revealed.map((i) => `<div class="solved-group region-${i}"><strong>${esc(p.groups[i].title)}</strong><span>${p.groups[i].words.map(esc).join(' · ')}</span></div>`).join('')}</div><div class="groups-grid">${r.order
        .filter((w) => !revealed.some((i) => p.groups[i].words.includes(w)))
        .map(
          (w) =>
            `<button type="button" data-group-word="${esc(w)}" aria-pressed="${r.selected.includes(w)}">${esc(w)}</button>`,
        )
        .join(
          '',
        )}</div><p class="group-lives">Mistakes left <span aria-label="${4 - mistakes.length}">${'● '.repeat(4 - mistakes.length)}${'○ '.repeat(mistakes.length)}</span></p><div class="game-controls">${button('Shuffle', 'shuffle', done ? 'disabled' : '')}${button('Clear', 'clear-group', done ? 'disabled' : '')}${button('Submit group', 'submit-group', done || r.selected.length !== 4 ? 'disabled' : '')}</div>`;
    }
    if (id === 'queens' || id === 'binary') {
      const queens = id === 'queens';
      host.innerHTML = `${queens ? `<div class="game-controls mark-tools" aria-label="Placement tool">${button('♛ Place crown', 'crown', `aria-pressed="${r.mode === 'crown'}"`)}${button('× Mark square', 'mark', `aria-pressed="${r.mode === 'mark'}"`)}</div>` : '<p class="grid-hint">Tap a square: empty → ☀ → ◐. Locked squares are clues.</p>'}<div class="logic-grid ${queens ? 'queens-grid' : 'binary-grid'}" role="group" aria-label="${queens ? 'Crown' : 'Sun and moon'} grid">${r.cells
        .map((v, i) => {
          const locked = !queens && !!p.givens[i];
          let edges = '';
          if (queens) {
            if (i % 6 === 0 || p.regions[i - 1] !== p.regions[i])
              edges += ' edge-left';
            if (i < 6 || p.regions[i - 6] !== p.regions[i])
              edges += ' edge-top';
            if (i % 6 === 5 || p.regions[i + 1] !== p.regions[i])
              edges += ' edge-right';
            if (i >= 30 || p.regions[i + 6] !== p.regions[i])
              edges += ' edge-bottom';
          }
          return `<button type="button" data-cell="${i}" class="${queens ? 'region-' + p.regions[i] : v === 1 ? 'sun-cell' : v === 2 ? 'moon-cell' : ''}${edges}${locked ? ' is-clue' : ''}" aria-label="Row ${Math.floor(i / 6) + 1}, column ${(i % 6) + 1}${queens ? ', region ' + String.fromCharCode(65 + p.regions[i]) : ''}, ${queens ? ['empty', 'crown', 'marked'][v] : ['empty', 'sun', 'moon'][v]}${locked ? ', locked clue' : ''}"${done || locked ? ' disabled' : ''}>${queens ? `<small aria-hidden="true">${String.fromCharCode(65 + p.regions[i])}</small>` : ''}<span aria-hidden="true">${queens ? ['', '♛', '×'][v] : ['', '☀', '◐'][v]}</span>${locked ? '<i aria-hidden="true">•</i>' : ''}</button>`;
        })
        .join(
          '',
        )}</div><div class="game-controls">${button('Undo', 'undo', done ? 'disabled' : '')}${button('Check grid', 'check', done ? 'disabled' : '')}</div>`;
    }
    if (id === 'path') {
      const points = r.cells
        .map((i) => `${(i % 5) * 20 + 10},${Math.floor(i / 5) * 20 + 10}`)
        .join(' ');
      host.innerHTML = `<div class="path-grid" role="group" aria-label="Waypoint grid"><svg viewBox="0 0 100 100" aria-hidden="true"><polyline points="${points}"/></svg>${Array.from(
        { length: 25 },
        (_, i) => {
          const cp = p.checkpoints.find((cp) => cp.cell === i);
          return `<button type="button" data-path-cell="${i}" class="${r.cells.includes(i) ? 'on-path ' : ''}${r.cells.at(-1) === i ? 'path-tip' : ''}" aria-label="Row ${Math.floor(i / 5) + 1}, column ${(i % 5) + 1}${cp ? ', checkpoint ' + cp.number : ''}${r.cells.includes(i) ? ', on route' : ''}"${done ? ' disabled' : ''}>${cp ? `<b>${cp.number}</b>` : '<span></span>'}</button>`;
        },
      ).join(
        '',
      )}</div><p class="grid-hint">${r.cells.length} / 25 squares · Start at 1, finish at 5</p><div class="game-controls">${button('Undo step', 'undo', done ? 'disabled' : '')}${button('Check route', 'check', done ? 'disabled' : '')}</div>`;
      wirePath();
    }
    if (id === 'numbers') {
      host.innerHTML = `<div class="number-target"><span>Today’s target</span><strong>${p.target}</strong></div><div class="number-tiles">${r.values.map((item, i) => `<button type="button" data-number="${i}" aria-pressed="${r.selected === i}"${done ? ' disabled' : ''}>${item.value}</button>`).join('')}</div><div class="number-operators">${['+', '−', '×', '÷'].map((op) => `<button type="button" data-operator="${op}" aria-pressed="${r.operator === op}" aria-label="${{ '+': 'Add', '−': 'Subtract', '×': 'Multiply', '÷': 'Divide' }[op]}"${done ? ' disabled' : ''}>${op}</button>`).join('')}</div><p class="grid-hint">${r.selected >= 0 ? `${r.values[r.selected]?.value ?? ''} ${r.operator || '· Choose an operator'}${r.operator ? ' · Choose the second number' : ''}` : 'Choose a number to begin.'}</p><ol class="number-history">${(r.steps || []).map((step) => `<li>${esc(step)}</li>`).join('')}</ol><div class="game-controls">${button('Undo', 'undo', !r.history.length || done ? 'disabled' : '')}${button('Check answer', 'check', r.values.length !== 1 || done ? 'disabled' : '')}</div>`;
    }
  }
  function saveAndRender() {
    const active = document.activeElement;
    const attr = [
      'data-letter',
      'data-group-word',
      'data-cell',
      'data-number',
      'data-operator',
      'data-game-action',
    ].find((key) => active?.hasAttribute(key));
    const value = attr ? active.getAttribute(attr) : null;
    persist();
    renderGame();
    if (attr)
      document
        .querySelector('[' + attr + '=\"' + CSS.escape(value) + '\"]')
        ?.focus({ preventScroll: true });
  }
  function typeLetter(letter) {
    if (current?.id !== 'word' || current.result || $('dialog[open]')) return;
    const r = current.run;
    if (letter === '⌫' || letter === 'Backspace')
      r.input = r.input.slice(0, -1);
    else if (letter === '↵' || letter === 'Enter') {
      if (r.input.length !== 5) return message('Enter five letters.');
      if (!C.WORDS.includes(r.input))
        return message(
          'That word isn’t in this game’s word list. Try another.',
        );
      if (r.guesses.includes(r.input))
        return message('You already tried that word.');
      r.guesses.push(r.input);
      r.input = '';
      persist();
      if (r.guesses.at(-1) === current.puzzle.answer || r.guesses.length === 6)
        return finish({ guesses: r.guesses });
    } else if (/^[A-Z]$/.test(letter) && r.input.length < 5) r.input += letter;
    message('');
    saveAndRender();
  }
  function snapshot() {
    const r = current.run;
    r.undo = r.undo || [];
    r.undo.push(r.cells.slice());
    if (r.undo.length > 80) r.undo.shift();
  }
  function groupAction(action) {
    const r = current.run,
      p = current.puzzle;
    if (action === 'shuffle') r.order = C.shuffle(r.order, Math.random);
    if (action === 'clear-group') r.selected = [];
    if (action === 'submit-group' && r.selected.length === 4) {
      if (
        r.attempts.some(
          (a) =>
            a.slice().sort().join('|') === r.selected.slice().sort().join('|'),
        )
      )
        return message('You already tried that group.');
      const group = p.groups.find((g) =>
        r.selected.every((w) => g.words.includes(w)),
      );
      const near = p.groups.some(
        (g) => r.selected.filter((w) => g.words.includes(w)).length === 3,
      );
      r.attempts.push(r.selected.slice());
      r.selected = [];
      const solved = r.attempts.filter((a) =>
        p.groups.some((g) => a.every((w) => g.words.includes(w))),
      ).length;
      const missed = r.attempts.length - solved;
      if (solved === 4 || missed === 4) return finish({ attempts: r.attempts });
      message(
        group
          ? 'Group found.'
          : near
            ? 'One word away.'
            : 'Those words don’t form a group.',
        group ? 'success' : '',
      );
    }
    saveAndRender();
  }
  function cellAction(index) {
    if (current.result) return;
    const r = current.run;
    if (current.id === 'binary' && current.puzzle.givens[index]) return;
    snapshot();
    if (current.id === 'queens') {
      const val = r.mode === 'mark' ? 2 : 1;
      r.cells[index] = r.cells[index] === val ? 0 : val;
    } else r.cells[index] = (r.cells[index] + 1) % 3;
    message('');
    saveAndRender();
  }
  function pathAction(index) {
    if (current.result) return;
    const r = current.run,
      p = current.puzzle;
    const existing = r.cells.indexOf(index);
    if (existing >= 0) {
      if (existing < r.cells.length - 1)
        r.corrections = (r.corrections || 0) + 1;
      r.cells = r.cells.slice(0, existing + 1);
      saveAndRender();
      return;
    }
    if (!r.cells.length && index !== p.checkpoints[0].cell)
      return message('Start at checkpoint 1.');
    if (r.cells.length && !C.adjacent(r.cells.at(-1), index, 5)) return;
    const cp = p.checkpoints.find((c) => c.cell === index);
    const next =
      p.checkpoints.filter((c) => r.cells.includes(c.cell)).length + 1;
    if (cp && cp.number !== next)
      return message('Visit the numbered checkpoints in order.');
    if (cp?.number === 5 && r.cells.length !== 24)
      return message('Visit every other square before finishing at 5.');
    r.cells.push(index);
    message('');
    saveAndRender();
    if (r.cells.length === 25) finish({ cells: r.cells });
  }
  let dragging = false;
  function wirePath() {
    const grid = $('.path-grid');
    grid.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-path-cell]');
      if (!b) return;
      dragging = true;
      pathAction(Number(b.dataset.pathCell));
      e.preventDefault();
    });
  }
  document.addEventListener(
    'pointermove',
    (e) => {
      if (!dragging || current?.id !== 'path') return;
      const b = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest('[data-path-cell]');
      if (b && Number(b.dataset.pathCell) !== current.run.cells.at(-1))
        pathAction(Number(b.dataset.pathCell));
    },
    { passive: true },
  );
  document.addEventListener('pointerup', () => (dragging = false));
  document.addEventListener('pointercancel', () => (dragging = false));
  function numberAction(index) {
    if (current.result) return;
    const r = current.run;
    if (r.selected < 0 || !r.operator || r.selected === index) {
      r.selected = index;
      saveAndRender();
      return;
    }
    const a = r.values[r.selected],
      b = r.values[index],
      value = C.calculate(a.value, b.value, r.operator);
    if (value === null || value < 0 || value > 10000)
      return message(
        'Keep the result a whole number, zero or greater.',
        'error',
      );
    r.history.push(
      JSON.parse(JSON.stringify({ values: r.values, steps: r.steps || [] })),
    );
    r.steps = r.steps || [];
    r.steps.push(`${a.value} ${r.operator} ${b.value} = ${value}`);
    const next = { value, tree: [r.operator, a.tree, b.tree] };
    r.values = r.values
      .filter((_, i) => i !== r.selected && i !== index)
      .concat(next);
    r.selected = -1;
    r.operator = '';
    message('');
    saveAndRender();
    if (r.values.length === 1 && value === current.puzzle.target)
      finish({ tree: next.tree });
  }
  function check() {
    const r = current.run;
    if (current.id === 'groups') return groupAction('submit-group');
    if (current.id === 'queens')
      return finish({
        cells: r.cells.map((v, i) => (v === 1 ? i : -1)).filter((i) => i >= 0),
      });
    if (['binary', 'path'].includes(current.id))
      return finish({ cells: r.cells });
    if (current.id === 'numbers' && r.values.length === 1)
      return finish({ tree: r.values[0].tree });
  }
  function undo() {
    const r = current.run;
    if (
      (current.id === 'numbers' && r.history.length) ||
      (current.id === 'path' && r.cells.length) ||
      r.undo?.length
    )
      r.corrections = (r.corrections || 0) + 1;
    if (current.id === 'numbers') {
      const old = r.history.pop();
      if (old) {
        r.values = old.values;
        r.steps = old.steps;
        r.selected = -1;
        r.operator = '';
      }
    } else if (current.id === 'path') r.cells.pop();
    else if (r.undo?.length) r.cells = r.undo.pop();
    message('');
    saveAndRender();
  }
  async function copyText(text, success) {
    try {
      await navigator.clipboard.writeText(text);
      if (current) message(success, 'success');
      else $('#gamesSyncStatus').textContent = success;
    } catch (_) {
      if (current)
        message(
          'Copy is unavailable in this browser. Your result is still saved.',
        );
      else
        $('#gamesSyncStatus').textContent =
          'Copy is unavailable here. Use the same browser to keep your player profile.';
    }
  }
  function profile() {
    window.SponsorFlowIdentity.open();
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.play) return openGame(b.dataset.play);
    if (b.dataset.category) {
      category = b.dataset.category;
      document
        .querySelectorAll('[data-category]')
        .forEach((x) => x.setAttribute('aria-pressed', x === b));
      renderHub();
    }
    if (b.dataset.period) {
      period = b.dataset.period;
      document
        .querySelectorAll('[data-period]')
        .forEach((x) => x.setAttribute('aria-pressed', x === b));
      loadBoard();
    }
    if (b.dataset.closeDialog) $('#' + b.dataset.closeDialog).close();
    if (!current) return;
    if (b.dataset.letter) return typeLetter(b.dataset.letter);
    if (b.dataset.groupWord && !current.result) {
      const r = current.run,
        w = b.dataset.groupWord;
      if (r.selected.includes(w))
        r.selected = r.selected.filter((v) => v !== w);
      else if (r.selected.length < 4) r.selected.push(w);
      saveAndRender();
    }
    if (b.dataset.cell !== undefined) cellAction(Number(b.dataset.cell));
    if (b.dataset.pathCell !== undefined && e.detail === 0)
      pathAction(Number(b.dataset.pathCell));
    if (b.dataset.number !== undefined) numberAction(Number(b.dataset.number));
    if (b.dataset.operator && !current.result) {
      if (current.run.selected < 0) return message('Choose a number first.');
      current.run.operator = b.dataset.operator;
      saveAndRender();
    }
    if (b.dataset.gameAction && !current.result) {
      const action = b.dataset.gameAction;
      if (current.id === 'groups') groupAction(action);
      else if (action === 'check') check();
      else if (action === 'undo') undo();
      else if (['crown', 'mark'].includes(action)) {
        current.run.mode = action;
        saveAndRender();
      }
    }
    if (b.dataset.resultAction === 'next') back();
    if (b.dataset.resultAction === 'join') profile();
    if (b.dataset.resultAction === 'share') {
      const r = current.result;
      let extra = '';
      if (current.id === 'word')
        extra =
          '\n' +
          current.run.guesses
            .map((g) =>
              C.wordMarks(g, current.puzzle.answer)
                .map((m) => ['⬜', '🟦', '🟨'][m])
                .join(''),
            )
            .join('\n');
      copyText(
        `ASME · ${current.game.name}\n${current.day}${current.practice ? ' · Practice' : ''}\n${r.points} points · ${r.detail}${extra}\n${location.origin}${location.pathname}`,
        'Result copied.',
      );
    }
  });
  document.addEventListener('keydown', (e) => {
    if (
      !current ||
      $('dialog[open]') ||
      /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)
    )
      return;
    if (
      current.id === 'word' &&
      (/^[a-z]$/i.test(e.key) || ['Enter', 'Backspace'].includes(e.key))
    ) {
      if (
        e.key === 'Enter' &&
        e.target.tagName === 'BUTTON' &&
        !e.target.hasAttribute('data-letter')
      )
        return;
      e.preventDefault();
      typeLetter(e.key.length === 1 ? e.key.toUpperCase() : e.key);
    }
    if (
      current.id === 'path' &&
      e.target.closest('.path-grid') &&
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
    ) {
      e.preventDefault();
      const last =
        current.run.cells.at(-1) ?? current.puzzle.checkpoints[0].cell;
      if (!current.run.cells.length) {
        pathAction(last);
        return;
      }
      const n =
        last +
        { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -5, ArrowDown: 5 }[e.key];
      if (n >= 0 && n < 25 && C.adjacent(last, n, 5)) {
        pathAction(n);
        $(`[data-path-cell="${n}"]`)?.focus({ preventScroll: true });
      }
    }
  });
  $('#gamesSyncButton').addEventListener('click', syncResults);
  $('#gameBack').addEventListener('click', back);
  $('#gameHelp').addEventListener('click', () => {
    $('#gamesHelpTitle').textContent = current.game.name + ' · How to play';
    $('#gamesHelpCopy').innerHTML = rules[current.id]
      .concat(
        'The timer starts when you open the puzzle and keeps running if you leave or reset it. Each correction reduces accuracy by 10 percentage points, to a minimum of 10% for a solved puzzle. Practice is unranked.',
      )
      .map((p) => '<p>' + esc(p) + '</p>')
      .join('');
    $('#gamesHelpDialog').showModal();
  });
  $('#gameReset').addEventListener('click', () => {
    if (!current || current.result) return;
    current.run = {
      ...freshRun(current.id, current.puzzle),
      startedAt: current.run.startedAt,
      corrections: (current.run.corrections || 0) + 1,
      scoringVersion: C.SCORING_VERSION,
    };
    message('Grid reset.');
    saveAndRender();
  });
  $('#gamePractice').addEventListener('click', () =>
    openGame(current.id, true),
  );
  $('#gamesProfileOpen').addEventListener('click', profile);
  $('#leaderboardRefresh').addEventListener('click', () =>
    syncResults(),
  );
  $('#leaderboardGame').addEventListener('change', (e) => {
    boardGame = e.target.value;
    loadBoard();
  });
  window.addEventListener('pagehide', () => {
    persist();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      persist();
    } else {
      const next = C.dayKey();
      if (next !== day) {
        day = next;
        if (current)
          message(
            'A new daily set is ready. Finish this round, then return to All games.',
          );
        else renderHub();
      }
      if (window.SponsorFlowIdentity.name) syncResults();
    }
  });
  window.addEventListener('online', () => {
    if (window.SponsorFlowIdentity.name) syncResults();
  });
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (C.GAMES.some((g) => g.id === id)) openGame(id);
    else if (current) back();
  });
  for (const game of C.GAMES) {
    const option = new Option(game.name, game.id);
    $('#leaderboardGame').add(option);
  }
  renderHub();
  loadBoard();
  window.SponsorFlowIdentity.ready.then(() => {
    S.activate(window.SponsorFlowIdentity.name);
    renderHub();
    if (C.GAMES.some(g => g.id === location.hash.slice(1))) openGame(location.hash.slice(1));
    connectPlayer();
    window.addEventListener('sponsorflow:identity', () => {
      const changed = window.SFGamesMetrics.nameKey(S.data.ownerName) !== window.SFGamesMetrics.nameKey(window.SponsorFlowIdentity.name);
      if (changed && current) { persist(); back(); }
      S.activate(window.SponsorFlowIdentity.name);
      renderHub();
      connectPlayer();
    });
  });
})();
