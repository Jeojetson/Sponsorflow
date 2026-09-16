(() => {
  'use strict';
  const config = window.SPONSORFLOW_CONFIG || {};
  const storage = window.SponsorFlowStorage;
  const readActions = new Set([
    'bootstrap',
    'plannerBootstrap',
    'attendanceBootstrap',
  ]);
  const inflight = new Map();
  let revision = 0;
  const configured = () =>
    Boolean(config.API_URL && !config.API_URL.includes('PASTE_YOUR'));
  const key = (action) => 'sfSnapshot5:' + config.API_URL + ':' + action;
  function cached(action) {
    try {
      const item = JSON.parse(storage.getItem(key(action)) || 'null');
      return item &&
        item.data &&
        Number.isFinite(item.savedAt) &&
        Date.now() - item.savedAt < 86400000
        ? item
        : null;
    } catch (_) {
      return null;
    }
  }
  function invalidate() {
    revision++;
    for (const action of readActions) storage.removeItem(key(action));
    inflight.clear();
  }
  const id = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
  function read(action, payload = {}, options = {}) {
    const existing = cached(action);
    if (!options.force && existing && Date.now() - existing.savedAt < 15000)
      return Promise.resolve(existing.data);
    const requestKey = action + JSON.stringify(payload);
    if (inflight.has(requestKey)) return inflight.get(requestKey);
    const startedRevision = revision;
    const request = new Promise((resolve, reject) => {
      const callId = id(),
        callback = '__sponsorFlowJsonp_' + callId;
      const script = document.createElement('script');
      const cleanup = () => {
        clearTimeout(timeout);
        script.remove();
        delete window[callback];
      };
      const fail = (message) => {
        cleanup();
        reject(new Error(message));
      };
      window[callback] = (response) => {
        cleanup();
        if (!response?.ok)
          return reject(
            new Error(response?.error || 'The data could not be loaded.'),
          );
        if (revision !== startedRevision)
          return resolve(read(action, payload, { force: true }));
        storage.setItem(
          key(action),
          JSON.stringify({ data: response.data, savedAt: Date.now() }),
        );
        resolve(response.data);
      };
      const timeout = setTimeout(
        () =>
          fail(
            'The data service is taking longer than usual. Your saved view is still available; try refreshing shortly.',
          ),
        25000,
      );
      script.onerror = () =>
        fail(
          'The data service could not be reached. Check your connection and try again.',
        );
      script.async = true;
      script.referrerPolicy = 'no-referrer';
      script.src =
        config.API_URL +
        '?' +
        new URLSearchParams({
          ...payload,
          action,
          origin: location.origin,
          callback,
          callId,
        });
      document.head.appendChild(script);
    }).finally(() => {
      if (inflight.get(requestKey) === request) inflight.delete(requestKey);
    });
    inflight.set(requestKey, request);
    return request;
  }
  function write(action, payload) {
    invalidate();
    return new Promise((resolve, reject) => {
      const callId = id();
      const frame = document.createElement('iframe');
      frame.name = 'sf-write-' + callId;
      frame.title = 'Save response';
      frame.hidden = true;
      const cleanup = () => {
        clearTimeout(timeout);
        window.removeEventListener('message', receive);
        frame.remove();
        invalidate();
      };
      const receive = (event) => {
        if (
          !/^https:\/\/(?:script\.google\.com|(?:[a-z0-9-]+-)?script\.googleusercontent\.com)$/.test(
            event.origin,
          )
        )
          return;
        const response = event.data;
        if (response?.type !== 'sponsorflow-api' || response.callId !== callId)
          return;
        cleanup();
        if (response.ok) resolve(response.data);
        else
          reject(new Error(response.error || 'The change could not be saved.'));
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            'The save has not been confirmed. Refresh to check its status before retrying.',
          ),
        );
      }, 45000);
      window.addEventListener('message', receive);
      document.body.appendChild(frame);
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = config.API_URL;
      form.target = frame.name;
      form.hidden = true;
      form.acceptCharset = 'UTF-8';
      for (const [name, value] of Object.entries({
        ...payload,
        action,
        callId,
        origin: location.origin,
      })) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value == null ? '' : String(value);
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
      form.remove();
    });
  }
  function post(action, payload = {}, options = {}) {
    if (!configured())
      return Promise.reject(new Error('SponsorFlow is not connected yet.'));
    return readActions.has(action)
      ? read(action, payload, options)
      : write(action, payload);
  }
  window.SponsorFlowAPI = { post, configured, cached, invalidate };
})();
