(() => {
  "use strict";

  const API = window.SponsorFlowAPI;
  const $ = selector => document.querySelector(selector);
  const state = {
    token: "",
    meetings: [],
    records: [],
    teams: [],
    filteredMeetings: [],
    filteredRecords: []
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindEvents();
    state.token = safeSessionGet("asmeAttendanceAdminToken");
    if (!API || !API.configured()) {
      showConnectionError("SponsorFlow is not connected. Add the Apps Script web app URL to assets/config.js.");
      return;
    }
    if (state.token) {
      try {
        await loadData();
        return;
      } catch (_) {
        clearToken();
      }
    }
    showLogin();
  }

  function bindEvents() {
    $("#attendanceInsightsLoginButton").addEventListener("click", login);
    $("#attendanceInsightsPassword").addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); login(); }
    });
    $("#attendanceInsightsRefresh").addEventListener("click", async () => {
      if (!state.token) return showLogin();
      await loadData(true);
    });
    $("#attendanceInsightsRange").addEventListener("change", applyFilters);
    $("#attendanceInsightsTeam").addEventListener("change", applyFilters);
    $("#attendanceMemberSearch").addEventListener("input", renderMembers);
    $("#attendanceInsightsExport").addEventListener("click", exportCsv);
    $("#attendanceInsightsLock").addEventListener("click", () => { clearToken(); showLogin(); });
  }

  async function login() {
    const password = $("#attendanceInsightsPassword").value;
    if (!password) return setStatus($("#attendanceInsightsLoginStatus"), "Enter the SponsorFlow admin password.", "error");
    const button = $("#attendanceInsightsLoginButton");
    busy(button, true, "Unlocking…");
    try {
      const result = await API.post("attendanceAdminLogin", { password });
      state.token = result.token || "";
      safeSessionSet("asmeAttendanceAdminToken", state.token);
      $("#attendanceInsightsPassword").value = "";
      setStatus($("#attendanceInsightsLoginStatus"), "");
      await loadData();
    } catch (error) {
      setStatus($("#attendanceInsightsLoginStatus"), error.message || "Admin login failed.", "error");
    } finally {
      busy(button, false, "Unlock dashboard");
    }
  }

  async function loadData(showRefreshState = false) {
    if (!state.token) throw new Error("Admin session required.");
    const refreshButton = $("#attendanceInsightsRefresh");
    if (showRefreshState) busy(refreshButton, true, "Refreshing…");
    try {
      const data = await API.post("attendanceAdminData", { token: state.token });
      state.meetings = Array.isArray(data.meetings) ? data.meetings : [];
      state.records = Array.isArray(data.records) ? data.records : [];
      state.teams = Array.isArray(data.teams) ? data.teams : [];
      showWorkspace();
      renderTeamFilter();
      applyFilters();
      showConnectionError("");
    } catch (error) {
      if (/session|admin/i.test(error.message || "")) {
        clearToken();
        showLogin();
      }
      showConnectionError(error.message || "Attendance analytics could not load.");
      throw error;
    } finally {
      if (showRefreshState) busy(refreshButton, false, "Refresh data");
    }
  }

  function showLogin() {
    $("#attendanceInsightsLogin").classList.remove("is-hidden");
    $("#attendanceInsightsWorkspace").classList.add("is-hidden");
    setTimeout(() => $("#attendanceInsightsPassword").focus(), 60);
  }

  function showWorkspace() {
    $("#attendanceInsightsLogin").classList.add("is-hidden");
    $("#attendanceInsightsWorkspace").classList.remove("is-hidden");
  }

  function renderTeamFilter() {
    const select = $("#attendanceInsightsTeam");
    const current = select.value || "all";
    const meetingTeams = new Map();
    state.meetings.forEach(meeting => meetingTeams.set(meeting.teamId || "club", meeting.teamName || "Club-wide"));
    const options = [...meetingTeams.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    select.innerHTML = '<option value="all">All meetings</option>' + options.map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join("");
    if ([...select.options].some(option => option.value === current)) select.value = current;
  }

  function applyFilters() {
    const range = $("#attendanceInsightsRange").value;
    const team = $("#attendanceInsightsTeam").value;
    const today = dayStart(new Date());
    const cutoff = range === "all" ? null : new Date(today.getTime() - Number(range) * 86400000);

    state.filteredMeetings = state.meetings.filter(meeting => {
      const date = parseDate(meeting.meetingDate);
      if (!date || date > today) return false;
      if (cutoff && date < cutoff) return false;
      if (team !== "all" && (meeting.teamId || "club") !== team) return false;
      return true;
    }).sort(compareMeetingsAsc);

    const ids = new Set(state.filteredMeetings.map(meeting => meeting.id));
    state.filteredRecords = state.records.filter(record => ids.has(record.meetingId));
    renderAll();
  }

  function renderAll() {
    const metrics = calculateMetrics();
    renderMetrics(metrics);
    renderTrend(metrics);
    renderRecentMeetings(metrics);
    renderMembers();
    renderTeamBreakdown(metrics);
    renderMeetingHistory(metrics);
  }

  function calculateMetrics() {
    const counts = new Map();
    state.filteredMeetings.forEach(meeting => counts.set(meeting.id, 0));
    state.filteredRecords.forEach(record => counts.set(record.meetingId, (counts.get(record.meetingId) || 0) + 1));

    const meetings = state.filteredMeetings.map(meeting => Object.assign({}, meeting, { count: counts.get(meeting.id) || 0 }));
    const members = new Map();
    state.filteredRecords.forEach(record => {
      const key = normalizeName(record.memberName);
      const meeting = meetings.find(item => item.id === record.meetingId);
      if (!key || !meeting) return;
      const entry = members.get(key) || { key, name: record.memberName, count: 0, firstDate: meeting.meetingDate, lastDate: meeting.meetingDate, meetings: new Set() };
      entry.count += 1;
      entry.meetings.add(record.meetingId);
      if (meeting.meetingDate < entry.firstDate) entry.firstDate = meeting.meetingDate;
      if (meeting.meetingDate > entry.lastDate) { entry.lastDate = meeting.meetingDate; entry.name = record.memberName; }
      members.set(key, entry);
    });

    const turnout = meetings.map(meeting => meeting.count);
    const total = turnout.reduce((sum, value) => sum + value, 0);
    const average = meetings.length ? total / meetings.length : 0;
    const sortedTurnout = turnout.slice().sort((a, b) => a - b);
    const median = sortedTurnout.length ? (sortedTurnout.length % 2 ? sortedTurnout[(sortedTurnout.length - 1) / 2] : (sortedTurnout[sortedTurnout.length / 2 - 1] + sortedTurnout[sortedTurnout.length / 2]) / 2) : 0;
    const peak = turnout.length ? Math.max(...turnout) : 0;
    const latest = meetings.length ? meetings[meetings.length - 1] : null;
    const previousMeetings = meetings.slice(Math.max(0, meetings.length - 4), Math.max(0, meetings.length - 1));
    const previousAverage = previousMeetings.length ? previousMeetings.reduce((sum, meeting) => sum + meeting.count, 0) / previousMeetings.length : null;
    const repeat = [...members.values()].filter(member => member.meetings.size >= 2).length;

    return { meetings, members, total, average, median, peak, latest, previousAverage, repeat };
  }

  function renderMetrics(metrics) {
    $("#attendanceMetricLatest").textContent = metrics.latest ? String(metrics.latest.count) : "0";
    $("#attendanceMetricLatestMeta").textContent = metrics.latest ? `${metrics.latest.title} · ${formatDate(metrics.latest.meetingDate)}` : "No completed meetings yet";
    $("#attendanceMetricAverage").textContent = formatNumber(metrics.average, 1);
    $("#attendanceMetricAverageMeta").textContent = metrics.meetings.length ? `Median ${formatNumber(metrics.median, 1)} · peak ${metrics.peak}` : "Across selected meetings";
    $("#attendanceMetricUnique").textContent = String(metrics.members.size);
    $("#attendanceMetricUniqueMeta").textContent = metrics.members.size ? `${metrics.repeat} have attended more than once` : "Distinct names checked in";
    $("#attendanceMetricCheckins").textContent = String(metrics.total);
    $("#attendanceMetricCheckinsMeta").textContent = `${metrics.meetings.length} meeting${metrics.meetings.length === 1 ? "" : "s"} in view`;
    $("#attendanceMetricRepeat").textContent = String(metrics.repeat);
    $("#attendanceMetricRepeatMeta").textContent = metrics.members.size ? `${Math.round((metrics.repeat / metrics.members.size) * 100)}% of people returned` : "People with 2+ check-ins";
    $("#attendanceMetricMeetings").textContent = String(metrics.meetings.length);
    $("#attendanceMetricMeetingsMeta").textContent = metrics.meetings.length ? `${formatDate(metrics.meetings[0].meetingDate)} → ${formatDate(metrics.meetings[metrics.meetings.length - 1].meetingDate)}` : "Completed meetings in view";
  }

  function renderTrend(metrics) {
    const host = $("#attendanceTurnoutChart");
    const summary = $("#attendanceTrendSummary");
    const meetings = metrics.meetings.slice(-12);
    if (!meetings.length) {
      host.innerHTML = '<div class="attendance-empty compact"><span>◇</span><strong>No turnout data yet</strong><p>Check-ins will build this trend automatically.</p></div>';
      summary.textContent = "";
      return;
    }

    if (metrics.latest && metrics.previousAverage !== null) {
      const delta = metrics.latest.count - metrics.previousAverage;
      const sign = delta > 0 ? "+" : "";
      summary.innerHTML = `<span class="attendance-trend-chip ${delta > 0 ? "is-up" : delta < 0 ? "is-down" : ""}">${sign}${formatNumber(delta, 1)} vs prior avg</span>`;
    } else summary.textContent = "";

    const width = 900;
    const height = 260;
    const pad = { l: 46, r: 18, t: 24, b: 56 };
    const max = Math.max(1, ...meetings.map(meeting => meeting.count));
    const x = index => meetings.length === 1 ? width / 2 : pad.l + index * ((width - pad.l - pad.r) / (meetings.length - 1));
    const y = value => pad.t + (max - value) * ((height - pad.t - pad.b) / max);
    const points = meetings.map((meeting, index) => `${x(index)},${y(meeting.count)}`).join(" ");
    const gridSteps = Math.min(4, max);
    const grid = Array.from({ length: gridSteps + 1 }, (_, i) => {
      const value = Math.round((max / gridSteps) * i);
      const yy = y(value);
      return `<line x1="${pad.l}" y1="${yy}" x2="${width - pad.r}" y2="${yy}" class="attendance-chart-grid"/><text x="${pad.l - 10}" y="${yy + 4}" text-anchor="end" class="attendance-chart-axis">${value}</text>`;
    }).join("");
    const labels = meetings.map((meeting, index) => {
      const show = meetings.length <= 7 || index % 2 === 0 || index === meetings.length - 1;
      return show ? `<text x="${x(index)}" y="${height - 18}" text-anchor="middle" class="attendance-chart-axis">${esc(shortDate(meeting.meetingDate))}</text>` : "";
    }).join("");
    const dots = meetings.map((meeting, index) => `<g><circle cx="${x(index)}" cy="${y(meeting.count)}" r="6" class="attendance-chart-dot"><title>${esc(meeting.title)}: ${meeting.count} present</title></circle><text x="${x(index)}" y="${y(meeting.count) - 12}" text-anchor="middle" class="attendance-chart-value">${meeting.count}</text></g>`).join("");

    host.innerHTML = `<svg viewBox="0 0 ${width} ${height}" class="attendance-chart-svg" role="img" aria-label="Turnout for the last ${meetings.length} selected meetings">${grid}<polyline points="${points}" class="attendance-chart-line"/>${dots}${labels}</svg>`;
  }

  function renderRecentMeetings(metrics) {
    const host = $("#attendanceRecentMeetings");
    const recent = metrics.meetings.slice(-6).reverse();
    if (!recent.length) {
      host.innerHTML = '<div class="attendance-empty compact"><span>◇</span><strong>No meetings yet</strong><p>Completed meetings will appear here.</p></div>';
      return;
    }
    host.innerHTML = recent.map((meeting, index) => {
      const chronologicalIndex = metrics.meetings.findIndex(item => item.id === meeting.id);
      const prior = chronologicalIndex > 0 ? metrics.meetings[chronologicalIndex - 1] : null;
      const delta = prior ? meeting.count - prior.count : null;
      return `<article class="attendance-recent-row">
        <span class="attendance-recent-date"><strong>${esc(dayNumber(meeting.meetingDate))}</strong><small>${esc(monthShort(meeting.meetingDate))}</small></span>
        <span class="attendance-recent-copy"><strong>${esc(meeting.title)}</strong><small>${esc(meeting.teamName || "Club-wide")}</small></span>
        <span class="attendance-recent-count"><strong>${meeting.count}</strong><small>${delta === null ? "present" : `${delta > 0 ? "+" : ""}${delta} vs prior`}</small></span>
      </article>`;
    }).join("");
  }

  function renderMembers() {
    if (!state.filteredMeetings.length) {
      $("#attendanceMemberTableBody").innerHTML = "";
      $("#attendanceMemberEmpty").classList.remove("is-hidden");
      return;
    }
    const query = normalizeName($("#attendanceMemberSearch").value);
    const metrics = calculateMetrics();
    const rows = [...metrics.members.values()]
      .filter(member => !query || normalizeName(member.name).includes(query))
      .sort((a, b) => b.meetings.size - a.meetings.size || String(b.lastDate).localeCompare(String(a.lastDate)) || a.name.localeCompare(b.name));
    $("#attendanceMemberEmpty").classList.toggle("is-hidden", rows.length > 0);
    $("#attendanceMemberTableBody").innerHTML = rows.map(member => {
      const coverage = Math.round((member.meetings.size / state.filteredMeetings.length) * 100);
      return `<tr><td><strong>${esc(member.name)}</strong><small>${member.meetings.size >= 2 ? "Returning attendee" : "One check-in"}</small></td><td><strong>${member.meetings.size}</strong></td><td><div class="attendance-coverage"><span><i style="width:${coverage}%"></i></span><b>${coverage}%</b></div></td><td>${esc(formatDate(member.lastDate))}</td></tr>`;
    }).join("");
  }

  function renderTeamBreakdown(metrics) {
    const host = $("#attendanceTeamBreakdown");
    if (!metrics.meetings.length) {
      host.innerHTML = '<div class="attendance-empty compact"><span>◇</span><strong>No team data</strong><p>Meeting history will populate this comparison.</p></div>';
      return;
    }
    const groups = new Map();
    metrics.meetings.forEach(meeting => {
      const key = meeting.teamName || "Club-wide";
      const group = groups.get(key) || { name: key, meetings: 0, total: 0, peak: 0 };
      group.meetings += 1;
      group.total += meeting.count;
      group.peak = Math.max(group.peak, meeting.count);
      groups.set(key, group);
    });
    const rows = [...groups.values()].map(group => Object.assign(group, { average: group.total / group.meetings })).sort((a, b) => b.average - a.average);
    const max = Math.max(1, ...rows.map(row => row.average));
    host.innerHTML = rows.map(row => `<div class="attendance-team-row"><div class="attendance-team-row-copy"><strong>${esc(row.name)}</strong><small>${row.meetings} meeting${row.meetings === 1 ? "" : "s"} · peak ${row.peak}</small></div><div class="attendance-team-bar"><span style="width:${Math.max(3, (row.average / max) * 100)}%"></span></div><strong class="attendance-team-average">${formatNumber(row.average, 1)}</strong></div>`).join("");
  }

  function renderMeetingHistory(metrics) {
    $("#attendanceHistoryCount").textContent = String(metrics.meetings.length);
    const host = $("#attendanceMeetingHistory");
    if (!metrics.meetings.length) {
      host.innerHTML = '<div class="attendance-empty compact"><span>◇</span><strong>No meetings in this view</strong><p>Change the filters or create attendance meetings.</p></div>';
      return;
    }
    host.innerHTML = metrics.meetings.slice().reverse().map(meeting => `<article class="attendance-history-row"><div class="attendance-history-date"><strong>${esc(formatDate(meeting.meetingDate))}</strong><small>${meeting.startTime ? esc(formatTime(meeting.startTime)) : "Time not set"}</small></div><div class="attendance-history-copy"><strong>${esc(meeting.title)}</strong><small>${esc(meeting.teamName || "Club-wide")}${meeting.location ? ` · ${esc(meeting.location)}` : ""}</small></div><div class="attendance-history-count"><strong>${meeting.count}</strong><span>present</span></div></article>`).join("");
  }

  function exportCsv() {
    if (!state.filteredMeetings.length) return window.alert("There are no meetings in the current filter to export.");
    const meetingMap = new Map(state.filteredMeetings.map(meeting => [meeting.id, meeting]));
    const rows = [["Meeting date", "Meeting", "Team", "Member", "Checked in at"]];
    state.filteredRecords
      .slice()
      .sort((a, b) => String(a.checkedInAt || "").localeCompare(String(b.checkedInAt || "")))
      .forEach(record => {
        const meeting = meetingMap.get(record.meetingId);
        if (!meeting) return;
        rows.push([meeting.meetingDate, meeting.title, meeting.teamName || "Club-wide", record.memberName, record.checkedInAt]);
      });
    const label = $("#attendanceInsightsTeam").selectedOptions[0]?.textContent || "attendance";
    downloadFile(`attendance-${slug(label)}.csv`, rows.map(row => row.map(csvCell).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  }

  function compareMeetingsAsc(a, b) {
    return `${a.meetingDate || ""} ${a.startTime || "00:00"}`.localeCompare(`${b.meetingDate || ""} ${b.startTime || "00:00"}`) || String(a.title || "").localeCompare(String(b.title || ""));
  }
  function normalizeName(value) { return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase(); }
  function dayStart(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12); }
  function parseDate(value) { const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : null; }
  function formatDate(value) { const d = parseDate(value); return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Date TBD"; }
  function shortDate(value) { const d = parseDate(value); return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""; }
  function dayNumber(value) { const d = parseDate(value); return d ? String(d.getDate()) : "—"; }
  function monthShort(value) { const d = parseDate(value); return d ? d.toLocaleDateString("en-US", { month: "short" }).toUpperCase() : ""; }
  function formatTime(value) { const m = String(value || "").match(/^(\d{1,2}):(\d{2})/); if (!m) return ""; return new Date(2000, 0, 1, Number(m[1]), Number(m[2])).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
  function formatNumber(value, digits = 0) { return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
  function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
  function slug(value) { return String(value || "attendance").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "attendance"; }
  function csvCell(value) { const text = String(value ?? ""); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
  function downloadFile(name, content, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 500); }
  function busy(button, active, label) { button.disabled = active; button.textContent = label; }
  function setStatus(host, message, tone = "") { host.textContent = message || ""; host.className = `form-status${tone ? ` is-${tone}` : ""}`; }
  function showConnectionError(message) { const host = $("#attendanceInsightsConnectionBanner"); host.textContent = message || ""; host.classList.toggle("is-hidden", !message); }
  function safeSessionGet(key) { try { return sessionStorage.getItem(key) || ""; } catch (_) { return ""; } }
  function safeSessionSet(key, value) { try { sessionStorage.setItem(key, value); } catch (_) {} }
  function clearToken() { state.token = ""; try { sessionStorage.removeItem("asmeAttendanceAdminToken"); } catch (_) {} }
})();
