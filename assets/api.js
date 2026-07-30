(() => {
  "use strict";

  const config = window.SPONSORFLOW_CONFIG || {};
  const pending = new Map();
  const JSONP_ACTIONS = new Set(["bootstrap", "plannerBootstrap"]);
  let listenerReady = false;

  function configured() {
    return Boolean(config.API_URL && !config.API_URL.includes("PASTE_YOUR"));
  }

  function randomId() {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function ensureListener() {
    if (listenerReady) return;
    listenerReady = true;
    window.addEventListener("message", event => {
      const data = event.data;
      if (!data || data.type !== "sponsorflow-api" || !data.callId) return;
      const entry = pending.get(data.callId);
      if (!entry) return;
      clearTimeout(entry.timeout);
      pending.delete(data.callId);
      if (data.ok) entry.resolve(data.data);
      else entry.reject(new Error(data.error || "The request could not be completed."));
    });
  }

  function jsonp(action, payload = {}, attempt = 0) {
    if (!configured()) {
      return Promise.reject(new Error("SponsorFlow is not connected yet. Add the Apps Script web app URL to assets/config.js."));
    }
    const callId = randomId();
    const callbackName = `__sponsorFlowJsonp_${callId}`;
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const cleanup = () => {
        clearTimeout(timeout);
        script.remove();
        try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
      };
      window[callbackName] = response => {
        cleanup();
        if (response && response.ok) resolve(response.data);
        else reject(new Error(response?.error || "The request could not be completed."));
      };
      const params = new URLSearchParams({
        action,
        callback: callbackName,
        callId,
        origin: window.location.origin,
        _: `${Date.now()}-${attempt}`,
        ...Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, value == null ? "" : String(value)]))
      });
      script.async = true;
      script.referrerPolicy = "no-referrer";
      script.src = `${config.API_URL}${config.API_URL.includes("?") ? "&" : "?"}${params.toString()}`;
      script.onerror = () => {
        cleanup();
        if (attempt < 1) {
          window.setTimeout(() => jsonp(action, payload, attempt + 1).then(resolve, reject), 900);
        } else {
          reject(new Error("The data service could not be reached. Check your connection and try again."));
        }
      };
      const timeout = window.setTimeout(() => {
        cleanup();
        if (attempt < 1) {
          jsonp(action, payload, attempt + 1).then(resolve, reject);
        } else {
          reject(new Error("The data service is still starting. Tap retry in a moment."));
        }
      }, 60000);
      document.head.appendChild(script);
    });
  }

  function iframePost(action, payload = {}) {
    if (!configured()) {
      return Promise.reject(new Error("SponsorFlow is not connected yet. Add the Apps Script web app URL to assets/config.js."));
    }
    ensureListener();
    const callId = randomId();
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        pending.delete(callId);
        reject(new Error("The data service took too long to respond. Check your connection and try again."));
      }, 60000);
      pending.set(callId, { resolve, reject, timeout });

      const frame = document.querySelector('iframe[name="sponsorflow-api-frame"]');
      if (frame) frame.setAttribute("aria-busy", "true");

      const form = document.createElement("form");
      form.method = "POST";
      form.action = config.API_URL;
      form.target = "sponsorflow-api-frame";
      form.hidden = true;
      form.acceptCharset = "UTF-8";

      const values = {
        action,
        callId,
        origin: window.location.origin,
        ...payload
      };

      Object.entries(values).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value == null ? "" : String(value);
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
      form.remove();
    });
  }

  function post(action, payload = {}) {
    return JSONP_ACTIONS.has(action) ? jsonp(action, payload) : iframePost(action, payload);
  }

  window.SponsorFlowAPI = { post, configured };
})();
