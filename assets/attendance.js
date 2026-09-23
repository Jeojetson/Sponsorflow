(() => {
  "use strict";

  const API = window.SponsorFlowAPI;
  const $ = selector => document.querySelector(selector);
  const PUBLIC_CACHE_KEY = "asmeAttendancePublicCacheV21";
  const PUBLIC_CACHE_MAX_AGE = 10 * 60 * 1000;
  const PUBLIC_REFRESH_AFTER = 60 * 1000;
  const state = {
    meetings: [],
    teams: [],
    adminToken: "",
    adminMeetings: [],
    records: [],
    rosterMeetingId: "",
    publicLoadedAt: 0,
    publicLoadPromise: null,
    initialMeetingApplied: false
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindEvents();
    restoreName();
    state.adminToken = safeSessionGet("asmeAttendanceAdminToken");
    if (!API || !API.configured()) {
      showConnectionError("SponsorFlow is not connected. Add the Apps Script web app URL to assets/config.js.");
      return;
    }
    const usedCache = restorePublicCache();
    if (usedCache) {
      setStatus($("#attendanceCheckInStatus"), "Refreshing meeting list…");
      loadPublic({ background: true });
    } else {
      await loadPublic();
    }
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && Date.now() - state.publicLoadedAt > PUBLIC_REFRESH_AFTER) {
        loadPublic({ background: true });
      }
    });
  }

  function bindEvents() {
    $("#attendanceCheckInForm").addEventListener("submit", checkIn);
    $("#attendanceName").addEventListener("change", saveName);
    $("#attendanceMeeting").addEventListener("change", renderSelectedMeeting);
    $("#attendanceManageOpen").addEventListener("click", openAdmin);
    $("#attendanceSuccessDone")?.addEventListener("click", closeSuccess);
    $("#attendanceSuccessDialog")?.addEventListener("click", event => { if (event.target === $("#attendanceSuccessDialog")) closeSuccess(); });
    $("#attendanceSuccessDialog")?.addEventListener("close", () => { document.body.classList.remove("dialog-open"); $(".attendance-checkin-card")?.classList.remove("has-success"); });
    $$('[data-attendance-admin-close]').forEach(button => button.addEventListener("click", closeAdmin));
    $("#attendanceAdminDialog").addEventListener("click", event => { if (event.target === $("#attendanceAdminDialog")) closeAdmin(); });
    $("#attendanceAdminDialog").addEventListener("close", () => document.body.classList.remove("dialog-open"));
    $("#attendanceAdminLoginButton").addEventListener("click", adminLogin);
    $("#attendanceAdminPassword").addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); adminLogin(); } });
    $("#attendanceAdminLogout").addEventListener("click", adminLogout);
    $("#attendanceNewMeeting").addEventListener("click", () => resetMeetingForm());
    $("#attendanceMeetingForm").addEventListener("submit", saveMeeting);
    $("#attendanceMeetingArchive").addEventListener("click", archiveMeeting);
    $("#attendanceRosterClose").addEventListener("click", closeRoster);
    $("#attendanceRosterCsv").addEventListener("click", exportRosterCsv);
  }

  function $$(selector) { return Array.from(document.querySelectorAll(selector)); }

  async function loadPublic({ background = false } = {}) {
    if (state.publicLoadPromise) return state.publicLoadPromise;
    if (!background && !state.meetings.length) setStatus($("#attendanceCheckInStatus"), "Loading active meetings…");
    state.publicLoadPromise = (async () => {
      try {
        const data = await API.post("attendanceBootstrap");
        applyPublicData(data);
        savePublicCache(data);
        state.publicLoadedAt = Date.now();
        showConnectionError("");
        setStatus($("#attendanceCheckInStatus"), "");
        return data;
      } catch (error) {
        if (state.meetings.length) {
          setStatus($("#attendanceCheckInStatus"), "Showing the saved meeting list while the live service reconnects.");
          return null;
        }
        showConnectionError(error.message || "Attendance could not load.");
        setStatus($("#attendanceCheckInStatus"), "Unable to load meetings.", "error");
        return null;
      } finally {
        state.publicLoadPromise = null;
      }
    })();
    return state.publicLoadPromise;
  }

  function applyPublicData(data) {
    state.meetings = Array.isArray(data?.meetings) ? data.meetings : [];
    state.teams = Array.isArray(data?.teams) ? data.teams : [];
    renderPublicMeetings();
  }

  function restorePublicCache() {
    try {
      const raw = window.SponsorFlowStorage.getItem(PUBLIC_CACHE_KEY);
      if (!raw) return false;
      const cached = JSON.parse(raw);
      if (!cached || !cached.data || !cached.savedAt || Date.now() - Number(cached.savedAt) > PUBLIC_CACHE_MAX_AGE) return false;
      applyPublicData(cached.data);
      return true;
    } catch (_) {
      return false;
    }
  }

  function savePublicCache(data) {
    try {
      window.SponsorFlowStorage.setItem(PUBLIC_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: { meetings: data.meetings || [], teams: data.teams || [] } }));
    } catch (_) {}
  }

  function renderPublicMeetings() {
    const select = $("#attendanceMeeting");
    const previousMeeting = select.value || "";
    const queryMeeting = new URLSearchParams(location.search).get("meeting") || "";
    select.innerHTML = state.meetings.length
      ? '<option value="">Choose a meeting…</option>' + state.meetings.map(meeting => `<option value="${esc(meeting.id)}">${esc(meeting.title)} · ${esc(formatDate(meeting.meetingDate))}</option>`).join("")
      : '<option value="">No meetings are open</option>';
    if (!state.initialMeetingApplied && queryMeeting && state.meetings.some(meeting => meeting.id === queryMeeting)) select.value = queryMeeting;
    else if (previousMeeting && state.meetings.some(meeting => meeting.id === previousMeeting)) select.value = previousMeeting;
    else if (state.meetings.length === 1) select.value = state.meetings[0].id;
    if (state.meetings.length) state.initialMeetingApplied = true;
    $("#attendanceMeetingCount").textContent = String(state.meetings.length);
    $("#attendanceMeetingList").innerHTML = state.meetings.length
      ? state.meetings.map(meetingCard).join("")
      : '<div class="attendance-empty"><span>◇</span><strong>No open check-ins</strong><p>An officer can open a meeting when check-in starts.</p></div>';
    $("#attendanceMeetingList").querySelectorAll("[data-meeting-select]").forEach(button => button.addEventListener("click", () => {
      select.value = button.dataset.meetingSelect;
      renderSelectedMeeting();
      $("#attendanceCode").focus();
    }));
    renderSelectedMeeting();
  }

  function meetingCard(meeting) {
    return `<button class="attendance-meeting-card" type="button" data-meeting-select="${esc(meeting.id)}">
      <span class="attendance-meeting-date"><strong>${esc(dayNumber(meeting.meetingDate))}</strong><small>${esc(monthShort(meeting.meetingDate))}</small></span>
      <span class="attendance-meeting-copy"><strong>${esc(meeting.title)}</strong><small>${esc(meeting.teamName)}${meeting.startTime ? ` · ${esc(formatTime(meeting.startTime))}` : ""}${meeting.location ? ` · ${esc(meeting.location)}` : ""}</small></span>
      <span class="attendance-meeting-arrow">→</span>
    </button>`;
  }

  function renderSelectedMeeting() {
    const meeting = state.meetings.find(item => item.id === $("#attendanceMeeting").value);
    const host = $("#attendanceMeetingSummary");
    if (!meeting) { host.classList.add("is-hidden"); host.innerHTML = ""; return; }
    host.innerHTML = `<div><span class="team-badge">${esc(meeting.teamName)}</span><strong>${esc(formatDateLong(meeting.meetingDate))}${meeting.startTime ? ` · ${esc(formatTime(meeting.startTime))}` : ""}</strong></div>
      <p>${meeting.location ? `<b>${esc(meeting.location)}</b> · ` : ""}${esc(meeting.notes || "Enter the password announced by the meeting leader.")}</p>`;
    host.classList.remove("is-hidden");
  }

  async function checkIn(event) {
    event.preventDefault();
    const button = $("#attendanceCheckInButton");
    const memberName = cleanName($("#attendanceName").value);
    const meetingId = $("#attendanceMeeting").value;
    const code = $("#attendanceCode").value;
    if (!memberName) return setStatus($("#attendanceCheckInStatus"), "Enter your full name.", "error");
    if (!meetingId) return setStatus($("#attendanceCheckInStatus"), "Choose the meeting you are attending.", "error");
    if (!code.trim()) return setStatus($("#attendanceCheckInStatus"), "Enter the meeting password.", "error");
    saveName();
    busy(button, true, "Checking in…");
    try {
      const result = await API.post("attendanceCheckIn", { memberName, meetingId, code });
      $("#attendanceCode").value = "";
      const when = result.record?.checkedInAt ? formatDateTime(result.record.checkedInAt) : "now";
      const meeting = state.meetings.find(item => item.id === meetingId);
      setStatus($("#attendanceCheckInStatus"), result.duplicate ? `Already checked in — ${when}.` : `Checked in — ${when}.`, "success");
      showSuccess({ memberName, meeting, when, duplicate: Boolean(result.duplicate) });
    } catch (error) {
      setStatus($("#attendanceCheckInStatus"), error.message || "Check-in failed.", "error");
    } finally {
      busy(button, false, "Check in");
    }
  }

  function restoreName() {
    let value = "";
    try { value = window.SponsorFlowStorage.getItem("asmePlannerName") || ""; } catch (_) {}
    $("#attendanceName").value = value;
    $("#attendanceAdminName").value = value;
  }

  function saveName() {
    const value = cleanName($("#attendanceName").value);
    if (!value) return;
    $("#attendanceName").value = value;
    if (!$("#attendanceAdminName").value) $("#attendanceAdminName").value = value;
    try { window.SponsorFlowIdentity.save(value); } catch (_) {}
  }

  async function openAdmin() {
    showDialog($("#attendanceAdminDialog"));
    if (state.adminToken) {
      try { await loadAdminData(); return; } catch (_) { clearAdminToken(); }
    }
    showAdminLogin();
  }

  async function adminLogin() {
    const password = $("#attendanceAdminPassword").value;
    if (!password) return setStatus($("#attendanceAdminLoginStatus"), "Enter the SponsorFlow admin password.", "error");
    const button = $("#attendanceAdminLoginButton");
    busy(button, true, "Signing in…");
    try {
      const result = await API.post("attendanceAdminLogin", { password });
      state.adminToken = result.token || "";
      safeSessionSet("asmeAttendanceAdminToken", state.adminToken);
      $("#attendanceAdminPassword").value = "";
      setStatus($("#attendanceAdminLoginStatus"), "");
      await loadAdminData();
    } catch (error) {
      setStatus($("#attendanceAdminLoginStatus"), error.message || "Admin login failed.", "error");
    } finally { busy(button, false, "Sign in"); }
  }

  async function loadAdminData() {
    if (!state.adminToken) throw new Error("Admin session required.");
    const data = await API.post("attendanceAdminData", { token: state.adminToken });
    state.adminMeetings = Array.isArray(data.meetings) ? data.meetings : [];
    state.records = Array.isArray(data.records) ? data.records : [];
    state.teams = Array.isArray(data.teams) ? data.teams : state.teams;
    showAdminWorkspace();
    renderTeamOptions();
    renderAdminMeetings();
    if (!$("#attendanceMeetingId").value) resetMeetingForm();
    if (state.rosterMeetingId) renderRoster(state.rosterMeetingId);
  }

  function showAdminLogin() {
    $("#attendanceAdminLogin").classList.remove("is-hidden");
    $("#attendanceAdminWorkspace").classList.add("is-hidden");
    setTimeout(() => $("#attendanceAdminPassword").focus(), 60);
  }

  function showAdminWorkspace() {
    $("#attendanceAdminLogin").classList.add("is-hidden");
    $("#attendanceAdminWorkspace").classList.remove("is-hidden");
  }

  function adminLogout() {
    clearAdminToken();
    state.adminMeetings = [];
    state.records = [];
    state.rosterMeetingId = "";
    showAdminLogin();
  }

  function clearAdminToken() {
    state.adminToken = "";
    try { sessionStorage.removeItem("asmeAttendanceAdminToken"); } catch (_) {}
  }

  function renderTeamOptions() {
    const select = $("#attendanceMeetingTeam");
    const current = select.value;
    select.innerHTML = '<option value="">Club-wide</option>' + state.teams.map(team => `<option value="${esc(team.id)}">${esc(team.name)}</option>`).join("");
    if ([...select.options].some(option => option.value === current)) select.value = current;
  }

  function resetMeetingForm() {
    $("#attendanceMeetingForm").reset();
    $("#attendanceMeetingId").value = "";
    $("#attendanceMeetingDate").value = todayText();
    $("#attendanceMeetingActive").checked = true;
    $("#attendanceMeetingFormTitle").textContent = "New meeting";
    $("#attendanceMeetingFormBadge").textContent = "Open";
    $("#attendanceMeetingArchive").classList.add("is-hidden");
    $("#attendanceMeetingCodeHelp").textContent = "Required for a new meeting. Members enter this password to check in.";
    setStatus($("#attendanceMeetingFormStatus"), "");
  }

  function editMeeting(id) {
    const meeting = state.adminMeetings.find(item => item.id === id);
    if (!meeting) return;
    $("#attendanceMeetingId").value = meeting.id;
    $("#attendanceMeetingTitle").value = meeting.title || "";
    $("#attendanceMeetingDate").value = meeting.meetingDate || "";
    const teamSelect = $("#attendanceMeetingTeam");
    if (meeting.teamId && ![...teamSelect.options].some(option => option.value === meeting.teamId)) {
      teamSelect.add(new Option(meeting.teamName || "Previous team", meeting.teamId));
    }
    teamSelect.value = meeting.teamId || "";
    $("#attendanceMeetingStart").value = meeting.startTime || "";
    $("#attendanceMeetingEnd").value = meeting.endTime || "";
    $("#attendanceMeetingLocation").value = meeting.location || "";
    $("#attendanceMeetingCode").value = "";
    $("#attendanceMeetingNotes").value = meeting.notes || "";
    $("#attendanceMeetingActive").checked = Boolean(meeting.active);
    $("#attendanceMeetingFormTitle").textContent = meeting.title;
    $("#attendanceMeetingFormBadge").textContent = meeting.active ? "Open" : "Closed";
    $("#attendanceMeetingArchive").classList.remove("is-hidden");
    $("#attendanceMeetingCodeHelp").textContent = "Leave blank to keep the current meeting password, or enter a new one to rotate it.";
    setStatus($("#attendanceMeetingFormStatus"), "");
    $("#attendanceMeetingTitle").focus();
  }

  async function saveMeeting(event) {
    event.preventDefault();
    const button = $("#attendanceMeetingSave");
    const payload = {
      token: state.adminToken,
      actorName: cleanName($("#attendanceAdminName").value) || "SponsorFlow Admin",
      id: $("#attendanceMeetingId").value,
      title: $("#attendanceMeetingTitle").value,
      meetingDate: $("#attendanceMeetingDate").value,
      teamId: $("#attendanceMeetingTeam").value,
      startTime: $("#attendanceMeetingStart").value,
      endTime: $("#attendanceMeetingEnd").value,
      location: $("#attendanceMeetingLocation").value,
      code: $("#attendanceMeetingCode").value,
      notes: $("#attendanceMeetingNotes").value,
      active: $("#attendanceMeetingActive").checked
    };
    busy(button, true, "Saving…");
    try {
      const saved = await API.post("attendanceSaveMeeting", payload);
      $("#attendanceMeetingId").value = saved.id;
      $("#attendanceMeetingCode").value = "";
      await loadAdminData();
      editMeeting(saved.id);
      await loadPublic();
      setStatus($("#attendanceMeetingFormStatus"), `${saved.title} saved. ${saved.active ? "Check-in is open." : "Check-in is closed."}`, "success");
    } catch (error) {
      if (/session/i.test(error.message || "")) { clearAdminToken(); showAdminLogin(); }
      setStatus($("#attendanceMeetingFormStatus"), error.message || "Meeting could not be saved.", "error");
    } finally { busy(button, false, "Save meeting"); }
  }

  async function archiveMeeting() {
    const id = $("#attendanceMeetingId").value;
    if (!id) return;
    const meeting = state.adminMeetings.find(item => item.id === id);
    if (!window.confirm(`Archive “${meeting?.title || "this meeting"}”? Attendance records will remain available in the sheet.`)) return;
    try {
      await API.post("attendanceArchiveMeeting", { token: state.adminToken, actorName: cleanName($("#attendanceAdminName").value), meetingId: id });
      resetMeetingForm();
      closeRoster();
      await loadAdminData();
      await loadPublic();
    } catch (error) { setStatus($("#attendanceMeetingFormStatus"), error.message || "Meeting could not be archived.", "error"); }
  }

  function renderAdminMeetings() {
    const host = $("#attendanceAdminMeetingList");
    if (!state.adminMeetings.length) {
      host.innerHTML = '<div class="attendance-empty compact"><span>◇</span><strong>No meetings yet</strong><p>Create the first attendance meeting.</p></div>';
      return;
    }
    host.innerHTML = state.adminMeetings.map(meeting => {
      const stateLabel = meeting.archived ? "Archived" : meeting.active ? "Open" : "Closed";
      const stateClass = meeting.archived ? "is-archived" : meeting.active ? "is-open" : "is-closed";
      return `<article class="attendance-admin-meeting">
        <div class="attendance-admin-meeting-main"><span class="attendance-state-pill ${stateClass}">${stateLabel}</span><strong>${esc(meeting.title)}</strong><small>${esc(formatDate(meeting.meetingDate))}${meeting.startTime ? ` · ${esc(formatTime(meeting.startTime))}` : ""} · ${esc(meeting.teamName)}</small></div>
        <div class="attendance-admin-meeting-count"><strong>${Number(meeting.attendanceCount || 0)}</strong><span>present</span></div>
        <div class="attendance-admin-meeting-actions"><button class="button button-secondary button-small" type="button" data-attendance-edit="${esc(meeting.id)}">${meeting.archived ? "Restore / edit" : "Edit"}</button><button class="button button-ghost button-small" type="button" data-attendance-roster="${esc(meeting.id)}">Roster</button></div>
      </article>`;
    }).join("");
    host.querySelectorAll("[data-attendance-edit]").forEach(button => button.addEventListener("click", () => editMeeting(button.dataset.attendanceEdit)));
    host.querySelectorAll("[data-attendance-roster]").forEach(button => button.addEventListener("click", () => renderRoster(button.dataset.attendanceRoster)));
  }

  function renderRoster(meetingId) {
    const meeting = state.adminMeetings.find(item => item.id === meetingId);
    if (!meeting) return;
    state.rosterMeetingId = meetingId;
    const records = state.records.filter(record => record.meetingId === meetingId).sort((a, b) => String(a.memberName).localeCompare(String(b.memberName)));
    $("#attendanceRosterTitle").textContent = meeting.title;
    $("#attendanceRosterMeta").textContent = `${formatDateLong(meeting.meetingDate)} · ${records.length} member${records.length === 1 ? "" : "s"} checked in`;
    $("#attendanceRosterList").innerHTML = records.length
      ? records.map((record, index) => `<div class="attendance-roster-row"><span class="attendance-roster-number">${index + 1}</span><span class="attendance-roster-name"><strong>${esc(record.memberName)}</strong><small>${esc(formatDateTime(record.checkedInAt))}</small></span><button class="attendance-remove-record" type="button" data-record-remove="${esc(record.id)}" aria-label="Remove ${esc(record.memberName)} from attendance">Remove</button></div>`).join("")
      : '<div class="attendance-empty compact"><span>◇</span><strong>No check-ins yet</strong><p>Check-ins will appear here as members sign in.</p></div>';
    $("#attendanceRosterList").querySelectorAll("[data-record-remove]").forEach(button => button.addEventListener("click", () => removeAttendanceRecord(button.dataset.recordRemove)));
    $("#attendanceRosterPanel").classList.remove("is-hidden");
    $("#attendanceRosterPanel").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function removeAttendanceRecord(recordId) {
    const record = state.records.find(item => item.id === recordId);
    if (!window.confirm(`Remove ${record?.memberName || "this member"} from this meeting roster?`)) return;
    try {
      await API.post("attendanceRemoveRecord", { token: state.adminToken, recordId });
      await loadAdminData();
    } catch (error) { window.alert(error.message || "Attendance record could not be removed."); }
  }

  function closeRoster() {
    state.rosterMeetingId = "";
    $("#attendanceRosterPanel").classList.add("is-hidden");
  }

  function exportRosterCsv() {
    const meeting = state.adminMeetings.find(item => item.id === state.rosterMeetingId);
    if (!meeting) return;
    const records = state.records.filter(record => record.meetingId === meeting.id).sort((a, b) => String(a.memberName).localeCompare(String(b.memberName)));
    const rows = [["Meeting", "Date", "Member", "Checked in at"], ...records.map(record => [meeting.title, meeting.meetingDate, record.memberName, record.checkedInAt])];
    downloadFile(`${slug(meeting.title)}-attendance.csv`, rows.map(row => row.map(csvCell).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  }

  function showSuccess({ memberName, meeting, when, duplicate }) {
    const dialog = $("#attendanceSuccessDialog");
    if (!dialog) return;
    $("#attendanceSuccessTitle").textContent = duplicate ? "Already checked in" : "You’re checked in";
    $("#attendanceSuccessMessage").textContent = duplicate ? `${memberName}, your attendance was already recorded.` : `${memberName}, your attendance was recorded.`;
    $("#attendanceSuccessMeeting").textContent = meeting?.title || "Meeting";
    $("#attendanceSuccessMeta").textContent = [meeting?.teamName, meeting?.location, when].filter(Boolean).join(" · ");
    $(".attendance-checkin-card")?.classList.add("has-success");
    document.body.classList.add("dialog-open");
    dialog.showModal();
  }

  function closeSuccess() {
    const dialog = $("#attendanceSuccessDialog");
    if (dialog?.open) dialog.close();
    document.body.classList.remove("dialog-open");
    $(".attendance-checkin-card")?.classList.remove("has-success");
  }

  function closeAdmin() { $("#attendanceAdminDialog").close(); document.body.classList.remove("dialog-open"); }
  function showDialog(dialog) { document.body.classList.add("dialog-open"); dialog.showModal(); }

  function showConnectionError(message) {
    const host = $("#attendanceConnectionBanner");
    host.textContent = message || "";
    host.classList.toggle("is-hidden", !message);
  }
  function setStatus(host, message, tone = "") { host.textContent = message || ""; host.className = `form-status${tone ? ` is-${tone}` : ""}`; }
  function busy(button, active, label) { button.disabled = active; button.textContent = label; }
  function cleanName(value) { return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80); }
  function todayText() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
  function parseDate(value) { const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : null; }
  function formatDate(value) { const d = parseDate(value); return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Date TBD"; }
  function formatDateLong(value) { const d = parseDate(value); return d ? d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "Date TBD"; }
  function dayNumber(value) { const d = parseDate(value); return d ? String(d.getDate()) : "—"; }
  function monthShort(value) { const d = parseDate(value); return d ? d.toLocaleDateString("en-US", { month: "short" }).toUpperCase() : ""; }
  function formatTime(value) { const m = String(value || "").match(/^(\d{1,2}):(\d{2})/); if (!m) return ""; return new Date(2000,0,1,Number(m[1]),Number(m[2])).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
  function formatDateTime(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? "recently" : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
  function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]); }
  function safeSessionGet(key) { try { return sessionStorage.getItem(key) || ""; } catch (_) { return ""; } }
  function safeSessionSet(key, value) { try { sessionStorage.setItem(key, value); } catch (_) {} }
  function slug(value) { return String(value || "attendance").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "attendance"; }
  function csvCell(value) { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
  function downloadFile(name, body, type) { const blob = new Blob([body], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 500); }
  window.addEventListener('sponsorflow:identity', () => { restoreName(); });
})();
