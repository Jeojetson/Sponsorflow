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
  function persist() {
    storage.setItem(key, JSON.stringify(data));
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
        if (response?.ok) resolve(response.data);
        else
          reject(
            new Error(
              response?.error || 'The leaderboard could not be reached.',
            ),
          );
      };
      const receive = (event) => {
        if (
          !/^https:\/\/(?:script\.google\.com|(?:[a-z0-9-]+-)?script\.googleusercontent\.com)$/.test(
            event.origin,
          )
        )
          return;
        const response = event.data;
        if (response?.type !== 'asme-games' || response.callId !== callId)
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
      const fields = { ...payload, action, callId, origin: location.origin };
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
  async function join(name, restoreCode) {
    name = String(name || '')
      .trim()
      .replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 40)
      throw new Error('Use a name between 2 and 40 characters.');
    const code =
      String(restoreCode || data.profile?.code || '')
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
    const result = await request('join', { name, code });
    data.profile = { name: result.name, playerId: result.playerId, code };
    // A new device restores the server's daily attempts before a player can submit again.
    for (const record of result.results || [])
      if (
        !data.results.some(
          (r) => r.day === record.day && r.game === record.game,
        )
      ) {
        data.results.push(record);
      }
    persist();
    return data.profile;
  }
  function saveResult(record) {
    const i = data.results.findIndex(
      (r) => r.day === record.day && r.game === record.game,
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
      data.pending = data.pending.filter((record) => record.day >= cutoff);
      persist();
      for (const record of [...data.pending]) {
        const result = await request('score', {
          code: data.profile.code,
          day: record.day,
          game: record.game,
          proof: record.proof,
          version: 1,
        });
        const i = data.results.findIndex(
          (r) => r.day === record.day && r.game === record.game,
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
      return { pending: data.pending.length };
    })().finally(() => (syncing = null));
    return syncing;
  }
  async function leaderboard(period, game) {
    const response = await request('leaderboard', { period, game }, true);
    data.board = { ...response, period, game, savedAt: Date.now() };
    persist();
    return data.board;
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
    return data.results.find((r) => r.day === day && r.game === id) || null;
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
