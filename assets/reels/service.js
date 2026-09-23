(() => {
  'use strict';
  const pending = new Map();
  const id = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  function request(action, payload = {}) {
    const url = window.SPONSORFLOW_CONFIG?.API_URL || '';
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)) return Promise.reject(new Error('Reels needs the SponsorFlow data connection.'));
    const callId = id(), read = ['reelsFeed','reelsDiscover'].includes(action);
    return new Promise((resolve, reject) => {
      let script, frame, timeout;
      const callback = '__asmeReels_' + callId;
      const cleanup = () => { clearTimeout(timeout); script?.remove(); frame?.remove(); delete window[callback]; window.removeEventListener('message', receive); };
      const fail = message => { cleanup(); reject(new Error(message)); };
      const finish = response => {
        cleanup();
        if (response?.ok) resolve(response.data);
        else {
          let error = response?.error || 'Reels could not connect. Please try again.';
          if (['This read action is unavailable.', 'Unknown SponsorFlow action.'].includes(error)) error = 'Reels needs the new Apps Script deployment. Ask an officer to install Reels.gs and run setupReels.';
          reject(new Error(error));
        }
      };
      const receive = event => {
        if (!/^https:\/\/(?:script\.google\.com|(?:[a-z0-9-]+-)?script\.googleusercontent\.com)$/.test(event.origin)) return;
        if (event.data?.callId === callId && ['asme-reels', 'sponsorflow-api'].includes(event.data.type)) finish(event.data);
      };
      timeout = setTimeout(() => fail('The connection is taking too long. Refresh to check whether your change arrived; retrying the same message is safe.'), 45000);
      if (read) {
        window[callback] = finish;
        script = document.createElement('script'); script.async = true;
        script.onerror = () => fail('Reels could not load. Check your connection and refresh.');
        script.src = url + '?' + new URLSearchParams({ ...payload, action, origin: location.origin, callId, callback });
        document.head.appendChild(script);
      } else {
        frame = document.createElement('iframe'); frame.hidden = true; frame.name = 'reels-' + callId; frame.title = 'Reels save response';
        window.addEventListener('message', receive); document.body.appendChild(frame);
        const form = document.createElement('form'); form.hidden = true; form.method = 'POST'; form.action = url; form.target = frame.name; form.acceptCharset = 'UTF-8';
        for (const [key, value] of Object.entries({ ...payload, action, origin: location.origin, callId })) {
          const input = document.createElement('input'); input.type = 'hidden'; input.name = key; input.value = String(value == null ? '' : value); form.appendChild(input);
        }
        document.body.appendChild(form); form.submit(); form.remove();
      }
    });
  }
  function read(action, payload = {}) {
    const key = action + JSON.stringify(payload);
    if (!pending.has(key)) {
      const operation = request(action, payload).finally(() => { if (pending.get(key) === operation) pending.delete(key); });
      pending.set(key, operation);
    }
    return pending.get(key);
  }
  const invalidate = (action, payload = {}) => pending.delete(action + JSON.stringify(payload));
  window.SFReelsService = { request, read, id, invalidate };
})();
