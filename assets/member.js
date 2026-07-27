(() => {
  "use strict";

  const API = window.SponsorFlowAPI;
  const state = {
    contacts: [],
    templates: [],
    stats: null,
    memberNames: [],
    sponsorMode: "directory",
    revision: null,
    loadedRequests: [],
    activeLookupName: "",
    sponsorHistory: null,
    historyCheckSequence: 0
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
    return String(value || "").trim().replace(/\s+/g, " ");
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
    $$('[data-view]').forEach(section => section.classList.toggle("is-hidden", section.dataset.view !== view));
    $$('[data-view-button]').forEach(button => button.classList.toggle("is-active", button.dataset.viewButton === view));

    if (view === "requests") {
      const remembered = normalizeName(localStorage.getItem("asmeSponsorFlowName"));
      if (remembered && !$("#requestLookupName").value) $("#requestLookupName").value = remembered;
      if ($("#requestLookupName").value.trim()) loadRequestsByName($("#requestLookupName").value);
    }
    if (view === "stats") renderStats();

    const workspace = document.querySelector(".workspace-shell");
    if (workspace) window.scrollTo({ top: workspace.offsetTop - 16, behavior: "smooth" });
  }

  async function bootstrap() {
    if (!API.configured()) {
      showConnectionError("Setup required: add your Apps Script web app URL to assets/config.js.");
      $("#contactId").innerHTML = '<option value="">Not connected</option>';
      $("#templateId").innerHTML = '<option value="">Not connected</option>';
      return;
    }

    try {
      const data = await API.post("bootstrap");
      state.contacts = data.contacts || [];
      state.templates = data.templates || [];
      state.stats = data.stats || null;
      state.memberNames = data.memberNames || [];
      renderContactOptions();
      renderTemplateOptions();
      renderNameSuggestions();
      renderStats();

      const rememberedName = normalizeName(localStorage.getItem("asmeSponsorFlowName"));
      if (rememberedName) {
        $("#requesterName").value = rememberedName;
        $("#requestLookupName").value = rememberedName;
      }
    } catch (error) {
      showConnectionError(error.message);
    }
  }

  function renderNameSuggestions() {
    $("#memberNameSuggestions").innerHTML = state.memberNames
      .map(name => `<option value="${escapeHtml(name)}"></option>`)
      .join("");
  }

  function renderContactOptions() {
    const select = $("#contactId");
    if (!state.contacts.length) {
      select.innerHTML = '<option value="">No verified contacts yet—suggest a sponsor instead</option>';
      return;
    }
    select.innerHTML = '<option value="">Choose a verified sponsor</option>' + state.contacts.map(contact => {
      const contactText = contact.contactName ? ` — ${escapeHtml(contact.contactName)}` : "";
      const history = contact.history || {};
      let indicator = "";
      if (history.activeCount) indicator = ` · ${history.activeCount} active`;
      else if (history.sentCount) indicator = ` · contacted ${history.sentCount}×`;
      const route = contact.outreachType === "FORM" ? " · application" : "";
      return `<option value="${escapeHtml(contact.id)}">${escapeHtml(contact.companyName)}${contactText}${escapeHtml(indicator + route)}</option>`;
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


  function formatHistoryDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
  }

  function renderSponsorInsight(contact) {
    const card = $("#sponsorInsightCard");
    if (!contact || (!contact.suggestedAsk && !contact.eligibility && !contact.personalizationIdea)) {
      card.classList.add("is-hidden");
      return;
    }

    $("#sponsorInsightTitle").textContent = `${contact.companyName} outreach brief`;
    $("#sponsorSuggestedAsk").textContent = contact.suggestedAsk || "Review the official opportunity and tailor a concrete request.";
    $("#sponsorEligibility").textContent = contact.eligibility || "Review the official program requirements before submitting.";
    $("#sponsorPersonalizationIdea").textContent = contact.personalizationIdea || "Connect the company’s products or mission to a specific EV-Kart engineering need.";

    const status = String(contact.validationStatus || "");
    $("#sponsorProgramBadge").textContent =
      status === "OFFICIAL_COMMUNITY_APPLICATION" ? "Official community application" :
      status === "OFFICIAL_ACADEMIC_CONTACT" ? "Official academic contact" :
      status ? "Official student program" : "Officer-verified sponsor";

    const routeLink = $("#sponsorRouteLink");
    if (contact.outreachUrl) {
      routeLink.href = contact.outreachUrl;
      routeLink.textContent = contact.outreachType === "FORM" ? "Open official application" : "View official program";
      routeLink.classList.remove("is-hidden");
    } else {
      routeLink.classList.add("is-hidden");
    }
    card.classList.remove("is-hidden");
  }

  function renderSponsorHistory(history, companyName = "") {
    const card = $("#sponsorHistoryCard");
    const badge = $("#sponsorHistoryBadge");
    const title = $("#sponsorHistoryTitle");
    const text = $("#sponsorHistoryText");
    const icon = $("#sponsorHistoryIcon");
    const acknowledgement = $("#duplicateAcknowledged");
    const acknowledgementWrap = $("#duplicateAckWrap");

    state.sponsorHistory = history || null;
    acknowledgement.checked = false;

    if (!history) {
      card.classList.add("is-hidden");
      acknowledgement.required = false;
      acknowledgementWrap.classList.add("is-hidden");
      return;
    }

    const name = companyName || "This sponsor";
    const sent = Number(history.sentCount || 0);
    const active = Number(history.activeCount || 0);
    const total = Number(history.totalCount || 0);

    card.className = "outreach-history";
    badge.className = "verification-badge";
    acknowledgement.required = total > 0;
    acknowledgementWrap.classList.toggle("is-hidden", total === 0);

    if (active > 0) {
      card.classList.add("is-warning");
      badge.classList.add("pending");
      badge.textContent = "Active outreach exists";
      icon.textContent = "!";
      title.textContent = `${name} already has ${active} active request${active === 1 ? "" : "s"}`;
      text.textContent = `${sent ? `${sent} earlier message${sent === 1 ? " was" : "s were"} also marked sent. ` : ""}Coordinate with the existing requester before creating another message.`;
    } else if (sent > 0) {
      card.classList.add("is-contacted");
      badge.classList.add("contacted");
      badge.textContent = `Contacted ${sent}×`;
      icon.textContent = "↗";
      title.textContent = `${name} has already received club outreach`;
      const dateText = formatHistoryDate(history.lastSentAt);
      text.textContent = `The club has marked ${sent} message${sent === 1 ? "" : "s"} sent${dateText ? `, most recently ${dateText}` : ""}. Use the follow-up template or confirm that this is a separate contact or opportunity.`;
    } else if (total > 0) {
      card.classList.add("is-warning");
      badge.classList.add("pending");
      badge.textContent = "Previous request found";
      icon.textContent = "•";
      title.textContent = `${name} has prior SponsorFlow history`;
      text.textContent = "Review with an officer before restarting or replacing the earlier request.";
    } else {
      card.classList.add("is-available");
      badge.classList.add("available");
      badge.textContent = "No prior outreach";
      icon.textContent = "✓";
      title.textContent = `${name} appears available for outreach`;
      text.textContent = "No matching SponsorFlow request was found by company, contact record, or email.";
    }

    card.classList.remove("is-hidden");
  }

  async function refreshSponsorContext() {
    if (state.revision) {
      renderSponsorInsight(null);
      renderSponsorHistory(null);
      return;
    }

    if (state.sponsorMode === "directory") {
      const contact = selectedContact();
      renderSponsorInsight(contact);
      renderSponsorHistory(contact ? contact.history : null, contact ? contact.companyName : "");
      if (contact?.recommendedTemplateId && !$("#templateId").value) {
        $("#templateId").value = contact.recommendedTemplateId;
        $("#templateId").dispatchEvent(new Event("change"));
      }
      return;
    }

    renderSponsorInsight(null);
    const companyName = $("#customCompanyName").value.trim();
    const contactEmail = $("#customContactEmail").value.trim();
    if (companyName.length < 2 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      renderSponsorHistory(null);
      return;
    }

    const sequence = ++state.historyCheckSequence;
    try {
      const history = await API.post("checkSponsorHistory", { companyName, contactEmail });
      if (sequence !== state.historyCheckSequence) return;
      renderSponsorHistory(history, companyName);
    } catch (error) {
      if (sequence !== state.historyCheckSequence) return;
      renderSponsorHistory(null);
    }
  }

  function useSponsorResearch() {
    const contact = selectedContact();
    if (!contact) return;
    if (contact.suggestedAsk && !$("#specificRequest").value.trim()) $("#specificRequest").value = contact.suggestedAsk;
    if (contact.recommendedTemplateId) {
      $("#templateId").value = contact.recommendedTemplateId;
      $("#templateId").dispatchEvent(new Event("change"));
    }
    setFormStatus("Suggested ask and template added. Use the research angle above to write a company-specific opening in your own words.", "success");
    if (!$("#personalizedConnection").value.trim()) $("#personalizedConnection").focus();
    updateQuality();
  }

  function selectedContact() {
    return state.contacts.find(item => item.id === $("#contactId").value) || null;
  }

  function selectedTemplate() {
    return state.templates.find(item => item.id === $("#templateId").value) || null;
  }

  function currentSponsor() {
    if (state.revision) {
      return {
        companyName: state.revision.companyName,
        contactName: state.revision.contactName,
        verification: state.revision.sponsorVerification
      };
    }
    if (state.sponsorMode === "custom") {
      return {
        companyName: $("#customCompanyName").value.trim(),
        contactName: $("#customContactName").value.trim(),
        verification: "UNVERIFIED"
      };
    }
    const contact = selectedContact();
    return contact ? { ...contact, verification: "VERIFIED" } : null;
  }

  function greetingName(contactName, companyName) {
    const first = String(contactName || "").trim().split(/\s+/)[0];
    return first || `${companyName || "Sponsor"} Team`;
  }

  function renderTemplateText(templateText, values) {
    return String(templateText || "").replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => values[key] ?? `{{${key}}}`);
  }

  function shortRequestedItem(value) {
    const clean = String(value || "").trim().replace(/[.!?]+$/, "");
    if (!clean) return "Engineering support request";
    const shortened = clean.length > 70 ? `${clean.slice(0, 67).trim()}…` : clean;
    return shortened.charAt(0).toUpperCase() + shortened.slice(1);
  }

  function setSponsorMode(mode) {
    if (state.revision) return;
    state.sponsorMode = mode === "custom" ? "custom" : "directory";
    $$('[data-sponsor-mode]').forEach(button => button.classList.toggle("is-active", button.dataset.sponsorMode === state.sponsorMode));

    const directory = state.sponsorMode === "directory";
    $("#verifiedSponsorFields").classList.toggle("is-hidden", !directory);
    $("#customSponsorFields").classList.toggle("is-hidden", directory);
    $("#contactId").disabled = !directory;
    $("#contactId").required = directory;
    ["#customCompanyName", "#customContactEmail"].forEach(selector => {
      $(selector).disabled = directory;
      $(selector).required = !directory;
    });
    $("#customContactName").disabled = directory;
    refreshSponsorContext();
    updateQuality();
  }

  function generateDraft() {
    const sponsor = currentSponsor();
    const template = selectedTemplate();
    const senderName = normalizeName($("#requesterName").value);
    if (!sponsor?.companyName || !template || !senderName) {
      setFormStatus("Enter your full name, choose or enter a sponsor, and select a template first.", "error");
      return;
    }

    const values = {
      company_name: sponsor.companyName,
      contact_first_name: greetingName(sponsor.contactName, sponsor.companyName),
      greeting_name: greetingName(sponsor.contactName, sponsor.companyName),
      sender_name: senderName,
      sender_role: $("#requesterRole").value.trim() || "Student Member",
      personalized_connection: $("#personalizedConnection").value.trim(),
      specific_request: $("#specificRequest").value.trim(),
      requested_item_short: shortRequestedItem($("#specificRequest").value),
      specific_use: $("#specificUse").value.trim(),
      selected_benefits: $("#selectedBenefits").value.trim(),
      custom_message: $("#customMessage").value.trim()
    };

    $("#emailSubject").value = renderTemplateText(template.subjectTemplate, values).replace(/\s+/g, " ").trim();
    $("#emailBody").value = renderTemplateText(template.bodyTemplate, values)
      .replace(/\n[ \t]+\n/g, "\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    setFormStatus("Draft generated. Edit it freely before submitting.", "success");
    updateQuality();
  }

  function qualityResult() {
    const subject = $("#emailSubject").value.trim();
    const body = $("#emailBody").value.trim();
    const company = currentSponsor()?.companyName || "";
    const checks = [
      { label: "Clear subject line", pass: subject.length >= 12 && subject.length <= 120, weight: 15 },
      { label: "No unresolved placeholders", pass: !/{{[^}]+}}/.test(`${subject} ${body}`), weight: 20 },
      { label: "Sponsor named in the message", pass: Boolean(company && body.toLowerCase().includes(company.toLowerCase())), weight: 15 },
      { label: "Specific request included", pass: $("#specificRequest").value.trim().length >= 15 || /seeking|asking|request|consider providing|consider supporting/i.test(body), weight: 15 },
      { label: "Student impact and sponsor return explained", pass: /support would|help us|allow our team|in return|would receive|can provide/i.test(body), weight: 15 },
      { label: "Low-friction next step", pass: /brief|15-minute|conversation|open to|would you|direct me|point me/i.test(body), weight: 10 },
      { label: "Professional length and club signature", pass: body.length >= 450 && body.length <= 4200 && body.includes("asmeindy@purdue.edu"), weight: 10 }
    ];
    return { checks, score: checks.reduce((sum, check) => sum + (check.pass ? check.weight : 0), 0) };
  }

  function updateQuality() {
    const { checks, score } = qualityResult();
    $("#qualityScore").textContent = score;
    $("#qualityBar").style.width = `${score}%`;
    $("#qualityLabel").textContent = score >= 85 ? "Sponsor-ready" : score >= 70 ? "Strong draft" : score >= 45 ? "Needs refinement" : "Needs content";
    $("#qualityChecks").innerHTML = checks.map(check => `<li class="${check.pass ? "is-pass" : ""}">${escapeHtml(check.label)}</li>`).join("");
  }

  function validateRevisionForm() {
    const name = normalizeName($("#requesterName").value);
    const subject = $("#emailSubject").value.trim();
    const body = $("#emailBody").value.trim();
    if (name.length < 2) {
      $("#requesterName").focus();
      setFormStatus("Enter the same full name used for the original request.", "error");
      return false;
    }
    if (subject.length < 10 || body.length < 100) {
      setFormStatus("The revised subject and body are incomplete.", "error");
      return false;
    }
    if (!$("#accuracyCheck").checked) {
      setFormStatus("Confirm that you checked the revised facts and benefits.", "error");
      return false;
    }
    return true;
  }

  async function submitRequest(event) {
    event.preventDefault();
    const { score } = qualityResult();

    if (state.revision) {
      if (!validateRevisionForm()) return;
    } else if (!event.currentTarget.reportValidity()) {
      return;
    }

    if (score < 70) {
      setFormStatus("Bring the quality score to at least 70 before submitting.", "error");
      return;
    }

    const sponsor = currentSponsor();
    const template = selectedTemplate();
    if (!state.revision && (!sponsor?.companyName || !template)) {
      setFormStatus("Choose or enter a sponsor and select a template.", "error");
      return;
    }

    if (!state.revision && Number(state.sponsorHistory?.totalCount || 0) > 0 && !$("#duplicateAcknowledged").checked) {
      setFormStatus("Review the prior-outreach warning and confirm that this is an intentional follow-up or separate opportunity.", "error");
      $("#duplicateAcknowledged").focus();
      return;
    }

    const button = $("#submitRequestButton");
    button.disabled = true;
    setFormStatus(state.revision ? "Submitting the revised draft…" : "Submitting for admin review…");

    try {
      const requesterName = normalizeName($("#requesterName").value);
      localStorage.setItem("asmeSponsorFlowName", requesterName);

      if (state.revision) {
        await API.post("reviseRequest", {
          requestId: state.revision.requestId,
          requesterName,
          requesterRole: $("#requesterRole").value.trim(),
          subject: $("#emailSubject").value.trim(),
          body: $("#emailBody").value.trim()
        });
        cancelRevision(false);
        setFormStatus("Revision submitted. The request is back in the officer review queue.", "success");
        $("#requestLookupName").value = requesterName;
        switchView("requests");
        return;
      }

      const payload = {
        requesterName,
        requesterRole: $("#requesterRole").value.trim(),
        sponsorMode: state.sponsorMode,
        contactId: state.sponsorMode === "directory" ? $("#contactId").value : "",
        customCompanyName: state.sponsorMode === "custom" ? $("#customCompanyName").value.trim() : "",
        customContactName: state.sponsorMode === "custom" ? $("#customContactName").value.trim() : "",
        customContactEmail: state.sponsorMode === "custom" ? $("#customContactEmail").value.trim() : "",
        duplicateAcknowledged: $("#duplicateAcknowledged").checked,
        templateId: template.id,
        subject: $("#emailSubject").value.trim(),
        body: $("#emailBody").value.trim()
      };
      const result = await API.post("createRequest", payload);
      $("#submittedName").textContent = requesterName;
      $("#submittedRequestId").textContent = result.requestId;
      const badge = $("#submittedVerification");
      badge.textContent = result.sponsorVerification === "VERIFIED" ? "Verified sponsor" : "Unverified sponsor — officer check required";
      badge.className = `verification-badge ${result.sponsorVerification === "VERIFIED" ? "verified" : "unverified"}`;
      $("#requestLookupName").value = requesterName;
      $("#submittedDialog").showModal();
      setFormStatus("Submitted successfully.", "success");
      await bootstrap();
      await refreshStats();
    } catch (error) {
      setFormStatus(error.message, "error");
    } finally {
      button.disabled = false;
    }
  }

  async function loadRequestsByName(nameValue) {
    const name = normalizeName(nameValue);
    const status = $("#requestLookupStatus");
    if (name.length < 2) {
      status.textContent = "Enter your full name.";
      status.className = "form-status is-error";
      return;
    }

    status.textContent = "Loading requests…";
    status.className = "form-status";
    $("#requestList").innerHTML = '<div class="empty-state"><p>Loading request history…</p></div>';
    $("#requestsEmpty").classList.add("is-hidden");

    try {
      const requests = await API.post("getRequestsByName", { requesterName: name });
      state.loadedRequests = requests || [];
      state.activeLookupName = name;
      localStorage.setItem("asmeSponsorFlowName", name);
      $("#requesterName").value = name;
      renderRequestList();
      status.textContent = `${state.loadedRequests.length} request${state.loadedRequests.length === 1 ? "" : "s"} filed under ${name}.`;
      status.className = "form-status is-success";
    } catch (error) {
      $("#requestList").innerHTML = "";
      $("#requestsEmpty").classList.remove("is-hidden");
      status.textContent = error.message;
      status.className = "form-status is-error";
    }
  }

  function renderRequestList() {
    const container = $("#requestList");
    if (!state.loadedRequests.length) {
      container.innerHTML = "";
      $("#requestsEmpty").classList.remove("is-hidden");
      $("#requestsEmpty h3").textContent = `No requests found for ${state.activeLookupName}`;
      $("#requestsEmpty p").textContent = "Check the spelling or start a new request.";
      return;
    }

    $("#requestsEmpty").classList.add("is-hidden");
    container.innerHTML = state.loadedRequests.map(renderRequestCard).join("");
    $$('[data-open-request]').forEach(button => button.addEventListener("click", () => openRequest(button.dataset.openRequest)));
  }

  function renderRequestCard(request) {
    const verification = request.sponsorVerification === "VERIFIED" ? "verified" : "unverified";
    const verificationLabel = request.sponsorVerification === "VERIFIED" ? "Verified sponsor" : "Unverified sponsor";
    return `<article class="request-card">
      <div class="request-card-top">
        <div><div class="badge-row"><span class="verification-badge ${verification}">${verificationLabel}</span>${request.outreachType === "FORM" ? '<span class="verification-badge research">Application route</span>' : ""}</div><h4>${escapeHtml(request.companyName)}</h4><p>${escapeHtml(request.templateName)}</p></div>
        <span class="status-badge status-${escapeHtml(request.status)}">${escapeHtml(statusLabel(request.status))}</span>
      </div>
      <div class="request-meta"><span>${escapeHtml(request.id)}</span><span>Revision ${escapeHtml(request.revisionNumber)}</span><span>${escapeHtml(formatDate(request.updatedAt))}</span></div>
      ${request.adminComment ? `<p class="admin-comment compact-comment">${escapeHtml(request.adminComment)}</p>` : ""}
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

  async function openRequest(requestId) {
    const detail = $("#requestDetail");
    detail.innerHTML = "<p>Loading request…</p>";
    $("#requestDialog").showModal();

    try {
      const request = await API.post("getRequestByName", { requestId, requesterName: state.activeLookupName });
      const verification = request.sponsorVerification === "VERIFIED" ? "verified" : "unverified";
      detail.innerHTML = `
        <div class="request-detail-header">
          <div><p class="eyebrow">${escapeHtml(request.id)}</p><h2>${escapeHtml(request.companyName)}</h2><p>${escapeHtml(request.contactName || "Sponsor contact")} · ${escapeHtml(request.templateName)}</p></div>
          <div class="detail-badges"><span class="verification-badge ${verification}">${request.sponsorVerification === "VERIFIED" ? "Verified sponsor" : "Unverified sponsor"}</span><span class="status-badge status-${escapeHtml(request.status)}">${escapeHtml(statusLabel(request.status))}</span></div>
        </div>
        <div class="request-detail-grid">
          <div class="detail-block"><span>Submitted by</span><strong>${escapeHtml(request.requesterName)}${request.requesterRole ? ` · ${escapeHtml(request.requesterRole)}` : ""}</strong></div>
          <div class="detail-block"><span>Last updated</span><strong>${escapeHtml(formatDate(request.updatedAt))}</strong></div>
        </div>
        ${request.adminComment ? `<div class="admin-comment"><strong>Officer comment</strong><br>${escapeHtml(request.adminComment)}</div>` : ""}
        <label class="field"><span>Subject</span><input value="${escapeHtml(request.subject)}" readonly></label>
        <div class="field"><span>Email body</span><div class="email-preview">${escapeHtml(request.body)}</div></div>
        <div class="field-grid two-col">
          <button id="copyRequestButton" class="button button-secondary" type="button">Copy email</button>
          ${request.status === "CHANGES_REQUESTED" ? '<button id="reviseRequestButton" class="button button-primary" type="button">Revise this draft</button>' : ""}
        </div>`;
      $("#copyRequestButton").addEventListener("click", () => navigator.clipboard.writeText(`Subject: ${request.subject}\n\n${request.body}`));
      if ($("#reviseRequestButton")) $("#reviseRequestButton").addEventListener("click", () => beginRevision(request));
    } catch (error) {
      detail.innerHTML = `<p class="form-status is-error">${escapeHtml(error.message)}</p>`;
    }
  }

  function beginRevision(request) {
    state.revision = {
      requestId: request.id,
      requesterName: request.requesterName,
      companyName: request.companyName,
      contactName: request.contactName,
      sponsorVerification: request.sponsorVerification,
      templateId: request.templateId
    };
    $("#requesterName").value = request.requesterName;
    $("#requesterRole").value = request.requesterRole || "";
    $("#emailSubject").value = request.subject;
    $("#emailBody").value = request.body;
    $("#sponsorChooser").classList.add("is-hidden");
    $("#revisionBanner").classList.remove("is-hidden");
    $("#revisionSponsorName").textContent = request.companyName;
    const badge = $("#revisionSponsorBadge");
    badge.textContent = request.sponsorVerification === "VERIFIED" ? "Verified sponsor" : "Unverified sponsor";
    badge.className = `verification-badge ${request.sponsorVerification === "VERIFIED" ? "verified" : "unverified"}`;
    $("#templateId").value = request.templateId || "";
    $("#templateId").disabled = true;
    $("#substancePanel").classList.add("revision-only");
    $("#generateDraftButton").disabled = true;
    $("#submitRequestButton").textContent = "Submit revised draft";
    $("#requestDialog").close();
    switchView("compose");
    setFormStatus("Revision mode: edit the final subject and body using the officer comment as your guide.");
    updateQuality();
  }

  function cancelRevision(clearStatus = true) {
    state.revision = null;
    $("#sponsorChooser").classList.remove("is-hidden");
    $("#revisionBanner").classList.add("is-hidden");
    $("#templateId").disabled = false;
    $("#substancePanel").classList.remove("revision-only");
    $("#generateDraftButton").disabled = false;
    $("#submitRequestButton").textContent = "Submit for admin review";
    if (clearStatus) setFormStatus("Revision canceled.");
    setSponsorMode(state.sponsorMode);
  }

  async function refreshStats() {
    try {
      const data = await API.post("bootstrap");
      state.stats = data.stats || null;
      state.memberNames = data.memberNames || [];
      renderNameSuggestions();
      renderStats();
    } catch {
      // The request itself succeeded; a statistics refresh failure should not interrupt the user.
    }
  }

  function renderStats() {
    const stats = state.stats || { totalRequests: 0, totalSent: 0, totalPending: 0, participatingMembers: 0, leadersSent: [], leadersPending: [], timeline: [] };
    $("#statTotalRequests").textContent = stats.totalRequests || 0;
    $("#statTotalSent").textContent = stats.totalSent || 0;
    $("#statTotalPending").textContent = stats.totalPending || 0;
    $("#statMembers").textContent = stats.participatingMembers || 0;
    $("#sentLeaders").innerHTML = renderLeaderboard(stats.leadersSent, "No emails have been marked sent yet.");
    $("#pendingLeaders").innerHTML = renderLeaderboard(stats.leadersPending, "No requests are currently active.");
    renderTimeline(stats.timeline || []);
  }

  function renderLeaderboard(items, emptyMessage) {
    if (!items?.length) return `<li class="leaderboard-empty">${escapeHtml(emptyMessage)}</li>`;
    return items.map((item, index) => `<li><span class="leader-rank">${index + 1}</span><strong>${escapeHtml(item.name)}</strong><span class="leader-count">${escapeHtml(item.count)}</span></li>`).join("");
  }

  function renderTimeline(points) {
    const container = $("#timelineChart");
    const total = points.length ? points[points.length - 1].cumulative : 0;
    $("#chartTotal").textContent = `${total} sent`;
    if (!points.length) {
      container.innerHTML = '<div class="chart-empty"><span>↗</span><p>The graph will appear after the first request is marked sent.</p></div>';
      return;
    }

    const width = 900;
    const height = 300;
    const left = 52;
    const right = 24;
    const top = 24;
    const bottom = 48;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const max = Math.max(total, 1);
    const x = index => points.length === 1 ? left + plotWidth / 2 : left + (index / (points.length - 1)) * plotWidth;
    const y = value => top + plotHeight - (value / max) * plotHeight;
    const path = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.cumulative).toFixed(1)}`).join(" ");
    const area = `${path} L${x(points.length - 1).toFixed(1)},${top + plotHeight} L${x(0).toFixed(1)},${top + plotHeight} Z`;
    const labelEvery = Math.max(1, Math.ceil(points.length / 6));
    const labels = points.map((point, index) => {
      if (index % labelEvery !== 0 && index !== points.length - 1) return "";
      const [year, month] = point.month.split("-").map(Number);
      const label = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(new Date(Date.UTC(year, month - 1, 1)));
      return `<text x="${x(index)}" y="${height - 15}" text-anchor="middle">${escapeHtml(label)}</text>`;
    }).join("");
    const circles = points.map((point, index) => `<circle cx="${x(index)}" cy="${y(point.cumulative)}" r="4"><title>${escapeHtml(point.month)}: ${point.cumulative} sent total</title></circle>`).join("");
    const gridValues = [0, Math.ceil(max / 2), max].filter((value, index, arr) => arr.indexOf(value) === index);
    const grid = gridValues.map(value => `<g><line x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}"></line><text x="${left - 12}" y="${y(value) + 4}" text-anchor="end">${value}</text></g>`).join("");

    container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true"><g class="chart-grid">${grid}</g><path class="chart-area" d="${area}"></path><path class="chart-line" d="${path}"></path><g class="chart-points">${circles}</g><g class="chart-labels">${labels}</g></svg>`;
  }

  function wireEvents() {
    $$('[data-view-button]').forEach(button => button.addEventListener("click", () => switchView(button.dataset.viewButton)));
    $$('[data-sponsor-mode]').forEach(button => button.addEventListener("click", () => setSponsorMode(button.dataset.sponsorMode)));

    $("#templateId").addEventListener("change", () => {
      const template = selectedTemplate();
      const note = $("#templateDescription");
      if (template?.description) {
        note.textContent = template.description;
        note.classList.remove("is-hidden");
      } else {
        note.classList.add("is-hidden");
      }
    });

    $("#benefitPreset").addEventListener("change", event => {
      if (event.target.value) $("#selectedBenefits").value = event.target.value;
      updateQuality();
    });
    $("#contactId").addEventListener("change", refreshSponsorContext);
    let customHistoryTimer;
    ["#customCompanyName", "#customContactEmail"].forEach(selector => $(selector).addEventListener("input", () => {
      clearTimeout(customHistoryTimer);
      customHistoryTimer = setTimeout(refreshSponsorContext, 450);
    }));
    $("#useSponsorResearchButton").addEventListener("click", useSponsorResearch);
    $("#generateDraftButton").addEventListener("click", generateDraft);
    $("#composeForm").addEventListener("submit", submitRequest);
    $("#requestsLookupForm").addEventListener("submit", event => {
      event.preventDefault();
      loadRequestsByName($("#requestLookupName").value);
    });
    $("#cancelRevisionButton").addEventListener("click", () => cancelRevision());
    ["#emailSubject", "#emailBody", "#specificRequest", "#specificUse", "#selectedBenefits", "#customCompanyName", "#contactId"].forEach(selector => $(selector).addEventListener("input", updateQuality));
    $$('[data-close-dialog]').forEach(button => button.addEventListener("click", () => document.getElementById(button.dataset.closeDialog).close()));
    $("#goToRequestsButton").addEventListener("click", () => setTimeout(() => switchView("requests"), 0));
  }

  wireEvents();
  setSponsorMode("directory");
  updateQuality();
  bootstrap();
})();
