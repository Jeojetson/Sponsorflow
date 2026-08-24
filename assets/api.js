(() => {
  "use strict";

  const config = window.SPONSORFLOW_CONFIG || {};
  const pending = new Map();
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

  function post(action, payload = {}) {
    if (!configured()) {
      return Promise.reject(new Error("SponsorFlow is not connected yet. Add the Apps Script web app URL to assets/config.js."));
    }
    ensureListener();
    const callId = randomId();
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        pending.delete(callId);
        reject(new Error("The data service took too long to respond. Try again in a moment."));
      }, 30000);
      pending.set(callId, { resolve, reject, timeout });

      const form = document.createElement("form");
      form.method = "POST";
      form.action = config.API_URL;
      form.target = "sponsorflow-api-frame";
      form.hidden = true;

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

  window.SponsorFlowAPI = { post, configured };
})();
