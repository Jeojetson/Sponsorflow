(() => {
  "use strict";

  const API = window.SponsorFlowAPI;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const CLUB_BOARD_ID = "BOARD-CLUB-MASTER";
  const GENERAL_TEAM_ID = "TEAM-CLUB";
  const DEFAULT_TEAM_ORDER = [
    "TEAM-MECH",
    "TEAM-KART",
    "TEAM-ELEC",
    "TEAM-BATT",
    "TEAM-SOFTWARE",
    "TEAM-MFG",
    "TEAM-OPS"
  ];

  const state = {
    actorName: "",
    teams: [],
    boards: [],
    tasks: [],
    calendarFeedBaseUrl: "",
    month: `${todayText().slice(0, 7)}-01`,
    scope: "all",
    editingTask: null,
    dirty: false,
    saving: false
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindEvents();
    restoreIdentity();
    state.month = validDateOnly(localStorage.getItem("asmeCalendarMonth")) || state.month;
    state.scope = normalizeStoredScope(localStorage.getItem("asmeCalendarScope") || "all");
    if (!API || !API.configured()) {
      showConnectionError("SponsorFlow is not connected. Add the Apps Script web app URL to assets/config.js.");
      return;
    }
    await loadCalendar();
  }

  function bindEvents() {
    $("#calendarSaveName").addEventListener("click", () => saveIdentity($("#calendarActorName").value));
    $("#calendarActorName").addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); saveIdentity(event.currentTarget.value); }
    });
    $("#calendarIdentitySave").addEventListener("click", () => {
      if (saveIdentity($("#calendarIdentityName").value, true)) $("#calendarIdentityDialog").close();
    });
    $("#calendarIdentityName").addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); $("#calendarIdentitySave").click(); }
    });
    $("#calendarScopeSelect").addEventListener("change", event => {
      state.scope = event.currentTarget.value;
      localStorage.setItem("asmeCalendarScope", state.scope);
      renderCalendar();
    });
    $("#calendarPrevious").addEventListener("click", () => moveMonth(-1));
    $("#calendarNext").addEventListener("click", () => moveMonth(1));
    $("#calendarToday").addEventListener("click", () => {
      state.month = `${todayText().slice(0, 7)}-01`;
      localStorage.setItem("asmeCalendarMonth", state.month);
      renderCalendar();
    });
    $("#calendarNewEvent").addEventListener("click", () => openEventDialog("", { startDate: todayText() }));
    $("#calendarSubscribe").addEventListener("click", openSubscriptions);
    $("#calendarSnapshot").addEventListener("click", downloadCurrentCalendar);

    $("#calendarEventForm").addEventListener("submit", saveEvent);
    $("#calendarEventAllDay").addEventListener("change", () => { updateTimeFields(); markDirty(); });
    $("#calendarEventStartDate").addEventListener("change", () => {
      const start = validDateOnly($("#calendarEventStartDate").value);
      const end = validDateOnly($("#calendarEventEndDate").value);
      if (start && (!end || end < start)) $("#calendarEventEndDate").value = start;
      updateHealth();
      markDirty();
    });
    $("#calendarEventEndDate").addEventListener("change", () => { updateHealth(); markDirty(); });
    ["calendarEventStatus", "calendarEventPriority", "calendarEventProgress", "calendarEventImportant", "calendarEventMilestone"].forEach(id => {
      $("#" + id).addEventListener("change", () => { updateHealth(); markDirty(); });
    });
    $("#calendarEventForm").addEventListener("input", markDirty);
    $("#calendarEventForm").addEventListener("change", markDirty);
    $("#calendarEventArchive").addEventListener("click", archiveEvent);
    $("#calendarEventDownload").addEventListener("click", () => {
      const task = currentFormTask();
      if (task.startDate || task.dueDate) downloadIcs([task], task.title || "ASME event");
    });
    $$('[data-calendar-close]').forEach(button => button.addEventListener("click", closeEventDialog));
    $$('[data-subscription-close]').forEach(button => button.addEventListener("click", () => $("#calendarSubscriptionsDialog").close()));
    [$("#calendarIdentityDialog"), $("#calendarEventDialog"), $("#calendarSubscriptionsDialog")].forEach(dialog => {
      dialog.addEventListener("click", event => {
        if (event.target !== dialog) return;
        if (dialog.id === "calendarEventDialog") closeEventDialog(); else dialog.close();
      });
      dialog.addEventListener("cancel", event => {
        if (dialog.id === "calendarEventDialog" && state.dirty) { event.preventDefault(); closeEventDialog(); }
      });
      dialog.addEventListener("close", () => {
        if (!document.querySelector("dialog[open]")) document.body.classList.remove("dialog-open");
      });
    });
  }

  async function loadCalendar() {
    setLoading(true);
    try {
      const data = await API.post("plannerBootstrap");
      state.teams = Array.isArray(data.teams) ? data.teams : [];
      state.boards = Array.isArray(data.boards) ? data.boards : [];
      state.tasks = (Array.isArray(data.tasks) ? data.tasks : []).map(normalizeTask);
      state.calendarFeedBaseUrl = String(data.calendarFeedBaseUrl || "");
      const query = new URLSearchParams(window.location.search);
      const queryBoard = query.get("board") || "";
      if (queryBoard && state.boards.some(board => board.id === queryBoard)) {
        const board = state.boards.find(item => item.id === queryBoard);
        state.scope = board?.teamId === GENERAL_TEAM_ID ? "general" : `team:${board?.teamId || ""}`;
      }
      state.scope = normalizeScopeAgainstData(state.scope);
      renderScopeOptions();
      renderBoardOptions();
      renderCalendar();
      showConnectionError("");
      const queryTask = query.get("task") || "";
      if (queryTask && state.tasks.some(task => task.id === queryTask)) setTimeout(() => openEventDialog(queryTask), 120);
    } catch (error) {
      showConnectionError(error.message);
    } finally {
      setLoading(false);
    }
  }

  function normalizeTask(task) {
    return {
      ...task,
      startDate: validDateOnly(task.startDate),
      dueDate: validDateOnly(task.dueDate),
      startTime: validTime(task.startTime),
      endTime: validTime(task.endTime),
      allDay: task.allDay !== false,
      progress: Number(task.progress || 0),
      importantDate: Boolean(task.importantDate),
      isMilestone: Boolean(task.isMilestone)
    };
  }

  function renderScopeOptions() {
    const teams = calendarTeams();
    const options = [
      '<option value="all">All calendars</option>',
      '<option value="important">Important club events</option>',
      '<option value="general">General timeline</option>',
      ...teams.map(team => `<option value="team:${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`)
    ];
    $("#calendarScopeSelect").innerHTML = options.join("");
    state.scope = normalizeScopeAgainstData(state.scope);
    $("#calendarScopeSelect").value = state.scope;
  }

  function calendarTeams() {
    const order = new Map(DEFAULT_TEAM_ORDER.map((id, index) => [id, index]));
    return state.teams
      .filter(team => team.id !== GENERAL_TEAM_ID && team.active !== false)
      .sort((a, b) => {
        const aRank = order.has(a.id) ? order.get(a.id) : 999;
        const bRank = order.has(b.id) ? order.get(b.id) : 999;
        return aRank - bRank || String(a.name || "").localeCompare(String(b.name || ""));
      });
  }

  function normalizeStoredScope(value) {
    const raw = String(value || "").trim();
    if (!raw || raw === "club") return "all";
    if (raw === `team:${GENERAL_TEAM_ID}`) return "general";
    return raw;
  }

  function normalizeScopeAgainstData(value) {
    const scope = normalizeStoredScope(value);
    if (scope === "all" || scope === "important" || scope === "general") return scope;
    if (scope.startsWith("board:")) {
      const board = state.boards.find(item => `board:${item.id}` === scope);
      if (!board) return "all";
      return board.teamId === GENERAL_TEAM_ID ? "general" : `team:${board.teamId}`;
    }
    if (scope.startsWith("team:")) {
      const teamId = scope.slice(5);
      if (teamId === GENERAL_TEAM_ID) return "general";
      return calendarTeams().some(team => team.id === teamId) ? scope : "all";
    }
    return "all";
  }

  function renderBoardOptions(selectedId = "") {
    const grouped = state.teams.map(team => {
      const boards = state.boards.filter(board => board.teamId === team.id);
      return boards.length ? `<optgroup label="${escapeHtml(team.name)}">${boards.map(board => `<option value="${escapeHtml(board.id)}">${escapeHtml(board.name)}</option>`).join("")}</optgroup>` : "";
    }).join("");
    $("#calendarEventBoard").innerHTML = grouped || '<option value="">No timelines available</option>';
    const target = selectedId && state.boards.some(board => board.id === selectedId) ? selectedId : defaultBoardForScope();
    if (target) $("#calendarEventBoard").value = target;
  }

  function defaultBoardForScope() {
    if (state.scope === "general") {
      return state.boards.find(board => board.teamId === GENERAL_TEAM_ID)?.id || state.boards.find(board => board.id === CLUB_BOARD_ID)?.id || state.boards[0]?.id || "";
    }
    if (state.scope.startsWith("team:")) {
      return state.boards.find(board => board.teamId === state.scope.slice(5))?.id || state.boards.find(board => board.id === CLUB_BOARD_ID)?.id || state.boards[0]?.id || "";
    }
    return state.boards.find(board => board.id === CLUB_BOARD_ID)?.id || state.boards.find(board => board.teamId === GENERAL_TEAM_ID)?.id || state.boards[0]?.id || "";
  }

  function scopeMeta() {
    if (state.scope === "important") {
      return {
        name: "Important club events",
        description: "Races, milestones, meetings, critical deadlines, and dates explicitly marked important."
      };
    }
    if (state.scope === "general") {
      const team = state.teams.find(item => item.id === GENERAL_TEAM_ID);
      return {
        name: "General timeline",
        description: team?.description || "Shared club-level milestones, cross-team deadlines, and general planning."
      };
    }
    if (state.scope.startsWith("team:")) {
      const team = state.teams.find(item => item.id === state.scope.slice(5));
      return {
        name: team?.name || "Team calendar",
        description: team?.description || "Every dated item owned by this subteam."
      };
    }
    return {
      name: "All calendars",
      description: "Every dated task and event across all subteams, the general timeline, and Finance & Sponsorship."
    };
  }

  function tasksForScope() {
    const tasks = state.tasks.filter(task => !task.archived && (task.startDate || task.dueDate));
    if (state.scope === "important") return tasks.filter(isImportantTask);
    if (state.scope === "general") {
      const boardIds = new Set(state.boards.filter(board => board.teamId === GENERAL_TEAM_ID).map(board => board.id));
      return tasks.filter(task => boardIds.has(task.boardId));
    }
    if (state.scope.startsWith("team:")) {
      const boardIds = new Set(state.boards.filter(board => board.teamId === state.scope.slice(5)).map(board => board.id));
      return tasks.filter(task => boardIds.has(task.boardId));
    }
    return tasks;
  }

  function isImportantTask(task) {
    return task.importantDate || task.isMilestone || task.priority === "CRITICAL" || task.taskType === "FUNDING" || task.taskType === "MEETING";
  }

  function renderCalendar() {
    const monthStart = parseDateOnly(state.month) || new Date();
    monthStart.setDate(1);
    state.month = dateText(monthStart);
    localStorage.setItem("asmeCalendarMonth", state.month);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const gridStart = new Date(monthStart);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());
    const meta = scopeMeta();
    $("#calendarTitle").textContent = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    $("#calendarScopeName").textContent = meta.name;
    $("#calendarScopeDescription").textContent = meta.description;

    const tasks = tasksForScope().sort((a, b) => (taskBounds(a).start || "").localeCompare(taskBounds(b).start || "") || a.title.localeCompare(b.title));
    const cells = [];
    for (let index = 0; index < 42; index += 1) {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      const value = dateText(day);
      const dayTasks = tasks.filter(task => touchesDate(task, value));
      const outside = day.getMonth() !== monthStart.getMonth();
      const today = value === todayText();
      cells.push(`<section class="calendar-day${outside ? " is-outside" : ""}${today ? " is-today" : ""}" data-date="${value}">
        <header><time datetime="${value}">${day.getDate()}</time><div>${today ? "<span>Today</span>" : ""}<button class="calendar-day-add" type="button" data-add-date="${value}" aria-label="Add event on ${value}">+</button></div></header>
        <div class="calendar-day-events">${dayTasks.slice(0, 4).map(task => calendarEventHtml(task, value)).join("")}${dayTasks.length > 4 ? `<button class="calendar-more-button" type="button" data-focus-date="${value}">+${dayTasks.length - 4} more</button>` : ""}</div>
      </section>`);
    }
    $("#calendarGrid").innerHTML = cells.join("");
    $("#calendarGrid").querySelectorAll("[data-add-date]").forEach(button => button.addEventListener("click", event => {
      event.stopPropagation();
      openEventDialog("", { startDate: button.dataset.addDate });
    }));
    $("#calendarGrid").querySelectorAll("[data-task-id]").forEach(button => button.addEventListener("click", () => openEventDialog(button.dataset.taskId)));
    $("#calendarGrid").querySelectorAll("[data-focus-date]").forEach(button => button.addEventListener("click", () => focusAgenda(button.dataset.focusDate)));

    const startText = dateText(monthStart);
    const endText = dateText(monthEnd);
    const monthTasks = tasks.filter(task => intersects(task, startText, endText));
    $("#calendarAgendaCount").textContent = String(monthTasks.length);
    $("#calendarAgenda").innerHTML = monthTasks.length ? monthTasks.map(agendaHtml).join("") : `<div class="calendar-empty"><span>◇</span><strong>No dated work this month</strong><p>Use + Event or click a day to add one.</p></div>`;
    $("#calendarAgenda").querySelectorAll("[data-agenda-task]").forEach(button => button.addEventListener("click", () => openEventDialog(button.dataset.agendaTask)));
    $("#calendarAgenda").querySelectorAll("[data-agenda-download]").forEach(button => button.addEventListener("click", event => {
      event.stopPropagation();
      const task = state.tasks.find(item => item.id === button.dataset.agendaDownload);
      if (task) downloadIcs([task], task.title);
    }));
  }

  function calendarEventHtml(task, value) {
    const bounds = taskBounds(task);
    let label = task.title;
    if (bounds.start !== bounds.end) {
      if (value === bounds.start) label = `↦ ${task.title}`;
      else if (value === bounds.end) label = `↤ ${task.title}`;
    }
    const time = task.allDay === false && task.startTime ? formatClock(task.startTime) : "";
    return `<button class="calendar-event calendar-status-${escapeHtml(task.status)}" type="button" data-task-id="${escapeHtml(task.id)}" title="${escapeHtml(task.title)}">
      <span class="priority-dot priority-bg-${escapeHtml(task.priority)}"></span><span>${time ? `<b>${escapeHtml(time)}</b> ` : ""}${escapeHtml(label)}</span>
    </button>`;
  }

  function agendaHtml(task) {
    const bounds = taskBounds(task);
    const board = state.boards.find(item => item.id === task.boardId);
    const team = state.teams.find(item => item.id === board?.teamId);
    const label = bounds.start === bounds.end ? formatShortDate(bounds.start) : `${formatShortDate(bounds.start)} – ${formatShortDate(bounds.end)}`;
    return `<article class="calendar-agenda-item" data-agenda-date="${escapeHtml(bounds.start)}" data-agenda-id="${escapeHtml(task.id)}">
      <button class="calendar-agenda-main" type="button" data-agenda-task="${escapeHtml(task.id)}">
        <span class="calendar-agenda-date">${escapeHtml(label)}</span>
        <span class="calendar-agenda-copy"><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(team?.name || "ASME")} · ${escapeHtml(statusLabel(task.status))}${task.ownerNames ? ` · ${escapeHtml(task.ownerNames)}` : ""}</small></span>
      </button>
      <button class="calendar-agenda-download" type="button" data-agenda-download="${escapeHtml(task.id)}" aria-label="Download ${escapeHtml(task.title)} as .ics">.ics</button>
    </article>`;
  }

  function focusAgenda(value) {
    const item = $("#calendarAgenda").querySelector(`[data-agenda-date="${CSS.escape(value)}"]`);
    if (!item) return;
    item.scrollIntoView({ behavior: "smooth", block: "nearest" });
    item.classList.add("is-highlighted");
    setTimeout(() => item.classList.remove("is-highlighted"), 1400);
  }

  function moveMonth(offset) {
    const date = parseDateOnly(state.month) || new Date();
    date.setMonth(date.getMonth() + offset, 1);
    state.month = dateText(date);
    renderCalendar();
  }

  function openEventDialog(taskId = "", defaults = {}) {
    if (!requireActor()) return;
    resetEventForm();
    const task = taskId ? state.tasks.find(item => item.id === taskId) : null;
    state.editingTask = task || null;
    if (task) {
      $("#calendarEventId").value = task.id;
      $("#calendarEventExpectedUpdatedAt").value = task.updatedAt || "";
      $("#calendarEventDialogTitle").textContent = task.taskType === "MEETING" ? "Edit event" : "Edit calendar item";
      $("#calendarEventEyebrow").textContent = task.taskType === "MEETING" ? "Calendar event" : "Timeline deadline";
      $("#calendarEventTitle").value = task.title || "";
      renderBoardOptions(task.boardId);
      $("#calendarEventBoard").value = task.boardId;
      $("#calendarEventBoard").disabled = true;
      $("#calendarEventType").value = task.taskType || "WORK";
      $("#calendarEventStartDate").value = task.startDate || task.dueDate || "";
      $("#calendarEventEndDate").value = task.dueDate || task.startDate || "";
      $("#calendarEventAllDay").checked = task.allDay !== false;
      $("#calendarEventStartTime").value = task.startTime || "";
      $("#calendarEventEndTime").value = task.endTime || "";
      $("#calendarEventLocation").value = task.location || "";
      $("#calendarEventOwners").value = task.ownerNames || "";
      $("#calendarEventStatus").value = task.status || "PLANNED";
      $("#calendarEventPriority").value = task.priority || "MEDIUM";
      $("#calendarEventProgress").value = String(task.progress || 0);
      $("#calendarEventDescription").value = task.description || "";
      $("#calendarEventMilestone").checked = Boolean(task.isMilestone);
      $("#calendarEventImportant").checked = Boolean(task.importantDate);
      $("#calendarEventUpdatedMeta").textContent = `Last updated ${relativeTime(task.updatedAt)} by ${task.updatedBy || "unknown"}`;
      $("#calendarEventArchive").classList.remove("is-hidden");
      $("#calendarEventDownload").classList.remove("is-hidden");
    } else {
      const start = validDateOnly(defaults.startDate) || todayText();
      $("#calendarEventDialogTitle").textContent = "Add event";
      $("#calendarEventEyebrow").textContent = "New calendar event";
      renderBoardOptions(defaults.boardId || defaultBoardForScope());
      $("#calendarEventBoard").disabled = false;
      $("#calendarEventStartDate").value = start;
      $("#calendarEventEndDate").value = validDateOnly(defaults.endDate) || start;
      $("#calendarEventOwners").value = state.actorName;
    }
    updateTimeFields();
    updateHealth();
    state.dirty = false;
    showDialog($("#calendarEventDialog"));
    setTimeout(() => $("#calendarEventTitle").focus(), 0);
  }

  function resetEventForm() {
    $("#calendarEventForm").reset();
    $("#calendarEventId").value = "";
    $("#calendarEventExpectedUpdatedAt").value = "";
    $("#calendarEventUpdatedMeta").textContent = "";
    $("#calendarEventAllDay").checked = true;
    $("#calendarEventPriority").value = "MEDIUM";
    $("#calendarEventStatus").value = "PLANNED";
    $("#calendarEventProgress").value = "0";
    $("#calendarEventArchive").classList.add("is-hidden");
    $("#calendarEventDownload").classList.add("is-hidden");
    $("#calendarEventBoard").disabled = false;
    setEventStatus("");
  }

  function currentFormTask() {
    const existing = state.editingTask || {};
    const start = validDateOnly($("#calendarEventStartDate").value);
    const end = validDateOnly($("#calendarEventEndDate").value) || start;
    return normalizeTask({
      ...existing,
      id: $("#calendarEventId").value || existing.id || "",
      boardId: $("#calendarEventBoard").value,
      title: $("#calendarEventTitle").value.trim(),
      description: $("#calendarEventDescription").value,
      taskType: $("#calendarEventType").value,
      status: $("#calendarEventStatus").value,
      priority: $("#calendarEventPriority").value,
      ownerNames: $("#calendarEventOwners").value,
      startDate: start,
      dueDate: end,
      allDay: $("#calendarEventAllDay").checked,
      startTime: $("#calendarEventAllDay").checked ? "" : validTime($("#calendarEventStartTime").value),
      endTime: $("#calendarEventAllDay").checked ? "" : validTime($("#calendarEventEndTime").value),
      location: $("#calendarEventLocation").value,
      progress: Number($("#calendarEventProgress").value || 0),
      isMilestone: $("#calendarEventMilestone").checked,
      importantDate: $("#calendarEventImportant").checked
    });
  }

  async function saveEvent(event) {
    event.preventDefault();
    if (!requireActor() || state.saving) return;
    const task = currentFormTask();
    if (task.title.length < 2) return setEventStatus("Give this item a clear title.", "error");
    if (!task.boardId) return setEventStatus("Choose a team timeline.", "error");
    if (!task.startDate) return setEventStatus("Choose a start date.", "error");
    if (task.dueDate && task.dueDate < task.startDate) return setEventStatus("The end date must be on or after the start date.", "error");
    if (!task.allDay && task.startDate === task.dueDate && task.startTime && task.endTime && task.endTime <= task.startTime) return setEventStatus("The end time must be after the start time.", "error");

    const existing = state.editingTask || {};
    const payload = {
      id: task.id,
      expectedUpdatedAt: $("#calendarEventExpectedUpdatedAt").value,
      boardId: task.boardId,
      title: task.title,
      description: task.description,
      taskType: task.taskType || "MEETING",
      status: task.status || "PLANNED",
      priority: task.priority || "MEDIUM",
      ownerNames: task.ownerNames,
      startDate: task.startDate,
      dueDate: task.dueDate,
      allDay: task.allDay,
      startTime: task.startTime,
      endTime: task.endTime,
      location: task.location,
      progress: task.status === "DONE" ? 100 : task.progress,
      isMilestone: task.isMilestone,
      importantDate: task.importantDate,
      tags: existing.tags || (task.taskType === "MEETING" ? "event" : ""),
      campus: existing.campus || "",
      fundingMin: existing.fundingMin ?? "",
      fundingMax: existing.fundingMax ?? "",
      fundingAmountLabel: existing.fundingAmountLabel || "",
      sourceUrl: existing.sourceUrl || "",
      sourceConfidence: existing.sourceConfidence || "TEAM_ENTERED",
      requirements: existing.requirements || "",
      partName: existing.partName || "",
      partNumber: existing.partNumber || "",
      vendor: existing.vendor || "",
      quantity: existing.quantity ?? "",
      estimatedCost: existing.estimatedCost ?? "",
      orderStatus: existing.orderStatus || "NOT_NEEDED",
      dependencyIds: JSON.stringify(Array.isArray(existing.dependencyIds) ? existing.dependencyIds : []),
      actorName: state.actorName
    };

    state.saving = true;
    setButtonBusy($("#calendarEventSave"), true, "Saving…");
    setEventStatus("Saving to the shared calendar…");
    try {
      const saved = normalizeTask(await API.post("savePlannerTask", payload));
      const data = await API.post("plannerBootstrap");
      state.teams = Array.isArray(data.teams) ? data.teams : state.teams;
      state.boards = Array.isArray(data.boards) ? data.boards : state.boards;
      state.tasks = (Array.isArray(data.tasks) ? data.tasks : []).map(normalizeTask);
      state.calendarFeedBaseUrl = String(data.calendarFeedBaseUrl || state.calendarFeedBaseUrl);
      const verified = state.tasks.find(item => item.id === saved.id);
      if (!verified || verified.startDate !== task.startDate || verified.dueDate !== task.dueDate) throw new Error("The event was saved, but its dates did not verify correctly. Refresh and try once more.");
      state.month = `${verified.startDate.slice(0, 7)}-01`;
      localStorage.setItem("asmeCalendarMonth", state.month);
      state.dirty = false;
      $("#calendarEventDialog").close();
      renderCalendar();
      setPageMessage(`${verified.title} saved on ${formatShortDate(verified.startDate)}.`, "success");
    } catch (error) {
      setEventStatus(error.message, "error");
    } finally {
      state.saving = false;
      setButtonBusy($("#calendarEventSave"), false, "Save event");
    }
  }

  async function archiveEvent() {
    const task = state.editingTask;
    if (!task || !window.confirm(`Archive “${task.title}”?`)) return;
    setEventStatus("Archiving…");
    try {
      await API.post("archivePlannerTask", { taskId: task.id, actorName: state.actorName, expectedUpdatedAt: task.updatedAt || "" });
      state.tasks = state.tasks.filter(item => item.id !== task.id);
      state.dirty = false;
      $("#calendarEventDialog").close();
      renderCalendar();
      setPageMessage("Calendar item archived.", "success");
    } catch (error) { setEventStatus(error.message, "error"); }
  }

  function closeEventDialog() {
    if (state.dirty && !window.confirm("Discard unsaved changes?")) return;
    state.dirty = false;
    $("#calendarEventDialog").close();
  }

  function markDirty() {
    if (!$("#calendarEventDialog").open) return;
    state.dirty = true;
  }

  function updateTimeFields() {
    const allDay = $("#calendarEventAllDay").checked;
    $("#calendarEventTimeFields").classList.toggle("is-hidden", allDay);
    $("#calendarEventStartTime").disabled = allDay;
    $("#calendarEventEndTime").disabled = allDay;
  }

  function updateHealth() {
    const task = currentFormTask();
    const host = $("#calendarEventHealth");
    if (!task.startDate) {
      host.className = "task-health-card health-neutral";
      host.innerHTML = "<span>Schedule health</span><strong>Add a date</strong><p>Choose dates to place this item on the shared calendar.</p>";
      return;
    }
    const today = todayText();
    let tone = "ontrack", title = task.startDate === task.dueDate ? formatShortDate(task.startDate) : `${formatShortDate(task.startDate)} – ${formatShortDate(task.dueDate)}`;
    let detail = task.allDay ? "All-day calendar item." : `${formatClock(task.startTime || "09:00")} – ${formatClock(task.endTime || "10:00")}`;
    if (task.status !== "DONE" && task.dueDate < today) { tone = "overdue"; title = "Past due"; detail = `Ended ${formatShortDate(task.dueDate)}.`; }
    else if (task.status === "BLOCKED") { tone = "blocked"; title = "Blocked"; detail = "Resolve the blocker before this date."; }
    host.className = `task-health-card health-${tone}`;
    host.innerHTML = `<span>Schedule health</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p>`;
  }

  function openSubscriptions() {
    if (!state.calendarFeedBaseUrl) return setPageMessage("Redeploy the current Apps Script backend before creating live subscriptions.", "error");
    const generalTeam = state.teams.find(team => team.id === GENERAL_TEAM_ID);
    const items = [
      {
        name: "All calendars",
        description: "Every dated item across every subteam, the general timeline, and Finance & Sponsorship.",
        scope: "club",
        id: "",
        badge: "Combined"
      },
      {
        name: "Important club events",
        description: "Races, milestones, meetings, critical deadlines, and dates explicitly marked important.",
        scope: "important",
        id: "",
        badge: "Key dates"
      },
      {
        name: "General timeline",
        description: generalTeam?.description || "Shared club-level milestones and cross-team work.",
        scope: "team",
        id: GENERAL_TEAM_ID,
        badge: "General"
      },
      ...calendarTeams().map(team => ({
        name: team.name,
        description: team.description || "All dated work for this subteam.",
        scope: "team",
        id: team.id,
        badge: "Subteam"
      }))
    ];
    $("#calendarSubscriptionList").innerHTML = items.map(item => {
      const url = feedUrl(item.scope, item.id);
      return `<article class="calendar-subscription-card">
        <div class="calendar-subscription-copy">
          <span class="verification-badge research">${escapeHtml(item.badge)}</span>
          <strong>${escapeHtml(item.name)}</strong>
          <p>${escapeHtml(item.description)}</p>
        </div>
        <div class="calendar-subscription-actions">
          <button class="button button-secondary button-small" type="button" data-copy-feed="${escapeHtml(url)}">Copy URL</button>
          <a class="button button-ghost button-small" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Open feed</a>
        </div>
      </article>`;
    }).join("");
    $("#calendarSubscriptionList").querySelectorAll("[data-copy-feed]").forEach(button => button.addEventListener("click", () => copyText(button.dataset.copyFeed)));
    setSubscriptionStatus("");
    showDialog($("#calendarSubscriptionsDialog"));
  }

  function feedUrl(scope, id = "") {
    const url = new URL(state.calendarFeedBaseUrl);
    url.searchParams.set("feed", "calendar");
    url.searchParams.set("scope", scope);
    if (id) url.searchParams.set("id", id);
    url.searchParams.set("app", new URL("calendar.html", window.location.href).href);
    return url.toString();
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      setSubscriptionStatus("Subscription URL copied.", "success");
    } catch (_) {
      window.prompt("Copy this calendar subscription URL:", value);
    }
  }

  function downloadCurrentCalendar() {
    const tasks = tasksForScope();
    if (!tasks.length) return setPageMessage("This calendar has no dated items to download.", "error");
    downloadIcs(tasks, scopeMeta().name);
    setPageMessage(`${tasks.length} calendar ${tasks.length === 1 ? "item" : "items"} downloaded.`, "success");
  }

  function downloadIcs(tasks, name) {
    const events = tasks.filter(task => task.startDate || task.dueDate).map(taskIcs).join("\r\n");
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Purdue Indianapolis ASME//ASME Indy Workspace 1.1//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsEscape(name || "ASME Indy Calendar")}`, events, "END:VCALENDAR", ""].join("\r\n");
    downloadFile(`${slugify(name || "asme-indy-calendar")}.ics`, body, "text/calendar;charset=utf-8");
  }

  function taskIcs(task) {
    const bounds = taskBounds(task);
    const board = state.boards.find(item => item.id === task.boardId);
    const team = state.teams.find(item => item.id === board?.teamId);
    const description = [task.description, `Team: ${team?.name || "ASME"}`, `Timeline: ${board?.name || "Project planner"}`, task.ownerNames ? `Owners: ${task.ownerNames}` : "", `Status: ${statusLabel(task.status)}`, `Priority: ${priorityLabel(task.priority)}`].filter(Boolean).join("\n");
    const lines = ["BEGIN:VEVENT", `UID:${icsEscape(task.id || crypto.randomUUID())}@asmeindy.purdue.edu`, `DTSTAMP:${icsTimestamp(new Date())}`, `LAST-MODIFIED:${icsTimestamp(new Date(task.updatedAt || Date.now()))}`];
    if (task.allDay === false && task.startTime) {
      lines.push(`DTSTART;TZID=America/Indiana/Indianapolis:${icsDateTime(bounds.start, task.startTime)}`);
      lines.push(`DTEND;TZID=America/Indiana/Indianapolis:${icsDateTime(bounds.end, task.endTime || addMinutes(task.startTime, 60))}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${bounds.start.replaceAll("-", "")}`);
      lines.push(`DTEND;VALUE=DATE:${addDays(bounds.end, 1).replaceAll("-", "")}`);
    }
    lines.push(`SUMMARY:${icsEscape(task.title || "ASME item")}`, `DESCRIPTION:${icsEscape(description)}`);
    if (task.location) lines.push(`LOCATION:${icsEscape(task.location)}`);
    lines.push("STATUS:CONFIRMED", "TRANSP:TRANSPARENT", "END:VEVENT");
    return lines.join("\r\n");
  }

  function restoreIdentity() {
    state.actorName = normalizeName(localStorage.getItem("asmePlannerName") || "");
    $("#calendarActorName").value = state.actorName;
    $("#calendarIdentityName").value = state.actorName;
    updateIdentityUi();
    if (!state.actorName) setTimeout(() => showDialog($("#calendarIdentityDialog")), 250);
  }

  function saveIdentity(value, fromDialog = false) {
    const clean = normalizeName(value);
    const status = fromDialog ? $("#calendarIdentityStatus") : $("#calendarNameStatus");
    if (clean.length < 2) {
      status.textContent = "Enter your full name so changes have an owner.";
      status.classList.add("is-error");
      return false;
    }
    state.actorName = clean;
    localStorage.setItem("asmePlannerName", clean);
    $("#calendarActorName").value = clean;
    $("#calendarIdentityName").value = clean;
    updateIdentityUi();
    return true;
  }

  function updateIdentityUi() {
    const status = $("#calendarNameStatus");
    status.textContent = state.actorName ? `Editing as ${state.actorName}` : "Required to edit";
    status.classList.toggle("is-ready", Boolean(state.actorName));
  }

  function requireActor() {
    if (state.actorName) return true;
    $("#calendarIdentityStatus").textContent = "Enter your name before making changes.";
    showDialog($("#calendarIdentityDialog"));
    return false;
  }

  function taskBounds(task) {
    let start = validDateOnly(task.startDate) || validDateOnly(task.dueDate);
    let end = validDateOnly(task.dueDate) || start;
    if (start && end && end < start) [start, end] = [end, start];
    return { start, end };
  }

  function touchesDate(task, value) {
    const { start, end } = taskBounds(task);
    return Boolean(start && end && value >= start && value <= end);
  }

  function intersects(task, startRange, endRange) {
    const { start, end } = taskBounds(task);
    return Boolean(start && end && start <= endRange && end >= startRange);
  }

  function parseDateOnly(value) {
    const text = validDateOnly(value);
    if (!text) return null;
    const [year, month, day] = text.split("-").map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  function validDateOnly(value) {
    const text = String(value || "").trim();
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return "";
    const candidate = `${match[1]}-${match[2]}-${match[3]}`;
    const date = parseDateOnlyUnsafe(candidate);
    return date && dateText(date) === candidate ? candidate : "";
  }

  function parseDateOnlyUnsafe(value) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function validTime(value) {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
    if (!match) return "";
    const hour = Number(match[1]), minute = Number(match[2]);
    return hour >= 0 && hour < 24 && minute >= 0 && minute < 60 ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` : "";
  }

  function todayText() { return dateText(new Date()); }
  function dateText(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
  function addDays(value, amount) { const date = parseDateOnly(value); date.setDate(date.getDate() + amount); return dateText(date); }
  function formatShortDate(value) { const date = parseDateOnly(value); return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined }) : "—"; }
  function formatClock(value) { const time = validTime(value); if (!time) return ""; const [h, m] = time.split(":").map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
  function addMinutes(value, amount) { const [h, m] = validTime(value).split(":").map(Number); const total = (h * 60 + m + amount) % 1440; return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; }
  function icsDateTime(date, time) { return `${date.replaceAll("-", "")}T${time.replace(":", "")}00`; }
  function icsTimestamp(value) { const date = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date(); return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
  function icsEscape(value) { return String(value || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); }
  function statusLabel(value) { return ({ BACKLOG: "Backlog", PLANNED: "Planned", IN_PROGRESS: "In progress", BLOCKED: "Blocked", REVIEW: "Review / test", DONE: "Done" })[value] || value || "Planned"; }
  function priorityLabel(value) { return ({ CRITICAL: "Critical", HIGH: "High", MEDIUM: "Medium", LOW: "Low" })[value] || value || "Medium"; }
  function normalizeName(value) { return String(value || "").trim().replace(/\s+/g, " "); }
  function relativeTime(value) { const time = new Date(value).getTime(); if (!time) return "recently"; const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000)); if (seconds < 60) return `${seconds} seconds ago`; if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`; if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`; return `${Math.floor(seconds / 86400)} days ago`; }
  function slugify(value) { return String(value || "calendar").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }

  function showDialog(dialog) { document.body.classList.add("dialog-open"); dialog.showModal(); }
  function setLoading(active) { $("#calendarLoading").classList.toggle("is-hidden", !active); }
  function showConnectionError(message) { const host = $("#calendarConnectionBanner"); host.textContent = message || ""; host.classList.toggle("is-hidden", !message); }
  function setPageMessage(message, tone = "") { const host = $("#calendarMessage"); host.textContent = message || ""; host.className = `form-status calendar-page-message${tone ? ` is-${tone}` : ""}`; }
  function setEventStatus(message, tone = "") { const host = $("#calendarEventFormStatus"); host.textContent = message || ""; host.className = `form-status event-form-status${tone ? ` is-${tone}` : ""}`; }
  function setSubscriptionStatus(message, tone = "") { const host = $("#calendarSubscriptionStatus"); host.textContent = message || ""; host.className = `form-status${tone ? ` is-${tone}` : ""}`; }
  function setButtonBusy(button, busy, label) { button.disabled = busy; button.textContent = label; }
  function downloadFile(name, body, type) { const blob = new Blob([body], { type }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 500); }
})();
