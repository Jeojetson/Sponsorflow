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
  const normalizeName = window.SFGamesMetrics.nameKey;
  let accounts;
  try { accounts = JSON.parse(storage.getItem('asmeGamesPlayersV2') || '{}'); } catch (_) { accounts = {}; }
  if (!accounts || Array.isArray(accounts) || typeof accounts !== 'object') accounts = {};
  accounts = Object.assign(Object.create(null), accounts);
  data.ownerName ||= data.profile?.name || data.joinAttempt?.name || '';
  delete data.joinAttempt;
  if (data.profile) delete data.profile.code;
  function persist(state = data) {
    if (state.ownerName) accounts[normalizeName(state.ownerName)] = state;
    storage.setItem('asmeGamesPlayersV2', JSON.stringify(accounts));
    if (state === data) return storage.setItem(key, JSON.stringify(data));
  }
  function activate(name) {
    name = String(name || '').normalize('NFC').trim().replace(/\s+/g, ' ');
    if (normalizeName(data.ownerName) === normalizeName(name)) return;
    if (data.ownerName) {
      persist();
      const saved = accounts[normalizeName(name)];
      data = saved?.version === 1 && saved.runs && Array.isArray(saved.results) && Array.isArray(saved.pending) ? saved : empty();
    }
    // Unclaimed local attempts from older versions belong to the first name.
    data.ownerName = name;
    data.board = null;
    if (data.profile) delete data.profile.code;
    persist();
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
        } else if (/player code|Restore your player/.test(message)) {
          message = 'Name-based players need the new Games.gs deployment. Your scores stay saved until it is installed.';
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
          insights: 'gamesInsights',
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
  let joining = Promise.resolve();
  const joins = new Map();
  function join(name) {
    activate(name);
    const state = data, key = normalizeName(name);
    if (joins.has(key)) return joins.get(key);
    const promise = joining.catch(() => {}).then(() => joinPlayer(name, state))
      .finally(() => { if (joins.get(key) === promise) joins.delete(key); });
    joining = promise;
    joins.set(key, promise);
    return promise;
  }
  async function joinPlayer(name, state) {
    const result = await request('join', { name });
    state.profile = { name: result.name, playerId: result.playerId };
    state.board = null;
    // The server owns the first ranked attempt, even after a lost response.
    for (const record of result.results || []) {
      const matches = r => r.day === record.day && r.game === record.game &&
        (r.version || 1) === (record.version || 1);
      const index = state.results.findIndex(matches);
      if (index < 0) state.results.push(record);
      else state.results[index] = { ...state.results[index], ...record, synced: true };
      state.pending = state.pending.filter(r => !matches(r));
    }
    persist(state);
    return state.profile;
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
  const syncs = new WeakMap();
  async function sync() {
    const state = data;
    if (syncs.has(state)) return syncs.get(state);
    if (!state.profile || !configured()) return { pending: state.pending.length };
    const syncing = (async () => {
      const cutoff = new Date(Date.now() - 35 * 86400000)
        .toISOString()
        .slice(0, 10);
      const errors = [];
      const attempted = new Set();
      for (let record; (record = state.pending.find(r => !attempted.has(r)));) {
        attempted.add(record);
        let result;
        try {
          if (record.day < cutoff) throw new Error('This result is over 35 days old and is kept only on this device.');
          result = await request('score', {
            name: state.ownerName,
            day: record.day,
            game: record.game,
            proof: record.proof,
            version: record.version || window.SFGames.SCORING_VERSION,
          });
        } catch (error) {
          record.syncError = error.message;
          errors.push({ game: record.game, message: error.message });
          persist(state);
          // A rejected attempt must not block other games. System-wide outages
          // stop this batch so we do not repeat a slow timeout for every result.
          if (error.code?.startsWith('GAMES_') || /offline|longer than expected|busy|before submitting/.test(error.message)) break;
          continue;
        }
        state.board = null;
        const i = state.results.findIndex(
          (r) =>
            r.day === record.day &&
            r.game === record.game &&
            (r.version || 1) === (record.version || 1),
        );
        const newer = state.pending.some(
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
            state.results[i].points > result.record.points
          )
        )
          state.results[i] = {
            ...state.results[i],
            ...result.record,
            synced: true,
          };
        state.pending = state.pending.filter(
          (r) =>
            r.day !== record.day ||
            r.game !== record.game ||
            r.completedAt !== record.completedAt,
        );
        persist(state);
      }
      return { pending: state.pending.length, errors };
    })().finally(() => syncs.delete(state));
    syncs.set(state, syncing);
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
  const insightReads = new Map(), insightCache = new Map();
  async function insights(name, force = false) {
    const key = normalizeName(name), cached = insightCache.get(key);
    if (!force && cached?.day === window.SFGames.dayKey() && Date.now() - cached.savedAt < 15000) return cached;
    if (force && insightReads.has(key)) await insightReads.get(key).catch(() => {});
    if (!insightReads.has(key)) {
      const read = request('insights', { name }, true).then(response => {
        const result = { ...response, savedAt: Date.now() };
        insightCache.set(key, result);
        return result;
      }).finally(() => insightReads.delete(key));
      insightReads.set(key, read);
    }
    return insightReads.get(key);
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
    activate,
    insights,
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
