(() => {
  "use strict";

  const API = window.SponsorFlowAPI;
  const config = window.SPONSORFLOW_CONFIG || {};
  const STORAGE_KEY = "asmeSponsorFlowRequestsV1";

  const state = {
    contacts: [],
    templates: [],
    revision: null,
    currentSubmitted: null
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeName(value) {
    return value.trim().replace(/\s+/g, " ");
  }

  function randomChars(length) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("");
  }

  function makeRequestId() {
    return `REQ-${randomChars(8)}`;
  }

  function makeAccessCode() {
    const raw = randomChars(12);
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
  }

  function getSavedAccess() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveAccess(entry) {
    const items = getSavedAccess().filter(item => item.requestId !== entry.requestId);
    items.unshift(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 100)));
  }

  function setFormStatus(message, type = "") {
    const el = $("#formStatus");
    el.textContent = message;
    el.className = `form-status${type ? ` is-${type}` : ""}`;
  }

  function showConnectionError(message) {
    const banner = $("#connectionBanner");
    banner.textContent = message;
    banner.classList.remove("is-hidden");
  }

  function switchView(view) {
    $$("[data-view]").forEach(section => section.classList.toggle("is-hidden", section.dataset.view !== view));
    $$("[data-view-button]").forEach(button => button.classList.toggle("is-active", button.dataset.viewButton === view));
    if (view === "requests") loadSavedRequests();
    window.scrollTo({ top: document.querySelector(".workspace-shell").offsetTop - 20, behavior: "smooth" });
  }

  async function bootstrap() {
    if (!API.configured()) {
      showConnectionError("Setup required: add your Apps Script web app URL to assets/config.js. The deployment guide explains exactly where to paste it.");
      $("#contactId").innerHTML = '<option value="">Not connected</option>';
      $("#templateId").innerHTML = '<option value="">Not connected</option>';
      return;
    }
    try {
      const data = await API.post("bootstrap");
      state.contacts = data.contacts || [];
      state.templates = data.templates || [];
      renderContactOptions();
      renderTemplateOptions();
      const rememberedName = localStorage.getItem("asmeSponsorFlowName");
      if (rememberedName) $("#requesterName").value = rememberedName;
    } catch (error) {
      showConnectionError(error.message);
    }
  }

  function renderContactOptions() {
    const select = $("#contactId");
    if (!state.contacts.length) {
      select.innerHTML = '<option value="">No verified contacts yet—ask an admin to add one</option>';
      return;
    }
    select.innerHTML = '<option value="">Choose a verified sponsor</option>' + state.contacts.map(contact => {
      const contactText = contact.contactName ? ` — ${escapeHtml(contact.contactName)}` : "";
      return `<option value="${escapeHtml(contact.id)}">${escapeHtml(contact.companyName)}${contactText}</option>`;
    }).join("");
  }

  function renderTemplateOptions() {
    const select = $("#templateId");
    if (!state.templates.length) {
      select.innerHTML = '<option value="">No active templates</option>';
      return;
    }
    select.innerHTML = '<option value="">Choose a template</option>' + state.templates.map(template =>
      `<option value="${escapeHtml(template.id)}">${escapeHtml(template.name)} · ${escapeHtml(template.category)}</option>`
    ).join("");
  }

  function selectedContact() {
    return state.contacts.find(item => item.id === $("#contactId").value);
  }

  function selectedTemplate() {
    return state.templates.find(item => item.id === $("#templateId").value);
  }

  function firstName(fullName) {
    return String(fullName || "").trim().split(/\s+/)[0] || "Sponsor Team";
  }

  function renderTemplateText(templateText, values) {
    return String(templateText || "").replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => values[key] ?? `{{${key}}}`);
  }

  function generateDraft() {
    const contact = selectedContact();
    const template = selectedTemplate();
    const senderName = normalizeName($("#requesterName").value);
    if (!contact || !template || !senderName) {
      setFormStatus("Enter your name, then choose a sponsor and template before generating the draft.", "error");
      return;
    }

    const values = {
      company_name: contact.companyName,
      contact_first_name: firstName(contact.contactName),
      sender_name: senderName,
      sender_role: $("#requesterRole").value.trim() || "Student Member",
      personalized_connection: $("#personalizedConnection").value.trim(),
      specific_request: $("#specificRequest").value.trim(),
      specific_use: $("#specificUse").value.trim(),
      selected_benefits: $("#selectedBenefits").value.trim(),
      custom_message: $("#customMessage").value.trim()
    };
    $("#emailSubject").value = renderTemplateText(template.subjectTemplate, values).replace(/\s+/g, " ").trim();
    $("#emailBody").value = renderTemplateText(template.bodyTemplate, values)
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s+|\s+$/g, "");
    setFormStatus("Draft generated. Edit it freely before submitting.", "success");
    updateQuality();
  }

  function qualityResult() {
    const subject = $("#emailSubject").value.trim();
    const body = $("#emailBody").value.trim();
    const company = selectedContact()?.companyName || "";
    const checks = [
      { label: "A clear, usable subject line", pass: subject.length >= 12 && subject.length <= 120, weight: 15 },
      { label: "No unresolved template placeholders", pass: !/{{[^}]+}}/.test(`${subject} ${body}`), weight: 20 },
      { label: "The sponsor is named in the message", pass: Boolean(company && body.toLowerCase().includes(company.toLowerCase())), weight: 15 },
      { label: "A specific request is included", pass: $("#specificRequest").value.trim().length >= 20 || /seeking|request|consider supporting|sponsorship/i.test(body), weight: 15 },
      { label: "The use and sponsor return are explained", pass: ($("#specificUse").value.trim().length >= 20 && $("#selectedBenefits").value.trim().length >= 20) || /in return|recognize|support would/i.test(body), weight: 15 },
      { label: "The message includes a low-friction next step", pass: /conversation|available|open to|would you|brief call|discuss/i.test(body), weight: 10 },
      { label: "Professional length and official club signature", pass: body.length >= 650 && body.length <= 5000 && body.includes("asmeindy@purdue.edu"), weight: 10 }
    ];
    const score = checks.reduce((sum, check) => sum + (check.pass ? check.weight : 0), 0);
    return { checks, score };
  }

  function updateQuality() {
    const { checks, score } = qualityResult();
    $("#qualityScore").textContent = score;
    $("#qualityBar").style.width = `${score}%`;
    $("#qualityLabel").textContent = score >= 85 ? "Sponsor-ready" : score >= 70 ? "Strong draft" : score >= 45 ? "Needs refinement" : "Needs content";
    $("#qualityChecks").innerHTML = checks.map(check =>
      `<li class="${check.pass ? "is-pass" : ""}">${escapeHtml(check.label)}</li>`
    ).join("");
  }

  async function submitRequest(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const { score } = qualityResult();
    if (!form.reportValidity()) return;
    if (score < 70) {
      setFormStatus("Bring the quality score to at least 70 before submitting.", "error");
      return;
    }
    const contact = selectedContact();
    const template = selectedTemplate();
    if (!contact || !template) {
      setFormStatus("Choose a verified contact and template.", "error");
      return;
    }

    const button = $("#submitRequestButton");
    button.disabled = true;
    setFormStatus(state.revision ? "Submitting the revised draft…" : "Submitting for admin review…");

    try {
      const requesterName = normalizeName($("#requesterName").value);
      localStorage.setItem("asmeSponsorFlowName", requesterName);
      if (state.revision) {
        const result = await API.post("reviseRequest", {
          requestId: state.revision.requestId,
          accessCode: state.revision.accessCode,
          requesterName,
          requesterRole: $("#requesterRole").value.trim(),
          subject: $("#emailSubject").value.trim(),
          body: $("#emailBody").value.trim()
        });
        saveAccess({ requestId: state.revision.requestId, accessCode: state.revision.accessCode, requesterName });
        state.revision = null;
        button.textContent = "Submit for admin review";
        setFormStatus("Revision submitted. The request is back in the admin review queue.", "success");
        switchView("requests");
        return result;
      }

      const requestId = makeRequestId();
      const accessCode = makeAccessCode();
      await API.post("createRequest", {
        requestId,
        accessCode,
        requesterName,
        requesterRole: $("#requesterRole").value.trim(),
        contactId: contact.id,
        templateId: template.id,
        subject: $("#emailSubject").value.trim(),
        body: $("#emailBody").value.trim()
      });
      saveAccess({ requestId, accessCode, requesterName });
      state.currentSubmitted = { requestId, accessCode, requesterName };
      $("#submittedRequestId").textContent = requestId;
      $("#submittedAccessCode").textContent = accessCode;
      $("#accessDialog").showModal();
      setFormStatus("Submitted successfully.", "success");
    } catch (error) {
      setFormStatus(error.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  async function loadSavedRequests() {
    const saved = getSavedAccess();
    const groupsContainer = $("#requestGroups");
    const empty = $("#requestsEmpty");
    groupsContainer.innerHTML = "";
    if (!saved.length) {
      empty.classList.remove("is-hidden");
      return;
    }
    empty.classList.add("is-hidden");
    groupsContainer.innerHTML = '<div class="empty-state"><p>Loading saved requests…</p></div>';
    const results = await Promise.all(saved.map(async entry => {
      try {
        const request = await API.post("getRequest", entry);
        return { ...entry, request };
      } catch (error) {
        return { ...entry, error: error.message };
      }
    }));
    const groups = new Map();
    results.forEach(result => {
      const name = result.request?.requesterName || result.requesterName || "Unknown member";
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(result);
    });
    groupsContainer.innerHTML = Array.from(groups.entries()).map(([name, items]) => `
      <section class="request-group">
        <h3>${escapeHtml(name)}</h3>
        <div class="request-list">
          ${items.map(renderRequestCard).join("")}
        </div>
      </section>
    `).join("");

    $$('[data-open-request]').forEach(button => button.addEventListener("click", () => {
      const entry = saved.find(item => item.requestId === button.dataset.openRequest);
      if (entry) openRequest(entry);
    }));
  }

  function renderRequestCard(item) {
    if (item.error) {
      return `<article class="request-card"><h4>${escapeHtml(item.requestId)}</h4><p>${escapeHtml(item.error)}</p></article>`;
    }
    const request = item.request;
    return `<article class="request-card">
      <div class="request-card-top">
        <div><h4>${escapeHtml(request.companyName)}</h4><p>${escapeHtml(request.templateName)}</p></div>
        <span class="status-badge status-${escapeHtml(request.status)}">${escapeHtml(statusLabel(request.status))}</span>
      </div>
      <div class="request-meta"><span>${escapeHtml(request.id)}</span><span>Revision ${escapeHtml(request.revisionNumber)}</span><span>${escapeHtml(formatDate(request.updatedAt))}</span></div>
      ${request.adminComment ? `<p class="admin-comment">${escapeHtml(request.adminComment)}</p>` : ""}
      <button class="button button-secondary button-small" type="button" data-open-request="${escapeHtml(request.id)}">View request</button>
    </article>`;
  }

  function statusLabel(status) {
    return ({
      PENDING_REVIEW: "Pending review",
      CHANGES_REQUESTED: "Changes requested",
      APPROVED: "Approved",
      SENT: "Sent",
      REJECTED: "Rejected"
    })[status] || status;
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
  }

  async function openRequest(entry) {
    const detail = $("#requestDetail");
    detail.innerHTML = "<p>Loading request…</p>";
    $("#requestDialog").showModal();
    try {
      const request = await API.post("getRequest", entry);
      detail.innerHTML = `
        <div class="request-detail-header">
          <div><p class="eyebrow">${escapeHtml(request.id)}</p><h2>${escapeHtml(request.companyName)}</h2><p>${escapeHtml(request.contactName || "Sponsor contact")} · ${escapeHtml(request.templateName)}</p></div>
          <span class="status-badge status-${escapeHtml(request.status)}">${escapeHtml(statusLabel(request.status))}</span>
        </div>
        <div class="request-detail-grid">
          <div class="detail-block"><span>Submitted by</span><strong>${escapeHtml(request.requesterName)}${request.requesterRole ? ` · ${escapeHtml(request.requesterRole)}` : ""}</strong></div>
          <div class="detail-block"><span>Last updated</span><strong>${escapeHtml(formatDate(request.updatedAt))}</strong></div>
        </div>
        ${request.adminComment ? `<div class="admin-comment"><strong>Admin comment</strong><br>${escapeHtml(request.adminComment)}</div>` : ""}
        <label class="field"><span>Subject</span><input value="${escapeHtml(request.subject)}" readonly></label>
        <div class="field"><span>Email body</span><div class="email-preview">${escapeHtml(request.body)}</div></div>
        <div class="field-grid two-col">
          <button id="copyRequestButton" class="button button-secondary" type="button">Copy email</button>
          ${request.status === "CHANGES_REQUESTED" ? '<button id="reviseRequestButton" class="button button-primary" type="button">Revise this draft</button>' : ""}
        </div>`;
      $("#copyRequestButton").addEventListener("click", () => navigator.clipboard.writeText(`Subject: ${request.subject}\n\n${request.body}`));
      if ($("#reviseRequestButton")) {
        $("#reviseRequestButton").addEventListener("click", () => beginRevision(request, entry));
      }
    } catch (error) {
      detail.innerHTML = `<p class="form-status is-error">${escapeHtml(error.message)}</p>`;
    }
  }

  function beginRevision(request, entry) {
    state.revision = { requestId: request.id, accessCode: entry.accessCode };
    $("#requesterName").value = request.requesterName;
    $("#requesterRole").value = request.requesterRole || "";
    $("#contactId").value = request.contactId;
    $("#templateId").value = request.templateId;
    $("#emailSubject").value = request.subject;
    $("#emailBody").value = request.body;
    $("#submitRequestButton").textContent = "Submit revised draft";
    $("#requestDialog").close();
    switchView("compose");
    setFormStatus("Editing a requested revision. Update the subject or body, then resubmit.");
    updateQuality();
  }

  async function lookupRequest(event) {
    event.preventDefault();
    const status = $("#lookupStatus");
    status.textContent = "Opening request…";
    status.className = "form-status";
    const entry = {
      requestId: $("#lookupRequestId").value.trim().toUpperCase(),
      accessCode: $("#lookupAccessCode").value.trim().toUpperCase(),
      requesterName: ""
    };
    try {
      const request = await API.post("getRequest", entry);
      entry.requesterName = request.requesterName;
      saveAccess(entry);
      $("#lookupDialog").close();
      switchView("requests");
    } catch (error) {
      status.textContent = error.message;
      status.className = "form-status is-error";
    }
  }

  function wireEvents() {
    $$("[data-view-button]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.viewButton)));
    $("#templateId").addEventListener("change", () => {
      const template = selectedTemplate();
      const note = $("#templateDescription");
      if (template?.description) {
        note.textContent = template.description;
        note.classList.remove("is-hidden");
      } else note.classList.add("is-hidden");
    });
    $("#benefitPreset").addEventListener("change", event => {
      if (event.target.value) $("#selectedBenefits").value = event.target.value;
      updateQuality();
    });
    $("#generateDraftButton").addEventListener("click", generateDraft);
    $("#composeForm").addEventListener("submit", submitRequest);
    ["#emailSubject", "#emailBody", "#specificRequest", "#specificUse", "#selectedBenefits"].forEach(selector => $(selector).addEventListener("input", updateQuality));
    $("#openLookupButton").addEventListener("click", () => $("#lookupDialog").showModal());
    $("#lookupForm").addEventListener("submit", lookupRequest);
    $$('[data-close-dialog]').forEach(button => button.addEventListener("click", () => document.getElementById(button.dataset.closeDialog).close()));
    $("#copyAccessButton").addEventListener("click", async () => {
      if (!state.currentSubmitted) return;
      await navigator.clipboard.writeText(`Request ID: ${state.currentSubmitted.requestId}\nEdit code: ${state.currentSubmitted.accessCode}`);
      $("#copyAccessButton").textContent = "Copied";
    });
    $("#goToRequestsButton").addEventListener("click", () => setTimeout(() => switchView("requests"), 0));
  }

  wireEvents();
  updateQuality();
  bootstrap();
})();
