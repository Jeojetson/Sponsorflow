(() => {
  'use strict';
  const storage = window.SponsorFlowStorage;
  const key = 'asmeGamesV1';
  const empty = () => ({
    version: 1,
    profile: null,
    runs: {},
    results: [],
    pending: [],
    board: null,
  });
  let data;
  try {
    data = JSON.parse(storage.getItem(key) || 'null');
    if (
      !data ||
      data.version !== 1 ||
      !data.runs ||
      !Array.isArray(data.results) ||
      !Array.isArray(data.pending)
    )
      data = empty();
  } catch (_) {
    data = empty();
  }
  // Preserve old scores and in-progress boards, but keep the new scoring season
  // separate. Old 100-point scores and kart results never mix with timed scores.
  data.legacyRuns ||= {};
  data.legacyPending ||= [];
  for (const [runKey, run] of Object.entries(data.runs)) {
    if (run.scoringVersion !== window.SFGames.SCORING_VERSION) {
      data.legacyRuns[runKey] = run;
      delete data.runs[runKey];
    }
  }
  data.legacyPending.push(
    ...data.pending.filter(
      (record) => record.version !== window.SFGames.SCORING_VERSION,
    ),
  );
  data.pending = data.pending.filter(
    (record) => record.version === window.SFGames.SCORING_VERSION,
  );
  function persist() {
    return storage.setItem(key, JSON.stringify(data));
  }
  function runKey(day, id) {
    return day + ':' + id;
  }
  const configured = () =>
    /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(
      window.ASME_GAMES_CONFIG?.API_URL || '',
    );
  function request(action, payload = {}, read = false) {
    if (!configured())
      return Promise.reject(
        new Error(
          'The club leaderboard is not open yet. Your results are saved on this device.',
        ),
      );
    const callId = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
    const url = window.ASME_GAMES_CONFIG.API_URL;
    return new Promise((resolve, reject) => {
      let frame, script, callback, timeout;
      const cleanup = () => {
        clearTimeout(timeout);
        frame?.remove();
        script?.remove();
        if (callback) delete window[callback];
        window.removeEventListener('message', receive);
      };
      const finish = (response) => {
        cleanup();
        if (response?.ok) return resolve(response.data);
        let message = response?.error || 'The leaderboard could not be reached.';
        let code = response?.code || '';
        if (['This read action is unavailable.', 'Unknown SponsorFlow action.'].includes(message)) {
          message = 'Shared rankings need the latest Apps Script deployment. Your results are saved on this device.';
          code = 'GAMES_SETUP';
        } else if (/Games (Results|Players) has different columns/.test(message)) {
          message = 'The club leaderboard needs a spreadsheet update. An officer must install the latest Games.gs and run setupGames. Your results are saved on this device.';
          code = 'GAMES_SCHEMA';
        }
        reject(Object.assign(new Error(message), { code }));
      };
      const receive = (event) => {
        if (
          !/^https:\/\/(?:script\.google\.com|(?:[a-z0-9-]+-)?script\.googleusercontent\.com)$/.test(
            event.origin,
          )
        )
          return;
        const response = event.data;
        if (response?.callId !== callId) return;
        // An older SponsorFlow deployment returns its own error envelope until
        // the Games routing hooks are installed. Surface that error promptly.
        if (
          response.type !== 'asme-games' &&
          !(response.type === 'sponsorflow-api' && response.ok === false)
        )
          return;
        finish(response);
      };
      timeout = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            'The leaderboard is taking longer than expected. Your score is saved; try syncing again.',
          ),
        );
      }, 25000);
      const fields = {
        ...payload,
        action: {
          leaderboard: 'gamesLeaderboard',
          join: 'gamesJoin',
          score: 'gamesScore',
        }[action],
        callId,
        origin: location.origin,
      };
      if (read) {
        callback = '__asmeGames_' + callId;
        window[callback] = finish;
        script = document.createElement('script');
        script.src = url + '?' + new URLSearchParams({ ...fields, callback });
        script.onerror = () => {
          cleanup();
          reject(new Error('The leaderboard is offline. Try again shortly.'));
        };
        document.head.appendChild(script);
      } else {
        window.addEventListener('message', receive);
        frame = document.createElement('iframe');
        frame.name = 'games-' + callId;
        frame.hidden = true;
        frame.title = 'Game score response';
        document.body.appendChild(frame);
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = url;
        form.target = frame.name;
        form.hidden = true;
        for (const [name, value] of Object.entries(fields)) {
          const input = document.createElement('input');
          input.name = name;
          input.value =
            typeof value === 'object' ? JSON.stringify(value) : String(value);
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
        form.remove();
      }
    });
  }
  let joining = null, joiningKey = '';
  function join(name, restoreCode) {
    const key = JSON.stringify([String(name || '').trim().replace(/\s+/g, ' '), restoreCode || '']);
    if (joining) {
      if (key === joiningKey) return joining;
      return joining.catch(() => {}).then(() => join(name, restoreCode));
    }
    joiningKey = key;
    joining = joinPlayer(name, restoreCode).finally(() => { joining = null; });
    return joining;
  }
  async function joinPlayer(name, restoreCode) {
    name = String(name || '')
      .trim()
      .replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 40)
      throw new Error('Use a name between 2 and 40 characters.');
    const code =
      String(restoreCode || data.profile?.code || data.joinAttempt?.code || '')
        .trim()
        .toLowerCase() ||
      Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join('');
    if (!/^[a-f0-9]{48}$/.test(code))
      throw new Error(
        'That player code is not valid. Copy the full code from your other device.',
      );
    if (data.profile && code !== data.profile.code)
      throw new Error(
        'This browser already has a player. Use a separate browser profile to sign in as someone else.',
      );
    data.joinAttempt = { name, code };
    if (persist() === false) throw new Error('Enable browser storage to keep your player code before connecting to rankings. You can still play on this page.');
    const result = await request('join', { name, code });
    data.joinAttempt = null;
    data.profile = { name: result.name, playerId: result.playerId, code };
    data.board = null;
    // The server owns the first ranked attempt, including after an uncertain
    // response or a second-device restore. Keep local proof for recovery.
    for (const record of result.results || []) {
      const matches = r => r.day === record.day && r.game === record.game &&
        (r.version || 1) === (record.version || 1);
      const index = data.results.findIndex(matches);
      if (index < 0) data.results.push(record);
      else data.results[index] = { ...data.results[index], ...record, synced: true };
      data.pending = data.pending.filter(r => !matches(r));
    }
    persist();
    return data.profile;
  }
  function saveResult(record) {
    const i = data.results.findIndex(
      (r) =>
        r.day === record.day &&
        r.game === record.game &&
        (r.version || 1) === (record.version || 1),
    );
    if (
      i >= 0 &&
      (record.game !== 'kart' || data.results[i].points >= record.points)
    )
      return data.results[i];
    if (i >= 0) data.results[i] = record;
    else data.results.push(record);
    data.pending = data.pending.filter(
      (r) => r.day !== record.day || r.game !== record.game,
    );
    data.pending.push(record);
    persist();
    return record;
  }
  let syncing = null;
  async function sync() {
    if (syncing) return syncing;
    if (!data.profile || !configured()) return { pending: data.pending.length };
    syncing = (async () => {
      const cutoff = new Date(Date.now() - 35 * 86400000)
        .toISOString()
        .slice(0, 10);
      const errors = [];
      const attempted = new Set();
      for (let record; (record = data.pending.find(r => !attempted.has(r)));) {
        attempted.add(record);
        let result;
        try {
          if (record.day < cutoff) throw new Error('This result is over 35 days old and is kept only on this device.');
          result = await request('score', {
            code: data.profile.code,
            day: record.day,
            game: record.game,
            proof: record.proof,
            version: record.version || window.SFGames.SCORING_VERSION,
          });
        } catch (error) {
          record.syncError = error.message;
          errors.push({ game: record.game, message: error.message });
          persist();
          // A rejected attempt must not block other games. System-wide outages
          // stop this batch so we do not repeat a slow timeout for every result.
          if (error.code?.startsWith('GAMES_') || /offline|longer than expected|busy|before submitting/.test(error.message)) break;
          continue;
        }
        data.board = null;
        const i = data.results.findIndex(
          (r) =>
            r.day === record.day &&
            r.game === record.game &&
            (r.version || 1) === (record.version || 1),
        );
        const newer = data.pending.some(
          (r) =>
            r.day === record.day &&
            r.game === record.game &&
            r.completedAt !== record.completedAt,
        );
        if (
          i >= 0 &&
          !(
            record.game === 'kart' &&
            newer &&
            data.results[i].points > result.record.points
          )
        )
          data.results[i] = {
            ...data.results[i],
            ...result.record,
            synced: true,
          };
        data.pending = data.pending.filter(
          (r) =>
            r.day !== record.day ||
            r.game !== record.game ||
            r.completedAt !== record.completedAt,
        );
        persist();
      }
      return { pending: data.pending.length, errors };
    })().finally(() => (syncing = null));
    return syncing;
  }
  let boardRequest = 0;
  const boardReads = new Map();
  async function leaderboard(period, game, force = false) {
    const cached = data.board;
    if (
      !force &&
      cached?.version === window.SFGames.SCORING_VERSION &&
      cached.day === window.SFGames.dayKey() &&
      cached.period === period &&
      cached.game === game &&
      Date.now() - cached.savedAt < 15000
    )
      return cached;
    const requestId = ++boardRequest;
    const key = period + ':' + game;
    if (force) boardReads.delete(key);
    if (!boardReads.has(key)) {
      const read = request('leaderboard', { period, game, version: window.SFGames.SCORING_VERSION }, true)
        .finally(() => { if (boardReads.get(key) === read) boardReads.delete(key); });
      boardReads.set(key, read);
    }
    const response = await boardReads.get(key);
    if (response.version !== window.SFGames.SCORING_VERSION)
      throw new Error(
        'The new timed standings are not open yet. Your results are saved; try Sync scores after the club update.',
      );
    const board = { ...response, period, game, savedAt: Date.now() };
    if (requestId === boardRequest) {
      data.board = board;
      persist();
    }
    return board;
  }
  function saveRun(day, id, run) {
    data.runs[runKey(day, id)] = run;
    const cutoff = new Date(Date.now() - 35 * 86400000)
      .toISOString()
      .slice(0, 10);
    for (const k of Object.keys(data.runs))
      if (k.slice(0, 10) < cutoff) delete data.runs[k];
    persist();
  }
  function getRun(day, id) {
    return data.runs[runKey(day, id)] || null;
  }
  function result(day, id) {
    return (
      data.results.find(
        (r) =>
          r.day === day &&
          r.game === id &&
          r.version === window.SFGames.SCORING_VERSION,
      ) || null
    );
  }
  window.SFGamesService = {
    configured,
    join,
    sync,
    leaderboard,
    saveRun,
    getRun,
    saveResult,
    result,
    get data() {
      return data;
    },
  };
})();
